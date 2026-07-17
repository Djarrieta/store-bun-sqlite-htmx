/**
 * Form field components. All inputs use theme classes; values are escaped.
 * CSRF token field is included via `csrfField()` (tech-spec §16).
 */
import { escapeHtml, escapeAttr } from "../core/http.ts";

export interface FieldOptions {
  name: string;
  label: string;
  value?: string | number | null;
  placeholder?: string;
  required?: boolean;
  type?: string;
  error?: string;
  help?: string;
}

function labelHtml(name: string, label: string, required?: boolean): string {
  return `<label for="f_${escapeAttr(name)}">${escapeHtml(label)}${required ? " *" : ""}</label>`;
}

function errorHtml(error?: string): string {
  return error ? `<div class="field__error">${escapeHtml(error)}</div>` : "";
}

function helpHtml(help?: string): string {
  return help ? `<div class="muted" style="font-size:0.82rem;margin-top:0.25rem">${escapeHtml(help)}</div>` : "";
}

export function textField(o: FieldOptions): string {
  return `<div class="field">
    ${labelHtml(o.name, o.label, o.required)}
    <input class="input" id="f_${escapeAttr(o.name)}" name="${escapeAttr(o.name)}"
      type="${escapeAttr(o.type ?? "text")}" value="${escapeAttr(o.value ?? "")}"
      ${o.placeholder ? `placeholder="${escapeAttr(o.placeholder)}"` : ""} ${o.required ? "required" : ""}>
    ${helpHtml(o.help)}${errorHtml(o.error)}
  </div>`;
}

export function textareaField(o: FieldOptions): string {
  return `<div class="field">
    ${labelHtml(o.name, o.label, o.required)}
    <textarea class="textarea" id="f_${escapeAttr(o.name)}" name="${escapeAttr(o.name)}"
      ${o.placeholder ? `placeholder="${escapeAttr(o.placeholder)}"` : ""} ${o.required ? "required" : ""}>${escapeHtml(o.value ?? "")}</textarea>
    ${helpHtml(o.help)}${errorHtml(o.error)}
  </div>`;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldOptions extends FieldOptions {
  options: SelectOption[];
  emptyLabel?: string;
}

export function selectField(o: SelectFieldOptions): string {
  const current = String(o.value ?? "");
  const opts = [
    o.emptyLabel ? `<option value="">${escapeHtml(o.emptyLabel)}</option>` : "",
    ...o.options.map(
      (opt) =>
        `<option value="${escapeAttr(opt.value)}"${opt.value === current ? " selected" : ""}>${escapeHtml(opt.label)}</option>`,
    ),
  ].join("");
  return `<div class="field">
    ${labelHtml(o.name, o.label, o.required)}
    <select class="select" id="f_${escapeAttr(o.name)}" name="${escapeAttr(o.name)}" ${o.required ? "required" : ""}>${opts}</select>
    ${helpHtml(o.help)}${errorHtml(o.error)}
  </div>`;
}

export function checkboxField(o: { name: string; label: string; checked?: boolean }): string {
  return `<div class="field">
    <label style="display:flex;align-items:center;gap:0.5rem;font-weight:600">
      <input type="checkbox" name="${escapeAttr(o.name)}" value="1"${o.checked ? " checked" : ""}>
      ${escapeHtml(o.label)}
    </label>
  </div>`;
}

export function hiddenField(name: string, value: string): string {
  return `<input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(value)}">`;
}

export function fileField(o: { name: string; label: string; accept?: string; required?: boolean; help?: string }): string {
  return `<div class="field">
    ${labelHtml(o.name, o.label, o.required)}
    <input class="input" id="f_${escapeAttr(o.name)}" name="${escapeAttr(o.name)}" type="file"
      ${o.accept ? `accept="${escapeAttr(o.accept)}"` : ""} ${o.required ? "required" : ""}>
    ${helpHtml(o.help)}
  </div>`;
}

export function submitButton(label: string, block = false): string {
  return `<button type="submit" class="btn${block ? " btn--block" : ""}">${escapeHtml(label)}</button>`;
}
