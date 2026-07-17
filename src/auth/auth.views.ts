/** Login + account views. */
import { page } from "../components/layout.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { textField, submitButton } from "../components/forms.ts";
import { googleOAuthEnabled, config } from "../config.ts";
import type { User } from "./auth.db.ts";

export function loginPage(opts: { user: User | null; next: string; error?: string }): string {
  const next = opts.next || "/";
  const google = googleOAuthEnabled()
    ? `<a class="btn btn--block" href="/auth/google?next=${encodeURIComponent(next)}">Entrar con Google</a>`
    : `<p class="muted">Google OAuth no está configurado.</p>`;

  const dev = config.devLogin
    ? `<div style="margin-top:1.5rem;border-top:1px solid var(--border);padding-top:1.5rem">
        <p class="eyebrow">Solo desarrollo</p>
        <form method="post" action="/dev-login" class="stack">
          <input type="hidden" name="next" value="${escapeAttr(next)}">
          ${textField({ name: "email", label: "Correo", type: "email", required: true, placeholder: "tu@correo.com", help: "Si está en ADMIN_ALLOWLIST entrarás como admin." })}
          ${submitButton("Entrar (dev)", true)}
        </form>
      </div>`
    : "";

  const body = `
    <div style="max-width:420px;margin:2rem auto">
      <div class="panel">
        <h1 style="text-align:center">Entrar</h1>
        ${opts.error ? `<div class="alert alert--error">${escapeHtml(opts.error)}</div>` : ""}
        ${google}
        ${dev}
      </div>
      <p class="muted" style="text-align:center;margin-top:1rem"><a href="/">← Volver a la tienda</a></p>
    </div>`;

  return page({ title: "Entrar", user: opts.user, body });
}

export function accountPage(user: User): string {
  const body = `
    <div style="max-width:560px;margin:1rem auto">
      <div class="row-between"><h1 style="margin:0">Mi cuenta</h1>
        <form method="post" action="/logout"><button class="btn btn--outline btn--sm" type="submit">Cerrar sesión</button></form>
      </div>
      <div class="panel" style="margin-top:1rem">
        <p><strong>Nombre:</strong> ${escapeHtml(user.display_name || "—")}</p>
        <p><strong>Correo:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Rol:</strong> ${escapeHtml(user.role)}</p>
        <p style="margin:0"><strong>Teléfono:</strong> ${escapeHtml(user.phone || "No verificado")}</p>
      </div>
    </div>`;
  return page({ title: "Mi cuenta", user, body });
}
