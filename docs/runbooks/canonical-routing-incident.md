# Canonical routing P0 runbook

1. Freeze Product patches, migrations, revisions, Review, Approval, and
   Publication.
2. Capture DNS, redirect chain, headers, body hash, and legacy markers for `/`,
   `/catalog`, `/request`, `/sitemap.xml`, Product Detail, and internal login.
3. Compare authoritative REG.RU answers with at least four public resolvers.
4. Confirm `server: Vercel`, `x-vercel-id`, final apex host, and one matching
   CyberMedica deployment/release fingerprint on every route.
5. Treat `static.tildacdn.com` only as published media provenance. It does not
   prove that a Tilda page served the navigation response.
6. Inspect Vercel Domains, Production deployment provenance, Next.js redirects,
   rewrites, Proxy, service-worker scope, and registrar forwarding.
7. Correct only a proven record, alias, rewrite, forwarding rule, or deployment.
   Never change MX, Supabase, Product data, or lifecycle to repair routing.
8. Run the canonical HTTP gate and clean iPhone WebKit direct-navigation smoke.
9. Resume Product work only after catalog and sitemap counts match, all legacy
   markers are absent, and the synthetic monitor is green.

If server probes are canonical but one device still shows Tilda, capture that
device's Safari Network response and response headers before clearing it. A
stale tab snapshot or browser cache cannot be called the server root cause
without that evidence.

## Partial-body or regional timeout procedure

1. Use full GETs with a bounded timeout and drain the body. A successful HEAD,
   HTTP status, or TTFB does not prove availability: a response can stall after
   Vercel sends headers and the first body chunk.
2. Record DNS, connect, TLS, TTFB, total time, downloaded bytes,
   `x-vercel-cache`, `x-vercel-id`, and the CyberMedica release/deployment
   headers for `/`, `/catalog`, `/manufacturers`, `/request`, and `/thanks`.
3. Compare the same workstation through the affected direct interface and VPN
   without changing application state. Repeat from an independent network.
4. Test the domain with correct Host/SNI against every IP returned by Vercel's
   range lookup. Run Vercel's official connectivity debug script from the
   affected network and send its unredacted output only through the private
   Support case because it contains workstation network metadata.
5. Include one static cache hit such as `/thanks` and one dynamic miss such as
   `/request`. If both stall after fast TLS/TTFB while the same deployment works
   over VPN, treat the fault as edge/network reachability until contrary
   runtime evidence exists.
6. Confirm A and AAAA independently. Absence of AAAA proves that the observed
   production request is not using IPv6; it does not justify adding an
   unvalidated AAAA record.
7. Do not switch to Vercel's general-purpose or legacy apex IP from generic
   documentation. First inspect the project's current Domain Settings value and
   preflight the candidate from the affected network with a complete body.
8. Before an approved DNS mitigation, record the rollback value, lower TTL in
   advance, wait one old TTL, preserve MX/unrelated records, and define an
   automatic rollback condition for certificate, routing, body, or release
   mismatch.
9. Keep paid traffic paused until 20 consecutive full-body rounds pass on the
   affected direct network and a second independent point. A green VPN-only or
   CI-only run is insufficient.
