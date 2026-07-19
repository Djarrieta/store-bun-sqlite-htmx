/**
 * Top navigation with brand logo, primary links, cart, and account.
 * Each component owns its CSS; `layout.ts` aggregates it globally.
 */
import { escapeHtml } from "../core/http.ts";
import { isStaff } from "../core/permissions.ts";
import type { User } from "../auth/auth.db.ts";
import { registerCss } from "./registry.ts";

export interface NavOptions {
  user: User | null;
  active?: string;
  cartCount?: number;
}

const userIcon = /* svg */ `<svg class="nav__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
  <circle cx="12" cy="7" r="4"/>
</svg>`;

const cartIcon = /* svg */ `<svg class="nav__cart-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="8" cy="21" r="1"/>
  <circle cx="19" cy="21" r="1"/>
  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
</svg>`;

/** The cart link + count badge. Also returned standalone by HTMX cart updates. */
export function cartLink(cartCount = 0): string {
  return `<a id="cart-badge" class="nav__icon-btn nav__cart" href="/carrito" aria-label="Carrito">
      ${cartIcon}
      ${cartCount > 0 ? `<span class="nav__cart-badge">${cartCount}</span>` : ""}
    </a>`;
}

export function renderNav(opts: NavOptions): string {
  const { user, active, cartCount = 0 } = opts;
  const link = (href: string, label: string, key: string) =>
    `<a class="nav__link${active === key ? " is-active" : ""}" href="${href}">${label}</a>`;

  const accountControl = user
    ? `<a class="nav__avatar" href="/account" title="${escapeHtml(user.display_name || user.email)}">
         ${
           user.avatar_url
             ? `<img src="${escapeHtml(user.avatar_url)}" alt="" width="36" height="36">`
             : `<span>${escapeHtml((user.display_name || user.email).charAt(0).toUpperCase())}</span>`
         }
       </a>`
    : `<a class="nav__icon-btn nav__login" href="/login" aria-label="Entrar" title="Entrar">
         ${userIcon}
       </a>`;

  return `
  <header class="nav">
    <div class="container nav__inner">
      <a class="nav__brand" href="/" aria-label="Inicio">
        <img src="/brand/logo-htal.png" alt="CRISTA" width="132" height="40" class="nav__logo">
      </a>
      <nav class="nav__links">
        ${link("/", "Inicio", "home")}
        ${link("/productos", "Productos", "catalog")}
        ${link("/nosotros", "Nosotros", "about")}
        ${link("/chat", "Asistente", "chat")}
        ${user && isStaff(user) ? link("/admin", "Admin", "admin") : ""}
        ${cartLink(cartCount)}
        ${accountControl}
      </nav>
    </div>
  </header>`;
}

export const navCss = /* css */ `
.nav {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-soft-sm);
  margin: 1rem auto;
  max-width: var(--container);
}
.nav__inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-block: 0.75rem; }
.nav__brand { display: inline-flex; align-items: center; }
.nav__logo { object-fit: contain; height: 40px; width: auto; }
.nav__links { display: flex; align-items: center; gap: 1.5rem; }
.nav__link {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  font-weight: 600;
}
.nav__link:hover, .nav__link.is-active { color: var(--accent); }
.nav__icon-btn {
  display: inline-flex;
  color: var(--fg);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-btn-icon);
  padding: 0.4rem 0.55rem;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.nav__icon-btn:hover { color: var(--accent); border-color: var(--accent); }
.nav__icon-btn svg, .nav__cart-icon { display: block; }
.nav__cart { position: relative; }
.nav__cart-badge {
  position: absolute; top: -8px; right: -8px;
  background: var(--accent); color: var(--accent-foreground);
  border-radius: 999px; font-size: 0.68rem; font-weight: 700;
  min-width: 18px; height: 18px; display: grid; place-items: center; padding: 0 5px;
}
.nav__avatar {
  width: 36px; height: 36px; border-radius: 999px; overflow: hidden;
  display: grid; place-items: center; background: var(--accent); color: var(--accent-foreground);
  font-weight: 700; font-size: 0.9rem;
}
.nav__avatar img { width: 36px; height: 36px; object-fit: cover; }
@media (max-width: 640px) {
  .nav__inner { flex-wrap: wrap; row-gap: 0.5rem; }
  .nav__links { gap: 0.6rem 0.85rem; flex-wrap: wrap; width: 100%; justify-content: flex-start; }
  .nav__link { font-size: 0.68rem; letter-spacing: 0.06em; }
}
`;

registerCss(navCss);
