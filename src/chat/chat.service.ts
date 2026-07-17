/**
 * Chat service — the shared brain (tech-spec §14.3). Invoked by the web UI,
 * /api/chat (F7) and the WhatsApp webhook (F7). Runs a tool-calling loop against
 * the swappable LLM (core/llm.ts). When no LLM is configured it falls back to a
 * deterministic responder so the assistant still works. Always replies in Spanish.
 */
import { chatComplete, llmAvailable, type LlmMessage } from "../core/llm.ts";
import { categoriesRepo } from "../modules/categories/categories.db.ts";
import { chatRepo, type ChatChannel } from "./chat.history.ts";
import { toolSpecsFor, runTool, type ToolContext } from "./chat.tools.ts";

const MAX_STEPS = 4;

export interface GenerateParams {
  channel: ChatChannel;
  ref: string;
  text: string;
  userId: string | null;
  /** When false, the caller persists messages itself. Defaults to true. */
  persist?: boolean;
}

function systemPrompt(channel: ChatChannel): string {
  const cats = categoriesRepo
    .listAll()
    .map((c) => c.name)
    .join(", ");
  const guestNote =
    channel === "auth"
      ? "El usuario tiene sesión iniciada; puedes consultar sus pedidos con las herramientas correspondientes."
      : "El usuario es invitado (sin sesión). No puede consultar pedidos; si lo pide, invítalo a iniciar sesión.";
  return [
    "Eres el asistente de CRISTA, una tienda de ropa de origen natural en Colombia.",
    "Respondes SIEMPRE en español, con tono cercano y breve.",
    "Usa las herramientas para consultar catálogo, categorías, envíos, contenido y pedidos; no inventes datos.",
    "Los precios están en pesos colombianos (COP). El pago es manual por Nequi.",
    cats ? `Categorías disponibles: ${cats}.` : "",
    guestNote,
  ]
    .filter(Boolean)
    .join(" ");
}

async function runLlmLoop(params: GenerateParams): Promise<string> {
  const ctx: ToolContext = { channel: params.channel, ref: params.ref, userId: params.userId };
  const history = chatRepo.recent(params.ref, 12).map<LlmMessage>((m) => ({ role: m.role, content: m.content }));
  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt(params.channel) },
    ...history,
    { role: "user", content: params.text },
  ];
  const specs = toolSpecsFor(params.channel);

  for (let step = 0; step < MAX_STEPS; step++) {
    const result = await chatComplete(messages, specs);
    if (result.toolCalls.length === 0) {
      return result.content || "¿En qué más puedo ayudarte?";
    }
    // Echo the assistant tool-call turn, then append each tool result.
    messages.push({
      role: "assistant",
      content: result.content ?? "",
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    });
    for (const call of result.toolCalls) {
      const output = runTool(call.name, call.arguments, ctx);
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: output });
    }
  }
  // Ran out of steps; ask the model for a final answer without tools.
  const final = await chatComplete(messages);
  return final.content || "¿En qué más puedo ayudarte?";
}

/** Deterministic fallback used when no LLM key is configured. */
function fallbackReply(params: GenerateParams): string {
  const ctx: ToolContext = { channel: params.channel, ref: params.ref, userId: params.userId };
  const t = params.text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("hola", "buenas", "buenos días", "buenas tardes") && t.length < 30) {
    return "¡Hola! Soy el asistente de CRISTA. Puedo ayudarte con el catálogo, categorías, envíos, pagos y (si inicias sesión) tus pedidos. ¿Qué buscas?";
  }
  if (has("categor")) return runTool("query_categories", {}, ctx);
  if (has("env", "domicilio", "entrega")) return runTool("query_shipping", {}, ctx);
  if (has("pago", "nequi", "pagar")) return runTool("query_content", { key: "pagos_envios" }, ctx);
  if (has("pedido", "orden", "cr-", "seguimiento")) {
    const ref = params.text.match(/CR-[0-9A-Za-z]{6,}/i)?.[0];
    if (ref) return runTool("get_order_status", { order_ref: ref }, ctx);
    return runTool("get_my_orders", {}, ctx);
  }
  if (has("nosotros", "quiénes", "quienes", "marca")) return runTool("query_content", { key: "nosotros" }, ctx);
  // Default: treat as a product query. Try a search; if nothing, list the catalog.
  const search = params.text.replace(/[¿?¡!.]/g, "").trim();
  let products = runTool("query_products", { search }, ctx);
  if (products.startsWith("No encontré")) products = runTool("query_products", {}, ctx);
  if (!products.startsWith("No encontré")) return `Esto encontré:\n${products}`;
  return "Puedo ayudarte con el catálogo (productos, categorías), envíos, pagos por Nequi y tus pedidos si inicias sesión. ¿Sobre qué te ayudo?";
}

export async function generateResponse(params: GenerateParams): Promise<string> {
  const persist = params.persist !== false;
  if (persist) {
    chatRepo.append({ ref: params.ref, channel: params.channel, role: "user", content: params.text });
  }

  let reply: string;
  try {
    reply = llmAvailable() ? await runLlmLoop(params) : fallbackReply(params);
  } catch (err) {
    console.error("[chat] LLM error, using fallback:", err);
    reply = fallbackReply(params);
  }

  if (persist) {
    chatRepo.append({ ref: params.ref, channel: params.channel, role: "assistant", content: reply });
  }
  return reply;
}
