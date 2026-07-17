/** Reports admin routes: generate (NL→SQL), run saved, save, delete. */
import type { Router } from "../../core/router.ts";
import { html, fragment, redirect, notFound } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { runReadonlySql } from "../../core/readonly-sql.ts";
import { reportsRepo } from "./reports.db.ts";
import { REPORTS_KEY } from "./reports.rules.ts";
import { generateReport } from "./reports.service.ts";
import { reportsPage, reportResult, reportError, savedListFragment } from "./reports.views.ts";
import type { ChartType } from "./reports.db.ts";

const BASE = "/admin/reportes";

export function registerReportsRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, REPORTS_KEY, "view");
    if (user instanceof Response) return user;
    return html(reportsPage(user, reportsRepo.listAll()));
  });

  router.post(`${BASE}/generar`, async (ctx) => {
    const user = requirePermission(ctx, REPORTS_KEY, "create");
    if (user instanceof Response) return user;
    const form = await ctx.req.formData();
    const prompt = String(form.get("prompt") ?? "").trim();
    if (!prompt) return fragment(reportError("Escribe una pregunta."));
    try {
      const generated = await generateReport(prompt);
      const result = runReadonlySql(generated.sql);
      return fragment(
        reportResult({
          user,
          title: generated.title,
          prompt,
          sql: generated.sql,
          chartType: generated.chartType,
          result,
          canSave: true,
        }),
      );
    } catch (err) {
      return fragment(reportError(err instanceof Error ? err.message : "No se pudo generar el reporte."));
    }
  });

  router.post(`${BASE}/guardar`, async (ctx) => {
    const user = requirePermission(ctx, REPORTS_KEY, "create");
    if (user instanceof Response) return user;
    const form = await ctx.req.formData();
    const title = String(form.get("title") ?? "").trim() || "Reporte";
    const prompt = String(form.get("prompt") ?? "").trim();
    const sql = String(form.get("sql") ?? "").trim();
    const chartType = (String(form.get("chart_type") ?? "table") as ChartType) === "bar" ? "bar" : "table";
    // Re-validate before persisting (never trust the round-trip).
    try {
      runReadonlySql(sql);
    } catch {
      return redirect(BASE);
    }
    reportsRepo.insert({ title, prompt, sql, chartType, createdBy: user.id });
    return redirect(BASE);
  });

  router.post(`${BASE}/:id/ejecutar`, (ctx) => {
    const user = requirePermission(ctx, REPORTS_KEY, "view");
    if (user instanceof Response) return user;
    const report = reportsRepo.findById(ctx.params.id!);
    if (!report) return notFound("Reporte no encontrado.");
    try {
      const result = runReadonlySql(report.sql);
      return fragment(
        reportResult({
          user,
          title: report.title,
          prompt: report.prompt,
          sql: report.sql,
          chartType: report.chart_type,
          result,
          canSave: false,
        }),
      );
    } catch (err) {
      return fragment(reportError(err instanceof Error ? err.message : "Error al ejecutar."));
    }
  });

  router.post(`${BASE}/:id/eliminar`, (ctx) => {
    const user = requirePermission(ctx, REPORTS_KEY, "create");
    if (user instanceof Response) return user;
    reportsRepo.deleteById(ctx.params.id!);
    return fragment(savedListFragment(reportsRepo.listAll()));
  });
}
