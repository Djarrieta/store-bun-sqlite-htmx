/**
 * Module system. Each admin domain lives in `src/modules/<name>/` and extends
 * `AppModule`: it registers its routes and (optionally) contributes a dashboard
 * card gated by its own permissions (tech-spec §6).
 */
import type { Router } from "./router.ts";

export interface DashboardCard {
  title: string;
  description: string;
  href: string;
  /** Permission key + action required to see this card. */
  moduleKey: string;
  action: string;
}

export abstract class AppModule {
  /** Stable key used for permissions and routing. */
  abstract readonly key: string;
  /** Human title (Spanish). */
  abstract readonly title: string;

  /** Register the module's routes on the shared router. */
  abstract registerRoutes(router: Router): void;

  /** Optional admin dashboard card. */
  dashboardCard(): DashboardCard | null {
    return null;
  }
}

const modules: AppModule[] = [];

export function registerModule(module: AppModule): void {
  if (modules.some((m) => m.key === module.key)) {
    throw new Error(`Duplicate module key: ${module.key}`);
  }
  modules.push(module);
}

export function getModules(): readonly AppModule[] {
  return modules;
}

export function registerAllRoutes(router: Router): void {
  for (const m of modules) m.registerRoutes(router);
}
