# Controlled cutover readiness contract

The Production cutover runner must keep `set -Eeuo pipefail` and its global
`ERR` rollback trap. Expected startup races are the one exception: a new
`next start` process can take a short time to bind its loopback port, so an
initial curl exit `7` (connection refused) or `28` (bounded timeout) is a
retryable readiness result rather than an immediate rollback condition.

Source the repository helper and invoke it as a normal command after the web
service has started:

```bash
source "$release/scripts/release/cutover-readiness.sh"

new_pid="$(systemctl show -p MainPID --value cybermedica-web.service)"
cutover_wait_for_http \
  --url http://127.0.0.1:3000/ \
  --expected-status 200 \
  --attempts 30 \
  --interval-seconds 2 \
  --connect-timeout-seconds 2 \
  --request-timeout-seconds 10 \
  --process-pid "$new_pid"
```

Do not put the failing `curl` directly inside command substitution under an
inherited `ERR` trap. The helper redirects the status to a temporary file and
executes curl as the condition of an `if`, which is the Bash context where an
expected non-zero probe is handled explicitly instead of escaping to rollback.

The loop is bounded. Exhausting all attempts returns `73`; an exited candidate
returns `72`; unexpected curl failures return `71`; and HTTP 5xx returns `70`.
When the helper is called as shown, each non-zero final result reaches the
existing global `ERR` trap and performs the normal deterministic rollback.
HTTP statuses other than the expected status and 5xx remain retryable until
the watchdog expires.

The helper does not stop, start, switch, or modify any service, release, env,
Nginx configuration, database, or network resource. Those mutations remain in
the separately approved cutover runner. Its only responsibility is classifying
the bounded loopback readiness window.
