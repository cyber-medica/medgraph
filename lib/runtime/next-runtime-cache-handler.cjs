"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Next loads this stable cacheHandler entrypoint as CommonJS. */

const { createHash, randomUUID } = require("node:crypto");
const {
  constants: fsConstants,
  accessSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} = require("node:fs");
const {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} = require("node:fs/promises");
const { isAbsolute, join, relative, resolve, sep } = require("node:path");

const FileSystemCache = require("next/dist/server/lib/incremental-cache/file-system-cache").default;

const DEFAULT_RUNTIME_STATE_ROOT = "/var/lib/cybermedica-web/next-runtime";
const RUNTIME_STATE_ROOT_ENV = "CYBERMEDICA_NEXT_RUNTIME_STATE_ROOT";
const PRODUCTION_BUILD_PHASE = "phase-production-build";
const STATE_DIRECTORY_MODE = 0o750;
const STATE_FILE_MODE = 0o640;
const buildIdPattern = /^[A-Za-z0-9_-]{1,128}$/u;

function isInside(root, target) {
  const relation = relative(root, target);
  return relation === "" || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation));
}

function requireContainedPath(root, target) {
  const resolved = resolve(target);
  if (!isInside(root, resolved)) throw new Error("Next runtime cache path escapes its state root.");
  return resolved;
}

function buildIdFromServerDirectory(serverDistDir) {
  const buildId = readFileSync(join(serverDistDir, "..", "BUILD_ID"), "utf8").trim();
  if (!buildIdPattern.test(buildId)) throw new Error("Next runtime cache BUILD_ID is invalid.");
  return buildId;
}

function configuredStateBase(serverDistDir) {
  const configured = process.env[RUNTIME_STATE_ROOT_ENV];
  if (configured !== undefined) {
    if (!configured || configured !== configured.trim() || !isAbsolute(configured)) {
      throw new Error(`${RUNTIME_STATE_ROOT_ENV} must be one absolute canonical path.`);
    }
    return resolve(configured);
  }
  if (process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
    return resolve(serverDistDir, "..", "cache", "cybermedica-build-runtime-state");
  }
  return DEFAULT_RUNTIME_STATE_ROOT;
}

function resolveRuntimeState(serverDistDir) {
  if (!serverDistDir || !isAbsolute(serverDistDir)) {
    throw new Error("Next runtime cache requires an absolute serverDistDir.");
  }
  const buildId = process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE
    ? "build-phase"
    : buildIdFromServerDirectory(serverDistDir);
  const base = configuredStateBase(serverDistDir);
  const root = requireContainedPath(base, join(base, buildId));

  if (process.env.NEXT_PHASE === PRODUCTION_BUILD_PHASE) {
    mkdirSync(root, { recursive: true, mode: STATE_DIRECTORY_MODE });
    chmodSync(root, STATE_DIRECTORY_MODE);
  } else {
    const details = lstatSync(root);
    if (!details.isDirectory() || details.isSymbolicLink()) {
      throw new Error("Prepared Next runtime state path must be a real directory.");
    }
    accessSync(root, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);
  }

  return { base, buildId, root: realpathSync(root) };
}

function createStateFilesystem(root) {
  return {
    existsSync(path) {
      return existsSync(requireContainedPath(root, path));
    },
    readFile(path, options) {
      return readFile(requireContainedPath(root, path), options);
    },
    readFileSync(path, options) {
      return readFileSync(requireContainedPath(root, path), options);
    },
    async writeFile(path, data) {
      const target = requireContainedPath(root, path);
      await writeFile(target, data, { mode: STATE_FILE_MODE });
      await chmod(target, STATE_FILE_MODE);
    },
    async mkdir(path) {
      const target = requireContainedPath(root, path);
      await mkdir(target, { recursive: true, mode: STATE_DIRECTORY_MODE });
      await chmod(target, STATE_DIRECTORY_MODE);
      return target;
    },
    stat(path, options) {
      return stat(requireContainedPath(root, path), options);
    },
  };
}

function createReadOnlySeedFilesystem(root) {
  return {
    existsSync(path) {
      return existsSync(requireContainedPath(root, path));
    },
    readFile(path, options) {
      return readFile(requireContainedPath(root, path), options);
    },
    readFileSync(path, options) {
      return readFileSync(requireContainedPath(root, path), options);
    },
    async writeFile() {
      throw new Error("Immutable Next cache seed cannot be written.");
    },
    async mkdir() {
      throw new Error("Immutable Next cache seed cannot be changed.");
    },
    stat(path, options) {
      return stat(requireContainedPath(root, path), options);
    },
  };
}

function imageEntryDirectory(imageRoot, cacheKey) {
  const digest = createHash("sha256").update(cacheKey).digest("hex");
  return requireContainedPath(imageRoot, join(imageRoot, digest));
}

class CyberMedicaRuntimeCacheHandler {
  constructor(ctx) {
    if (!ctx?.serverDistDir) {
      // Middleware/edge wrappers instantiate the configured handler without a
      // Node filesystem. They do not own the self-hosted server cache.
      this.disabled = true;
      return;
    }
    const state = resolveRuntimeState(ctx.serverDistDir);
    const externalServerDirectory = join(state.root, "server");
    mkdirSync(externalServerDirectory, { recursive: true, mode: STATE_DIRECTORY_MODE });
    chmodSync(externalServerDirectory, STATE_DIRECTORY_MODE);

    this.stateRoot = state.root;
    this.imageRoot = join(state.root, "images-v1");
    this.writable = new FileSystemCache({
      ...ctx,
      fs: createStateFilesystem(state.root),
      serverDistDir: externalServerDirectory,
    });
    this.readOnlySeed = new FileSystemCache({
      ...ctx,
      fs: ctx.fs ?? createReadOnlySeedFilesystem(resolve(ctx.serverDistDir, "..")),
    });
  }

  async get(cacheKey, ctx) {
    if (this.disabled) return null;
    if (ctx?.kind === "IMAGE") return this.getImage(cacheKey);
    return (await this.writable.get(cacheKey, ctx)) ?? this.readOnlySeed.get(cacheKey, ctx);
  }

  async set(cacheKey, data, ctx) {
    if (this.disabled) return;
    if (data?.kind === "IMAGE") {
      await this.setImage(cacheKey, data);
      return;
    }
    await this.writable.set(cacheKey, data, ctx);
  }

  async revalidateTag(tags, durations) {
    if (this.disabled) return;
    await this.writable.revalidateTag(tags, durations);
  }

  resetRequestCache() {
    if (this.disabled) return;
    this.writable.resetRequestCache();
    this.readOnlySeed.resetRequestCache();
  }

  async getImage(cacheKey) {
    const entry = imageEntryDirectory(this.imageRoot, cacheKey);
    try {
      const metadata = JSON.parse(await readFile(join(entry, "metadata.json"), "utf8"));
      if (
        metadata?.schemaVersion !== 1
        || metadata.kind !== "IMAGE"
        || typeof metadata.lastModified !== "number"
        || typeof metadata.etag !== "string"
        || typeof metadata.upstreamEtag !== "string"
        || typeof metadata.extension !== "string"
      ) return null;
      const buffer = await readFile(join(entry, "payload.bin"));
      return {
        lastModified: metadata.lastModified,
        value: {
          kind: "IMAGE",
          etag: metadata.etag,
          upstreamEtag: metadata.upstreamEtag,
          extension: metadata.extension,
          revalidate: metadata.revalidate,
          isMiss: metadata.isMiss,
          isStale: metadata.isStale,
          buffer,
        },
      };
    } catch {
      return null;
    }
  }

  async setImage(cacheKey, data) {
    if (!Buffer.isBuffer(data.buffer) || data.buffer.length === 0) {
      throw new Error("Next image cache refuses an empty or non-buffer payload.");
    }
    await mkdir(this.imageRoot, { recursive: true, mode: STATE_DIRECTORY_MODE });
    await chmod(this.imageRoot, STATE_DIRECTORY_MODE);
    const target = imageEntryDirectory(this.imageRoot, cacheKey);
    const temporary = requireContainedPath(this.imageRoot, join(this.imageRoot, `.tmp-${randomUUID()}`));
    await mkdir(temporary, { mode: STATE_DIRECTORY_MODE });
    try {
      const metadata = {
        schemaVersion: 1,
        kind: "IMAGE",
        lastModified: Date.now(),
        etag: data.etag,
        upstreamEtag: data.upstreamEtag,
        extension: data.extension,
        revalidate: data.revalidate,
        isMiss: data.isMiss,
        isStale: data.isStale,
      };
      await writeFile(join(temporary, "metadata.json"), `${JSON.stringify(metadata)}\n`, { mode: STATE_FILE_MODE });
      await writeFile(join(temporary, "payload.bin"), data.buffer, { mode: STATE_FILE_MODE });
      await rm(target, { recursive: true, force: true });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}

module.exports = CyberMedicaRuntimeCacheHandler;
module.exports.DEFAULT_RUNTIME_STATE_ROOT = DEFAULT_RUNTIME_STATE_ROOT;
module.exports.RUNTIME_STATE_ROOT_ENV = RUNTIME_STATE_ROOT_ENV;
