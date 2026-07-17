/** Shipping admin views + routes: free-shipping threshold + city rates. */
import type { Router } from "../../core/router.ts";
import { html, redirect, fragment, notFound } from "../../core/http.ts";
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { formatCop } from "../../core/format.ts";
import { requirePermission } from "../../auth/index.ts";
import { textField, submitButton } from "../../components/forms.ts";
import { dataRow } from "../../components/table.ts";
import { shippingRepo } from "./shipping.db.ts";
import { SHIPPING_KEY, validateRate, pesosToCents } from "./shipping.rules.ts";
import type { User } from "../../auth/auth.db.ts";

const BASE = "/admin/envios";

function ratesList(user: User): string {
  const rates = shippingRepo.listRates();
  if (rates.length === 0) return `<p class="muted">No hay tarifas todavía.</p>`;
  return rates
    .map((r) => {
      const actions = can(user, SHIPPING_KEY, "edit")
        ? `<button class="btn btn--danger btn--sm" hx-post="${BASE}/tarifa/${r.id}/eliminar" hx-confirm="¿Eliminar tarifa?" hx-target="#rates-list" hx-swap="innerHTML">Eliminar</button>`
        : "";
      return dataRow({
        title: `${r.department} — ${r.city}`,
        meta: `${escapeHtml(formatCop(r.price_cents))}${r.estimated_days ? ` · ~${r.estimated_days} días` : ""}`,
        actions,
      });
    })
    .join("");
}

function shippingPage(user: User): string {
  const config = shippingRepo.getConfig();
  const freePesos = config.free_above_cents !== null ? String(config.free_above_cents / 100) : "";
  const body = `
    <h1>Envíos</h1>
    <div class="panel" style="margin-bottom:1.5rem">
      <h2>Envío gratis</h2>
      <form method="post" action="${BASE}/config" class="stack" style="max-width:360px">
        ${textField({ name: "free_above", label: "Envío gratis desde (COP)", value: freePesos, help: "Vacío = sin umbral de envío gratis." })}
        ${submitButton("Guardar")}
      </form>
    </div>
    <div class="panel" style="margin-bottom:1.5rem">
      <h2>Tarifas por ciudad</h2>
      <div id="rates-list" class="data-table">${ratesList(user)}</div>
    </div>
    <div class="panel" style="max-width:560px">
      <h2>Nueva tarifa</h2>
      <form method="post" action="${BASE}/tarifa" class="stack">
        <div class="grid" style="grid-template-columns:1fr 1fr">
          ${textField({ name: "department", label: "Departamento", required: true })}
          ${textField({ name: "city", label: "Ciudad", required: true })}
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr">
          ${textField({ name: "price", label: "Precio (COP)", required: true })}
          ${textField({ name: "estimated_days", label: "Días estimados", type: "number" })}
        </div>
        ${submitButton("Agregar tarifa")}
      </form>
    </div>`;
  return adminShell({ user, active: SHIPPING_KEY, title: "Envíos", body });
}

export function registerShippingRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, SHIPPING_KEY, "view");
    if (user instanceof Response) return user;
    return html(shippingPage(user));
  });

  router.post(`${BASE}/config`, async (ctx) => {
    const user = requirePermission(ctx, SHIPPING_KEY, "edit");
    if (user instanceof Response) return user;
    const form = await ctx.req.formData();
    const raw = String(form.get("free_above") ?? "").trim();
    shippingRepo.setConfig(raw ? pesosToCents(raw) : null);
    return redirect(BASE);
  });

  router.post(`${BASE}/tarifa`, async (ctx) => {
    const user = requirePermission(ctx, SHIPPING_KEY, "edit");
    if (user instanceof Response) return user;
    const form = await ctx.req.formData();
    const { data, errors } = validateRate(form);
    if (errors.department || errors.city || errors.price) return redirect(BASE);
    const existing = shippingRepo.findRate(data.department, data.city);
    if (existing) shippingRepo.updateRate(existing.id, data.priceCents, data.estimatedDays);
    else shippingRepo.insertRate(data.department, data.city, data.priceCents, data.estimatedDays);
    return redirect(BASE);
  });

  router.post(`${BASE}/tarifa/:id/eliminar`, (ctx) => {
    const user = requirePermission(ctx, SHIPPING_KEY, "edit");
    if (user instanceof Response) return user;
    const rate = shippingRepo.findById(ctx.params.id!);
    if (!rate) return notFound("Tarifa no encontrada.");
    shippingRepo.deleteById(rate.id);
    return fragment(ratesList(user));
  });
}
