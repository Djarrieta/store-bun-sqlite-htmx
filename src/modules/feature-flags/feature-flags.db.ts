/** Feature flags: key/enabled toggles (tech-spec §7). */
import { db } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS feature_flags (
  key     TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0
);
`);

export interface FeatureFlag {
  key: string;
  enabled: number;
}

class FeatureFlagsRepository extends Repository<FeatureFlag & Record<string, unknown>> {
  readonly table = "feature_flags";

  isEnabled(key: string): boolean {
    const row = this.get<FeatureFlag>(`SELECT * FROM feature_flags WHERE key = $k`, { $k: key });
    return row ? row.enabled === 1 : false;
  }

  setEnabled(key: string, enabled: boolean): void {
    this.run(
      `INSERT INTO feature_flags (key, enabled) VALUES ($k, $e)
       ON CONFLICT(key) DO UPDATE SET enabled = $e`,
      { $k: key, $e: enabled ? 1 : 0 },
    );
  }

  ensureFlag(key: string, defaultEnabled: boolean): void {
    this.run(`INSERT OR IGNORE INTO feature_flags (key, enabled) VALUES ($k, $e)`, {
      $k: key,
      $e: defaultEnabled ? 1 : 0,
    });
  }
}

export const flagsRepo = new FeatureFlagsRepository();
