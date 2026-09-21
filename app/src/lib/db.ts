/**
 * La couche impure : IndexedDB (Dexie) et l'horloge. Toute la logique de session
 * est dans `session.ts` et reste testable sans navigateur.
 *
 * La progression tient dans un seul enregistrement : on sauvegarde à chaque tap.
 */
import Dexie, { type Table } from 'dexie';
import { emptyProgress, fromJSON, toJSON, type Progress } from './session';

type Ligne = { id: string; value: Progress };

const CLE = 'progress';

class ZilinDb extends Dexie {
  progress!: Table<Ligne, string>;
  constructor() {
    super('zilin');
    this.version(1).stores({ progress: 'id' });
  }
}

export const db = new ZilinDb();

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

/** Sauvegarde à chaque tap. Une écriture qui échoue ne doit pas casser la session. */
export async function saveProgress(p: Progress): Promise<void> {
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
