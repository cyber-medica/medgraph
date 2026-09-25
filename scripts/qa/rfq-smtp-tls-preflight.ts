import tls from "node:tls";

const HOST = "smtp.yandex.ru";
const PORT = 465;
const TIMEOUT_MS = 10_000;

await new Promise<void>((resolve, reject) => {
  const socket = tls.connect({
    host: HOST,
    port: PORT,
    servername: HOST,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });

  const timeout = setTimeout(() => {
    socket.destroy(new Error("SMTP TLS preflight timed out."));
  }, TIMEOUT_MS);

  socket.once("secureConnect", () => {
    const protocol = socket.getProtocol();
    const certificate = socket.getPeerCertificate();
    clearTimeout(timeout);
    if (!socket.authorized || !protocol || !certificate.valid_to) {
      socket.destroy(new Error("SMTP TLS certificate validation failed."));
      return;
    }
    process.stdout.write(`${JSON.stringify({
      event: "rfq_smtp_tls_preflight_passed",
      host: HOST,
      port: PORT,
      authorized: true,
      protocol,
      certificateExpiresAt: certificate.valid_to,
      applicationDataSent: false,
    })}\n`);
    socket.end();
    resolve();
  });
  socket.once("error", (error) => {
    clearTimeout(timeout);
    reject(error);
  });
});
