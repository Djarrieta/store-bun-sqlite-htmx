/** Variants module (nested under products; table + permissions only). */
import { AppModule, registerModule } from "../../core/modules.ts";
import type { Router } from "../../core/router.ts";
import "./variants.db.ts";
import { VARIANTS_KEY } from "../products/products.rules.ts";

class VariantsModule extends AppModule {
  readonly key = VARIANTS_KEY;
  readonly title = "Variantes";

  // Variant routes are nested within the products module.
  registerRoutes(_router: Router): void {}
}

registerModule(new VariantsModule());
