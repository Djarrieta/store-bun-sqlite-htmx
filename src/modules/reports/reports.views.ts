/** Reports admin views: prompt box, result table + CSS bar chart, saved reports. */
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { formatCop } from "../../core/format.ts";
import type { User } from "../../auth/auth.db.ts";
import type { QueryResult } from "../../core/readonly-sql.ts";
import { REPORTS_KEY, TEMPLATES } from "./reports.rules.ts";
import type { ChartType, Report } from "./reports.db.ts";
import { registerCss } from "../../components/registry.ts";

registerCss(/* css */ `
.chart { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.chart-row { display: grid; grid-template-columns: 160px 1fr 120px; gap: 0.75rem; align-items: center; }
.chart-label { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chart-track { background: var(--card); border-radius: 999px; height: 16px; overflow: hidden; }
.chart-bar { background: var(--accent); height: 100%; border-radius: 999px; min-width: 2px; }
.chart-value { text-align: right; font-weight: 600; font-size: 0.85rem; }
.report-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.report-table th, .report-table td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
.report-table th { color: var(--muted); font-weight: 600; }
.report-sql { background: var(--card); padding: 0.75rem; border-radius: var(--radius-btn-icon); overflow-x: auto; font-size: 0.82rem; }
@media (max-width: 560px) { .chart-row { grid-template-columns: 90px 1fr 80px; } }
`);

const BASE = "/admin/reportes";

function isMoneyColumn(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("cents") || n.includes("ingreso") || n.includes("revenue");
}

function formatCell(column: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && isMoneyColumn(column)) return formatCop(value);
  return String(value);
}

function barChart(result: QueryResult): string {
  if (result.columns.length < 2 || result.rows.length === 0) return "";
  const labelIdx = 0;
  // Pick the last numeric column as the value.
  let valueIdx = -1;
  for (let i = result.columns.length - 1; i >= 1; i--) {
    if (result.rows.every((r) => typeof r[i] === "number" || r[i] === null)) {
      valueIdx = i;
      break;
    }
  }
  if (valueIdx === -1) return "";
  const values = result.rows.map((r) => Number(r[valueIdx] ?? 0));
  const max = Math.max(1, ...values);
  const col = result.columns[valueIdx]!;
  const bars = result.rows
    .map((r, i) => {
      const pct = Math.round((values[i]! / max) * 100);
      return `<div class="chart-row">
        <div class="chart-label">${escapeHtml(String(r[labelIdx] ?? "—"))}</div>
        <div class="chart-track"><div class="chart-bar" style="width:${pct}%"></div></div>
        <div class="chart-value">${escapeHtml(formatCell(col, r[valueIdx]))}</div>
      </div>`;
    })
    .join("");
  return `<div class="chart">${bars}</div>`;
}

function resultTable(result: QueryResult): string {
  if (result.rows.length === 0) return `<p class="muted">La consulta no devolvió filas.</p>`;
  const head = result.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = result.rows
    .map((r) => `<tr>${r.map((v, i) => `<td>${escapeHtml(formatCell(result.columns[i]!, v))}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="report-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function reportResult(opts: {
  user: User;
  title: string;
  prompt: string;
  sql: string;
  chartType: ChartType;
  result: QueryResult;
  canSave: boolean;
}): string {
  const chart = opts.chartType === "bar" ? barChart(opts.result) : "";
  const saveForm = opts.canSave
    ? `<form method="post" action="${BASE}/guardar" class="stack" style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
        <input type="hidden" name="prompt" value="${escapeAttr(opts.prompt)}">
        <input type="hidden" name="sql" value="${escapeAttr(opts.sql)}">
        <input type="hidden" name="chart_type" value="${escapeAttr(opts.chartType)}">
        <div class="row-between" style="gap:0.5rem">
          <input class="input" name="title" value="${escapeAttr(opts.title)}" placeholder="Título del reporte" style="max-width:320px">
          <button class="btn btn--sm" type="submit">Guardar reporte</button>
        </div>
      </form>`
    : "";
  return `<div class="panel">
    <div class="row-between"><h2 style="margin:0">${escapeHtml(opts.title)}</h2></div>
    ${opts.result.truncated ? `<div class="alert alert--warn">Resultados truncados a las primeras filas.</div>` : ""}
    ${chart}
    <details style="margin-top:1rem"><summary class="muted">Ver SQL</summary><pre class="report-sql">${escapeHtml(opts.sql)}</pre></details>
    <div style="overflow-x:auto;margin-top:0.75rem">${resultTable(opts.result)}</div>
    ${saveForm}
  </div>`;
}

export function reportError(message: string): string {
  return `<div class="panel"><div class="alert alert--error">${escapeHtml(message)}</div></div>`;
}

export function reportsPage(user: User, saved: Report[]): string {
  const canCreate = can(user, REPORTS_KEY, "create");
  const chips = TEMPLATES.map(
    (t) => `<button class="btn btn--outline btn--sm" hx-post="${BASE}/generar" hx-target="#report-result" hx-swap="innerHTML" hx-vals='${escapeAttr(JSON.stringify({ prompt: t.title }))}'>${escapeHtml(t.title)}</button>`,
  ).join(" ");
  const savedList = saved.length
    ? saved
        .map(
          (r) => `<div class="data-row">
            <div class="data-row__main"><div class="data-row__title">${escapeHtml(r.title)}</div><div class="data-row__meta">${escapeHtml(r.prompt)}</div></div>
            <div class="data-row__actions">
              <button class="btn btn--outline btn--sm" hx-post="${BASE}/${r.id}/ejecutar" hx-target="#report-result" hx-swap="innerHTML">Ejecutar</button>
              <button class="btn btn--danger btn--sm" hx-post="${BASE}/${r.id}/eliminar" hx-confirm="¿Eliminar reporte?" hx-target="#saved-list" hx-swap="innerHTML">Eliminar</button>
            </div>
          </div>`,
        )
        .join("")
    : `<p class="muted">No hay reportes guardados.</p>`;

  const body = `
    <div class="panel" style="margin-bottom:1.5rem">
      <h1>Reportes</h1>
      <p class="muted">Escribe una pregunta en lenguaje natural. El motor genera <strong>SQL de solo lectura</strong> sobre vistas de analítica (sin datos personales).</p>
      ${
        canCreate
          ? `<form hx-post="${BASE}/generar" hx-target="#report-result" hx-swap="innerHTML" class="data-toolbar">
              <input class="input" name="prompt" placeholder="Ej: ventas por día, productos más vendidos…" style="max-width:480px" required>
              <button class="btn" type="submit">Generar</button>
            </form>
            <div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap">${chips}</div>`
          : ""
      }
    </div>
    <div id="report-result" style="margin-bottom:1.5rem"></div>
    <div class="panel">
      <h2>Reportes guardados</h2>
      <div id="saved-list">${savedList}</div>
    </div>`;
  return adminShell({ user, active: REPORTS_KEY, title: "Reportes", body });
}

export function savedListFragment(saved: Report[]): string {
  if (saved.length === 0) return `<p class="muted">No hay reportes guardados.</p>`;
  return saved
    .map(
      (r) => `<div class="data-row">
        <div class="data-row__main"><div class="data-row__title">${escapeHtml(r.title)}</div><div class="data-row__meta">${escapeHtml(r.prompt)}</div></div>
        <div class="data-row__actions">
          <button class="btn btn--outline btn--sm" hx-post="${BASE}/${r.id}/ejecutar" hx-target="#report-result" hx-swap="innerHTML">Ejecutar</button>
          <button class="btn btn--danger btn--sm" hx-post="${BASE}/${r.id}/eliminar" hx-confirm="¿Eliminar reporte?" hx-target="#saved-list" hx-swap="innerHTML">Eliminar</button>
        </div>
      </div>`,
    )
    .join("");
}
