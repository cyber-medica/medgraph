import "server-only";

import { createRequire } from "node:module";

import { loadLocalAuthShadowEnvironmentFromServer } from "./environment.server.ts";
import { PostgresLocalAuthRepository } from "./repository.ts";
import { LocalAuthService } from "./service.ts";
import {
  InMemoryLocalAuthShadowRateLimiter,
  type LocalAuthShadowDependencies,
} from "./shadow.ts";
import {
  type MagicLinkMailTransport,
  Yandex360MagicLinkMailer,
} from "./yandex-mail.ts";

interface NodeMailerTransport {
  sendMail(message: Parameters<MagicLinkMailTransport["sendMail"]>[0]): Promise<unknown>;
}

interface NodeMailerModule {
  createTransport(config: Readonly<{
    host: string;
    port: number;
    secure: boolean;
    auth: Readonly<{ user: string; pass: string }>;
  }>): NodeMailerTransport;
}

let cachedRuntime: LocalAuthShadowDependencies | null | undefined;

export function getLocalAuthShadowRuntime() {
  if (cachedRuntime !== undefined) return cachedRuntime;
  const environment = loadLocalAuthShadowEnvironmentFromServer();
  if (!environment.enabled) {
    cachedRuntime = null;
    return cachedRuntime;
  }

  const repository = new PostgresLocalAuthRepository(
    environment.databaseUrl,
    "cybermedica-local-auth-shadow",
  );
  const service = new LocalAuthService(repository, { hashKey: environment.hashKey });
  const require = createRequire(import.meta.url);
  const nodemailer = require("nodemailer") as NodeMailerModule;
  const nodeMailerTransport = nodemailer.createTransport({
    host: environment.smtp.host,
    port: environment.smtp.port,
    secure: environment.smtp.secure,
    auth: {
      user: environment.smtp.user,
      pass: environment.smtp.password,
    },
  });
  const transport: MagicLinkMailTransport = {
    sendMail: (message) => nodeMailerTransport.sendMail(message),
  };
  cachedRuntime = {
    enabled: true,
    service,
    mailer: new Yandex360MagicLinkMailer({
      from: environment.smtp.from,
      callbackOrigin: environment.callbackOrigin,
    }, transport),
    rateLimiter: new InMemoryLocalAuthShadowRateLimiter(),
    callbackOrigin: environment.callbackOrigin,
  };
  return cachedRuntime;
}
