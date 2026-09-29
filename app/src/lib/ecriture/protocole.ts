/**
 * Ce que se disent le pavé et le Web Worker de la reconnaissance (`ecriture.worker.ts`,
 * `reconnaisseur.ts`). Des types seulement : rien ne s'exécute ici.
 */
import type { Candidat, Trace } from './reconnaissance';

export type Demande =
  /** Lire les gabarits à cette adresse (un asset de l'app, jamais une autre origine). */
  | { type: 'charger'; url: string }
  /** Les candidats d'un tracé, `max` au plus. */
  | { type: 'reconnaitre'; id: number; traces: Trace[]; max: number };

export type Reponse =
  | { type: 'pret'; caracteres: number }
  | { type: 'erreur'; message: string }
  /** `ms` : le temps du calcul dans le worker, pour la mesure. */
  | { type: 'candidats'; id: number; candidats: Candidat[]; ms: number };
