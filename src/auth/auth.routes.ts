/** Auth routes: /login, /dev-login (dev only), /logout, /account. OAuth in F8. */
import type { Router, RouteContext } from "../core/router.ts";
import { html, redirect, badRequest } from "../core/http.ts";
import { tooMany } from "../core/ratelimit.ts";
import { requireUser } from "./index.ts";
import { config } from "../config.ts";
import { createSession, clearSessionCookie, destroySession, upsertUserByEmail, SESSION_COOKIE } from "./auth.service.ts";
import { loginPage, accountPage } from "./auth.views.ts";
import { migrateChatSession } from "../chat/chat.history.ts";

/** Open-redirect guard: `next` must be an app-local path. */
export function safeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export function registerAuthRoutes(router: Router): void {
  router.get("/login", (ctx) => {
    if (ctx.user) return redirect(safeNext(ctx.query.get("next")));
    return html(loginPage({ user: null, next: safeNext(ctx.query.get("next")) }));
  });

  router.post("/dev-login", async (ctx) => {
    if (!config.devLogin) return badRequest("Dev-login deshabilitado.");
    const limited = tooMany(ctx, "dev-login", 10, 5 * 60_000);
    if (limited) return limited;
    const form = await ctx.req.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const next = safeNext(String(form.get("next") ?? "/"));
    if (!email || !email.includes("@")) {
      return html(loginPage({ user: null, next, error: "Correo inválido." }), { status: 400 });
    }
    const user = upsertUserByEmail({ email });
    migrateChatSession(ctx.guestRef, user.id);
    const session = createSession(user.id);
    ctx.setCookie(session.cookie);
    return redirect(next);
  });

  router.post("/logout", (ctx: RouteContext) => {
    destroySession(ctx.cookies[SESSION_COOKIE]);
    ctx.setCookie(clearSessionCookie());
    return redirect("/");
  });

  router.get("/account", (ctx) => {
    const user = requireUser(ctx);
    if (user instanceof Response) return user;
    return html(accountPage(user));
  });
}
