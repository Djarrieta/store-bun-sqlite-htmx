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

/** The cart link + count badge. Also returned standalone by HTMX cart updates. */
export function cartLink(cartCount = 0): string {
  return `<a id="cart-badge" class="nav__cart" href="/carrito" aria-label="Carrito">
      <span class="nav__cart-icon">&#128722;</span>
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
    : `<a class="nav__link" href="/login">Entrar</a>`;

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
.nav__cart { position: relative; display: inline-flex; border: 1px solid var(--border-strong); border-radius: var(--radius-btn-icon); padding: 0.4rem 0.6rem; }
.nav__cart-icon { font-size: 1.1rem; filter: grayscale(1); }
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
  .nav__links { gap: 0.85rem; }
  .nav__link { font-size: 0.68rem; letter-spacing: 0.06em; }
}
`;

registerCss(navCss);
