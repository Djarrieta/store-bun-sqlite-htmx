/**
 * Base repository: parameterized access over the single SQLite connection,
 * plus `paginate()` (search + filters + pagination done in SQL, never in memory).
 */
import { db, newId, now } from "../db.ts";

/** Lowercase + strip diacritics for accent-insensitive `*_search` columns. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface PaginateOptions {
  page?: number;
  pageSize?: number;
  /** Raw search term (normalized internally). */
  search?: string;
  /** Column to match the search against (e.g. `title_search`). */
  searchColumn?: string;
  /** Extra SQL predicate, e.g. `active = 1 AND category_id = $cat`. */
  where?: string;
  /** Bound params for `where` (and reused across count + page queries). */
  params?: Record<string, unknown>;
  /** Defaults to `created_at DESC`. */
  orderBy?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export abstract class Repository<Row extends Record<string, unknown>> {
  abstract readonly table: string;

  protected get db() {
    return db;
  }

  newId(): string {
    return newId();
  }
  now(): string {
    return now();
  }

  all<T = Row>(sql: string, params: Record<string, unknown> = {}): T[] {
    return db.query(sql).all(params as never) as T[];
  }

  get<T = Row>(sql: string, params: Record<string, unknown> = {}): T | null {
    return (db.query(sql).get(params as never) as T | undefined) ?? null;
  }

  run(sql: string, params: Record<string, unknown> = {}): void {
    db.query(sql).run(params as never);
  }

  findById(id: string): Row | null {
    return this.get<Row>(`SELECT * FROM ${this.table} WHERE id = $id`, { $id: id });
  }

  deleteById(id: string): void {
    this.run(`DELETE FROM ${this.table} WHERE id = $id`, { $id: id });
  }

  count(where = "", params: Record<string, unknown> = {}): number {
    const clause = where ? `WHERE ${where}` : "";
    const row = this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.table} ${clause}`, params);
    return row?.n ?? 0;
  }

  paginate<T = Row>(opts: PaginateOptions = {}): Page<T> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const params: Record<string, unknown> = { ...(opts.params ?? {}) };

    const clauses: string[] = [];
    if (opts.where) clauses.push(`(${opts.where})`);
    if (opts.search && opts.searchColumn) {
      params.$q = `%${normalizeSearch(opts.search)}%`;
      clauses.push(`${opts.searchColumn} LIKE $q`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const orderBy = opts.orderBy ?? "created_at DESC";

    const total =
      this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${this.table} ${where}`, params)?.n ?? 0;

    params.$limit = pageSize;
    params.$offset = (page - 1) * pageSize;
    const items = this.all<T>(
      `SELECT * FROM ${this.table} ${where} ORDER BY ${orderBy} LIMIT $limit OFFSET $offset`,
      params,
    );

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
