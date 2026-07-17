/** Shipping module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./shipping.db.ts";
import { SHIPPING_KEY } from "./shipping.rules.ts";
import { registerShippingRoutes } from "./shipping.views.ts";

class ShippingModule extends AppModule {
  readonly key = SHIPPING_KEY;
  readonly title = "Envíos";

  registerRoutes(router: Router): void {
    registerShippingRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Envíos",
      description: "Tarifas por ciudad y umbral de envío gratis.",
      href: "/admin/envios",
      moduleKey: SHIPPING_KEY,
      action: "view",
    };
  }
}

registerModule(new ShippingModule());
