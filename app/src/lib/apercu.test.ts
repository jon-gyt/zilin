/**
 * Le mode relecture (décision du propriétaire) : un test par règle.
 *
 * - interrupteur éteint : rien de `apercu/` n'est demandé, rien n'est montré, un conte
 *   fermé le reste ;
 * - allumé : les fiches et les contes à relire s'affichent, chacun avec la mention
 *   « à relire » ; un conte que l'acquis n'ouvre pas s'ouvre, « pas encore dans ton
 *   acquis » ; ce que le mode ouvre ne compte pas comme lu ;
 * - un texte relu passe toujours devant l'aperçu.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MENTION_A_RELIRE,
  appliquerApercu,
  apercuActif,
  contesExport,
  fiche,
  fusionnerContes,
  lecon,
  lireFamilleApercu,
  lireIndexApercu,
  loadIndex,
  mention,
  nombreDeContes,
  reglerApercu,
  type Conte,
  type FicheApercu,
  type FicheLue
} from './content';
import { MENTION_HORS_ACQUIS, bibliotheque, entreeConte } from './lecture';
import { emptyProgress, fromJSON, noterConteLu, setRelecture, toJSON } from './session';

/** Un export simulé, servi par un `fetch` de test : on garde la trace de chaque demande. */
function servir(fichiers: Record<string, unknown>): string[] {
  const appels: string[] = [];
  vi.stubGlobal('fetch', (async (u: RequestInfo | URL) => {
    const url = String(u);
    appels.push(url);
    const chemin = url.slice(import.meta.env.BASE_URL.length);
    if (chemin in fichiers) {
      return { ok: true, status: 200, json: async () => fichiers[chemin] } as Response;
    }
    /* Les fichiers de démonstration sont servis depuis le dépôt, tels quels. */
    try {
      const brut = readFileSync(new URL(`../../public/${chemin}`, import.meta.url), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(brut) as unknown } as Response;
    } catch {
      return { ok: false, status: 404, json: async () => null } as Response;
    }
  }) as typeof fetch);
  return appels;
}

const vide = {
  en: '',
  nouveau: [],
  role: null,
  roles: {},
  sources: [],
  origine_fr: '',
  origine_en: '',
  etiquette: null,
  memo_fr: null,
  memo_en: null,
  mots: [],
  phrase: null,
  traits: [],
  medianes: [],
  audio: null,
  statut: 'sans_fiche'
};

/** Un export de deux caractères, 月 et 朋 ; `relu` donne à 朋 une fiche relue. */
function exportSimule(V: string, { relu = false, apercu = true } = {}): Record<string, unknown> {
  const 朋 = relu
    ? {
        ...vide,
        c: '朋',
        pinyin: 'péng',
        fr: '',
        parts: ['月', '月'],
        niveaux: { seuil: 255 },
        origine_fr: 'Texte relu.',
        etiquette: 'atteste',
        mots: [{ hanzi: '朋友', pinyin: 'péngyou', fr: 'ami (relu)', en: 'friend' }],
        statut: 'relu'
      }
    : { ...vide, c: '朋', pinyin: 'péng', fr: '', parts: ['月', '月'], niveaux: { seuil: 255 } };
  return {
    [`data/${V}/index.json`]: {
      version: V,
      date: '2026-09-24T00:00:00Z',
      empreinte: 'sha256:0',
      norme: 'GF 0014-2009',
      perimetre: 'test',
      licences: 'LICENCES.md',
      listes: { 'seuil-255': ['月', '朋'] },
      parcours: {
        lire: {
          liste: 'seuil-255',
          regle: 'une seule brique nouvelle par session de 10 minutes',
          jours: [{ jour: 1, brique: '月', composes: ['朋'], non_reconcilie: false }]
        }
      },
      familles: [
        { racine: '月', fichier: 'familles/月.json', traits: 'traits/月.json', n: 2, avancement_possible: 0 }
      ],
      contes: relu
        ? [{ id: 'essai', titre_fr: 'Essai', seuils: [255], fichier: 'contes/essai.json' }]
        : [],
      paires: 'paires.json',
      ...(apercu ? { apercu: 'apercu/index.json' } : {})
    },
    [`data/${V}/familles/月.json`]: {
      version: V,
      source: 'test',
      racine: { c: '月', pinyin: 'yuè', fr: '', en: '', origine: '', etiquette: null },
      fiches: [{ ...vide, c: '月', pinyin: 'yuè', fr: '', parts: [], niveaux: { seuil: 255 } }, 朋]
    },
    [`data/${V}/contes/essai.json`]: {
      conte: 'essai',
      titre_fr: 'Essai',
      versions: { '255': { titre: '月', phrases: [{ zh: '月。', pinyin: 'Yuè.', fr: 'La lune (relue).' }], glose: {} } }
    },
    [`data/${V}/apercu/index.json`]: {
      statut: 'a_relire',
      familles: [{ racine: '月', fichier: 'apercu/familles/月.json', caracteres: ['朋'] }],
      contes: [
        { id: 'essai', titre_fr: 'Essai', seuils: [255, 405], fichier: 'apercu/contes/essai.json', statut: 'a_relire' },
        { id: 'neuf', titre_fr: 'Neuf', seuils: [255], fichier: 'apercu/contes/neuf.json', statut: 'a_relire' }
      ]
    },
    [`data/${V}/apercu/familles/月.json`]: {
      statut: 'a_relire',
      racine: '月',
      fiches: [
        {
          c: '朋',
          statut: 'a_relire',
          fr: 'ami, compagnon',
          en: 'friend',
          role: null,
          roles: { 月: 'forme' },
          origine_fr: 'Deux lunes côte à côte (à relire).',
          origine_en: 'Two moons side by side.',
          etiquette: 'mnemotechnique',
          memo_fr: null,
          memo_en: null,
          mots: [{ hanzi: '朋友', pinyin: 'péngyou', fr: 'ami', en: 'friend', audio: null }],
          phrase: { hanzi: '我的朋友。', pinyin: 'Wǒ de péngyou.', fr: 'Mon ami.', en: 'My friend.', audio: null }
        }
      ]
    },
    [`data/${V}/apercu/contes/essai.json`]: {
      statut: 'a_relire',
      conte: 'essai',
      titre_fr: 'Essai',
      versions: {
        '255': { statut: 'a_relire', titre: '月', phrases: [{ zh: '月月。', pinyin: 'Yuè yuè.', fr: 'Brouillon.' }], glose: {} },
        '405': { statut: 'a_relire', titre: '朋', phrases: [{ zh: '朋友。', pinyin: 'Péngyou.', fr: 'Ami.' }], glose: {} }
      }
    },
    [`data/${V}/apercu/contes/neuf.json`]: {
      statut: 'a_relire',
      conte: 'neuf',
      titre_fr: 'Neuf',
      versions: {
        '255': { statut: 'a_relire', titre: '朋月', phrases: [{ zh: '朋月。', pinyin: 'Péng yuè.', fr: 'Neuf.' }], glose: {} }
      }
    }
  };
}

const versApercu = (appels: string[]): string[] => appels.filter((u) => u.includes('/apercu/'));

afterEach(() => {
  reglerApercu(false);
  vi.unstubAllGlobals();
});

describe('le mode relecture, dans la progression', () => {
  it('est éteint par défaut, et une progression plus ancienne se relit éteinte', () => {
    const p = emptyProgress('2026-09-24');
    expect(p.relecture).toBe(false);
    const ancien = JSON.parse(toJSON(p)) as Record<string, unknown>;
    delete ancien.relecture;
    expect(fromJSON(JSON.stringify(ancien), '2026-09-24').relecture).toBe(false);
  });

  it("s'allume, et survit à l'export et à l'import JSON", () => {
    const p = setRelecture(emptyProgress('2026-09-24'), true);
    expect(p.relecture).toBe(true);
    expect(fromJSON(toJSON(p), '2026-09-24').relecture).toBe(true);
    expect(fromJSON(JSON.stringify({ relecture: 'oui' }), '2026-09-24').relecture).toBe(false);
  });
});

describe('interrupteur éteint : rien de l’aperçu n’est chargé ni montré', () => {
  it("lit le champ optionnel de l'index sans rien demander de plus", async () => {
    const V = 'apercu-eteint-index';
    const appels = servir(exportSimule(V));
    const i = await loadIndex(V);
    expect(i.apercu).toBe('apercu/index.json');
    expect(apercuActif()).toBe(false);
    expect(versApercu(appels)).toEqual([]);
  });

  it('la fiche, la leçon et les contes restent ceux de l’export', async () => {
    const V = 'apercu-eteint';
    const appels = servir(exportSimule(V));
    const f = await fiche('朋', [], V);
    expect(f?.source).toBe('aucune');
    expect(f?.origine_fr).toBe('');
    expect(mention(f)).toBeNull();
    const l = await lecon(null, 1, V);
    expect(l.composes[0]?.source).toBe('aucune');
    const { index, contes } = await contesExport(V);
    expect(index).toEqual([]);
    expect(contes.size).toBe(0);
    expect(await nombreDeContes(V)).toBe(0);
    expect(versApercu(appels)).toEqual([]);
  });
});

describe('interrupteur allumé : les textes à relire, avec la mention « à relire »', () => {
  it("la fiche à relire passe devant la démonstration, et porte la mention", async () => {
    const V = 'apercu-allume';
    const appels = servir(exportSimule(V));
    reglerApercu(true);
    const f = await fiche('朋', [], V);
    expect(f?.source).toBe('apercu');
    expect(f?.statut).toBe('a_relire');
    expect(f?.origine_fr).toBe('Deux lunes côte à côte (à relire).');
    expect([f?.fr, f?.en]).toEqual(['ami, compagnon', 'friend']);
    expect(f?.etiquette).toBe('mnemotechnique');
    expect(f?.mots.map((m) => m.hanzi)).toEqual(['朋友']);
    expect(f?.phrase?.hanzi).toBe('我的朋友。');
    /* La décomposition et le pinyin restent ceux de l'export : la norme fait foi. */
    expect(f?.parts).toEqual(['月', '月']);
    expect(f?.pinyin).toBe('péng');
    expect(mention(f)).toBe(MENTION_A_RELIRE);
    expect(MENTION_A_RELIRE).toBe('à relire');
    /* Un caractère sans fiche à relire ne demande pas d'autre fichier que l'index de l'aperçu. */
    expect((await fiche('月', [], V))?.source).toBe('aucune');
    expect(versApercu(appels).filter((u) => u.endsWith('apercu/index.json'))).toHaveLength(1);
    for (const u of appels) expect(u.startsWith(import.meta.env.BASE_URL)).toBe(true);
  });

  it('la leçon se relit quand on allume : pas de cache d’avant', async () => {
    const V = 'apercu-lecon';
    servir(exportSimule(V));
    expect((await lecon(null, 1, V)).composes[0]?.source).toBe('aucune');
    reglerApercu(true);
    const l = await lecon(null, 1, V);
    expect(l.composes[0]?.source).toBe('apercu');
    expect(mention(l.composes[0])).toBe('à relire');
  });

  it('les contes à relire s’ouvrent, même sans acquis, marqués « à relire »', async () => {
    const V = 'apercu-contes';
    servir(exportSimule(V));
    reglerApercu(true);
    const { index, contes } = await contesExport(V);
    expect(index.map((x) => x.id)).toEqual(['essai', 'neuf']);
    expect(await nombreDeContes(V)).toBe(2);
    const entrees = bibliotheque(index, contes, new Set(), {}, true);
    expect(entrees.map((e) => [e.id, e.version?.seuil, e.version?.statut])).toEqual([
      ['essai', '255', 'a_relire'],
      ['neuf', '255', 'a_relire']
    ]);
    expect(mention(entrees[0].version)).toBe('à relire');
    expect(entrees.every((e) => e.horsAcquis && e.sansCompte)).toBe(true);
  });

  it("l'aperçu ne garde que ce qui est marqué à relire", () => {
    const lues = lireFamilleApercu({
      fiches: [
        { c: '朋', statut: 'a_relire', origine_fr: 'x', etiquette: 'atteste', mots: [], roles: {} },
        { c: '明', statut: 'relu', origine_fr: 'y', etiquette: 'atteste', mots: [], roles: {} },
        { c: '林', statut: 'a_relire', origine_fr: '', etiquette: 'atteste', mots: [{ hanzi: '' }] }
      ]
    });
    expect([...lues.keys()]).toEqual(['朋', '林']);
    expect(lues.get('林')?.fr).toBe('');
    expect(lues.get('林')?.etiquette).toBeNull();
    expect(lues.get('林')?.mots).toEqual([]);
    expect(lireIndexApercu({ familles: [{ racine: '月' }], contes: [] }).familles).toEqual([]);
  });
});

describe("un texte relu prime sur l'aperçu", () => {
  it('une fiche relue reste telle quelle, sans mention, sans rien demander à l’aperçu', async () => {
    const V = 'apercu-relu';
    const appels = servir(exportSimule(V, { relu: true }));
    reglerApercu(true);
    const f = await fiche('朋', [], V);
    expect(f?.source).toBe('export');
    expect(f?.statut).toBe('relu');
    expect(f?.origine_fr).toBe('Texte relu.');
    expect(f?.mots[0].fr).toBe('ami (relu)');
    expect(mention(f)).toBeNull();
    expect(versApercu(appels).filter((u) => u.includes('apercu/familles'))).toEqual([]);
  });

  it('appliquerApercu ne touche jamais une fiche relue', () => {
    const relue = { c: '朋', origine_fr: 'Relu.', statut: 'relu', source: 'export' } as FicheLue;
    const a = { c: '朋', statut: 'a_relire', origine_fr: 'Brouillon.' } as FicheApercu;
    expect(appliquerApercu(relue, a)).toBe(relue);
    const demo = { c: '朋', origine_fr: 'Démo.', statut: 'sans_fiche', source: 'demonstration' } as FicheLue;
    expect(appliquerApercu(demo, a).source).toBe('apercu');
    expect(appliquerApercu(demo, null)).toBe(demo);
    /* Le sens de la démonstration ne passe jamais pour celui de la fiche à relire. */
    const demoSens = { ...demo, fr: 'démo' } as FicheLue;
    expect(appliquerApercu(demoSens, a).fr).toBe('');
    expect(appliquerApercu(demoSens, { ...a, fr: 'ami' }).fr).toBe('ami');
  });

  it('une version relue passe devant la version à relire du même seuil', async () => {
    const V = 'apercu-conte-relu';
    servir(exportSimule(V, { relu: true }));
    reglerApercu(true);
    const { index, contes } = await contesExport(V);
    const essai = contes.get('essai') as Conte;
    expect(essai.versions.map((v) => [v.seuil, v.statut ?? 'relu'])).toEqual([
      ['255', 'relu'],
      ['405', 'a_relire']
    ]);
    expect(essai.versions[0].phrases[0].fr).toBe('La lune (relue).');
    expect(index.find((x) => x.id === 'essai')?.seuils).toEqual(['255', '405']);
    /* L'acquis ouvre la version relue : elle compte, l'aperçu du seuil 405 attend. */
    const [entree] = bibliotheque(index, contes, new Set(['月']), {}, true);
    expect(entree.version?.seuil).toBe('255');
    expect(entree.version?.statut).toBeUndefined();
    expect(entree.sansCompte).toBe(false);
    /* Sans acquis, le mode relecture ouvre d'abord la version relue, hors acquis. */
    const [hors] = bibliotheque(index, contes, new Set(), {}, true);
    expect([hors.version?.seuil, hors.version?.statut, hors.horsAcquis]).toEqual(['255', undefined, true]);
  });

  it('fusionnerContes sans aperçu rend l’export tel quel', () => {
    const exportes = { index: [{ id: 'a', titre_fr: 'A', seuils: ['255'], fichier: 'contes/a.json' }], contes: new Map() };
    expect(fusionnerContes(exportes, null).index).toEqual(exportes.index);
  });
});

describe('le mode relecture ouvre les contes que l’acquis n’ouvre pas encore', () => {
  /** Un conte relu, dans l'export principal : trois caractères au seuil 255. */
  const relu: Conte = {
    version: 'v',
    source: 'test',
    id: 'yu-gong',
    titre_fr: 'Yu Gong déplace les montagnes',
    versions: [{ seuil: '255', titre: '愚公', phrases: [{ zh: '愚公移山。', pinyin: 'Yúgōng yí shān.', fr: 'Yu Gong.' }], glose: {} }]
  };
  const index = [{ id: 'yu-gong', titre_fr: 'Yu Gong déplace les montagnes', seuils: ['255'], fichier: 'contes/yu-gong.json' }];
  const contes = new Map([['yu-gong', relu]]);

  it('éteint, un conte relu hors de l’acquis reste fermé', () => {
    const [e] = bibliotheque(index, contes, new Set(['山']));
    expect(e.version).toBeNull();
    expect(e.attend).toBe('255');
    expect(e.reste).toBe(3);
  });

  it('allumé, il s’ouvre, marqué « pas encore dans ton acquis », et ne compte pas', () => {
    const [e] = bibliotheque(index, contes, new Set(['山']), {}, true);
    expect(e.version?.seuil).toBe('255');
    expect(e.horsAcquis).toBe(true);
    expect(e.sansCompte).toBe(true);
    expect(MENTION_HORS_ACQUIS).toBe('pas encore dans ton acquis');
    expect(mention(e.version)).toBeNull();
  });

  it('allumé, un conte que l’acquis ouvre se lit comme d’habitude, et compte', () => {
    const e = entreeConte(index[0], relu, new Set(['愚', '公', '移', '山']), [], true);
    expect(e.version?.seuil).toBe('255');
    expect(e.horsAcquis).toBe(false);
    expect(e.sansCompte).toBe(false);
  });

  it('ce qui ne compte pas ne se note pas : les contes lus restent vides', () => {
    /* `Lire.fini` ne note une version que si elle compte : c'est la règle rejouée ici. */
    const p = emptyProgress('2026-09-24');
    const [e] = bibliotheque(index, contes, new Set(), {}, true);
    const apres = e.version && !e.sansCompte ? noterConteLu(p, e.id, e.version.seuil) : p;
    expect(apres.contesLus).toEqual({});
  });
});
