/**
 * Component CSS registry. Each component registers its stylesheet at import
 * time; `layout.ts` injects the collected CSS once, globally, so HTMX fragments
 * are styled without shipping `<style>` per fragment (tech-spec §15).
 */
const sheets = new Set<string>();

export function registerCss(css: string): void {
  sheets.add(css);
}

export function collectedCss(): string {
  return Array.from(sheets).join("\n");
}
