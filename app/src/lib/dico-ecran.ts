/**
 * L'écran du dictionnaire 字典 (story 10.8, maquette `maquettes/dictionnaire.html`) : ce que la
 * loupe Chercher montre de la recherche (`dictionnaire.ts`) et des fiches. Module pur : ni
 * réseau, ni horloge, ni DOM, ni texte d'interface (ils viennent de `ecrans.json`,
 * `dictionnaire`).
 *
 * Les règles, une par fonction :
 *
 * - le statut de Mon chemin : lu (jade), en cours, « dans N j » en jours du chemin (indigo), ou
 *   hors du chemin ; un mot prend celui de ses caractères ;
 * - un mot d'un seul caractère (好 adjectif, 号 nom) se range sous la fiche du caractère, pas en
 *   ligne à part dans les résultats (décision de la story 10.8) ;
 * - le sens ne se montre que relu : celui du dictionnaire, ou celui d'une fiche relue des
 *   familles ; sinon, rien, et la fiche dit que le sens est en relecture ;
 * - l'origine vient de la fiche relue avec son étiquette, attestée ou mnémotechnique, jamais
 *   l'une pour l'autre : celle des familles, ou, pour un caractère hors des familles, celle
 *   que l'entrée du dictionnaire porte (story 10.11) ; sinon « origine à venir » ;
 * - les pastilles de ton, pour une syllabe tapée sans ton qui répond à plusieurs tons ;
 * - le compagnon : Tao avant la rencontre de Xing au 县试, Xing après (`xing.ts`).
 */
import type { Brique, Etiquette, Famille, FicheLue, Role } from './content';
import type { Acception, EntreeDico, IndexDico, OrigineDico, ResultatDico, Sens, Syllabe } from './dictionnaire';
import type { TextesDictionnaire } from './ecrans';
import { remplir } from './ecrans';
import { marquerTon } from './questions';
import { sensRelu } from './recherche';
import { POSTURES, POSTURES_TAO, guide, type Guide, type PostureXing } from './xing';
import type { Posture } from './tao';

/* ---------- le statut de Mon chemin ---------- */

/** Ce que le dictionnaire sait de l'apprenant, lu dans sa progression et le parcours. */
export type ContexteStatut = {
  /** Les caractères lus : leur carte passe le seuil de déblocage (`lecteur-libre.caracteresLus`). */
  lus: ReadonlySet<string>;
  /** Les caractères qui ont une carte, lus ou non. */
  cartes: ReadonlySet<string>;
  /** Le jour du chemin où chaque caractère est posé (`etageres.joursDuChemin`). */
  chemin: ReadonlyMap<string, number>;
  /** Le dernier jour du chemin fait. */
  fait: number;
};

/**
 * Lu (jade) ; en cours (posé, pas encore stable) ; sur le chemin, dans `n` jours du chemin
 * (indigo) ; hors du chemin. `jour` : le jour du chemin où il est posé.
 */
export type StatutDico =
  | { k: 'lu'; jour: number | null }
  | { k: 'encours'; jour: number | null }
  | { k: 'chemin'; n: number; jour: number }
  | { k: 'hors' };

/** Le statut d'un caractère, par la règle de Mon chemin. */
export function statutCaractere(c: string, ctx: ContexteStatut): StatutDico {
  const jour = ctx.chemin.get(c) ?? null;
  if (ctx.lus.has(c)) return { k: 'lu', jour };
  if (jour !== null && jour > ctx.fait) return { k: 'chemin', n: jour - ctx.fait, jour };
  if (jour !== null || ctx.cartes.has(c)) return { k: 'encours', jour };
  return { k: 'hors' };
}

/**
 * Le statut d'un mot, celui de ses caractères : lu quand tous le sont ; hors du chemin dès
 * que l'un l'est ; sinon sur le chemin, le jour du dernier à venir ; sinon en cours.
 */
export function statutMot(hanzi: string, ctx: ContexteStatut): StatutDico {
  const s = Array.from(hanzi).map((c) => statutCaractere(c, ctx));
  if (s.length === 0) return { k: 'hors' };
  if (s.every((x) => x.k === 'lu')) return { k: 'lu', jour: null };
  if (s.some((x) => x.k === 'hors')) return { k: 'hors' };
  const venir = s.filter((x): x is Extract<StatutDico, { k: 'chemin' }> => x.k === 'chemin');
  if (venir.length > 0) {
    const dernier = venir.reduce((a, b) => (b.n > a.n ? b : a));
    return { k: 'chemin', n: dernier.n, jour: dernier.jour };
  }
  return { k: 'encours', jour: null };
}

/** Le statut court d'une ligne : « lu », « en cours », « dans 12 j », « hors du chemin ». */
export function libelleStatut(s: StatutDico, t: TextesDictionnaire, brique = false): string {
  if (s.k === 'lu') return brique ? t.lue : t.lu;
  if (s.k === 'encours') return t.encours;
  if (s.k === 'chemin') return remplir(t.dans, { n: s.n });
  return t.hors;
}

/* ---------- le pinyin et le niveau ---------- */

/** Une syllabe numérotée en pinyin accentué : `hao3` → hǎo, `nv3` → nǚ, `ma5` → ma. */
export function syllabeAccentuee(s: Syllabe): string {
  const base = s.base.replace(/v/g, 'ü');
  if (s.ton < 1 || s.ton > 4) return base;
  return marquerTon(base, s.ton) ?? base;
}

/**
 * Une lecture en pinyin accentué, d'un tenant : `hao3 kan4` → hǎokàn. Une syllabe qui
 * commence par a, e ou o prend l'apostrophe (xī'ān) ; le 儿 de l'érhua se colle (wánr).
 */
export function pinyinDe(lecture: readonly Syllabe[]): string {
  return lecture
    .map((s, i) => {
      const p = syllabeAccentuee(s);
      return i > 0 && /^[aeoāáǎàēéěèōóǒò]/.test(p) ? `'${p}` : p;
    })
    .join('');
}

/** Le niveau d'une entrée tel qu'il s'affiche : 1 à 6, puis « 7-9 » ; 0, hors HSK. */
export function libelleNiveau(niveau: number, t: TextesDictionnaire): string {
  if (niveau <= 0) return t['hors-hsk'];
  return remplir(t.hsk, { n: niveau >= 7 ? '7-9' : niveau });
}

/* ---------- les mots d'un seul caractère ---------- */

/** Un mot de la liste qui s'écrit d'un seul caractère : 好 adjectif, 号 nom. */
export function estMotDUnCaractere(e: Pick<EntreeDico, 'genre' | 'formes'>): boolean {
  return e.genre === 'mot' && Array.from(e.formes[0] ?? '').length === 1;
}

export type Rangement = { caracteres: ResultatDico[]; mots: ResultatDico[] };

/**
 * Les résultats d'une recherche, rangés : les caractères, puis les mots, dans l'ordre de
 * `dictionnaire.ts`. Un mot d'un seul caractère ne fait pas de ligne : il se lit dans la fiche
 * de son caractère, qui prend sa place s'il n'est pas déjà dans la liste.
 */
export function ranger(resultats: readonly ResultatDico[], index: Pick<IndexDico, 'entrees'>): Rangement {
  const caracteres: ResultatDico[] = [];
  const mots: ResultatDico[] = [];
  const vus = new Set<string>();
  const parCaractere = new Map(index.entrees.filter((e) => e.genre === 'caractere').map((e) => [e.id, e]));
  for (const r of resultats) {
    if (r.genre === 'caractere') {
      if (!vus.has(r.id)) caracteres.push(r);
      vus.add(r.id);
    } else if (estMotDUnCaractere(r)) {
      const c = r.formes[0];
      const e = parCaractere.get(c);
      if (e && !vus.has(c)) caracteres.push({ ...e, rang: r.rang, cle: r.cle });
      vus.add(c);
    } else {
      mots.push(r);
    }
  }
  return { caracteres, mots };
}

/** Les mots d'un seul caractère, rangés sous sa fiche : par niveau, puis dans l'ordre de l'index. */
export function motsDUnCaractere(c: string, index: Pick<IndexDico, 'entrees'>): EntreeDico[] {
  return index.entrees
    .filter((e) => estMotDUnCaractere(e) && e.formes[0] === c)
    .sort((a, b) => a.niveau - b.niveau || a.ordre - b.ordre);
}

/**
 * Les mots qui contiennent un caractère, dans l'ordre de son entrée (par niveau, puis dans
 * l'ordre de la norme), sans ceux d'un seul caractère, rangés à part.
 */
export function motsQuiContiennent(ids: readonly string[], index: Pick<IndexDico, 'entrees'>): EntreeDico[] {
  const parId = new Map(index.entrees.filter((e) => e.genre === 'mot').map((e) => [e.id, e]));
  return ids.map((id) => parId.get(id)).filter((e): e is EntreeDico => e !== undefined && !estMotDUnCaractere(e));
}

/** Au plus autant de mots proches. */
export const MAX_PROCHES = 6;

/**
 * Les mots proches d'un mot : ceux qui partagent un de ses caractères, de même longueur, le
 * niveau le plus voisin d'abord (好看 → 难看, 好听, 好吃).
 */
export function motsProches(
  mot: Pick<EntreeDico, 'id' | 'formes' | 'niveau'>,
  index: Pick<IndexDico, 'entrees'>,
  max: number = MAX_PROCHES
): EntreeDico[] {
  const cs = new Set(Array.from(mot.formes[0] ?? ''));
  const n = cs.size === 0 ? 0 : Array.from(mot.formes[0]).length;
  return index.entrees
    .filter(
      (e) =>
        e.genre === 'mot' &&
        e.id !== mot.id &&
        Array.from(e.formes[0] ?? '').length === n &&
        e.formes[0] !== mot.formes[0] &&
        Array.from(e.formes[0]).some((c) => cs.has(c))
    )
    .sort((a, b) => Math.abs(a.niveau - mot.niveau) - Math.abs(b.niveau - mot.niveau) || a.niveau - b.niveau || a.ordre - b.ordre)
    .slice(0, max);
}

/* ---------- les pastilles de ton ---------- */

export type Pastilles = { base: string; tons: number[] };

/**
 * Les pastilles de ton : une syllabe tapée sans ton (`hao`), à laquelle répondent des
 * caractères de plusieurs tons. `null` sinon : un ton déjà dit, plusieurs syllabes, un
 * caractère, du français, ou un seul ton.
 */
export function pastillesDeTon(
  q: string,
  rangement: Pick<Rangement, 'caracteres'>,
  syllabes: ReadonlySet<string>
): Pastilles | null {
  const base = q.trim().toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v');
  if (!/^[a-z]+$/.test(base) || !syllabes.has(base)) return null;
  const tons = new Set<number>();
  for (const r of rangement.caracteres) {
    for (const l of r.lectures) if (l.length === 1 && l[0].base === base) tons.add(l[0].ton);
  }
  return tons.size > 1 ? { base, tons: [...tons].sort((a, b) => a - b) } : null;
}

/** Une entrée a-t-elle une lecture de cette syllabe à ce ton ? */
export function aLeTon(e: Pick<EntreeDico, 'lectures'>, base: string, ton: number): boolean {
  return e.lectures.some((l) => l.some((s) => s.base === base && s.ton === ton));
}

/** Les résultats d'un ton choisi. `0` : tous. */
export function filtrerParTon(r: Rangement, p: Pastilles | null, ton: number): Rangement {
  if (p === null || ton === 0 || !p.tons.includes(ton)) return r;
  return {
    caracteres: r.caracteres.filter((e) => aLeTon(e, p.base, ton)),
    mots: r.mots.filter((e) => aLeTon(e, p.base, ton))
  };
}

/**
 * La lecture qu'une ligne montre : la principale, ou, un ton choisi, celle qui a ce ton (好
 * sous « hào »).
 */
export function lectureDeLigne(e: Pick<EntreeDico, 'lectures'>, p: Pastilles | null, ton: number): Syllabe[] {
  if (p !== null && ton !== 0) {
    const l = e.lectures.find((x) => x.some((s) => s.base === p.base && s.ton === ton));
    if (l) return l;
  }
  return e.lectures[0] ?? [];
}

/* ---------- le sens, relu seulement ---------- */

/**
 * Les sens relus de l'export des familles, par graphie : celui de chaque caractère d'une
 * fiche relue, et celui des mots qu'elle porte. La surcouche de démonstration n'y entre pas.
 */
export function glosesRelues(familles: readonly Famille[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of familles) {
    for (const x of f.fiches) {
      if (x.statut !== 'relu') continue;
      const s = sensRelu(x);
      if (s !== '' && !out.has(x.c)) out.set(x.c, s);
      for (const m of x.mots) {
        const fr = m.fr.trim();
        if (fr !== '' && !out.has(m.hanzi)) out.set(m.hanzi, fr);
      }
    }
  }
  return out;
}

/** La glose d'une ligne : celle de l'index (relue), sinon celle d'une fiche relue ; sinon rien. */
export function gloseDeLigne(e: Pick<EntreeDico, 'glose' | 'formes'>, relues: ReadonlyMap<string, string>): string {
  return e.glose !== '' ? e.glose : (relues.get(e.formes[0] ?? '') ?? '');
}

/** Le sens d'une fiche : acceptions ou glose. */
export type SensAffiche = { glose: string; acceptions: Acception[] };

/**
 * Le sens qu'une fiche montre : celui du dictionnaire, relu (`sensAffichable` n'en laisse
 * passer aucun autre), sinon celui d'une fiche relue ; `null` : le sens est en relecture.
 */
export function sensDeFiche(sens: Sens | null, relue: string): SensAffiche | null {
  if (sens !== null && sens.statut === 'relu' && sens.glose !== '') {
    return { glose: sens.glose, acceptions: sens.acceptions };
  }
  return relue.trim() === '' ? null : { glose: relue.trim(), acceptions: [] };
}

/* ---------- l'origine, étiquetée ---------- */

export type OrigineAffichee = { texte: string; etiquette: Etiquette };

/**
 * L'origine d'une fiche : le texte d'une fiche relue de l'export et son étiquette à elle,
 * sinon celui que l'entrée du dictionnaire porte (une fiche relue, hors des familles), ou
 * celui de la brique racine d'une famille, relu. Jamais d'étiquette sans texte, jamais le
 * texte de l'une avec l'étiquette de l'autre, jamais une démonstration ni un aperçu à
 * relire : `null`, et la fiche dit « origine à venir ».
 */
export function origineDeFiche(
  f: FicheLue | null,
  racine: Brique | null,
  dico: OrigineDico | null = null
): OrigineAffichee | null {
  if (f && f.source === 'export' && f.statut === 'relu' && f.origine_fr.trim() !== '' && f.etiquette) {
    return { texte: f.origine_fr.trim(), etiquette: f.etiquette };
  }
  if (dico && dico.statut === 'relu' && dico.fr.trim() !== '' && dico.etiquette) {
    return { texte: dico.fr.trim(), etiquette: dico.etiquette };
  }
  if (racine && racine.origine.trim() !== '' && racine.etiquette) {
    return { texte: racine.origine.trim(), etiquette: racine.etiquette };
  }
  return null;
}

/**
 * Le rôle de chaque brique, lu dans la fiche relue, et seulement si elle décompose comme le
 * dictionnaire (GF 0014-2009) ; sinon dans l'origine relue de l'entrée du dictionnaire, qui
 * ne porte des rôles que sur sa décomposition ; `null` sinon : les rôles viendront avec la
 * fiche relue.
 */
export function rolesDesBriques(
  f: FicheLue | null,
  parts: readonly string[],
  dico: OrigineDico | null = null
): Record<string, Role> | null {
  const complets = (roles: Record<string, Role>): boolean => parts.every((p) => p in roles);
  if (f && f.source === 'export' && f.statut === 'relu' && f.roles) {
    const memes = f.parts.length === parts.length && f.parts.every((p, i) => p === parts[i]);
    if (memes && complets(f.roles)) return f.roles;
  }
  if (dico && dico.statut === 'relu' && complets(dico.roles)) return dico.roles;
  return null;
}

/* ---------- le compagnon ---------- */

export type Compagnon = { guide: Guide; posture: PostureXing | Posture };

/** Tao lit par-dessus l'épaule avant la rencontre de Xing au 县试 ; Xing tient le livre ouvert après. */
export function compagnonDuDico(rencontre: boolean): Compagnon {
  const g = guide('dictionnaire', rencontre);
  return { guide: g, posture: g === 'xing' ? POSTURES.dictionnaire : POSTURES_TAO.dictionnaire };
}

/* ---------- les lignes, par les textes du pipeline ---------- */

/** « 2 caractères, 12 mots. Touche une ligne pour ouvrir sa fiche. » */
export function ligneResultats(t: TextesDictionnaire, n: number, m: number): string {
  return remplir(t.resultats, {
    caracteres: remplir(n > 1 ? t.caracteres : t['caracteres-un'], { n }),
    mots: remplir(m > 1 ? t.mots : t['mots-un'], { n: m })
  });
}

/* ---------- la navigation et les lignes ---------- */

/** Ce que la loupe montre par-dessus la recherche : une fiche de caractère, de mot, ou le pavé. */
export type VueDico = { t: 'car'; c: string } | { t: 'mot'; id: string } | { t: 'ecrire' };

/** Ce qu'une ligne ou une fiche lit pour se dire : les textes, le statut, les gloses relues. */
export type EnvDico = { t: TextesDictionnaire; ctx: ContexteStatut; relues: ReadonlyMap<string, string> };

export type Ligne = {
  hanzi: string;
  pinyin: string;
  glose: string;
  niveau: string;
  statut: StatutDico;
  libelle: string;
};

/** Une ligne de résultat, de mot ou de mot proche, toute prête. */
export function ligneDe(e: EntreeDico, env: EnvDico, lecture?: readonly Syllabe[]): Ligne {
  const hanzi = e.formes[0] ?? e.id;
  const statut = e.genre === 'caractere' ? statutCaractere(hanzi, env.ctx) : statutMot(hanzi, env.ctx);
  return {
    hanzi,
    pinyin: pinyinDe(lecture ?? e.lectures[0] ?? []),
    glose: gloseDeLigne(e, env.relues),
    niveau: libelleNiveau(e.niveau, env.t),
    statut,
    libelle: libelleStatut(statut, env.t)
  };
}

/** Un nombre à la française : 3 000, 11 092. */
export function nombre(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}
