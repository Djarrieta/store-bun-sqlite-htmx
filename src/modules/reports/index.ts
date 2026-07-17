/** Reports module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./reports.db.ts";
import { REPORTS_KEY } from "./reports.rules.ts";
import { registerReportsRoutes } from "./reports.routes.ts";

class ReportsModule extends AppModule {
  readonly key = REPORTS_KEY;
  readonly title = "Reportes";

  registerRoutes(router: Router): void {
    registerReportsRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Reportes",
      description: "Analítica en lenguaje natural (SQL de solo lectura).",
      href: "/admin/reportes",
      moduleKey: REPORTS_KEY,
      action: "view",
    };
  }
}

registerModule(new ReportsModule());
