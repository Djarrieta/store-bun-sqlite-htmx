/**
 * Auth schema: users + sessions + oauth_identities (tech-spec §7, §13).
 * Table creation runs as a side-effect on import.
 */
import { db } from "../db.ts";
import { Repository } from "../core/repository.ts";
import type { Role } from "../core/permissions.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'customer',
  display_name  TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  phone         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_identities (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  email        TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,             -- sha256(token) in hex
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
`);

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthIdentity {
  id: string;
  user_id: string;
  provider: string;
  subject: string;
  email: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
}

class UsersRepository extends Repository<User & Record<string, unknown>> {
  readonly table = "users";

  findByEmail(email: string): User | null {
    return this.get<User>(`SELECT * FROM users WHERE email = $email`, { $email: email.toLowerCase() });
  }

  findByPhone(phone: string): User | null {
    return this.get<User>(`SELECT * FROM users WHERE phone = $phone`, { $phone: phone });
  }

  insert(u: User): void {
    this.run(
      `INSERT INTO users (id, email, password_hash, role, display_name, avatar_url, phone, created_at, updated_at)
       VALUES ($id, $email, $password_hash, $role, $display_name, $avatar_url, $phone, $created_at, $updated_at)`,
      {
        $id: u.id,
        $email: u.email.toLowerCase(),
        $password_hash: u.password_hash,
        $role: u.role,
        $display_name: u.display_name,
        $avatar_url: u.avatar_url,
        $phone: u.phone,
        $created_at: u.created_at,
        $updated_at: u.updated_at,
      },
    );
  }

  updateRole(id: string, role: Role): void {
    this.run(`UPDATE users SET role = $role, updated_at = $u WHERE id = $id`, {
      $role: role,
      $u: this.now(),
      $id: id,
    });
  }

  updateProfile(id: string, displayName: string, avatarUrl: string | null): void {
    this.run(`UPDATE users SET display_name = $n, avatar_url = $a, updated_at = $u WHERE id = $id`, {
      $n: displayName,
      $a: avatarUrl,
      $u: this.now(),
      $id: id,
    });
  }

  setPhone(id: string, phone: string): void {
    this.run(`UPDATE users SET phone = $p, updated_at = $u WHERE id = $id`, {
      $p: phone,
      $u: this.now(),
      $id: id,
    });
  }
}

class OAuthRepository extends Repository<OAuthIdentity & Record<string, unknown>> {
  readonly table = "oauth_identities";

  findByProviderSubject(provider: string, subject: string): OAuthIdentity | null {
    return this.get<OAuthIdentity>(
      `SELECT * FROM oauth_identities WHERE provider = $p AND subject = $s`,
      { $p: provider, $s: subject },
    );
  }

  insert(row: OAuthIdentity): void {
    this.run(
      `INSERT INTO oauth_identities (id, user_id, provider, subject, email, created_at)
       VALUES ($id, $user_id, $provider, $subject, $email, $created_at)`,
      {
        $id: row.id,
        $user_id: row.user_id,
        $provider: row.provider,
        $subject: row.subject,
        $email: row.email,
        $created_at: row.created_at,
      },
    );
  }
}

export const usersRepo = new UsersRepository();
export const oauthRepo = new OAuthRepository();
