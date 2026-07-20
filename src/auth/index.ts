/**
 * Auth barrel + route guards. Guards return the `User` on success or a
 * `Response` (redirect/forbidden) that the handler should return as-is.
 */
import { forbidden, redirect } from "../core/http.ts";
import { can, isStaff } from "../core/permissions.ts";
import type { RouteContext } from "../core/router.ts";
import type { User } from "./auth.db.ts";

export * from "./auth.db.ts";
export * from "./auth.service.ts";

/** Require any authenticated user; otherwise redirect to /login. */
export function requireUser(ctx: RouteContext): User | Response {
  if (!ctx.user) return redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  return ctx.user;
}

/** Require a staff role (admin panel access). */
export function requireStaff(ctx: RouteContext): User | Response {
  if (!ctx.user) return redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  if (!isStaff(ctx.user)) return forbidden("Se requiere una cuenta de staff.");
  return ctx.user;
}

/** Require the admin role (dashboard access). */
export function requireAdmin(ctx: RouteContext): User | Response {
  if (!ctx.user) return redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  if (ctx.user.role !== "admin") return forbidden("Se requiere rol de administrador.");
  return ctx.user;
}

/** Require a specific permission (module + action). Gated in view AND route. */
export function requirePermission(ctx: RouteContext, moduleKey: string, action: string): User | Response {
  const guard = requireStaff(ctx);
  if (guard instanceof Response) return guard;
  if (!can(guard, moduleKey, action)) return forbidden("No tienes permiso para esta acción.");
  return guard;
}
