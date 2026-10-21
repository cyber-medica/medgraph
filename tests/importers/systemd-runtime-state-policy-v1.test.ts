import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  SYSTEMD_RELEASE_ROOT,
  SYSTEMD_RUNTIME_STATE_ROOT,
  auditSystemdRuntimeStatePolicy,
} from "../../scripts/release/systemd-runtime-state-policy.mjs";

const dropinPath = join(
  process.cwd(),
  "infra/systemd/cybermedica-web.service.d/20-next-runtime-state.conf",
);

test("canonical web drop-in permits only the external runtime-state root", async () => {
  const report = auditSystemdRuntimeStatePolicy(await readFile(dropinPath, "utf8"));
  assert.equal(report.pass, true);
  assert.equal(report.protectSystem, "strict");
  assert.equal(report.user, "cybermedica-web");
  assert.equal(report.group, "cybermedica-web");
  assert.equal(report.readWritePathsReset, true);
  assert.deepEqual(report.readWritePaths, [SYSTEMD_RUNTIME_STATE_ROOT]);
  assert.deepEqual(report.oldReleaseSpecificReadWritePaths, []);
  assert.deepEqual(report.unexpectedReadWritePaths, []);
  assert.equal(report.immutableReleaseReadOnly, true);
  assert.deepEqual(report.bindPaths, []);
});

test("release-specific Next writable paths fail closed", () => {
  const report = auditSystemdRuntimeStatePolicy(`
[Service]
User=cybermedica-web
Group=cybermedica-web
ProtectSystem=strict
ReadOnlyPaths=${SYSTEMD_RELEASE_ROOT}
ReadWritePaths=
ReadWritePaths=/opt/cybermedica-web/releases/aa093611b63e34fa7aab537e890baabfb3c53523/.next/cache
ReadWritePaths=/opt/cybermedica-web/releases/aa093611b63e34fa7aab537e890baabfb3c53523/.next/server/app
`);
  assert.equal(report.pass, false);
  assert.equal(report.oldReleaseSpecificReadWritePaths.length, 2);
});

test("broad writable parents fail closed", () => {
  const report = auditSystemdRuntimeStatePolicy(`
[Service]
User=cybermedica-web
Group=cybermedica-web
ProtectSystem=strict
ReadOnlyPaths=${SYSTEMD_RELEASE_ROOT}
ReadWritePaths=
ReadWritePaths=/var/lib
`);
  assert.equal(report.pass, false);
  assert.deepEqual(report.unexpectedReadWritePaths, ["/var/lib"]);
});

test("drop-in must reset inherited writable paths", () => {
  const report = auditSystemdRuntimeStatePolicy(`
[Service]
User=cybermedica-web
Group=cybermedica-web
ProtectSystem=strict
ReadOnlyPaths=${SYSTEMD_RELEASE_ROOT}
ReadWritePaths=${SYSTEMD_RUNTIME_STATE_ROOT}
`);
  assert.equal(report.pass, false);
  assert.equal(report.readWritePathsReset, false);
});

test("CI runs the real Linux systemd namespace gate", async () => {
  const workflow = await readFile(
    join(process.cwd(), ".github/workflows/catalog-reliability-gate.yml"),
    "utf8",
  );
  const sandbox = await readFile(
    join(process.cwd(), "scripts/release/systemd-runtime-state-sandbox.sh"),
    "utf8",
  );
  const probe = await readFile(
    join(process.cwd(), "scripts/release/systemd-runtime-state-probe.mjs"),
    "utf8",
  );
  assert.match(workflow, /systemd-runtime-state-sandbox\.sh/u);
  assert.match(workflow, /SYSTEMD_SANDBOX_GATE=PASS/u);
  assert.match(sandbox, /ProtectSystem=strict/u);
  assert.match(sandbox, /ReadOnlyPaths=\/opt\/cybermedica-web/u);
  assert.match(sandbox, /ReadWritePaths=\$\{state_root\}/u);
  assert.match(sandbox, /--setenv="RELEASE_ROOT=\$\{release_root\}"/u);
  assert.match(sandbox, /--setenv="BUILD_STATE=\$\{build_state\}"/u);
  assert.match(sandbox, /--property=ReadOnlyPaths --value/u);
  assert.match(sandbox, /--property=BindPaths --value/u);
  assert.match(sandbox, /\[\[ -z "\$effective_bind" \]\]/u);
  assert.match(sandbox, /NEXT_START_UNDER_SYSTEMD=PASS/u);
  assert.match(sandbox, /EROFS_RUNTIME_STATE=0/u);
  assert.match(probe, /if \(!releaseRootInput \|\| !buildStateInput\)/u);
  assert.doesNotMatch(probe, /releaseRoot === resolve\(""\)/u);
  assert.doesNotMatch(sandbox, /ProtectSystem=(?:false|no|off)/u);
  assert.doesNotMatch(sandbox, /ReadWritePaths=\/var\/lib(?:\s|"|$)/u);
});
