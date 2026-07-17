/**
 * WhatsApp Cloud API helpers (tech-spec §14.5): webhook verification, inbound
 * signature check (HMAC-SHA256 over the RAW body), message extraction and send.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../config.ts";

/** GET verification handshake: echo challenge iff token matches. */
export function verifyChallenge(mode: string | null, token: string | null, challenge: string): string | null {
  if (mode === "subscribe" && token && config.whatsapp.verifyToken && token === config.whatsapp.verifyToken) {
    return challenge;
  }
  return null;
}

/** Verify X-Hub-Signature-256 over the raw request body (timing-safe). */
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = config.whatsapp.appSecret;
  if (!secret || !signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface InboundMessage {
  from: string;
  text: string;
}

/** Extract sender + text from a Cloud API webhook payload, or null. */
export function extractInbound(payload: unknown): InboundMessage | null {
  try {
    const msg = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return null;
    const from = String(msg.from ?? "");
    const text = String(msg.text?.body ?? "");
    if (!from || !text) return null;
    return { from, text };
  } catch {
    return null;
  }
}

/** Send a text message via the Graph API (no-op if not configured). */
export async function sendMessage(to: string, text: string): Promise<void> {
  const { token, phoneNumberId } = config.whatsapp;
  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] token/phone number id not configured; skipping outbound send");
    return;
  }
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[whatsapp] send error:", err);
  }
}
