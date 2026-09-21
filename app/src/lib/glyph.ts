/** Rendu d'un caractère depuis ses traits (style 楷), avec animation pinceau le long des médianes. Port de la maquette. */
export type StrokeData = { s: string[]; m: number[][][] };
let GID = 0;

export function glyph(c: string, d: StrokeData | undefined, size: number, opts: { write?: boolean; color?: string } = {}): string {
  if (!d) return `<span class="hz" style="font-size:${Math.round(size * 0.88)}px">${c}</span>`;
  const write = opts.write ?? size >= 84;
  const style = opts.color ? ` style="color:${opts.color}"` : '';
  if (!write) return `<svg class="g" width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-label="${c}"${style}><g transform="scale(1,-1) translate(0,-900)">${d.s.map((p) => `<path d="${p}"/>`).join('')}</g></svg>`;
  const id = ++GID; let delay = 0.05, defs = '', body = '';
  d.s.forEach((p, i) => {
    const m = d.m[i]; let L = 0; for (let k = 1; k < m.length; k++) L += Math.hypot(m[k][0] - m[k - 1][0], m[k][1] - m[k - 1][1]);
    const dur = Math.max(0.08, L / 3600);
    defs += `<clipPath id="k${id}_${i}"><path d="${p}"/></clipPath>`;
    body += `<polyline points="${m.map((q) => q.join(',')).join(' ')}" clip-path="url(#k${id}_${i})" class="br" style="stroke-dasharray:${L.toFixed(0)};stroke-dashoffset:${L.toFixed(0)};animation-duration:${dur.toFixed(2)}s;animation-delay:${delay.toFixed(2)}s"/><path d="${p}" class="fill" style="animation-delay:${(delay + dur).toFixed(2)}s"/>`;
    delay += dur + 0.025;
  });
  return `<svg class="g write" width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-label="${c}"${style}><defs>${defs}</defs><g transform="scale(1,-1) translate(0,-900)">${body}</g></svg>`;
}
/* Le CSS de .g, .g.write, .br, .fill et les @keyframes brush / hold vivent dans tokens.css. */
