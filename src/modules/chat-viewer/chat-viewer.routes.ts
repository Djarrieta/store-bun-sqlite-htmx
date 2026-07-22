/** Chat conversations admin routes — read-only viewer. */
import type { Router } from "../../core/router.ts";
import { html, fragment, notFound } from "../../core/http.ts";
import { requirePermission } from "../../auth/index.ts";
import { CHAT_VIEWER_KEY } from "./chat-viewer.rules.ts";
import { chatViewerRepo } from "./chat-viewer.db.ts";
import * as views from "./chat-viewer.views.ts";

const BASE = "/admin/conversaciones";

export function registerChatViewerRoutes(router: Router): void {
  router.get(BASE, (ctx) => {
    const user = requirePermission(ctx, CHAT_VIEWER_KEY, "view");
    if (user instanceof Response) return user;

    const q = ctx.query.get("q") ?? "";
    const channel = ctx.query.get("channel") ?? "";
    const pageNum = Number.parseInt(ctx.query.get("page") ?? "1", 10) || 1;

    const pageData = chatViewerRepo.listConversations({ page: pageNum, search: q || undefined, channel: channel || undefined });

    if (ctx.isHtmx) return fragment(views.listFragment(user, pageData, q, channel));
    return html(views.listPage(user, pageData, q, channel));
  });

  router.get(`${BASE}/:ref`, (ctx) => {
    const user = requirePermission(ctx, CHAT_VIEWER_KEY, "view");
    if (user instanceof Response) return user;

    const ref = ctx.params.ref!;
    const channel = ctx.query.get("channel") ?? "";

    const meta = chatViewerRepo.getConversationMeta(ref, channel);
    if (!meta) return notFound("Conversación no encontrada.");

    const messages = chatViewerRepo.getMessages(ref, channel);

    if (ctx.isHtmx) return fragment(views.threadFragment(user, meta, messages));
    return html(views.threadPage(user, meta, messages));
  });
}
