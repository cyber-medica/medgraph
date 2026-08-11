# Supabase CLI login containment — 2026-08-11

Status: **PASS**. This report contains redacted security evidence only. No
credential value, connection string, authorization header, generated CLI login
material, cookie, session token or database password is recorded.

## Incident classification

| Field | Result |
| --- | --- |
| Production project | `clbzibuusyuajsylcbvl` |
| Credential class | temporary Supabase CLI database login role (`cli_login_postgres` boundary) |
| Exposure source | `supabase db dump --dry-run` rendered generated connection material in tool output |
| PAT / Management token exposed | No evidence |
| Long-lived Production database password exposed | No evidence |
| Containment method | official Supabase Management API `DELETE /v1/projects/{ref}/cli/login-role` |
| Final revocation timestamp | `2026-08-11T09:08:06Z` (UTC client evidence; provider audit is authoritative) |
| Old credential authentication after revoke | **FAIL** — the backing CLI login roles were deleted server-side |
| New secure boundary validation | **PASS** — a new temporary boundary completed a read-only migration-ledger check and the backup, then was revoked |
| Active temporary boundary after backup | revoked |
| Secrets committed | `0` |

The official Management API returned HTTP `200` for the initial containment
and for the final post-backup revocation. The management token was read from
native macOS Keychain storage inside the process and was never placed in a
visible command argument or report.

## Fresh post-containment backup

| Field | Result |
| --- | --- |
| Backup ID | `production-postcontainment-clbzibuusyuajsylcbvl-20260811T085731Z` |
| Storage | local recovery boundary outside Git, directory `0700`, files `0600` |
| Scope | CyberMedica application schemas plus `supabase_migrations`; managed `auth`, `storage`, and `realtime` data excluded |
| Manifest SHA-256 | `9bb285b006a9c8b73b9385c3986b9c3900379b917e45203e7a55c7993d6f7499` |
| Database archive SHA-256 | `411a939011effd6b9a94df09d707842738cbc66613a6fd6eb2554e70ac157cac` |
| Roles archive SHA-256 | `aa9aa7b903ee5f37034129a9231bed6a7eb90954e229d034335b2888651c6c90` |
| Migration count | `29` |
| Latest migration | `202608030002` |
| Credential-pattern matches | `0` |
| Managed Auth/Storage/Realtime COPY sections | `0` |

An initial backup attempt was rejected because its default data dump contained
managed Auth rows. No values were read or printed. That entire generated backup
set was deleted before the allowlisted backup above was created.

## Independent restore verification

The allowlisted backup was restored into a disposable Supabase-compatible
PostgreSQL `17.6` container with `network=none`. Application triggers were
disabled only inside the disposable import session; their exact states were
captured first and restored after import.

| Check | Result |
| --- | --- |
| Restore errors | `0` |
| Products | `79` |
| Published / unpublished | `71 / 8` |
| Revisions / Decisions / Approvals / publication batches | `71 / 71 / 71 / 71` |
| Projection version | `73` |
| Migration history | `29`, latest `202608030002` |
| Product RLS | enabled |
| Projection-state RLS | enabled |
| Trigger state reconciliation | `68 / 68`, mismatches `0`; `41` remain `ENABLE ALWAYS` |
| Disposable container | removed |

## Secret scan

The final scan covered the release tracked tree (`1,699` text files), release
history patch from canonical baseline, untracked files, backup artifacts,
available Supabase trace files and relevant temporary artifacts.

Result: **PASS**, matches `0` for Supabase PATs, JWTs, credential-bearing
PostgreSQL URLs, bearer header values, GitHub tokens and private keys. A
temporary authorization-header file left by the first failed wrapper was found
by the scan, removed without reading or printing its value, and the complete
scan then passed with residual temporary artifacts `0`.

## Release disposition

The security and backup blockers are cleared. Production Product/lifecycle
data, application deployment, ENV and DNS were not modified by containment.
The existing Production Launch Release may resume from
`aa0129d4113fc842d8a28d3bb6c1c8c5abf5507c` without rebuilding the accepted
R9, SEO, brand or catalog integration work.
