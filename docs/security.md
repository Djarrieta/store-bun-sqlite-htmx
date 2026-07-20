# Security

Source of truth: [tech-spec/15-security.md](tech-spec/15-security.md). This is a checklist, not an optional guide.

## Transport

- HTTPS terminated at Cloudflare.
- App listens on `127.0.0.1` only.
- Cookies `Secure` in production.
- HSTS at Cloudflare.

## Sessions

- Cookie `HttpOnly` + `SameSite=Lax`.
- Opaque token hashed with SHA-256 in DB; never store token plaintext.
- Constant-time comparison on lookup.
- Validate TTL on every read; clean expired rows.
- See `docs/auth.md`.

## OAuth

- `state` + PKCE.
- Validate `id_token` (`sub`, `email_verified`).
- Admin allowlist.
- See `docs/auth.md`.

## XSS

- Escape every user-controlled value with `escapeHtml()` (text) or `escapeAttr()` (attributes) from `src/core/http.ts`.
- No unescaped interpolation in views.
- CSP restrictive (`default-src 'self'`; sin `unsafe-inline` en scripts; `frame-ancestors 'none'`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

## CSRF

- Cookies `SameSite=Lax` (primera línea de defensa).
- **v1 actual**: No se implementan tokens CSRF. El patrón POST-redirect en formularios mutantes mitiga la mayoría de ataques CSRF básicos.
- **Implementación futura**: Generar token por sesión, incluir `csrfField()` en todos los formularios mutantes (checkout, admin, `/chat/send`, carga de comprobantes), validar en cada POST/PUT/DELETE.
- Webhooks y `/api/chat` usan firma/secret en lugar de cookies.

## SQL injection

- Parameterized queries only; bind `$name`.
- Never interpolate user input into SQL strings.
- Repository methods accept parameters, not raw SQL from handlers.
- Admin reports use read-only connection + AST-parsed SQL + allowlisted views.

## Authorization

- `can()` in view to hide controls.
- `requirePermission()` in route to enforce.
- Deny-by-default.
- User-scoped repositories filter by `user_id` / `guest_ref`.

## Uploads

- Validate real file type by **magic bytes**, not `Content-Type` or extension.
- Allowlist raster only: `image/jpeg`, `image/png`, `image/webp`.
- **Reject SVG** (scriptable).
- Enforce max size.
- **Re-encode no implementado en v1**: solo se validan magic bytes + allowlist de formato raster. Re-encode con sharp/libvips es mejora futura para strip EXIF y normalizar.
- App-generated filename (hash/UUID); never use the original name.
- Anti path-traversal: no `/` in resolved filename.
- Serve with `X-Content-Type-Options: nosniff`.

## Payment proofs

- Store outside `public/` (e.g. `data/uploads/proofs/`).
- Never serve as static files.
- Serve only via guarded route (`GET /orden/:id/comprobante`).
- Allow only order owner (by session/guest_ref) or admin with order permission.
- `Cache-Control: private, no-store`.
- Do not cache at the edge.

## Payments

- Manual Nequi verification by staff in v1.
- Recalculate totals server-side; do not trust client amounts.
- Deduct stock idempotently when moving to `paid`.
- Future Wompi: integrity signature + webhook signature + server-side confirmation.

## Webhooks

- WhatsApp: verify `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET`; reject if mismatch.
- Future Wompi: verify `signature.checksum` with `WOMPI_EVENTS_SECRET`.

## Chat

- Tools never receive `ref`/`user_id`; identity resolved server-side.
- Guest channels cannot use order tools.
- Admin NL→SQL is read-only over allowlisted analytics views (no PII).
- `/api/chat` operates as guest class even with shared secret.
- Payment proofs are handled outside the LLM; image not sent to the model.
- Rate limiting at Cloudflare and app level.

## Secrets

- Live in `.env` (git-ignored).
- `deploy/credentials.json` (Cloudflare Tunnel secrets) in `.gitignore`.
- Never commit secrets.

## Sensitive data

- `password_hash`, `sessions`, `oauth_identities`, and customer PII are never exposed to chat or reports.
- Analytics views exclude them by construction.

## Non-negotiables summary

| Area | Rule |
|------|------|
| Auth | `requirePermission()` first in every admin handler. |
| SQL | Parameterized binds only. |
| Output | `escapeHtml()` / `escapeAttr()` for all user data. |
| Uploads | Magic bytes + raster allowlist + app-generated filename. |
| Proofs | Private storage + owner/admin guard. |
| Chat | Identity server-side; no SQL generation for customers. |
