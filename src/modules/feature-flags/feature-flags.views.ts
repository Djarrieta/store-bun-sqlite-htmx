/** Feature-flags admin views + routes. */
import type { Router } from "../../core/router.ts";
import { html, fragment, notFound } from "../../core/http.ts";
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { flagsRepo } from "./feature-flags.db.ts";
import { FLAGS_KEY, FLAGS } from "./feature-flags.rules.ts";
import type { User } from "../../auth/auth.db.ts";

const BASE = "/admin/flags";

function flagRow(key: string, label: string, description: string, enabled: boolean): string {
  return `<div class="data-row" id="flag-${escapeAttr(key)}">
    <div class="data-row__main">
      <div class="data-row__title">${escapeHtml(label)} ${enabled ? `<span class="badge badge--ok">Activo</span>` : `<span class="badge">Inactivo</span>`}</div>
      <div class="data-row__meta">${escapeHtml(description)}</div>
    </div>
    <div class="data-row__actions">
      <button class="btn ${enabled ? "btn--danger" : ""} btn--sm"
        hx-post="${BASE}/${escapeAttr(key)}/toggle" hx-target="#flag-${escapeAttr(key)}" hx-swap="outerHTML">
        ${enabled ? "Desactivar" : "Activar"}
      </button>
    </div>
  </div>`;
}

function flagsPage(user: User): string {
  const rows = FLAGS.map((f) => flagRow(f.key, f.label, f.description, flagsRepo.isEnabled(f.key))).join("");
  return adminShell({ user, active: FLAGS_KEY, title: "Feature flags", body: `<div class="panel"><h1>Feature flags</h1>${rows}</div>` });
}

export function registerFeatureFlagsRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, FLAGS_KEY, "view");
    if (user instanceof Response) return user;
    return html(flagsPage(user));
  });

  router.post(`${BASE}/:key/toggle`, (ctx) => {
    const user = requirePermission(ctx, FLAGS_KEY, "edit");
    if (user instanceof Response) return user;
    const def = FLAGS.find((f) => f.key === ctx.params.key);
    if (!def) return notFound("Flag no válido.");
    const next = !flagsRepo.isEnabled(def.key);
    flagsRepo.setEnabled(def.key, next);
    return fragment(flagRow(def.key, def.label, def.description, next));
  });
}
