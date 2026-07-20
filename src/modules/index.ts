/**
 * Domain module registry barrel. Importing a module's `index.ts` runs its
 * `registerModule(...)` side-effect (and creates its tables). Modules are added
 * here as phases land (F1: catalog, F2: inventory, …).
 */

// F1 — Catálogo
import "./categories/index.ts";
import "./products/index.ts";
import "./variants/index.ts";

// F2 — Inventario
import "./inventory/index.ts";

// F5 — Pedidos + envíos + contenido + flags
import "./orders/index.ts";
import "./shipping/index.ts";
import "./content/index.ts";
import "./feature-flags/index.ts";

// F8 — Usuarios
import "./users/index.ts";

// F9 — Reportes (NL→SQL de solo lectura)
import "./reports/index.ts";

// F10 — Conversaciones (visor de chat admin)
import "./chat-viewer/index.ts";

export {};
