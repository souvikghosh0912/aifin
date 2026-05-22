import "server-only";

/**
 * Simple token-bucket limiter for outbound calls to NSE/BSE upstreams.
 * NSE throttles aggressively (~3 req/sec); we stay well below.
 *
 * Single-process. For multi-instance deployments, layer a Redis bucket on top.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.last = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.last = now;
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

export const nseBucket = new TokenBucket(4, 2); // 2 req/sec sustained, burst of 4
