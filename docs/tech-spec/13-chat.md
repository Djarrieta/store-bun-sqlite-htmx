# §14 — AI assistant / Chat

Source of truth for the chat module, multi-channel messaging, tools, and payment proof via chat. For the detailed implementation guide, see [docs/chat.md](../../docs/chat.md).

## Architecture

A single service (`src/chat/chat.service.ts`) is the brain. It is invoked from multiple channels:

| Channel | Entry point |
| --- | --- |
| Web UI | `src/chat/chat.web.routes.ts` (HTMX, HTML fragments) |
| JSON API | `src/chat/chat.api.routes.ts` (`POST /api/chat`) |
| WhatsApp | `src/integrations/whatsapp/` (Cloud API webhook) |

Tools live in `src/chat/chat.tools.ts`. LLM access via `src/core/llm.ts`.

## Channels

| Channel | Auth | Notes |
| --- | --- | --- |
| `web_guest` | `guest_ref` cookie | Default for anonymous visitors |
| `auth` | Session (logged-in user) | Enables order-related tools |
| `whatsapp` | Verified phone only | Futuro; mismo backend LLM |
| `api` | Shared secret (`CHAT_API_SECRET`) | Server-to-server; guest-class only |

### Channel restrictions

- The **`api` channel** (server-to-server) **rejects `channel:'auth'`** and does **not** enable `auth`-only tools.
- `ref` in the API only groups the conversation, never grants access to a `user`'s orders.
- Authenticated channels arrive only through the web (session) or WhatsApp with a verified phone.
- A user can only see their own conversations (anti-IDOR).

## Chat tools

Customer-facing tools (curated, no free SQL): `query_products`, `query_categories`, `query_shipping`, `query_content`, `get_my_orders` (auth only), `get_order_status` (auth only).

Admin tools: NL → SQL over allowlisted analytics views (read-only, AST-parsed, no PII).

More tools are added as business needs evolve. See [docs/chat.md](../../docs/chat.md) for the current list.

### Tool security

- Tools do **not** receive `ref` or `user_id` — identity is resolved server-side.
- Customer tools are curated; no direct SQL access.
- Admin NL → SQL is restricted to allowlisted views, read-only connection, re-authorized by role at runtime.

## WhatsApp flow (futuro)

- Verified phone = user's `phone` in `users` table, confirmed via WhatsApp verification message.
- On receiving an image message from a verified phone: validate (magic bytes, size), store in private storage, record in chat with image metadata.
- On receiving text: pass to LLM with conversation history.

**Estado actual (v1):** solo se procesan mensajes de texto. La descarga de imágenes y la verificación de teléfono por WhatsApp están planificadas para futuro.

## Payment proof via chat

1. Customer sends proof image via chat (web or WhatsApp).
2. The image is **validated** (magic bytes/size) and **stored in private storage**.
3. The message is recorded in chat history with image metadata.
4. The assistant can optionally link the proof to an order (if `payment_ref` is in the conversation context).
5. Admin is notified for manual verification.

## NL → SQL analytics (admin)

- Admin can ask natural language questions.
- LLM generates SQL over prebuilt, read-only views (no PII).
- See [schema.md](07-data-model.md) for view definitions.
