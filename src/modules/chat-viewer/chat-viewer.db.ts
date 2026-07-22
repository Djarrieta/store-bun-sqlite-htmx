/** Chat conversations viewer — reads from the existing chat_messages table. */
import { db } from "../../db.ts";
import { Repository, normalizeSearch } from "../../core/repository.ts";
import type { PaginateOptions, Page } from "../../core/repository.ts";

export interface Conversation {
  ref: string;
  channel: string;
  started_at: string;
  last_at: string;
  msg_count: number;
  last_message: string;
}

export interface ChatViewerMessage {
  id: string;
  ref: string;
  channel: string;
  role: string;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
}

class ChatViewerRepository extends Repository<Record<string, unknown>> {
  readonly table = "chat_messages";

  listConversations(opts: {
    page?: number;
    search?: string;
    channel?: string;
  } = {}): Page<Conversation> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = 20;

    const params: Record<string, unknown> = {};
    const clauses: string[] = [];

    if (opts.channel) {
      clauses.push("channel = $channel");
      params.$channel = opts.channel;
    }

    if (opts.search) {
      const q = normalizeSearch(opts.search);
      clauses.push("ref LIKE $q");
      params.$q = `%${q}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const total = this.get<{ n: number }>(
      `SELECT COUNT(DISTINCT ref) AS n FROM chat_messages ${where}`,
      params,
    )?.n ?? 0;

    params.$limit = pageSize;
    params.$offset = (page - 1) * pageSize;

    const items = this.all<Conversation>(
      `SELECT
         ref,
         channel,
         MIN(created_at) AS started_at,
         MAX(created_at) AS last_at,
         COUNT(*) AS msg_count,
         (SELECT content FROM chat_messages m2
          WHERE m2.ref = chat_messages.ref AND m2.channel = chat_messages.channel
          ORDER BY m2.created_at DESC LIMIT 1) AS last_message
       FROM chat_messages
       ${where}
       GROUP BY ref, channel
       ORDER BY last_at DESC
       LIMIT $limit OFFSET $offset`,
      params,
    );

    return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  getMessages(ref: string, channel: string, limit = 100): ChatViewerMessage[] {
    return this.all<ChatViewerMessage>(
      `SELECT id, ref, channel, role, content, attachment_url, attachment_type, created_at
       FROM chat_messages
       WHERE ref = $ref AND channel = $channel
       ORDER BY created_at ASC
       LIMIT $limit`,
      { $ref: ref, $channel: channel, $limit: limit },
    );
  }

  getConversationMeta(ref: string, channel: string): Conversation | null {
    return this.get<Conversation>(
      `SELECT
         ref,
         channel,
         MIN(created_at) AS started_at,
         MAX(created_at) AS last_at,
         COUNT(*) AS msg_count,
         (SELECT content FROM chat_messages m2
          WHERE m2.ref = chat_messages.ref AND m2.channel = chat_messages.channel
          ORDER BY m2.created_at DESC LIMIT 1) AS last_message
       FROM chat_messages
       WHERE ref = $ref AND channel = $channel
       GROUP BY ref, channel`,
      { $ref: ref, $channel: channel },
    );
  }
}

export const chatViewerRepo = new ChatViewerRepository();
