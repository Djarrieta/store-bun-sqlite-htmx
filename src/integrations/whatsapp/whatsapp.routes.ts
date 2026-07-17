/** WhatsApp webhook routes (tech-spec §14.5). */
import type { Router } from "../../core/router.ts";
import { forbidden } from "../../core/http.ts";
import { usersRepo } from "../../auth/auth.db.ts";
import { flagEnabled } from "../../modules/feature-flags/feature-flags.rules.ts";
import { generateResponse } from "../../chat/chat.service.ts";
import type { ChatChannel } from "../../chat/chat.history.ts";
import { verifyChallenge, verifySignature, extractInbound, sendMessage } from "./whatsapp.ts";

function ok(): Response {
  return new Response("ok", { status: 200 });
}

export function registerWhatsappRoutes(router: Router): void {
  // Verification handshake.
  router.get("/api/whatsapp/webhook", (ctx) => {
    const challenge = verifyChallenge(
      ctx.query.get("hub.mode"),
      ctx.query.get("hub.verify_token"),
      ctx.query.get("hub.challenge") ?? "",
    );
    if (challenge === null) return forbidden("verification failed");
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  });

  // Inbound messages.
  router.post("/api/whatsapp/webhook", async (ctx) => {
    const raw = await ctx.req.text();
    if (!verifySignature(raw, ctx.req.headers.get("x-hub-signature-256"))) {
      return forbidden("invalid signature");
    }
    if (!flagEnabled("whatsapp")) return ok();

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return ok();
    }
    const inbound = extractInbound(payload);
    if (inbound) {
      // Verified phone -> auth channel; otherwise guest (tech-spec §14.5).
      const user = usersRepo.findByPhone(inbound.from);
      const channel: ChatChannel = user ? "auth" : "whatsapp";
      const ref = user ? user.id : `wa:${inbound.from}`;
      const reply = await generateResponse({ channel, ref, text: inbound.text, userId: user?.id ?? null });
      await sendMessage(inbound.from, reply);
    }
    return ok();
  });
}
