import { isOpaqueToken } from "./core.ts";

export interface MagicLinkMailTransport {
  sendMail(options: Readonly<{
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    disableFileAccess: true;
    disableUrlAccess: true;
  }>): Promise<unknown>;
}

export interface YandexMagicLinkMailerConfig {
  from: string;
  callbackOrigin: string;
}

export class MagicLinkDeliveryError extends Error {
  readonly code = "local_auth_mail_delivery_failed";

  constructor() {
    super("Local authentication mail delivery failed.");
    this.name = "MagicLinkDeliveryError";
  }
}

export class Yandex360MagicLinkMailer {
  private readonly from: string;
  private readonly callbackOrigin: string;
  private readonly transport: MagicLinkMailTransport;

  constructor(config: YandexMagicLinkMailerConfig, transport: MagicLinkMailTransport) {
    const origin = new URL(config.callbackOrigin);
    if (origin.pathname !== "/" || origin.search || origin.hash) {
      throw new Error("local_auth_mail_origin_invalid");
    }
    this.from = config.from;
    this.callbackOrigin = origin.origin;
    this.transport = transport;
  }

  async sendMagicLink(input: Readonly<{
    normalizedEmail: string;
    rawToken: string;
    expiresAt: Date;
  }>) {
    if (!isOpaqueToken(input.rawToken)) throw new MagicLinkDeliveryError();
    const callback = new URL("/internal/auth/local/callback", this.callbackOrigin);
    callback.searchParams.set("token", input.rawToken);
    const expires = input.expiresAt.toISOString();
    try {
      await this.transport.sendMail({
        from: this.from,
        to: input.normalizedEmail,
        subject: "Вход во внутренний контур CyberMedica",
        text: `Ссылка для входа: ${callback.toString()}\nДействительна до: ${expires}`,
        html: `<p>Ссылка для входа во внутренний контур:</p><p><a href="${callback.toString()}">Войти</a></p><p>Действительна до: ${expires}</p>`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } catch {
      throw new MagicLinkDeliveryError();
    }
  }
}
