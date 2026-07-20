# Chat / AI assistant

Source of truth: [tech-spec/13-chat.md](tech-spec/13-chat.md).

## Architecture

A single service (`src/chat/chat.service.ts`) is the brain. It is invoked from:

- Web UI (`GET /chat`, `POST /chat/send`) — HTMX, returns HTML fragments.
- Reusable JSON endpoint (`POST /api/chat`).
- WhatsApp Cloud API webhook (`integrations/whatsapp/`).

One brain, multiple mouths.

## Channels and identity

| Channel | Identity (`ref`) | Storage |
|---------|------------------|---------|
| `auth` | `user_id` | `chat_messages` |
| `web_guest` | UUID in the `guest_ref` cookie | `chat_messages` |
| `whatsapp` | UUID derived/associated with the phone number | `chat_messages` |

## Security boundary: data access

### Customer channels (`auth`, `web_guest`, `whatsapp`)

Only **curated tools**. No free SQL.

| Tool | Description | Restriction |
|------|-------------|-------------|
| `query_products` | Catalog with stock (includes variants). | Public |
| `query_categories` | Categories. | Public |
| `query_shipping` | Rates by city + free threshold. | Public |
| `query_content(key)` | Content text by key. | Public |
| `get_my_orders()` | Current user's recent orders. | **Only `auth`** |
| `get_order_status(order_id)` | Status/tracking of the user's order. | **Only `auth`** |

**Identity is never exposed to the LLM (anti-IDOR).** No tool receives `ref` / `user_id` as an argument. Identity is injected server-side from the session when the handler runs. The model only supplies non-sensitive data (e.g. `order_id`); the handler validates server-side that the `order_id` belongs to the authenticated `ref` before returning anything.

Guest channels (`web_guest`, unverified WhatsApp) respond with "requires login" for `auth`-only tools.

### Admin channel (`reports`)

**NL→SQL read-only** via `core/readonly-sql.ts`:

- Separate read-only SQLite connection (`readonly: true` + `PRAGMA query_only`).
- Primary control = **positive allowlist on analytics VIEWS** (e.g. `v_orders`, `v_order_items`, `v_products`, `v_stock`), not base tables.
- Views exclude by construction: `users`, `sessions`, `oauth_identities`, `password_hash`, customer PII (phone/email/address).
- SQL is **parsed (AST)**, not string-filtered: require a single `SELECT`/`WITH` statement and reject references outside the view allowlist, plus `PRAGMA`/`ATTACH`/`sqlite_*`.
- Effective view allowlist is derived from the user's role **at execution time**, not at report creation time.
- Row limit (`MAX_REPORT_ROWS`) and query timeout to prevent DoS.
- Only roles with `reports` permission can use it. A customer never executes AI-generated SQL.

## Assistant loop

1. Build messages (system prompt + history + store snapshot).
2. Call LLM with `bindTools(TOOLS)`.
3. If `tool_calls`, execute handlers (with channel gate) and repeat.
4. Stop at `MAX_STEPS` or final response.

The LLM is accessed via `core/llm.ts`. Provider configurable por env (`LLM_PROVIDER`: `deepseek`, `openai`, `ollama`). Responses are always in Spanish (S1).

## Endpoints

| Route | Use | Auth |
|-------|-----|------|
| `GET /chat` | Chat UI (web). | Session or guest |
| `POST /chat/send` | Send message or image (payment proof); returns HTMX fragment. | Cookie session / `guest_ref` |
| `POST /api/chat` | Reusable JSON: `{ channel, ref, message } → { reply }`. | Shared secret (`Authorization: Bearer CHAT_API_SECRET`) |

### `/api/chat` semantics

This endpoint is **server-to-server, guest-class**:

- Rejects `channel: 'auth'`.
- Does **not** enable `auth`-only tools.
- `ref` only groups the conversation; it never grants access to another user's orders.

This prevents a secret holder from impersonating or reading other accounts.

## WhatsApp Cloud API

Inside `integrations/whatsapp/`:

### Verification

`GET /api/whatsapp/webhook`:

- Check `hub.mode=subscribe` and `hub.verify_token == WHATSAPP_VERIFY_TOKEN`.
- Respond with `hub.challenge`.

### Inbound messages

`POST /api/whatsapp/webhook`:

1. Verify `X-Hub-Signature-256` = HMAC-SHA256 of raw body with `WHATSAPP_APP_SECRET`.
2. Extract phone + text.
3. Resolve `ref` (UUID per phone; if the number is linked to a `user`, use channel `auth`).
4. `reply = await chatService.generateResponse({ channel: 'whatsapp', ref, text })`.
5. Send response via Graph API: `POST /{PHONE_NUMBER_ID}/messages` with `WHATSAPP_TOKEN`.

### Phone → account linking (futuro)

A number is associated with a `user` only after **verification**:

- From `/account` the customer registers their phone.
- The app sends a code via WhatsApp.
- The customer confirms the code.
- Only then is `users.phone` saved and the webhook treats that number as channel `auth`.

**Estado actual (v1):** el enlace es directo por `users.phone` sin verificación OTP. La verificación por WhatsApp está planificada para una versión futura.

## Persistence, history, and migration

- Each turn stores `user` and `assistant` messages in `chat_messages` by `ref` + `channel`.
- The prompt uses recent history per `ref`.
- **Guest→auth migration**: on login, `migrateChatSession(guestRef, userId)` reassigns guest messages to the user and logs the mapping in `chat_migration_log`.
- **Late WhatsApp linking**: if a number already migrated, the webhook uses the correct `user` by consulting `chat_migration_log`.

## Payment proof via chat (Nequi manual, v1)

The chat is one channel for the customer to send their Nequi transfer proof:

- **Web**: composer accepts an image attachment (`input file`, `hx-post` multipart). Available to guest and `auth`.
- **WhatsApp**: en v1 solo texto. La descarga de imágenes inbound vía Graph API está planificada para futuro.
- The image is validated (magic bytes/size) and stored in **private** storage.
- The message is recorded in `chat_messages` with `attachment_url` / `attachment_type` (internal reference, served by guard, not a public URL).
- If the `ref` has a `pending` order awaiting payment, the proof is attached as `payment_proof_url` and the order moves to `payment_review`.
- The assistant confirms receipt and informs the customer that an advisor will validate the payment.
- An **admin** verifies the proof in the `orders` module (→ `paid` + stock deduction).
- The image is handled **outside the LLM**; it is not sent to the model.

## Security summary

- Identity resolved server-side (anti-IDOR).
- Guests: order tools blocked.
- Customers: no AI-generated SQL.
- Admins: read-only SQL over allowlisted views, AST-parsed, read-only connection, re-authorized by role at runtime.
- `/api/chat`: shared secret; Cloudflare + app rate limits.
- Proofs: private storage with guard; image not sent to LLM.
- All web-rendered text passes through `escapeHtml()`.

## Files

- `src/chat/chat.service.ts` — shared brain (tools + LLM loop).
- `src/chat/chat.tools.ts` — curated customer tools.
- `src/chat/chat.history.ts` — persistence + guest→auth migration.
- `src/chat/chat.web.routes.ts` — web UI routes (`/chat`, `/chat/send`).
- `src/chat/chat.api.routes.ts` — `/api/chat` JSON endpoint.
- `src/integrations/whatsapp/` — webhook + Graph API send.
