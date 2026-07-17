/** Small presentational components (badge, alert, card). Use theme classes. */
import { escapeHtml } from "../core/http.ts";

export type BadgeVariant = "default" | "ok" | "warn" | "danger" | "accent";

export function badge(label: string, variant: BadgeVariant = "default"): string {
  const cls = variant === "default" ? "badge" : `badge badge--${variant}`;
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

export type AlertVariant = "ok" | "error" | "warn";

export function alert(message: string, variant: AlertVariant = "ok"): string {
  return `<div class="alert alert--${variant}">${escapeHtml(message)}</div>`;
}

export interface CardOptions {
  title?: string;
  body: string;
  actions?: string;
}

export function card(opts: CardOptions): string {
  return `<section class="panel">
    ${opts.title || opts.actions ? `<div class="row-between" style="margin-bottom:1rem"><h2 style="margin:0">${opts.title ? escapeHtml(opts.title) : ""}</h2>${opts.actions ?? ""}</div>` : ""}
    ${opts.body}
  </section>`;
}
