# §13 — Authentication and authorization

Source of truth for users, sessions, OAuth, roles, and permissions.

## Authentication methods

| Method | Provider | Notes |
| --- | --- | --- |
| Google OAuth (PKCE) | Google via fetch + PKCE | Primary and only active method in v1 |
| `/dev-login` | Dev-only shortcut (`DEV_LOGIN=1`). Rate-limited. |

## Session management

- Random opaque token (>=128 bits) in an HTTP-only cookie.
- **Only the SHA-256 hash** of the token is stored in the `sessions` table.
- On read: hash the cookie value and look up the row by hash in DB; security comes from opaque token + SHA-256, not from constant-time comparison.
- TTL validated on every read; expired rows cleaned up.

## Roles

Roles in v1: `admin`, `manager`, `sales`, `logistic`, `financial`, `customer`.

| Role | Access |
| --- | --- |
| `admin` | Full control, including flags and users |
| `manager` | Catalog, orders, shipping, content, reports |
| `sales` | Orders (view/manage), no catalog deletion |
| `logistic` | Inventory and order dispatch |
| `financial` | Reports / analytics |
| `customer` | No `/admin`; only profile, own orders, chat |

Exact role assignments per module are defined in each module's `<n>.rules.ts` permission matrix.

## Guard pattern

Every protected route uses:

```typescript
const guard = await requirePermission(ctx, MODULE_KEY, action);
if (guard instanceof Response) return guard; // 302 redirect or 403
```

## OAuth / OIDC flow (Google)

Authorization Code + **PKCE** via `fetch` (no external OAuth library):

```
GET /login              → login page with "Sign in with Google"
GET /auth/google        → generate state + PKCE, set temp cookies, redirect to Google
GET /auth/callback      → validate state, exchange code, validate id_token, upsert user, create session
GET /logout             → destroy session, clear cookie
```

- Open-redirect protection: validate `next` param (must start with `/` and not `//`).
- Admin access: email allowlist (`ADMIN_ALLOWLIST`) and/or corporate domain.
- On first login of an allowlisted email, a `user` is created with the appropriate role.
