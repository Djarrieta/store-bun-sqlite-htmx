/** Inventory module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./inventory.db.ts";
import { INVENTORY_KEY } from "./inventory.rules.ts";
import { registerInventoryRoutes } from "./inventory.routes.ts";

class InventoryModule extends AppModule {
  readonly key = INVENTORY_KEY;
  readonly title = "Inventario";

  registerRoutes(router: Router): void {
    registerInventoryRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Inventario",
      description: "Ajusta stock, revisa movimientos y alertas de bajo stock.",
      href: "/admin/inventario",
      moduleKey: INVENTORY_KEY,
      action: "view",
    };
  }
}

registerModule(new InventoryModule());
