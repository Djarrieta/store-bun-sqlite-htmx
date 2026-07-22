/**
 * Server entry: builds the router, resolves session + guest identity per request,
 * serves static assets before the router, and dispatches with cookie + security
 * header finalization. Public branches (storefront, static) resolve before any
 * per-route guard (tech-spec §4).
 */
import { config } from "./config.ts";
import { newId } from "./db.ts";
import { Router, type RouteContext, type HttpMethod } from "./core/router.ts";
import { parseCookies, serializeCookie, notFound, serverError, html } from "./core/http.ts";
import { registerAllRoutes } from "./core/modules.ts";
import { runMigrations } from "./migrations/index.ts";

// Auth subsystem (side-effect: create tables).
import "./auth/auth.db.ts";
import { resolveUser, purgeExpiredSessions, SESSION_COOKIE } from "./auth/auth.service.ts";
import { registerAuthRoutes } from "./auth/auth.routes.ts";
import { registerGoogleOAuthRoutes } from "./auth/oauth.google.ts";
import { requireAdmin } from "./auth/index.ts";

// Storefront + admin dashboard.
import { registerHomeRoutes } from "./storefront/home.routes.ts";
import { registerCatalogRoutes } from "./storefront/catalog.routes.ts";
import { registerProductRoutes } from "./storefront/product.routes.ts";
import { registerCartRoutes } from "./storefront/cart.routes.ts";
import { registerCheckoutRoutes } from "./storefront/checkout.routes.ts";
import { registerOrderRoutes } from "./storefront/order.routes.ts";
import { registerChatWebRoutes } from "./chat/chat.web.routes.ts";
import { registerChatApiRoutes } from "./chat/chat.api.routes.ts";
import { registerWhatsappRoutes } from "./integrations/whatsapp/whatsapp.routes.ts";
import { adminDashboard } from "./views.ts";

// Domain modules (each imports its own tables as a side-effect).
import "./modules/index.ts";

const GUEST_COOKIE = "guest_ref";
const GUEST_TTL_SEC = 60 * 60 * 24 * 365; // 1 year

const router = new Router();
registerAuthRoutes(router);
registerGoogleOAuthRoutes(router);
registerHomeRoutes(router);
registerCatalogRoutes(router);
registerProductRoutes(router);
registerCartRoutes(router);
registerCheckoutRoutes(router);
registerOrderRoutes(router);
registerChatWebRoutes(router);
registerChatApiRoutes(router);
registerWhatsappRoutes(router);
router.get("/admin", (ctx) => {
  const user = requireAdmin(ctx);
  if (user instanceof Response) return user;
  return html(adminDashboard(user));
});
registerAllRoutes(router);

runMigrations();
purgeExpiredSessions();

// ---- Static assets ----
const STATIC_PREFIXES = ["/brand/", "/vendor/", "/fonts/", "/uploads/"];

async function serveStatic(url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!STATIC_PREFIXES.some((p) => path.startsWith(p))) return null;
  const decoded = decodeURIComponent(path);
  if (decoded.includes("..") || decoded.includes("\0")) return new Response("Forbidden", { status: 403 });
  const file = Bun.file(`public${decoded}`);
  if (!(await file.exists())) return null;
  return new Response(file, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

// ---- Security headers (tech-spec §16) ----
const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function finalize(res: Response, cookies: string[]): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const staticRes = await serveStatic(url);
  if (staticRes) return staticRes;

  const cookies = parseCookies(req);
  const user = resolveUser(cookies[SESSION_COOKIE]);
  const queued: string[] = [];

  let guestRef = cookies[GUEST_COOKIE];
  if (!guestRef) {
    guestRef = newId();
    queued.push(
      serializeCookie(GUEST_COOKIE, guestRef, {
        httpOnly: true,
        sameSite: "Lax",
        secure: config.isProd,
        path: "/",
        maxAge: GUEST_TTL_SEC,
      }),
    );
  }

  const ctx: RouteContext = {
    req,
    url,
    method: req.method as HttpMethod,
    params: {},
    query: url.searchParams,
    cookies,
    user,
    guestRef,
    isHtmx: req.headers.get("hx-request") === "true",
    _cookies: queued,
    setCookie: (c: string) => queued.push(c),
  };

  const match = router.match(req.method, url.pathname);
  if (!match) return finalize(notFound(), queued);
  ctx.params = match.params;

  try {
    const res = await match.handler(ctx);
    return finalize(res, queued);
  } catch (err) {
    console.error(`[${req.method} ${url.pathname}]`, err);
    return finalize(serverError(), queued);
  }
}

const server = Bun.serve({
  port: config.port,
  idleTimeout: 30,
  fetch: handle,
});

console.log(`CRISTA store running at http://localhost:${server.port} (${config.nodeEnv})`);
