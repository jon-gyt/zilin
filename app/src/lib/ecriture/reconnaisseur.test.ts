/**
 * Le côté interface de l'écriture au doigt (`reconnaisseur.ts`) : le worker est remplacé par
 * un canal factice qui répond à la main. Un test par règle.
 */
import { describe, expect, it } from 'vitest';
import type { Index } from '../content';
import type { Demande, Reponse } from './protocole';
import { creerReconnaisseur, fichierGabarits, type Canal } from './reconnaisseur';

function canal(): Canal & { recus: Demande[]; repondre(r: Reponse): void; ferme: boolean } {
  const c = {
    recus: [] as Demande[],
    ferme: false,
    onmessage: null as Canal['onmessage'],
    postMessage(d: Demande) {
      c.recus.push(d);
    },
    terminate() {
      c.ferme = true;
    },
    repondre(r: Reponse) {
      c.onmessage?.({ data: r } as MessageEvent<Reponse>);
    }
  };
  return c;
}

const trait = [
  [
    [0, 0],
    [10, 10]
  ] as [number, number][]
];

describe('reconnaisseur', () => {
  it("fait lire au worker les gabarits que l'index nomme", () => {
    const i = { version: '0.1.0', ecriture: 'ecriture/gabarits.json' } as Index;
    expect(fichierGabarits(i)).toBe('data/0.1.0/ecriture/gabarits.json');
    expect(fichierGabarits({ ...i, ecriture: '' })).toBe('');
    const k = canal();
    creerReconnaisseur('http://x/data/0.1.0/ecriture/gabarits.json', k);
    expect(k.recus[0]).toEqual({ type: 'charger', url: 'http://x/data/0.1.0/ecriture/gabarits.json' });
  });

  it('est prêt quand le worker a lu les gabarits, et le dit avec leur nombre', async () => {
    const k = canal();
    const r = creerReconnaisseur('u', k);
    k.repondre({ type: 'pret', caracteres: 3000 });
    await expect(r.pret).resolves.toBe(3000);
  });

  it('des gabarits illisibles : le pavé le sait, rien ne se devine', async () => {
    const k = canal();
    const r = creerReconnaisseur('u', k);
    k.repondre({ type: 'erreur', message: 'Gabarits introuvables (404)' });
    await expect(r.pret).rejects.toThrow('404');
  });

  it("le dernier tracé l'emporte : ceux qu'il remplace avant leur tour rendent null", async () => {
    const k = canal();
    const r = creerReconnaisseur('u', k);
    const a = r.reconnaitre(trait);
    const b = r.reconnaitre(trait);
    const c = r.reconnaitre(trait);
    /* un seul calcul en cours, un seul en attente : b est remplacé par c */
    expect(k.recus.filter((d) => d.type === 'reconnaitre')).toHaveLength(1);
    await expect(b).resolves.toBeNull();
    k.repondre({ type: 'candidats', id: 1, candidats: [{ c: '人', score: 0.1 }], ms: 3 });
    await expect(a).resolves.toEqual([{ c: '人', score: 0.1 }]);
    expect(r.dernierCalcul()).toBe(3);
    const envoyes = k.recus.filter((d) => d.type === 'reconnaitre');
    expect(envoyes).toHaveLength(2);
    k.repondre({ type: 'candidats', id: 2, candidats: [{ c: '入', score: 0.2 }], ms: 4 });
    await expect(c).resolves.toEqual([{ c: '入', score: 0.2 }]);
  });

  it("une réponse d'un tracé déjà remplacé est ignorée", async () => {
    const k = canal();
    const r = creerReconnaisseur('u', k);
    const a = r.reconnaitre(trait);
    k.repondre({ type: 'candidats', id: 99, candidats: [{ c: '八', score: 0 }], ms: 1 });
    k.repondre({ type: 'candidats', id: 1, candidats: [{ c: '人', score: 0 }], ms: 1 });
    await expect(a).resolves.toEqual([{ c: '人', score: 0 }]);
  });

  it('le tracé passé au worker est une copie : le pavé peut continuer de tracer', () => {
    const k = canal();
    const r = creerReconnaisseur('u', k);
    const vivant = [[[1, 2] as [number, number]]];
    void r.reconnaitre(vivant);
    vivant[0].push([3, 4]);
    const d = k.recus.find((x) => x.type === 'reconnaitre');
    expect(d && d.type === 'reconnaitre' ? d.traces[0] : null).toEqual([[1, 2]]);
  });

  it('fermer arrête le worker et libère ce qui attend', async () => {
    const k = canal();
    const r = creerReconnaisseur('u', k);
    const a = r.reconnaitre(trait);
    r.fermer();
    expect(k.ferme).toBe(true);
    await expect(a).resolves.toBeNull();
  });
});
