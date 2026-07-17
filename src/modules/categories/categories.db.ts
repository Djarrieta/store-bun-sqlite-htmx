/** Categories table + repository (tech-spec §7). */
import { db } from "../../db.ts";
import { Repository, normalizeSearch } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  name_search TEXT NOT NULL DEFAULT ''
);
`);

export interface Category {
  id: string;
  name: string;
  slug: string;
  name_search: string;
}

class CategoriesRepository extends Repository<Category & Record<string, unknown>> {
  readonly table = "categories";

  findBySlug(slug: string): Category | null {
    return this.get<Category>(`SELECT * FROM categories WHERE slug = $slug`, { $slug: slug });
  }

  slugExists(slug: string, exceptId?: string): boolean {
    const row = this.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM categories WHERE slug = $slug AND id != $id`,
      { $slug: slug, $id: exceptId ?? "" },
    );
    return (row?.n ?? 0) > 0;
  }

  listAll(): Category[] {
    return this.all<Category>(`SELECT * FROM categories ORDER BY name COLLATE NOCASE`);
  }

  insert(name: string, slug: string): Category {
    const cat: Category = { id: this.newId(), name, slug, name_search: normalizeSearch(name) };
    this.run(
      `INSERT INTO categories (id, name, slug, name_search) VALUES ($id, $name, $slug, $s)`,
      { $id: cat.id, $name: cat.name, $slug: cat.slug, $s: cat.name_search },
    );
    return cat;
  }

  update(id: string, name: string, slug: string): void {
    this.run(`UPDATE categories SET name = $name, slug = $slug, name_search = $s WHERE id = $id`, {
      $id: id,
      $name: name,
      $slug: slug,
      $s: normalizeSearch(name),
    });
  }
}

export const categoriesRepo = new CategoriesRepository();
