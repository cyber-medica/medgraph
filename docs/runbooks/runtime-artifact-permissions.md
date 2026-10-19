# Runtime artifact permission gate

The production web release is started by an unprivileged `cybermedica-web`
service account. A successful `next build` is not sufficient evidence that the
result can be started by that account: generated files inherit the build
process umask. In particular, a build executed as root with `umask 077` creates
`.next/BUILD_ID` as `0600` and `.next` directories as `0700`.

The immutable archive must therefore be created only through
`scripts/release/runtime-artifact-permissions.mjs package`. A direct `tar`
command is not an accepted release path because it preserves unsafe input
modes.

## Policy

- Runtime directories: `0755`.
- Non-executable runtime files: `0644`.
- Files that were already executable: `0755`.
- Group/world-writable entries: forbidden.
- Symlinks: relative and contained inside the runtime tree.
- `.env*`, private keys, GitHub tokens, `sb_secret_*` values and legacy
  `service_role` JWT values: forbidden.
- Archive ownership is normalized to numeric `0:0`; runtime access relies on
  explicit modes, not owner identity.
- The release tree is immutable at runtime. Next.js server cache and optimized
  images live outside it in `/var/lib/cybermedica-web/next-runtime/<BUILD_ID>`.
- The build-scoped runtime-state directory is owned by
  `cybermedica-web:cybermedica-web`, mode `0750`; files created by the cache
  handler are `0640`. World-writable and group-writable state is forbidden.

The normalization is deliberately limited to a prepared runtime staging tree.
It must never be pointed at `/etc`, a live release, or the source checkout.

## Required order

1. Build the exact accepted source SHA with the approved build-time-only
   environment. Export both `TARGET_SHA` and `CYBERMEDICA_RELEASE_SHA` as the
   same exact 40-character lowercase commit SHA before `npm run build`. The
   prebuild gate verifies both values against `git rev-parse HEAD`; the
   postbuild gate verifies the baked `X-CyberMedica-Release` value in
   `.next/routes-manifest.json`.
2. Copy only the accepted runtime allowlist into a new staging directory.
3. Run the package command below. It removes build-only `.next/cache` and
   `.next/diagnostics`, rejects secret residue, normalizes modes, audits the
   complete tree, creates the archive with GNU tar, extracts it, and verifies
   every inventory hash and mode before writing the detached manifest sidecar.
4. Prepare exactly one external build-scoped runtime-state directory. This is
   the only deploy-time ownership change; never chown the release tree.
5. Run `service-audit` against the extracted tree as `cybermedica-web`, or as a
   dedicated equivalent unprivileged account on an isolated build host.
6. Start `next start` from that extracted tree as the same account and verify
   the required loopback routes. Stop the process after the smoke test.

```sh
export TARGET_SHA="$(git rev-parse HEAD)"
export CYBERMEDICA_RELEASE_SHA="$TARGET_SHA"
npm run build -- --webpack

node scripts/release/runtime-artifact-permissions.mjs package \
  --root "$RUNTIME_STAGING_ROOT" \
  --archive "$ARCHIVE_PATH" \
  --manifest "$MANIFEST_PATH" \
  --target-sha "$TARGET_SHA" \
  --tree-sha "$TREE_SHA" \
  --build-timestamp "$UTC_BUILD_TIMESTAMP" \
  --deployment-id "$DEPLOYMENT_ID"

node scripts/release/runtime-artifact-permissions.mjs service-audit \
  --root "$EXTRACTED_ROOT" \
  --state-root /var/lib/cybermedica-web/next-runtime \
  --user cybermedica-web
```

Run this root-only preparation command before the service-user audit:

```sh
node scripts/release/runtime-artifact-permissions.mjs prepare-state \
  --root "$EXTRACTED_ROOT" \
  --state-root /var/lib/cybermedica-web/next-runtime \
  --user cybermedica-web \
  --group cybermedica-web
```

`next.config.ts` uses the stable Next.js `cacheHandler` contract for ISR,
route/fetch cache and, with `images.customCacheHandler`, optimized images. The
handler reads pre-rendered seed entries from the immutable release but sends
every runtime write to the external build-scoped directory. A non-default
absolute root may be supplied through the server-only
`CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT` setting for isolated QA. It is not a
Next.js built-in variable and must never point inside the release.

## RCA: why `.next/cache` alone is insufficient

Next.js 16.3.6 writes fetch cache under `.next/cache/fetch-cache`, optimized
images under `.next/cache/images`, and ISR/app-page payloads directly beside
server code under `.next/server/app` (`.html`, `.rsc`, `.meta` and segment
files). Making only `.next/cache` writable leaves ISR broken. Making all of
`.next/server/app` writable would also make executable server bundles writable.
The external cache handler is therefore the narrowest supported separation of
immutable application content and mutable runtime state.

Both commands are fail-closed. Do not replace them with `chmod -R 777`, do not
add runtime environment files to the archive, and do not repair permissions on
an already staged Production candidate.
