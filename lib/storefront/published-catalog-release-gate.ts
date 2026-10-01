import {
  isPublishedCatalogOperationallyCurrent,
  type PublishedCatalogHealth,
} from "./published-catalog-resilience.ts";

export type PublishedCatalogAuthoritativeCheck = Readonly<{
  authoritativeCheckCompleted: boolean;
}>;

export class PublishedCatalogReleaseGateError extends Error {
  constructor() {
    super("Published catalog release gate failed closed.");
    this.name = "PublishedCatalogReleaseGateError";
  }
}

function releaseHealthIsCurrent(health: PublishedCatalogHealth) {
  return health.snapshotProductCount > 0
    && health.lastSuccessfulRefresh !== null
    && isPublishedCatalogOperationallyCurrent(health);
}

/**
 * A release check is intentionally stricter than public serving. It actively
 * invokes the uncached authoritative transport before reading health, then
 * rejects every fallback state even when a validated LKG remains serveable.
 */
export async function runPublishedCatalogReleaseGate(input: Readonly<{
  runAuthoritativeCheck: () => Promise<PublishedCatalogAuthoritativeCheck>;
  readHealth: () => PublishedCatalogHealth;
}>): Promise<PublishedCatalogHealth> {
  let check: PublishedCatalogAuthoritativeCheck;
  try {
    check = await input.runAuthoritativeCheck();
  } catch {
    throw new PublishedCatalogReleaseGateError();
  }

  const health = input.readHealth();
  if (check.authoritativeCheckCompleted !== true || !releaseHealthIsCurrent(health)) {
    throw new PublishedCatalogReleaseGateError();
  }
  return health;
}
