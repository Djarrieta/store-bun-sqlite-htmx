/**
 * Botanical line-art ornaments — the CRISTA signature motif (echoes the
 * "C + hoja" logo and the brand's "detalles botánicos"). Stroke uses
 * `currentColor` so callers control the tone. CSS registered globally.
 */
import { registerCss } from "./registry.ts";

/** A small centered leaf flourish flanked by hairline rules. */
export function leafDivider(opts: { className?: string } = {}): string {
  const cls = opts.className ? ` ${opts.className}` : "";
  return `<span class="ornament${cls}" aria-hidden="true">
    <i class="ornament__rule"></i>
    <svg class="ornament__mark" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" role="presentation">
      <path d="M12 21.5 C 12 13.5, 15.5 7, 21.5 3 C 21 11, 17.5 18, 12 21.5 Z"/>
      <path d="M12 21.5 C 12 13.5, 8.5 7, 2.5 3 C 3 11, 6.5 18, 12 21.5 Z"/>
      <path d="M12 21.5 V 11"/>
    </svg>
    <i class="ornament__rule"></i>
  </span>`;
}

/** A single small leaf with a center vein — inline accent mark. */
export function leafMark(opts: { className?: string } = {}): string {
  const cls = opts.className ? ` ${opts.className}` : "";
  return `<svg class="leaf-mark${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" role="presentation">
    <path d="M12 21 C 12 13.5, 15 7.5, 21 3.5 C 20.5 11, 17.5 17.5, 12 21 Z"/>
    <path d="M12 21 C 12 15, 10 10, 5.5 7"/>
  </svg>`;
}

/** A tall, delicate branch — decorative accent (e.g. hero backdrop). */
export function leafBranch(opts: { className?: string } = {}): string {
  const cls = opts.className ? ` ${opts.className}` : "";
  const leaf = (cx: number, cy: number, rot: number) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="3.4" transform="rotate(${rot} ${cx} ${cy})"/>`;
  return `<svg class="leaf-branch${cls}" viewBox="0 0 190 320" width="190" height="320" aria-hidden="true" role="presentation">
    <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
      <path d="M104 308 C 74 256, 78 202, 100 160 C 120 122, 124 74, 106 22"/>
      ${leaf(86, 244, 42)}
      ${leaf(80, 214, -48)}
      ${leaf(92, 190, 46)}
      ${leaf(82, 162, -46)}
      ${leaf(104, 140, 44)}
      ${leaf(96, 112, -44)}
      ${leaf(112, 90, 42)}
      ${leaf(102, 62, -42)}
      ${leaf(110, 40, 40)}
      <path d="M106 22 q -3 -8 2 -14" />
    </g>
  </svg>`;
}

registerCss(/* css */ `
.ornament {
  display: flex; align-items: center; justify-content: center;
  gap: 0.9rem; color: var(--accent);
}
.ornament__rule { display: block; width: clamp(2rem, 8vw, 4.5rem); height: 1px; background: currentColor; opacity: 0.4; }
.ornament__mark { display: block; flex: none; opacity: 0.9; }
.ornament--muted { color: var(--border-strong); }
.leaf-branch { display: block; color: var(--accent); }
.leaf-mark { display: inline-block; color: var(--accent); }
`);
