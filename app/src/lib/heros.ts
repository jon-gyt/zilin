/**
 * Le personnage (story 4.5, brief §8 « Le personnage ») : les quatre arts et leurs points,
 * les douze rangs, la taille, la phrase de Tao, le rang à annoncer au 放榜.
 *
 * « Points ET examen » (décision du propriétaire du 26 septembre 2026, story 8.5) : les
 * points font toujours grandir le personnage (sa taille, sa silhouette, son âge), mais un
 * titre ne s'accorde qu'avec ce qu'il demande en plus, dans l'ordre des rangs, sans en
 * sauter un : du 童生 au 进士, ses examens à titre réussis ; de 翰林 à 状元, son palier de
 * caractères lus. Un 月课 n'entre dans aucun rang : il ne donne ni ne retient un titre,
 * même au palier d'une nomination. La tenue suit le titre accordé. Ce que chaque rang
 * demande vient de `heros.json` (`examens`, `palier`), jamais du code.
 *
 * Les textes (rangs, bêtes, phrases de Tao) viennent de `heros.json`, que le pipeline tire
 * de `data/sources/heros/` ; rien n'est rédigé ici. Les dessins sont dans `Heros.svelte`.
 *
 * Module pur, comme `session.ts` : aucune fonction ne lit l'horloge, aucun `Math.random`.
 * Les points ne dépendent que des réponses notées : jamais du temps passé, jamais de la
 * vitesse, jamais de l'heure. Une erreur ne coûte rien, le compte ne décroît jamais.
 * Seul `herosOnce` lit le réseau local, les assets de l'app.
 */
import { Rating } from 'ts-fsrs';
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';
import type { Examen } from './examens';
import type { TypeQuestion } from './questions';
import type { Progress } from './session';
import type { ReviewCard } from './srs';

/* ---------- les quatre arts ---------- */

/** 读 la lecture, 写 l'écriture, 听 l'écoute, 说 les tons. */
export type Art = 'du' | 'xie' | 'ting' | 'shuo';

/**
 * Les quatre arts, dans l'ordre de l'écran. Leurs caractères sont un choix d'interface,
 * comme les cases du menu (`data/sources/interface/caracteres.txt`) : ils se dessinent
 * depuis leurs traits.
 */
export const ARTS: readonly { id: Art; c: string; t: string }[] = [
  { id: 'du', c: '读', t: 'lecture' },
  { id: 'xie', c: '写', t: 'écriture' },
  { id: 'ting', c: '听', t: 'écoute' },
  { id: 'shuo', c: '说', t: 'les tons' }
];

/** Les points de chaque art. */
export type Arts = Record<Art, number>;

export function artsVides(): Arts {
  return { du: 0, xie: 0, ting: 0, shuo: 0 };
}

/** Tous les points, les quatre arts ensemble : c'est eux qui font le rang. */
export function total(a: Arts): number {
  return a.du + a.xie + a.ting + a.shuo;
}

/**
 * L'art de chaque type de question (`questions.ts`). Lecture : reconnaître ou lire un
 * caractère ou un mot, et « quel élément donne le son ? », qui se lit sur la forme.
 * Écriture : le tracé. Écoute : le caractère reconnu au son (`oreille`). Les tons : trouver
 * le ton de sa lecture (`ton`).
 */
export const ART_DE_QUESTION: Readonly<Record<TypeQuestion, Art>> = {
  sens: 'du',
  caractere: 'du',
  assemblage: 'du',
  trou: 'du',
  oreille: 'ting',
  ton: 'shuo',
  son: 'du',
  trace: 'xie'
};

export function artDe(type: TypeQuestion): Art {
  return ART_DE_QUESTION[type];
}

function estArt(v: unknown): v is Art {
  return v === 'du' || v === 'xie' || v === 'ting' || v === 'shuo';
}

/** Un point de plus dans un art. */
export function ajouterPoint(a: Arts, art: Art): Arts {
  return { ...a, [art]: a[art] + 1 };
}

/**
 * Les points qu'une progression garde sans compteur : chaque réponse juste de
 * l'historique des cartes (tout sauf « Oublié »), rangée en lecture puisque l'historique
 * ne dit pas le type de question, et chaque tracé achevé en écriture. C'est ce qu'une
 * progression d'avant le personnage recalcule à l'import ; l'historique étant borné
 * (`HISTORIQUE_MAX`), c'est un plancher, jamais plus que ce qui a été fait.
 */
export function pointsDerives(cartes: readonly ReviewCard[], tracesAchevees: readonly string[]): Arts {
  let du = 0;
  for (const c of cartes) for (const h of c.history) if (h.rating !== Rating.Again) du += 1;
  return { du, xie: new Set(tracesAchevees).size, ting: 0, shuo: 0 };
}

/** Relit les points d'un export. Absents ou aberrants : `null`, l'appelant les recalcule. */
export function lireArts(brut: unknown): Arts | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  const a = artsVides();
  for (const { id } of ARTS) {
    const v = o[id];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    a[id] = Math.floor(v);
  }
  return a;
}

/** Relit l'art d'un événement de révision : absent ou inconnu, pas d'art. */
export function lireArt(v: unknown): Art | undefined {
  return estArt(v) ? v : undefined;
}

/* ---------- le personnage choisi ---------- */

/** Les trois bêtes que `Heros.svelte` sait dessiner. */
export type BeteId = 'tu' | 'xiongmao' | 'shi';

export const BETES: readonly BeteId[] = ['tu', 'xiongmao', 'shi'];

/**
 * Le personnage de la progression : sa bête, son nom, et le dernier rang annoncé au 放榜
 * (le rang où il était quand on l'a choisi, puis chaque rang franchi et fêté). Changer de
 * bête ou de nom ne le touche pas : rien ne se perd, rien ne se fête deux fois.
 */
export type Heros = { bete: BeteId; nom: string; rang: number };

/** Le champ du nom en prend seize (`data/sources/heros/betes.tsv`). */
export const NOM_MAX = 16;

/** Un nom propre à ranger : espaces resserrés, seize signes au plus. */
export function nettoyerNom(nom: string): string {
  return [...nom.replace(/\s+/g, ' ').trim()].slice(0, NOM_MAX).join('').trim();
}

function estBete(v: unknown): v is BeteId {
  return v === 'tu' || v === 'xiongmao' || v === 'shi';
}

/** Relit le personnage d'un export. Absent ou aberrant : aucun, il se choisira. */
export function lireHeros(brut: unknown): Heros | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const o = brut as Record<string, unknown>;
  if (!estBete(o.bete) || typeof o.nom !== 'string') return null;
  const nom = nettoyerNom(o.nom);
  if (nom === '') return null;
  const rang = typeof o.rang === 'number' && Number.isFinite(o.rang) && o.rang >= 0 ? Math.floor(o.rang) : 0;
  return { bete: o.bete, nom, rang };
}

/* ---------- le contenu : heros.json ---------- */

/**
 * Un rang : son titre, sa traduction mot à mot, son rôle, l'âge du personnage, son seuil de
 * points, et ce qu'il demande en plus : `examens`, les examens à titre réussis (par leur
 * identifiant dans `examens.json`) ; `palier`, pour une nomination, les caractères lus.
 */
export type Rang = {
  hz: string;
  pinyin: string;
  fr: string;
  role: string;
  age: string;
  seuil: number;
  examens: string[];
  palier: number | null;
};

/** Une bête : son nom, ce que Tao en dit, trois idées de nom. */
export type Bete = { id: BeteId; hz: string; pinyin: string; fr: string; dit: string; noms: string[] };

export type HerosDonnees = {
  version: string;
  source: string;
  rangs: Rang[];
  betes: Bete[];
  /** Les phrases de Tao, par clé, avec leurs jetons entre accolades. */
  tao: Record<string, string>;
  /** La famille de chaque caractère des titres, pour trouver ses traits. */
  racines: Record<string, string>;
};

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Lit `heros.json`. Un rang ou une bête mal formés tombent ; les rangs gardent leur ordre
 * et un seuil qui ne croît pas les arrête : mieux vaut un rang de moins qu'un rang faux.
 */
export function lireHerosDonnees(brut: unknown): HerosDonnees {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const rangs: Rang[] = [];
  for (const v of Array.isArray(o.rangs) ? o.rangs : []) {
    if (typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    const seuil = r.seuil;
    if (texte(r.hz) === '' || typeof seuil !== 'number' || !Number.isFinite(seuil)) continue;
    const avant = rangs[rangs.length - 1];
    if ((avant === undefined && seuil !== 0) || (avant !== undefined && seuil <= avant.seuil)) break;
    const examens = Array.isArray(r.examens) ? r.examens.filter((x): x is string => typeof x === 'string' && x !== '') : [];
    const palier = typeof r.palier === 'number' && Number.isInteger(r.palier) && r.palier >= 0 ? r.palier : null;
    rangs.push({
      hz: texte(r.hz),
      pinyin: texte(r.pinyin),
      fr: texte(r.fr),
      role: texte(r.role),
      age: texte(r.age),
      seuil,
      examens,
      palier
    });
  }
  const betes: Bete[] = [];
  for (const v of Array.isArray(o.betes) ? o.betes : []) {
    if (typeof v !== 'object' || v === null) continue;
    const b = v as Record<string, unknown>;
    if (!estBete(b.id) || betes.some((x) => x.id === b.id)) continue;
    const noms = Array.isArray(b.noms) ? b.noms.filter((n): n is string => typeof n === 'string' && n !== '') : [];
    betes.push({ id: b.id, hz: texte(b.hz), pinyin: texte(b.pinyin), fr: texte(b.fr), dit: texte(b.dit), noms });
  }
  const tao: Record<string, string> = {};
  if (typeof o.tao === 'object' && o.tao !== null) {
    for (const [cle, v] of Object.entries(o.tao as Record<string, unknown>)) if (typeof v === 'string') tao[cle] = v;
  }
  const racines: Record<string, string> = {};
  if (typeof o.racines === 'object' && o.racines !== null) {
    for (const [c, r] of Object.entries(o.racines as Record<string, unknown>)) if (typeof r === 'string') racines[c] = r;
  }
  return { version: texte(o.version), source: texte(o.source), rangs, betes, tao, racines };
}

/** Aucun personnage : ce que rend un export sans `heros.json`. L'écran se tait. */
export const SANS_HEROS: HerosDonnees = { version: '', source: '', rangs: [], betes: [], tao: {}, racines: {} };

/** Le fichier du personnage d'une version, tel que l'index le nomme. */
export function fichierHeros(i: Index): string {
  return !i.heros ? '' : `${dossierVersion(i.version)}/${i.heros}`;
}

/** Lit et valide `heros.json`. `fetchFn` est injecté dans les tests. */
export async function loadHeros(file: string, fetchFn: typeof fetch = fetch): Promise<HerosDonnees> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Personnage introuvable : ${file} (${r.status})`);
  return lireHerosDonnees(await r.json());
}

const lesHeros = new Map<string, Promise<HerosDonnees>>();

/** Le personnage de la version courante, lu une fois pour toute la durée de vie de l'app. */
export function herosOnce(version = VERSION_DONNEES): Promise<HerosDonnees> {
  let p = lesHeros.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierHeros(i);
        return file === '' ? SANS_HEROS : loadHeros(file);
      })
      .catch((e) => {
        lesHeros.delete(version);
        throw e;
      });
    lesHeros.set(version, p);
  }
  return p;
}

/** La piste vers la famille d'un caractère des titres, pour trouver ses traits sans tout relire. */
export function pistes(d: HerosDonnees, c: string): string[] {
  const r = d.racines[c];
  return r ? [r] : [];
}

/** La bête d'un identifiant, `null` si l'export ne la porte pas. */
export function beteDe(d: HerosDonnees, id: BeteId): Bete | null {
  return d.betes.find((b) => b.id === id) ?? null;
}

/** Le nom français d'une bête sans son article : « lapin de jade ». */
export function sansArticle(fr: string): string {
  return fr.replace(/^(le |la |les |l['’])/i, '');
}

/* ---------- le rang et la taille ---------- */

/**
 * Le rang des seuls points : le dernier dont le seuil est atteint. Zéro, le bébé, sans
 * rangs. Il fait l'étape de vie (la silhouette, l'âge) et la taille, jamais le titre :
 * celui-ci est `rangAccorde`.
 */
export function rangDe(points: number, rangs: readonly Rang[]): number {
  let n = 0;
  rangs.forEach((r, i) => {
    if (points >= r.seuil) n = i;
  });
  return n;
}

/**
 * La taille du personnage à chaque rang, de la maquette validée : le bébé fait moins de
 * la moitié de l'adulte. Un dessin, pas du contenu.
 */
export const ECHELLES: readonly number[] = [0.46, 0.53, 0.6, 0.67, 0.73, 0.78, 0.83, 0.87, 0.9, 0.93, 0.96, 0.99];

/** Au-delà du dernier rang, il grandit encore un peu, jusqu'à ce nombre de points. */
export const POINTS_ADULTE = 2000;

function echelleDuRang(n: number): number {
  return ECHELLES[Math.max(0, Math.min(ECHELLES.length - 1, n))];
}

/**
 * La taille, à chaque point : de l'échelle du rang vers celle du suivant, au prorata des
 * points ; le passage du rang la pose sur l'échelle suivante. Elle ne décroît jamais.
 */
export function taille(points: number, rangs: readonly Rang[]): number {
  if (rangs.length === 0) return ECHELLES[0];
  const n = rangDe(points, rangs);
  const a = rangs[n];
  const b = rangs[n + 1];
  const haut = b ? echelleDuRang(n + 1) : 1;
  const fin = b ? b.seuil : Math.max(POINTS_ADULTE, a.seuil + 1);
  const part = Math.max(0, Math.min(1, (points - a.seuil) / (fin - a.seuil)));
  return echelleDuRang(n) + (haut - echelleDuRang(n)) * part * 0.92;
}

/* ---------- le titre : points ET examen ---------- */

/**
 * Ce qui accorde un titre : les points, les examens réussis (chacun avec sa journée, 月课
 * compris, que les rangs ne lisent pas), les caractères lus (au seuil de stabilité de Ma
 * forêt, le compte du trophée Lire), et le dernier rang annoncé au 放榜.
 */
export type Merite = {
  points: number;
  reussis: Readonly<Record<string, string>>;
  lus: number;
  annonce: number;
};

/** Le mérite d'une progression, les caractères lus étant comptés par l'appelant (`foret.caracteresLus`). */
export function meriteDe(p: Pick<Progress, 'arts' | 'examens' | 'heros'>, lus: number): Merite {
  return { points: total(p.arts), reussis: p.examens.reussis, lus, annonce: p.heros?.rang ?? 0 };
}

/** Ce qu'un rang demande en plus des points est-il là : ses examens réussis, son palier lu ? */
export function exigenceRemplie(r: Rang, m: Pick<Merite, 'reussis' | 'lus'>): boolean {
  return r.examens.every((id) => m.reussis[id] !== undefined) && (r.palier === null || m.lus >= r.palier);
}

/**
 * Le rang accordé : dans l'ordre, sans en sauter un, chaque rang demande ses points et ce
 * qu'il demande en plus ; le premier qui manque arrête tout, même si les suivants sont là.
 */
export function rangAccorde(rangs: readonly Rang[], m: Pick<Merite, 'points' | 'reussis' | 'lus'>): number {
  let n = 0;
  for (let k = 1; k < rangs.length; k++) {
    const r = rangs[k];
    if (m.points < r.seuil || !exigenceRemplie(r, m)) break;
    n = k;
  }
  return n;
}

/**
 * Le rang tenu, celui que montrent l'en-tête, « Mon personnage » et la tenue : le rang
 * accordé, ou le dernier annoncé s'il est plus haut. Un titre ne se reprend jamais : une
 * nomination reste quand le compte des lus redescend, et une progression d'avant les
 * examens garde les rangs qu'on lui a annoncés.
 */
export function rangTenu(rangs: readonly Rang[], m: Merite): number {
  if (rangs.length === 0) return 0;
  return Math.max(rangAccorde(rangs, m), Math.min(Math.max(0, m.annonce), rangs.length - 1));
}

/**
 * Ce qui retient le titre suivant, pour « Mon personnage » :
 * - `points` : les points manquent (ou tout manque : la barre dit les points) ;
 * - `examen` : les points y sont, il reste un examen à titre, le premier pas encore réussi
 *   (« Reste le 院试 ») ;
 * - `recu` : les examens du rang sont réussis, les points pas encore (« Reçu au 院试 ·
 *   encore 12 points ») ; `examen` est le dernier, celui qui accorde le titre ;
 * - `palier` : les points d'une nomination y sont, pas ses caractères lus ;
 * - `rien` : au sommet.
 */
export type Reste =
  | { attend: 'rien' }
  | { attend: 'points'; manque: number }
  | { attend: 'examen'; examen: string }
  | { attend: 'recu'; examen: string; manque: number }
  | { attend: 'palier'; palier: number };

/** Où l'on en est vers le titre suivant : le rang tenu, ce qui manque, la part de la barre. */
export type Avance = { rang: number; suivant: Rang | null; manque: number; part: number; reste: Reste };

export function avance(rangs: readonly Rang[], m: Merite): Avance {
  const n = rangTenu(rangs, m);
  const suivant = rangs[n + 1] ?? null;
  if (suivant === null) return { rang: n, suivant, manque: 0, part: 1, reste: { attend: 'rien' } };
  const bas = rangs[n]?.seuil ?? 0;
  const manque = Math.max(0, suivant.seuil - m.points);
  const part = Math.max(0, Math.min(1, (m.points - bas) / (suivant.seuil - bas)));
  const manquant = suivant.examens.find((id) => m.reussis[id] === undefined);
  let reste: Reste = { attend: 'points', manque };
  if (manque === 0 && manquant !== undefined) reste = { attend: 'examen', examen: manquant };
  else if (manque === 0 && suivant.palier !== null && m.lus < suivant.palier) reste = { attend: 'palier', palier: suivant.palier };
  else if (manque > 0 && suivant.examens.length > 0 && manquant === undefined) {
    reste = { attend: 'recu', examen: suivant.examens[suivant.examens.length - 1], manque };
  }
  return { rang: n, suivant, manque, part, reste };
}

/** Un examen à titre réussi, pour le 榜 de « Mon personnage » : l'examen et sa journée. */
export type Recu = { examen: Examen; jour: string };

/**
 * Le 榜 du personnage : les examens à titre réussis, dans l'ordre de la liste, chacun avec
 * sa journée. Les 月课 n'y sont pas : ils ne donnent aucun titre.
 */
export function examensRecus(liste: readonly Examen[], reussis: Readonly<Record<string, string>>): Recu[] {
  return liste
    .filter((e) => e.sorte === 'titre' && reussis[e.id] !== undefined)
    .map((e) => ({ examen: e, jour: reussis[e.id] }));
}

/* ---------- Tao ---------- */

/** Remplit les jetons `{nom}` d'une phrase. Un jeton sans valeur reste tel quel. */
export function remplir(gabarit: string, valeurs: Readonly<Record<string, string | number>>): string {
  return gabarit.replace(/\{([a-z_]+)\}/g, (tout, cle: string) =>
    valeurs[cle] === undefined ? tout : String(valeurs[cle])
  );
}

/** L'art le moins fourni ; à égalité, le premier de l'écran. */
export function artLeMoinsFourni(a: Arts): (typeof ARTS)[number] {
  return ARTS.reduce((m, x) => (a[x.id] < a[m.id] ? x : m), ARTS[0]);
}

/** Les derniers points avant un rang : Tao les compte. */
export const PRESQUE = 5;

/**
 * La bulle de Tao sur l'écran du personnage. Elle ne lit que les points et les examens : au
 * sommet, elle propose de continuer ; les points d'un titre atteints, elle dit l'examen qui
 * reste, ou le palier de la nomination ; à cinq points ou moins d'un rang, elle les compte ;
 * sans point, elle propose d'y aller ; sinon, elle propose l'art le moins fourni. Jamais
 * l'horloge, jamais un reproche. `nomExamen` donne le nom d'un examen par son identifiant.
 */
export function phraseDeTao(
  d: HerosDonnees,
  a: Arts,
  nom: string,
  m: Omit<Merite, 'points'>,
  nomExamen: (id: string) => string
): string {
  const t = total(a);
  const av = avance(d.rangs, { ...m, points: t });
  if (d.rangs.length > 0 && av.suivant === null) return remplir(d.tao.sommet ?? '', { nom });
  if (t === 0) return d.tao.depart ?? '';
  if (av.suivant !== null && av.reste.attend === 'examen') {
    return remplir(d.tao.examen ?? '', { rang: av.suivant.hz, examen: nomExamen(av.reste.examen) });
  }
  if (av.suivant !== null && av.reste.attend === 'palier') {
    return remplir(d.tao.palier ?? '', { rang: av.suivant.hz, palier: av.reste.palier.toLocaleString('fr-FR') });
  }
  if (av.suivant !== null && av.manque <= PRESQUE) {
    return av.manque === 1
      ? remplir(d.tao.presque_un ?? '', { rang: av.suivant.hz })
      : remplir(d.tao.presque ?? '', { reste: av.manque, rang: av.suivant.hz });
  }
  const art = artLeMoinsFourni(a);
  return remplir(d.tao.essayer ?? '', { art: art.c, art_fr: art.t });
}

/** Ce que Tao dit au choix : qui elle est, puis la bête choisie. */
export function phraseDuChoix(d: HerosDonnees, b: Bete | null): string {
  if (b === null) return d.tao.accueil ?? '';
  return remplir(d.tao.choisi ?? '', { bete: b.hz, bete_fr: b.fr, dit: b.dit });
}

/** La ligne de l'écran 放榜. */
export function texteFangbang(d: HerosDonnees, rang: number, nom: string): string {
  const r = d.rangs[rang];
  if (r === undefined) return '';
  return remplir(d.tao.fangbang ?? '', { nom, rang: r.hz, rang_fr: r.fr, role: r.role });
}

/* ---------- le 放榜 ---------- */

/**
 * Le titre à annoncer au 放榜 : le rang accordé, s'il dépasse le dernier annoncé. Il vient
 * l'examen réussi quand les points y sont, les points atteints quand l'examen l'est déjà, ou
 * le palier de caractères lus d'une nomination. `null` sans personnage, ou quand il n'y a
 * rien de neuf : un 放榜 par rang, une fois. Plusieurs rangs franchis d'un coup (un import)
 * ne font qu'un 放榜, celui du plus haut. L'appelant le montre au retour au menu, jamais au
 * milieu d'un pas, puis le note (`session.annoncerRang`).
 */
export function titreAccorde(
  p: Pick<Progress, 'arts' | 'examens' | 'heros'>,
  rangs: readonly Rang[],
  lus: number
): number | null {
  if (p.heros === null || rangs.length === 0) return null;
  const n = rangAccorde(rangs, meriteDe(p, lus));
  return n > p.heros.rang ? n : null;
}

/* ---------- l'aura ---------- */

/**
 * Les caractères déjà lus qui tournent autour du personnage : ceux dont la carte a au moins
 * une réponse juste, dans l'ordre où ils sont entrés en révision, un par caractère.
 */
export function caracteresDeLAura(cartes: readonly ReviewCard[], max = 24): string[] {
  const lus: string[] = [];
  for (const c of cartes) {
    if (lus.length >= max) break;
    if ([...c.id].length !== 1 || lus.includes(c.id)) continue;
    if (c.history.some((h) => h.rating !== Rating.Again)) lus.push(c.id);
  }
  return lus;
}
