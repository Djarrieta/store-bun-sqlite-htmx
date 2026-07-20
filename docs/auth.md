# Authentication and authorization

Source of truth: [tech-spec/12-auth.md](tech-spec/12-auth.md).

## Overview

The `src/auth/` subsystem combines **own cookie sessions** (`sessions` table) with **Google OAuth**. Every login method ends by creating a session in `sessions`, so the rest of the app does not care how the user logged in.

## Identity models

### Guest (default)

- Browsing, cart, and checkout work without an account.
- A single long-lived cookie `guest_ref` (UUID) identifies **cart, chat, and `orders.guest_ref`** at the same time.
- This lets a payment proof sent via chat be associated with the guest's order.

### Authenticated customer

- Optional Google OAuth account for order history and persistent chat.
- On first login a `user` with `role='customer'` is created or linked via `oauth_identities`.
- `migrateChatSession(guestRef, userId)` reassigns guest chat messages to the user and logs the mapping in `chat_migration_log`.

### Admin / staff

- Google OAuth + **email allowlist** (`ADMIN_ALLOWLIST`) and/or corporate domain.
- On first login of an allowlisted email, a `user` is created with the appropriate role.
- Roles live in the DB (`users.role`) and drive permissions via `can()`.

## OAuth / OIDC flow

Authorization Code + **PKCE** via `fetch` (no external OAuth library):

```
GET /login              → login page with "Sign in with Google"
GET /auth/google        → generate state + PKCE, set temporary cookies, redirect to Google
GET /auth/callback      → validate state, exchange code for tokens, validate id_token (sub, email, email_verified), upsert user + oauth_identity, create session, redirect
GET /logout             → destroy session, clear cookie
```

- Redirect URI registered in Google Cloud Console: `https://your-domain/auth/callback`.
- Open-redirect protection: validate `next` param (must start with `/` and not `//`).
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Max-Age` = session TTL.

## Session design

- Cookie carries a random opaque token (≥128 bits).
- DB stores only **SHA-256 of the token** in `sessions.id`.
- On read, hash the cookie and look up the row by hash in DB; security comes from opaque token + SHA-256, not from constant-time comparison.
- DB leak does **not** reveal valid session tokens.
- TTL validated on every read; expired rows cleaned up.

## Roles and permissions

Roles (v1): `admin`, `manager`, `sales`, `logistic`, `financial`, `customer`.

| Role | Access |
|------|--------|
| `admin` | Full control, including flags and users. |
| `manager` | Catalog, orders, shipping, content, reports. |
| `sales` | Orders (view/manage), no catalog deletion. |
| `logistic` | Inventory and order dispatch. |
| `financial` | Reports / analytics. |
| `customer` | No `/admin`; only profile, own orders, chat. |

### Permission model

- `can(user, moduleKey, action)` — deny-by-default.
- `requirePermission(ctx, moduleKey, action)` — route guard.
- Matrix defined in each module's `<n>.rules.ts` and registered with `registerPermissions()`.
- **Always check in two places**: hide the control in the view (`can()`) **and** return `forbidden()` in the route.

## Auth methods (v1)

| Method | Notes |
|--------|-------|
| Google OAuth (PKCE) | Authorization Code + PKCE via `fetch`; own session. Primary method. |
| `/dev-login` | Dev-only shortcut (env `DEV_LOGIN=1`). Bypasses Google. Rate-limited at app level (10/5min). |

OAuth is rate-limited at the Cloudflare edge; app-level rate limiting applies only to `/dev-login`.

## Files

- `src/auth/auth.db.ts` — users, sessions, oauth_identities tables; `User` type.
- `src/auth/auth.service.ts` — sessions, user upsert, account rules.
- `src/auth/oauth.google.ts` — Google OAuth/OIDC flow.
- `src/auth/auth.routes.ts` — `/login`, `/logout`, `/dev-login`, `/auth/google`, `/auth/callback`, `/account`.
- `src/auth/auth.views.ts` — login and `/account` screens.
