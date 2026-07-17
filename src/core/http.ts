/**
 * HTTP helpers: responses, HTML escaping, cookies. No business logic.
 */

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };

export function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { ...HTML_HEADERS, ...(init.headers ?? {}) },
  });
}

/** HTMX partial (same content type; kept distinct for intent/readability). */
export function fragment(body: string, init: ResponseInit = {}): Response {
  return html(body, init);
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers ?? {}) },
  });
}

export function redirect(location: string, status = 303): Response {
  return new Response(null, { status, headers: { location } });
}

export function notFound(message = "No encontrado"): Response {
  return html(errorPage(404, message), { status: 404 });
}

export function forbidden(message = "No autorizado"): Response {
  return html(errorPage(403, message), { status: 403 });
}

export function badRequest(message = "Solicitud inválida"): Response {
  return html(errorPage(400, message), { status: 400 });
}

export function serverError(message = "Error del servidor"): Response {
  return html(errorPage(500, message), { status: 500 });
}

function errorPage(code: number, message: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${code}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8f5f0;color:#3f2f27;display:grid;place-items:center;height:100vh;margin:0}
.box{text-align:center}h1{font-size:3rem;margin:0}a{color:#7b1e2e}</style></head>
<body><div class="box"><h1>${code}</h1><p>${escapeHtml(message)}</p><p><a href="/">Volver al inicio</a></p></div></body></html>`;
}

/** Escape user-controlled text before interpolating into HTML (XSS guard). */
export function escapeHtml(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Escape a value for use inside a double-quoted HTML attribute. */
export function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

// ---- Cookies ----

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie");
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export interface CookieOptions {
  maxAge?: number; // seconds
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  expires?: Date;
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

/** Return a copy of `res` with additional Set-Cookie headers appended. */
export function withCookies(res: Response, cookies: string[]): Response {
  if (cookies.length === 0) return res;
  const headers = new Headers(res.headers);
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
