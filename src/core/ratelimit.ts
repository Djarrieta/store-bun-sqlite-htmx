/**
 * In-memory fixed-window rate limiter (tech-spec §16). Cloudflare provides the
 * primary edge limits; this is app-level defense in depth for sensitive routes.
 */
import type { RouteContext } from "./router.ts";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Real client IP behind Cloudflare (CF-Connecting-IP), with fallbacks. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

/** Returns true if the action is allowed under the limit. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/**
 * Convenience guard for handlers: returns a 429 Response if over the limit for
 * `name` + client IP, otherwise null (proceed).
 */
export function tooMany(ctx: RouteContext, name: string, max: number, windowMs: number): Response | null {
  const key = `${name}:${clientIp(ctx.req)}`;
  if (rateLimit(key, max, windowMs)) return null;
  return new Response("Demasiadas solicitudes. Intenta de nuevo en un momento.", {
    status: 429,
    headers: { "content-type": "text/plain; charset=utf-8", "retry-after": String(Math.ceil(windowMs / 1000)) },
  });
}
