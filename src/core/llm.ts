/**
 * LLM abstraction (tech-spec §S2, §14.3). Provider swappable via env
 * (LLM_PROVIDER: deepseek | openai | ollama). Talks OpenAI-compatible
 * Chat Completions over fetch. No SDK dependency.
 */
import { config, llmEnabled } from "../config.ts";

export interface LlmToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool arguments. */
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmResult {
  content: string;
  toolCalls: LlmToolCall[];
}

export function llmAvailable(): boolean {
  return llmEnabled();
}

function safeParse(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** One Chat Completions round-trip. Throws on transport/API errors. */
export async function chatComplete(messages: LlmMessage[], tools?: LlmToolSpec[]): Promise<LlmResult> {
  const body: Record<string, unknown> = {
    model: config.llm.model,
    messages,
    temperature: 0.3,
    stream: false,
  };
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = "auto";
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.llm.apiKey) {
    headers.authorization = `Bearer ${config.llm.apiKey}`;
  }

  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: LlmMessage & { tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
  };
  const msg = data.choices?.[0]?.message;
  const toolCalls: LlmToolCall[] = (msg?.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeParse(tc.function.arguments),
  }));
  return { content: msg?.content ?? "", toolCalls };
}
