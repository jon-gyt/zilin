/**
 * Les trois lignes du pas Utiliser : une règle par test. Le texte du jour vient de l'export,
 * le cinabre ne marque que les caractères nouveaux de ce jour-là, un jour sans texte relit
 * un jour passé tout à l'encre, et rien n'est écrit en dur.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estHan } from './lecture';
import {
  FICHIER_TROIS_LIGNES,
  guideLecture,
  lectureDuJour,
  lireTroisLignes,
  loadTroisLignes,
  texteNu,
  unitesDeLigne,
  type TroisLignes
} from './lignes';

const exporte = lireTroisLignes(
  JSON.parse(readFileSync(new URL('../../public/data/0.1.0/trois-lignes.json', import.meta.url), 'utf8'))
);

/** L'acquis d'un parcours au jour `jour`, relu dans l'index exporté. */
const index = JSON.parse(
  readFileSync(new URL('../../public/data/0.1.0/index.json', import.meta.url), 'utf8')
) as { parcours: Record<string, { jours: { jour: number; brique: string | null; composes: string[] }[] }> };

function acquis(parcours: string, jour: number): Set<string> {
  const out = new Set<string>();
  for (const j of index.parcours[parcours].jours) {
    if (j.jour > jour) break;
    for (const c of [j.brique, ...j.composes]) if (c) out.add(c);
  }
  return out;
}

function nouveaux(parcours: string, jour: number): string[] {
  const j = index.parcours[parcours].jours.find((x) => x.jour === jour);
  return j ? [j.brique, ...j.composes].filter((c): c is string => c !== null) : [];
}

const mini: TroisLignes = lireTroisLignes({
  premier_jour: 4,
  parcours: {
    lire: [
      {
        jour: 4,
        nouveaux: ['月', '从'],
        lignes: [
          { zh: '天大，月大。', pinyin: 'tiān dà yuè dà', fr: 'Le ciel est grand.', en: 'e' },
          { zh: '人从人。', pinyin: 'rén cóng rén', fr: 'Un homme suit un homme.', en: 'e' },
          { zh: '月月，天天。', pinyin: 'yuè yuè tiān tiān', fr: 'Chaque mois, chaque jour.', en: 'e' }
        ],
        glose: {
          天: { pinyin: 'tiān', fr: 'ciel', en: 'sky' },
          天天: { pinyin: 'tiān tiān', fr: 'chaque jour', en: 'every day' }
        }
      },
      { jour: 5, nouveaux: ['日'], lignes: [{ zh: '日。', pinyin: 'rì', fr: 'Soleil.', en: 'Sun.' }], glose: {} },
      { jour: 6, nouveaux: ['一'], lignes: [{ zh: '一。', pinyin: 'yī', fr: 'Un.', en: 'One.' }], glose: {} }
    ],
    hsk: [{ jour: 4, nouveaux: ['介'], lignes: [{ zh: '介。', pinyin: 'jiè', fr: 'f', en: 'e' }], glose: {} }]
  }
});

describe('les trois lignes du jour', () => {
  it('lisent le texte du jour de la leçon, sur le parcours choisi', () => {
    expect(lectureDuJour(mini, 'lire', 5, 0)?.texte.jour).toBe(5);
    expect(lectureDuJour(mini, 'hsk', 4, 0)?.texte.lignes[0].zh).toBe('介。');
  });

  it('suivent « Lire » pour un parcours sans textes, comme « Voyager »', () => {
    expect(lectureDuJour(mini, 'voyage', 4, 0)?.cinabre).toEqual(['月', '从']);
    expect(lectureDuJour(mini, null, 4, 0)?.texte.jour).toBe(4);
  });

  it('mettent en cinabre les caractères nouveaux du jour, et eux seuls', () => {
    expect(lectureDuJour(mini, 'lire', 4, 0)?.cinabre).toEqual(['月', '从']);
  });

  it("relisent un jour passé, tout à l'encre, quand le jour n'a pas de texte", () => {
    const l = lectureDuJour(mini, 'lire', 70, 0);
    expect(l?.cinabre).toEqual([]);
    expect(l?.texte.jour).toBeLessThan(70);
  });

  it("un jour sans brique nouvelle, relisent un jour passé, tout à l'encre, même quand la leçon a son texte", () => {
    const l = lectureDuJour(mini, 'lire', 6, 0, true);
    expect(l?.cinabre).toEqual([]);
    expect(l?.texte.jour).toBeLessThan(6);
    expect(lectureDuJour(mini, 'lire', 4, 0, true)).toBeNull();
  });

  it("changent de texte passé d'une journée à l'autre, par le rang de la journée", () => {
    const jours = [0, 1, 2].map((r) => lectureDuJour(mini, 'lire', 70, r)?.texte.jour);
    expect(new Set(jours).size).toBe(3);
  });

  it("n'inventent rien quand aucun texte n'est écrit", () => {
    expect(lectureDuJour(mini, 'lire', 3, 0)).toBeNull();
    expect(lectureDuJour(lireTroisLignes(null), 'lire', 10, 0)).toBeNull();
  });

  it('ne parlent de cinabre que s’il y en a, et nomment les caractères du jour', () => {
    expect(guideLecture(['六'])).toContain('En cinabre, 六');
    expect(guideLecture([])).not.toContain('cinabre');
    expect(guideLecture([])).not.toContain("d'aujourd'hui");
  });

  it('se touchent par mot du glossaire, au pinyin de la ligne', () => {
    const us = unitesDeLigne(mini.parcours.lire[0].lignes[2], mini.parcours.lire[0].glose);
    const tt = us.find((u) => u.texte === '天天');
    expect(tt).toMatchObject({ pinyin: 'tiāntiān', sens: 'chaque jour', touchable: true });
    expect(us.find((u) => u.texte === '，')?.touchable).toBe(false);
  });

  it('se disent en entier par « Écouter »', () => {
    expect(texteNu(mini.parcours.lire[0])).toBe('天大，月大。人从人。月月，天天。');
  });
});

describe('les trois lignes exportées', () => {
  it('couvrent chaque jour de 4 à 120, sur les deux parcours', () => {
    expect(exporte.premierJour).toBe(4);
    for (const nom of ['lire', 'hsk']) {
      const jours = exporte.parcours[nom].map((t) => t.jour);
      for (let j = 4; j <= 120; j++) expect(jours).toContain(j);
    }
  });

  it("ne changent pas d'un jour à l'autre : chaque jour a son texte (retour de l'audit)", () => {
    for (const nom of ['lire', 'hsk']) {
      const textes = exporte.parcours[nom].filter((t) => t.jour <= 120).map((t) => texteNu(t));
      expect(new Set(textes).size).toBe(textes.length);
    }
  });

  it("n'emploient que l'acquis du jour, et un caractère nouveau du jour en cinabre", () => {
    for (const nom of ['lire', 'hsk']) {
      for (const t of exporte.parcours[nom]) {
        const permis = acquis(nom, t.jour);
        for (const c of Array.from(texteNu(t)).filter(estHan)) expect(permis.has(c), `${nom} ${t.jour} ${c}`).toBe(true);
        expect(t.nouveaux.length).toBeGreaterThan(0);
        for (const c of t.nouveaux) {
          expect(nouveaux(nom, t.jour)).toContain(c);
          expect(texteNu(t)).toContain(c);
        }
      }
    }
  });

  it('ont trois lignes traduites, chaque caractère glosé', () => {
    for (const nom of ['lire', 'hsk']) {
      for (const t of exporte.parcours[nom]) {
        expect(t.lignes).toHaveLength(3);
        for (const l of t.lignes) {
          expect(l.fr).not.toBe('');
          expect(l.en).not.toBe('');
          for (const u of unitesDeLigne(l, t.glose).filter((x) => x.touchable)) {
            expect(u.sens, `${nom} ${t.jour} ${u.texte}`).not.toBeNull();
            expect(u.pinyin, `${nom} ${t.jour} ${u.texte}`).not.toBeNull();
          }
        }
      }
    }
  });

  it("ne sont plus le texte de démonstration 住 d'un autre jour", () => {
    expect(exporte.parcours.lire.some((t) => texteNu(t).includes('我住在北京'))).toBe(false);
  });
});

describe('le chargeur', () => {
  it("lit le fichier servi avec l'app, et lui seul", async () => {
    const appels: string[] = [];
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return { ok: true, status: 200, json: async () => ({ premier_jour: 4, parcours: {} }) } as Response;
    };
    const lu = await loadTroisLignes(FICHIER_TROIS_LIGNES, faux);
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${FICHIER_TROIS_LIGNES}`]);
    expect(lu.premierJour).toBe(4);
  });

  it('refuse un fichier absent', async () => {
    const faux: typeof fetch = async () => ({ ok: false, status: 404 }) as Response;
    await expect(loadTroisLignes(FICHIER_TROIS_LIGNES, faux)).rejects.toThrow('introuvables');
  });
});

describe('le glossaire commun', () => {
  const doc = lireTroisLignes({
    premier_jour: 4,
    glossaire: {
      天: { pinyin: 'tiān', fr: 'ciel', en: 'sky' },
      大: { pinyin: 'dà', fr: 'grand', en: 'big' }
    },
    parcours: {
      lire: [
        {
          jour: 4,
          nouveaux: [],
          lignes: [{ zh: '天大。', pinyin: 'tiān dà', fr: 'f', en: 'e' }],
          mots: ['天', '大', '无'],
          glose: { 大: { pinyin: 'dà', fr: 'grande', en: 'large' } }
        }
      ]
    }
  });

  it('rend à chaque texte les entrées qu’il nomme, sa glose propre devant', () => {
    const g = doc.parcours.lire[0].glose;
    expect(g['天']).toEqual({ pinyin: 'tiān', fr: 'ciel', en: 'sky' });
    expect(g['大'].fr).toBe('grande');
    expect(g['无']).toBeUndefined();
  });
});
