/**
 * Tiny HTTP router with `:param` support and a per-request `RouteContext`.
 * Public branches are matched here; the session guard runs in `index.ts`.
 */
import type { User } from "../auth/auth.db.ts";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteContext {
  req: Request;
  url: URL;
  method: HttpMethod;
  params: Record<string, string>;
  query: URLSearchParams;
  cookies: Record<string, string>;
  /** Authenticated user (session) or null for guests. Set by the dispatcher. */
  user: User | null;
  /** Stable guest identity (cart + chat + guest orders). Set by the dispatcher. */
  guestRef: string;
  /** True when the request was issued by HTMX. */
  isHtmx: boolean;
  /** Queue a Set-Cookie header to append to the response. */
  setCookie: (cookie: string) => void;
  /** Internal: collected Set-Cookie values. */
  readonly _cookies: string[];
}

export type Handler = (ctx: RouteContext) => Response | Promise<Response>;

interface Segment {
  value: string;
  param: boolean;
}

interface Route {
  method: HttpMethod;
  segments: Segment[];
  handler: Handler;
}

function compile(path: string): Segment[] {
  return path
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => (s.startsWith(":") ? { value: s.slice(1), param: true } : { value: s, param: false }));
}

export class Router {
  private routes: Route[] = [];

  add(method: HttpMethod, path: string, handler: Handler): void {
    this.routes.push({ method, segments: compile(path), handler });
  }

  get(path: string, handler: Handler): void {
    this.add("GET", path, handler);
  }
  post(path: string, handler: Handler): void {
    this.add("POST", path, handler);
  }
  put(path: string, handler: Handler): void {
    this.add("PUT", path, handler);
  }
  patch(path: string, handler: Handler): void {
    this.add("PATCH", path, handler);
  }
  delete(path: string, handler: Handler): void {
    this.add("DELETE", path, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = pathname.split("/").filter((s) => s.length > 0);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i]!;
        const part = parts[i]!;
        if (seg.param) {
          params[seg.value] = decodeURIComponent(part);
        } else if (seg.value !== part) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler: route.handler, params };
    }
    return null;
  }
}
