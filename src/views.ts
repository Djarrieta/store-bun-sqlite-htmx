/**
 * Admin shell (module tab bar) + dashboard (permission-gated module cards).
 */
import { page } from "./components/layout.ts";
import { escapeHtml } from "./core/http.ts";
import { can } from "./core/permissions.ts";
import { getModules } from "./core/modules.ts";
import type { User } from "./auth/auth.db.ts";
import { registerCss } from "./components/registry.ts";

registerCss(/* css */ `
.admin-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 1.5rem; }
.admin-tab {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-btn-icon);
  padding: 0.5rem 1rem;
  font-size: 0.85rem; font-weight: 600;
  color: var(--fg); background: var(--surface);
}
.admin-tab:hover { background: var(--card); color: var(--fg); }
.admin-tab.is-active { background: var(--accent); color: var(--accent-foreground); border-color: var(--accent); }
.dash-card { display: block; }
.dash-card h3 { margin: 0 0 0.35rem; }
`);

/** Tabs for the admin modules the user can see. */
export function adminTabs(user: User, active?: string): string {
  const tabs = getModules()
    .map((m) => m.dashboardCard())
    .filter((c): c is NonNullable<typeof c> => Boolean(c) && can(user, c!.moduleKey, c!.action))
    .map(
      (c) =>
        `<a class="admin-tab${active === c.moduleKey ? " is-active" : ""}" href="${c.href}">${escapeHtml(c.title)}</a>`,
    )
    .join("");
  return `<a class="admin-tab${!active ? " is-active" : ""}" href="/admin">Inicio</a>${tabs}`;
}

export function adminShell(opts: { user: User; active?: string; title: string; body: string }): string {
  const body = `
    <nav class="admin-tabs">${adminTabs(opts.user, opts.active)}</nav>
    ${opts.body}`;
  return page({ title: opts.title, user: opts.user, active: "admin", body });
}

export function adminDashboard(user: User): string {
  const cards = getModules()
    .map((m) => m.dashboardCard())
    .filter((c): c is NonNullable<typeof c> => Boolean(c) && can(user, c!.moduleKey, c!.action));

  const body = cards.length
    ? `<div class="grid grid--cards">${cards
        .map(
          (c) => `<a class="panel dash-card" href="${c.href}">
            <h3>${escapeHtml(c.title)}</h3>
            <p class="muted" style="margin:0">${escapeHtml(c.description)}</p>
          </a>`,
        )
        .join("")}</div>`
    : `<div class="panel"><p class="muted" style="margin:0">Aún no hay módulos disponibles para tu rol.</p></div>`;

  return adminShell({
    user,
    title: "Panel de administración",
    body: `<div class="row-between" style="margin-bottom:1.5rem"><h1 style="margin:0">Administración</h1></div>${body}`,
  });
}
