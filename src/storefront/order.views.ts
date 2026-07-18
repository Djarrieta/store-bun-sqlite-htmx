/** Order status page (storefront). Payment section is injected (F4). */
import { page } from "../components/layout.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { formatCop, formatDateTime } from "../core/format.ts";
import { registerCss } from "../components/registry.ts";
import { config } from "../config.ts";
import { fileField, submitButton } from "../components/forms.ts";
import type { User } from "../auth/auth.db.ts";
import type { Order, OrderItem, OrderStatus } from "../modules/orders/orders.db.ts";

registerCss(/* css */ `
.order-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.order-ref { font-family: var(--font-serif); }
.order-cols { display: grid; grid-template-columns: 1.3fr 1fr; align-items: start; gap: 2rem; margin-top: 1.5rem; }
@media (max-width: 760px) { .order-cols { grid-template-columns: 1fr; } }
`);

const STATUS_LABELS: Record<OrderStatus, { label: string; variant: "default" | "ok" | "warn" | "danger" | "accent" }> = {
  pending: { label: "Pendiente de pago", variant: "warn" },
  payment_review: { label: "Verificando pago", variant: "accent" },
  paid: { label: "Pagado", variant: "ok" },
  preparing: { label: "En preparación", variant: "accent" },
  shipped: { label: "Enviado", variant: "accent" },
  delivered: { label: "Entregado", variant: "ok" },
  cancelled: { label: "Cancelado", variant: "danger" },
  refunded: { label: "Reembolsado", variant: "default" },
};

export function statusBadge(status: OrderStatus): string {
  const s = STATUS_LABELS[status] ?? { label: status, variant: "default" as const };
  return `<span class="badge badge--${s.variant}">${escapeHtml(s.label)}</span>`;
}

/**
 * Nequi manual payment section (tech-spec §11): exact amount + reference +
 * proof upload. Shown while the order awaits/reviews payment.
 */
export function nequiSection(order: Order, opts: { error?: string } = {}): string {
  if (order.status !== "pending" && order.status !== "payment_review") return "";
  const amount = formatCop(order.total_cents);
  const ref = escapeHtml(order.payment_ref ?? "");
  const number = escapeHtml(config.nequi.number || "(configura NEQUI_NUMBER)");
  const qr = config.nequi.qrUrl
    ? `<img src="${escapeAttr(config.nequi.qrUrl)}" alt="QR Nequi" width="180" height="180" style="margin:0.5rem 0">`
    : "";

  const hasProof = Boolean(order.payment_proof_url);
  const bottom = hasProof
    ? `<div class="alert alert--ok">Recibimos tu comprobante. Un asesor validará el pago y actualizará tu pedido.</div>
       <a class="btn btn--outline btn--sm" href="/orden/${escapeAttr(order.id)}/comprobante" target="_blank" rel="noopener">Ver comprobante</a>`
    : `${opts.error ? `<div class="alert alert--error">${escapeHtml(opts.error)}</div>` : ""}
       <form hx-post="/orden/${escapeAttr(order.id)}/comprobante" hx-encoding="multipart/form-data" hx-target="#payment-section" hx-swap="outerHTML" class="stack" style="margin-top:1rem">
         ${fileField({ name: "proof", label: "Comprobante de pago", accept: "image/jpeg,image/png,image/webp", required: true, help: "Captura o foto de la transferencia (JPG, PNG o WEBP)." })}
         ${submitButton("Enviar comprobante")}
       </form>`;

  return `<section id="payment-section" class="panel" style="margin-top:1.5rem">
    <h2>Pago por Nequi</h2>
    <ol style="margin:0 0 1rem;padding-left:1.2rem;line-height:1.9">
      <li>Transfiere <strong>${escapeHtml(amount)}</strong> por Nequi al número <strong>${number}</strong>.</li>
      <li>Usa como referencia/mensaje: <strong>${ref}</strong>.</li>
      <li>Sube el comprobante aquí abajo. Validamos y confirmamos tu pedido.</li>
    </ol>
    ${qr}
    ${bottom}
  </section>`;
}

export function orderPage(opts: {
  user: User | null;
  order: Order;
  items: OrderItem[];
  cartCount: number;
  paymentSection?: string;
}): string {
  const { order, items } = opts;
  const itemRows = items
    .map(
      (it) => `<div class="row-between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
        <span>${escapeHtml(it.product_title)} — ${escapeHtml(it.variant_name)} <span class="muted">×${it.qty}</span></span>
        <span>${escapeHtml(formatCop(it.unit_price_cents * it.qty))}</span>
      </div>`,
    )
    .join("");

  const body = `
    <p class="muted"><a href="/productos">← Seguir comprando</a></p>
    <div class="order-head">
      <h1 class="order-ref" style="margin:0">Pedido ${escapeHtml(order.payment_ref ?? order.id.slice(0, 8))}</h1>
      ${statusBadge(order.status)}
    </div>
    <p class="muted">Creado el ${escapeHtml(formatDateTime(order.created_at))}</p>

    ${opts.paymentSection ?? ""}

    <div class="order-cols">
      <div class="panel">
        <h2>Artículos</h2>
        ${itemRows}
        <div class="row-between" style="padding-top:0.6rem"><span class="muted">Subtotal</span><span>${escapeHtml(formatCop(order.subtotal_cents))}</span></div>
        <div class="row-between"><span class="muted">Envío</span><span>${order.shipping_cents === 0 ? "Gratis" : escapeHtml(formatCop(order.shipping_cents))}</span></div>
        <div class="cart-summary"><span>Total</span><span>${escapeHtml(formatCop(order.total_cents))}</span></div>
      </div>
      <div class="panel">
        <h2>Envío</h2>
        <p style="margin:0">${escapeHtml(order.customer_name)}</p>
        ${order.customer_phone ? `<p class="muted" style="margin:0.25rem 0 0">${escapeHtml(order.customer_phone)}</p>` : ""}
        <p style="margin:0.5rem 0 0">${escapeHtml(order.shipping_addr ?? "")}</p>
        <p class="muted" style="margin:0.25rem 0 0">${escapeHtml([order.shipping_city, order.shipping_dept].filter(Boolean).join(", "))}</p>
        ${order.notes ? `<p class="muted" style="margin:0.75rem 0 0"><em>${escapeHtml(order.notes)}</em></p>` : ""}
      </div>
    </div>`;
  return page({ title: `Pedido ${order.payment_ref ?? ""}`, user: opts.user, active: "catalog", cartCount: opts.cartCount, body });
}
