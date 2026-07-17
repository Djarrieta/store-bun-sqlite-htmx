/** Chat persistence + guest→auth migration (tech-spec §7, §14.6). */
import { db } from "../db.ts";
import { Repository } from "../core/repository.ts";

db.exec(`
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  ref         TEXT NOT NULL,
  channel     TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  attachment_url  TEXT,
  attachment_type TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_ref ON chat_messages(ref, created_at);

CREATE TABLE IF NOT EXISTS chat_migration_log (
  guest_ref    TEXT PRIMARY KEY,
  auth_user_id TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL
);
`);

export type ChatChannel = "auth" | "web_guest" | "whatsapp";
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  ref: string;
  channel: ChatChannel;
  role: ChatRole;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
}

class ChatRepository extends Repository<ChatMessage & Record<string, unknown>> {
  readonly table = "chat_messages";

  append(msg: {
    ref: string;
    channel: ChatChannel;
    role: ChatRole;
    content: string;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
  }): ChatMessage {
    const row: ChatMessage = {
      id: this.newId(),
      ref: msg.ref,
      channel: msg.channel,
      role: msg.role,
      content: msg.content,
      attachment_url: msg.attachmentUrl ?? null,
      attachment_type: msg.attachmentType ?? null,
      created_at: this.now(),
    };
    this.run(
      `INSERT INTO chat_messages (id, ref, channel, role, content, attachment_url, attachment_type, created_at)
       VALUES ($id, $ref, $ch, $role, $content, $au, $at, $c)`,
      {
        $id: row.id,
        $ref: row.ref,
        $ch: row.channel,
        $role: row.role,
        $content: row.content,
        $au: row.attachment_url,
        $at: row.attachment_type,
        $c: row.created_at,
      },
    );
    return row;
  }

  recent(ref: string, limit = 20): ChatMessage[] {
    const rows = this.all<ChatMessage>(
      `SELECT * FROM chat_messages WHERE ref = $ref ORDER BY created_at DESC LIMIT $limit`,
      { $ref: ref, $limit: limit },
    );
    return rows.reverse();
  }

  /** Reassign a guest's chat history to a user on login (tech-spec §14.6). */
  migrate(guestRef: string, userId: string): void {
    this.run(`UPDATE chat_messages SET ref = $u, channel = 'auth' WHERE ref = $g AND channel = 'web_guest'`, {
      $u: userId,
      $g: guestRef,
    });
    this.run(
      `INSERT OR IGNORE INTO chat_migration_log (guest_ref, auth_user_id, created_at) VALUES ($g, $u, $c)`,
      { $g: guestRef, $u: userId, $c: this.now() },
    );
  }
}

export const chatRepo = new ChatRepository();

/** Called from the login flow to migrate a guest conversation to the user. */
export function migrateChatSession(guestRef: string, userId: string): void {
  chatRepo.migrate(guestRef, userId);
}
