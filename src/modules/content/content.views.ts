/** Content admin views + routes. */
import type { Router } from "../../core/router.ts";
import { html, redirect, notFound } from "../../core/http.ts";
import { adminShell } from "../../views.ts";
import { escapeHtml } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { textareaField, submitButton } from "../../components/forms.ts";
import { contentRepo } from "./content.db.ts";
import { CONTENT_KEY, CONTENT_FIELDS } from "./content.rules.ts";
import type { User } from "../../auth/auth.db.ts";

const BASE = "/admin/contenido";

function contentPage(user: User, saved?: string): string {
  const forms = CONTENT_FIELDS.map((f) => {
    const value = contentRepo.getValue(f.key, f.default);
    return `<div class="panel" style="margin-bottom:1.5rem">
      <form method="post" action="${BASE}/${encodeURIComponent(f.key)}" class="stack">
        <h2 style="margin:0 0 0.5rem">${escapeHtml(f.label)}</h2>
        ${saved === f.key ? `<div class="alert alert--ok">Guardado.</div>` : ""}
        ${textareaField({ name: "value", label: "Texto", value })}
        ${submitButton("Guardar")}
      </form>
    </div>`;
  }).join("");
  return adminShell({ user, active: CONTENT_KEY, title: "Contenido", body: `<h1>Contenido</h1>${forms}` });
}

export function registerContentRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, CONTENT_KEY, "view");
    if (user instanceof Response) return user;
    return html(contentPage(user, ctx.query.get("saved") ?? undefined));
  });

  router.post(`${BASE}/:key`, async (ctx) => {
    const user = requirePermission(ctx, CONTENT_KEY, "edit");
    if (user instanceof Response) return user;
    const key = ctx.params.key!;
    if (!CONTENT_FIELDS.some((f) => f.key === key)) return notFound("Clave de contenido no válida.");
    const form = await ctx.req.formData();
    contentRepo.set(key, String(form.get("value") ?? "").trim());
    return redirect(`${BASE}?saved=${encodeURIComponent(key)}`);
  });
}
