import { readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const releaseRoot = resolve(process.env.RELEASE_ROOT ?? "");
const buildState = resolve(process.env.BUILD_STATE ?? "");
if (releaseRoot === resolve("") || buildState === resolve("")) {
  throw new Error("RELEASE_ROOT and BUILD_STATE are required.");
}

const directProbe = join(buildState, `.systemd-runtime-write-${process.pid}`);
await writeFile(directProbe, "runtime-state-write\n", { mode: 0o640 });
await rm(directProbe);

const releaseProbe = join(releaseRoot, `.systemd-release-write-${process.pid}`);
let releaseWriteBlocked = false;
try {
  await writeFile(releaseProbe, "must-not-write\n", { flag: "wx", mode: 0o640 });
  await rm(releaseProbe, { force: true });
} catch (error) {
  releaseWriteBlocked = error?.code === "EROFS" || error?.code === "EACCES" || error?.code === "EPERM";
}
if (!releaseWriteBlocked) throw new Error("Immutable release write was not blocked by the systemd sandbox.");

const require = createRequire(join(releaseRoot, "package.json"));
const RuntimeCacheHandler = require(join(releaseRoot, "lib/runtime/next-runtime-cache-handler.cjs"));
const handler = new RuntimeCacheHandler({
  flushToDisk: true,
  serverDistDir: join(releaseRoot, ".next/server"),
  maxMemoryCacheSize: 0,
  revalidatedTags: [],
  _requestHeaders: {},
});

await handler.set("systemd-fetch-probe", {
  kind: "FETCH",
  data: { headers: {}, body: "systemd-fetch", url: "https://invalid.example/systemd-probe" },
  revalidate: 60,
}, { kind: "FETCH", fetchCache: true, tags: ["systemd-probe"] });

const appContext = { kind: "APP_PAGE", isFallback: false, isRoutePPREnabled: false };
await handler.set("/__systemd-app-page-probe", {
  kind: "APP_PAGE",
  html: "<main>systemd runtime state</main>\n",
  rscData: Buffer.from("systemd-rsc\n"),
  headers: {},
  postponed: undefined,
  status: 200,
  segmentData: new Map([["/_tree", Buffer.from("systemd-segment\n")]]),
}, appContext);

await handler.set("systemd-image-probe", {
  kind: "IMAGE",
  etag: "systemd-etag",
  upstreamEtag: "systemd-upstream-etag",
  extension: "webp",
  revalidate: 60,
  buffer: Buffer.from("systemd-image-bytes"),
}, { kind: "IMAGE" });

await readFile(join(buildState, "cache/fetch-cache/systemd-fetch-probe"), "utf8");
await readFile(join(buildState, "server/app/__systemd-app-page-probe.html"), "utf8");
await readFile(join(buildState, "images-v1", "c5561f0b81ac1f2c58a019fef941df695946a978493e2a43ece7b5450a9e4f37", "payload.bin"));

console.log("SYSTEMD_RUNTIME_WRITE=PASS");
console.log("SYSTEMD_RELEASE_WRITE_BLOCKED=PASS");
console.log("SYSTEMD_FETCH_CACHE_WRITE=PASS");
console.log("SYSTEMD_APP_PAGE_WRITE=PASS");
console.log("SYSTEMD_IMAGE_CACHE_WRITE=PASS");
