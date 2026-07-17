/** Cart page + fragments (tech-spec §10). */
import { page } from "../components/layout.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { formatCop } from "../core/format.ts";
import { registerCss } from "../components/registry.ts";
import type { User } from "../auth/auth.db.ts";
import type { CartSummary } from "./cart.service.ts";

registerCss(/* css */ `
.cart-line { display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border); }
.cart-line__qty { width: 76px; }
.cart-summary { display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 700; margin: 1rem 0; }
@media (max-width: 560px) { .cart-line { grid-template-columns: 1fr; } }
`);

/** Out-of-band cart badge so the nav updates alongside cart mutations. */
export function cartBadgeOob(count: number): string {
  return `<a id="cart-badge" class="nav__cart" href="/carrito" aria-label="Carrito" hx-swap-oob="true">
      <span class="nav__cart-icon">&#128722;</span>
      ${count > 0 ? `<span class="nav__cart-badge">${count}</span>` : ""}
    </a>`;
}

export function cartBody(summary: CartSummary): string {
  if (summary.lines.length === 0) {
    return `<div class="panel"><p class="muted" style="margin:0">Tu carrito está vacío. <a href="/productos">Explorar productos →</a></p></div>`;
  }
  const lines = summary.lines
    .map(
      (l) => `<div class="cart-line">
        <div>
          <div class="data-row__title">${escapeHtml(l.product_title)}</div>
          <div class="data-row__meta">${escapeHtml(l.variant_name)}${l.sku ? ` · <code>${escapeHtml(l.sku)}</code>` : ""} · ${escapeHtml(formatCop(l.unit_price_cents))} c/u</div>
        </div>
        <form hx-post="/carrito/actualizar" hx-target="#cart-body" hx-swap="innerHTML">
          <input type="hidden" name="variant_id" value="${escapeAttr(l.variant_id)}">
          <input class="input cart-line__qty" type="number" name="qty" value="${l.qty}" min="0" max="${l.stock}"
            hx-post="/carrito/actualizar" hx-target="#cart-body" hx-swap="innerHTML" hx-trigger="change">
        </form>
        <div style="text-align:right;min-width:120px">
          <div style="font-weight:700">${escapeHtml(formatCop(l.line_total_cents))}</div>
          <button class="btn btn--danger btn--sm" hx-post="/carrito/eliminar" hx-vals='${escapeAttr(JSON.stringify({ variant_id: l.variant_id }))}' hx-target="#cart-body" hx-swap="innerHTML">Quitar</button>
        </div>
      </div>`,
    )
    .join("");

  return `<div class="panel">
    ${lines}
    <div class="cart-summary"><span>Subtotal</span><span>${escapeHtml(formatCop(summary.subtotalCents))}</span></div>
    <p class="muted" style="margin:0 0 1rem">El envío se calcula en el siguiente paso.</p>
    <a class="btn btn--block" href="/checkout">Ir a pagar</a>
  </div>`;
}

export function cartPage(user: User | null, summary: CartSummary): string {
  const body = `
    <h1>Tu carrito</h1>
    <div id="cart-body">${cartBody(summary)}</div>`;
  return page({ title: "Carrito", user, active: "catalog", cartCount: summary.count, body });
}
