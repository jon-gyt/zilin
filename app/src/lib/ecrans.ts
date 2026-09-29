/**
 * Les textes d'interface de « Lire le monde » (Chercher), du tableau des révisions (Mon
 * chemin), les lignes des examens sur « Mon personnage » et la route devant (stories 8.5 et
 * 8.6), ceux de la question « Dis-le » et de son réglage (story 9.1), et l'image du chemin
 * (Mon chemin 路, la pierre posée, les auberges, les rendez-vous) et du maître Xing 杏 (sa
 * rencontre, sa ligne du pas Apprendre), tels que le pipeline les
 * exporte dans `ecrans.json` (`data/sources/ecrans/`, `data/schema.md`).
 *
 * L'app ne rédige aucun de ces textes : elle les lit ici et remplit leurs jetons entre
 * accolades (`remplir`). Un export sans `ecrans.json` rend des textes vides : l'écran se
 * tait plutôt que de dire un texte écrit dans le code. Seul `ecransOnce` lit le réseau
 * local, les assets de l'app.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';

/** Les clés de « Lire le monde », dans l'ordre de la source. */
export const CLES_LIRE_LE_MONDE = [
  'onglets',
  'onglet-caractere',
  'onglet-texte',
  'champ',
  'invite',
  'aide-iphone',
  'chargement',
  'compte',
  'compte-un',
  'sans-chinois',
  'legende',
  'dans',
  'demain',
  'mots',
  'ouvrir',
  'effacer'
] as const;

/** Les clés du tableau des révisions, dans l'ordre de la source. */
export const CLES_REVISIONS = [
  'entree',
  'entree-ligne',
  'entree-vide',
  'retour',
  'titre',
  'venir-titre',
  'venir-ligne',
  'venir-une',
  'venir-rien',
  'aujourdhui',
  'jours',
  'barre',
  'barre-une',
  'retention-titre',
  'retention',
  'retention-peu',
  'retention-mesure',
  'retention-cible',
  'retention-reglage',
  'resistent-titre',
  'resistent-aide',
  'resistent-ligne',
  'resistent-une',
  'resistent-rien'
] as const;

/** Les lignes des examens sur « Mon personnage », dans l'ordre de la source. */
export const CLES_PERSONNAGE = ['reste', 'recu', 'recu-un', 'palier', 'ouvert', 'bang', 'bang-date'] as const;

/** Les lignes des examens sur « La route devant », dans l'ordre de la source. */
export const CLES_ROUTE = ['examen', 'ouvert', 'apres', 'lus'] as const;

/** Les textes de « Dis-le » et de son réglage, dans l'ordre de la source. */
export const CLES_DIRE = [
  'label',
  'enonce',
  'appuie',
  'ecoute',
  'redire',
  'confidentialite',
  'nom-1',
  'nom-2',
  'nom-3',
  'nom-4',
  'nom-5',
  'allure-1',
  'allure-2',
  'allure-3',
  'allure-4',
  'allure-5',
  'juste',
  'autre',
  'conseil-1-2',
  'conseil-1-3',
  'conseil-1-4',
  'conseil-1-5',
  'conseil-2-1',
  'conseil-2-3',
  'conseil-2-4',
  'conseil-2-5',
  'conseil-3-1',
  'conseil-3-2',
  'conseil-3-4',
  'conseil-3-5',
  'conseil-4-1',
  'conseil-4-2',
  'conseil-4-3',
  'conseil-4-5',
  'redemander',
  'silence',
  'court',
  'sature',
  'passer',
  'resume',
  'etat-juste',
  'etat-autre',
  'etat-redemander',
  'legende-voix',
  'legende-modele',
  'prochaine',
  'ecouter',
  'suivant',
  'terminer',
  'essai',
  'retour',
  'reglage',
  'reglage-aide',
  'essayer',
  'essayer-aide',
  'refuse',
  'absent',
  'indisponible',
  'reecouter',
  'reecouter-aide',
  'voix',
  'voix-aide',
  'voix-appareil',
  'voix-enregistree',
  'voix-appareil-nom',
  'voix-sans-appareil',
  'voix-comment',
  'voix-etapes'
] as const;

/**
 * L'image du chemin (décisions du propriétaire du 29 septembre 2026, maquette validée
 * `maquettes/chemin.html`) : Mon chemin 路, la pierre posée, les pavillons de la semaine, les
 * auberges des familles, les rendez-vous de la route devant. Dans l'ordre de la source.
 */
export const CLES_CHEMIN = [
  'case',
  'menu-faite',
  'menu-faite-plus',
  'menu-faite-plus-une',
  'devant',
  'devant-voix',
  'tao-faite',
  'tao-clore',
  'clore-titre',
  'clore-deja',
  'clore-dessin',
  'semaine-voix',
  'serie-semaine',
  'serie-semaine-une',
  'serie-semaine-pleine',
  'cadeau-an',
  'titre',
  'aide',
  'lus',
  'lus-un',
  'familles',
  'familles-une',
  'jour',
  'scene-voix',
  'devant-titre',
  'derriere-titre',
  'premier-jour',
  'sceau-jour',
  'auberge-voix',
  'plus-voix',
  'plus-voix-un',
  'repli',
  'repli-voix',
  'legende-lu',
  'legende-encours',
  'legende-avenir',
  'legende-jour',
  'rdv-prochain',
  'rdv-ce-jour',
  'semaine-titre',
  'semaine-aucune',
  'semaine-une',
  'semaine-n',
  'semaine-pleine',
  'semaine-note',
  'liste',
  'retour',
  'retour-jeu',
  'famille-auberge',
  'famille-voix',
  'famille-sceau',
  'famille-sceau-pose',
  'famille-par',
  'famille-plus-voix',
  'fiche-lu',
  'fiche-encours',
  'fiche-avenir',
  'fiche-pose',
  'trophee-famille',
  'trophee-serie'
] as const;

/**
 * Le maître Xing 杏 (décision du propriétaire du 29 septembre 2026) : sa rencontre à la porte du
 * 县试, et sa ligne de tête au pas Apprendre selon l'étiquette de la fiche. Dans l'ordre de la source.
 */
export const CLES_XING = [
  'kicker',
  'caractere',
  'nom',
  'pinyin',
  'sens',
  'presentation',
  'accueil',
  'roles',
  'bouton',
  'voix',
  'brique-atteste',
  'brique-mnemo',
  'brique-sans',
  'compose-atteste',
  'compose-mnemo',
  'compose-sans'
] as const;

export type CleLireLeMonde = (typeof CLES_LIRE_LE_MONDE)[number];
export type CleRevisions = (typeof CLES_REVISIONS)[number];
export type ClePersonnage = (typeof CLES_PERSONNAGE)[number];
export type CleRoute = (typeof CLES_ROUTE)[number];
export type CleDire = (typeof CLES_DIRE)[number];
export type CleChemin = (typeof CLES_CHEMIN)[number];
export type CleXing = (typeof CLES_XING)[number];

export type TextesLireLeMonde = Record<CleLireLeMonde, string>;
export type TextesRevisions = Record<CleRevisions, string>;
export type TextesPersonnage = Record<ClePersonnage, string>;
export type TextesRoute = Record<CleRoute, string>;
export type TextesDire = Record<CleDire, string>;
export type TextesChemin = Record<CleChemin, string>;
export type TextesXing = Record<CleXing, string>;

export type Ecrans = {
  version: string;
  source: string;
  lire: TextesLireLeMonde;
  revisions: TextesRevisions;
  personnage: TextesPersonnage;
  route: TextesRoute;
  dire: TextesDire;
  chemin: TextesChemin;
  xing: TextesXing;
};

function vides<K extends string>(cles: readonly K[]): Record<K, string> {
  return Object.fromEntries(cles.map((c) => [c, ''])) as Record<K, string>;
}

/** Aucun texte : ce que rend un export sans `ecrans.json`. Les écrans se taisent. */
export const SANS_ECRANS: Ecrans = {
  version: '',
  source: '',
  lire: vides(CLES_LIRE_LE_MONDE),
  revisions: vides(CLES_REVISIONS),
  personnage: vides(CLES_PERSONNAGE),
  route: vides(CLES_ROUTE),
  dire: vides(CLES_DIRE),
  chemin: vides(CLES_CHEMIN),
  xing: vides(CLES_XING)
};

function objet(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function bloc<K extends string>(v: unknown, cles: readonly K[]): Record<K, string> {
  const o = objet(v);
  const out = vides(cles);
  for (const c of cles) out[c] = texte(o[c]);
  return out;
}

/** Lit `ecrans.json`. Un texte absent ou mal formé reste vide : rien n'est inventé ici. */
export function lireEcrans(brut: unknown): Ecrans {
  const o = objet(brut);
  return {
    version: texte(o.version),
    source: texte(o.source),
    lire: bloc(o['lire-le-monde'], CLES_LIRE_LE_MONDE),
    revisions: bloc(o.revisions, CLES_REVISIONS),
    personnage: bloc(o.personnage, CLES_PERSONNAGE),
    route: bloc(o.route, CLES_ROUTE),
    dire: bloc(o.dire, CLES_DIRE),
    chemin: bloc(o.chemin, CLES_CHEMIN),
    xing: bloc(o.xing, CLES_XING)
  };
}

/**
 * Remplit les jetons d'un texte : `{lus}` prend `valeurs.lus`. Un jeton sans valeur reste
 * tel quel, pour qu'un oubli se voie au lieu de se taire.
 */
export function remplir(t: string, valeurs: Readonly<Record<string, string | number>>): string {
  return t.replace(/\{([^{}]+)\}/g, (tout, cle: string) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

/** Le fichier des textes d'écran d'une version, tel que l'index le nomme. */
export function fichierEcrans(i: Index): string {
  return !i.ecrans ? '' : `${dossierVersion(i.version)}/${i.ecrans}`;
}

/** Lit et valide `ecrans.json`. `fetchFn` est injecté dans les tests. */
export async function loadEcrans(file: string, fetchFn: typeof fetch = fetch): Promise<Ecrans> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Textes d'écran introuvables : ${file} (${r.status})`);
  return lireEcrans(await r.json());
}

const lesTextes = new Map<string, Promise<Ecrans>>();

/** Les textes de la version courante, lus une fois pour toute la durée de vie de l'app. */
export function ecransOnce(version = VERSION_DONNEES): Promise<Ecrans> {
  let p = lesTextes.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierEcrans(i);
        return file === '' ? SANS_ECRANS : loadEcrans(file);
      })
      .catch((e) => {
        lesTextes.delete(version);
        throw e;
      });
    lesTextes.set(version, p);
  }
  return p;
}
