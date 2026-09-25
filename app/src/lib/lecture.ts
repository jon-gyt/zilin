/**
 * Le mode Lire (épic 2c) : la bibliothèque de contes et le découpage d'un conte en unités
 * qui se touchent. Module pur, comme `session.ts` : aucune lecture de fichier, d'horloge
 * ni de stockage. Le contenu vient de l'export (`content.ts`), la progression des cartes.
 *
 * Règles (brief §7, backlog 2c.1 et 2c.2) :
 * - un caractère est acquis selon la règle de Ma forêt (`foret.avancement`) : sa carte
 *   passe le seuil de stabilité FSRS de `srs.ts` ;
 * - l'app ouvre, de chaque conte, la version du seuil le plus haut dont tous les
 *   caractères sont acquis ; sans version lisible, le conte est fermé et dit le seuil
 *   qu'il attend — sauf en mode relecture (Réglages) : un conte fermé s'ouvre quand même,
 *   marqué « pas encore dans ton acquis », et ce que ce mode ouvre ne compte pas comme lu ;
 * - quand la version ouverte est plus riche que toutes celles déjà lues, l'app le signale ;
 * - `gratuit` est un marqueur porté par l'index, et rien d'autre : aucun conte ne se ferme
 *   pour une raison d'achat ;
 * - la bibliothèque suit le catalogue (`index.json`, `catalogue`) : chaque récit prévu y
 *   est, avec ses niveaux, chacun écrit et ouvert, écrit mais fermé, ou pas encore écrit.
 *   Rien n'est estimé : un niveau sans version exportée est « pas encore écrit » ;
 * - un récit long se lit chapitre par chapitre, et reprend là où on l'a laissé ; il n'est
 *   lu (contes lus, trophée) qu'une fois tous ses chapitres lus, le dernier compris.
 */
import type {
  CatalogueConte,
  ChapitreConte,
  Conte,
  IndexConte,
  PhraseConte,
  VersionConte
} from './content';
import { avancement, etat } from './foret';
import { SEUIL_DEBLOCAGE, type ReviewCard } from './srs';

/* ---------- l'acquis ---------- */

/** Un caractère chinois (écriture Han). La ponctuation, les chiffres et les espaces n'en sont pas. */
export function estHan(c: string): boolean {
  return /^\p{Script=Han}$/u.test(c);
}

/**
 * Les caractères acquis, d'après les cartes : la même règle que Ma forêt, un caractère
 * dont l'avancement vaut « acquis » (stabilité FSRS au seuil de déblocage).
 */
export function caracteresAcquis(
  cartes: readonly ReviewCard[],
  seuil: number = SEUIL_DEBLOCAGE
): Set<string> {
  const out = new Set<string>();
  for (const k of cartes) if (etat(avancement(k.id, [k], seuil)) === 'acquis') out.add(k.id);
  return out;
}

/** Les caractères distincts d'une version, titres compris, dans l'ordre d'apparition. */
export function caracteresDeVersion(v: VersionConte): string[] {
  const vus = new Set<string>();
  const textes = [v.titre, ...chapitresDe(v).flatMap((c) => [c.titre, ...c.phrases.map((p) => p.zh)])];
  for (const t of textes) {
    for (const c of Array.from(t)) if (estHan(c)) vus.add(c);
  }
  return [...vus];
}

/** Ce qu'il manque pour lire une version : ses caractères pas encore acquis. */
export function manquants(v: VersionConte, acquis: ReadonlySet<string>): string[] {
  return caracteresDeVersion(v).filter((c) => !acquis.has(c));
}

/** La version ouverte : celle du seuil le plus haut dont tous les caractères sont acquis. */
export function versionLisible(conte: Conte, acquis: ReadonlySet<string>): VersionConte | null {
  let choisie: VersionConte | null = null;
  for (const v of conte.versions) {
    if (manquants(v, acquis).length > 0) continue;
    if (choisie === null || v.seuil > choisie.seuil) choisie = v;
  }
  return choisie;
}

/** Ce que la bibliothèque et le lecteur disent d'une version que l'acquis n'ouvre pas encore. */
export const MENTION_HORS_ACQUIS = 'pas encore dans ton acquis';

/**
 * La version qu'ouvre le mode relecture quand l'acquis n'en ouvre aucune : la première
 * relue, sinon la première à relire. Une version relue passe devant l'aperçu.
 */
export function versionDeRelecture(conte: Conte): VersionConte | null {
  return conte.versions.find((v) => v.statut !== 'a_relire') ?? conte.versions[0] ?? null;
}

/* ---------- les niveaux ---------- */

/**
 * Où en est un niveau d'un conte : écrit et ouvert (sa version est dans l'export et tous
 * ses caractères sont acquis), écrit mais fermé, ou pas encore écrit (prévu au catalogue,
 * aucune version dans l'export).
 */
export type EtatNiveau = 'ouvert' | 'ferme' | 'a_ecrire';

export type NiveauConte = { seuil: number; etat: EtatNiveau };

/** Ce que l'écran dit d'un niveau, pour qui ne voit pas le sceau. */
export const ETATS_NIVEAU: Record<EtatNiveau, string> = {
  ouvert: 'écrit et ouvert',
  ferme: 'écrit, pas encore ouvert',
  a_ecrire: 'pas encore écrit'
};

/**
 * Les niveaux d'un conte, croissants : ceux que le catalogue prévoit, et toute version
 * écrite en plus (un seuil que l'index annonce sans que son fichier se lise reste « écrit
 * mais fermé »). Rien n'est estimé : sans version, un niveau est « pas encore écrit ».
 */
export function niveauxDuConte(
  prevus: readonly number[],
  annonces: readonly number[],
  conte: Conte | null,
  acquis: ReadonlySet<string>
): NiveauConte[] {
  const versions = new Map((conte?.versions ?? []).map((v) => [v.seuil, v]));
  const seuils = [...new Set([...prevus, ...annonces, ...versions.keys()])].sort((a, b) => a - b);
  return seuils.map((seuil) => {
    const v = versions.get(seuil);
    if (v) return { seuil, etat: manquants(v, acquis).length === 0 ? 'ouvert' : 'ferme' };
    return { seuil, etat: annonces.includes(seuil) ? 'ferme' : 'a_ecrire' };
  });
}

/* ---------- la bibliothèque ---------- */

/** Un conte dans la bibliothèque, tel que l'écran le montre. */
export type EntreeConte = {
  id: string;
  /** Le vrai titre du récit (愚公移山), montré même hors de l'acquis ; vide s'il manque. */
  titre_zh: string;
  titre_pinyin: string;
  titre_fr: string;
  /** Marqueur de l'offre gratuite, lu dans l'index. Il ne ferme rien. */
  gratuit: boolean;
  /** La version ouverte, `null` quand le conte est fermé. */
  version: VersionConte | null;
  /** Fermé : le seuil de la première version, celle qu'il attend. `null` s'il est ouvert. */
  attend: number | null;
  /** Fermé : les caractères qu'il reste à acquérir pour cette première version. */
  reste: number;
  /** La version ouverte a déjà été lue. */
  lue: boolean;
  /** 2c.2 : la version ouverte est plus riche que toutes celles déjà lues. */
  plusRiche: boolean;
  /**
   * Mode relecture : la version ouverte a des caractères que l'acquis n'a pas encore. Elle
   * se lit quand même, marquée « pas encore dans ton acquis ».
   */
  horsAcquis: boolean;
  /**
   * La version ouverte ne compte pas comme lue : elle est à relire (aperçu), ou hors de
   * l'acquis. Ni les contes lus, ni les trophées, ni Tao ne la notent.
   */
  sansCompte: boolean;
  /**
   * Ses niveaux, prévus ou écrits, chacun ouvert, fermé ou pas encore écrit. Vide pour une
   * entrée qui n'est pas un conte (une lettre de Que).
   */
  niveaux: NiveauConte[];
  /** Au moins une version est écrite (dans l'export, ou l'aperçu en mode relecture). */
  ecrit: boolean;
};

/**
 * Un conte de la bibliothèque. Sans fichier lisible (`conte` nul), il reste fermé au seuil
 * le plus bas que l'index annonce, sans compte de caractères : on ne l'estime pas. `prevu`,
 * sa ligne du catalogue, dit ses niveaux prévus ; sans elle, ses niveaux sont ceux écrits.
 */
export function entreeConte(
  i: IndexConte,
  conte: Conte | null,
  acquis: ReadonlySet<string>,
  lus: readonly number[] = [],
  relecture = false,
  prevu: CatalogueConte | null = null
): EntreeConte {
  const niveaux = niveauxDuConte(prevu?.niveaux ?? [], i.seuils, conte, acquis);
  const base = {
    id: i.id,
    titre_zh: conte?.titre_zh || i.titre_zh || prevu?.titre_zh || '',
    titre_pinyin: conte?.titre_pinyin || i.titre_pinyin || prevu?.titre_pinyin || '',
    titre_fr: conte?.titre_fr || i.titre_fr || prevu?.titre_fr || '',
    gratuit: i.gratuit === true,
    horsAcquis: false,
    sansCompte: false,
    niveaux,
    ecrit: niveaux.some((n) => n.etat !== 'a_ecrire')
  };
  const lisible = conte === null ? null : versionLisible(conte, acquis);
  const version =
    lisible ?? (relecture && conte !== null ? versionDeRelecture(conte) : null);
  if (version === null) {
    const premiere = conte?.versions[0] ?? null;
    const seuils = premiere ? [premiere.seuil] : [...i.seuils];
    return {
      ...base,
      version: null,
      attend: seuils.length > 0 ? Math.min(...seuils) : null,
      reste: premiere ? manquants(premiere, acquis).length : 0,
      lue: false,
      plusRiche: false
    };
  }
  const deja = lus.length > 0 ? Math.max(...lus) : null;
  const horsAcquis = lisible === null;
  return {
    ...base,
    horsAcquis,
    sansCompte: horsAcquis || version.statut === 'a_relire',
    version,
    attend: null,
    reste: 0,
    lue: lus.includes(version.seuil),
    plusRiche: deja !== null && version.seuil > deja
  };
}

/**
 * La bibliothèque : les contes ouverts d'abord, puis les fermés écrits, puis ceux qui ne
 * sont pas encore écrits, chacun dans l'ordre du catalogue, puis de l'index pour un conte
 * que le catalogue ne connaît pas. Sans catalogue (export plus ancien), l'index seul : un
 * index sans conte donne une bibliothèque vide. En mode relecture, tout conte qui a une
 * version s'ouvre.
 */
export function bibliotheque(
  index: readonly IndexConte[],
  contes: ReadonlyMap<string, Conte>,
  acquis: ReadonlySet<string>,
  contesLus: Readonly<Record<string, readonly number[]>> = {},
  relecture = false,
  catalogue: readonly CatalogueConte[] = []
): EntreeConte[] {
  const parId = new Map(index.map((i) => [i.id, i]));
  const prevus = new Map(catalogue.map((c) => [c.id, c]));
  const ids = [...new Set([...catalogue.map((c) => c.id), ...index.map((i) => i.id)])];
  const toutes = ids.map((id) => {
    const prevu = prevus.get(id) ?? null;
    const i: IndexConte = parId.get(id) ?? {
      id,
      titre_zh: prevu?.titre_zh ?? '',
      titre_pinyin: prevu?.titre_pinyin ?? '',
      titre_fr: prevu?.titre_fr ?? '',
      seuils: [],
      fichier: ''
    };
    return entreeConte(i, contes.get(id) ?? null, acquis, contesLus[id] ?? [], relecture, prevu);
  });
  return [
    ...toutes.filter((e) => e.version !== null),
    ...toutes.filter((e) => e.version === null && e.ecrit),
    ...toutes.filter((e) => e.version === null && !e.ecrit)
  ];
}

/* ---------- les chapitres d'un récit long ---------- */

/**
 * Les chapitres d'une version : ceux d'un récit long, ou, pour une fable, un seul chapitre
 * sans titre qui porte toutes ses phrases.
 */
export function chapitresDe(v: VersionConte): ChapitreConte[] {
  if (v.chapitres && v.chapitres.length > 0) return v.chapitres;
  return [{ titre: '', titre_pinyin: '', titre_fr: '', phrases: v.phrases }];
}

/** Un récit long : il se lit chapitre par chapitre. */
export function estLongue(v: VersionConte): boolean {
  return (v.chapitres?.length ?? 0) > 0;
}

/**
 * La lecture d'une version en chapitres, telle que la progression la garde : les chapitres
 * lus (de 1 à n), et celui où reprendre.
 */
export type LectureChapitres = { lus: number[]; reprise: number };

/** La clé d'une lecture en chapitres dans la progression : `<seuil>/<conte>`, comme le pipeline. */
export function cleLecture(conte: string, seuil: number): string {
  return `${seuil}/${conte}`;
}

/** Le chapitre où reprendre, de 1 à `n` : celui noté, sinon le premier. */
export function chapitreDeReprise(l: LectureChapitres | undefined, n: number): number {
  const k = l?.reprise ?? 1;
  return Number.isInteger(k) && k >= 1 && k <= n ? k : 1;
}

/** Un récit long est lu quand tous ses chapitres le sont : un chapitre non lu ne compte pas. */
export function tousLus(lus: readonly number[], n: number): boolean {
  if (n <= 0) return false;
  for (let k = 1; k <= n; k++) if (!lus.includes(k)) return false;
  return true;
}

/**
 * Note un chapitre lu. La reprise passe au premier chapitre non lu qui le suit, sinon au
 * premier non lu depuis le début ; tous lus, elle revient au premier, pour relire.
 */
export function lireChapitre(l: LectureChapitres | undefined, k: number, n: number): LectureChapitres {
  const lus = [...new Set([...(l?.lus ?? []), k])].filter((x) => x >= 1 && x <= n).sort((a, b) => a - b);
  const apres = Array.from({ length: n }, (_, j) => j + 1);
  const suivant =
    apres.find((x) => x > k && !lus.includes(x)) ?? apres.find((x) => !lus.includes(x)) ?? 1;
  return { lus, reprise: suivant };
}

/* ---------- le pinyin, syllabe par syllabe ---------- */

const INITIALES = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
const FINALES = new Set([
  'a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'er',
  'i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong',
  'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng', 'ue'
]);

/** Une lettre sans ton ni tréma, en minuscule : « ǚ » donne « u ». */
function nue(l: string): string {
  const b = l.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return b === 'v' ? 'u' : b;
}

/** Une syllabe du pinyin standard ? `tete` : en tête de mot, elle peut commencer par a, o, e. */
function syllabeValide(s: string, tete: boolean): boolean {
  const ini = INITIALES.find((i) => s.startsWith(i)) ?? '';
  if (ini === '' && !tete) return false;
  return FINALES.has(s.slice(ini.length)) && (ini !== '' || /^[aoe]/.test(s));
}

/**
 * Coupe un mot de pinyin en syllabes (« nóngfū » → nóng, fū). Au milieu d'un mot, une
 * syllabe commence par une consonne : l'orthographe met une apostrophe devant a, o, e
 * (« fāng'àn »), si bien que « fāngàn » se lit fān, gàn. `null` si le mot ne se coupe pas.
 */
function couperMot(lettres: readonly string[], tete = true): string[] | null {
  if (lettres.length === 0) return [];
  for (let n = Math.min(6, lettres.length); n >= 1; n--) {
    const s = lettres.slice(0, n);
    if (!syllabeValide(s.map(nue).join(''), tete)) continue;
    const suite = couperMot(lettres.slice(n), false);
    if (suite !== null) return [s.join(''), ...suite];
  }
  return null;
}

/**
 * Le pinyin d'une phrase, syllabe par syllabe. Les espaces, apostrophes, tirets et la
 * ponctuation séparent les mots. `null` si un mot ne se coupe pas en syllabes connues.
 */
export function syllabes(pinyin: string): string[] | null {
  const mots = pinyin.normalize('NFC').match(/[\p{L}\p{M}]+/gu) ?? [];
  const out: string[] = [];
  for (const m of mots) {
    const s = couperMot(Array.from(m));
    if (s === null) return null;
    out.push(...s);
  }
  return out;
}

/* ---------- le découpage en unités qui se touchent ---------- */

/** Une unité du texte : un caractère ou un mot glosé, ou un passage muet (ponctuation). */
export type Unite = {
  texte: string;
  /** Le pinyin dans cette phrase, `null` quand la phrase ne s'aligne pas syllabe par syllabe. */
  pinyin: string | null;
  /** Le sens donné par la glose de la version, `null` si elle n'en donne pas. */
  sens: string | null;
  /** Un caractère ou un mot se touche ; la ponctuation, non. */
  touchable: boolean;
};

/**
 * Découpe une phrase en unités. Un mot de la glose (une clé de plusieurs caractères) se
 * touche d'un seul geste, au plus long d'abord ; tout autre caractère se touche seul. Le
 * pinyin vient de la phrase, aligné syllabe par syllabe sur ses caractères quand leur
 * nombre concorde ; sinon il reste nul et l'écran le cherche ailleurs.
 */
export function unites(phrase: PhraseConte, glose: Readonly<Record<string, string>>): Unite[] {
  const cs = Array.from(phrase.zh);
  const nHan = cs.filter(estHan).length;
  const syl = syllabes(phrase.pinyin);
  const aligne = syl !== null && syl.length === nHan && nHan > 0;
  const mots = Object.keys(glose)
    .map((k) => Array.from(k))
    .filter((k) => k.length > 1 && k.every(estHan))
    .sort((a, b) => b.length - a.length);

  const out: Unite[] = [];
  let k = 0;
  let h = 0;
  while (k < cs.length) {
    if (!estHan(cs[k])) {
      let fin = k;
      while (fin < cs.length && !estHan(cs[fin])) fin++;
      out.push({ texte: cs.slice(k, fin).join(''), pinyin: null, sens: null, touchable: false });
      k = fin;
      continue;
    }
    const mot = mots.find((m) => m.every((c, j) => cs[k + j] === c));
    const n = mot ? mot.length : 1;
    const texte = cs.slice(k, k + n).join('');
    out.push({
      texte,
      pinyin: aligne && syl ? syl.slice(h, h + n).join('') : null,
      sens: glose[texte] ?? null,
      touchable: true
    });
    k += n;
    h += n;
  }
  return out;
}

/** Les ponctuations qui ouvrent : elles restent avec ce qui les suit. */
const OUVRANTES = new Set(Array.from('“‘《〈（(「『【〔'));

/**
 * Groupe les unités pour le passage à la ligne : une ponctuation reste collée au mot
 * qu'elle suit (« 天， »), une ponctuation ouvrante à celui qu'elle précède, si bien
 * qu'aucune ligne ne commence par une virgule ni ne finit par un guillemet ouvrant.
 */
export function grouper(us: readonly Unite[]): Unite[][] {
  const out: Unite[][] = [];
  let attente: Unite[] = [];
  for (const u of us) {
    if (u.touchable) {
      out.push([...attente, u]);
      attente = [];
      continue;
    }
    const cs = Array.from(u.texte);
    const k = cs.findIndex((c) => OUVRANTES.has(c));
    const fermante = k === -1 ? u.texte : cs.slice(0, k).join('');
    const ouvrante = k === -1 ? '' : cs.slice(k).join('');
    const muet = (t: string): Unite => ({ texte: t, pinyin: null, sens: null, touchable: false });
    if (fermante !== '') {
      if (out.length > 0 && attente.length === 0) out[out.length - 1].push(muet(fermante));
      else attente.push(muet(fermante));
    }
    if (ouvrante !== '') attente.push(muet(ouvrante));
  }
  if (attente.length > 0) out.push(attente);
  return out;
}

/** Le titre chinois d'une version, en unités : l'export ne lui donne pas de pinyin. */
export function unitesDuTitre(v: VersionConte): Unite[] {
  return unites({ zh: v.titre, pinyin: '', fr: '' }, v.glose);
}

/** La traduction d'une version, phrase après phrase. */
export function traduction(v: VersionConte): string {
  return traductionDe(v.phrases);
}

/** La traduction de quelques phrases : celles d'un chapitre, par exemple. */
export function traductionDe(phrases: readonly PhraseConte[]): string {
  return phrases
    .map((p) => p.fr.trim())
    .filter(Boolean)
    .join(' ');
}

/** Le titre chinois d'un chapitre, en unités : son pinyin s'aligne comme celui d'une phrase. */
export function unitesDuChapitre(c: ChapitreConte, glose: Readonly<Record<string, string>>): Unite[] {
  return c.titre === '' ? [] : unites({ zh: c.titre, pinyin: c.titre_pinyin, fr: '' }, glose);
}

/** La glose au toucher, courte : « tù, lièvre ». Vide quand rien n'est connu. */
export function ligneGlose(u: Pick<Unite, 'pinyin' | 'sens'>): string {
  return [u.pinyin, u.sens].filter(Boolean).join(', ');
}
