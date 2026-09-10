# Production route timeout P0 — 2026-09-10

## Disposition

**Status: root-cause boundary confirmed; production mitigation pending. Paid
traffic must remain paused.**

The failure is a path-specific partial response-body stall between the affected
Russian access network and Vercel's custom-domain anycast edge. DNS, TCP, TLS,
Vercel routing, and the first response bytes complete, but the body does not.
The same requests complete over VPN. A static Vercel cache hit and dynamic
cache misses fail in the same way, so neither application SSR nor Supabase can
explain the incident.

The available evidence does not identify which carrier or Vercel BGP segment is
at fault. That final provider-level attribution requires Vercel Support to
correlate the attached network-debug evidence. It is nevertheless specific
enough to place the failure outside the CyberMedica application runtime.

No DNS, production deployment, application data, Supabase configuration, SEO
content, or advertising configuration was changed during this investigation.

## Reproduction

All probes below are full IPv4 GET requests with the response body drained;
HEAD-only checks are not accepted. Timings are in seconds. The direct and VPN
samples used the same workstation and deployment, with only the bound network
interface changed.

### Affected direct network (`en0`)

| Route | HTTP | Connect | TLS | TTFB | Total | Bytes received | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 200 | 0.028 | 0.123 | 0.313 | 20.009 | 9,001 / 141,443 | timeout |
| `/catalog` | 200 | 0.042 | 0.091 | 0.419 | 20.008 | 13,037 / ~1,227,000 | timeout |
| `/manufacturers` | 200 | 0.027 | 0.076 | 0.276 | 20.004 | 13,037 / 139,621 | timeout |
| `/request` | 200 | 0.027 | 0.075 | 0.254 | 20.009 | 13,037 / ~31,100 | timeout |
| `/thanks` | 200 | 0.028 | 0.077 | 0.148 | 20.008 | 8,897 / 24,495 | timeout |

### VPN route (`utun7`)

| Route | HTTP | Connect | TLS | TTFB | Total | Bytes | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 200 | 0.002 | 0.397 | 0.683 | 0.934 | 141,443 | complete |
| `/catalog` | 200 | 0.002 | 0.425 | 0.759 | 2.491 | ~1,227,000 | complete |
| `/manufacturers` | 200 | 0.003 | 0.353 | 0.619 | 0.874 | 139,621 | complete |
| `/request` | 200 | 0.002 | 0.342 | 0.621 | 0.699 | 31,123 | complete |
| `/thanks` | 200 | 0.002 | 0.352 | 0.498 | 0.557 | 24,495 | complete |

One hundred earlier full GETs (20 rounds across the five routes) also completed
through the VPN route without a timeout. A later run of the new availability
gate completed 15/15 probes through that route.

The failure is not specific to HTTP/2: forced HTTP/1.1 and HTTP/2 transfers of
`/thanks` both stalled on the direct path. Content encoding changes the
threshold but does not repair the route. Compressed `/request` and `/thanks`
HTML (approximately 6.3 KB and 5.2 KB transferred) completed, while compressed
`/`, `/catalog`, and `/manufacturers` still stalled after approximately 13–16
KB. That size-dependent behavior is further evidence of a transport path fault;
it is not a safe basis for an application workaround because pages also require
larger shared assets.

That browser-impact condition was verified on `/request`: its small compressed
HTML completed, but the required global CSS stalled after 13,037 bytes and a
required JavaScript chunk stalled after 10,665 bytes. A smaller 4,380-byte
runtime chunk completed. The paid landing therefore cannot be called available
merely because its compressed document is small enough to arrive.

Two independent Russian probes in Moscow and Saint Petersburg returned HTTP
200 at the measurement time. This does not invalidate the direct reproduction;
it narrows the incident to an ISP/route-specific failure rather than a global
Vercel outage.

## Cache and runtime isolation

The affected direct network received one deployment and release on every
route:

- deployment `dpl_EkgRXQeXNyrNLXJ1zKmqSdw23quc`;
- release `611e20d6f34cac0b3cafd885bc5cea4f5657a51a`;
- `server: Vercel` and a populated `x-vercel-id`.

The anycast address stayed `216.198.79.1`, but the direct samples identified
the edge as `arn1` while the VPN samples identified it as `fra1`. This is direct
evidence that the route change selects a different Vercel edge path without
changing application release.

| Route | Cache response | Body result on direct network |
| --- | --- | --- |
| `/catalog` | `x-vercel-cache: MISS`; private/no-store | stalled |
| `/request` | `x-vercel-cache: MISS`; private/no-store | stalled |
| `/thanks` | `x-vercel-cache: HIT`; public; fixed `content-length: 24495` | stalled |

`/thanks` is a simple statically generated page with no catalog or Supabase
read. Plain `/request` resolves no Product and therefore performs no catalog
read before rendering. The root layout also intentionally does not await the
remote catalog. Catalog-backed routes use a 60-second validated cache, bounded
8,000 ms and 2,500 ms upstream attempts, and a bundled validated last-known-good
projection. A failure common to `/thanks`, plain `/request`, and catalog-backed
routes therefore cannot originate in that upstream read path.

## DNS, IP-stack, and edge evidence

- Cloudflare, Google, and Yandex resolvers returned one apex A record,
  `216.198.79.1`, with approximately 86,000 seconds TTL at the test time.
- No resolver returned an AAAA record. Production does not use an IPv6 route.
- Vercel's official connectivity tool returned the expected eight-IP range and
  completed HTTP 200 over the VPN route.
- Direct SNI-correct full GETs against each of `216.198.79.1`,
  `216.198.79.65`, `216.198.79.129`, `216.198.79.193`, `64.29.17.1`,
  `64.29.17.65`, `64.29.17.129`, and `64.29.17.193` all reached HTTP 200 and
  then stalled while reading `/thanks`.
- Direct `76.76.21.21` did not establish TCP within ten seconds. The legacy
  endpoint is therefore not a safe workaround for this affected network.
- `medgraph.vercel.app` completed its small protected response over the direct
  network (HTTP 401 from Deployment Protection). It took approximately 11
  seconds versus 0.7 seconds over VPN, showing degraded Vercel reachability but
  a different result from the custom-domain body stall. Deployment Protection
  prevents an unauthenticated application-content comparison.

The Vercel debug output is intentionally retained outside Git because it
contains workstation network metadata. It should be attached privately to a
Vercel Support case with the local timestamp and affected-domain details.

## Logs and control-plane access

The public response samples produced no 5xx, 504, worker-timeout, application
exception, or release divergence: the failure happens after a 200 response is
already streaming. The scheduled GitHub history was otherwise green; run
`34383158136` failed before its first site probe while apt was installing the
browser dependencies.

No authenticated Vercel Dashboard/CLI session was available in the isolated
worktree, so private Runtime Logs, edge telemetry, Domain Settings, and
Supabase control-plane logs were not read or changed. No token or secret was
requested or copied into the investigation. Vercel Support must correlate the
`arn1` direct-path request IDs and the debug artifact to distinguish a Vercel
edge fault from its upstream carrier path.

## Corrective in this change

The application runtime is unchanged because it is not the failure boundary.
The monitoring blind spot is corrected:

- a dependency-free Node availability gate performs three cache-busted full
  GETs for `/`, `/catalog`, `/manufacturers`, `/request`, and `/thanks`;
- every response must be HTTP 200, non-empty, Vercel-served, and carry the
  CyberMedica release plus Vercel request identity;
- a timeout, truncated body, non-200, missing fingerprint, or recovered
  transient leaves the gate failed;
- per-attempt TTFB, total time, byte count, cache state, deployment, release,
  Vercel request ID, and a sanitized error class are logged;
- the lightweight gate runs before npm/browser installation;
- the browser layer uses the lockfile-matched Playwright 1.61.0 Ubuntu image
  instead of invoking apt through `install --with-deps` on every schedule.

This removes the failure mode seen in GitHub run `34383158136`, where an apt
repository hash mismatch prevented any production request from running.

## Production-safe mitigation decision

Do **not** switch the apex to `76.76.21.21`: the affected direct route cannot
connect to it. Do not rotate among the other returned Vercel IPs: all eight
reproduce the body stall. Do not lower application timeouts, add client retry
loops, weaken TLS, or change Supabase access; none repairs the transport path.

The immediate next action is a Vercel Support escalation using the official
debug artifact and the full-body evidence. Before any DNS change, an
authenticated operator must also inspect Vercel Domain Settings for the
project-specific recommended apex value; Vercel documents that this value can
differ from the general-purpose endpoint.

If Vercel cannot restore reliable routing for the affected Russian network,
the production mitigation is a separately validated front door on a reachable
network (for example, a Russian-hosted CDN/reverse proxy) or moving the public
frontend/paid landing off this Vercel path. The candidate must be tested with
full-body GETs from the affected direct network, VPN, and an independent
Russian point before cutover.

## Controlled cutover and rollback plan

1. Keep advertising paused and retain `216.198.79.1` as the recorded rollback
   value.
2. Obtain the authoritative Vercel Domain Settings recommendation and resolve
   the chosen front-door design. Do not infer it from generic documentation.
3. Reduce the current approximately 24-hour DNS TTL in advance and wait one old
   TTL before treating a later switch as quickly reversible.
4. Preflight the candidate with the production Host/SNI, certificate,
   redirects, release headers, and full response bodies for all five routes.
5. Change only the approved web-routing record. Preserve MX and all unrelated
   DNS records.
6. Verify 20 consecutive rounds from the affected direct network plus a second
   independent point. Verify the browser synthetic separately.
7. Roll back to `216.198.79.1` if any route, certificate, redirect, body,
   release fingerprint, or form journey differs.

No DNS operation is authorized by this report.

## References

- [Vercel connectivity troubleshooting](https://vercel.com/kb/guide/troubleshooting-connectivity-issues)
- [Vercel Support connectivity debug tool](https://github.com/vercel-support/vercel-connect-debug)
- [Vercel custom-domain setup and project-specific DNS guidance](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel optimized DNS record guidance](https://vercel.com/kb/guide/a-record-and-caa-with-vercel)
- [Playwright CI container guidance](https://playwright.dev/docs/ci)
- [Playwright Docker version-matching guidance](https://playwright.dev/docs/docker)

## Acceptance state

| Criterion | State |
| --- | --- |
| Concrete failure boundary | PASS |
| Five routes globally stable | **FAIL** on affected direct network |
| 20 consecutive checks | PASS only on VPN; **not accepted** for direct network |
| Two independent points | observed, but results differ by route |
| IPv4/IPv6 | IPv4 reproduced; no production AAAA |
| `/request` direct reliability | **FAIL** |
| Lightweight pre-browser gate | implemented and tested locally |
| Apt-independent browser layer | implemented; remote CI pending |
| Production mitigation | pending provider response or alternate front door |

The P0 remains open and blocks paid traffic. Merge/deploy of the monitoring
corrective must follow Preview and CI review, and it does not by itself claim
that production availability is repaired.
