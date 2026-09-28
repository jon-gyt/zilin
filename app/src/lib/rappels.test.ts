import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  HEURES_PROPOSEES,
  JOURS_PROGRAMMES,
  SANS_RAPPEL,
  SANS_TEXTES,
  debut,
  idDuJour,
  jourPlus,
  libelleHeure,
  lireRappel,
  lireTextesRappels,
  planifier,
  reglerRappel,
  remplir,
  setRappel,
  type AnecdoteAnnoncee,
  type Planification,
  type Rappel
} from './rappels';
import { emptyProgress, fromJSON, toJSON } from './session';
import { departApres, points } from './premiere';

/* Les textes exportés par le pipeline : les tests lisent ceux que l'app lira. */
const textes = lireTextesRappels(
  JSON.parse(readFileSync(new URL('../../public/data/0.1.0/rappels.json', import.meta.url), 'utf8'))
);

const AUJOURDHUI = '2026-10-01';
const allume: Rappel = { actif: true, heure: '19:00', premierJour: null };

/** Une anecdote différente chaque jour, comme le tour de la liste quand rien n'est récent. */
const chaqueJour = (jour: string): AnecdoteAnnoncee => ({
  cle: `a-${jour}`,
  titre: `Titre du ${jour}.`,
  texte: `Première phrase du ${jour}. Deuxième phrase.`
});

function plan(x: Partial<Planification> = {}): Planification {
  return {
    rappel: allume,
    premiere: false,
    joursTravailles: [],
    jour: AUJOURDHUI,
    minute: 9 * 60,
    anecdote: chaqueJour,
    lueAujourdhui: false,
    brique: { c: '子', sens: 'enfant' },
    textes,
    ...x
  };
}

describe('rappels : les règles', () => {
  it('au plus une notification par jour, à l’heure choisie', () => {
    const n = planifier(plan());
    const jours = n.map((x) => x.jour);
    expect(new Set(jours).size).toBe(jours.length);
    expect(new Set(n.map((x) => x.id)).size).toBe(n.length);
    expect(n.every((x) => x.heure === '19:00')).toBe(true);
    expect(n[0].id).toBe(20261001);
  });

  it('au plus une par jour, même quand l’heure change après le rappel du jour', () => {
    /* Parti à 8 h ; à 10 h, on le recule à 19 h : le suivant attend demain. */
    const matin: Rappel = { actif: true, heure: '08:00', premierJour: null };
    const soir = reglerRappel(matin, { actif: true, heure: '19:00' }, AUJOURDHUI, 10 * 60);
    expect(soir).toEqual({ actif: true, heure: '19:00', premierJour: '2026-10-02' });
    expect(planifier(plan({ rappel: soir, minute: 10 * 60 })).map((x) => x.jour)[0]).toBe('2026-10-02');
    /* Pas encore parti : l'heure change sans rien repousser. */
    const tot = reglerRappel(allume, { actif: true, heure: '21:00' }, AUJOURDHUI, 10 * 60);
    expect(tot.premierJour).toBeNull();
    /* Éteint, rien n'est parti : l'allumer ne repousse rien. */
    expect(reglerRappel(SANS_RAPPEL, { actif: true, heure: '08:00' }, AUJOURDHUI, 7 * 60).premierJour).toBeNull();
  });

  it('rien le jour où la journée est faite', () => {
    const n = planifier(plan({ joursTravailles: ['2026-09-30', AUJOURDHUI] }));
    expect(n.map((x) => x.jour)).not.toContain(AUJOURDHUI);
    expect(n[0].jour).toBe('2026-10-02');
    /* La journée pas encore faite : le rappel du soir part. */
    expect(planifier(plan()).map((x) => x.jour)).toContain(AUJOURDHUI);
  });

  it('rien une fois l’heure passée, ni avant la première session, ni éteint', () => {
    expect(planifier(plan({ minute: 19 * 60 }))[0].jour).toBe('2026-10-02');
    expect(planifier(plan({ premiere: true }))).toEqual([]);
    expect(planifier(plan({ rappel: { ...allume, actif: false } }))).toEqual([]);
    expect(planifier(plan({ rappel: SANS_RAPPEL }))).toEqual([]);
    expect(planifier(plan({ textes: SANS_TEXTES }))).toEqual([]);
  });

  it('reprogrammées sur sept jours à chaque sauvegarde, avec l’anecdote de chaque jour', () => {
    const n = planifier(plan());
    expect(JOURS_PROGRAMMES).toBe(7);
    expect(n.map((x) => x.jour)).toEqual(Array.from({ length: 7 }, (_, k) => jourPlus(AUJOURDHUI, k)));
    expect(n[2]).toMatchObject({ titre: 'Titre du 2026-10-03.', corps: 'Première phrase du 2026-10-03.' });
    /* Le lendemain, la sauvegarde refait les sept jours à partir de là. */
    const demain = planifier(plan({ jour: '2026-10-02' }));
    expect(demain[0].jour).toBe('2026-10-02');
    expect(demain[6].jour).toBe('2026-10-08');
  });

  it('silence après sept jours sans ouverture, jusqu’au retour', () => {
    const n = planifier(plan());
    const septiemeApres = jourPlus(AUJOURDHUI, JOURS_PROGRAMMES);
    expect(n.every((x) => x.jour < septiemeApres)).toBe(true);
    /* De retour dix jours plus tard : la première sauvegarde reprogramme. */
    const retour = planifier(plan({ jour: jourPlus(AUJOURDHUI, 10) }));
    expect(retour.length).toBe(7);
    expect(retour[0].jour).toBe('2026-10-11');
  });
});

describe('rappels : le texte', () => {
  it('le titre et le début de l’anecdote du jour', () => {
    const a: AnecdoteAnnoncee = {
      cle: '四',
      titre: "Pourquoi il n'y a pas de 4e étage.",
      texte:
        "四 sì, quatre, sonne presque comme 死 sǐ, mourir. Beaucoup d'immeubles sautent le 4e, le 14e et le 24e étage."
    };
    const [n] = planifier(plan({ anecdote: () => a }));
    expect(n.titre).toBe("Pourquoi il n'y a pas de 4e étage.");
    expect(n.corps).toBe('四 sì, quatre, sonne presque comme 死 sǐ, mourir.');
  });

  it('une anecdote déjà lue laisse la place à la brique de la prochaine session', () => {
    const [n] = planifier(plan({ lueAujourdhui: true }));
    expect(n.jour).toBe(AUJOURDHUI);
    expect(n.titre).toBe(textes.notif_brique_titre);
    expect(n.corps).toBe('子 · enfant, la brique de ta prochaine session.');
  });

  it('la même anecdote, jour après jour : elle et la brique en alternance, jamais deux fois de suite pareil', () => {
    const toujours = (): AnecdoteAnnoncee => ({ cle: '露', titre: '白露 · la rosée blanche', texte: 'La rosée blanchit.' });
    const n = planifier(plan({ anecdote: toujours }));
    expect(n.map((x) => (x.titre === textes.notif_brique_titre ? 'brique' : 'anecdote'))).toEqual([
      'anecdote',
      'brique',
      'anecdote',
      'brique',
      'anecdote',
      'brique',
      'anecdote'
    ]);
    /* Sans brique à annoncer (rattrapage), l'anecdote seule. */
    expect(planifier(plan({ anecdote: toujours, brique: null })).length).toBe(7);
  });

  it('aucun texte n’est un reproche : ni série, ni manque, ni achat, ni exclamation', () => {
    for (const cle of Object.keys(textes) as (keyof typeof textes)[]) {
      expect(textes[cle], cle).not.toBe('');
      expect(textes[cle], cle).not.toMatch(/s[ée]rie|manqu|perd|achat|Wenlu complet|!|\p{Extended_Pictographic}/iu);
    }
  });

  it('le début s’arrête à la première phrase, coupé au mot au-delà de 140 signes', () => {
    expect(debut('Une phrase. Une autre.')).toBe('Une phrase.');
    const longue = `${'mot '.repeat(60)}fin.`;
    const d = debut(longue);
    expect(d.length).toBeLessThanOrEqual(141);
    expect(d.endsWith('mot…')).toBe(true);
    expect(remplir('{c} · {sens}', { c: '子', sens: 'enfant' })).toBe('子 · enfant');
  });
});

describe('rappels : le réglage', () => {
  it('l’heure à la française', () => {
    expect(HEURES_PROPOSEES.map(libelleHeure)).toEqual(['8 h', '12 h 30', '19 h']);
    expect(idDuJour('2026-12-31')).toBe(20261231);
  });

  it('éteint par défaut, et pour une progression plus ancienne', () => {
    expect(emptyProgress(AUJOURDHUI).rappel).toEqual(SANS_RAPPEL);
    const ancienne = JSON.parse(toJSON(emptyProgress(AUJOURDHUI))) as Record<string, unknown>;
    delete ancienne.rappel;
    expect(fromJSON(JSON.stringify(ancienne), AUJOURDHUI).rappel).toEqual(SANS_RAPPEL);
    expect(lireRappel({ actif: true, heure: '25:00' })).toEqual(SANS_RAPPEL);
  });

  it('il survit à l’export et à l’import, sans changer la version du format', () => {
    const p = setRappel(emptyProgress(AUJOURDHUI), { actif: true, heure: '08:00', premierJour: '2026-10-02' });
    const relu = fromJSON(toJSON(p), AUJOURDHUI);
    expect(relu.rappel).toEqual({ actif: true, heure: '08:00', premierJour: '2026-10-02' });
    expect(relu.version).toBe(1);
  });
});

describe('première session : la question de l’heure', () => {
  it('posée après l’objectif et le rythme, dans l’app iOS seulement', () => {
    expect(departApres('rythme', true)).toBe('heure');
    expect(departApres('heure', true)).toBe('personnage');
    expect(departApres('rythme', false)).toBe('personnage');
    expect(points('heure', true)).toEqual({ total: 5, index: 3 });
    expect(points('personnage', true)).toEqual({ total: 5, index: 4 });
    expect(points('personnage', false)).toEqual({ total: 4, index: 3 });
  });
});
