/**
 * NL→SQL generation (tech-spec §14.2). With an LLM configured, the model is asked
 * to produce a single read-only SELECT over the analytics views ONLY; the result
 * is re-validated by the read-only engine. Without an LLM, a keyword template is
 * used. The read-only engine + views remain the security boundary either way.
 */
import { chatComplete, llmAvailable } from "../../core/llm.ts";
import { validateReadonlySql, ALLOWED_VIEWS } from "../../core/readonly-sql.ts";
import { matchTemplate, type ReportTemplate } from "./reports.rules.ts";
import type { ChartType } from "./reports.db.ts";

const VIEW_SCHEMA = `
Vistas disponibles (ÚNICA fuente permitida; no existe ninguna otra tabla):
- v_orders(id, status, subtotal_cents, shipping_cents, total_cents, shipping_city, shipping_dept, payment_method, created_at, paid_at)
- v_order_items(id, order_id, product_title, variant_name, sku, qty, unit_price_cents)
- v_products(id, title, price_cents, discount_pct, category_id, active, created_at)
- v_stock(id, product_id, variant_name, stock, low_stock_threshold)
- v_sales_daily(day, orders, revenue_cents)
- v_orders_by_status(status, orders, total_cents)
`.trim();

export interface GeneratedReport {
  title: string;
  sql: string;
  chartType: ChartType;
}

function cleanSql(raw: string): string {
  return raw
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim()
    .replace(/;\s*$/, "");
}

async function generateWithLlm(prompt: string): Promise<GeneratedReport | null> {
  const system = [
    "Eres un generador de SQL de SOLO LECTURA para analítica de una tienda.",
    "Devuelves EXCLUSIVAMENTE una sentencia SELECT (o WITH) válida para SQLite.",
    "Solo puedes usar las vistas listadas; NUNCA tablas base, PRAGMA, ATTACH ni escrituras.",
    "No añadas explicaciones: responde solo el SQL.",
    VIEW_SCHEMA,
  ].join("\n");
  const result = await chatComplete([
    { role: "system", content: system },
    { role: "user", content: prompt },
  ]);
  const sql = cleanSql(result.content);
  if (!sql) return null;
  const check = validateReadonlySql(sql, ALLOWED_VIEWS);
  if (!check.ok) throw new Error(`El SQL generado no pasó la validación: ${check.error}`);
  const chartType: ChartType = /group by|count|sum|avg/i.test(sql) ? "bar" : "table";
  return { title: prompt.slice(0, 60), sql, chartType };
}

/** Generate a report from a natural-language prompt (LLM or template). */
export async function generateReport(prompt: string): Promise<GeneratedReport> {
  if (llmAvailable()) {
    const generated = await generateWithLlm(prompt);
    if (generated) return generated;
  }
  const template: ReportTemplate | null = matchTemplate(prompt);
  if (!template) {
    throw new Error(
      "No pude generar un reporte para esa pregunta. Prueba con: ventas por día, pedidos por estado, productos más vendidos, stock bajo, ingresos por ciudad.",
    );
  }
  return { title: template.title, sql: template.sql, chartType: template.chartType };
}
