/** Chat web routes: GET /chat, POST /chat/send (text + Nequi proof). */
import type { Router, RouteContext } from "../core/router.ts";
import { html, fragment, notFound } from "../core/http.ts";
import { saveImage } from "../core/uploads.ts";
import { tooMany } from "../core/ratelimit.ts";
import { flagEnabled } from "../modules/feature-flags/feature-flags.rules.ts";
import { ordersRepo } from "../modules/orders/orders.db.ts";
import { cartCount } from "../storefront/cart.service.ts";
import { chatRepo, type ChatChannel } from "./chat.history.ts";
import { generateResponse } from "./chat.service.ts";
import { chatPage, messageBubble, composerReset } from "./chat.web.views.ts";

const PROOFS_DIR = "data/uploads/proofs";

function identity(ctx: RouteContext): { channel: ChatChannel; ref: string; userId: string | null } {
  if (ctx.user) return { channel: "auth", ref: ctx.user.id, userId: ctx.user.id };
  return { channel: "web_guest", ref: ctx.guestRef, userId: null };
}

export function registerChatWebRoutes(router: Router): void {
  router.get("/chat", (ctx) => {
    if (!flagEnabled("chat_web")) return notFound("El asistente no está disponible por ahora.");
    const { ref } = identity(ctx);
    return html(chatPage(ctx.user, chatRepo.recent(ref, 30), cartCount(ctx.guestRef)));
  });

  router.post("/chat/send", async (ctx) => {
    if (!flagEnabled("chat_web")) return notFound("El asistente no está disponible.");
    const limited = tooMany(ctx, "chat-send", 30, 60_000);
    if (limited) return limited;
    const { channel, ref, userId } = identity(ctx);
    const form = await ctx.req.formData();
    const text = String(form.get("text") ?? "").trim();
    const file = form.get("proof");

    // Payment proof attached (handled OUTSIDE the LLM, tech-spec §14.7).
    if (file instanceof File && file.size > 0) {
      const result = await saveImage(file, PROOFS_DIR);
      if (!result.ok) {
        return fragment(
          messageBubble({ role: "assistant", content: `No pude procesar la imagen: ${result.error}`, attachment_url: null }) +
            composerReset(),
        );
      }
      const order = ordersRepo.latestPendingForRef(ctx.guestRef, userId);
      const userContent = text || "Envié mi comprobante de pago.";
      let attachmentUrl: string | null = null;
      let reply: string;
      if (order) {
        ordersRepo.attachProof(order.id, result.filename!);
        attachmentUrl = `/orden/${order.id}/comprobante`;
        reply = `¡Recibimos tu comprobante del pedido ${order.payment_ref}! Un asesor validará el pago y te avisaremos. 🌿`;
      } else {
        reply = "Recibí tu imagen, pero no encontré un pedido pendiente de pago. Crea tu pedido en el checkout y vuelve a enviarme el comprobante.";
      }
      const userMsg = chatRepo.append({ ref, channel, role: "user", content: userContent, attachmentUrl, attachmentType: result.mime });
      chatRepo.append({ ref, channel, role: "assistant", content: reply });
      return fragment(
        messageBubble(userMsg) + messageBubble({ role: "assistant", content: reply, attachment_url: null }) + composerReset(),
      );
    }

    if (!text) return fragment(composerReset());

    const reply = await generateResponse({ channel, ref, text, userId });
    return fragment(
      messageBubble({ role: "user", content: text, attachment_url: null }) +
        messageBubble({ role: "assistant", content: reply, attachment_url: null }) +
        composerReset(),
    );
  });
}
