#!/usr/bin/env bash
set -euo pipefail

release_root=""
state_root=""
service_user="cybermedica-web"
service_group="cybermedica-web"
port="3012"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --release-root) release_root="${2:-}"; shift 2 ;;
    --state-root) state_root="${2:-}"; shift 2 ;;
    --user) service_user="${2:-}"; shift 2 ;;
    --group) service_group="${2:-}"; shift 2 ;;
    --port) port="${2:-}"; shift 2 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 64 ;;
  esac
done

[[ "$EUID" -eq 0 ]] || { echo "Systemd sandbox test must run as root." >&2; exit 1; }
[[ -d "$release_root" && "$release_root" == /opt/cybermedica-web/* ]] || {
  echo "Release root must be an existing path below /opt/cybermedica-web." >&2
  exit 1
}
[[ "$state_root" == "/var/lib/cybermedica-web/next-runtime" ]] || {
  echo "Runtime state root must use the canonical Production path." >&2
  exit 1
}
[[ "$port" =~ ^[0-9]+$ ]] || { echo "Port must be numeric." >&2; exit 1; }

node_bin="$(command -v node)"
npm_bin="$(command -v npm)"
env_bin="$(command -v env)"
build_id="$(tr -d '\r\n' < "${release_root}/.next/BUILD_ID")"
build_state="${state_root}/${build_id}"
printf -v fault_secret_key '%s%s' 'sb_' 'secret_fault_injection_only_000000000000'
dropin="${release_root}/infra/systemd/cybermedica-web.service.d/20-next-runtime-state.conf"
policy_helper="${release_root}/scripts/release/systemd-runtime-state-policy.mjs"
probe_helper="${release_root}/scripts/release/systemd-runtime-state-probe.mjs"
suffix="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-$$"
probe_unit="cybermedica-systemd-probe-${suffix}.service"
app_unit="cybermedica-systemd-next-${suffix}.service"
app_log="${RUNNER_TEMP:-/tmp}/${app_unit}.log"

cleanup() {
  local status=$?
  trap - EXIT
  systemctl stop "$app_unit" >/dev/null 2>&1 || true
  systemctl reset-failed "$app_unit" "$probe_unit" >/dev/null 2>&1 || true
  if [[ "$status" -ne 0 ]]; then
    journalctl --no-pager -u "$app_unit" -n 200 2>/dev/null | tee "$app_log" >&2 || true
  fi
  exit "$status"
}
trap cleanup EXIT

"$node_bin" "$policy_helper" audit "$dropin" >/dev/null
systemctl is-system-running --wait >/dev/null 2>&1 || [[ "$(systemctl is-system-running 2>/dev/null)" == "degraded" ]]

common_properties=(
  --property="User=${service_user}"
  --property="Group=${service_group}"
  --property="WorkingDirectory=${release_root}"
  --property="ProtectSystem=strict"
  --property="ReadOnlyPaths=/opt/cybermedica-web"
  --property="ReadWritePaths=${state_root}"
  --property="NoNewPrivileges=yes"
  --property="UMask=0077"
)

systemd-run --quiet --wait --pipe --collect \
  --unit="$probe_unit" \
  "${common_properties[@]}" \
  "$env_bin" \
  "HOME=/nonexistent" \
  "NODE_ENV=production" \
  "NEXT_PHASE=phase-production-server" \
  "CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT=${state_root}" \
  "RELEASE_ROOT=${release_root}" \
  "BUILD_STATE=${build_state}" \
  "$node_bin" "$probe_helper"

systemd-run --quiet --collect \
  --unit="$app_unit" \
  "${common_properties[@]}" \
  "$env_bin" \
  "PATH=${PATH}" \
  "HOME=/nonexistent" \
  "NODE_ENV=production" \
  "CATALOG_DATA_SOURCE=cloud_published" \
  "CYBERMEDICA_SUPABASE_PROJECT_REF=gjlpkqdhlzbfnzzoxlsk" \
  "CYBERMEDICA_SUPABASE_URL=https://gjlpkqdhlzbfnzzoxlsk.supabase.co" \
  "SUPABASE_SECRET_KEY=${fault_secret_key}" \
  "CYBERMEDICA_CATALOG_FAULT_INJECTION=all" \
  "CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT=${state_root}" \
  "$npm_bin" start -- --hostname 127.0.0.1 --port "$port"

ready="NO"
for _ in $(seq 1 45); do
  if [[ "$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${port}/about" || true)" == "200" ]]; then
    ready="YES"
    break
  fi
  [[ "$(systemctl is-active "$app_unit" 2>/dev/null || true)" == "active" ]] || break
  sleep 1
done
[[ "$ready" == "YES" ]] || { echo "Next.js did not become ready under the systemd sandbox." >&2; exit 1; }

effective_protect="$(systemctl show "$app_unit" --property=ProtectSystem --value)"
effective_readwrite="$(systemctl show "$app_unit" --property=ReadWritePaths --value)"
effective_readonly="$(systemctl show "$app_unit" --property=ReadOnlyPaths --value)"
effective_bind="$(systemctl show "$app_unit" --property=BindPaths --value)"
effective_user="$(systemctl show "$app_unit" --property=User --value)"
effective_group="$(systemctl show "$app_unit" --property=Group --value)"
[[ "$effective_protect" == "strict" ]]
[[ "$effective_readwrite" == "$state_root" ]]
[[ "$effective_readonly" == "/opt/cybermedica-web" ]]
[[ -z "$effective_bind" ]]
[[ "$effective_user" == "$service_user" ]]
[[ "$effective_group" == "$service_group" ]]

journalctl --no-pager -u "$app_unit" > "$app_log"
if grep -Eq 'EROFS.*next-runtime|EACCES.*next-runtime' "$app_log"; then
  echo "Approved runtime state was not writable under systemd." >&2
  exit 1
fi

echo "PROTECT_SYSTEM_STRICT=YES"
echo "ALLOWED_WRITABLE_ROOT=${state_root}"
echo "OLD_RELEASE_SPECIFIC_READWRITEPATHS=0"
echo "IMMUTABLE_RELEASE_WRITABLE=NO"
echo "SERVICE_USER_CAN_WRITE_RUNTIME_STATE=YES"
echo "SERVICE_USER_CANNOT_WRITE_RELEASE=YES"
echo "NEXT_START_UNDER_SYSTEMD=PASS"
echo "EROFS_RUNTIME_STATE=0"
echo "EACCES=0"
