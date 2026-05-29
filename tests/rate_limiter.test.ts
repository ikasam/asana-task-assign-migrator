import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  createThrottledRunner,
  defaultRateLimitDetector,
  defaultRetryAfterExtractor,
} from "../src/rate_limiter.ts";

function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: (ms: number) => {
      sleeps.push(ms);
      t += ms;
      return Promise.resolve();
    },
    advance: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}

Deno.test("throttledRunner: enforces minimum interval between calls", async () => {
  const clock = fakeClock();
  const run = createThrottledRunner({
    minIntervalMs: 400,
    detectRateLimit: () => false,
    extractRetryAfterSec: () => undefined,
    sleep: clock.sleep,
    now: clock.now,
  });

  await run(() => Promise.resolve("a"));
  await run(() => Promise.resolve("b"));
  await run(() => Promise.resolve("c"));

  // First call has no prior, so gap >= minInterval; subsequent calls each sleep ~400ms.
  // First sleep entry is 400 (gap=0), then 400 again per loop start.
  assertEquals(clock.sleeps.filter((s) => s > 0).length, 3);
  for (const s of clock.sleeps) assert(s >= 0 && s <= 400);
});

Deno.test("throttledRunner: skips sleep when natural gap already exceeds minInterval", async () => {
  const clock = fakeClock();
  const run = createThrottledRunner({
    minIntervalMs: 400,
    detectRateLimit: () => false,
    extractRetryAfterSec: () => undefined,
    sleep: clock.sleep,
    now: clock.now,
  });
  await run(() => Promise.resolve("a"));
  clock.advance(1000);
  const sleepsBefore = clock.sleeps.length;
  await run(() => Promise.resolve("b"));
  // Second call's pre-call sleep should be 0 because gap is already 1000 >= 400.
  // The runner may still record a 0-length sleep depending on implementation; tolerate that.
  for (const s of clock.sleeps.slice(sleepsBefore)) assert(s <= 0);
});

Deno.test("throttledRunner: retries on 429 with Retry-After + 1s wait", async () => {
  const clock = fakeClock();
  let attempts = 0;
  const run = createThrottledRunner({
    minIntervalMs: 0,
    detectRateLimit: defaultRateLimitDetector,
    extractRetryAfterSec: defaultRetryAfterExtractor,
    sleep: clock.sleep,
    now: clock.now,
    maxAttempts: 3,
  });

  const out = await run(() => {
    attempts++;
    if (attempts < 2) {
      throw {
        status: 429,
        response: { status: 429, headers: { "retry-after": "2" } },
      };
    }
    return Promise.resolve("ok");
  });

  assertEquals(out, "ok");
  assertEquals(attempts, 2);
  // 2 sec from header + 1 sec margin = 3000ms wait must appear.
  assert(clock.sleeps.includes(3000), `expected 3000ms sleep, got ${JSON.stringify(clock.sleeps)}`);
});

Deno.test("throttledRunner: exponential backoff when Retry-After unreadable", async () => {
  const clock = fakeClock();
  let attempts = 0;
  const run = createThrottledRunner({
    minIntervalMs: 0,
    detectRateLimit: defaultRateLimitDetector,
    extractRetryAfterSec: () => undefined,
    sleep: clock.sleep,
    now: clock.now,
    maxAttempts: 3,
  });
  const out = await run(() => {
    attempts++;
    if (attempts < 3) throw { status: 429 };
    return Promise.resolve("ok");
  });
  assertEquals(out, "ok");
  assert(clock.sleeps.includes(2000));
  assert(clock.sleeps.includes(4000));
});

Deno.test("throttledRunner: max attempts then rethrow", async () => {
  const clock = fakeClock();
  const run = createThrottledRunner({
    minIntervalMs: 0,
    detectRateLimit: defaultRateLimitDetector,
    extractRetryAfterSec: () => undefined,
    sleep: clock.sleep,
    now: clock.now,
    maxAttempts: 2,
  });
  await assertRejects(() =>
    run(() => {
      throw { status: 429 };
    })
  );
});

Deno.test("throttledRunner: non-rate-limit error propagates immediately", async () => {
  const clock = fakeClock();
  let attempts = 0;
  const run = createThrottledRunner({
    minIntervalMs: 0,
    detectRateLimit: defaultRateLimitDetector,
    extractRetryAfterSec: () => undefined,
    sleep: clock.sleep,
    now: clock.now,
  });
  await assertRejects(() =>
    run(() => {
      attempts++;
      throw { status: 403 };
    })
  );
  assertEquals(attempts, 1);
});

Deno.test("defaultRetryAfterExtractor: reads from response.headers", () => {
  const err = { response: { headers: { "retry-after": "7" } } };
  assertEquals(defaultRetryAfterExtractor(err), 7);
});

Deno.test("defaultRetryAfterExtractor: case-insensitive Retry-After", () => {
  const err = { response: { headers: { "Retry-After": "5" } } };
  assertEquals(defaultRetryAfterExtractor(err), 5);
});

Deno.test("defaultRetryAfterExtractor: returns undefined when absent", () => {
  assertEquals(defaultRetryAfterExtractor({}), undefined);
  assertEquals(defaultRetryAfterExtractor(null), undefined);
  assertEquals(defaultRetryAfterExtractor("not-an-object"), undefined);
});

Deno.test("defaultRateLimitDetector: recognizes all 429 shapes", () => {
  assertEquals(defaultRateLimitDetector({ status: 429 }), true);
  // Normalized AsanaApiErrorImpl shape (httpStatus, not status).
  assertEquals(defaultRateLimitDetector({ httpStatus: 429 }), true);
  assertEquals(defaultRateLimitDetector({ response: { status: 429 } }), true);
  assertEquals(defaultRateLimitDetector({ status: 403 }), false);
  assertEquals(defaultRateLimitDetector({ httpStatus: 500 }), false);
  assertEquals(defaultRateLimitDetector(null), false);
  assertEquals(defaultRateLimitDetector("nope"), false);
});
