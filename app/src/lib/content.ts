/**
 * La seule couche d'accès au contenu servi avec l'app (JSON versionné de
 * `app/public/data/`). Aucune donnée de contenu n'est écrite dans le code : ce module
 * ne fait que lire, et aucune requête ne sort des assets de l'app.
 *
 * Deux régimes, dans cet ordre :
 *
 * 1. l'export versionné du pipeline, `data/0.1.0/` : `contenu()` charge l'index une
 *    fois, `famille()` et `traits()` un fichier à la demande, `fiche()` trouve la
 *    famille d'un caractère et `traitsDe()` ses tracés ;
 * 2. les fichiers de démonstration, `data/demo/`, qui servent de **surcouche** aux
 *    textes tant que l'export n'a aucune fiche relue (voir `surcoucher`).
 *
 * Et, sur demande seulement, l'aperçu des textes à relire (`data/0.1.0/apercu/`) : les
 * fiches et les contes que le pipeline a écrits mais que personne n'a encore relus. Il
 * ne se charge que si le mode relecture des Réglages est allumé (`reglerApercu`) ; il passe
 * alors devant la démonstration, jamais devant un texte relu, et chacun de ses textes
 * porte la mention « à relire » (`MENTION_A_RELIRE`).
 */
import type { StrokeData } from './glyph';
import { comparerNiveaux, lireNiveau, lireNiveaux, trierNiveaux, type Niveau } from './niveaux';
import { strokesOnce, type StrokeSet } from './strokes';

/**
 * Une anecdote du jour : un caractère, un titre, quelques phrases. `etiquette` dit, quand
 * le texte parle de l'origine d'un caractère ou d'un mot, si elle est attestée ou
 * mnémotechnique ; `racine`, la famille où lire les traits du caractère.
 */
export type Anecdote = { c: string; titre: string; texte: string; etiquette?: Etiquette; racine?: string };

/** Un fichier d'anecdotes, versionné, avec la source du texte (traçabilité). */
export type Anecdotes = { version: string; source: string; anecdotes: Anecdote[] };

/** Les anecdotes ordinaires, écrites par le pipeline (`data/sources/anecdotes/`). */
export const FICHIER_ANECDOTES = 'data/0.1.0/anecdotes.json';

/** Lit un fichier d'anecdotes servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadAnecdotes(
  file = FICHIER_ANECDOTES,
  fetchFn: typeof fetch = fetch
): Promise<Anecdotes> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Anecdotes introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Anecdotes>;
  if (!Array.isArray(brut.anecdotes)) throw new Error(`Anecdotes illisibles : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    anecdotes: brut.anecdotes
  };
}

const cache = new Map<string, Promise<Anecdotes>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function anecdotesOnce(file = FICHIER_ANECDOTES): Promise<Anecdotes> {
  let p = cache.get(file);
  if (!p) {
    p = loadAnecdotes(file).catch((e) => {
      cache.delete(file);
      throw e;
    });
    cache.set(file, p);
  }
  return p;
}

/** Journées civiles écoulées depuis le 1er janvier 1970, d'après une date AAAA-MM-JJ. */
export function jourDepuisEpoque(dateISO: string): number {
  return Math.floor(Date.parse(`${dateISO}T00:00:00Z`) / 86400000);
}

/* ---------- les familles de caractères ---------- */

/** Le rôle d'un élément dans le caractère : il donne le son, le sens, ou la forme. */
export type Role = 'son' | 'sens' | 'forme';

/** Origine attestée ou moyen mnémotechnique : jamais l'un pour l'autre. */
export type Etiquette = 'atteste' | 'mnemotechnique';

/** Ce que l'étiquette dit à l'écran. */
export const ETIQUETTES: Record<Etiquette, string> = {
  atteste: 'attesté',
  mnemotechnique: 'mnémotechnique'
};

/** Un mot ou une phrase : le chinois, le pinyin, la traduction. */
export type Mot = { hanzi: string; pinyin: string; fr: string; en: string; audio?: string | null };

/**
 * Ce que l'export dit d'une fiche : relue par un humain, ou exportée sans texte. `a_relire`
 * ne vient que de l'aperçu : des textes écrits, pas encore relus.
 */
export type Statut = 'relu' | 'sans_fiche' | 'a_relire';

/** Un composant de la norme GF 0014-2009, racine d'une famille. */
export type Brique = {
  c: string;
  pinyin: string;
  fr: string;
  en: string;
  origine: string;
  /**
   * Nulle tant qu'aucune fiche relue ne porte l'origine : on n'étiquette jamais
   * « attesté » un texte qui n'existe pas (`data/schema.md`, brief §2).
   */
  etiquette: Etiquette | null;
};

/** La fiche d'un caractère : décomposition canonique, origine étiquetée, mots. */
export type Fiche = {
  c: string;
  pinyin: string;
  /**
   * Toutes les lectures valides, la principale (`pinyin`) en tête : 好 `["hǎo", "hào"]`.
   * Écrit par l'export (Unihan et surcharges) ; absent d'une fiche de démonstration ou
   * d'un export plus ancien, et la question de ton ne se pose pas alors.
   */
  lectures?: string[];
  fr: string;
  en: string;
  /** Décomposition canonique GF 0014-2009, dans l'ordre d'écriture. */
  parts: string[];
  /** Index, dans `parts`, des éléments ajoutés : les seuls à porter le cinabre. */
  nouveau: number[];
  /** Le rôle de l'élément ajouté. Nul sans fiche relue : le pipeline ne le devine pas. */
  role: Role | null;
  /** Le rôle de chaque brique de la décomposition. Vide sans fiche relue. */
  roles?: Record<string, Role>;
  /** D'où vient la chaîne IDS descendue : `makemeahanzi` ou `cjk-decomp`. */
  sources?: string[];
  /** `relu` quand une fiche relue porte les textes, `sans_fiche` sinon. */
  statut?: Statut;
  origine_fr: string;
  origine_en: string;
  /** Nulle sans origine : jamais d'étiquette « attesté » sans texte derrière. */
  etiquette: Etiquette | null;
  memo_fr?: string | null;
  memo_en?: string | null;
  mots: Mot[];
  phrase?: Mot | null;
  niveaux: Record<string, number>;
  traits: string[];
  medianes: number[][][];
  audio?: string | null;
};

/** Une famille : une brique et les caractères qu'elle engendre. Format `Famille` de `data/`. */
export type Famille = { version: string; source: string; racine: Brique; fiches: Fiche[] };

export const FICHIER_FAMILLE_DEMO = 'data/demo/familles/主.json';

/** Lit une famille servie avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadFamille(
  file = FICHIER_FAMILLE_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Famille> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Famille introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Famille>;
  if (!brut.racine || !Array.isArray(brut.fiches)) throw new Error(`Famille illisible : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    racine: brut.racine,
    fiches: brut.fiches
  };
}

const familles = new Map<string, Promise<Famille>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function familleOnce(file = FICHIER_FAMILLE_DEMO): Promise<Famille> {
  let p = familles.get(file);
  if (!p) {
    p = loadFamille(file).catch((e) => {
      familles.delete(file);
      throw e;
    });
    familles.set(file, p);
  }
  return p;
}

/** La fiche d'un caractère dans une famille, `null` si la famille ne la porte pas. */
export function ficheDeFamille(f: Famille, c: string): Fiche | null {
  return f.fiches.find((x) => x.c === c) ?? null;
}

/** La fiche d'un composé : le premier caractère qui n'est pas la racine. */
export function compose(f: Famille): Fiche | null {
  return f.fiches.find((x) => x.c !== f.racine.c) ?? null;
}

/* ---------- les textes de lecture ---------- */

/**
 * Un signe du texte : le caractère, sa glose quand la source en donne une, et le
 * drapeau de l'élément ajouté. Sans glose, le signe ne se touche pas (la ponctuation).
 */
export type Signe = {
  c: string;
  pinyin?: string | null;
  fr?: string | null;
  /** Le caractère du jour : l'élément ajouté, le seul en cinabre dans le texte. */
  nouveau?: boolean;
};

/** Un texte de lecture : trois lignes avec uniquement l'acquis, et sa traduction. */
export type Texte = {
  version: string;
  source: string;
  /** Le caractère du jour, celui autour duquel le texte est écrit. */
  c: string;
  lignes: Signe[][];
  traduction: string;
  audio?: string | null;
};

export const FICHIER_TEXTE_DEMO = 'data/demo/textes/住.json';

/** Lit un texte de lecture servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadTexte(
  file = FICHIER_TEXTE_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Texte> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Texte introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Texte>;
  if (!Array.isArray(brut.lignes) || brut.lignes.length === 0) {
    throw new Error(`Texte illisible : ${file}`);
  }
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    c: typeof brut.c === 'string' ? brut.c : '',
    lignes: brut.lignes,
    traduction: typeof brut.traduction === 'string' ? brut.traduction : '',
    audio: brut.audio ?? null
  };
}

const textes = new Map<string, Promise<Texte>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function texteOnce(file = FICHIER_TEXTE_DEMO): Promise<Texte> {
  let p = textes.get(file);
  if (!p) {
    p = loadTexte(file).catch((e) => {
      textes.delete(file);
      throw e;
    });
    textes.set(file, p);
  }
  return p;
}

/** Un signe se touche s'il porte une glose ; la ponctuation n'en a pas. */
export function glosable(s: Signe): boolean {
  return Boolean(s.fr) || Boolean(s.pinyin);
}

/** La glose au toucher, courte : « zhù, habiter ». `null` quand la source n'en donne pas. */
export function glose(s: Signe): string | null {
  if (!glosable(s)) return null;
  return [s.pinyin, s.fr].filter(Boolean).join(', ');
}

/** Le texte nu, ligne par ligne : ce qui s'écouterait, et ce qui se compare à la source. */
export function lignesNues(t: Texte): string[] {
  return t.lignes.map((l) => l.map((s) => s.c).join(''));
}

/* ---------- les voisins de forme, pour les leurres ---------- */

/**
 * Un voisin de forme : un caractère avec sa décomposition canonique GF 0014-2009.
 * Sert à choisir les leurres d'une question par ressemblance de composants.
 */
export type Voisin = { c: string; pinyin: string; fr: string; parts: string[] };

export type Voisins = { version: string; source: string; norme: string; voisins: Voisin[] };

export const FICHIER_VOISINS_DEMO = 'data/demo/voisins.json';

/** Lit la liste des voisins servie avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadVoisins(
  file = FICHIER_VOISINS_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Voisins> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Voisins introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Voisins>;
  if (!Array.isArray(brut.voisins)) throw new Error(`Voisins illisibles : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    norme: typeof brut.norme === 'string' ? brut.norme : '',
    voisins: brut.voisins
  };
}

const voisins = new Map<string, Promise<Voisins>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function voisinsOnce(file = FICHIER_VOISINS_DEMO): Promise<Voisins> {
  let p = voisins.get(file);
  if (!p) {
    p = loadVoisins(file).catch((e) => {
      voisins.delete(file);
      throw e;
    });
    voisins.set(file, p);
  }
  return p;
}

/* ---------- les paires à ne pas confondre ---------- */

export const FICHIER_PAIRES_DEMO = 'data/demo/paires.json';

/**
 * Lit le fichier des paires à ne pas confondre (己 已 巳, 未 末, …), tel quel : c'est
 * `questions.lirePaires` qui le valide, pour que ce module ne dépende de rien.
 */
export async function loadPaires(
  file = FICHIER_PAIRES_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Paires introuvables : ${file} (${r.status})`);
  return (await r.json()) as unknown;
}

const paires = new Map<string, Promise<unknown>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function pairesOnce(file = FICHIER_PAIRES_DEMO): Promise<unknown> {
  let p = paires.get(file);
  if (!p) {
    p = loadPaires(file).catch((e) => {
      paires.delete(file);
      throw e;
    });
    paires.set(file, p);
  }
  return p;
}

/* ---------- le cercle des familles (Ma forêt) ---------- */

/**
 * Un nœud du cercle : un caractère, son avancement, et les caractères qu'il engendre.
 * `avancement` va de 0 (à venir) à 1 (acquis) ; entre les deux, c'est en cours.
 */
export type Noeud = {
  c: string;
  pinyin: string;
  fr: string;
  avancement: number;
  membres: Noeud[];
};

/**
 * Le cercle des familles : un caractère au centre, puis une famille par secteur.
 *
 * Format attendu, à terme, depuis `data/` : le pipeline écrit `graphe.json`
 * (`familles: [{racine, genre, n, membres[]}]`, voir `data/schema.md`) et l'export
 * en dérive un fichier de cette forme — un `Noeud` par racine, ses `membres` dans
 * l'ordre du parcours, deux générations au plus, le pinyin et le sens repris de la
 * fiche du caractère. `avancement` viendra alors de la progression (stabilité FSRS
 * des briques) et non du fichier : le champ n'est ici qu'une démonstration, recopiée
 * de la maquette en attendant le parcours.
 */
export type Foret = {
  version: string;
  source: string;
  norme: string;
  /** Le caractère posé au centre du cercle. */
  centre: string;
  familles: Noeud[];
  /**
   * La famille du moment : celle de la brique que le parcours pose aujourd'hui. C'est
   * la seule à porter le cinabre sur le cercle.
   */
  moment?: string;
};

export const FICHIER_FORET_DEMO = 'data/demo/foret.json';

/** Lit le cercle des familles servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadForet(
  file = FICHIER_FORET_DEMO,
  fetchFn: typeof fetch = fetch
): Promise<Foret> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Forêt introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Foret>;
  if (!Array.isArray(brut.familles)) throw new Error(`Forêt illisible : ${file}`);
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    norme: typeof brut.norme === 'string' ? brut.norme : '',
    centre: typeof brut.centre === 'string' ? brut.centre : '',
    familles: brut.familles
  };
}

const forets = new Map<string, Promise<Foret>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function foretOnce(file = FICHIER_FORET_DEMO): Promise<Foret> {
  let p = forets.get(file);
  if (!p) {
    p = loadForet(file).catch((e) => {
      forets.delete(file);
      throw e;
    });
    forets.set(file, p);
  }
  return p;
}

/** Tous les caractères d'un nœud, lui compris, dans l'ordre du cercle. */
export function caracteres(n: Noeud): string[] {
  return [n.c, ...n.membres.flatMap(caracteres)];
}

/* ---------- l'index de l'export versionné ---------- */

/**
 * Une famille dans l'index : où lire ses fiches, où lire ses tracés, sa taille.
 * `avancement_possible` est la part des caractères de la famille qui portent une
 * fiche relue — le plafond de ce que l'app peut enseigner aujourd'hui, pas la
 * progression de l'apprenant, qui vient d'IndexedDB.
 */
export type IndexFamille = {
  racine: string;
  fichier: string;
  traits: string;
  n: number;
  avancement_possible: number;
};

/**
 * Un conte disponible : ses versions par niveau, et le fichier qui les porte. `gratuit`
 * marque les contes de l'offre gratuite (brief §10 : trois contes au seuil 255) ; l'index
 * ne le porte pas encore, il vaut alors `false`, et rien ne s'en sert pour fermer un conte.
 */
export type IndexConte = {
  id: string;
  /** Le vrai titre du récit (愚公移山) et son pinyin ; vides dans un export plus ancien. */
  titre_zh?: string;
  titre_pinyin?: string;
  titre_fr: string;
  /** Les niveaux écrits (« 255 », « hsk3 »), du plus petit au plus grand ; le nom est historique. */
  seuils: Niveau[];
  fichier: string;
  gratuit?: boolean;
};

/** Relit les contes de l'index : une entrée sans identifiant ni fichier est écartée. */
export function lireContesIndex(v: unknown): IndexConte[] {
  if (!Array.isArray(v)) return [];
  const out: IndexConte[] = [];
  for (const x of v) {
    if (x === null || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id === '' || typeof o.fichier !== 'string') continue;
    const seuils = lireNiveaux(o.seuils);
    out.push({
      id: o.id,
      titre_zh: typeof o.titre_zh === 'string' ? o.titre_zh : '',
      titre_pinyin: typeof o.titre_pinyin === 'string' ? o.titre_pinyin : '',
      titre_fr: typeof o.titre_fr === 'string' ? o.titre_fr : '',
      seuils,
      fichier: o.fichier,
      gratuit: o.gratuit === true
    });
  }
  return out;
}

/**
 * Un récit du catalogue (`index.json`, `catalogue`) : ce qui est prévu, écrit ou pas. Ses
 * vrais titres, ses niveaux prévus (le seuil 255, des niveaux HSK) et son nombre de
 * chapitres : 1 pour une fable, plus pour un récit long. Aucun texte : une version
 * n'arrive que par `contes/`.
 */
export type CatalogueConte = {
  id: string;
  titre_zh: string;
  titre_pinyin: string;
  titre_fr: string;
  niveaux: Niveau[];
  chapitres: number;
};

/** Relit le catalogue de l'index. Absent (export plus ancien) : vide. */
export function lireCatalogueContes(v: unknown): CatalogueConte[] {
  if (!Array.isArray(v)) return [];
  const out: CatalogueConte[] = [];
  for (const x of v) {
    if (x === null || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id === '') continue;
    const niveaux = lireNiveaux(o.niveaux);
    out.push({
      id: o.id,
      titre_zh: typeof o.titre_zh === 'string' ? o.titre_zh : '',
      titre_pinyin: typeof o.titre_pinyin === 'string' ? o.titre_pinyin : '',
      titre_fr: typeof o.titre_fr === 'string' ? o.titre_fr : '',
      niveaux,
      chapitres: Number.isInteger(o.chapitres) && (o.chapitres as number) > 0 ? (o.chapitres as number) : 1
    });
  }
  return out;
}

/** Un jour de parcours : une brique nouvelle au plus, puis un ou deux composés. */
export type IndexJour = {
  jour: number;
  brique: string | null;
  composes: string[];
  non_reconcilie: boolean;
};

/** Un parcours : sa liste cible et ses jours, dans l'ordre. */
export type IndexParcours = { liste: string; regle: string; jours: IndexJour[] };

/**
 * `index.json` : la porte d'entrée de l'export versionné (`data/schema.md`).
 * `empreinte` est celle du build dont l'export est tiré ; `date` est la seule
 * chose qui bouge à contenu égal.
 */
export type Index = {
  version: string;
  date: string;
  empreinte: string;
  norme: string;
  perimetre: string;
  licences: string;
  listes: Record<string, string[]>;
  parcours: Record<string, IndexParcours>;
  familles: IndexFamille[];
  contes: IndexConte[];
  /** Ce que le catalogue des contes prévoit, écrit ou pas ; vide pour un export plus ancien. */
  catalogue?: CatalogueConte[];
  paires: string;
  /** Le fichier des fêtes, `fetes.json` ; vide pour un export qui n'en porte pas. */
  fetes: string;
  /** Le fichier des termes solaires, `saisons.json` ; vide pour un export qui n'en porte pas. */
  saisons: string;
  /** Le fichier des devinettes, `devinettes.json` ; vide pour un export qui n'en porte pas. */
  devinettes: string;
  /**
   * L'index de l'aperçu des textes à relire, `apercu/index.json` ; vide quand l'export n'a
   * rien à relire. Champ optionnel du pipeline : rien ne le lit tant que l'interrupteur
   * des Réglages est éteint.
   */
  apercu: string;
  /** Le fichier du dictionnaire éclair, `eclair.json` ; vide pour un export qui n'en porte pas. */
  eclair: string;
  /** Le fichier de la cuisine de Tao, `cuisine.json` ; vide pour un export qui n'en porte pas. */
  cuisine: string;
  /** Les lettres de Que relues, `lettres.json` (`lettres.ts`) ; vide pour un export qui n'en porte pas. */
  lettres: string;
  /** Le fichier du message WeChat, `wechat.json` ; vide pour un export qui n'en porte pas. */
  wechat?: string;
  /** Le fichier du personnage, `heros.json` (`heros.ts`) ; vide pour un export qui n'en porte pas. */
  heros?: string;
};

/** La version de données que l'app lit : le dossier exporté par `wenlu export`. */
export const VERSION_DONNEES = '0.1.0';

/** Le dossier d'une version exportée, à la racine publique. */
export function dossierVersion(version = VERSION_DONNEES): string {
  return `data/${version}`;
}

/** Lit l'index d'une version exportée. `fetchFn` est injecté dans les tests. */
export async function loadIndex(
  version = VERSION_DONNEES,
  fetchFn: typeof fetch = fetch
): Promise<Index> {
  const file = `${dossierVersion(version)}/index.json`;
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Index introuvable : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Index>;
  if (!Array.isArray(brut.familles) || typeof brut.version !== 'string') {
    throw new Error(`Index illisible : ${file}`);
  }
  return {
    version: brut.version,
    date: typeof brut.date === 'string' ? brut.date : '',
    empreinte: typeof brut.empreinte === 'string' ? brut.empreinte : '',
    norme: typeof brut.norme === 'string' ? brut.norme : '',
    perimetre: typeof brut.perimetre === 'string' ? brut.perimetre : '',
    licences: typeof brut.licences === 'string' ? brut.licences : '',
    listes: brut.listes ?? {},
    parcours: brut.parcours ?? {},
    familles: brut.familles,
    contes: lireContesIndex(brut.contes),
    catalogue: lireCatalogueContes(brut.catalogue),
    paires: typeof brut.paires === 'string' ? brut.paires : '',
    fetes: typeof brut.fetes === 'string' ? brut.fetes : '',
    saisons: typeof brut.saisons === 'string' ? brut.saisons : '',
    devinettes: typeof brut.devinettes === 'string' ? brut.devinettes : '',
    apercu: typeof brut.apercu === 'string' ? brut.apercu : '',
    eclair: typeof brut.eclair === 'string' ? brut.eclair : '',
    cuisine: typeof brut.cuisine === 'string' ? brut.cuisine : '',
    lettres: typeof brut.lettres === 'string' ? brut.lettres : '',
    wechat: typeof brut.wechat === 'string' ? brut.wechat : '',
    heros: typeof brut.heros === 'string' ? brut.heros : ''
  };
}

const index = new Map<string, Promise<Index>>();

/** Même chose, mais une seule requête par version pour toute la durée de vie de l'app. */
export function indexOnce(version = VERSION_DONNEES): Promise<Index> {
  let p = index.get(version);
  if (!p) {
    p = loadIndex(version).catch((e) => {
      index.delete(version);
      throw e;
    });
    index.set(version, p);
  }
  return p;
}

/** Le chemin du fichier d'une famille, prêt pour `loadFamille`. */
export function fichierFamille(i: Index, racine: string): string | null {
  const f = i.familles.find((x) => x.racine === racine);
  return f ? `${dossierVersion(i.version)}/${f.fichier}` : null;
}

/** Le chemin du fichier de tracés d'une famille, prêt pour `loadStrokes`. */
export function fichierTraits(i: Index, racine: string): string | null {
  const f = i.familles.find((x) => x.racine === racine);
  return f ? `${dossierVersion(i.version)}/${f.traits}` : null;
}

/* ---------- la couche d'accès : l'export d'abord, la démonstration en surcouche ---------- */

/**
 * L'index de la version courante, chargé une seule fois pour toute la durée de vie de
 * l'app. C'est la porte d'entrée : tout le reste passe par lui.
 */
export function contenu(version = VERSION_DONNEES): Promise<Index> {
  return indexOnce(version);
}

/** Une famille de l'export, à la demande : une requête par fichier, puis le cache. */
export async function famille(racine: string, version = VERSION_DONNEES): Promise<Famille | null> {
  const i = await contenu(version);
  const file = fichierFamille(i, racine);
  if (file === null) return null;
  const f = await familleOnce(file);
  retenirMembres(racine, f);
  return f;
}

/** Les tracés d'une famille, à la demande : une requête par fichier, puis le cache. */
export async function traits(racine: string, version = VERSION_DONNEES): Promise<StrokeSet> {
  const i = await contenu(version);
  const file = fichierTraits(i, racine);
  if (file === null) return {};
  return strokesOnce(file);
}

/* ---------- trouver la famille d'un caractère ---------- */

/**
 * `index.json` nomme les 238 familles mais pas leurs membres : pour savoir quelle
 * famille porte un caractère, il faut avoir lu le fichier de la famille. On retient
 * donc l'appartenance de chaque famille lue, et on cherche dans cet ordre :
 *
 * 1. le caractère est lui-même une racine — une seule requête ;
 * 2. les familles déjà lues ;
 * 3. les `pistes` que l'écran propose (les briques déjà posées du parcours, par
 *    exemple) — une requête chacune, au plus ;
 * 4. en dernier recours, toutes les familles (`toutesLesFamilles`).
 *
 * Un export qui porterait ses membres dans `index.json` supprimerait le point 4 :
 * c'est le seul endroit où l'app paie l'absence de cette liste.
 */
const racines = new Map<string, string>();

function retenirMembres(racine: string, f: Famille): void {
  racines.set(f.racine.c, racine);
  for (const x of f.fiches) racines.set(x.c, racine);
}

/** Nombre de fichiers lus de front quand il faut bien lire toutes les familles. */
export const FRONT = 8;

const toutes = new Map<string, Promise<Famille[]>>();

/**
 * Toutes les familles de l'export, lues une fois. Ma forêt en a besoin (238 familles,
 * 323 Kio au total, toutes précachées par le service worker) ; les pas de la session,
 * eux, n'en lisent qu'une poignée.
 */
export function toutesLesFamilles(version = VERSION_DONNEES): Promise<Famille[]> {
  let p = toutes.get(version);
  if (!p) {
    p = (async () => {
      const i = await contenu(version);
      const out: Famille[] = [];
      for (let k = 0; k < i.familles.length; k += FRONT) {
        const lot = i.familles.slice(k, k + FRONT);
        const lues = await Promise.all(lot.map((x) => famille(x.racine, version).catch(() => null)));
        for (const f of lues) if (f !== null) out.push(f);
      }
      return out;
    })().catch((e) => {
      toutes.delete(version);
      throw e;
    });
    toutes.set(version, p);
  }
  return p;
}

/** La racine de la famille d'un caractère, `null` si l'export ne le porte pas. */
export async function racineDe(
  c: string,
  pistes: readonly string[] = [],
  version = VERSION_DONNEES
): Promise<string | null> {
  if (c === '') return null;
  const connue = racines.get(c);
  if (connue !== undefined) return connue;
  const i = await contenu(version);
  if (i.familles.some((x) => x.racine === c)) {
    await famille(c, version);
    return racines.get(c) ?? null;
  }
  for (const piste of pistes) {
    if (racines.has(c)) break;
    await famille(piste, version).catch(() => null);
  }
  if (racines.has(c)) return racines.get(c) ?? null;
  await toutesLesFamilles(version);
  return racines.get(c) ?? null;
}

/* ---------- la surcouche de démonstration ---------- */

/**
 * D'où viennent les textes d'une fiche affichée. L'écran le trace : on ne fait jamais
 * passer une démonstration pour une fiche relue.
 */
export type SourceTextes = 'export' | 'demonstration' | 'apercu' | 'aucune';

/** Une fiche prête à s'afficher : la fiche de l'export, et d'où viennent ses textes. */
export type FicheLue = Fiche & { source: SourceTextes };

/**
 * Ce que l'écran dit quand ni l'export ni la démonstration n'ont de texte. Une ligne
 * d'interface, pour quelqu'un qui débute : pas de mot de l'atelier (« pipeline »).
 */
export const LIGNE_SANS_FICHE = "La fiche de ce caractère n'est pas encore écrite.";

/** Les familles de démonstration qui servent de surcouche, dans l'ordre de priorité. */
export const FICHIERS_SURCOUCHE = ['data/demo/familles/人.json', 'data/demo/familles/主.json'];

/** Une fiche porte-t-elle un texte ? Le pinyin et la décomposition n'en sont pas un. */
export function aDesTextes(f: Fiche): boolean {
  return f.origine_fr !== '' || f.fr !== '';
}

let surcouches: Promise<Map<string, Fiche>> | null = null;

/**
 * Les fiches de démonstration, par caractère : les deux familles (人, 主) d'abord, les
 * voisins de forme ensuite — eux ne donnent qu'un pinyin et un sens, jamais d'origine,
 * donc jamais d'étiquette.
 */
export function surcouchesDemo(): Promise<Map<string, Fiche>> {
  if (surcouches === null) {
    surcouches = (async () => {
      const out = new Map<string, Fiche>();
      for (const file of FICHIERS_SURCOUCHE) {
        const f = await familleOnce(file).catch(() => null);
        if (f === null) continue;
        for (const x of f.fiches) if (!out.has(x.c)) out.set(x.c, x);
      }
      const v = await voisinsOnce().catch(() => null);
      for (const x of v?.voisins ?? []) {
        if (out.has(x.c)) continue;
        out.set(x.c, {
          c: x.c,
          pinyin: x.pinyin,
          fr: x.fr,
          en: '',
          parts: [],
          nouveau: [],
          role: null,
          origine_fr: '',
          origine_en: '',
          etiquette: null,
          mots: [],
          niveaux: {},
          traits: [],
          medianes: []
        });
      }
      return out;
    })().catch(() => new Map<string, Fiche>());
  }
  return surcouches;
}

/**
 * La fiche telle qu'elle s'affiche.
 *
 * Les fiches exportées sont vides tant qu'aucune n'est relue (`statut: "sans_fiche"`,
 * textes vides, `etiquette` nulle) : les textes de démonstration servent alors de
 * surcouche, et la source est tracée. Dès qu'une fiche relue porte un texte, c'est elle
 * qui passe devant, sans exception.
 *
 * La surcouche ne donne que des **textes** : sens, origine, étiquette, mots, phrase.
 * La décomposition canonique, l'élément ajouté, le pinyin, les niveaux et le statut
 * restent ceux de l'export — la norme GF 0014-2009 fait foi, pas la maquette. Le rôle
 * n'est repris que si la démonstration décompose exactement comme l'export : sinon il
 * ne parle pas du même découpage.
 */
export function surcoucher(exportee: Fiche, demo: Fiche | null): FicheLue {
  if (aDesTextes(exportee)) return { ...exportee, source: 'export' };
  if (demo === null || !aDesTextes(demo)) return { ...exportee, source: 'aucune' };
  const memeDecoupe =
    demo.parts.length === exportee.parts.length &&
    demo.parts.every((p, i) => p === exportee.parts[i]);
  return {
    ...exportee,
    pinyin: exportee.pinyin === '' ? demo.pinyin : exportee.pinyin,
    fr: demo.fr,
    en: demo.en,
    origine_fr: demo.origine_fr,
    origine_en: demo.origine_en,
    etiquette: demo.origine_fr === '' ? null : demo.etiquette,
    memo_fr: demo.memo_fr ?? null,
    memo_en: demo.memo_en ?? null,
    mots: demo.mots,
    phrase: demo.phrase ?? null,
    role: memeDecoupe ? demo.role : exportee.role,
    roles: memeDecoupe ? (demo.roles ?? exportee.roles) : exportee.roles,
    source: 'demonstration'
  };
}

/**
 * La fiche d'un caractère : sa famille est trouvée par l'index, puis surcouchée. L'aperçu
 * allumé, une fiche à relire passe devant la démonstration (`appliquerApercu`).
 */
export async function fiche(
  c: string,
  pistes: readonly string[] = [],
  version = VERSION_DONNEES
): Promise<FicheLue | null> {
  const racine = await racineDe(c, pistes, version);
  const f = racine === null ? null : await famille(racine, version);
  const exportee = f === null ? null : ficheDeFamille(f, c);
  const demo = (await surcouchesDemo()).get(c) ?? null;
  if (exportee === null) return demo === null ? null : { ...demo, source: 'demonstration' };
  const lue = surcoucher(exportee, demo);
  if (!apercuAllume || racine === null || lue.source === 'export') return lue;
  return appliquerApercu(lue, await ficheApercu(c, racine, version).catch(() => null));
}

/** Les fiches de plusieurs caractères, dans l'ordre demandé. Les inconnus sont écartés. */
export async function fiches(
  cs: readonly string[],
  pistes: readonly string[] = [],
  version = VERSION_DONNEES
): Promise<FicheLue[]> {
  const out: FicheLue[] = [];
  for (const c of cs) {
    const f = await fiche(c, pistes, version);
    if (f !== null) out.push(f);
  }
  return out;
}

/**
 * Toutes les fiches de l'export, surcouchées : le corpus de la révision et des jeux.
 * L'aperçu n'y entre jamais : une question ne se pose pas sur un texte que personne n'a
 * relu, et l'interrupteur ne change ni la pile ni les cartes mises de côté.
 */
export async function toutesLesFiches(version = VERSION_DONNEES): Promise<FicheLue[]> {
  const [lues, demo] = await Promise.all([toutesLesFamilles(version), surcouchesDemo()]);
  return lues.flatMap((f) => f.fiches.map((x) => surcoucher(x, demo.get(x.c) ?? null)));
}

/* ---------- les tracés d'un caractère ---------- */

/**
 * Les tracés d'un caractère (style 楷), pris dans le fichier de sa famille — 472
 * caractères dans l'export. Repli sur `strokes-demo.json` pour ce que l'export ne porte
 * pas encore : les caractères des anecdotes et de la maquette.
 */
export async function traitsDe(
  c: string,
  pistes: readonly string[] = [],
  version = VERSION_DONNEES
): Promise<StrokeData | null> {
  const racine = await racineDe(c, pistes, version).catch(() => null);
  if (racine !== null) {
    const set = await traits(racine, version).catch(() => ({}) as StrokeSet);
    const d = set[c];
    if (d) return d;
  }
  const demo = await strokesOnce().catch(() => ({}) as StrokeSet);
  return demo[c] ?? null;
}

/** Les tracés de plusieurs familles, réunis : ce qu'un écran sait dessiner. */
export async function traitsDeFamilles(
  voulues: readonly string[],
  version = VERSION_DONNEES
): Promise<StrokeSet> {
  const out: StrokeSet = {};
  for (const r of [...new Set(voulues)]) {
    const set = await traits(r, version).catch(() => ({}) as StrokeSet);
    Object.assign(out, set);
  }
  return out;
}

/* ---------- le parcours, jour par jour ---------- */

/** Les parcours que l'export porte. « Voyager » n'en a pas encore : il suit « Lire ». */
export const PARCOURS_DEFAUT = 'lire';

/** Le nom de parcours à lire dans l'index, pour le parcours choisi par l'utilisateur. */
export function nomParcours(i: Index, choisi: string | null): string {
  if (choisi !== null && i.parcours[choisi]) return choisi;
  return i.parcours[PARCOURS_DEFAUT] ? PARCOURS_DEFAUT : (Object.keys(i.parcours)[0] ?? '');
}

/**
 * Le jour du parcours qu'une session pose : une brique nouvelle au plus, puis un ou
 * deux composés. Un jour non réconcilié est sauté — sa décomposition n'est pas conforme
 * à la norme, on ne l'enseigne pas — et son numéro est gardé dans `sautes` : c'est la
 * trace, que l'écran journalise.
 */
export type JourChoisi = {
  jour: number;
  brique: string | null;
  composes: string[];
  /** Les jours non réconciliés franchis pour arriver là. */
  sautes: number[];
};

/** Le jour `jour` du parcours `nom`, ou le premier jour réconcilié qui suit. */
export function jourDuParcours(i: Index, nom: string, jour: number): JourChoisi | null {
  const p = i.parcours[nom];
  if (!p || p.jours.length === 0) return null;
  const sautes: number[] = [];
  for (let k = Math.max(1, Math.floor(jour)); k <= p.jours.length; k++) {
    const j = p.jours[k - 1];
    if (j === undefined) break;
    if (j.non_reconcilie || (j.brique === null && j.composes.length === 0)) {
      sautes.push(j.jour);
      continue;
    }
    return { jour: j.jour, brique: j.brique, composes: [...j.composes], sautes };
  }
  return null;
}

/** Les briques posées jusqu'à ce jour, de la plus récente à la plus ancienne. */
export function briquesPosees(i: Index, nom: string, jour: number): string[] {
  const p = i.parcours[nom];
  if (!p) return [];
  return p.jours
    .filter((j) => j.jour <= jour && j.brique !== null)
    .map((j) => j.brique as string)
    .reverse();
}

/* ---------- les paires à ne pas confondre de l'export ---------- */

/** Le fichier des paires de la version courante, tel que l'index le nomme. */
export function fichierPaires(i: Index): string {
  return i.paires === '' ? '' : `${dossierVersion(i.version)}/${i.paires}`;
}

/** Les paires à ne pas confondre de l'export, brutes : `questions.lirePaires` les valide. */
export async function pairesExport(version = VERSION_DONNEES): Promise<unknown> {
  const i = await contenu(version);
  const file = fichierPaires(i);
  if (file === '') return { paires: [] };
  return pairesOnce(file);
}

/* ---------- les fêtes ---------- */

/**
 * Les fêtes que l'app connaît, dans l'ordre de l'année : le Nouvel An lunaire 春节, la fête
 * des Lanternes 元宵, 清明, la fête des bateaux 端午, 七夕, la mi-automne 中秋, le double neuf
 * 重阳 et le solstice d'hiver 冬至. Leurs dates et leurs textes viennent de `fetes.json`.
 */
export type FeteId =
  | 'chunjie'
  | 'yuanxiao'
  | 'qingming'
  | 'duanwu'
  | 'qixi'
  | 'zhongqiu'
  | 'chongyang'
  | 'dongzhi';

export const FETES: readonly FeteId[] = [
  'chunjie',
  'yuanxiao',
  'qingming',
  'duanwu',
  'qixi',
  'zhongqiu',
  'chongyang',
  'dongzhi'
];

/** L'animal de l'année lunaire, pour le vœu du Nouvel An. `fr` porte son article. */
export type Animal = { c: string; pinyin: string; fr: string };

/**
 * Une fête d'une année : sa date grégorienne (calculée par le pipeline sur le calendrier
 * luni-solaire) et sa fenêtre, `avant` et `apres` en jours autour de la date.
 */
export type EntreeFete = {
  fete: FeteId;
  date: string;
  avant: number;
  apres: number;
  annee: number;
  animal: Animal;
};

/**
 * Les textes d'une fête, rédigés pour l'app. `{animal}` et `{quand}` sont des jetons que
 * `fetes.ts` remplit au jour de la fête.
 */
export type TextesFete = {
  nom: string;
  nom_zh: string;
  voeu: { zh: string; pinyin: string; fr: string };
  /** Le caractère dessiné à côté du vœu (le 福 à l'envers), `null` sans caractère. */
  caractere_voeu: string | null;
  tao: string[];
  /**
   * L'anecdote de la fête. `c` est son caractère bonus, dessiné depuis ses traits ;
   * `pinyin` (Unihan, vide s'il manque) et `sens` le présentent sous l'emblème.
   */
  anecdote: { rubrique: string; c: string; pinyin?: string; sens?: string; titre: string; texte: string };
};

/**
 * `fetes.json` : le calendrier, les textes, et la famille de chaque caractère dessiné
 * (`racines`), pour trouver ses traits sans relire toutes les familles.
 */
export type Fetes = {
  version: string;
  source: string;
  calendrier: EntreeFete[];
  fetes: Partial<Record<FeteId, TextesFete>>;
  racines: Record<string, string>;
};

function estFete(v: unknown): v is FeteId {
  return typeof v === 'string' && (FETES as readonly string[]).includes(v);
}

/**
 * Lit et valide un fichier de fêtes. Une entrée illisible ou d'une fête inconnue est
 * écartée : mieux vaut une fête de moins qu'un décor faux. `fetchFn` est injecté dans
 * les tests.
 */
export async function loadFetes(file: string, fetchFn: typeof fetch = fetch): Promise<Fetes> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Fêtes introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Record<keyof Fetes, unknown>>;
  if (!Array.isArray(brut.calendrier) || typeof brut.fetes !== 'object' || brut.fetes === null) {
    throw new Error(`Fêtes illisibles : ${file}`);
  }
  const calendrier = (brut.calendrier as Partial<EntreeFete>[]).filter(
    (e): e is EntreeFete =>
      estFete(e.fete) &&
      typeof e.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      typeof e.avant === 'number' &&
      typeof e.apres === 'number' &&
      typeof e.animal === 'object' &&
      e.animal !== null
  );
  const fetes: Partial<Record<FeteId, TextesFete>> = {};
  for (const [id, t] of Object.entries(brut.fetes as Record<string, TextesFete>)) {
    if (estFete(id) && t && t.voeu && t.anecdote && Array.isArray(t.tao)) fetes[id] = t;
  }
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    calendrier,
    fetes,
    racines:
      typeof brut.racines === 'object' && brut.racines !== null
        ? (brut.racines as Record<string, string>)
        : {}
  };
}

const lesFetes = new Map<string, Promise<Fetes>>();

/** Le fichier des fêtes d'une version, tel que l'index le nomme. */
export function fichierFetes(i: Index): string {
  return i.fetes === '' ? '' : `${dossierVersion(i.version)}/${i.fetes}`;
}

/** Une fête vide : ce que rend un export sans `fetes.json`. L'app ne se met jamais en fête. */
const SANS_FETE: Fetes = { version: '', source: '', calendrier: [], fetes: {}, racines: {} };

/** Les fêtes de la version courante, lues une fois pour toute la durée de vie de l'app. */
export function fetesOnce(version = VERSION_DONNEES): Promise<Fetes> {
  let p = lesFetes.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierFetes(i);
        return file === '' ? SANS_FETE : loadFetes(file);
      })
      .catch((e) => {
        lesFetes.delete(version);
        throw e;
      });
    lesFetes.set(version, p);
  }
  return p;
}

/* ---------- les vingt-quatre termes solaires ---------- */

/**
 * Un terme d'une année : le jour où il commence et celui où commence le suivant (exclu),
 * calculés par le pipeline à l'heure de Pékin. `terme` est l'identifiant, le pinyin sans
 * ton (`bailu`, `qiufen`).
 */
export type EntreeTerme = { terme: string; debut: string; fin: string };

/** Les textes d'un terme, rédigés pour l'app (`data/sources/saisons/textes.tsv`). */
export type TextesTerme = {
  nom_zh: string;
  pinyin: string;
  fr: string;
  /** L'ambiance de saison : la palette légère et le décor (`[data-saison]`). */
  ambiance: string;
  /** Une phrase : ce qui se passe dans la nature. */
  ligne: string;
  tao: string[];
  /** Le caractère à lire, dessiné depuis ses traits ; son pinyin (Unihan) et son sens. */
  caractere: { c: string; pinyin: string; sens: string };
};

/** `saisons.json` : le calendrier des termes, leurs textes, et les racines des caractères. */
export type Saisons = {
  version: string;
  source: string;
  /** La rubrique et l'explication de l'anecdote du jour où un terme commence. */
  rubrique: string;
  explication: string;
  ambiances: string[];
  calendrier: EntreeTerme[];
  termes: Record<string, TextesTerme>;
  racines: Record<string, string>;
};

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function estTextesTerme(t: unknown): t is TextesTerme {
  if (typeof t !== 'object' || t === null) return false;
  const x = t as Partial<TextesTerme>;
  return (
    typeof x.nom_zh === 'string' &&
    typeof x.fr === 'string' &&
    typeof x.ambiance === 'string' &&
    typeof x.ligne === 'string' &&
    Array.isArray(x.tao) &&
    typeof x.caractere === 'object' &&
    x.caractere !== null &&
    typeof x.caractere.c === 'string'
  );
}

/**
 * Lit et valide un fichier de termes solaires. Une entrée illisible, ou d'un terme sans
 * textes, est écartée : ce jour-là, l'app reste sur son papier ordinaire. `fetchFn` est
 * injecté dans les tests.
 */
export async function loadSaisons(file: string, fetchFn: typeof fetch = fetch): Promise<Saisons> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Termes solaires introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Partial<Record<keyof Saisons, unknown>>;
  if (!Array.isArray(brut.calendrier) || typeof brut.termes !== 'object' || brut.termes === null) {
    throw new Error(`Termes solaires illisibles : ${file}`);
  }
  const ambiances = Array.isArray(brut.ambiances)
    ? (brut.ambiances as unknown[]).filter((a): a is string => typeof a === 'string')
    : [];
  const termes: Record<string, TextesTerme> = {};
  for (const [id, t] of Object.entries(brut.termes as Record<string, unknown>)) {
    if (estTextesTerme(t) && ambiances.includes(t.ambiance)) {
      termes[id] = {
        ...t,
        pinyin: t.pinyin ?? '',
        caractere: { c: t.caractere.c, pinyin: t.caractere.pinyin ?? '', sens: t.caractere.sens ?? '' }
      };
    }
  }
  const calendrier = (brut.calendrier as Partial<EntreeTerme>[]).filter(
    (e): e is EntreeTerme =>
      typeof e.terme === 'string' &&
      e.terme in termes &&
      typeof e.debut === 'string' &&
      DATE_ISO.test(e.debut) &&
      typeof e.fin === 'string' &&
      DATE_ISO.test(e.fin)
  );
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    rubrique: typeof brut.rubrique === 'string' ? brut.rubrique : '',
    explication: typeof brut.explication === 'string' ? brut.explication : '',
    ambiances,
    calendrier,
    termes,
    racines:
      typeof brut.racines === 'object' && brut.racines !== null
        ? (brut.racines as Record<string, string>)
        : {}
  };
}

const lesSaisons = new Map<string, Promise<Saisons>>();

/** Le fichier des termes solaires d'une version, tel que l'index le nomme. */
export function fichierSaisons(i: Index): string {
  return i.saisons === '' ? '' : `${dossierVersion(i.version)}/${i.saisons}`;
}

/** Aucun terme : ce que rend un export sans `saisons.json`. L'app garde son papier. */
const SANS_SAISON: Saisons = {
  version: '',
  source: '',
  rubrique: '',
  explication: '',
  ambiances: [],
  calendrier: [],
  termes: {},
  racines: {}
};

/** Les termes solaires de la version courante, lus une fois pour toute la vie de l'app. */
export function saisonsOnce(version = VERSION_DONNEES): Promise<Saisons> {
  let p = lesSaisons.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierSaisons(i);
        return file === '' ? SANS_SAISON : loadSaisons(file);
      })
      .catch((e) => {
        lesSaisons.delete(version);
        throw e;
      });
    lesSaisons.set(version, p);
  }
  return p;
}

/* ---------- les devinettes de lanternes ---------- */

/** Comment les briques se disposent, au premier niveau de la structure du caractère. */
export type Disposition = 'cote' | 'superpose' | 'dedans' | 'enveloppe' | 'mele';

const DISPOSITIONS: readonly Disposition[] = ['cote', 'superpose', 'dedans', 'enveloppe', 'mele'];

/**
 * Une devinette de lanterne (灯谜) : une décomposition déguisée, rédigée dans le pipeline
 * (`data/sources/devinettes/`). `enonce` décrit les `briques` et leur disposition ; `zh`
 * est l'énoncé chinois traditionnel, `null` quand il n'y en a pas d'exact. Les trois
 * `leurres` sont choisis à l'export par ressemblance de composants.
 */
export type Devinette = {
  id: string;
  c: string;
  pinyin: string;
  sens: string;
  enonce: string;
  zh: string | null;
  disposition: Disposition;
  briques: string[];
  leurres: string[];
};

/**
 * `devinettes.json` : les devinettes, le nom de chaque brique citée (la correction le
 * montre), et la famille de chaque caractère dessiné, pour trouver ses traits.
 */
export type Devinettes = {
  version: string;
  source: string;
  devinettes: Devinette[];
  noms: Record<string, string>;
  racines: Record<string, string>;
};

function listeDeTextes(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '')
    ? (v as string[])
    : null;
}

function tableDeTextes(v: unknown): Record<string, string> {
  if (typeof v !== 'object' || v === null) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === 'string') out[k] = x;
  }
  return out;
}

/** Une devinette lisible, ou `null` : mieux vaut une devinette de moins qu'une énigme fausse. */
function lireDevinette(v: unknown): Devinette | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  const briques = listeDeTextes(d.briques);
  const leurres = listeDeTextes(d.leurres);
  if (
    typeof d.id !== 'string' ||
    d.id === '' ||
    typeof d.c !== 'string' ||
    d.c === '' ||
    typeof d.enonce !== 'string' ||
    d.enonce === '' ||
    !briques ||
    briques.length < 2 ||
    !leurres ||
    leurres.length === 0 ||
    leurres.includes(d.c) ||
    new Set(leurres).size !== leurres.length
  ) {
    return null;
  }
  return {
    id: d.id,
    c: d.c,
    pinyin: typeof d.pinyin === 'string' ? d.pinyin : '',
    sens: typeof d.sens === 'string' ? d.sens : '',
    enonce: d.enonce,
    zh: typeof d.zh === 'string' && d.zh !== '' ? d.zh : null,
    disposition: (DISPOSITIONS as readonly unknown[]).includes(d.disposition)
      ? (d.disposition as Disposition)
      : 'cote',
    briques,
    leurres
  };
}

/** Lit et valide un fichier de devinettes. `fetchFn` est injecté dans les tests. */
export async function loadDevinettes(
  file: string,
  fetchFn: typeof fetch = fetch
): Promise<Devinettes> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Devinettes introuvables : ${file} (${r.status})`);
  const brut = (await r.json()) as Record<string, unknown>;
  if (!Array.isArray(brut.devinettes)) throw new Error(`Devinettes illisibles : ${file}`);
  const vues = new Set<string>();
  const devinettes = brut.devinettes.flatMap((v: unknown) => {
    const d = lireDevinette(v);
    if (d === null || vues.has(d.id)) return [];
    vues.add(d.id);
    return [d];
  });
  return {
    version: typeof brut.version === 'string' ? brut.version : '',
    source: typeof brut.source === 'string' ? brut.source : '',
    devinettes,
    noms: tableDeTextes(brut.noms),
    racines: tableDeTextes(brut.racines)
  };
}

/** Le fichier des devinettes d'une version, tel que l'index le nomme. */
export function fichierDevinettes(i: Index): string {
  return i.devinettes === '' ? '' : `${dossierVersion(i.version)}/${i.devinettes}`;
}

/** Aucune devinette : ce que rend un export sans `devinettes.json`. Le jeu se tait. */
const SANS_DEVINETTE: Devinettes = {
  version: '',
  source: '',
  devinettes: [],
  noms: {},
  racines: {}
};

const lesDevinettes = new Map<string, Promise<Devinettes>>();

/** Les devinettes de la version courante, lues une fois pour toute la durée de vie de l'app. */
export function devinettesOnce(version = VERSION_DONNEES): Promise<Devinettes> {
  let p = lesDevinettes.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierDevinettes(i);
        return file === '' ? SANS_DEVINETTE : loadDevinettes(file);
      })
      .catch((e) => {
        lesDevinettes.delete(version);
        throw e;
      });
    lesDevinettes.set(version, p);
  }
  return p;
}

/* ---------- les contes (story 1.7, épic 2c) ---------- */

/** Une phrase d'un conte : l'unité d'affichage, d'audio et de traduction. */
export type PhraseConte = { zh: string; pinyin: string; fr: string };

/**
 * Une version d'un conte, réécrite avec les seuls caractères d'un niveau. `glose` donne,
 * pour chaque caractère distinct du titre et du texte, le sens qu'il a ici, en français.
 */
export type VersionConte = {
  /** Le niveau de la version : « 255 », « hsk3 » ; le nom est historique. */
  seuil: Niveau;
  titre: string;
  /** Tout le texte, phrase après phrase ; pour un récit long, chapitre après chapitre. */
  phrases: PhraseConte[];
  glose: Record<string, string>;
  /** `a_relire` pour une version de l'aperçu, qui porte alors la mention « à relire ». */
  statut?: 'a_relire';
  /**
   * Un récit long, lu chapitre par chapitre : ses chapitres, dans l'ordre. Absent pour une
   * fable, qui se lit d'une traite (`lecture.chapitresDe` en fait un seul chapitre).
   */
  chapitres?: ChapitreConte[];
  /**
   * Les mots expliqués : hors du niveau, ils nomment un personnage ou un objet clé du récit
   * (狼, 叶公). Le lecteur les montre avant le texte ; ils ne comptent pas dans l'acquis
   * qui ouvre le conte. Absent pour la plupart des versions.
   */
  expliques?: MotConte[];
};

/** Un mot expliqué d'une version de conte, tel que l'export le donne. */
export type MotConte = {
  zh: string;
  pinyin: string;
  fr: string;
  en: string;
  explication_fr: string;
  explication_en: string;
  /** Ceux de ses caractères qui sont hors du niveau (叶 pour 叶公) : l'acquis ne les demande pas. */
  caracteres: string;
  /** Les familles où trouver les traits de ces caractères (`racines` du conte exporté). */
  pistes: string[];
};

/** Un chapitre d'un récit long : son titre chinois, son pinyin, son titre français, ses phrases. */
export type ChapitreConte = {
  titre: string;
  titre_pinyin: string;
  titre_fr: string;
  phrases: PhraseConte[];
};

/** Un conte de l'export (`contes/<id>.json`) : ses versions, du plus petit niveau au plus grand. */
export type Conte = {
  version: string;
  source: string;
  id: string;
  /** Le vrai titre du récit (愚公移山) et son pinyin, montrés tels quels. */
  titre_zh?: string;
  titre_pinyin?: string;
  titre_fr: string;
  versions: VersionConte[];
};

function chaine(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Les phrases lisibles d'une liste : une phrase sans chinois est écartée. */
function lirePhrases(v: unknown): PhraseConte[] {
  const phrases: PhraseConte[] = [];
  if (!Array.isArray(v)) return phrases;
  for (const x of v) {
    if (x === null || typeof x !== 'object') continue;
    const ph = x as Record<string, unknown>;
    if (chaine(ph.zh) === '') continue;
    phrases.push({ zh: chaine(ph.zh), pinyin: chaine(ph.pinyin), fr: chaine(ph.fr) });
  }
  return phrases;
}

/**
 * Les chapitres d'un récit long, dans l'ordre. Un chapitre sans phrase lisible est écarté,
 * si bien que le rang d'un chapitre est celui qu'il a ici, de 1 au nombre lu.
 */
function lireChapitres(v: unknown): ChapitreConte[] {
  if (!Array.isArray(v)) return [];
  const out: ChapitreConte[] = [];
  for (const x of v) {
    if (x === null || typeof x !== 'object') continue;
    const c = x as Record<string, unknown>;
    const phrases = lirePhrases(c.phrases);
    if (phrases.length === 0) continue;
    out.push({
      titre: chaine(c.titre),
      titre_pinyin: chaine(c.titre_pinyin),
      titre_fr: chaine(c.titre_fr),
      phrases
    });
  }
  return out;
}

/**
 * Les mots expliqués d'une version. Un mot sans chinois ou sans caractère hors du niveau
 * est écarté ; `racines`, celles du conte, disent où trouver les traits de ses caractères.
 */
function lireExpliques(v: unknown, racines: Readonly<Record<string, string>>): MotConte[] {
  if (!Array.isArray(v)) return [];
  const out: MotConte[] = [];
  for (const x of v) {
    if (x === null || typeof x !== 'object') continue;
    const m = x as Record<string, unknown>;
    const zh = chaine(m.zh);
    const caracteres = Array.from(chaine(m.caracteres))
      .filter((c) => zh.includes(c))
      .join('');
    if (zh === '' || caracteres === '') continue;
    out.push({
      zh,
      pinyin: chaine(m.pinyin),
      fr: chaine(m.fr),
      en: chaine(m.en),
      explication_fr: chaine(m.explication_fr),
      explication_en: chaine(m.explication_en),
      caracteres,
      pistes: [...new Set(Array.from(caracteres).flatMap((c) => (racines[c] ? [racines[c]] : [])))]
    });
  }
  return out;
}

/**
 * Relit une version : une fable par ses `phrases`, un récit long par ses `chapitres`, dont
 * les phrases font alors `phrases`. Sans phrase lisible, elle est écartée (`null`).
 */
function lireVersion(
  seuil: Niveau,
  v: unknown,
  racines: Readonly<Record<string, string>> = {}
): VersionConte | null {
  if (v === null || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const chapitres = lireChapitres(o.chapitres);
  const phrases = chapitres.length > 0 ? chapitres.flatMap((c) => c.phrases) : lirePhrases(o.phrases);
  if (phrases.length === 0) return null;
  const glose: Record<string, string> = {};
  if (o.glose !== null && typeof o.glose === 'object') {
    for (const [k, sens] of Object.entries(o.glose as Record<string, unknown>)) {
      /* Le pipeline écrit la glose en objet {pinyin, fr, en} ; une chaîne seule reste lue. */
      const fr =
        typeof sens === 'string'
          ? sens
          : sens !== null && typeof sens === 'object' && typeof (sens as { fr?: unknown }).fr === 'string'
            ? (sens as { fr: string }).fr
            : '';
      if (k !== '' && fr !== '') glose[k] = fr;
    }
  }
  const lue: VersionConte = { seuil, titre: chaine(o.titre), phrases, glose };
  if (chapitres.length > 0) lue.chapitres = chapitres;
  if (o.statut === STATUT_A_RELIRE) lue.statut = STATUT_A_RELIRE;
  const expliques = lireExpliques(o.expliques, racines);
  if (expliques.length > 0) lue.expliques = expliques;
  return lue;
}

/**
 * Relit un conte exporté. Les versions sont rangées sous leur niveau (`"255"`, `"hsk3"`) ;
 * une clé qui n'est pas un niveau, ou une version sans phrase, est écartée.
 */
export function lireConte(brut: unknown, file = ''): Conte {
  if (brut === null || typeof brut !== 'object') throw new Error(`Conte illisible : ${file}`);
  const o = brut as Record<string, unknown>;
  const id = chaine(o.conte);
  if (id === '' || o.versions === null || typeof o.versions !== 'object') {
    throw new Error(`Conte illisible : ${file}`);
  }
  const versions: VersionConte[] = [];
  /* La famille de chaque caractère des mots expliqués, pour trouver ses traits. */
  const racines: Record<string, string> = {};
  if (o.racines !== null && typeof o.racines === 'object') {
    for (const [c, r] of Object.entries(o.racines as Record<string, unknown>)) {
      if (typeof r === 'string' && r !== '') racines[c] = r;
    }
  }
  for (const [cle, v] of Object.entries(o.versions as Record<string, unknown>)) {
    const seuil = lireNiveau(cle);
    if (seuil === null) continue;
    const lue = lireVersion(seuil, v, racines);
    if (lue !== null) versions.push(lue);
  }
  versions.sort((a, b) => comparerNiveaux(a.seuil, b.seuil));
  return {
    version: chaine(o.version),
    source: chaine(o.source),
    id,
    titre_zh: chaine(o.titre_zh),
    titre_pinyin: chaine(o.titre_pinyin),
    titre_fr: chaine(o.titre_fr),
    versions
  };
}

/** Lit un conte servi avec l'app. `fetchFn` est injecté dans les tests. */
export async function loadConte(file: string, fetchFn: typeof fetch = fetch): Promise<Conte> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Conte introuvable : ${file} (${r.status})`);
  return lireConte(await r.json(), file);
}

const contesCharges = new Map<string, Promise<Conte>>();

/** Même chose, mais une seule requête par fichier pour toute la durée de vie de l'app. */
export function conteOnce(file: string): Promise<Conte> {
  let p = contesCharges.get(file);
  if (!p) {
    p = loadConte(file).catch((e) => {
      contesCharges.delete(file);
      throw e;
    });
    contesCharges.set(file, p);
  }
  return p;
}

/** Le chemin du fichier d'un conte, prêt pour `loadConte`. */
export function fichierConte(i: Index, id: string): string | null {
  const c = i.contes.find((x) => x.id === id);
  return c ? `${dossierVersion(i.version)}/${c.fichier}` : null;
}

/**
 * Les contes de l'export, chacun lu une fois, et le catalogue de ce qui est prévu. Un
 * fichier absent ou illisible manque à la table : la bibliothèque garde l'entrée de
 * l'index, fermée, plutôt que de la taire.
 */
export async function contesExport(
  version = VERSION_DONNEES
): Promise<{ index: IndexConte[]; contes: Map<string, Conte>; catalogue: CatalogueConte[] }> {
  const i = await contenu(version);
  const catalogue = i.catalogue ?? [];
  const lus = await contesLus(i);
  if (!apercuAllume || i.apercu === '') return { ...lus, catalogue };
  return {
    ...fusionnerContes(lus, await contesApercu(version).catch(() => null)),
    catalogue
  };
}

/** Les contes relus de l'index, chacun lu une fois. */
async function contesLus(i: Index): Promise<{ index: IndexConte[]; contes: Map<string, Conte> }> {
  const lus = await Promise.all(
    i.contes.map((x) => {
      const file = fichierConte(i, x.id);
      return file === null ? Promise.resolve(null) : conteOnce(file).catch(() => null);
    })
  );
  const contes = new Map<string, Conte>();
  i.contes.forEach((x, k) => {
    const c = lus[k];
    if (c) contes.set(x.id, c);
  });
  return { index: i.contes, contes };
}

/** Le nombre de contes que la bibliothèque montre : ceux de l'aperçu en plus, s'il est allumé. */
export async function nombreDeContes(version = VERSION_DONNEES): Promise<number> {
  const i = await contenu(version);
  if (!apercuAllume || i.apercu === '') return i.contes.length;
  return (await contesExport(version)).index.length;
}

/* ---------- ce que le tableau des trophées lit ---------- */

/**
 * Le contenu du tableau des trophées : l'index (parcours et contes), toutes les familles,
 * les paires brutes (`trophees.ts` les relit par `questions.lirePaires`), et le sens de
 * chaque caractère quand la surcouche en donne un. Une seule lecture, puis les caches.
 */
export type ContenuTropheesLu = {
  index: Index;
  familles: Famille[];
  paires: unknown;
  sens: Map<string, string>;
};

export async function contenuTrophees(version = VERSION_DONNEES): Promise<ContenuTropheesLu> {
  const [i, familles, paires, demo] = await Promise.all([
    contenu(version),
    toutesLesFamilles(version),
    pairesExport(version).catch(() => ({ paires: [] })),
    surcouchesDemo()
  ]);
  const sens = new Map<string, string>();
  for (const f of familles) {
    if (f.racine.fr) sens.set(f.racine.c, f.racine.fr);
    for (const x of f.fiches) if (x.fr && !sens.has(x.c)) sens.set(x.c, x.fr);
  }
  for (const [c, x] of demo) if (x.fr && !sens.has(c)) sens.set(c, x.fr);
  return { index: i, familles, paires, sens };
}

/* ---------- la leçon du jour, telle que les écrans de session la lisent ---------- */

/**
 * Ce qu'une session pose aujourd'hui : la brique du jour, ses composés, et les briques
 * déjà posées — les `pistes` qui évitent de relire toutes les familles. C'est la seule
 * lecture du parcours : les quatre écrans de la session passent par là, et voient donc
 * tous le même jour.
 */
export type Lecon = {
  /** Le parcours lu dans l'index : `lire` ou `hsk`. */
  nom: string;
  /** Le jour retenu, sauts compris. `null` quand le parcours est fini. */
  jour: JourChoisi | null;
  pistes: string[];
  brique: FicheLue | null;
  composes: FicheLue[];
};

const lecons = new Map<string, Promise<Lecon>>();

/** La leçon d'un jour, lue une fois : les écrans d'un même pas en partagent le résultat. */
export function lecon(
  choisi: string | null,
  jour: number,
  version = VERSION_DONNEES
): Promise<Lecon> {
  /* L'aperçu entre dans la clé : l'allumer ou l'éteindre relit la leçon. */
  const cle = `${version}/${choisi ?? ''}/${jour}/${apercuAllume ? 'apercu' : ''}`;
  let p = lecons.get(cle);
  if (!p) {
    p = (async () => {
      const i = await contenu(version);
      const nom = nomParcours(i, choisi);
      const j = jourDuParcours(i, nom, jour);
      if (j === null) return { nom, jour: null, pistes: [], brique: null, composes: [] };
      const pistes = briquesPosees(i, nom, j.jour);
      const brique = j.brique === null ? null : await fiche(j.brique, pistes, version);
      const composes = await fiches(j.composes, pistes, version);
      return { nom, jour: j, pistes, brique, composes };
    })().catch((e) => {
      lecons.delete(cle);
      throw e;
    });
    lecons.set(cle, p);
  }
  return p;
}

/** Le caractère du jour : le composé quand il y en a un, la brique sinon. */
export function caractereDuJour(l: Lecon): string {
  return l.composes[0]?.c ?? l.brique?.c ?? '';
}

/* ---------- l'aperçu des textes à relire ---------- */

/**
 * Le statut de tout ce que l'aperçu porte, tel que le pipeline l'écrit (`wenlu export`,
 * `apercu/`). Un texte relu n'y figure jamais : `wenlu check` le vérifie.
 */
export const STATUT_A_RELIRE = 'a_relire';

/** La mention que porte chaque texte de l'aperçu à l'écran. Une ligne d'interface. */
export const MENTION_A_RELIRE = 'à relire';

/**
 * Le mode relecture des Réglages, tel que la progression le range (`Progress.relecture`).
 * Éteint, ce module ne demande aucun fichier de `apercu/`.
 */
let apercuAllume = false;

/** Allume ou éteint l'aperçu. `App.svelte` le règle d'après la progression. */
export function reglerApercu(allume: boolean): void {
  apercuAllume = allume;
}

/** L'aperçu est-il allumé ? */
export function apercuActif(): boolean {
  return apercuAllume;
}

/** La mention à poser à côté d'un texte : « à relire » pour un texte de l'aperçu, rien sinon. */
export function mention(
  x: { statut?: string; source?: SourceTextes } | null | undefined
): string | null {
  if (!x) return null;
  return x.statut === STATUT_A_RELIRE || x.source === 'apercu' ? MENTION_A_RELIRE : null;
}

/** Une famille dans l'index de l'aperçu : son fichier, et les caractères qui y ont une fiche. */
export type FamilleApercu = { racine: string; fichier: string; caracteres: string[] };

/** `apercu/index.json` : ce que l'aperçu porte, et où. */
export type IndexApercu = { familles: FamilleApercu[]; contes: IndexConte[] };

/** Les textes à relire d'une fiche : ceux qu'une fiche relue porterait. */
export type FicheApercu = {
  c: string;
  statut: typeof STATUT_A_RELIRE;
  /** Le sens à relire, glose courte ; vide si la fiche ne l'a pas encore. */
  fr: string;
  en: string;
  role: Role | null;
  roles: Record<string, Role>;
  origine_fr: string;
  origine_en: string;
  etiquette: Etiquette | null;
  memo_fr: string | null;
  memo_en: string | null;
  mots: Mot[];
  phrase: Mot | null;
};

const APERCU_VIDE: IndexApercu = { familles: [], contes: [] };

function estRole(v: unknown): v is Role {
  return v === 'son' || v === 'sens' || v === 'forme';
}

function estMot(v: unknown): v is Mot {
  if (v === null || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.hanzi === 'string' &&
    m.hanzi !== '' &&
    typeof m.pinyin === 'string' &&
    typeof m.fr === 'string'
  );
}

/** Relit l'index de l'aperçu : une entrée sans fichier est écartée. */
export function lireIndexApercu(v: unknown): IndexApercu {
  if (v === null || typeof v !== 'object') return APERCU_VIDE;
  const o = v as Record<string, unknown>;
  const familles: FamilleApercu[] = [];
  for (const x of Array.isArray(o.familles) ? o.familles : []) {
    if (x === null || typeof x !== 'object') continue;
    const f = x as Record<string, unknown>;
    if (typeof f.racine !== 'string' || typeof f.fichier !== 'string' || f.fichier === '') continue;
    const caracteres = Array.isArray(f.caracteres)
      ? f.caracteres.filter((c): c is string => typeof c === 'string' && c !== '')
      : [];
    familles.push({ racine: f.racine, fichier: f.fichier, caracteres });
  }
  return { familles, contes: lireContesIndex(o.contes) };
}

/**
 * Relit les fiches d'une famille de l'aperçu, par caractère. Seules celles marquées
 * `a_relire` sont gardées : l'aperçu ne fait jamais passer un autre statut pour le sien.
 */
export function lireFamilleApercu(v: unknown): Map<string, FicheApercu> {
  const out = new Map<string, FicheApercu>();
  if (v === null || typeof v !== 'object') return out;
  const fiches = (v as Record<string, unknown>).fiches;
  for (const x of Array.isArray(fiches) ? fiches : []) {
    if (x === null || typeof x !== 'object') continue;
    const f = x as Record<string, unknown>;
    if (typeof f.c !== 'string' || f.c === '' || f.statut !== STATUT_A_RELIRE) continue;
    const roles: Record<string, Role> = {};
    if (f.roles !== null && typeof f.roles === 'object') {
      for (const [k, r] of Object.entries(f.roles as Record<string, unknown>)) {
        if (estRole(r)) roles[k] = r;
      }
    }
    const origine_fr = chaine(f.origine_fr);
    out.set(f.c, {
      c: f.c,
      statut: STATUT_A_RELIRE,
      fr: chaine(f.fr),
      en: chaine(f.en),
      role: estRole(f.role) ? f.role : null,
      roles,
      origine_fr,
      origine_en: chaine(f.origine_en),
      /* Jamais d'étiquette sans origine derrière, ni d'étiquette inconnue. */
      etiquette:
        origine_fr !== '' && (f.etiquette === 'atteste' || f.etiquette === 'mnemotechnique')
          ? f.etiquette
          : null,
      memo_fr: typeof f.memo_fr === 'string' && f.memo_fr !== '' ? f.memo_fr : null,
      memo_en: typeof f.memo_en === 'string' && f.memo_en !== '' ? f.memo_en : null,
      mots: Array.isArray(f.mots) ? f.mots.filter(estMot) : [],
      phrase: estMot(f.phrase) ? f.phrase : null
    });
  }
  return out;
}

async function lireJSON(file: string): Promise<unknown> {
  const r = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Aperçu introuvable : ${file} (${r.status})`);
  return (await r.json()) as unknown;
}

const indexApercus = new Map<string, Promise<IndexApercu>>();
const famillesApercu = new Map<string, Promise<Map<string, FicheApercu>>>();

/**
 * L'index de l'aperçu d'une version, lu une fois. Éteint, ou sans aperçu dans l'export,
 * il est vide et rien n'est demandé.
 */
export function apercuOnce(version = VERSION_DONNEES): Promise<IndexApercu> {
  if (!apercuAllume) return Promise.resolve(APERCU_VIDE);
  let p = indexApercus.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) =>
        i.apercu === ''
          ? APERCU_VIDE
          : lireJSON(`${dossierVersion(version)}/${i.apercu}`).then(lireIndexApercu)
      )
      .catch((e) => {
        indexApercus.delete(version);
        throw e;
      });
    indexApercus.set(version, p);
  }
  return p;
}

/** La fiche à relire d'un caractère de la famille `racine`, `null` sans aperçu ou éteint. */
export async function ficheApercu(
  c: string,
  racine: string,
  version = VERSION_DONNEES
): Promise<FicheApercu | null> {
  if (!apercuAllume) return null;
  const a = await apercuOnce(version);
  const f = a.familles.find((x) => x.racine === racine && x.caracteres.includes(c));
  if (!f) return null;
  const file = `${dossierVersion(version)}/${f.fichier}`;
  let p = famillesApercu.get(file);
  if (!p) {
    p = lireJSON(file)
      .then(lireFamilleApercu)
      .catch((e) => {
        famillesApercu.delete(file);
        throw e;
      });
    famillesApercu.set(file, p);
  }
  return (await p).get(c) ?? null;
}

/**
 * La fiche telle qu'elle s'affiche l'aperçu allumé. Un texte relu passe toujours devant :
 * une fiche de l'export qui porte ses textes reste telle quelle. Sinon les textes de la
 * fiche à relire remplacent ceux de la démonstration, tous ensemble, comme une fiche relue
 * les remplacerait ; la décomposition, le pinyin et les niveaux restent ceux de l'export.
 * Le sens (`fr`, `en`) est celui de la fiche à relire : vide si elle ne l'a pas encore,
 * jamais celui de la démonstration, pour montrer ce que l'app montrera une fois relue.
 */
export function appliquerApercu(lue: FicheLue, a: FicheApercu | null): FicheLue {
  if (a === null || lue.source === 'export' || lue.statut === 'relu') return lue;
  return {
    ...lue,
    fr: a.fr ?? '',
    en: a.en ?? '',
    role: a.role,
    roles: a.roles,
    origine_fr: a.origine_fr,
    origine_en: a.origine_en,
    etiquette: a.origine_fr === '' ? null : a.etiquette,
    memo_fr: a.memo_fr,
    memo_en: a.memo_en,
    mots: a.mots,
    phrase: a.phrase,
    statut: STATUT_A_RELIRE,
    source: 'apercu'
  };
}

/** Les contes de l'aperçu, chacun lu une fois ; un fichier absent manque, sans erreur. */
async function contesApercu(
  version = VERSION_DONNEES
): Promise<{ index: IndexConte[]; contes: Map<string, Conte> }> {
  const a = await apercuOnce(version);
  const lus = await Promise.all(
    a.contes.map((x) => conteOnce(`${dossierVersion(version)}/${x.fichier}`).catch(() => null))
  );
  const contes = new Map<string, Conte>();
  a.contes.forEach((x, k) => {
    const c = lus[k];
    if (c) contes.set(x.id, c);
  });
  return { index: a.contes, contes };
}

/**
 * Les contes de l'export et ceux de l'aperçu, réunis. Une version relue passe devant la
 * version à relire du même seuil ; chaque version de l'aperçu est marquée `a_relire`. Un
 * conte que seul l'aperçu porte vient après ceux de l'export.
 */
export function fusionnerContes(
  exportes: { index: readonly IndexConte[]; contes: ReadonlyMap<string, Conte> },
  apercu: { index: readonly IndexConte[]; contes: ReadonlyMap<string, Conte> } | null
): { index: IndexConte[]; contes: Map<string, Conte> } {
  const index = exportes.index.map((x) => ({ ...x, seuils: [...x.seuils] }));
  const contes = new Map(exportes.contes);
  if (apercu === null) return { index, contes };
  for (const x of apercu.index) {
    const lu = apercu.contes.get(x.id);
    const releve = contes.get(x.id);
    const seuilsRelus = new Set((releve?.versions ?? []).map((v) => v.seuil));
    const ajout: VersionConte[] = (lu?.versions ?? [])
      .filter((v) => !seuilsRelus.has(v.seuil))
      .map((v) => ({ ...v, statut: STATUT_A_RELIRE }));
    const entree = index.find((y) => y.id === x.id);
    if (entree) {
      entree.seuils = trierNiveaux([...entree.seuils, ...x.seuils]);
    } else {
      index.push({ ...x, seuils: [...x.seuils] });
    }
    if (ajout.length === 0) continue;
    const base: Conte = releve ?? {
      version: lu?.version ?? '',
      source: lu?.source ?? '',
      id: x.id,
      titre_fr: lu?.titre_fr || x.titre_fr,
      versions: []
    };
    contes.set(x.id, {
      ...base,
      versions: [...base.versions, ...ajout].sort((a, b) => comparerNiveaux(a.seuil, b.seuil))
    });
  }
  return { index, contes };
}
