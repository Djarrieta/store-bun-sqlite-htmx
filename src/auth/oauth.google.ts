/**
 * Google OAuth 2.0 / OIDC — Authorization Code + PKCE (tech-spec §13.3).
 * Implemented over fetch (no SDK). The id_token comes directly from Google's
 * token endpoint over TLS; we validate iss/aud/exp/email_verified claims.
 */
import type { Router } from "../core/router.ts";
import { redirect, serializeCookie, parseCookies } from "../core/http.ts";
import { config, googleOAuthEnabled } from "../config.ts";
import { createSession, upsertOAuthUser } from "./auth.service.ts";
import { migrateChatSession } from "../chat/chat.history.ts";
import { safeNext } from "./auth.routes.ts";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomString(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a);
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function tempCookie(name: string, value: string): string {
  return serializeCookie(name, value, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.isProd,
    path: "/",
    maxAge: 600, // 10 min
  });
}

function clearTemp(name: string): string {
  return serializeCookie(name, "", { httpOnly: true, sameSite: "Lax", secure: config.isProd, path: "/", maxAge: 0 });
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwtPayload(idToken: string): IdTokenClaims | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const bytes = base64UrlToBytes(parts[1]!);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as IdTokenClaims;
  } catch {
    return null;
  }
}

function validClaims(c: IdTokenClaims): boolean {
  const issOk = c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com";
  const audOk = c.aud === config.google.clientId;
  const expOk = typeof c.exp === "number" && c.exp * 1000 > Date.now();
  const verified = c.email_verified === true || c.email_verified === "true";
  return Boolean(issOk && audOk && expOk && verified && c.sub && c.email);
}

export function registerGoogleOAuthRoutes(router: Router): void {
  router.get("/auth/google", async (ctx) => {
    if (!googleOAuthEnabled()) return redirect("/login");
    const state = randomString();
    const verifier = randomString();
    const challenge = await s256(verifier);
    const next = safeNext(ctx.query.get("next"));

    ctx.setCookie(tempCookie("oauth_state", state));
    ctx.setCookie(tempCookie("oauth_verifier", verifier));
    ctx.setCookie(tempCookie("oauth_next", next));

    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "online",
      prompt: "select_account",
    });
    return redirect(`${AUTH_URL}?${params.toString()}`, 302);
  });

  router.get("/auth/callback", async (ctx) => {
    if (!googleOAuthEnabled()) return redirect("/login");
    const cookies = parseCookies(ctx.req);
    const expectedState = cookies.oauth_state;
    const verifier = cookies.oauth_verifier;
    const next = safeNext(cookies.oauth_next ?? "/");

    // Always clear temp cookies.
    ctx.setCookie(clearTemp("oauth_state"));
    ctx.setCookie(clearTemp("oauth_verifier"));
    ctx.setCookie(clearTemp("oauth_next"));

    const code = ctx.query.get("code");
    const state = ctx.query.get("state");
    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      return redirect("/login?error=state");
    }

    // Exchange the code for tokens (PKCE).
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    }).catch(() => null);

    if (!tokenRes || !tokenRes.ok) return redirect("/login?error=token");
    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) return redirect("/login?error=token");

    const claims = decodeJwtPayload(tokens.id_token);
    if (!claims || !validClaims(claims)) return redirect("/login?error=claims");

    const user = upsertOAuthUser({
      provider: "google",
      subject: claims.sub!,
      email: claims.email!,
      displayName: claims.name ?? claims.email!,
      avatarUrl: claims.picture ?? null,
    });
    migrateChatSession(ctx.guestRef, user.id);
    ctx.setCookie(createSession(user.id).cookie);
    return redirect(next);
  });
}
