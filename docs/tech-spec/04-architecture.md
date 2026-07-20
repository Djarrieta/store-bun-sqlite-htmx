# §4 — General architecture

## Server

- Bun process with HTTP server.
- Load config from environment variables.
- Initialize auth provider (Google client).
- Register auth routes (login, callback, logout, password reset, register).
- Register module routes and API endpoints.
- Apply migrations (on startup) and optional seed in dev.
- Serve static assets and public files.

## Client

- Minimal JS: **HTMX** + **Hyperscript** loaded from local static folder.
- HTML rendered server-side; small dynamic fragments via HTMX.
- Forms POST to server endpoints; HTMX swaps response into the DOM.
- Admin panel uses the same pattern.
- All content is in Spanish only.
