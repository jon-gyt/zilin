/**
 * Chercher : trouver un caractère de l'export par son dessin, son pinyin ou son sens.
 *
 * Module pur : il ne lit ni le réseau, ni l'horloge, ni le DOM. Le corpus se construit
 * sur les familles que `content.toutesLesFamilles` a lues — l'export et lui seul, aucun
 * dictionnaire embarqué — et le statut d'un caractère se lit sur les cartes de la
 * progression, par la même règle que Ma forêt (`foret.avancement`).
 *
 * Le classement, dans cet ordre :
 *
 * 1. le caractère lui-même (on a tapé ou collé 好) ;
 * 2. le pinyin exact, avec ou sans ton (`hao`, `hǎo`, `hao3`) ;
 * 3. un pinyin qui commence par la saisie (`ha` → hǎo, hàn…) ;
 * 4. le sens français, et seulement celui d'une fiche relue.
 */
import type { Famille, Fiche } from './content';
import { avancement, caracteresDe, etat } from './foret';
import { SEUIL_DEBLOCAGE, type ReviewCard } from './srs';

/** Au plus vingt résultats : une liste qui se lit d'un coup de pouce. */
export const MAX_RESULTATS = 20;

/** La ligne de l'écran vide. */
export const AIDE = 'Un caractère, son pinyin, ou un mot français';

/* ---------- le corpus ---------- */

/** Un caractère cherchable : ce que l'export en dit, et sa famille. */
export type Entree = {
  c: string;
  pinyin: string;
  /** Le sens d'une fiche relue ; vide tant que la fiche ne l'est pas. */
  fr: string;
  /** La racine de sa famille dans l'export. */
  racine: string;
  /** Sa place dans l'export : départage deux résultats de même rang. */
  ordre: number;
};

/**
 * Le sens qu'on peut chercher et montrer : celui d'une fiche relue, rien d'autre. La
 * surcouche de démonstration n'est pas une fiche relue et n'entre pas ici.
 */
export function sensRelu(f: Pick<Fiche, 'fr' | 'statut'>): string {
  return f.statut === 'relu' ? f.fr.trim() : '';
}

/**
 * Le corpus de la recherche : chaque caractère des familles exportées, une fois, dans
 * l'ordre de l'export. Une racine que ses fiches ne portent pas entre avec sa brique.
 */
export function corpus(familles: readonly Famille[]): Entree[] {
  const vus = new Set<string>();
  const out: Entree[] = [];
  for (const f of familles) {
    for (const c of caracteresDe(f)) {
      if (vus.has(c)) continue;
      vus.add(c);
      const x = f.fiches.find((y) => y.c === c);
      out.push({
        c,
        pinyin: x ? x.pinyin : f.racine.pinyin,
        fr: x ? sensRelu(x) : '',
        racine: f.racine.c,
        ordre: out.length
      });
    }
  }
  return out;
}

/* ---------- le pinyin, normalisé ---------- */

/** Une syllabe réduite à ses lettres (sans ton, ü écrit u) et son ton, s'il est dit. */
export type Syllabe = { base: string; ton: number | null };

/** Les diacritiques des tons, après décomposition Unicode (NFD). */
const DIACRITIQUES: readonly [RegExp, number][] = [
  [/\u0304/, 1], // ā, macron
  [/\u0301/, 2], // á, aigu
  [/\u030C/, 3], // ǎ, caron
  [/\u0300/, 4] // à, grave
];

/**
 * Lit un pinyin : `hǎo`, `hao3`, `HAO` et `hao` ont la même base, `hao`. Le ton vient
 * du diacritique ou du chiffre final (0 et 5 : ton neutre, noté 5). Le ü s'écrit aussi
 * `u`, `v` ou `u:`. Sans ton dit, `neutre` décide : `null` pour une saisie (« n'importe
 * quel ton »), 5 pour le pinyin de l'export, où l'absence de marque est le ton neutre.
 */
export function lirePinyin(s: string, neutre: number | null = null): Syllabe {
  const d = s.normalize('NFD').toLowerCase().trim();
  let ton: number | null = null;
  for (const [re, n] of DIACRITIQUES) if (re.test(d)) ton = n;
  const chiffre = /([0-5])$/.exec(d);
  if (chiffre) ton = Number(chiffre[1]) === 0 ? 5 : Number(chiffre[1]);
  const base = d
    .replace(/u:/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  return { base, ton: ton ?? (base === '' ? null : neutre) };
}

/** Les lectures d'un pinyin exporté : une seule aujourd'hui, plusieurs si l'export en écrit. */
function lectures(pinyin: string): Syllabe[] {
  return pinyin
    .split(/[\s,;/]+/)
    .filter((x) => x !== '')
    .map((x) => lirePinyin(x, 5));
}

/** Le français sans accents ni majuscules, pour comparer un mot à un sens. */
export function plat(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/* ---------- chercher ---------- */

/** Le rang d'un résultat : plus il est petit, plus il vient tôt. */
export const RANG = { caractere: 0, pinyin: 1, prefixe: 2, sens: 3 } as const;
export type Rang = (typeof RANG)[keyof typeof RANG];

export type Resultat = Entree & { rang: Rang };

export type Recherche = {
  /** Au plus `MAX_RESULTATS`, dans l'ordre du classement. */
  resultats: Resultat[];
  /** Combien de caractères répondaient avant la coupe. */
  total: number;
};

/**
 * Les caractères d'une saisie : tout ce qui n'est ni espace, ni lettre latine (accents
 * compris), ni chiffre. Les composants de l'export hors du bloc Han (㇆, ㇑…) en sont.
 */
export function caracteresTapes(s: string): string[] {
  const out: string[] = [];
  for (const x of Array.from(s.normalize('NFC'))) {
    if (/[\s\p{ASCII}\p{Script=Latin}\p{M}]/u.test(x) || out.includes(x)) continue;
    out.push(x);
  }
  return out;
}

/** Le rang d'une entrée pour une saisie, avec la clé qui départage le rang ; `null` : pas de réponse. */
function rang(
  e: Entree,
  caracteres: readonly string[],
  py: Syllabe,
  mot: string
): { rang: Rang; cle: number } | null {
  const i = caracteres.indexOf(e.c);
  if (i >= 0) return { rang: RANG.caractere, cle: i };

  if (py.base !== '') {
    let meilleur: { rang: Rang; cle: number } | null = null;
    for (const l of lectures(e.pinyin)) {
      if (py.ton !== null && l.ton !== py.ton) continue;
      const tonCle = l.ton ?? 5;
      if (l.base === py.base) {
        meilleur = { rang: RANG.pinyin, cle: tonCle };
        break;
      }
      if (l.base.startsWith(py.base) && meilleur === null) {
        /* Le plus court d'abord : ha → hao avant hang. Puis le ton. */
        meilleur = { rang: RANG.prefixe, cle: l.base.length * 10 + tonCle };
      }
    }
    if (meilleur) return meilleur;
  }

  if (mot.length >= 2 && e.fr !== '') {
    const sens = plat(e.fr);
    const mots = sens.split(/[^a-z0-9]+/).filter((x) => x !== '');
    if (mots.includes(mot)) return { rang: RANG.sens, cle: 0 };
    if (mots.some((x) => x.startsWith(mot)) || (mot.includes(' ') && sens.includes(mot))) {
      return { rang: RANG.sens, cle: 1 };
    }
  }
  return null;
}

/**
 * Cherche une saisie dans le corpus. Les caractères tapés répondent d'abord, dans
 * l'ordre de la saisie ; puis le pinyin exact, le préfixe de pinyin, le sens. À rang
 * égal, le ton (1 à 5), puis l'ordre de l'export.
 */
export function chercher(
  q: string,
  entrees: readonly Entree[],
  max: number = MAX_RESULTATS
): Recherche {
  const saisie = q.trim();
  if (saisie === '') return { resultats: [], total: 0 };
  const caracteres = caracteresTapes(saisie);
  const py = lirePinyin(saisie);
  const mot = plat(saisie);
  const trouves: { r: Resultat; cle: number }[] = [];
  for (const e of entrees) {
    const x = rang(e, caracteres, py, mot);
    if (x) trouves.push({ r: { ...e, rang: x.rang }, cle: x.cle });
  }
  trouves.sort((a, b) => a.r.rang - b.r.rang || a.cle - b.cle || a.r.ordre - b.r.ordre);
  return { resultats: trouves.slice(0, max).map((x) => x.r), total: trouves.length };
}

/* ---------- le statut, lu sur les cartes ---------- */

/** Trois statuts, ceux de Ma forêt : acquis, en cours, à venir. */
export type StatutLecture = 'lu' | 'encours' | 'pasencore';

export const LIBELLES_STATUT: Record<StatutLecture, string> = {
  lu: 'lu',
  encours: 'en cours',
  pasencore: 'pas encore'
};

/**
 * Le statut d'un caractère pour l'utilisateur, par la règle de Ma forêt : « lu » quand
 * sa carte passe le seuil de déblocage, « en cours » dès qu'elle existe, sinon « pas
 * encore ».
 */
export function statut(
  c: string,
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): StatutLecture {
  const e = etat(avancement(c, cartes, seuil));
  return e === 'acquis' ? 'lu' : e === 'encours' ? 'encours' : 'pasencore';
}

/* ---------- la ligne sous le champ ---------- */

/**
 * Ce que l'écran dit sous le champ. Une recherche qui ne trouve rien le dit simplement ;
 * quand aucune fiche n'a encore de sens relu, on le dit aussi, sans rien feindre.
 */
export function ligne(q: string, r: Recherche, entrees: readonly Entree[]): string {
  const saisie = q.trim();
  if (saisie === '') return AIDE;
  if (r.total > 0) {
    const n = r.resultats.length;
    const tete = r.total > n ? `Les ${n} premiers sur ${r.total}.` : `${n} caractère${n > 1 ? 's' : ''}.`;
    return `${tete} Touche pour écouter et ouvrir sa famille.`;
  }
  if (caracteresTapes(saisie).length > 0 && lirePinyin(saisie).base === '') {
    return "Ce caractère n'est pas encore dans Wenlu.";
  }
  if (!entrees.some((e) => e.fr !== '')) {
    return `Rien pour « ${saisie} ». Les sens en français ne sont pas encore écrits : cherche un caractère ou son pinyin.`;
  }
  return `Rien pour « ${saisie} ».`;
}
