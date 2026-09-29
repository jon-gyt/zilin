/**
 * Une main d'apprenant, simulée : un caractère tracé au doigt à partir de ses médianes
 * d'origine (Make Me a Hanzi, pleine précision), déformé de façon réaliste, avec ou sans
 * écarts d'ordre, de liaison, de trait manquant ou de sens. Sert à `mesurer.ts` ; tirage
 * déterministe (`graine`).
 */
import type { Point, Trace } from '../../src/lib/ecriture/reconnaissance';

/* ---------- hasard déterministe ---------- */

export function graine(s: number): () => number {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(h: () => number): number {
  return Math.sqrt(-2 * Math.log(h() || 1e-12)) * Math.cos(2 * Math.PI * h());
}

const entre = (h: () => number, a: number, b: number) => a + (b - a) * h();

/* ---------- une main d'apprenant ---------- */

export type Ecart = 'ordre' | 'lies' | 'manque' | 'rebours';

/** Une ligne brisée repassée à pas irréguliers, comme les événements d'un doigt. */
function echantillonner(pts: Point[], h: () => number): Point[] {
  const out: Point[] = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1];
    const [x1, y1] = pts[k];
    const L = Math.hypot(x1 - x0, y1 - y0);
    const pas = Math.max(1, Math.round(L / entre(h, 4, 14)));
    for (let i = 1; i <= pas; i++) {
      const t = i / pas;
      out.push([x0 + t * (x1 - x0), y0 + t * (y1 - y0)]);
    }
  }
  return out;
}

export function main(medianes: number[][][], h: () => number, ecarts: readonly Ecart[]): Trace[] {
  /* les médianes dans le repère de l'écran (y vers le bas), sur 1024 */
  let traits: Point[][] = medianes.map((m) => m.map(([x, y]) => [x, 900 - y] as Point));
  const th = (entre(h, -10, 10) * Math.PI) / 180;
  const sx = entre(h, 0.75, 1.25);
  const sy = entre(h, 0.75, 1.25);
  const cis = entre(h, -0.2, 0.2);
  const taille = entre(h, 0.18, 0.3); /* 1024 unités → 185 à 300 px */
  const [ox, oy] = [entre(h, 0, 60), entre(h, 0, 60)];
  const affine = ([x, y]: Point): Point => {
    const u = (x - 512) * sx + cis * (y - 512) * sy;
    const v = (y - 512) * sy;
    return [
      ox + 150 + taille * (u * Math.cos(th) - v * Math.sin(th)),
      oy + 150 + taille * (u * Math.sin(th) + v * Math.cos(th))
    ];
  };
  /*
   * Ce qu'aucune transformation d'ensemble ne rattrape : les proportions des composants
   * (une clé trop large, un bas trop haut : une courbe de puissance par axe), une ondulation
   * lente du caractère entier, et chaque trait un peu déplacé, tourné, allongé ou raccourci.
   */
  const [gx, gy] = [Math.exp(entre(h, -0.25, 0.25)), Math.exp(entre(h, -0.25, 0.25))];
  const [wx, wy, fx, fy] = [gauss(h) * 25, gauss(h) * 25, entre(h, 0.5, 1.5), entre(h, 0.5, 1.5)];
  const plier = ([x, y]: Point): Point => {
    const u = Math.min(1, Math.max(0, x / 1024)) ** gx * 1024;
    const v = Math.min(1, Math.max(0, y / 1024)) ** gy * 1024;
    return [u + wx * Math.sin((Math.PI * fx * v) / 1024), v + wy * Math.sin((Math.PI * fy * u) / 1024)];
  };
  traits = traits.map((t) => {
    const [dx, dy] = [gauss(h) * 30, gauss(h) * 30];
    const e = entre(h, 0.8, 1.2);
    const a = (gauss(h) * 5 * Math.PI) / 180;
    const [cx, cy] = t.reduce(([p, q], [x, y]) => [p + x / t.length, q + y / t.length], [0, 0]);
    return t.map(([x, y]) => {
      const [u, v] = [(x - cx) * e, (y - cy) * e];
      return affine(
        plier([cx + u * Math.cos(a) - v * Math.sin(a) + dx, cy + u * Math.sin(a) + v * Math.cos(a) + dy])
      );
    });
  });
  /* le tremblement : lent (une onde) et rapide (du bruit) */
  traits = traits.map((t) => {
    const pts = echantillonner(t, h);
    const [a, f, p] = [entre(h, 0, 3), entre(h, 0.05, 0.25), entre(h, 0, 6)];
    return pts.map(
      ([x, y], i) =>
        [x + a * Math.sin(f * i + p) + gauss(h) * 1.2, y + a * Math.cos(f * i + p) + gauss(h) * 1.2] as Point
    );
  });
  if (ecarts.includes('rebours') && traits.length >= 1) {
    const i = Math.floor(h() * traits.length);
    traits[i] = [...traits[i]].reverse();
  }
  if (ecarts.includes('ordre') && traits.length >= 2) {
    const i = Math.floor(h() * (traits.length - 1));
    [traits[i], traits[i + 1]] = [traits[i + 1], traits[i]];
  }
  if (ecarts.includes('lies') && traits.length >= 2) {
    const i = Math.floor(h() * (traits.length - 1));
    const a = traits[i];
    const b = traits[i + 1];
    const trajet = echantillonner([a[a.length - 1], b[0]], h).slice(1, -1);
    traits.splice(i, 2, [...a, ...trajet, ...b]);
  }
  if (ecarts.includes('manque') && traits.length >= 2) {
    traits.splice(Math.floor(h() * traits.length), 1);
  }
  return traits;
}
