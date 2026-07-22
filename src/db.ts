/**
 * Shared SQLite connection (single writer) with production-grade PRAGMAs.
 * Every module accesses data through this connection via `core/repository.ts`.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

const DATA_DIR = "data";
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(`${DATA_DIR}/app.sqlite`, { create: true });

// PRAGMAs (see tech-spec §17: SQLite in production).
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");

/**
 * Run a function inside a transaction. Returns the function result.
 * Used for sensitive mutations (stock, payments) that must be atomic.
 */
export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

/** ISO-8601 timestamp for `*_at` columns. */
export function now(): string {
  return new Date().toISOString();
}

/** UUID v4 primary key (crypto.randomUUID). */
export function newId(): string {
  return crypto.randomUUID();
}
