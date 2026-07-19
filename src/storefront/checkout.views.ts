/** Checkout form + shipping quote fragments (tech-spec §10). */
import { page } from "../components/layout.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { formatCop } from "../core/format.ts";
import { textField, textareaField, submitButton } from "../components/forms.ts";
import type { User } from "../auth/auth.db.ts";
import type { CartSummary } from "./cart.service.ts";
import type { ShippingQuote } from "../modules/shipping/shipping.service.ts";
import type { ShippingRate } from "../modules/shipping/shipping.db.ts";

export interface CheckoutValues {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  department?: string;
  city?: string;
  address?: string;
  notes?: string;
}

/** City <select> for a department; changing it re-quotes shipping. */
export function cityField(cities: ShippingRate[], selected?: string): string {
  const options = [
    `<option value="">— Selecciona ciudad —</option>`,
    ...cities.map(
      (c) => `<option value="${escapeAttr(c.city)}"${c.city === selected ? " selected" : ""}>${escapeHtml(c.city)}</option>`,
    ),
  ].join("");
  return `<select class="select" id="city-select" name="city" required
    hx-get="/checkout/cotizar" hx-target="#quote" hx-swap="innerHTML"
    hx-include="[name='department']" hx-trigger="change">${options}</select>`;
}

export function quoteBlock(subtotalCents: number, quote: ShippingQuote | null): string {
  let shippingLine = `<div class="row-between"><span class="muted">Envío</span><span class="muted">Selecciona ciudad</span></div>`;
  let total = subtotalCents;
  if (quote) {
    if (!quote.covered) {
      shippingLine = `<div class="row-between"><span class="muted">Envío</span><span class="badge badge--warn">Ciudad no cubierta</span></div>`;
    } else {
      const label = quote.free ? "Gratis" : formatCop(quote.cents);
      const days = quote.estimatedDays ? ` <span class="muted">(~${quote.estimatedDays} días)</span>` : "";
      shippingLine = `<div class="row-between"><span class="muted">Envío</span><span>${label}${days}</span></div>`;
      total = subtotalCents + quote.cents;
    }
  }
  return `${shippingLine}
    <div class="cart-summary" style="font-size:1.15rem"><span>Total</span><span>${escapeHtml(formatCop(total))}</span></div>`;
}

export function checkoutPage(opts: {
  user: User | null;
  summary: CartSummary;
  departments: string[];
  values?: CheckoutValues;
  error?: string;
}): string {
  const v = opts.values ?? {};
  const deptOptions = [
    `<option value="">— Selecciona —</option>`,
    ...opts.departments.map(
      (d) => `<option value="${escapeAttr(d)}"${d === v.department ? " selected" : ""}>${escapeHtml(d)}</option>`,
    ),
  ].join("");

  const summaryLines = opts.summary.lines
    .map(
      (l) => `<div class="row-between" style="padding:0.35rem 0"><span>${escapeHtml(l.product_title)} <span class="muted">×${l.qty}</span></span><span>${escapeHtml(formatCop(l.line_total_cents))}</span></div>`,
    )
    .join("");

  const body = `
    <p class="muted"><a href="/carrito">← Volver al carrito</a></p>
    <h1>Finalizar compra</h1>
    ${opts.error ? `<div class="alert alert--error">${escapeHtml(opts.error)}</div>` : ""}
    <form method="post" action="/checkout">
      <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));align-items:start;gap:2rem">
        <div class="panel">
          <h2>Datos de envío</h2>
          ${textField({ name: "customer_name", label: "Nombre completo", value: v.customer_name ?? "", required: true })}
          <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(200px, 1fr))">
            ${textField({ name: "customer_phone", label: "Teléfono (WhatsApp)", value: v.customer_phone ?? "", type: "tel" })}
            ${textField({ name: "customer_email", label: "Correo", value: v.customer_email ?? "", type: "email" })}
          </div>
          <div class="field">
            <label for="department">Departamento *</label>
            <select class="select" id="department" name="department" required
              hx-get="/checkout/ciudades" hx-target="#city-slot" hx-swap="innerHTML" hx-trigger="change">${deptOptions}</select>
          </div>
          <div class="field">
            <label for="city-select">Ciudad *</label>
            <div id="city-slot">${cityField([], v.city)}</div>
          </div>
          ${textField({ name: "address", label: "Dirección", value: v.address ?? "", required: true, placeholder: "Calle 00 # 00-00, barrio" })}
          ${textareaField({ name: "notes", label: "Notas (opcional)", value: v.notes ?? "" })}
        </div>
        <div class="panel">
          <h2>Resumen</h2>
          ${summaryLines}
          <div class="row-between" style="border-top:1px solid var(--border);padding-top:0.5rem;margin-top:0.5rem"><span class="muted">Subtotal</span><span>${escapeHtml(formatCop(opts.summary.subtotalCents))}</span></div>
          <div id="quote">${quoteBlock(opts.summary.subtotalCents, null)}</div>
          ${submitButton("Crear pedido", true)}
          <p class="muted" style="font-size:0.82rem;margin-top:0.75rem">Pago manual por Nequi. Al crear el pedido verás las instrucciones y podrás enviar tu comprobante.</p>
        </div>
      </div>
    </form>`;
  return page({ title: "Checkout", user: opts.user, active: "catalog", cartCount: opts.summary.count, body });
}
