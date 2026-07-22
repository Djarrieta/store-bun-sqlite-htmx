/** Chat conversations viewer admin views — read-only. */
import { adminShell } from "../../views.ts";
import { escapeHtml, escapeAttr } from "../../core/http.ts";
import { can } from "../../core/permissions.ts";
import { dataTable, dataTableList, dataRow } from "../../components/table.ts";
import { registerCss } from "../../components/registry.ts";
import type { Page } from "../../core/repository.ts";
import type { User } from "../../auth/auth.db.ts";
import { CHAT_VIEWER_KEY } from "./chat-viewer.rules.ts";
import type { Conversation, ChatViewerMessage } from "./chat-viewer.db.ts";

registerCss(/* css */ `
.chat-thread { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem 0; }
.chat-msg { padding: 0.65rem 0.9rem; border-radius: 0.6rem; line-height: 1.45; }
.chat-msg--user { background: var(--accent); color: var(--accent-foreground); align-self: flex-end; max-width: 75%; border-bottom-right-radius: 0.15rem; }
.chat-msg--assistant { background: var(--card); color: var(--fg); align-self: flex-start; max-width: 75%; border-bottom-left-radius: 0.15rem; }
.chat-msg__role { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; opacity: 0.7; margin-bottom: 0.2rem; }
.chat-msg__content { white-space: pre-wrap; }
.chat-msg__time { font-size: 0.72rem; opacity: 0.55; margin-top: 0.25rem; }
`);

const BASE = "/admin/conversaciones";

const CHANNEL_LABELS: Record<string, string> = {
  auth: "Autenticado",
  web_guest: "Visitante web",
  whatsapp: "WhatsApp",
};

function channelBadge(channel: string): string {
  const label = CHANNEL_LABELS[channel] ?? channel;
  return `<span class="badge">${escapeHtml(label)}</span>`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function listFragment(user: User, pageData: Page<Conversation>, q: string, channel: string): string {
  const extra: Record<string, string> = {};
  if (channel) extra.channel = channel;

  return dataTableList({
    items: pageData.items,
    page: pageData.page,
    totalPages: pageData.totalPages,
    baseUrl: BASE,
    searchQuery: q,
    extraParams: extra,
    renderRow: (c) => dataRow({
      title: `<a href="${BASE}/${escapeAttr(c.ref)}?channel=${escapeAttr(c.channel)}" style="color:inherit;text-decoration:none">${escapeHtml(c.ref.slice(0, 12))}…</a>`,
      meta: `${channelBadge(c.channel)} · ${c.msg_count} mensaje${c.msg_count !== 1 ? "s" : ""} · Último: ${formatTime(c.last_at)}`,
      actions: `<a class="btn btn--outline btn--sm" href="${BASE}/${escapeAttr(c.ref)}?channel=${escapeAttr(c.channel)}">Ver</a>`,
    }),
    emptyText: "No hay conversaciones.",
  });
}

export function listPage(user: User, pageData: Page<Conversation>, q: string, channel: string): string {
  const channels = ["", "auth", "web_guest", "whatsapp"];

  const channelLinks = channels.map((ch) => {
    const label = ch ? (CHANNEL_LABELS[ch] ?? ch) : "Todas";
    const active = ch === channel ? " is-active" : "";
    const params = ch ? `?channel=${ch}` : "";
    return `<a class="admin-tab${active}" href="${BASE}${params}">${label}</a>`;
  }).join("");

  const body = `
    <div class="panel">
      <div style="margin-bottom:1rem">
        <h1 style="margin:0 0 0.5rem">Conversaciones</h1>
        <div class="row" style="gap:0.25rem;margin-bottom:1rem">${channelLinks}</div>
      </div>
      ${dataTable({
        items: pageData.items,
        page: pageData.page,
        totalPages: pageData.totalPages,
        baseUrl: BASE,
        searchQuery: q,
        searchPlaceholder: "Buscar por ref…",
        extraParams: channel ? { channel } : undefined,
        renderRow: (c) => dataRow({
          title: `<a href="${BASE}/${escapeAttr(c.ref)}?channel=${escapeAttr(c.channel)}" style="color:inherit;text-decoration:none">${escapeHtml(c.ref.slice(0, 12))}…</a>`,
          meta: `${channelBadge(c.channel)} · ${c.msg_count} mensaje${c.msg_count !== 1 ? "s" : ""} · Último: ${formatTime(c.last_at)}`,
          actions: `<a class="btn btn--outline btn--sm" href="${BASE}/${escapeAttr(c.ref)}?channel=${escapeAttr(c.channel)}">Ver</a>`,
        }),
        emptyText: "No hay conversaciones.",
      })}
    </div>`;
  return adminShell({ user, active: CHAT_VIEWER_KEY, title: "Conversaciones", body });
}

export function threadFragment(user: User, meta: Conversation, messages: ChatViewerMessage[]): string {
  const rows = messages.map((m) => {
    const role = m.role === "assistant" ? "asistente" : "cliente";
    const roleClass = m.role === "assistant" ? "chat-msg--assistant" : "chat-msg--user";
    const content = escapeHtml(m.content).replace(/\n/g, "<br>");
    return `<div class="chat-msg ${roleClass}">
      <div class="chat-msg__role">${role}</div>
      <div class="chat-msg__content">${content}</div>
      <div class="chat-msg__time">${formatTime(m.created_at)}</div>
    </div>`;
  }).join("");

  return `
    <a class="btn btn--outline btn--sm" href="${BASE}" style="margin-bottom:1rem">← Volver</a>
    <div class="panel">
      <div style="margin-bottom:1rem">
        <span style="font-weight:600">${escapeHtml(meta.ref.slice(0, 12))}…</span>
        ${channelBadge(meta.channel)}
        <span class="muted" style="margin-left:0.5rem">${meta.msg_count} mensaje${meta.msg_count !== 1 ? "s" : ""}</span>
      </div>
      <div class="chat-thread">${rows || '<p class="muted">No hay mensajes.</p>'}</div>
    </div>`;
}

export function threadPage(user: User, meta: Conversation, messages: ChatViewerMessage[]): string {
  const body = threadFragment(user, meta, messages);
  return adminShell({ user, active: CHAT_VIEWER_KEY, title: `Conversación ${meta.ref.slice(0, 12)}`, body });
}
