/**
 * Curated chat tools (tech-spec §14.2, §14.8). SECURITY:
 * - Tools NEVER receive `ref`/`user_id` as arguments. Identity is injected
 *   server-side via ToolContext (closure over the request), so a prompt injection
 *   cannot read another account's data.
 * - Order tools are AUTH-only; guests get "requiere iniciar sesión".
 * - Handlers re-validate ownership server-side before returning anything.
 */
import type { LlmToolSpec } from "../core/llm.ts";
import { formatCop } from "../core/format.ts";
import { productsRepo, effectivePriceCents } from "../modules/products/products.db.ts";
import { variantsRepo } from "../modules/variants/variants.db.ts";
import { categoriesRepo } from "../modules/categories/categories.db.ts";
import { shippingRepo } from "../modules/shipping/shipping.db.ts";
import { contentRepo } from "../modules/content/content.db.ts";
import { ordersRepo, type Order } from "../modules/orders/orders.db.ts";
import type { ChatChannel } from "./chat.history.ts";

export interface ToolContext {
  channel: ChatChannel;
  /** Server-side identity. NEVER exposed to the model. */
  ref: string;
  userId: string | null;
}

export interface ChatTool {
  spec: LlmToolSpec;
  authOnly: boolean;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => string;
}

const STATUS_ES: Record<string, string> = {
  pending: "pendiente de pago",
  payment_review: "verificando pago",
  paid: "pagado",
  preparing: "en preparación",
  shipped: "enviado",
  delivered: "entregado",
  cancelled: "cancelado",
  refunded: "reembolsado",
};

function describeProduct(p: { id: string; title: string; price_cents: number; discount_pct: number }): string {
  const variants = variantsRepo.listActiveByProduct(p.id);
  const price = formatCop(effectivePriceCents(p.price_cents, p.discount_pct));
  const stock = variants.map((v) => `${v.name} (${v.stock > 0 ? `${v.stock} disp.` : "agotado"})`).join(", ");
  return `• ${p.title} — ${price}${stock ? ` — ${stock}` : ""}`;
}

export const TOOLS: ChatTool[] = [
  {
    authOnly: false,
    spec: {
      name: "query_products",
      description: "Busca productos del catálogo (con precio y stock por variante).",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texto a buscar (nombre, etiqueta)." },
          category: { type: "string", description: "Slug de categoría opcional." },
        },
      },
    },
    handler: (args) => {
      const category = args.category ? categoriesRepo.findBySlug(String(args.category)) : null;
      const page = productsRepo.listPublic({
        search: args.search ? String(args.search) : undefined,
        categoryId: category?.id,
      });
      const items = page.items.slice(0, 8);
      if (items.length === 0) return "No encontré productos que coincidan.";
      return items.map(describeProduct).join("\n");
    },
  },
  {
    authOnly: false,
    spec: {
      name: "query_categories",
      description: "Lista las categorías disponibles.",
      parameters: { type: "object", properties: {} },
    },
    handler: () => {
      const cats = categoriesRepo.listAll();
      if (cats.length === 0) return "No hay categorías.";
      return cats.map((c) => `• ${c.name} (${c.slug})`).join("\n");
    },
  },
  {
    authOnly: false,
    spec: {
      name: "query_shipping",
      description: "Consulta tarifas de envío por ciudad y el umbral de envío gratis.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "Ciudad opcional a consultar." } },
      },
    },
    handler: (args) => {
      const rates = shippingRepo.listRates();
      const config = shippingRepo.getConfig();
      const free = config.free_above_cents !== null ? `Envío gratis desde ${formatCop(config.free_above_cents)}. ` : "";
      const filtered = args.city
        ? rates.filter((r) => r.city.toLowerCase().includes(String(args.city).toLowerCase()))
        : rates;
      if (filtered.length === 0) return `${free}No tengo tarifa para esa ciudad; escribe a un asesor.`;
      const lines = filtered.map((r) => `• ${r.city} (${r.department}): ${formatCop(r.price_cents)}${r.estimated_days ? `, ~${r.estimated_days} días` : ""}`);
      return `${free}\n${lines.join("\n")}`.trim();
    },
  },
  {
    authOnly: false,
    spec: {
      name: "query_content",
      description: "Devuelve un texto de contenido de la tienda por clave (nosotros, pagos_envios).",
      parameters: {
        type: "object",
        properties: { key: { type: "string", description: "Clave: nosotros | pagos_envios" } },
        required: ["key"],
      },
    },
    handler: (args) => {
      const key = String(args.key ?? "");
      const value = contentRepo.getValue(key, "");
      return value || "No tengo información para esa clave.";
    },
  },
  {
    authOnly: true,
    spec: {
      name: "get_my_orders",
      description: "Lista los últimos pedidos del usuario autenticado.",
      parameters: { type: "object", properties: {} },
    },
    handler: (_args, ctx) => {
      if (ctx.channel !== "auth" || !ctx.userId) return "Necesitas iniciar sesión para ver tus pedidos.";
      const orders = ordersRepo.all<Order>(
        `SELECT * FROM orders WHERE user_id = $u ORDER BY created_at DESC LIMIT 5`,
        { $u: ctx.userId },
      );
      if (orders.length === 0) return "No tienes pedidos todavía.";
      return orders
        .map((o) => `• ${o.payment_ref} — ${formatCop(o.total_cents)} — ${STATUS_ES[o.status] ?? o.status}`)
        .join("\n");
    },
  },
  {
    authOnly: true,
    spec: {
      name: "get_order_status",
      description: "Estado y seguimiento de un pedido del usuario autenticado (por referencia).",
      parameters: {
        type: "object",
        properties: { order_ref: { type: "string", description: "Referencia del pedido, p.ej. CR-XXXXXXXX." } },
        required: ["order_ref"],
      },
    },
    handler: (args, ctx) => {
      if (ctx.channel !== "auth" || !ctx.userId) return "Necesitas iniciar sesión para consultar tu pedido.";
      const ref = String(args.order_ref ?? "").trim();
      // Server-side ownership check: the order must belong to this user (anti-IDOR).
      const order = ordersRepo.get<Order>(
        `SELECT * FROM orders WHERE payment_ref = $ref AND user_id = $u`,
        { $ref: ref, $u: ctx.userId },
      );
      if (!order) return "No encontré ese pedido en tu cuenta.";
      const tracking = order.tracking_code ? ` Seguimiento: ${order.tracking_code}.` : "";
      return `Pedido ${order.payment_ref}: ${STATUS_ES[order.status] ?? order.status}. Total ${formatCop(order.total_cents)}.${tracking}`;
    },
  },
];

/** Tool specs available for a channel (auth-only tools excluded for guests). */
export function toolSpecsFor(channel: ChatChannel): LlmToolSpec[] {
  return TOOLS.filter((t) => !t.authOnly || channel === "auth").map((t) => t.spec);
}

/** Execute a tool with the channel gate + server-side identity. */
export function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): string {
  const tool = TOOLS.find((t) => t.spec.name === name);
  if (!tool) return "Herramienta no disponible.";
  if (tool.authOnly && ctx.channel !== "auth") return "Esa acción requiere iniciar sesión.";
  return tool.handler(args, ctx);
}
