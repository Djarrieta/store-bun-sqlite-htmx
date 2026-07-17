/** Feature-flags permissions + curated flag registry. */
import { registerPermissions, type PermissionMatrix } from "../../core/permissions.ts";
import { flagsRepo } from "./feature-flags.db.ts";

export const FLAGS_KEY = "feature-flags";

export const flagsPermissions: PermissionMatrix = {
  view: ["admin"],
  edit: ["admin"],
};

registerPermissions(FLAGS_KEY, flagsPermissions);

export interface FlagDef {
  key: string;
  label: string;
  description: string;
  default: boolean;
}

/** Known flags used across the app. */
export const FLAGS: FlagDef[] = [
  { key: "chat_web", label: "Chat web", description: "Muestra el asistente/chat en la tienda.", default: true },
  { key: "whatsapp", label: "WhatsApp", description: "Habilita el webhook de WhatsApp.", default: false },
];

export function ensureFlagDefaults(): void {
  for (const f of FLAGS) flagsRepo.ensureFlag(f.key, f.default);
}

export function flagEnabled(key: string): boolean {
  return flagsRepo.isEnabled(key);
}
