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
 *   qu'il attend ;
 * - quand la version ouverte est plus riche que toutes celles déjà lues, l'app le signale ;
 * - `gratuit` est un marqueur porté par l'index, et rien d'autre : aucun conte ne se ferme
 *   pour une raison d'achat.
 */
import type { Conte, IndexConte, PhraseConte, VersionConte } from './content';
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

/** Les caractères distincts d'une version, titre compris, dans l'ordre d'apparition. */
export function caracteresDeVersion(v: VersionConte): string[] {
  const vus = new Set<string>();
  for (const t of [v.titre, ...v.phrases.map((p) => p.zh)]) {
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

/* ---------- la bibliothèque ---------- */

/** Un conte dans la bibliothèque, tel que l'écran le montre. */
export type EntreeConte = {
  id: string;
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
};

/**
 * Un conte de la bibliothèque. Sans fichier lisible (`conte` nul), il reste fermé au seuil
 * le plus bas que l'index annonce, sans compte de caractères : on ne l'estime pas.
 */
export function entreeConte(
  i: IndexConte,
  conte: Conte | null,
  acquis: ReadonlySet<string>,
  lus: readonly number[] = []
): EntreeConte {
  const base = { id: i.id, titre_fr: conte?.titre_fr || i.titre_fr, gratuit: i.gratuit === true };
  const version = conte === null ? null : versionLisible(conte, acquis);
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
  return {
    ...base,
    version,
    attend: null,
    reste: 0,
    lue: lus.includes(version.seuil),
    plusRiche: deja !== null && version.seuil > deja
  };
}

/**
 * La bibliothèque : les contes ouverts d'abord, puis les fermés, chacun dans l'ordre de
 * l'index. Un index sans conte donne une bibliothèque vide.
 */
export function bibliotheque(
  index: readonly IndexConte[],
  contes: ReadonlyMap<string, Conte>,
  acquis: ReadonlySet<string>,
  contesLus: Readonly<Record<string, readonly number[]>> = {}
): EntreeConte[] {
  const toutes = index.map((i) =>
    entreeConte(i, contes.get(i.id) ?? null, acquis, contesLus[i.id] ?? [])
  );
  return [...toutes.filter((e) => e.version !== null), ...toutes.filter((e) => e.version === null)];
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
  return v.phrases
    .map((p) => p.fr.trim())
    .filter(Boolean)
    .join(' ');
}

/** La glose au toucher, courte : « tù, lièvre ». Vide quand rien n'est connu. */
export function ligneGlose(u: Pick<Unite, 'pinyin' | 'sens'>): string {
  return [u.pinyin, u.sens].filter(Boolean).join(', ');
}
