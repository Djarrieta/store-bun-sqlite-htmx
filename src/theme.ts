/**
 * Design tokens — single source of truth (tech-spec §15, tema CRISTA).
 * Exposed as CSS variables in `:root`; components reference `var(--token)`,
 * never hardcoded colors. `layout.ts` injects `themeCss` globally.
 */

export const themeCss = /* css */ `
/* Tipografías de marca CRISTA — self-hosted (font-src 'self'). Variables. */
@font-face {
  font-family: "Playfair Display";
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
  src: url("/fonts/PlayfairDisplay.woff2") format("woff2");
}
@font-face {
  font-family: "Montserrat";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/Montserrat.woff2") format("woff2");
}

:root {
  /* Paleta base */
  --bg: #f8f5f0;
  --fg: #3f2f27;
  --card: #efe7dc;
  --muted: #8b7565;
  --accent: #7b1e2e;
  --accent-foreground: #f8f5f0;
  --accent-hover: #651825;

  /* Extras de marca */
  --sage: #aab7a0;
  --terracotta: #c47d5a;
  --gold: #8b6f4d;

  /* Estructura */
  --surface: #fffdfa;
  --border: #d8ccbb;
  --border-strong: #c9b9a4;
  --border-disabled: #cbc3b8;
  --shadow: rgba(107, 86, 72, 0.16);

  /* Semántica */
  --danger: #d9a7a2;
  --success: #aab7a0;
  --warning: #d8b46a;
  --error-bg: #f7ebe9;  --error-border: #9b3b2c;  --error-text: #9b3b2c;
  --ok-bg: #eef1ea;     --ok-border: #6f7d61;     --ok-text: #5c6a4e;

  /* Radios */
  --radius-btn-sm: 0.125rem;  --radius-btn-md: 0.125rem;
  --radius-btn-lg: 0.125rem;  --radius-btn-xl: 0.125rem;
  --radius-btn-icon: 0.25rem; --radius-card: 0.375rem;

  /* Sombras */
  --shadow-soft-sm: 0 1px 3px rgba(107, 86, 72, 0.10);
  --shadow-soft:    0 2px 10px rgba(107, 86, 72, 0.12);
  --shadow-soft-lg: 0 8px 28px rgba(107, 86, 72, 0.16);
  --shadow-card:    var(--shadow-soft);

  /* Tipografía */
  --font-serif: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-sans: "Montserrat", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Espaciado / layout */
  --container: 1120px;
  --space: 1rem;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  font-weight: 600;
  line-height: 1.14;
  margin: 0 0 0.5em;
  letter-spacing: -0.005em;
}
h1 { font-size: clamp(2rem, 4vw, 3rem); }
h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
h3 { font-size: 1.25rem; }

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }

p { margin: 0 0 1rem; }

img { max-width: 100%; height: auto; display: block; }

.container {
  width: 100%;
  max-width: var(--container);
  margin-inline: auto;
  padding-inline: 1.25rem;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 1.5rem;
}

.muted { color: var(--muted); }
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 600;
}

/* Botones */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font: inherit;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.82rem;
  padding: 0.7rem 1.25rem;
  border-radius: var(--radius-btn-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  background: var(--accent);
  color: var(--accent-foreground);
}
.btn:hover { background: var(--accent-hover); color: var(--accent-foreground); }
.btn:disabled, .btn[aria-disabled="true"] {
  background: var(--terracotta);
  opacity: 0.55;
  cursor: not-allowed;
}
.btn--outline {
  background: transparent;
  color: var(--fg);
  border-color: var(--border-strong);
}
.btn--outline:hover { background: var(--card); color: var(--fg); }
.btn--danger { background: var(--terracotta); }
.btn--danger:hover { background: #b06848; }
.btn--sm { padding: 0.4rem 0.8rem; font-size: 0.72rem; }
.btn--block { width: 100%; }

/* Formularios */
.field { margin-bottom: 1rem; }
.field > label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
}
.input, .select, .textarea {
  width: 100%;
  font: inherit;
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-btn-icon);
  padding: 0.6rem 0.75rem;
}
.input:focus, .select:focus, .textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: var(--accent);
}
.textarea { min-height: 6rem; resize: vertical; }
.field__error { color: var(--error-text); font-size: 0.82rem; margin-top: 0.25rem; }

/* Alertas */
.alert { padding: 0.85rem 1rem; border-radius: var(--radius-btn-icon); border: 1px solid; margin-bottom: 1rem; }
.alert--ok { background: var(--ok-bg); border-color: var(--ok-border); color: var(--ok-text); }
.alert--error { background: var(--error-bg); border-color: var(--error-border); color: var(--error-text); }
.alert--warn { background: #fbf4e4; border-color: var(--warning); color: #7a5c1e; }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--card);
  color: var(--muted);
  border: 1px solid var(--border);
}
.badge--ok { background: var(--ok-bg); color: var(--ok-text); border-color: var(--ok-border); }
.badge--warn { background: #fbf4e4; color: #7a5c1e; border-color: var(--warning); }
.badge--danger { background: var(--error-bg); color: var(--error-text); border-color: var(--error-border); }
.badge--accent { background: var(--accent); color: var(--accent-foreground); border-color: var(--accent); }

/* Tablas / listas de datos */
.data-table { width: 100%; }
.data-toolbar { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
.data-toolbar .input { max-width: 320px; }
.data-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 1rem 1.25rem;
  margin-bottom: 0.75rem;
}
.data-row__main { min-width: 0; }
.data-row__title { font-weight: 600; }
.data-row__meta { color: var(--muted); font-size: 0.85rem; }
.data-row__actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.pagination { display: flex; gap: 0.5rem; align-items: center; justify-content: center; margin-top: 1rem; }

/* Grid utilidades */
.grid { display: grid; gap: 1.25rem; }
.grid--cards { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.stack { display: flex; flex-direction: column; gap: 1rem; }
.row-between { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }

.htmx-indicator { opacity: 0; transition: opacity 0.2s ease; }
.htmx-request .htmx-indicator, .htmx-request.htmx-indicator { opacity: 1; }

@media (max-width: 640px) {
  .data-row { flex-direction: column; align-items: flex-start; }
  .data-row__actions { width: 100%; }
}
`;
