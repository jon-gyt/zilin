/**
 * L'aventure : les portes qui s'ouvrent au fil du chemin (brief §6, « Les portes qui
 * s'ouvrent »). Demande du propriétaire du 29 septembre 2026 : « Je veux aussi qu'au début,
 * on ne voie pas tout ce qui est accessible, mais que ça se débloque au fur et à mesure de
 * l'aventure. »
 *
 * Le calendrier (quelle porte, à quel seuil, ce que Tao en dit) vient du pipeline,
 * `ouvertures.json` (`data/sources/ouvertures/portes.tsv`) ; ce module décide seulement ce
 * qui est ouvert, ce qui est montré, et quelle porte annoncer au retour au menu. Pur, comme
 * `session.ts` : ni horloge, ni stockage, ni contenu lu ici, sauf par `ouverturesOnce`, qui
 * lit les assets de l'app.
 *
 * Les règles :
 * - une porte s'ouvre à son seuil, en jours du chemin (la dernière leçon apprise) ou en
 *   caractères lus (le compte de Mon chemin), jamais en jours du calendrier, jamais à l'achat :
 *   Wenlu complet ouvre le rythme, pas les portes ;
 * - une porte ouverte le reste, même si le compte des lus redescend ;
 * - une porte ouverte se montre quand Tao l'annonce, au retour au menu, une par retour, dans
 *   l'ordre du calendrier ; une porte silencieuse vient avec celle qui la contient ;
 * - une progression d'avant l'aventure, ou importée sans ce suivi, ouvre en silence tout ce
 *   qu'elle a atteint : pas de rafale d'annonces, seules les suivantes s'annoncent ;
 * - Réglages, Chercher un caractère et la session ne sont pas des portes : toujours là. La
 *   révision de l'acquis passe par la session dès le premier jour.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from './content';
import type { JeuId } from './jeux';

/** Les portes que l'app sait montrer ou cacher. Le pipeline tient la même liste (`ouvertures.PORTES`). */
export const PORTES = [
  'reviser',
  'personnage',
  'foret',
  'lire',
  'jouer',
  'jeu-assembler',
  'jeu-chaine',
  'route',
  'jeu-devinette',
  'trophees',
  'jeu-jumeaux',
  'jeu-eclair',
  'contes',
  'jeu-wechat',
  'revisions',
  'retention',
  'jeu-coquille',
  'monde',
  'jeu-cuisine'
] as const;

export type PorteId = (typeof PORTES)[number];

/** Les jeux de l'écran Jouer, chacun derrière sa porte. */
export const JEUX_DES_PORTES: readonly { porte: PorteId; jeu: JeuId }[] = [
  { porte: 'jeu-devinette', jeu: 'devinette' },
  { porte: 'jeu-assembler', jeu: 'assembler' },
  { porte: 'jeu-jumeaux', jeu: 'jumeaux' },
  { porte: 'jeu-chaine', jeu: 'chaine' },
  { porte: 'jeu-coquille', jeu: 'coquille' },
  { porte: 'jeu-eclair', jeu: 'eclair' },
  { porte: 'jeu-cuisine', jeu: 'cuisine' },
  { porte: 'jeu-wechat', jeu: 'wechat' }
];

/** Ce qui n'est jamais une porte : toujours visible, dès le premier jour. */
export const TOUJOURS = ['reglages', 'chercher', 'session'] as const;

/** Les deux unités de l'aventure. */
export type Unite = 'jour' | 'lus';

/** Une porte du calendrier, telle que `ouvertures.json` la donne. */
export type Porte = {
  id: PorteId;
  unite: Unite;
  seuil: number;
  /** La porte qui la contient, montrée avant elle. */
  parent: PorteId | null;
  /** La phrase de Tao quand elle s'ouvre ; vide : elle vient en silence avec son parent. */
  annonce: string;
};

/** Le calendrier, dans l'ordre où les portes s'annoncent quand plusieurs tombent ensemble. */
export type Calendrier = readonly Porte[];

/** Aucun calendrier : ce que rend un export sans `ouvertures.json`. Tout est alors visible. */
export const SANS_CALENDRIER: Calendrier = [];

/**
 * Ce que la progression garde (`Progress.ouvertures`), export et import compris. `null` : une
 * progression d'avant l'aventure, ou importée sans ce suivi ; elle s'ouvre en silence.
 */
export type EtatOuvertures = {
  /** Les portes ouvertes, avec la journée où elles l'ont été (AAAA-MM-JJ). */
  ouvertes: Record<string, string>;
  /** Les portes montrées : annoncées par Tao, ou venues en silence avec leur parent. */
  montrees: string[];
};

/** Où en est l'aventure : la dernière leçon du chemin apprise, et les caractères lus. */
export type Mesure = { jour: number; lus: number | null };

/** L'état d'une progression neuve : rien d'ouvert, tout s'annoncera. */
export function etatNeuf(): EtatOuvertures {
  return { ouvertes: {}, montrees: [] };
}

function estPorte(v: unknown): v is PorteId {
  return typeof v === 'string' && (PORTES as readonly string[]).includes(v);
}

/** Relit l'état gardé par une progression. Absent ou mal formé : `null`, à ouvrir en silence. */
export function lireEtatOuvertures(brut: unknown): EtatOuvertures | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const o = brut as Record<string, unknown>;
  const ouvertes: Record<string, string> = {};
  if (typeof o.ouvertes === 'object' && o.ouvertes !== null) {
    for (const [id, jour] of Object.entries(o.ouvertes as Record<string, unknown>)) {
      if (estPorte(id) && typeof jour === 'string') ouvertes[id] = jour;
    }
  }
  const montrees = Array.isArray(o.montrees) ? [...new Set(o.montrees.filter(estPorte))] : [];
  return { ouvertes, montrees };
}

/**
 * La mesure de l'aventure : la dernière leçon du chemin apprise (`session.jourDuChemin`, 0
 * pendant la première session, 3 après elle), et les lus que l'appelant compte
 * (`foret.caracteresLus`), `null` tant qu'il ne les connaît pas. Ni l'achat ni la date n'y
 * entrent : Wenlu complet ouvre le rythme, pas les portes.
 */
export function mesure(jour: number, lus: number | null): Mesure {
  return { jour: Math.max(0, Math.floor(jour)), lus: lus === null ? null : Math.max(0, Math.floor(lus)) };
}

/** La porte a-t-elle atteint son seuil ? */
export function atteinte(porte: Porte, m: Mesure): boolean {
  if (porte.unite === 'jour') return m.jour >= porte.seuil;
  return m.lus !== null && m.lus >= porte.seuil;
}

/** Le parent d'une porte est-il montré ? Sans parent, oui. */
function parentMontre(porte: Porte, montrees: readonly string[]): boolean {
  return porte.parent === null || montrees.includes(porte.parent);
}

/**
 * Range les portes que la mesure atteint : ouvertes, et le restent. Une porte silencieuse se
 * montre dès que son parent l'est. Un état `null` (progression d'avant l'aventure, ou
 * importée sans ce suivi) ouvre et montre en silence tout ce qui est atteint : on n'annonce
 * que ce qui arrive ensuite.
 */
export function noter(etat: EtatOuvertures | null, cal: Calendrier, m: Mesure, jour: string): EtatOuvertures {
  const enSilence = etat === null;
  const ouvertes = { ...(etat?.ouvertes ?? {}) };
  const montrees = [...(etat?.montrees ?? [])];
  for (const porte of cal) {
    if (ouvertes[porte.id] === undefined && atteinte(porte, m)) ouvertes[porte.id] = jour;
    if (ouvertes[porte.id] === undefined || montrees.includes(porte.id)) continue;
    if ((enSilence || porte.annonce === '') && parentMontre(porte, montrees)) montrees.push(porte.id);
  }
  return { ouvertes, montrees };
}

/** La porte à annoncer : la première du calendrier ouverte, pas encore montrée, sous un parent montré. */
export function aAnnoncer(etat: EtatOuvertures, cal: Calendrier): Porte | null {
  return (
    cal.find(
      (porte) =>
        etat.ouvertes[porte.id] !== undefined &&
        !etat.montrees.includes(porte.id) &&
        porte.annonce !== '' &&
        parentMontre(porte, etat.montrees)
    ) ?? null
  );
}

/** La porte annoncée est montrée, et ses portes silencieuses déjà ouvertes avec elle. */
export function montrer(etat: EtatOuvertures, cal: Calendrier, id: PorteId): EtatOuvertures {
  if (etat.montrees.includes(id)) return etat;
  const montrees = [...etat.montrees, id];
  for (const porte of cal) {
    if (porte.parent === id && porte.annonce === '' && etat.ouvertes[porte.id] !== undefined && !montrees.includes(porte.id)) {
      montrees.push(porte.id);
    }
  }
  return { ...etat, montrees };
}

/**
 * Le retour au menu : les portes atteintes s'ouvrent, et une seule s'annonce. Les autres
 * attendent les retours suivants, une à chacun. Appelé au retour au menu seulement, jamais
 * au milieu d'un pas, et après le 放榜 s'il y en a un.
 */
export function retourAuMenu(
  etat: EtatOuvertures | null,
  cal: Calendrier,
  m: Mesure,
  jour: string
): { etat: EtatOuvertures; annonce: Porte | null } {
  const note = noter(etat, cal, m, jour);
  const annonce = aAnnoncer(note, cal);
  return { etat: annonce === null ? note : montrer(note, cal, annonce.id), annonce };
}

/**
 * Une porte est-elle visible ? Hors du calendrier (un export sans `ouvertures.json`, ou ce
 * qui n'est jamais une porte), oui. Une progression pas encore suivie voit tout, le temps
 * que le premier retour au menu range ce qu'elle a atteint. Sinon, les portes montrées.
 */
export function visible(etat: EtatOuvertures | null, cal: Calendrier | null, id: string): boolean {
  if (cal !== null && !cal.some((porte) => porte.id === id)) return true;
  if (etat === null) return true;
  return etat.montrees.includes(id);
}

/* ---------- le calendrier exporté ---------- */

/** Lit `ouvertures.json`. Une porte inconnue ou mal formée est écartée : rien n'est inventé ici. */
export function lireCalendrier(brut: unknown): Calendrier {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const portes = Array.isArray(o.portes) ? o.portes : [];
  const out: Porte[] = [];
  for (const x of portes) {
    if (typeof x !== 'object' || x === null) continue;
    const r = x as Record<string, unknown>;
    if (!estPorte(r.id) || (r.unite !== 'jour' && r.unite !== 'lus')) continue;
    if (typeof r.seuil !== 'number' || !Number.isFinite(r.seuil)) continue;
    out.push({
      id: r.id,
      unite: r.unite,
      seuil: r.seuil,
      parent: estPorte(r.parent) ? r.parent : null,
      annonce: typeof r.annonce === 'string' ? r.annonce : ''
    });
  }
  return out;
}

/** Le fichier du calendrier d'une version, tel que l'index le nomme. */
export function fichierOuvertures(i: Index): string {
  return !i.ouvertures ? '' : `${dossierVersion(i.version)}/${i.ouvertures}`;
}

/** Lit et valide `ouvertures.json`. `fetchFn` est injecté dans les tests. */
export async function loadOuvertures(file: string, fetchFn: typeof fetch = fetch): Promise<Calendrier> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Calendrier d'ouverture introuvable : ${file} (${r.status})`);
  return lireCalendrier(await r.json());
}

const lesCalendriers = new Map<string, Promise<Calendrier>>();

/** Le calendrier de la version courante, lu une fois pour toute la durée de vie de l'app. */
export function ouverturesOnce(version = VERSION_DONNEES): Promise<Calendrier> {
  let p = lesCalendriers.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierOuvertures(i);
        return file === '' ? SANS_CALENDRIER : loadOuvertures(file);
      })
      .catch((e) => {
        lesCalendriers.delete(version);
        throw e;
      });
    lesCalendriers.set(version, p);
  }
  return p;
}
