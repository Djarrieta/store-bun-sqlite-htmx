/**
 * Development reset: delete the local SQLite database so the schema is recreated
 * from scratch on next boot. Dev-only (tech-spec §7). Run with `bun run reset`.
 */
import { rmSync } from "node:fs";

for (const suffix of ["", "-wal", "-shm"]) {
  try {
    rmSync(`data/app.sqlite${suffix}`, { force: true });
  } catch {
    // ignore
  }
}
console.log("Reset: data/app.sqlite eliminado.");
