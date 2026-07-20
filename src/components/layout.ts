/**
 * HTML shell: `<head>` (theme + collected component CSS + HTMX), nav, main, footer.
 * `page()` returns a full document; use `renderNav` results inside.
 */
import { themeCss } from "../theme.ts";
import { escapeHtml } from "../core/http.ts";
import { flagEnabled } from "../modules/feature-flags/feature-flags.rules.ts";
import type { User } from "../auth/auth.db.ts";
import { renderNav } from "./nav.ts";
import { leafDivider } from "./ornament.ts";
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
    .site-footer { border-top: 1px solid var(--border); margin-top: 4rem; padding: 3.25rem 0 2.5rem; background: var(--card); color: var(--muted); }
    .site-footer__inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.55rem; }
    .site-footer__brand { font-family: var(--font-serif); font-size: 1.85rem; font-weight: 600; letter-spacing: 0.34em; text-indent: 0.34em; color: var(--accent); line-height: 1; }
    .site-footer__tag { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.3em; color: var(--muted); }
    .site-footer__links { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.4rem; margin-top: 0.5rem; }
    .site-footer__links a { color: var(--fg); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem; font-weight: 500; }
    .site-footer__links a:hover { color: var(--accent); }
    .site-footer__legal { font-size: 0.76rem; margin: 0.6rem 0 0; }
    .site-footer .ornament { margin: 0.35rem 0; }
  </style>
  ${opts.head ?? ""}
  <script src="/vendor/htmx.min.js" defer></script>
  <script src="/vendor/filters.js" defer></script>
</head>
<body>
  ${renderNav({ user: opts.user, active: opts.active, cartCount: opts.cartCount })}
  <main class="site-main">
    <div class="container">
      ${opts.body}
    </div>
  </main>
  <footer class="site-footer">
    <div class="container site-footer__inner">
      <div class="site-footer__brand">CRISTA</div>
      <div class="site-footer__tag">Naturalmente tú</div>
      ${leafDivider({ className: "ornament--muted" })}
      <nav class="site-footer__links">
        <a href="/productos">Productos</a>
        <a href="/nosotros">Nosotros</a>
        <a href="/pagos-envios">Pagos y envíos</a>
        ${flagEnabled("chat_web") ? `<a href="/chat">Asistente</a>` : ""}
      </nav>
      <p class="site-footer__legal">© ${new Date().getFullYear()} CRISTA · Prendas de origen natural</p>
    </div>
  </footer>
</body>
</html>`;
}
