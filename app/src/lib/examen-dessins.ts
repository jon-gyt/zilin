/**
 * Les scènes de l'examen 科举, dessinées à plat : le 号舍 (la rangée des cellules d'examen),
 * le 书院 du 月课, la boutique et son enseigne, la porte et son mot, le mur du 放榜. Portées
 * de la maquette validée par le propriétaire le 29 septembre 2026 (`maquettes/examen.html`).
 *
 * Des dessins, pas du contenu : les textes (l'enseigne, la plaque, les noms du 放榜) arrivent
 * en argument, depuis `examens.json` ; les grands caractères se dessinent depuis leurs traits
 * (`glyph`), jamais depuis une police quand les traits existent. Les couleurs sont des jetons
 * (`--ex-*`, `--h-*` de `tokens.css`) : ni ombre, ni dégradé, ni doré, ni cinabre, ni dragon.
 * Tao et le personnage se posent par-dessus, en composants (`Examen.svelte`).
 */
import { glyph, type StrokeData } from './glyph';

/** Les traits des caractères à dessiner ; un caractère absent s'écrit en police, en repli. */
export type Traits = ReadonlyMap<string, StrokeData>;

const ENCRE = 'var(--ex-encre)';

/** Un texte sûr dans un nœud SVG. */
function sur(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Un caractère posé dans une scène, en (x, y), de `size` de côté : depuis ses traits, écrit
 * au pinceau si `write`, après `delai` secondes ; sans traits, en police.
 */
export function caractere(
  c: string,
  traits: Traits,
  x: number,
  y: number,
  size: number,
  couleur: string,
  write = false,
  delai = 0
): string {
  const d = traits.get(c);
  if (!d) {
    return `<text x="${x + size / 2}" y="${(y + size * 0.84).toFixed(1)}" text-anchor="middle" font-family="Noto Serif SC,serif" font-weight="500" font-size="${(size * 0.88).toFixed(1)}" fill="${couleur}">${sur(c)}</text>`;
  }
  let s = glyph(c, d, size, { write, color: couleur, label: '' }).replace('<svg ', `<svg x="${x}" y="${y}" `);
  if (write && delai > 0) {
    s = s.replace(/animation-delay:([\d.]+)s/g, (_, t: string) => `animation-delay:${(Number(t) + delai).toFixed(2)}s`);
  }
  return s;
}

/** La durée d'écriture d'un mot au pinceau, à peu près : de quoi enchaîner le suivant. */
export function dureeEcriture(mot: string, traits: Traits): number {
  return [...mot].reduce((a, c) => a + (traits.get(c)?.s.length ?? 0) * 0.12, 0);
}

/** Un mur de briques, à plat. */
function briques(x: number, y: number, w: number, h: number): string {
  let p = '';
  for (let r = 0; r < h / 11; r++) {
    const yy = y + r * 11;
    p += `M${x} ${yy}H${x + w}`;
    for (let c = r % 2 ? 10 : 0; c < w; c += 20) p += `M${x + c} ${yy}V${yy + 11}`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--ex-mur)"/><path d="${p}" stroke="var(--ex-joint)" stroke-width="1"/>`;
}

/**
 * Le 号舍 : la rangée de cellules d'examen, ouvertes sur l'allée ; une planche pour table,
 * une planche pour banc. Le 千字文 numérote les rangées : 天 d'abord. Au loin, la tour d'où
 * l'on surveillait les allées. Tao se pose à droite, sur l'allée (`HAOSHE_TAO`).
 * `plaques` : les trois plaques des cellules, dessinées depuis leurs traits.
 */
export const HAOSHE = { w: 393, h: 262 } as const;
/** La part du ciel coupée à l’écran, au-dessus de la tour : la scène tient à 393 × 660. */
export const HAOSHE_VUE = { y: 14, h: 248 } as const;
/** Où Tao se pose dans le 号舍, en fractions de la scène : à droite, sur l'allée. */
export const HAOSHE_TAO = { left: 0.584, top: (84.8 - 14) / 248, width: 0.407 } as const;

export function dessinHaoshe(plaques: readonly string[], traits: Traits): string {
  const { w: W, h: H } = HAOSHE;
  const sol = 226;
  let s = `<rect width="${W}" height="${H}" fill="var(--paper)"/>`;
  s += `<g fill="var(--ex-loin)"><rect x="46" y="44" width="46" height="40"/><path d="M34 46L50 30H88L104 46Z"/><rect x="54" y="18" width="30" height="14"/><path d="M44 20L58 8H80L94 20Z"/></g>`;
  s += `<circle cx="344" cy="40" r="17" fill="var(--ex-astre)"/>`;
  s += briques(0, 88, W, sol - 88);
  s += `<path d="M-8 90L8 70H385L401 90Z" fill="var(--ex-toit)"/><path d="M-8 90H401" stroke="${ENCRE}" stroke-width="3"/>`;
  s += Array.from({ length: 33 }, (_, i) => `<path d="M${12 + i * 12} 72V88" stroke="var(--ex-tuile)" stroke-width="2"/>`).join('');
  const cellule = (x: number, w: number, plaque: string, nous: boolean): string => {
    const top = 96;
    let c = `<rect x="${x}" y="${top}" width="${w}" height="${sol - top}" fill="${nous ? 'var(--ex-cellule-nous)' : 'var(--ex-cellule)'}" stroke="var(--ex-bord)" stroke-width="2"/>`;
    c += `<rect x="${x}" y="${top + 60}" width="${w}" height="10" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="2"/>`;
    c += `<path d="M${x + 8} ${top + 70}V${top + 84}M${x + w - 8} ${top + 70}V${top + 84}" stroke="var(--ex-bois-fonce)" stroke-width="3"/>`;
    c += `<rect x="${x}" y="${top + 98}" width="${w}" height="9" fill="var(--ex-gutte)" stroke="${ENCRE}" stroke-width="2"/>`;
    c += `<rect x="${x + w / 2 - 22}" y="${top + 8}" width="44" height="18" rx="2" fill="var(--ex-papier)" stroke="${ENCRE}" stroke-width="2"/>`;
    const chars = [...plaque].slice(0, 2);
    chars.forEach((ch, k) => (c += caractere(ch, traits, x + w / 2 - 17 + k * 20, top + 10, 14, ENCRE)));
    return c;
  };
  s += cellule(14, 92, plaques[0] ?? '', false);
  s += cellule(134, 126, plaques[1] ?? '', true);
  s += cellule(288, 92, plaques[2] ?? '', false);
  /* sur la table du milieu : la copie, la pierre à encre, le pinceau, la bougie */
  s += `<path d="M160 156L168 142H212L204 156Z" fill="var(--ex-papier)" stroke="${ENCRE}" stroke-width="1.6"/>`;
  s += `<path d="M175 146h24M173 150h24" stroke="var(--ex-gris)" stroke-width="1.4" stroke-dasharray="4 2"/>`;
  s += `<rect x="216" y="146" width="24" height="10" rx="3" fill="${ENCRE}"/><ellipse cx="224" cy="150" rx="5" ry="2.4" fill="var(--ex-toit)"/>`;
  s += `<path d="M190 139l30 -4" stroke="var(--h-ocre)" stroke-width="3.5" stroke-linecap="round"/><path d="M220 135l8 -1" stroke="${ENCRE}" stroke-width="3.5" stroke-linecap="round"/>`;
  s += `<rect x="146" y="134" width="6" height="22" fill="var(--ex-papier)" stroke="${ENCRE}" stroke-width="1.6"/><path d="M149 124q-4 6 0 10q4-4 0-10z" fill="var(--ex-abricot)"/>`;
  s += `<rect x="0" y="${sol}" width="${W}" height="${H - sol}" fill="var(--ex-sol)"/><path d="M0 ${sol}H${W}" stroke="var(--ex-bord)" stroke-width="2"/>`;
  s += `<path d="M24 ${sol + 14}h44M120 ${sol + 24}h52M206 ${sol + 12}h30" stroke="var(--ex-joint)" stroke-width="2" stroke-linecap="round"/>`;
  return s;
}

/**
 * Le 书院 du 月课 : la porte de l'académie, sa plaque (dessinée depuis ses traits), un pin.
 * Tao se pose à droite, un livre sous le bras (`ACADEMIE_TAO`).
 */
export const ACADEMIE = { w: 393, h: 214 } as const;
export const ACADEMIE_TAO = { left: 0.67, top: 0.33, width: 0.32 } as const;

export function dessinAcademie(plaque: string, traits: Traits): string {
  const { w: W, h: H } = ACADEMIE;
  let s = `<rect width="${W}" height="${H}" fill="var(--paper)"/>`;
  s += `<path d="M0 150Q80 100 170 128T${W} 110V${H}H0Z" fill="var(--ex-fond)"/>`;
  s += `<path d="M362 190V96" stroke="var(--ex-bois)" stroke-width="6" stroke-linecap="round"/>`;
  s += `<path d="M332 110h60l-12-12h-36zM324 132h76l-14-14h-48zM336 90h52l-10-10h-32z" fill="var(--ex-malachite)"/>`;
  s += `<path d="M58 70L92 44H250L284 70Z" fill="var(--ex-toit)"/><path d="M52 70H290" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>`;
  s += Array.from({ length: 13 }, (_, i) => `<path d="M${100 + i * 12} 46V68" stroke="var(--ex-tuile)" stroke-width="2"/>`).join('');
  s += `<rect x="78" y="70" width="186" height="16" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="2"/>`;
  s += `<rect x="128" y="80" width="86" height="40" rx="3" fill="${ENCRE}"/>`;
  [...plaque].slice(0, 2).forEach((c, k) => (s += caractere(c, traits, 139 + k * 34, 85, 30, 'var(--ex-papier)')));
  s += `<rect x="88" y="86" width="14" height="104" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="2"/><rect x="240" y="86" width="14" height="104" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="2"/>`;
  s += `<rect x="102" y="126" width="138" height="64" fill="var(--ex-seuil)"/><path d="M171 126V190" stroke="var(--ex-bord)" stroke-width="2"/>`;
  s += `<path d="M80 190H262M72 198H270M64 206H278" stroke="var(--ex-bord)" stroke-width="3" stroke-linecap="round"/>`;
  return s;
}

/**
 * Une boutique et son enseigne 匾额 : l'encre, les caractères clairs, dessinés depuis leurs
 * traits ; les vitrines (un vase, une théière, un bol, une jarre), une lanterne au bord du
 * toit. L'enseigne s'élargit avec son texte.
 */
export const BOUTIQUE = { w: 357, h: 196 } as const;

export function dessinBoutique(enseigne: string, traits: Traits): string {
  const chars = [...enseigne].filter((c) => c.trim() !== '');
  const n = Math.max(1, chars.length);
  const size = Math.min(40, Math.floor(190 / n));
  const pas = size + 6;
  const larg = n * pas + 26;
  const x0 = 178.5 - larg / 2;
  let s = `<rect width="357" height="196" fill="var(--ex-papier)"/>`;
  s += `<path d="M18 46L44 20H313L339 46Z" fill="var(--ex-toit)"/><path d="M12 46H345" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>`;
  s += Array.from({ length: 22 }, (_, i) => `<path d="M${52 + i * 12} 22V44" stroke="var(--ex-tuile)" stroke-width="2"/>`).join('');
  s += `<rect x="34" y="46" width="289" height="140" fill="var(--ex-facade)"/>`;
  s += `<rect x="34" y="46" width="14" height="140" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="2"/><rect x="309" y="46" width="14" height="140" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="2"/>`;
  s += `<rect x="${x0}" y="54" width="${larg}" height="54" rx="4" fill="${ENCRE}"/><rect x="${x0 + 5}" y="59" width="${larg - 10}" height="44" rx="2" fill="none" stroke="var(--ex-tuile)" stroke-width="1.5"/>`;
  chars.forEach((c, k) => (s += caractere(c, traits, x0 + 13 + k * pas + 3, 81 - size / 2, size, 'var(--ex-papier)')));
  s += `<rect x="60" y="118" width="110" height="68" fill="var(--ex-papier)" stroke="${ENCRE}" stroke-width="2.5"/><rect x="187" y="118" width="110" height="68" fill="var(--ex-papier)" stroke="${ENCRE}" stroke-width="2.5"/>`;
  s += `<path d="M60 150H170M187 150H297" stroke="${ENCRE}" stroke-width="2"/>`;
  s += `<path d="M84 148q-10-10-4-20h8q-2-4 0-6h6q2 2 0 6h8q6 10-4 20z" fill="var(--ex-azur)" stroke="${ENCRE}" stroke-width="2"/><path d="M82 136h22" stroke="var(--ex-papier)" stroke-width="2" stroke-dasharray="3 3"/>`;
  s += `<path d="M126 148q-12 0-12-10q0-8 12-8q12 0 12 8q0 10-12 10zM138 136q8-2 8 4M126 130v-4" fill="var(--ex-malachite)" stroke="${ENCRE}" stroke-width="2"/>`;
  s += `<path d="M212 176q0-10 14-10q14 0 14 10z" fill="var(--ex-peche)" stroke="${ENCRE}" stroke-width="2"/><path d="M252 180q-8-8-4-18q2-4 8-4h10q6 0 8 4q4 10-4 18z" fill="var(--ex-gutte)" stroke="${ENCRE}" stroke-width="2"/>`;
  s += `<path d="M204 142q10-14 20 0M232 142q8-10 16 0" stroke="var(--ex-gris)" stroke-width="2" fill="none"/><circle cx="270" cy="134" r="8" fill="none" stroke="var(--ex-azur)" stroke-width="3"/>`;
  s += `<path d="M22 46v10" stroke="${ENCRE}" stroke-width="2"/><ellipse cx="22" cy="68" rx="10" ry="13" fill="var(--ex-peche)" stroke="${ENCRE}" stroke-width="2"/><path d="M22 81v8" stroke="${ENCRE}" stroke-width="2"/>`;
  return s;
}

/** Une porte fermée, ses clous et ses anneaux : le mot se scotche par-dessus, en HTML. */
export const PORTE = { w: 357, h: 250 } as const;

export function dessinPorte(): string {
  let s = `<rect width="357" height="250" fill="var(--ex-fond)"/>`;
  s += `<rect x="58" y="8" width="241" height="242" fill="var(--ex-bois)" stroke="${ENCRE}" stroke-width="3"/>`;
  s += `<path d="M178.5 8V250" stroke="${ENCRE}" stroke-width="3"/>`;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      s += `<circle cx="${76 + c * 26}" cy="${222 + r * 16}" r="3.5" fill="var(--ex-toit)"/><circle cx="${204 + c * 26}" cy="${222 + r * 16}" r="3.5" fill="var(--ex-toit)"/>`;
    }
  }
  s += `<circle cx="162" cy="200" r="9" fill="none" stroke="${ENCRE}" stroke-width="3.5"/><circle cx="195" cy="200" r="9" fill="none" stroke="${ENCRE}" stroke-width="3.5"/>`;
  s += `<circle cx="162" cy="191" r="3.5" fill="${ENCRE}"/><circle cx="195" cy="191" r="3.5" fill="${ENCRE}"/>`;
  return s;
}

/**
 * Le 放榜 : la liste affichée au mur du tribunal, sous son toit. En colonnes, de droite à
 * gauche : le nom de l'examen, dessiné depuis ses traits, et « 放榜 » ; les noms des
 * candidats, inventés, écrits avec l'acquis, sans numéro ni rang ; le nom du personnage, au
 * pinceau, après les autres, cerclé de jade ; la date, en chiffres chinois. Le personnage et
 * Tao la lisent en bas (`BANG_HEROS`, `BANG_TAO`).
 */
export const BANG = { w: 393, h: 400 } as const;
export const BANG_HEROS = { left: 0.3, top: 0.608, width: 0.275 } as const;
export const BANG_TAO = { left: 0.478, top: 0.698, width: 0.309 } as const;
/** Le moment où le nom du personnage a fini de s'écrire : le texte vient après. */
export const BANG_FIN = 4.4;

export function dessinBang(
  examen: string,
  entete: string,
  noms: readonly string[],
  heros: string,
  date: string,
  traits: Traits,
  anim = true
): string {
  const { w: W, h: H } = BANG;
  const sol = 300;
  let s = `<rect width="${W}" height="${H}" fill="var(--paper)"/>`;
  s += `<rect x="0" y="36" width="${W}" height="${sol - 36}" fill="var(--ex-mur)"/>`;
  s += `<path d="M-10 40L10 14H383L403 40Z" fill="var(--ex-toit)"/><path d="M-10 40H403" stroke="${ENCRE}" stroke-width="3"/>`;
  s += Array.from({ length: 31 }, (_, i) => `<path d="M${14 + i * 12} 16V38" stroke="var(--ex-tuile)" stroke-width="2"/>`).join('');
  s += `<rect x="0" y="${sol}" width="${W}" height="${H - sol}" fill="var(--ex-sol)"/><path d="M0 ${sol}H${W}" stroke="var(--ex-bord)" stroke-width="2"/>`;
  const bx = 40;
  const by = 54;
  const bw = 313;
  const bh = 222;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="var(--ex-papier)" stroke="${ENCRE}" stroke-width="2.5"/>`;
  s += `<rect x="${bx + 7}" y="${by + 7}" width="${bw - 14}" height="${bh - 14}" fill="none" stroke="${ENCRE}" stroke-width="1"/>`;
  s += `<rect x="${bx + 24}" y="${by - 7}" width="40" height="13" fill="var(--ex-scotch)" stroke="var(--grille)"/><rect x="${bx + bw - 64}" y="${by - 7}" width="40" height="13" fill="var(--ex-scotch)" stroke="var(--grille)"/>`;
  const colW = 29;
  const x0 = bx + bw - 36;
  const nomExamen = [...examen].slice(0, 2);
  nomExamen.forEach((c, k) => (s += caractere(c, traits, x0 - 19, by + 18 + k * 42, 38, ENCRE, anim, 0.1 + k * 1)));
  [...entete].slice(0, 3).forEach(
    (c, k) =>
      (s += `<text x="${x0}" y="${by + 128 + k * 20}" text-anchor="middle" font-family="Noto Serif SC,serif" font-weight="700" font-size="16" fill="var(--ex-toit)">${sur(c)}</text>`)
  );
  s += `<path d="M${x0 - 26} ${by + 18}V${by + bh - 18}" stroke="var(--ex-filet)" stroke-width="1.5"/>`;
  /* le personnage au milieu de la liste, comme n'importe quel nom : sans rang ni numéro */
  const tous = [...noms.slice(0, 3), heros, ...noms.slice(3)];
  const hi = Math.min(3, noms.length);
  const colX = (i: number): number => x0 - 48 - i * colW - (i >= hi ? 7 : 0) - (i > hi ? 7 : 0);
  const d0 = 2.2;
  tous.forEach((n, i) => {
    const x = colX(i);
    if (i === hi) {
      const lettres = [...n].slice(0, 4);
      const pasH = lettres.length > 2 ? 26 : 32;
      const taille = lettres.length > 2 ? 24 : 28;
      lettres.forEach((c, k) => {
        s += /[㐀-鿿]/.test(c)
          ? caractere(c, traits, x - taille / 2, by + 24 + k * pasH, taille, ENCRE, anim, d0 + k)
          : `<text class="apparait" style="--dl:${(d0 + k * 0.3).toFixed(2)}s" x="${x}" y="${by + 24 + k * pasH + taille * 0.8}" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="700" font-size="${taille * 0.8}" fill="${ENCRE}">${sur(c)}</text>`;
      });
      const haut = lettres.length * pasH + 12;
      s += `<rect class="${anim ? 'cercle' : ''}" pathLength="1" style="--dl:${d0 + 2}s" x="${x - 19}" y="${by + 16}" width="38" height="${haut}" rx="19" fill="none" stroke="var(--jade)" stroke-width="3"/>`;
    } else {
      [...n].forEach(
        (c, k) =>
          (s += `<text class="${anim ? 'apparait' : ''}" style="--dl:${(0.3 + i * 0.15).toFixed(2)}s" x="${x}" y="${by + 46 + k * 31}" text-anchor="middle" font-family="Noto Serif SC,serif" font-weight="500" font-size="23" fill="${ENCRE}">${sur(c)}</text>`)
      );
    }
  });
  const xd = colX(tous.length) + 4;
  [...date].forEach(
    (c, k) =>
      (s += `<text x="${xd}" y="${by + bh - 90 + k * 15}" text-anchor="middle" font-family="Noto Serif SC,serif" font-weight="500" font-size="12" fill="var(--ex-gris)">${sur(c)}</text>`)
  );
  return s;
}
