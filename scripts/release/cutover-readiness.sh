#!/usr/bin/env bash

# Safe to source from a cutover runner that uses `set -E` and a global ERR trap.
# Expected transient curl failures are evaluated as an `if` condition so Bash
# does not dispatch the caller's ERR trap before this bounded loop can retry.
cutover_wait_for_http() {
  local url=''
  local expected_status='200'
  local attempts='30'
  local interval_seconds='2'
  local connect_timeout_seconds='2'
  local request_timeout_seconds='10'
  local process_pid=''

  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --url) url="${2:-}"; shift 2 ;;
      --expected-status) expected_status="${2:-}"; shift 2 ;;
      --attempts) attempts="${2:-}"; shift 2 ;;
      --interval-seconds) interval_seconds="${2:-}"; shift 2 ;;
      --connect-timeout-seconds) connect_timeout_seconds="${2:-}"; shift 2 ;;
      --request-timeout-seconds) request_timeout_seconds="${2:-}"; shift 2 ;;
      --process-pid) process_pid="${2:-}"; shift 2 ;;
      *) printf 'Unknown readiness option: %s\n' "$1" >&2; return 64 ;;
    esac
  done

  [[ -n "$url" ]] || { printf 'Missing --url\n' >&2; return 64; }
  [[ "$expected_status" =~ ^[1-5][0-9][0-9]$ ]] || { printf 'Invalid --expected-status\n' >&2; return 64; }
  [[ "$attempts" =~ ^[1-9][0-9]*$ ]] || { printf 'Invalid --attempts\n' >&2; return 64; }
  if [[ -n "$process_pid" ]] && ! [[ "$process_pid" =~ ^[1-9][0-9]*$ ]]; then
    printf 'Invalid --process-pid\n' >&2
    return 64
  fi

  local status_file
  status_file="$(mktemp "${TMPDIR:-/tmp}/cybermedica-cutover-readiness.XXXXXX")"
  local attempt status curl_exit

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    : > "$status_file"
    curl_exit=0
    if curl --silent --show-error \
      --output /dev/null \
      --write-out '%{http_code}\n' \
      --connect-timeout "$connect_timeout_seconds" \
      --max-time "$request_timeout_seconds" \
      "$url" > "$status_file"; then
      curl_exit=0
    else
      curl_exit=$?
    fi
    status="$(tr -d '\r\n' < "$status_file")"

    if [[ "$curl_exit" -eq 0 && "$status" == "$expected_status" ]]; then
      rm -f "$status_file"
      printf 'READINESS_ATTEMPT=%s CURL_EXIT=0 HTTP_STATUS=%s CLASS=READY\n' "$attempt" "$status"
      printf 'READINESS_RESULT=PASS\n'
      return 0
    fi

    if [[ "$status" =~ ^5[0-9][0-9]$ ]]; then
      rm -f "$status_file"
      printf 'READINESS_ATTEMPT=%s CURL_EXIT=%s HTTP_STATUS=%s CLASS=CRITICAL_HTTP_5XX\n' \
        "$attempt" "$curl_exit" "$status" >&2
      return 70
    fi

    if [[ "$curl_exit" -ne 0 && "$curl_exit" -ne 7 && "$curl_exit" -ne 28 ]]; then
      rm -f "$status_file"
      printf 'READINESS_ATTEMPT=%s CURL_EXIT=%s HTTP_STATUS=%s CLASS=CRITICAL_CURL_ERROR\n' \
        "$attempt" "$curl_exit" "${status:-000}" >&2
      return 71
    fi

    if [[ -n "$process_pid" ]] && ! kill -0 "$process_pid" 2>/dev/null; then
      rm -f "$status_file"
      printf 'READINESS_ATTEMPT=%s CURL_EXIT=%s HTTP_STATUS=%s CLASS=PROCESS_EXITED\n' \
        "$attempt" "$curl_exit" "${status:-000}" >&2
      return 72
    fi

    printf 'READINESS_ATTEMPT=%s CURL_EXIT=%s HTTP_STATUS=%s CLASS=RETRYABLE\n' \
      "$attempt" "$curl_exit" "${status:-000}"
    if [[ "$attempt" -lt "$attempts" ]]; then
      sleep "$interval_seconds"
    fi
  done

  rm -f "$status_file"
  printf 'READINESS_RESULT=TIMEOUT ATTEMPTS=%s\n' "$attempts" >&2
  return 73
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  cutover_wait_for_http "$@"
fi
