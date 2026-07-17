/**
 * Reusable JSON chat endpoint POST /api/chat (tech-spec §14.4).
 * Server-to-server, GUEST CLASS ONLY: authenticated by a shared secret that does
 * NOT identify a user, so it must never enable auth-only tools nor accept
 * channel:'auth' (anti-IDOR §14.8).
 */
import type { Router } from "../core/router.ts";
import { json } from "../core/http.ts";
import { tooMany } from "../core/ratelimit.ts";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.ts";
import { generateResponse } from "./chat.service.ts";
import type { ChatChannel } from "./chat.history.ts";

function bearerOk(header: string | null): boolean {
  const secret = config.chatApiSecret;
  if (!secret) return false;
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice(7);
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function registerChatApiRoutes(router: Router): void {
  router.post("/api/chat", async (ctx) => {
    if (!config.chatApiSecret) return json({ error: "disabled" }, { status: 503 });
    const limited = tooMany(ctx, "api-chat", 60, 60_000);
    if (limited) return json({ error: "rate_limited" }, { status: 429 });
    if (!bearerOk(ctx.req.headers.get("authorization"))) return json({ error: "unauthorized" }, { status: 401 });

    let payload: { channel?: string; ref?: string; message?: string };
    try {
      payload = (await ctx.req.json()) as typeof payload;
    } catch {
      return json({ error: "invalid_json" }, { status: 400 });
    }

    // Reject any attempt to act as an authenticated user.
    if (payload.channel === "auth") {
      return json({ error: "channel_not_allowed" }, { status: 403 });
    }
    const message = String(payload.message ?? "").trim();
    if (!message) return json({ error: "empty_message" }, { status: 400 });

    // Always guest class; `ref` only groups the conversation, never grants account access.
    const channel: ChatChannel = payload.channel === "whatsapp" ? "whatsapp" : "web_guest";
    const ref = String(payload.ref ?? crypto.randomUUID());

    const reply = await generateResponse({ channel, ref, text: message, userId: null });
    return json({ reply });
  });
}
