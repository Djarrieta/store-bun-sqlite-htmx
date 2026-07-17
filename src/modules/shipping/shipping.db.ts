/** Shipping rates + config (tech-spec §7). Admin UI arrives in F5. */
import { db } from "../../db.ts";
import { Repository } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS shipping_rates (
  id             TEXT PRIMARY KEY,
  department     TEXT NOT NULL,
  city           TEXT NOT NULL,
  price_cents    INTEGER NOT NULL,
  estimated_days INTEGER,
  UNIQUE (department, city)
);

CREATE TABLE IF NOT EXISTS shipping_config (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  free_above_cents INTEGER
);
INSERT OR IGNORE INTO shipping_config (id, free_above_cents) VALUES (1, NULL);
`);

export interface ShippingRate {
  id: string;
  department: string;
  city: string;
  price_cents: number;
  estimated_days: number | null;
}

export interface ShippingConfig {
  id: number;
  free_above_cents: number | null;
}

class ShippingRepository extends Repository<ShippingRate & Record<string, unknown>> {
  readonly table = "shipping_rates";

  listRates(): ShippingRate[] {
    return this.all<ShippingRate>(
      `SELECT * FROM shipping_rates ORDER BY department COLLATE NOCASE, city COLLATE NOCASE`,
    );
  }

  findRate(department: string, city: string): ShippingRate | null {
    return this.get<ShippingRate>(
      `SELECT * FROM shipping_rates WHERE LOWER(department) = LOWER($d) AND LOWER(city) = LOWER($c)`,
      { $d: department, $c: city },
    );
  }

  departments(): string[] {
    return this.all<{ department: string }>(
      `SELECT DISTINCT department FROM shipping_rates ORDER BY department COLLATE NOCASE`,
    ).map((r) => r.department);
  }

  citiesIn(department: string): ShippingRate[] {
    return this.all<ShippingRate>(
      `SELECT * FROM shipping_rates WHERE LOWER(department) = LOWER($d) ORDER BY city COLLATE NOCASE`,
      { $d: department },
    );
  }

  insertRate(department: string, city: string, priceCents: number, estimatedDays: number | null): ShippingRate {
    const rate: ShippingRate = {
      id: this.newId(),
      department,
      city,
      price_cents: priceCents,
      estimated_days: estimatedDays,
    };
    this.run(
      `INSERT INTO shipping_rates (id, department, city, price_cents, estimated_days)
       VALUES ($id, $d, $c, $p, $e)`,
      { $id: rate.id, $d: department, $c: city, $p: priceCents, $e: estimatedDays },
    );
    return rate;
  }

  updateRate(id: string, priceCents: number, estimatedDays: number | null): void {
    this.run(`UPDATE shipping_rates SET price_cents = $p, estimated_days = $e WHERE id = $id`, {
      $id: id,
      $p: priceCents,
      $e: estimatedDays,
    });
  }

  getConfig(): ShippingConfig {
    return (
      this.get<ShippingConfig>(`SELECT * FROM shipping_config WHERE id = 1`) ?? {
        id: 1,
        free_above_cents: null,
      }
    );
  }

  setConfig(freeAboveCents: number | null): void {
    this.run(`UPDATE shipping_config SET free_above_cents = $f WHERE id = 1`, { $f: freeAboveCents });
  }
}

export const shippingRepo = new ShippingRepository();
