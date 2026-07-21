/** Categories table + repository (tech-spec §7). */
import { db } from "../../db.ts";
import { Repository, normalizeSearch } from "../../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  name_search TEXT NOT NULL DEFAULT ''
);
`);

export interface Category {
  id: string;
  name: string;
  name_search: string;
}

class CategoriesRepository extends Repository<Category & Record<string, unknown>> {
  readonly table = "categories";

  findByName(name: string): Category | null {
    return this.get<Category>(`SELECT * FROM categories WHERE name = $name`, { $name: name });
  }

  listAll(): Category[] {
    return this.all<Category>(`SELECT * FROM categories ORDER BY name COLLATE NOCASE`);
  }

  insert(name: string): Category {
    const cat: Category = { id: this.newId(), name, name_search: normalizeSearch(name) };
    this.run(
      `INSERT INTO categories (id, name, name_search) VALUES ($id, $name, $s)`,
      { $id: cat.id, $name: cat.name, $s: cat.name_search },
    );
    return cat;
  }

  update(id: string, name: string): void {
    this.run(`UPDATE categories SET name = $name, name_search = $s WHERE id = $id`, {
      $id: id,
      $name: name,
      $s: normalizeSearch(name),
    });
  }
}

export const categoriesRepo = new CategoriesRepository();
