/**
 * Les gabarits de l'écriture au doigt, tels que le pipeline les exporte dans
 * `ecriture/gabarits.json` (`data/src/wenlu_data/ecriture.py`, `data/schema.md`), nommé par
 * l'index (clé `ecriture`) : les médianes de Make Me a Hanzi (Arphic Public License) des
 * 3 000 caractères du HSK 3.0, `POINTS` points par trait, chaque coordonnée en un signe
 * base64 (64 crans), la boîte du caractère centrée et ramenée à son plus grand côté.
 *
 * Ici, on les relit en tableaux plats (`Float32Array`) : ce que le moteur parcourt des
 * milliers de fois par trait, sans objet ni allocation. Les coordonnées reviennent dans
 * `[-0,5 ; 0,5]`, y vers le bas, comme un tracé normalisé (`reconnaissance.ts`).
 */
/** L'alphabet base64 des URL (RFC 4648 §5) : le signe de rang k dit le cran k. */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Points par trait : un gabarit et un tracé rééchantillonné en ont autant. */
export const POINTS = 8;

/** Crans par coordonnée. */
export const NIVEAUX = 64;

/**
 * Les gabarits relus. Le trait `t` (tous caractères confondus) occupe
 * `points[t * POINTS * 2 … (t + 1) * POINTS * 2[`, en x, y alternés ; le caractère `i` a les
 * traits `debut[i] … debut[i + 1] - 1`, dans l'ordre d'écriture. `niveau[i]` : son niveau du
 * HSK, de 1 à 7 (7 pour 7 à 9).
 */
export type Gabarits = {
  caracteres: string[];
  niveau: Uint8Array;
  debut: Uint32Array;
  points: Float32Array;
};

const RANG = new Map<string, number>([...ALPHABET].map((s, k) => [s, k]));

function rang(s: string): number {
  const k = RANG.get(s);
  if (k === undefined) throw new Error(`Gabarits illisibles : signe « ${s} » hors alphabet`);
  return k;
}

/**
 * Relit `ecriture/gabarits.json`. Lève une erreur au moindre écart de format : mieux vaut
 * un pavé qui le dit qu'un moteur qui devine sur des gabarits décalés.
 */
export function lireGabarits(brut: unknown): Gabarits {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const format = (o.format ?? {}) as Record<string, unknown>;
  if (format.points !== POINTS || format.niveaux !== NIVEAUX || format.alphabet !== ALPHABET) {
    throw new Error('Gabarits illisibles : format inattendu');
  }
  if (typeof o.caracteres !== 'string' || typeof o.traits !== 'string' || typeof o.gabarits !== 'string') {
    throw new Error('Gabarits illisibles : champs absents');
  }
  const caracteres = [...o.caracteres];
  const comptes = o.traits;
  const chaine = o.gabarits;
  if (comptes.length !== caracteres.length) throw new Error('Gabarits illisibles : comptes de traits');

  const niveau = new Uint8Array(caracteres.length);
  const listes = Array.isArray(o.listes) ? (o.listes as unknown[]) : [];
  let i = 0;
  listes.forEach((l, k) => {
    const n = Array.isArray(l) && typeof l[1] === 'number' ? l[1] : 0;
    for (let j = 0; j < n && i < niveau.length; j++) niveau[i++] = k + 1;
  });
  while (i < niveau.length) niveau[i++] = listes.length + 1;

  const debut = new Uint32Array(caracteres.length + 1);
  let total = 0;
  for (let c = 0; c < caracteres.length; c++) {
    debut[c] = total;
    total += rang(comptes[c]);
  }
  debut[caracteres.length] = total;
  if (chaine.length !== total * POINTS * 2) throw new Error('Gabarits illisibles : longueur');

  const points = new Float32Array(total * POINTS * 2);
  for (let k = 0; k < points.length; k++) points[k] = rang(chaine[k]) / (NIVEAUX - 1) - 0.5;
  return { caracteres, niveau, debut, points };
}
