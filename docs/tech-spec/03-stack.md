# §3 — Tech stack

| Layer               | Technology                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| Runtime             | Bun                                                                     |
| HTTP framework      | Bun native (`Bun.serve`) or Hono (thin layer)                           |
| HTML generation     | Plain `.ts` functions returning strings (no JSX, no template engine)    |
| Client interactivity| HTMX + Hyperscript                                                      |
| Database            | SQLite via `bun:sqlite` (WAL mode)                                      |
| Auth                | Google OAuth manual (fetch + PKCE), custom sessions                    |
| LLM                 | OpenAI-compatible API (DeepSeek / OpenAI / Ollama swappable via env)   |
| Email               | Nodemailer or Brevo/SendGrid HTTP API                                   |
| File storage        | Local filesystem (`data/...`); optional cloud later                     |
| Migrations          | `PRAGMA user_version` with ordered `.ts` migrations                     |
| Deployment          | Docker on self-hosted server (port 4010)                                |
| External access     | Cloudflare Tunnel (`crista.click`)                                      |
| TypeScript          | Strict, zero build step, Bun runs `.ts` directly                       |
| Dependencies        | Zero runtime deps; `@types/bun`, `typescript`, and `husky` as dev deps |
