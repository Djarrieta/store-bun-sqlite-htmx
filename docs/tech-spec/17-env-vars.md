# §17 — Environment variables

Source of truth for all required and optional env vars.

## Required

| Variable | Example | Description |
| --- | --- | --- |
| `PORT` | `4010` | HTTP server port |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Google OAuth client secret |
| `OAUTH_REDIRECT_URI` | `http://localhost:4010/auth/callback` | OAuth callback URL |

## Optional

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` / `production` |
| `PUBLIC_BASE_URL` | `http://localhost:${PORT}` | Public base URL used in links and OAuth |
| `CHAT_API_SECRET` | — | Shared secret for server-to-server chat API |
| `LLM_PROVIDER` | `deepseek` | LLM provider: `deepseek`, `openai`, `ollama` |
| `LLM_API_KEY` | — | LLM API key (overrides provider-specific key) |
| `LLM_MODEL` | — | LLM model name (overrides provider-specific model) |
| `LLM_BASE_URL` | — | LLM base URL (overrides provider-specific URL) |
| `DEEPSEEK_API_KEY` | — | DeepSeek API key (fallback if `LLM_API_KEY` not set) |
| `DEEPSEEK_MODEL` | `deepseek-chat` | DeepSeek model (fallback if `LLM_MODEL` not set) |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek base URL (fallback if `LLM_BASE_URL` not set) |
| `OPENAI_API_KEY` | — | OpenAI API key (fallback if `LLM_API_KEY` not set) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model (fallback if `LLM_MODEL` not set) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI base URL (fallback if `LLM_BASE_URL` not set) |
| `OLLAMA_API_KEY` | `ollama` | Ollama API key (usually not needed) |
| `OLLAMA_MODEL` | `llama3.1` | Ollama model (fallback if `LLM_MODEL` not set) |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama base URL (fallback if `LLM_BASE_URL` not set) |
| `DEV_LOGIN` | — | Set to `1` to enable `/dev-login` without Google OAuth |
| `ADMIN_ALLOWLIST` | — | Comma-separated admin emails for initial access |
| `NEQUI_NUMBER` | — | Nequi number shown for manual transfers |
| `NEQUI_QR_URL` | — | URL to the Nequi QR image |
| `WHATSAPP_VERIFY_TOKEN` | — | Meta WhatsApp webhook verify token |
| `WHATSAPP_APP_SECRET` | — | Meta WhatsApp app secret |
| `WHATSAPP_TOKEN` | — | Meta WhatsApp access token |
| `WHATSAPP_PHONE_NUMBER_ID` | — | Meta WhatsApp phone number ID |

## Future

These variables are reserved for upcoming features. They are not read by the current codebase.

| Variable | Feature | Description |
| --- | --- | --- |
| `SMTP_HOST` | Email notifications | Email SMTP host |
| `SMTP_PORT` | Email notifications | SMTP port |
| `SMTP_USER` | Email notifications | SMTP username |
| `SMTP_PASS` | Email notifications | SMTP password |
| `SMTP_FROM` | Email notifications | Sender email address |
| `WOMPI_PUBLIC_KEY` | Wompi payments | Wompi public key |
| `WOMPI_PRIVATE_KEY` | Wompi payments | Wompi private key |
| `WOMPI_INTEGRITY_SECRET` | Wompi payments | Wompi integrity secret |
| `SESSION_SECRET` | Signed sessions | Reserved if we move from opaque DB tokens to signed cookies |
