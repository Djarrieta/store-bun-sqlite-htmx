/** Checkout routes: form, dynamic city/quote fragments, order creation (§10, §11). */
import type { Router } from "../core/router.ts";
import { html, fragment, redirect } from "../core/http.ts";
import { getCart } from "./cart.service.ts";
import { createOrderFromCart } from "./checkout.service.ts";
import { checkoutPage, cityField, quoteBlock, type CheckoutValues } from "./checkout.views.ts";
import { shippingRepo } from "../modules/shipping/shipping.db.ts";
import { quoteShipping } from "../modules/shipping/shipping.service.ts";

function formValues(form: FormData): CheckoutValues {
  return {
    customer_name: String(form.get("customer_name") ?? "").trim(),
    customer_phone: String(form.get("customer_phone") ?? "").trim(),
    customer_email: String(form.get("customer_email") ?? "").trim(),
    department: String(form.get("department") ?? "").trim(),
    city: String(form.get("city") ?? "").trim(),
    address: String(form.get("address") ?? "").trim(),
    notes: String(form.get("notes") ?? "").trim(),
  };
}

export function registerCheckoutRoutes(router: Router): void {
  router.get("/checkout", (ctx) => {
    const summary = getCart(ctx.guestRef);
    if (summary.lines.length === 0) return redirect("/carrito");
    return html(checkoutPage({ user: ctx.user, summary, departments: shippingRepo.departments() }));
  });

  // Dependent city select for a chosen department.
  router.get("/checkout/ciudades", (ctx) => {
    const dept = ctx.query.get("department") ?? "";
    return fragment(cityField(dept ? shippingRepo.citiesIn(dept) : []));
  });

  // Live shipping quote for department + city.
  router.get("/checkout/cotizar", (ctx) => {
    const dept = ctx.query.get("department") ?? "";
    const city = ctx.query.get("city") ?? "";
    const summary = getCart(ctx.guestRef);
    const quote = dept && city ? quoteShipping(dept, city, summary.subtotalCents) : null;
    return fragment(quoteBlock(summary.subtotalCents, quote));
  });

  router.post("/checkout", async (ctx) => {
    const summary = getCart(ctx.guestRef);
    if (summary.lines.length === 0) return redirect("/carrito");
    const form = await ctx.req.formData();
    const v = formValues(form);
    const departments = shippingRepo.departments();

    const missing = !v.customer_name || !v.department || !v.city || !v.address;
    if (missing) {
      return html(
        checkoutPage({ user: ctx.user, summary, departments, values: v, error: "Completa nombre, departamento, ciudad y dirección." }),
        { status: 400 },
      );
    }

    const result = createOrderFromCart({
      guestRef: ctx.guestRef,
      userId: ctx.user?.id ?? null,
      customerName: v.customer_name!,
      customerPhone: v.customer_phone || null,
      customerEmail: v.customer_email || null,
      department: v.department!,
      city: v.city!,
      address: v.address!,
      notes: v.notes || null,
    });

    if (!result.ok) {
      return html(checkoutPage({ user: ctx.user, summary, departments, values: v, error: result.error }), { status: 400 });
    }
    return redirect(`/orden/${result.order.id}`);
  });
}
