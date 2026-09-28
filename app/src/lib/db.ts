/**
 * La couche impure : IndexedDB (Dexie) et l'horloge. Toute la logique de session
 * est dans `session.ts` et reste testable sans navigateur.
 *
 * La progression tient dans un seul enregistrement : on sauvegarde à chaque tap.
 */
import Dexie, { type Table } from 'dexie';
import { Capacitor } from '@capacitor/core';
import type { Acces } from './droits';
import { demanderPersistance } from './garde';
import { emptyProgress, fromJSON, toJSON, type Progress } from './session';

type Ligne = { id: string; value: Progress };

const CLE = 'progress';

class WenluDb extends Dexie {
  progress!: Table<Ligne, string>;
  constructor() {
    // Nom d'avant Wenlu, gardé : la base existante des utilisateurs doit se relire.
    super('zilin');
    this.version(1).stores({ progress: 'id' });
  }
}

export const db = new WenluDb();

/**
 * Ce que l'appareil dit des droits (`droits.ts`) : le web (la PWA) ou l'app iOS, et l'achat
 * de Wenlu complet. L'achat viendra de StoreKit (story 6.2) ; d'ici là, aucun. Sur le web,
 * jamais.
 */
export function accesAppareil(): Acces {
  return { web: !Capacitor.isNativePlatform(), achat: false };
}

/** La journée civile locale, au format AAAA-MM-JJ. */
export function today(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Relit la progression au démarrage. Rend un état neuf si rien n'est stocké. */
export async function loadProgress(aujourdhui: string = today()): Promise<Progress> {
  try {
    const ligne = await db.progress.get(CLE);
    return ligne ? fromJSON(JSON.stringify(ligne.value), aujourdhui) : emptyProgress(aujourdhui);
  } catch {
    return emptyProgress(aujourdhui);
  }
}

/** Le stockage persistant n'est demandé qu'une fois par lancement, au premier enregistrement. */
let persistanceDemandee = false;

/**
 * Sauvegarde à chaque tap. Une écriture qui échoue ne doit pas casser la session. Au
 * premier enregistrement d'une progression (un écran de la première session passé, ou
 * plus), sur le web, le navigateur est prié de ne pas effacer la base
 * (`garde.demanderPersistance`) ; dans l'app iOS, le stockage est celui de l'app. L'état
 * neuf du tout premier lancement n'est pas encore une progression : rien n'est demandé.
 */
export async function saveProgress(p: Progress): Promise<void> {
  if (!persistanceDemandee && !(p.premiere && p.premiereVue === 'f1')) {
    persistanceDemandee = true;
    const stockage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    void demanderPersistance(stockage, Capacitor.isNativePlatform());
  }
  try {
    await db.progress.put({ id: CLE, value: p });
  } catch {
    /* stockage indisponible : la session continue en mémoire */
  }
}

/** Export JSON de la progression. */
export async function exportProgress(aujourdhui: string = today()): Promise<string> {
  return toJSON(await loadProgress(aujourdhui));
}

/** Import JSON de la progression. Rend l'état importé, déjà écrit. */
export async function importProgress(texte: string, aujourdhui: string = today()): Promise<Progress> {
  const p = fromJSON(texte, aujourdhui);
  await saveProgress(p);
  return p;
}
