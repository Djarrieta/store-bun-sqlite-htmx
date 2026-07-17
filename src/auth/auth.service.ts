/**
 * Auth service: session lifecycle (opaque token, SHA-256 hashed at rest),
 * plus user resolution/creation rules (allowlist -> admin). Tech-spec §13, §16.
 */
import { config } from "../config.ts";
import { newId, now } from "../db.ts";
import { serializeCookie, type CookieOptions } from "../core/http.ts";
import type { Role } from "../core/permissions.ts";
import { usersRepo, oauthRepo, type User } from "./auth.db.ts";
import { db } from "../db.ts";

export const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sha256Hex(input: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("hex");
}

function randomToken(): string {
  // 32 random bytes (>128 bits), url-safe hex.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Roles derived from the admin allowlist (tech-spec §13.2). */
export function roleForEmail(email: string): Role {
  return config.adminAllowlist.includes(email.toLowerCase()) ? "admin" : "customer";
}

// ---- Sessions ----

export interface NewSession {
  token: string;
  cookie: string;
}

export function createSession(userId: string): NewSession {
  const token = randomToken();
  const id = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.query(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($id, $u, $e)`).run({
    $id: id,
    $u: userId,
    $e: expiresAt,
  });
  return { token, cookie: sessionCookie(token) };
}

/** Resolve the current user from the session cookie, or null. Cleans expired. */
export function resolveUser(token: string | undefined): User | null {
  if (!token) return null;
  const id = sha256Hex(token);
  const row = db
    .query(`SELECT user_id, expires_at FROM sessions WHERE id = $id`)
    .get({ $id: id }) as { user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.query(`DELETE FROM sessions WHERE id = $id`).run({ $id: id });
    return null;
  }
  return usersRepo.findById(row.user_id) as User | null;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  const id = sha256Hex(token);
  db.query(`DELETE FROM sessions WHERE id = $id`).run({ $id: id });
}

export function purgeExpiredSessions(): void {
  db.query(`DELETE FROM sessions WHERE expires_at < $now`).run({ $now: now() });
}

export function sessionCookie(token: string): string {
  return serializeCookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.isProd,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

// ---- Users ----

/**
 * Find or create a user by email. Used by OAuth callback and dev-login.
 * Role is (re)derived from the allowlist so promotions take effect on next login.
 */
export function upsertUserByEmail(params: {
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}): User {
  const email = params.email.toLowerCase();
  const existing = usersRepo.findByEmail(email);
  const role = roleForEmail(email);
  if (existing) {
    // Promote/demote per allowlist; keep customers as-is if already elevated by admin.
    if (role === "admin" && existing.role !== "admin") usersRepo.updateRole(existing.id, "admin");
    return usersRepo.findById(existing.id) as User;
  }
  const ts = now();
  const user: User = {
    id: newId(),
    email,
    password_hash: null,
    role,
    display_name: params.displayName ?? email.split("@")[0]!,
    avatar_url: params.avatarUrl ?? null,
    phone: null,
    created_at: ts,
    updated_at: ts,
  };
  usersRepo.insert(user);
  return user;
}

/** Link (or create) a user for an OAuth identity, returning the user. */
export function upsertOAuthUser(params: {
  provider: string;
  subject: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}): User {
  const identity = oauthRepo.findByProviderSubject(params.provider, params.subject);
  if (identity) {
    return usersRepo.findById(identity.user_id) as User;
  }
  const user = upsertUserByEmail({
    email: params.email,
    displayName: params.displayName,
    avatarUrl: params.avatarUrl,
  });
  oauthRepo.insert({
    id: newId(),
    user_id: user.id,
    provider: params.provider,
    subject: params.subject,
    email: params.email.toLowerCase(),
    created_at: now(),
  });
  return user;
}
