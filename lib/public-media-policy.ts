export const APPROVED_PUBLIC_MEDIA_HOSTS = [
  "cyber-medica.ru",
  "static.tildacdn.com",
] as const;

const approvedPublicMediaHosts = new Set<string>(APPROVED_PUBLIC_MEDIA_HOSTS);

/** Public media must be renderable by the same host policy used by next/image. */
export function isApprovedPublicMediaUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return url.protocol === "https:"
    && url.username === ""
    && url.password === ""
    && url.port === ""
    && approvedPublicMediaHosts.has(url.hostname);
}
