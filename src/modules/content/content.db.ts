/** Content (lightweight CMS): key/value text blocks (tech-spec §7). */
import { db } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS content (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
`);

export interface ContentRow {
  key: string;
  value: string;
  updated_at: string;
}

class ContentRepository extends Repository<ContentRow & Record<string, unknown>> {
  readonly table = "content";

  getValue(key: string, fallback = ""): string {
    const row = this.get<ContentRow>(`SELECT * FROM content WHERE key = $k`, { $k: key });
    return row?.value ?? fallback;
  }

  set(key: string, value: string): void {
    this.run(
      `INSERT INTO content (key, value, updated_at) VALUES ($k, $v, $u)
       ON CONFLICT(key) DO UPDATE SET value = $v, updated_at = $u`,
      { $k: key, $v: value, $u: this.now() },
    );
  }

  ensureDefault(key: string, value: string): void {
    this.run(`INSERT OR IGNORE INTO content (key, value, updated_at) VALUES ($k, $v, $u)`, {
      $k: key,
      $v: value,
      $u: this.now(),
    });
  }
}

export const contentRepo = new ContentRepository();
