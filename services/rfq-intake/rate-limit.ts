import { createHmac } from "node:crypto";

interface Bucket {
  count: number;
  resetAt: number;
  lastSeenAt: number;
}

export class HashedRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly secret: string;
  private readonly windowMs: number;
  private readonly maximumRequests: number;
  private readonly maximumEntries: number;

  constructor(
    secret: string,
    windowMs = 15 * 60 * 1_000,
    maximumRequests = 5,
    maximumEntries = 5_000,
  ) {
    this.secret = secret;
    this.windowMs = windowMs;
    this.maximumRequests = maximumRequests;
    this.maximumEntries = maximumEntries;
  }

  check(input: { ip: string; userAgent: string; now?: number }) {
    const now = input.now ?? Date.now();
    this.cleanup(now);
    const key = createHmac("sha256", this.secret)
      .update(input.ip)
      .update("\0")
      .update(input.userAgent.slice(0, 180))
      .digest("hex");
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
        lastSeenAt: now,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    current.lastSeenAt = now;
    if (current.count <= this.maximumRequests) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  private cleanup(now: number) {
    if (this.buckets.size < this.maximumEntries) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    if (this.buckets.size < this.maximumEntries) return;
    const oldest = [...this.buckets.entries()]
      .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)
      .slice(0, Math.ceil(this.maximumEntries / 5));
    for (const [key] of oldest) this.buckets.delete(key);
  }
}
