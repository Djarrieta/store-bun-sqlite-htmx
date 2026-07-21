/**
 * Domain module registry barrel. Importing a module's `index.ts` runs its
 * `registerModule(...)` side-effect (and creates its tables). Modules are added
 * here as phases land (F1: catalog, F2: inventory, …).
 */

// F1 — Catalog
import "./categories/index.ts";
import "./products/index.ts";
import "./variants/index.ts";

// F2 — Inventory
import "./inventory/index.ts";

// F5 — Orders + shipping + content + flags
import "./orders/index.ts";
import "./shipping/index.ts";
import "./content/index.ts";
import "./feature-flags/index.ts";

// F8 — Users
import "./users/index.ts";

// F9 — Reports (read-only NL→SQL)
import "./reports/index.ts";

// F10 — Conversations (admin chat viewer)
import "./chat-viewer/index.ts";

export {};
