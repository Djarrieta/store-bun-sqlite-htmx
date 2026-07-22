/** Chat conversations viewer permissions (read-only). */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";

export const CHAT_VIEWER_KEY = "chat-viewer";

export const chatViewerPermissions: PermissionMatrix = {
  view: ["admin", "manager"],
};

registerPermissions(CHAT_VIEWER_KEY, chatViewerPermissions);
