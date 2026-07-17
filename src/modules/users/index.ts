/** Users module registration. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import { USERS_KEY } from "./users.rules.ts";
import { registerUsersRoutes } from "./users.views.ts";

class UsersModule extends AppModule {
  readonly key = USERS_KEY;
  readonly title = "Usuarios";

  registerRoutes(router: Router): void {
    registerUsersRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Usuarios",
      description: "Gestiona cuentas y roles.",
      href: "/admin/usuarios",
      moduleKey: USERS_KEY,
      action: "view",
    };
  }
}

registerModule(new UsersModule());
