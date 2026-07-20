/** Chat conversations viewer module — read-only admin interface. */
import { AppModule, registerModule, type DashboardCard } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import { CHAT_VIEWER_KEY } from "./chat-viewer.rules.ts";
import { registerChatViewerRoutes } from "./chat-viewer.routes.ts";

class ChatViewerModule extends AppModule {
  readonly key = CHAT_VIEWER_KEY;
  readonly title = "Conversaciones";

  registerRoutes(router: Router): void {
    registerChatViewerRoutes(router);
  }

  dashboardCard(): DashboardCard {
    return {
      title: "Conversaciones",
      description: "Consulta conversaciones de chat de clientes.",
      href: "/admin/conversaciones",
      moduleKey: CHAT_VIEWER_KEY,
      action: "view",
    };
  }
}

registerModule(new ChatViewerModule());
