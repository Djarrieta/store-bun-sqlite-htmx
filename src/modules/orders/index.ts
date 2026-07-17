/** Orders module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./orders.db.ts";
import { ORDERS_KEY } from "./orders.rules.ts";
import { registerOrdersRoutes } from "./orders.routes.ts";

class OrdersModule extends AppModule {
  readonly key = ORDERS_KEY;
  readonly title = "Pedidos";

  registerRoutes(router: Router): void {
    registerOrdersRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Pedidos",
      description: "Verifica pagos Nequi, cambia estados y gestiona envíos.",
      href: "/admin/ordenes",
      moduleKey: ORDERS_KEY,
      action: "view",
    };
  }
}

registerModule(new OrdersModule());
