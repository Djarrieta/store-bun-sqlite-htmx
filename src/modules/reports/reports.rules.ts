/** Reports permissions + predefined analytics templates (tech-spec §12, §14.2). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";
import type { ChartType } from "./reports.db.ts";

export const REPORTS_KEY = "reports";

export const reportsPermissions: PermissionMatrix = {
  view: ["admin", "manager", "financial"],
  create: ["admin", "manager", "financial"],
};

registerPermissions(REPORTS_KEY, reportsPermissions);

export interface ReportTemplate {
  keywords: string[];
  title: string;
  sql: string;
  chartType: ChartType;
}

/** Fallback catalog used when no LLM is configured (keyword-matched). */
export const TEMPLATES: ReportTemplate[] = [
  {
    keywords: ["venta", "ingreso por día", "ingresos por día", "revenue", "día", "diaria"],
    title: "Ventas por día",
    sql: "SELECT day, revenue_cents FROM v_sales_daily ORDER BY day",
    chartType: "bar",
  },
  {
    keywords: ["estado", "status", "pedidos por estado"],
    title: "Pedidos por estado",
    sql: "SELECT status, orders FROM v_orders_by_status ORDER BY orders DESC",
    chartType: "bar",
  },
  {
    keywords: ["más vendido", "mas vendido", "top producto", "productos vendidos", "unidades"],
    title: "Productos más vendidos",
    sql: "SELECT product_title, SUM(qty) AS unidades FROM v_order_items GROUP BY product_title ORDER BY unidades DESC LIMIT 10",
    chartType: "bar",
  },
  {
    keywords: ["stock", "inventario", "bajo stock", "agotado"],
    title: "Stock bajo",
    sql: "SELECT variant_name, stock FROM v_stock WHERE low_stock_threshold > 0 AND stock <= low_stock_threshold ORDER BY stock",
    chartType: "table",
  },
  {
    keywords: ["ciudad", "por ciudad", "ingresos por ciudad", "ventas por ciudad"],
    title: "Ingresos por ciudad",
    sql: "SELECT shipping_city, SUM(total_cents) AS ingresos FROM v_orders WHERE status = 'paid' GROUP BY shipping_city ORDER BY ingresos DESC",
    chartType: "bar",
  },
];

export function matchTemplate(prompt: string): ReportTemplate | null {
  const p = prompt.toLowerCase();
  for (const t of TEMPLATES) {
    if (t.keywords.some((k) => p.includes(k))) return t;
  }
  return null;
}
