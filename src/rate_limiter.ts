// Rate limiter per S-007.
//
// Strategy:
//   - Enforce a minimum 400ms gap between successive requests (≤ 150 req/min).
//   - On 429: respect Retry-After if readable, else exponential backoff (2/4/8s).
//   - Up to 3 retries total.
//
// The Retry-After extractor is injectable because H-DENO2 is unverified;
// when superagent error shapes are confirmed, only the extractor changes.

const MIN_INTERVAL_MS = 400;
const BACKOFF_SEQUENCE_MS = [2000, 4000, 8000];
const MAX_ATTEMPTS = 3;

export interface RateLimitError {
  isRateLimit: true;
  retryAfterSec?: number;
}

export type RetryAfterExtractor = (err: unknown) => number | undefined;
export type RateLimitDetector = (err: unknown) => boolean;

export interface ThrottledRunnerOptions {
  minIntervalMs?: number;
  detectRateLimit: RateLimitDetector;
  extractRetryAfterSec: RetryAfterExtractor;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxAttempts?: number;
}

export function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs requests serially with throttle + 429 retry.
// One instance per migration run; state (lastRequestAt) lives on the closure.
export function createThrottledRunner(opts: ThrottledRunnerOptions) {
  const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  let lastRequestAt = 0;

  return async function run<T>(call: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      attempt++;
      const gap = now() - lastRequestAt;
      if (gap < minInterval) await sleep(minInterval - gap);

      try {
        lastRequestAt = now();
        return await call();
      } catch (err) {
        if (!opts.detectRateLimit(err)) throw err;
        if (attempt >= maxAttempts) throw err;
        const retryAfter = opts.extractRetryAfterSec(err);
        const waitMs = retryAfter !== undefined
          ? (retryAfter + 1) * 1000
          : BACKOFF_SEQUENCE_MS[Math.min(attempt - 1, BACKOFF_SEQUENCE_MS.length - 1)];
        await sleep(waitMs);
      }
    }
  };
}

// Default detector for superagent-shaped errors (npm:asana wraps superagent).
// Conservative: treat anything resembling a 429 status as rate-limit.
export const defaultRateLimitDetector: RateLimitDetector = (err) => {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (e.status === 429) return true;
  const res = e.response as Record<string, unknown> | undefined;
  if (res && res.status === 429) return true;
  return false;
};

// Default Retry-After extractor for superagent-shaped errors.
// Returns seconds or undefined if not readable. H-DENO2 confirms whether this works.
export const defaultRetryAfterExtractor: RetryAfterExtractor = (err) => {
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const res = e.response as Record<string, unknown> | undefined;
  const headers = res?.headers as Record<string, unknown> | undefined;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  return undefined;
};
