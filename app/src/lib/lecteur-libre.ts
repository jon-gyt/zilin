/**
 * « Lire le monde » : on colle ou tape un texte chinois (une enseigne, un menu, un message),
 * et l'app dit ce qu'on en lit déjà (rapport comparatif du 28 septembre 2026, §2.5).
 *
 * Module pur : il ne lit ni le réseau, ni l'horloge, ni le DOM. L'écran (`Chercher.svelte`)
 * lui passe ce qu'il a lu de l'export et de la progression :
 *
 * - les caractères lus, par la règle de Ma forêt : une carte dont la stabilité FSRS passe
 *   le seuil de déblocage (`foret.caracteresLus`, `recherche.statut`) ;
 * - le chemin, le jour du parcours où chaque caractère entre (`etageres.joursDuChemin`), et
 *   le dernier jour fait : un caractère à venir dit « dans N j », en jours du chemin, par
 *   le même calcul que l'étagère « Bientôt » de Lire (`etageres.dansCombien`) ; rien ne
 *   s'estime, un caractère hors du chemin ne dit rien ;
 * - le lexique des mots de deux caractères que l'export porte (mots des fiches, mots du
 *   dictionnaire éclair) : deux caractères lus côte à côte qui forment l'un d'eux sont
 *   reconnus comme un mot.
 *
 * Seuls les sinogrammes comptent : la ponctuation, les chiffres, les lettres et les espaces
 * restent dans le texte montré, mais ni dans le total, ni dans les lus. Ce n'est pas un
 * jeu : rien n'est noté, rien ne rapporte de point.
 */
import { dansCombien } from './etageres';
import { SEUIL_DEBLOCAGE, stability, type ReviewCard } from './srs';
import { remplir, type TextesLireLeMonde } from './ecrans';

/* ---------- les sinogrammes ---------- */

/** Un sinogramme : l'écriture Han d'Unicode, extensions et idéogrammes de compatibilité compris. */
export function estSinogramme(x: string): boolean {
  return /^\p{Script=Han}$/u.test(x);
}

/* ---------- ce que l'app sait du lecteur ---------- */

/** Les caractères lus : ceux dont la carte passe le seuil de déblocage, la règle de Ma forêt. */
export function caracteresLus(cartes: readonly ReviewCard[], seuil: number = SEUIL_DEBLOCAGE): Set<string> {
  return new Set(cartes.filter((k) => stability(k) >= seuil).map((k) => k.id));
}

/** Un mot de deux caractères que l'export porte, avec ce qu'il en dit. */
export type MotConnu = { hanzi: string; pinyin: string; fr: string };

/**
 * Le lexique des mots de deux sinogrammes, par leur graphie. Le premier venu l'emporte :
 * les mots des fiches d'abord, puis ceux de l'éclair. Un mot sans sens n'y entre pas.
 */
export function lexique(...sources: readonly (readonly MotConnu[])[]): Map<string, MotConnu> {
  const out = new Map<string, MotConnu>();
  for (const liste of sources) {
    for (const m of liste) {
      const cs = Array.from(m.hanzi.normalize('NFC'));
      if (cs.length !== 2 || !cs.every(estSinogramme) || m.fr.trim() === '') continue;
      const cle = cs.join('');
      if (!out.has(cle)) out.set(cle, { hanzi: cle, pinyin: m.pinyin, fr: m.fr.trim() });
    }
  }
  return out;
}

export type Contexte = {
  lus: ReadonlySet<string>;
  /** Le jour du chemin où chaque caractère entre (`etageres.joursDuChemin`). */
  chemin: ReadonlyMap<string, number>;
  /** Le dernier jour du chemin fait : ses caractères sont déjà entrés. */
  fait: number;
  mots: ReadonlyMap<string, MotConnu>;
};

/* ---------- la lecture ---------- */

/** Un sinogramme lu (jade), sur le chemin (« dans N j »), ou ni l'un ni l'autre (encre). */
export type EtatSigne = 'lu' | 'chemin' | 'encre';

/** Sa place dans un mot reconnu : le premier ou le second caractère. */
export type PlaceMot = { i: number; place: 'debut' | 'fin' };

export type Signe =
  | { han: false; t: string }
  | { han: true; c: string; etat: EtatSigne; dans: number | null; mot: PlaceMot | null };

export type Lecture = {
  signes: Signe[];
  /** Les sinogrammes lus, chaque occurrence comptée. */
  lus: number;
  /** Les sinogrammes du texte, chaque occurrence comptée ; ni ponctuation, ni lettres. */
  total: number;
  /** Les mots reconnus, chacun une fois, dans l'ordre où ils paraissent. */
  mots: MotConnu[];
};

/**
 * Lit un texte. Chaque sinogramme est lu, sur le chemin (avec son « dans N j »), ou reste à
 * l'encre ; les autres signes passent tels quels. Deux sinogrammes lus côte à côte qui
 * forment un mot du lexique sont reconnus ensemble, de gauche à droite, sans chevauchement.
 */
export function lire(texte: string, ctx: Contexte): Lecture {
  const signes: Signe[] = [];
  for (const x of Array.from(texte.normalize('NFC'))) {
    if (!estSinogramme(x)) {
      const dernier = signes[signes.length - 1];
      if (dernier && !dernier.han) dernier.t += x;
      else signes.push({ han: false, t: x });
      continue;
    }
    const lu = ctx.lus.has(x);
    const dans = lu ? null : dansCombien(ctx.chemin.get(x) ?? null, ctx.fait);
    signes.push({ han: true, c: x, etat: lu ? 'lu' : dans !== null ? 'chemin' : 'encre', dans, mot: null });
  }

  const mots: MotConnu[] = [];
  for (let k = 0; k + 1 < signes.length; k++) {
    const a = signes[k];
    const b = signes[k + 1];
    if (!a.han || !b.han || a.etat !== 'lu' || b.etat !== 'lu') continue;
    const m = ctx.mots.get(a.c + b.c);
    if (!m) continue;
    let i = mots.findIndex((x) => x.hanzi === m.hanzi);
    if (i < 0) i = mots.push(m) - 1;
    a.mot = { i, place: 'debut' };
    b.mot = { i, place: 'fin' };
    k++;
  }

  const hans = signes.filter((s) => s.han);
  return { signes, lus: hans.filter((s) => s.etat === 'lu').length, total: hans.length, mots };
}

/* ---------- la mise en page ---------- */

/** Ce qui ne se coupe pas en fin de ligne : un signe seul, ou les deux caractères d'un mot. */
export type Unite = { signes: Signe[]; mot: number | null };

/** Les signes en unités : un mot reconnu reste d'un tenant, jamais coupé entre deux lignes. */
export function unites(signes: readonly Signe[]): Unite[] {
  const out: Unite[] = [];
  for (let k = 0; k < signes.length; k++) {
    const s = signes[k];
    const suivant = signes[k + 1];
    if (s.han && s.mot?.place === 'debut' && suivant?.han && suivant.mot?.place === 'fin') {
      out.push({ signes: [s, suivant], mot: s.mot.i });
      k++;
    } else {
      out.push({ signes: [s], mot: null });
    }
  }
  return out;
}

/* ---------- les lignes, par les textes du pipeline ---------- */

/** « Tu lis 9 caractères sur 14. » ; sans aucun sinogramme, le dit. */
export function ligneCompte(t: TextesLireLeMonde, l: Pick<Lecture, 'lus' | 'total'>): string {
  if (l.total === 0) return t['sans-chinois'];
  return remplir(l.lus > 1 ? t.compte : t['compte-un'], { lus: l.lus, total: l.total });
}

/** « dans 12 j » sous un caractère du chemin ; « demain » pour le jour suivant. */
export function ligneDans(t: TextesLireLeMonde, n: number): string {
  return n === 1 ? t.demain : remplir(t.dans, { n });
}
