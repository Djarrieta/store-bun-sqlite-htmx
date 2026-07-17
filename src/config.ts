/**
 * Typed environment configuration. Bun autoloads `.env`.
 * Single source of truth for env-derived settings.
 */

function str(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function list(name: string): string[] {
  return str(name)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const config = {
  port: int("PORT", 4010),
  nodeEnv: str("NODE_ENV", "development"),
  isProd: str("NODE_ENV", "development") === "production",
  publicBaseUrl: str("PUBLIC_BASE_URL", "http://localhost:4010"),

  // Auth
  devLogin: bool("DEV_LOGIN", false),
  google: {
    clientId: str("GOOGLE_CLIENT_ID"),
    clientSecret: str("GOOGLE_CLIENT_SECRET"),
    redirectUri: str("OAUTH_REDIRECT_URI"),
  },
  adminAllowlist: list("ADMIN_ALLOWLIST"),

  // LLM (DeepSeek, OpenAI-compatible; provider swappable)
  llm: {
    apiKey: str("DEEPSEEK_API_KEY"),
    model: str("DEEPSEEK_MODEL", "deepseek-chat"),
    baseUrl: str("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
  },

  // Payments (v1 Nequi manual)
  nequi: {
    number: str("NEQUI_NUMBER"),
    qrUrl: str("NEQUI_QR_URL"),
  },

  // WhatsApp Cloud API
  whatsapp: {
    verifyToken: str("WHATSAPP_VERIFY_TOKEN"),
    appSecret: str("WHATSAPP_APP_SECRET"),
    token: str("WHATSAPP_TOKEN"),
    phoneNumberId: str("WHATSAPP_PHONE_NUMBER_ID"),
  },

  // Reusable chat endpoint
  chatApiSecret: str("CHAT_API_SECRET"),
} as const;

export function googleOAuthEnabled(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
}

export function llmEnabled(): boolean {
  return Boolean(config.llm.apiKey);
}
