/** Orders admin views: list (status filter + search), detail (verify/status). */
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { formatCop, formatDateTime } from "../../core/format.ts";
import { dataTableList, dataRow } from "../../components/table.ts";
import { selectField, textField, submitButton } from "../../components/forms.ts";
import { statusBadge } from "../../storefront/order.views.ts";
import type { User } from "../../auth/auth.db.ts";
import type { Order, OrderItem } from "./orders.db.ts";
import { ORDERS_KEY, STATUS_FILTERS, MANUAL_STATUSES } from "./orders.rules.ts";

const BASE = "/admin/ordenes";

interface OrderList {
  items: Order[];
  page: number;
  totalPages: number;
  total: number;
}

function renderRow(order: Order): string {
  const meta = `${escapeHtml(order.customer_name)} · ${escapeHtml(formatCop(order.total_cents))} · ${escapeHtml(formatDateTime(order.created_at))} · ${statusBadge(order.status)}`;
  return dataRow({
    title: order.payment_ref ?? order.id.slice(0, 8),
    meta,
    actions: `<a class="btn btn--outline btn--sm" href="${BASE}/${order.id}">Ver</a>`,
  });
}

export function ordersListFragment(data: OrderList, q: string, status: string): string {
  return dataTableList({
    items: data.items,
    page: data.page,
    totalPages: data.totalPages,
    baseUrl: BASE,
    searchQuery: q,
    extraParams: { status },
    renderRow,
    emptyText: "No hay pedidos.",
  });
}

export function ordersListPage(user: User, data: OrderList, q: string, status: string): string {
  const statusOptions = STATUS_FILTERS.map(
    (f) => `<option value="${escapeAttr(f.value)}"${f.value === status ? " selected" : ""}>${escapeHtml(f.label)}</option>`,
  ).join("");
  const body = `
    <div class="panel">
      <h1>Pedidos</h1>
      <div class="data-toolbar">
        <input class="input" type="search" name="q" value="${escapeAttr(q)}" placeholder="Buscar por referencia, cliente o teléfono…"
          hx-get="${BASE}" hx-target="#data-list" hx-swap="innerHTML" hx-trigger="keyup changed delay:300ms, search"
          hx-include="[name='status']" hx-push-url="true">
        <select class="select" name="status" style="max-width:220px"
          hx-get="${BASE}" hx-target="#data-list" hx-swap="innerHTML" hx-include="[name='q']" hx-push-url="true">${statusOptions}</select>
      </div>
      <div id="data-list" class="data-table">${ordersListFragment(data, q, status)}</div>
    </div>`;
  return adminShell({ user, active: ORDERS_KEY, title: "Pedidos", body });
}

export function orderDetailPage(opts: {
  user: User;
  order: Order;
  items: OrderItem[];
  verifiedBy: User | null;
  error?: string;
}): string {
  const { user, order, items } = opts;
  const itemRows = items
    .map(
      (it) => `<div class="row-between" style="padding:0.4rem 0;border-bottom:1px solid var(--border)">
        <span>${escapeHtml(it.product_title)} — ${escapeHtml(it.variant_name)} <span class="muted">×${it.qty}</span>${it.sku ? ` · <code>${escapeHtml(it.sku)}</code>` : ""}</span>
        <span>${escapeHtml(formatCop(it.unit_price_cents * it.qty))}</span>
      </div>`,
    )
    .join("");

  const canVerify = can(user, ORDERS_KEY, "verify_payment");
  const canUpdate = can(user, ORDERS_KEY, "update_status");

  let paymentPanel = "";
  if (order.status === "payment_review") {
    paymentPanel = `<div class="panel" style="margin-bottom:1.5rem">
      <h2>Verificación de pago</h2>
      ${order.payment_proof_url ? `<p><a class="btn btn--outline btn--sm" href="/orden/${escapeAttr(order.id)}/comprobante" target="_blank" rel="noopener">Ver comprobante</a></p>` : `<p class="muted">Sin comprobante adjunto.</p>`}
      ${
        canVerify
          ? `<div class="row-between" style="margin-top:1rem">
              <form method="post" action="${BASE}/${order.id}/aprobar"><button class="btn" type="submit">Aprobar pago</button></form>
              <form method="post" action="${BASE}/${order.id}/rechazar"><button class="btn btn--danger" type="submit">Rechazar</button></form>
            </div>
            <p class="muted" style="font-size:0.82rem;margin-top:0.75rem">Aprobar descuenta el stock de forma idempotente y marca la orden como pagada.</p>`
          : `<p class="muted">No tienes permiso para verificar pagos.</p>`
      }
    </div>`;
  } else if (order.status === "pending") {
    paymentPanel = `<div class="alert alert--warn">El cliente aún no ha enviado el comprobante de pago.</div>`;
  } else {
    paymentPanel = `<div class="panel" style="margin-bottom:1.5rem"><h2>Pago</h2>
      <p style="margin:0">${order.paid_at ? `Pagado el ${escapeHtml(formatDateTime(order.paid_at))}` : "—"}${opts.verifiedBy ? ` · verificado por ${escapeHtml(opts.verifiedBy.display_name || opts.verifiedBy.email)}` : ""}</p>
      ${order.payment_proof_url ? `<p style="margin:0.5rem 0 0"><a href="/orden/${escapeAttr(order.id)}/comprobante" target="_blank" rel="noopener">Ver comprobante</a></p>` : ""}
    </div>`;
  }

  const statusForm = canUpdate
    ? `<div class="panel">
        <h2>Estado y envío</h2>
        <form method="post" action="${BASE}/${order.id}/estado" class="stack">
          ${selectField({ name: "status", label: "Estado", value: order.status, options: MANUAL_STATUSES.map((s) => ({ value: s, label: s })) })}
          ${textField({ name: "tracking_code", label: "Código de seguimiento", value: order.tracking_code ?? "" })}
          ${submitButton("Actualizar")}
        </form>
      </div>`
    : "";

  const body = `
    <p class="muted"><a href="${BASE}">← Volver a pedidos</a></p>
    <div class="row-between"><h1 style="margin:0">Pedido ${escapeHtml(order.payment_ref ?? order.id.slice(0, 8))}</h1>${statusBadge(order.status)}</div>
    <p class="muted">${escapeHtml(formatDateTime(order.created_at))}</p>
    ${opts.error ? `<div class="alert alert--error">${escapeHtml(opts.error)}</div>` : ""}
    ${paymentPanel}
    <div class="grid" style="grid-template-columns:1.3fr 1fr;align-items:start;gap:2rem">
      <div class="panel">
        <h2>Artículos</h2>
        ${itemRows}
        <div class="row-between" style="padding-top:0.6rem"><span class="muted">Subtotal</span><span>${escapeHtml(formatCop(order.subtotal_cents))}</span></div>
        <div class="row-between"><span class="muted">Envío</span><span>${order.shipping_cents === 0 ? "Gratis" : escapeHtml(formatCop(order.shipping_cents))}</span></div>
        <div class="cart-summary"><span>Total</span><span>${escapeHtml(formatCop(order.total_cents))}</span></div>
      </div>
      <div>
        <div class="panel" style="margin-bottom:1.5rem">
          <h2>Cliente</h2>
          <p style="margin:0">${escapeHtml(order.customer_name)}</p>
          ${order.customer_phone ? `<p class="muted" style="margin:0.25rem 0 0">${escapeHtml(order.customer_phone)}</p>` : ""}
          ${order.customer_email ? `<p class="muted" style="margin:0.25rem 0 0">${escapeHtml(order.customer_email)}</p>` : ""}
          <p style="margin:0.5rem 0 0">${escapeHtml(order.shipping_addr ?? "")}</p>
          <p class="muted" style="margin:0.25rem 0 0">${escapeHtml([order.shipping_city, order.shipping_dept].filter(Boolean).join(", "))}</p>
          ${order.notes ? `<p class="muted" style="margin:0.75rem 0 0"><em>${escapeHtml(order.notes)}</em></p>` : ""}
        </div>
        ${statusForm}
      </div>
    </div>`;
  return adminShell({ user, active: ORDERS_KEY, title: `Pedido ${order.payment_ref ?? ""}`, body });
}
