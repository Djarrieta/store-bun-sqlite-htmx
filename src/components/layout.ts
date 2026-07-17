/**
 * HTML shell: `<head>` (theme + collected component CSS + HTMX), nav, main, footer.
 * `page()` returns a full document; use `renderNav` results inside.
 */
import { themeCss } from "../theme.ts";
import { escapeHtml } from "../core/http.ts";
import type { User } from "../auth/auth.db.ts";
import { renderNav } from "./nav.ts";
import { collectedCss } from "./registry.ts";

export interface PageOptions {
  title: string;
  user: User | null;
  body: string;
  /** Active nav key (home, catalog, about, chat, admin). */
  active?: string;
  cartCount?: number;
  /** Extra markup appended to <head>. */
  head?: string;
}

export function page(opts: PageOptions): string {
  const title = escapeHtml(opts.title);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · CRISTA</title>
  <link rel="icon" href="/brand/logo-htal.png">
  <style>${themeCss}${collectedCss()}
    .site-main { min-height: 60vh; padding-bottom: 4rem; }
    .site-footer { border-top: 1px solid var(--border); margin-top: 3rem; padding: 2rem 0; color: var(--muted); font-size: 0.85rem; }
    .site-footer .container { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  </style>
  ${opts.head ?? ""}
  <script src="/vendor/htmx.min.js" defer></script>
</head>
<body>
  ${renderNav({ user: opts.user, active: opts.active, cartCount: opts.cartCount })}
  <main class="site-main">
    <div class="container">
      ${opts.body}
    </div>
  </main>
  <footer class="site-footer">
    <div class="container">
      <span>© ${new Date().getFullYear()} CRISTA · Prendas de origen natural</span>
      <span><a href="/pagos-envios">Pagos y envíos</a> · <a href="/nosotros">Nosotros</a></span>
    </div>
  </footer>
</body>
</html>`;
}
