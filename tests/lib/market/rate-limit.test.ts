import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TokenBucket } from "@/lib/market/rate-limit";

describe("TokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("grants tokens up to capacity without waiting", async () => {
    const bucket = new TokenBucket(3, 1);
    await bucket.acquire();
    await bucket.acquire();
    await bucket.acquire();
    // Three immediate grants — no fake-timer advance needed.
  });

  it("waits for refill once the bucket is drained", async () => {
    const bucket = new TokenBucket(1, 1); // 1 token capacity, 1 token/sec
    await bucket.acquire(); // drain

    let resolved = false;
    const next = bucket.acquire().then(() => {
      resolved = true;
    });

    // Not yet — token hasn't refilled.
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    // Just over 1s — token should be available.
    await vi.advanceTimersByTimeAsync(700);
    await next;
    expect(resolved).toBe(true);
  });
});
