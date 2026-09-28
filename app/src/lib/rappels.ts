/**
 * Le rappel quotidien de l'app iOS (brief §8 : « Notification : une par jour, à l'heure
 * choisie, avec le début de l'anecdote »). Sur le web, rien : il faudrait un serveur
 * d'envoi, et l'app n'en a pas.
 *
 * Module pur : aucune fonction ne lit l'horloge ni n'appelle le greffon. La journée, la
 * minute de l'horloge et l'anecdote de chaque journée arrivent en argument ; `natif.ts`
 * les réunit et programme ce que `planifier` rend. Les règles, une par test :
 *
 * - au plus une notification par jour, à l'heure choisie ;
 * - rien le jour où la journée est faite (la graine plantée), ni avant la première
 *   session, ni une fois l'heure passée ;
 * - à chaque sauvegarde, les notifications sont reprogrammées sur les sept jours qui
 *   viennent : l'anecdote du jour dépend des caractères rencontrés, qui changent ;
 * - silence après sept jours sans ouverture : la dernière sauvegarde a programmé ses sept
 *   jours, et rien au-delà ; au retour, la première sauvegarde reprogramme.
 *
 * Le texte : le titre et le début de l'anecdote de la journée, telle que l'écran Ouvrir la
 * montrera ; une anecdote déjà lue ou déjà annoncée laisse la place à la brique de la
 * prochaine session (« 子 · enfant »), un jour sur deux. Jamais un reproche, une série
 * menacée, un achat : les textes viennent du pipeline (`rappels.json`), qui le contrôle.
 */
import { contenu, dossierVersion, jourDepuisEpoque, VERSION_DONNEES, type Index } from './content';
import type { Progress } from './session';

/* ---------- le réglage, dans la progression ---------- */

/** Les jours programmés à chaque sauvegarde : au-delà, silence jusqu'au retour. */
export const JOURS_PROGRAMMES = 7;

/** Les trois heures proposées à la première session : le matin, midi, le soir. */
export const HEURES_PROPOSEES = ['08:00', '12:30', '19:00'] as const;

/** L'heure proposée d'abord, et celle que Réglages prend quand aucune n'a été choisie. */
export const HEURE_DEFAUT = '19:00';

/**
 * Le réglage du rappel. `heure` : « HH:MM », à l'heure locale ; `null` tant qu'aucune
 * n'a été choisie. `premierJour` : le premier jour où un rappel peut partir (AAAA-MM-JJ),
 * posé au lendemain quand l'heure change après le rappel du jour, pour qu'il n'en parte
 * pas un second. Absent d'une progression plus ancienne : éteint, sans heure.
 */
export type Rappel = { actif: boolean; heure: string | null; premierJour: string | null };

export const SANS_RAPPEL: Rappel = { actif: false, heure: null, premierJour: null };

const FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function heureValide(h: unknown): h is string {
  return typeof h === 'string' && FORMAT_HEURE.test(h);
}

/** Les minutes depuis minuit d'une heure « HH:MM ». */
export function minutesDe(h: string): number {
  return Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
}

/** « 8 h », « 12 h 30 », « 19 h » : l'heure à la française. */
export function libelleHeure(h: string): string {
  if (!heureValide(h)) return '';
  const m = h.slice(3, 5);
  return `${Number(h.slice(0, 2))} h${m === '00' ? '' : ` ${m}`}`;
}

/** Relit le réglage d'une progression exportée ; mal formé ou absent, éteint. */
export function lireRappel(v: unknown): Rappel {
  if (typeof v !== 'object' || v === null) return SANS_RAPPEL;
  const o = v as Record<string, unknown>;
  const heure = heureValide(o.heure) ? o.heure : null;
  return {
    actif: o.actif === true && heure !== null,
    heure,
    premierJour: typeof o.premierJour === 'string' && FORMAT_JOUR.test(o.premierJour) ? o.premierJour : null
  };
}

/** La journée `n` jours après `jour`. */
export function jourPlus(jour: string, n: number): string {
  return new Date((jourDepuisEpoque(jour) + n) * 86400000).toISOString().slice(0, 10);
}

/**
 * Le rappel du jour est-il déjà parti ? Allumé, à une heure passée, et pas repoussé au
 * lendemain : c'est ce que l'heure d'avant a déjà envoyé.
 */
function dejaParti(r: Rappel, jour: string, minute: number): boolean {
  return (
    r.actif &&
    r.heure !== null &&
    minute >= minutesDe(r.heure) &&
    (r.premierJour === null || r.premierJour <= jour)
  );
}

/**
 * Le nouveau réglage, choisi à `minute` de la journée `jour`. Si le rappel du jour est
 * déjà parti à l'ancienne heure, le suivant attend demain : au plus un par jour, même
 * quand on recule ou avance l'heure.
 */
export function reglerRappel(avant: Rappel, apres: { actif: boolean; heure: string | null }, jour: string, minute: number): Rappel {
  const heure = heureValide(apres.heure) ? apres.heure : avant.heure;
  const actif = apres.actif && heure !== null;
  const premierJour = dejaParti(avant, jour, minute) ? jourPlus(jour, 1) : avant.premierJour;
  return { actif, heure, premierJour };
}

/** Range le réglage dans la progression. */
export function setRappel(p: Progress, r: Rappel): Progress {
  return { ...p, rappel: r };
}

/* ---------- les textes, par le pipeline ---------- */

export const CLES_RAPPELS = [
  'notif_brique_titre',
  'notif_brique',
  'question',
  'question_guide',
  'question_accord',
  'matin',
  'midi',
  'soir',
  'accepter',
  'refuser',
  'reglage',
  'reglage_detail',
  'reglage_heure',
  'reglage_refuse',
  'accueil',
  'accueil_comment',
  'export_date',
  'export_jamais'
] as const;

export type CleRappels = (typeof CLES_RAPPELS)[number];

/** Un texte par clé ; vide quand l'export ne le porte pas. */
export type TextesRappels = Record<CleRappels, string>;

/** Aucun texte : ce que rend un export sans `rappels.json`. Rien n'est programmé, rien ne s'affiche. */
export const SANS_TEXTES: TextesRappels = Object.fromEntries(CLES_RAPPELS.map((c) => [c, ''])) as TextesRappels;

/** Lit `rappels.json`. Un texte absent ou mal formé reste vide : rien n'est inventé ici. */
export function lireTextesRappels(brut: unknown): TextesRappels {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as Record<string, unknown>;
  const t = (typeof o.textes === 'object' && o.textes !== null ? o.textes : {}) as Record<string, unknown>;
  const out = { ...SANS_TEXTES };
  for (const cle of CLES_RAPPELS) out[cle] = typeof t[cle] === 'string' ? t[cle] : '';
  return out;
}

/** Remplit les jetons d'un texte (`{c}`, `{sens}`, `{date}`). */
export function remplir(modele: string, valeurs: Readonly<Record<string, string>>): string {
  return modele.replace(/\{(\w+)\}/g, (tout, cle: string) => valeurs[cle] ?? tout);
}

/** Le fichier des rappels d'une version, tel que l'index le nomme. */
export function fichierRappels(i: Index): string {
  return !i.rappels ? '' : `${dossierVersion(i.version)}/${i.rappels}`;
}

/** Lit et valide `rappels.json`. `fetchFn` est injecté dans les tests. */
export async function loadRappels(file: string, fetchFn: typeof fetch = fetch): Promise<TextesRappels> {
  const r = await fetchFn(`${import.meta.env.BASE_URL}${file}`);
  if (!r.ok) throw new Error(`Textes des rappels introuvables : ${file} (${r.status})`);
  return lireTextesRappels(await r.json());
}

const lesTextes = new Map<string, Promise<TextesRappels>>();

/** Les textes de la version courante, lus une fois pour toute la durée de vie de l'app. */
export function rappelsOnce(version = VERSION_DONNEES): Promise<TextesRappels> {
  let p = lesTextes.get(version);
  if (!p) {
    p = contenu(version)
      .then((i) => {
        const file = fichierRappels(i);
        return file === '' ? SANS_TEXTES : loadRappels(file);
      })
      .catch((e) => {
        lesTextes.delete(version);
        throw e;
      });
    lesTextes.set(version, p);
  }
  return p;
}

/* ---------- la planification ---------- */

/** L'anecdote d'une journée, telle que l'écran Ouvrir la montrera ce jour-là. */
export type AnecdoteAnnoncee = { cle: string; titre: string; texte: string };

/** La brique de la prochaine session : le caractère et son premier sens. */
export type BriqueAnnoncee = { c: string; sens: string };

/** Une notification à programmer : un identifiant par journée, jamais deux. */
export type Notification = { id: number; jour: string; heure: string; titre: string; corps: string };

/** La longueur au-delà de laquelle le début de l'anecdote s'arrête au mot. */
export const LONGUEUR_DEBUT = 140;

/**
 * Le début d'une anecdote : sa première phrase, coupée au mot et suivie de « … » si elle
 * est plus longue que `LONGUEUR_DEBUT`.
 */
export function debut(texte: string, max = LONGUEUR_DEBUT): string {
  const t = texte.trim().replace(/\s+/g, ' ');
  const fin = /[.?!。？！…](?=\s|$)/.exec(t);
  const phrase = fin ? t.slice(0, fin.index + 1) : t;
  if (phrase.length <= max) return phrase;
  const coupe = phrase.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > max / 2 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:·]+$/, '')}…`;
}

/** L'identifiant de la notification d'une journée : AAAAMMJJ, un par jour. */
export function idDuJour(jour: string): number {
  return Number(jour.replace(/-/g, ''));
}

/** Ce que `planifier` lit : le réglage, la journée, et ce qu'il y a à lire chaque jour. */
export type Planification = {
  rappel: Rappel;
  /** Vrai tant que la première session n'est pas faite : aucun rappel. */
  premiere: boolean;
  /** Les journées travaillées (une graine chacune) : la journée faite n'a pas de rappel. */
  joursTravailles: readonly string[];
  /** La journée de la sauvegarde (AAAA-MM-JJ), à l'heure locale. */
  jour: string;
  /** La minute de l'horloge locale, depuis minuit. */
  minute: number;
  /** L'anecdote de chaque journée à venir, sur la progression telle qu'elle est. */
  anecdote: (jour: string) => AnecdoteAnnoncee | null;
  /** Vrai si l'anecdote d'aujourd'hui a déjà été lue (l'écran Ouvrir l'a montrée). */
  lueAujourdhui: boolean;
  /** La brique de la prochaine session, `null` s'il n'y en a pas (rattrapage, bout du chemin). */
  brique: BriqueAnnoncee | null;
  textes: TextesRappels;
};

/**
 * Les notifications des sept jours qui commencent à la journée de la sauvegarde, une au
 * plus par jour. Rien si le rappel est éteint, sans heure, avant la première session, ou
 * sans textes exportés.
 */
export function planifier(x: Planification): Notification[] {
  const { rappel, textes } = x;
  if (!rappel.actif || !heureValide(rappel.heure) || x.premiere) return [];
  if (textes.notif_brique === '' || textes.notif_brique_titre === '') return [];
  const heure = rappel.heure;
  const faits = new Set(x.joursTravailles);
  const annoncees = new Set<string>();
  const out: Notification[] = [];
  let veilleBrique = false;

  for (let k = 0; k < JOURS_PROGRAMMES; k++) {
    const jour = jourPlus(x.jour, k);
    if (rappel.premierJour !== null && jour < rappel.premierJour) continue;
    if (k === 0 && (faits.has(jour) || x.minute >= minutesDe(heure))) continue;

    const a = x.anecdote(jour);
    const lue = k === 0 && x.lueAujourdhui;
    let n: Omit<Notification, 'id' | 'jour' | 'heure'> | null = null;
    let brique = false;
    if (a && !lue && !annoncees.has(a.cle)) {
      n = { titre: a.titre, corps: debut(a.texte) };
    } else if (x.brique && !veilleBrique) {
      n = {
        titre: textes.notif_brique_titre,
        corps: remplir(textes.notif_brique, { c: x.brique.c, sens: x.brique.sens })
      };
      brique = true;
    } else if (a && !lue) {
      n = { titre: a.titre, corps: debut(a.texte) };
    }
    veilleBrique = brique;
    if (n === null) continue;
    if (a && !brique) annoncees.add(a.cle);
    out.push({ id: idDuJour(jour), jour, heure, ...n });
  }
  return out;
}
