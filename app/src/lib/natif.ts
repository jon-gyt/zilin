/**
 * Les greffons natifs de l'app iOS que le web n'a pas : les notifications locales du
 * rappel quotidien (`@capacitor/local-notifications`).
 *
 * La couche impure, comme `db.ts` : l'horloge, le contenu chargé et le greffon. Les règles
 * sont dans `rappels.ts`, pur et testé ; ici, on réunit ce qu'il lit et on remplace les
 * notifications en attente par ce qu'il rend. Sur le web, et partout hors de Capacitor,
 * rien ne se passe : Réglages cache l'interrupteur, la première session saute l'heure.
 *
 * Une notification qui échoue ne dit rien et ne casse rien.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { autourDuJour } from './anecdotes';
import { anecdotesOnce, contenu, fetesOnce, lecon, saisonsOnce } from './content';
import { today } from './db';
import { anecdoteVue } from './parcours';
import {
  planifier,
  rappelsOnce,
  type AnecdoteAnnoncee,
  type BriqueAnnoncee,
  type Notification
} from './rappels';
import { premierSens } from './route';
import { anecdoteDeLaJournee, suiviDe } from './saisons';
import { jourParcours, jourRencontre, type Progress } from './session';

/* ---------- les notifications du rappel ---------- */

/** Vrai dans l'app native, où le greffon est installé. Ailleurs, ni question ni interrupteur. */
export function notificationsDisponibles(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
}

/** Demande l'accord de l'iPhone, une fois l'heure choisie. Vrai s'il est accordé. */
export async function demanderAutorisation(): Promise<boolean> {
  if (!notificationsDisponibles()) return false;
  try {
    const deja = await LocalNotifications.checkPermissions();
    if (deja.display === 'granted') return true;
    if (deja.display === 'denied') return false;
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** L'accord déjà refusé : Réglages dit où le rendre, dans ceux de l'iPhone. */
export async function autorisationRefusee(): Promise<boolean> {
  if (!notificationsDisponibles()) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'denied';
  } catch {
    return false;
  }
}

/** Ce que `remplacer` demande au greffon. Injecté dans les tests. */
export type Programmeur = {
  enAttente(): Promise<number[]>;
  annuler(ids: number[]): Promise<void>;
  programmer(n: Notification[]): Promise<void>;
};

/** La date locale d'une notification : sa journée, à son heure. */
export function dateDe(n: Notification): Date {
  const [a, m, j] = n.jour.split('-').map(Number);
  const [h, mi] = n.heure.split(':').map(Number);
  return new Date(a, m - 1, j, h, mi, 0, 0);
}

const greffon: Programmeur = {
  async enAttente() {
    return (await LocalNotifications.getPending()).notifications.map((n) => n.id);
  },
  async annuler(ids) {
    if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  },
  async programmer(n) {
    if (n.length === 0) return;
    await LocalNotifications.schedule({
      notifications: n.map((x) => ({ id: x.id, title: x.titre, body: x.corps, schedule: { at: dateDe(x) } }))
    });
  }
};

/**
 * Remplace toutes les notifications en attente par celles du plan. Rien ne s'accumule :
 * ce qu'une sauvegarde précédente avait programmé disparaît, au plus une par jour reste.
 */
export async function remplacer(plan: Notification[], g: Programmeur = greffon): Promise<void> {
  await g.annuler(await g.enAttente());
  await g.programmer(plan);
}

/** L'heure locale d'une date, en minutes depuis minuit. */
function minuteDe(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** La journée et la minute de l'horloge locale, ce que `rappels.reglerRappel` lit. */
export function instant(d: Date = new Date()): { jour: string; minute: number } {
  return { jour: today(d), minute: minuteDe(d) };
}

/**
 * Le plan d'une progression, à l'instant `maintenant` : le contenu (anecdotes, fêtes,
 * termes, index, la leçon de la prochaine session) est chargé ici, les règles sont dans
 * `rappels.planifier`.
 */
export async function planDe(p: Progress, maintenant: Date): Promise<Notification[]> {
  if (!p.rappel.actif || p.premiere) return [];
  const [textes, liste, fetes, saisons, index] = await Promise.all([
    rappelsOnce(),
    anecdotesOnce().catch(() => null),
    fetesOnce().catch(() => null),
    saisonsOnce().catch(() => null),
    contenu().catch(() => null)
  ]);
  const suivi = suiviDe(p, index ? autourDuJour(index, p.parcours, jourRencontre(p)) : undefined);
  const anecdote = (jour: string): AnecdoteAnnoncee | null => {
    const r = anecdoteDeLaJournee(liste?.anecdotes ?? null, fetes, saisons, jour, suivi);
    if (r === null) return null;
    const ou = r.fete?.id ?? (r.terme ? `terme:${r.terme.nomZh}` : 'anecdote');
    return { cle: `${ou}:${r.a.c}`, titre: r.a.titre, texte: r.a.texte };
  };
  let brique: BriqueAnnoncee | null = null;
  if (!p.catchup) {
    const f = await lecon(p.parcours, jourParcours(p))
      .then((l) => l.brique ?? l.composes[0] ?? null)
      .catch(() => null);
    if (f) brique = { c: f.c, sens: premierSens(f.fr) };
  }
  const jour = today(maintenant);
  return planifier({
    rappel: p.rappel,
    premiere: p.premiere,
    joursTravailles: p.joursTravailles,
    jour,
    minute: minuteDe(maintenant),
    anecdote,
    lueAujourdhui: p.day === jour && anecdoteVue(p),
    brique,
    textes
  });
}

let minuterie: ReturnType<typeof setTimeout> | null = null;
let aProgrammer: Progress | null = null;

/**
 * Après chaque sauvegarde, et à chaque ouverture : les sept jours qui viennent sont
 * reprogrammés. Les taps rapprochés se regroupent (une seconde) : c'est la dernière
 * progression qui compte. Sur le web, rien.
 */
export function reprogrammerRappels(p: Progress): void {
  if (!notificationsDisponibles()) return;
  aProgrammer = p;
  if (minuterie !== null) clearTimeout(minuterie);
  minuterie = setTimeout(() => {
    minuterie = null;
    const q = aProgrammer;
    aProgrammer = null;
    if (q === null) return;
    void (async () => {
      try {
        /* Sans accord, rien ne partirait : on ne programme rien, on ne demande rien. */
        const accord = (await LocalNotifications.checkPermissions()).display === 'granted';
        await remplacer(accord ? await planDe(q, new Date()) : []);
      } catch {
        /* le greffon muet : l'app continue sans rappel */
      }
    })();
  }, 1000);
}
