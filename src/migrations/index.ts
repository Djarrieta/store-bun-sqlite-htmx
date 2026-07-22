/**
 * Versioned migrations (tech-spec §7, O-6). Dev creates tables via
 * `CREATE TABLE IF NOT EXISTS`; production applies ordered migrations tracked by
 * `PRAGMA user_version` so real data is never lost. Migrations run at boot,
 * before serving traffic.
 */
import { db, transaction } from "../db.ts";

export interface Migration {
  version: number;
  name: string;
  up: (database: typeof db) => void;
}

/**
 * Ordered migrations. Version 1 is the baseline: the schema is created by each
 * module's `CREATE TABLE IF NOT EXISTS`, so this only marks the starting point.
 * Add future schema changes as new entries (version 2, 3, …) — never edit past ones.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "baseline",
    up: () => {
      // No-op: tables/views are created by module db files on import.
    },
  },
  {
    version: 2,
    name: "drop-category-slug",
    up: (database) => {
      const cols = database.query("PRAGMA table_info(categories)").all() as { name: string }[];
      if (cols.some((c) => c.name === "slug")) {
        database.exec("ALTER TABLE categories DROP COLUMN slug");
      }
      const hasUnique = database
        .query(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='categories' AND "unique"=1 AND sql LIKE '%name%'`)
        .get();
      if (!hasUnique) {
        database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name)");
      }
    },
  },
];

function currentVersion(): number {
  const row = db.query("PRAGMA user_version").get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/** Apply any migrations newer than the DB's current user_version. */
export function runMigrations(): void {
  const from = currentVersion();
  const pending = MIGRATIONS.filter((m) => m.version > from).sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;
  for (const m of pending) {
    transaction(() => {
      m.up(db);
      // user_version doesn't accept bound params; the value is an integer literal.
      db.exec(`PRAGMA user_version = ${m.version}`);
    });
    console.log(`[migrate] applied ${m.version} (${m.name})`);
  }
}
