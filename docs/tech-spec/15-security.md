# §16 — Security

Source of truth for non-negotiable security rules. This is a checklist, not an optional guide.

## Authentication & sessions

- [ ] Sessions: token in cookie, SHA-256 in DB, lookup by hash.
- [ ] OAuth tokens never logged.
- [ ] Rate limit `/dev-login` attempts (10 per 5 min per IP). OAuth rate limiting delegated to Cloudflare edge.

## SQL

- [ ] All queries use parameterized binds (`$name`), never string interpolation.
- [ ] No raw user input in SQL strings — ever.
- [ ] Admin NL → SQL is read-only over allowlisted views, never over PII tables.

## CSRF

- **Current v1**: CSRF tokens are not implemented. Defense is based on `SameSite=Lax` in cookies + POST-redirect pattern in mutating forms.
- **Future implementation**: Generate per-session token, expose `csrfField()` in `src/components/forms.ts`, validate in all POST/PUT/DELETE. Cover checkout, admin, `/chat/send` and proof uploads.

## File uploads

- [ ] Validate **magic bytes** (file signature), not just extension.
- [ ] Allow only `image/jpeg`, `image/png`, `image/webp`.
- [ ] Max file size: 5 MB.
- [ ] Re-encode images (sharp/libvips) to strip EXIF and normalize — **not implemented in v1**. Currently only magic bytes + raster format allowlist are validated. Re-encode is a future improvement.
- [ ] Store with UUID filenames, never user-supplied names.
- [ ] Set `Content-Type` and `X-Content-Type-Options: nosniff` on served files.

## Payment proofs

- [ ] Proofs are **private** in `data/uploads/proofs/`.
- [ ] Served only via guarded endpoint (admin or order owner).
- [ ] Never served as public static files.
- [ ] Image is not sent to the LLM — metadata only.

## Chat

- [ ] Tools do not receive `ref` or `user_id` — identity resolved server-side.
- [ ] API channel (`CHAT_API_SECRET`) rejects `channel:'auth'` and `auth`-only tools.
- [ ] User can only see their own conversations (anti-IDOR).
- [ ] WhatsApp: only accept from verified phone numbers.

## HTTP headers

- [ ] `X-Content-Type-Options: nosniff` on all responses.
- [ ] `X-Frame-Options: DENY` on HTML responses.
- [ ] `Content-Security-Policy` with minimal allowlist (no `unsafe-inline` in scripts).
- [ ] `Strict-Transport-Security` — managed by Cloudflare Tunnel, not by the app.

## Environment

- [ ] Secrets (DB path, OAuth credentials, `CHAT_API_SECRET`) in `.env`, never in code.
- [ ] `.env` not committed to git.
- [ ] `deploy/credentials.json` (Cloudflare Tunnel secrets) in `.gitignore`.
- [ ] Production: rotate secrets periodically.

## Admin

- [ ] The `/admin` dashboard requires `role = 'admin'` (`requireAdmin`).
- [ ] Module routes under `/admin/*` require a staff role + per-module permission (`requirePermission`).
- [ ] Guard pattern: `if (guard instanceof Response) return guard;`
- [ ] No direct user access to analytics views — only through the admin NL → SQL interface.
