/**
 * Le Web Worker de l'écriture au doigt : il lit les gabarits une fois, puis rend les
 * candidats de chaque tracé, hors du fil de l'interface — le trait suivant se trace pendant
 * que le précédent se reconnaît. Aucune requête hors des assets de l'app.
 */
import { lireGabarits, type Gabarits } from './gabarits';
import type { Demande, Reponse } from './protocole';
import { reconnaitre } from './reconnaissance';

type Portee = {
  onmessage: ((e: MessageEvent<Demande>) => void) | null;
  postMessage(m: Reponse): void;
};

const portee = self as unknown as Portee;
let gabarits: Promise<Gabarits> | null = null;

portee.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'charger') {
    gabarits = fetch(d.url)
      .then((r) => {
        if (!r.ok) throw new Error(`Gabarits introuvables (${r.status})`);
        return r.json();
      })
      .then(lireGabarits);
    gabarits.then(
      (g) => portee.postMessage({ type: 'pret', caracteres: g.caracteres.length }),
      (err: unknown) => portee.postMessage({ type: 'erreur', message: String(err) })
    );
    return;
  }
  if (d.type === 'reconnaitre') {
    if (!gabarits) {
      portee.postMessage({ type: 'erreur', message: 'Gabarits non chargés' });
      return;
    }
    void gabarits.then(
      (g) => {
        const a = performance.now();
        const candidats = reconnaitre(g, d.traces, d.max);
        portee.postMessage({ type: 'candidats', id: d.id, candidats, ms: performance.now() - a });
      },
      () => undefined
    );
  }
};
