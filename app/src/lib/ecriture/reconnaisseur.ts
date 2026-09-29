/**
 * Le côté interface de l'écriture au doigt : il ouvre le Web Worker (`ecriture.worker.ts`) à
 * la première ouverture du pavé, lui fait lire les gabarits que l'index nomme (clé
 * `ecriture`), et lui passe les tracés.
 *
 * Le dernier tracé l'emporte : pendant qu'un tracé se reconnaît, seul le plus récent attend
 * son tour ; ceux qu'il remplace rendent `null`, et le pavé les ignore. Les candidats
 * suivent ainsi le doigt sans file d'attente, même sur un téléphone lent.
 */
import { contenu, dossierVersion, VERSION_DONNEES, type Index } from '../content';
import type { Demande, Reponse } from './protocole';
import { CANDIDATS, type Candidat, type Trace } from './reconnaissance';

/** Le fichier des gabarits d'une version, tel que l'index le nomme. Vide sans. */
export function fichierGabarits(i: Index): string {
  return !i.ecriture ? '' : `${dossierVersion(i.version)}/${i.ecriture}`;
}

/** L'adresse des gabarits de la version courante, un asset de l'app ; vide sans. */
export async function adresseGabarits(version = VERSION_DONNEES): Promise<string> {
  const file = fichierGabarits(await contenu(version));
  if (file === '') return '';
  return new URL(`${import.meta.env.BASE_URL}${file}`, globalThis.location?.href ?? 'http://localhost/').href;
}

export type Reconnaisseur = {
  /** Le nombre de caractères reconnaissables, une fois les gabarits lus ; rejetée sinon. */
  pret: Promise<number>;
  /** Les candidats du tracé ; `null` si un tracé plus récent l'a remplacé avant son tour. */
  reconnaitre(traces: readonly Trace[], max?: number): Promise<Candidat[] | null>;
  /** Le dernier temps de calcul mesuré dans le worker, en millisecondes. */
  dernierCalcul(): number;
  fermer(): void;
};

/** Ce que le reconnaisseur attend d'un worker : de quoi le remplacer dans les tests. */
export type Canal = {
  postMessage(d: Demande): void;
  onmessage: ((e: MessageEvent<Reponse>) => void) | null;
  terminate(): void;
};

function nouveauWorker(): Canal {
  return new Worker(new URL('./ecriture.worker.ts', import.meta.url), { type: 'module' }) as unknown as Canal;
}

type Attente = { traces: Trace[]; max: number; resoudre: (c: Candidat[] | null) => void };

/** Ouvre un worker et lui fait lire les gabarits de `url`. */
export function creerReconnaisseur(url: string, canal: Canal = nouveauWorker()): Reconnaisseur {
  let prochain = 1;
  let enCours: { id: number; resoudre: (c: Candidat[] | null) => void } | null = null;
  let enAttente: Attente | null = null;
  let ms = 0;
  let pretOk: (n: number) => void = () => undefined;
  let pretKo: (e: Error) => void = () => undefined;
  const pret = new Promise<number>((ok, ko) => {
    pretOk = ok;
    pretKo = ko;
  });

  function envoyer(a: Attente): void {
    const id = prochain++;
    enCours = { id, resoudre: a.resoudre };
    canal.postMessage({ type: 'reconnaitre', id, traces: a.traces, max: a.max });
  }

  canal.onmessage = (e) => {
    const r = e.data;
    if (r.type === 'pret') pretOk(r.caracteres);
    else if (r.type === 'erreur') {
      pretKo(new Error(r.message));
      enCours?.resoudre(null);
      enCours = null;
      enAttente?.resoudre(null);
      enAttente = null;
    } else if (r.type === 'candidats' && enCours?.id === r.id) {
      ms = r.ms;
      enCours.resoudre(r.candidats);
      enCours = null;
      if (enAttente) {
        const a = enAttente;
        enAttente = null;
        envoyer(a);
      }
    }
  };
  canal.postMessage({ type: 'charger', url });

  return {
    pret,
    dernierCalcul: () => ms,
    reconnaitre(traces, max = CANDIDATS) {
      return new Promise((resoudre) => {
        /* des copies simples : le tracé du pavé continue de vivre pendant le calcul */
        const a: Attente = { traces: traces.map((t) => t.map(([x, y]) => [x, y] as const)), max, resoudre };
        if (enCours === null) envoyer(a);
        else {
          enAttente?.resoudre(null);
          enAttente = a;
        }
      });
    },
    fermer() {
      canal.terminate();
      enCours?.resoudre(null);
      enAttente?.resoudre(null);
      enCours = null;
      enAttente = null;
    }
  };
}
