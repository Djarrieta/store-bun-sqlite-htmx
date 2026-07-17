/**
 * Read-only SQL engine for admin analytics (tech-spec §14.2, §16).
 * SECURITY (defense in depth):
 *  1. A SEPARATE read-only SQLite connection (readonly + PRAGMA query_only) — the
 *     hard backstop: no writes, no ATTACH, no schema changes are possible.
 *  2. Positive ALLOWLIST over analytics VIEWS only (v_*). The views exclude PII
 *     (customer name/phone/email) and sensitive tables (users/sessions/oauth).
 *  3. Structural checks: a single SELECT/WITH statement; every FROM/JOIN target
 *     must be an allowlisted view or a CTE defined in the same query; PRAGMA/
 *     ATTACH/sqlite_/comments/multiple statements are rejected.
 *  4. Row cap to avoid runaway result sets.
 */
import { Database } from "bun:sqlite";

/** Analytics views exposed to the engine (created in reports.db.ts). */
export const ALLOWED_VIEWS = new Set([
  "v_orders",
  "v_order_items",
  "v_products",
  "v_stock",
  "v_sales_daily",
  "v_orders_by_status",
]);

export const MAX_REPORT_ROWS = 1000;

let ro: Database | null = null;
function conn(): Database {
  if (!ro) {
    ro = new Database("data/app.sqlite", { readonly: true });
    ro.exec("PRAGMA query_only = ON;");
  }
  return ro;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

function stripStrings(sql: string): string {
  // Remove string literals so identifiers inside them don't trip the checks.
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

/** Validate a query against the allowlist + structural rules. */
export function validateReadonlySql(rawSql: string, allowed: Set<string> = ALLOWED_VIEWS): ValidationResult {
  const sql = rawSql.trim();
  if (!sql) return { ok: false, error: "Consulta vacía." };
  if (sql.includes("--") || sql.includes("/*")) return { ok: false, error: "No se permiten comentarios." };

  const noStrings = stripStrings(sql);

  // Single statement: no ';' except an optional trailing one.
  const withoutTrailing = noStrings.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) return { ok: false, error: "Solo se permite una sentencia." };

  const lower = withoutTrailing.toLowerCase();
  if (!/^\s*(select|with)\b/.test(lower)) return { ok: false, error: "Solo se permiten consultas SELECT o WITH." };

  // Hard-blocked tokens (defense in depth; the readonly conn is the real backstop).
  for (const bad of ["attach", "pragma", "sqlite_", "vacuum", " into ", "insert", "update", "delete", "drop", "alter", "create"]) {
    if (lower.includes(bad)) return { ok: false, error: `Token no permitido: ${bad.trim()}` };
  }

  // Collect CTE names (WITH name AS (...), name2 AS (...)).
  const cteNames = new Set<string>();
  for (const m of withoutTrailing.matchAll(/\b(?:with|,)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/gi)) {
    cteNames.add(m[1]!.toLowerCase());
  }

  // Every FROM/JOIN identifier target must be an allowed view or a CTE.
  for (const m of withoutTrailing.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi)) {
    const target = m[1]!.toLowerCase();
    if (target.startsWith("(")) continue; // subquery
    if (allowed.has(target) || cteNames.has(target)) continue;
    return { ok: false, error: `Objeto no permitido: ${target}. Usa las vistas de analítica (${[...allowed].join(", ")}).` };
  }

  return { ok: true };
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

/** Validate + execute a read-only query. Throws Error on invalid SQL. */
export function runReadonlySql(sql: string, allowed: Set<string> = ALLOWED_VIEWS): QueryResult {
  const check = validateReadonlySql(sql, allowed);
  if (!check.ok) throw new Error(check.error ?? "Consulta inválida.");

  const stmt = conn().query(sql.trim().replace(/;\s*$/, ""));
  const raw = stmt.all() as Record<string, unknown>[];
  const truncated = raw.length > MAX_REPORT_ROWS;
  const limited = truncated ? raw.slice(0, MAX_REPORT_ROWS) : raw;
  const columns = limited.length > 0 ? Object.keys(limited[0]!) : [];
  const rows = limited.map((r) => columns.map((c) => r[c]));
  return { columns, rows, truncated };
}
