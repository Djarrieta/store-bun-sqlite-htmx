/**
 * Reports table + analytics VIEWS (tech-spec §7, §14.2). The views deliberately
 * EXCLUDE PII (customer name/phone/email) and sensitive tables (users/sessions/
 * oauth). The read-only SQL engine only ever sees these views.
 */
import { db } from "../../db.ts";
import { Repository } from "../../core/repository.ts";
// Ensure base tables exist before creating views over them.
import "../orders/orders.db.ts";
import "../products/products.db.ts";
import "../variants/variants.db.ts";

db.exec(`
CREATE VIEW IF NOT EXISTS v_orders AS
  SELECT id, status, subtotal_cents, shipping_cents, total_cents, shipping_city, shipping_dept,
         payment_method, created_at, paid_at
  FROM orders;

CREATE VIEW IF NOT EXISTS v_order_items AS
  SELECT id, order_id, product_title, variant_name, sku, qty, unit_price_cents
  FROM order_items;

CREATE VIEW IF NOT EXISTS v_products AS
  SELECT id, title, price_cents, discount_pct, category_id, active, created_at
  FROM products;

CREATE VIEW IF NOT EXISTS v_stock AS
  SELECT id, product_id, name AS variant_name, stock, low_stock_threshold
  FROM variants;

CREATE VIEW IF NOT EXISTS v_sales_daily AS
  SELECT date(paid_at) AS day, COUNT(*) AS orders, SUM(total_cents) AS revenue_cents
  FROM orders WHERE status = 'paid' AND paid_at IS NOT NULL
  GROUP BY date(paid_at);

CREATE VIEW IF NOT EXISTS v_orders_by_status AS
  SELECT status, COUNT(*) AS orders, SUM(total_cents) AS total_cents
  FROM orders GROUP BY status;

CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  prompt     TEXT NOT NULL DEFAULT '',
  sql        TEXT NOT NULL,
  chart_type TEXT NOT NULL DEFAULT 'table',
  config     TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

export type ChartType = "table" | "bar";

export interface Report {
  id: string;
  title: string;
  prompt: string;
  sql: string;
  chart_type: ChartType;
  config: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

class ReportsRepository extends Repository<Report & Record<string, unknown>> {
  readonly table = "reports";

  listAll(): Report[] {
    return this.all<Report>(`SELECT * FROM reports ORDER BY created_at DESC`);
  }

  insert(input: { title: string; prompt: string; sql: string; chartType: ChartType; createdBy: string | null }): Report {
    const ts = this.now();
    const report: Report = {
      id: this.newId(),
      title: input.title,
      prompt: input.prompt,
      sql: input.sql,
      chart_type: input.chartType,
      config: "{}",
      created_by: input.createdBy,
      created_at: ts,
      updated_at: ts,
    };
    this.run(
      `INSERT INTO reports (id, title, prompt, sql, chart_type, config, created_by, created_at, updated_at)
       VALUES ($id, $title, $prompt, $sql, $chart, '{}', $by, $c, $c)`,
      {
        $id: report.id,
        $title: report.title,
        $prompt: report.prompt,
        $sql: report.sql,
        $chart: report.chart_type,
        $by: report.created_by,
        $c: ts,
      },
    );
    return report;
  }
}

export const reportsRepo = new ReportsRepository();
