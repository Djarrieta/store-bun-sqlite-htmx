/** Chat web UI (tech-spec §14.4). Bubbles + composer (text + proof image). */
import { page } from "../components/layout.ts";
import { escapeHtml, escapeAttr } from "../core/http.ts";
import { registerCss } from "../components/registry.ts";
import type { User } from "../auth/auth.db.ts";
import { llmAvailable } from "../core/llm.ts";
import type { ChatMessage } from "./chat.history.ts";

registerCss(/* css */ `
.chat-wrap { max-width: 760px; margin: 0 auto; }
.chat-panel { display: flex; flex-direction: column; height: min(70vh, 620px); }
.chat-log { flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
.bubble { max-width: 78%; padding: 0.7rem 0.95rem; border-radius: 0.9rem; line-height: 1.5; white-space: pre-wrap; }
.bubble--assistant { background: var(--card); color: var(--fg); align-self: flex-start; border-bottom-left-radius: 0.2rem; }
.bubble--user { background: var(--accent); color: var(--accent-foreground); align-self: flex-end; border-bottom-right-radius: 0.2rem; }
.bubble img { border-radius: 0.5rem; margin-top: 0.4rem; max-width: 200px; }
.chat-composer { display: flex; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.85rem; margin-top: 0.5rem; align-items: center; }
.chat-composer .input { flex: 1; }
.chat-attach { position: relative; overflow: hidden; }
.chat-attach input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
`);

export function messageBubble(m: Pick<ChatMessage, "role" | "content" | "attachment_url">): string {
  const attach = m.attachment_url
    ? `<a href="${escapeAttr(m.attachment_url)}" target="_blank" rel="noopener"><img src="${escapeAttr(m.attachment_url)}" alt="comprobante"></a>`
    : "";
  return `<div class="bubble bubble--${m.role === "user" ? "user" : "assistant"}">${escapeHtml(m.content)}${attach}</div>`;
}

/** Empty composer input returned out-of-band to clear it after sending. */
export function composerReset(): string {
  return `<input id="chat-input" class="input" name="text" placeholder="Escribe tu pregunta…" autocomplete="off" hx-swap-oob="true">`;
}

export function chatBubbles(messages: ChatMessage[]): string {
  return messages.map((m) => messageBubble(m)).join("");
}

export function chatPage(user: User | null, history: ChatMessage[], cartCount: number): string {
  const greeting = `<div class="bubble bubble--assistant">¡Hola! Soy el asistente de CRISTA. Pregúntame por productos, envíos, pagos${user ? " o el estado de tus pedidos" : ""}.${llmAvailable() ? "" : ""}</div>`;
  const body = `
    <div class="chat-wrap">
      <h1>Asistente</h1>
      <div class="panel chat-panel">
        <div id="chat-log" class="chat-log">
          ${greeting}
          ${chatBubbles(history)}
        </div>
        <form class="chat-composer" hx-post="/chat/send" hx-target="#chat-log" hx-swap="beforeend"
          hx-encoding="multipart/form-data">
          <label class="btn btn--outline btn--sm chat-attach" title="Adjuntar comprobante">📎
            <input type="file" name="proof" accept="image/jpeg,image/png,image/webp">
          </label>
          <input id="chat-input" class="input" name="text" placeholder="Escribe tu pregunta…" autocomplete="off">
          <button type="submit" class="btn">Enviar</button>
        </form>
      </div>
      <p class="muted" style="font-size:0.82rem;text-align:center;margin-top:0.75rem">Puedes adjuntar el comprobante de tu pago Nequi con el clip 📎.</p>
    </div>`;
  return page({ title: "Asistente", user, active: "chat", cartCount, body });
}
