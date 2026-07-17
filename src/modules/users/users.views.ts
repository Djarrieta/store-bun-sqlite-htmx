/** Users admin views + routes: list users, change roles, show allowlist. */
import type { Router } from "../../core/router.ts";
import { html, redirect, notFound, badRequest } from "../../core/http.ts";
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { ALL_ROLES, type Role } from "../../core/permissions.ts";
import { formatDate } from "../../core/format.ts";
import { config } from "../../config.ts";
import { usersRepo, type User } from "../../auth/auth.db.ts";
import { USERS_KEY } from "./users.rules.ts";
import type { Page } from "../../core/repository.ts";

const BASE = "/admin/usuarios";

function userRow(current: User, u: User): string {
  const isSelf = u.id === current.id;
  const options = ALL_ROLES.map(
    (r) => `<option value="${r}"${r === u.role ? " selected" : ""}>${r}</option>`,
  ).join("");
  const control = isSelf
    ? `<span class="badge badge--accent">${escapeHtml(u.role)} (tú)</span>`
    : `<form method="post" action="${BASE}/${escapeAttr(u.id)}/rol" style="display:flex;gap:0.5rem;align-items:center">
        <select class="select" name="role" style="width:auto">${options}</select>
        <button class="btn btn--sm" type="submit">Guardar</button>
      </form>`;
  return `<div class="data-row">
    <div class="data-row__main">
      <div class="data-row__title">${escapeHtml(u.display_name || u.email)}</div>
      <div class="data-row__meta">${escapeHtml(u.email)} · alta ${escapeHtml(formatDate(u.created_at))}${u.phone ? ` · 📱 ${escapeHtml(u.phone)}` : ""}</div>
    </div>
    <div class="data-row__actions">${control}</div>
  </div>`;
}

function usersPage(current: User, pageData: Page<User>): string {
  const rows = pageData.items.map((u) => userRow(current, u)).join("");
  const allow = config.adminAllowlist.length
    ? config.adminAllowlist.map((e) => `<code>${escapeHtml(e)}</code>`).join(", ")
    : "<span class='muted'>vacía</span>";
  const body = `
    <div class="panel" style="margin-bottom:1.5rem">
      <h1 style="margin:0 0 0.5rem">Usuarios</h1>
      <p class="muted" style="margin:0">Allowlist de admin (ADMIN_ALLOWLIST): ${allow}. Estos correos entran como <strong>admin</strong> al iniciar sesión.</p>
    </div>
    <div class="panel">${rows || `<p class="muted">No hay usuarios.</p>`}</div>`;
  return adminShell({ user: current, active: USERS_KEY, title: "Usuarios", body });
}

export function registerUsersRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, USERS_KEY, "view");
    if (user instanceof Response) return user;
    const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;
    const pageData = usersRepo.paginate<User>({ page: pageNum, orderBy: "created_at DESC" });
    return html(usersPage(user, pageData));
  });

  router.post(`${BASE}/:id/rol`, async (ctx) => {
    const user = requirePermission(ctx, USERS_KEY, "edit_role");
    if (user instanceof Response) return user;
    const target = usersRepo.findById(ctx.params.id!);
    if (!target) return notFound("Usuario no encontrado.");
    if (target.id === user.id) return badRequest("No puedes cambiar tu propio rol.");
    const form = await ctx.req.formData();
    const role = String(form.get("role") ?? "") as Role;
    if (!ALL_ROLES.includes(role)) return badRequest("Rol inválido.");
    usersRepo.updateRole(target.id, role);
    return redirect(BASE);
  });
}
