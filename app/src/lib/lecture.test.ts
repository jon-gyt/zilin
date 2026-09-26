/**
 * Le mode Lire, un test par règle (backlog 2c.1, 2c.2). Les contes ci-dessous sont des
 * fixtures de test, écrites pour exercer les règles : l'app n'en contient aucun, tout
 * conte lu à l'exécution vient de l'export (`contes/<id>.json`, `data/schema.md`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  lireCatalogueContes,
  lireConte,
  type CatalogueConte,
  type Conte,
  type Index,
  type IndexConte,
  type MotConte,
  type VersionConte
} from './content';
import {
  contesLus,
  emptyProgress,
  fromJSON,
  noterActivite,
  noterChapitreLu,
  noterConteLu,
  noterReprise,
  toJSON
} from './session';
import { lireNiveaux } from './niveaux';
import { POIDS, posture } from './tao';
import { tropheesContes } from './trophees';
import {
  MENTION_MOT_DU_CONTE,
  TITRE_VOCABULAIRE_DU_CONTE,
  bibliotheque,
  caracteresAcquis,
  caracteresDeVersion,
  caracteresExpliques,
  motsDuChapitre,
  chapitreDeReprise,
  chapitresDe,
  cleLecture,
  entreeConte,
  estLongue,
  lireChapitre,
  niveauxDuConte,
  tousLus,
  unitesDuChapitre,
  estHan,
  grouper,
  ligneGlose,
  manquants,
  syllabes,
  traduction,
  unites,
  unitesDuTitre,
  versionLisible
} from './lecture';
import { SEUIL_DEBLOCAGE, newCard, schedule, stability, type ReviewCard } from './srs';

const TJ = new Date('2026-03-02T08:00:00Z');
const JUSTE = { correct: true, tries: 0, seconds: 2 };
const neuve = (c: string): ReviewCard => newCard(c, TJ);
const sue = (c: string): ReviewCard => schedule(newCard(c, TJ), JUSTE, TJ).card;

const V255: VersionConte = {
  seuil: '255',
  titre: '人和兔',
  phrases: [
    { zh: '一个人看见一只兔。', pinyin: 'Yí gè rén kànjiàn yì zhī tù.', fr: 'Un homme voit un lièvre.' }
  ],
  glose: { 一: 'un', 个: 'classificateur', 人: 'homme', 看: 'regarder', 见: 'voir', 看见: 'apercevoir', 只: 'classificateur', 兔: 'lièvre', 和: 'et' }
};

const V405: VersionConte = {
  seuil: '405',
  titre: '人和兔子',
  phrases: [
    { zh: '农夫天天等兔子。', pinyin: 'Nóngfū tiāntiān děng tùzi.', fr: 'Le paysan attend le lièvre.' },
    { zh: '兔子没来！', pinyin: 'Tùzi méi lái!', fr: 'Le lièvre ne vient pas.' }
  ],
  glose: { 人: 'homme', 和: 'et', 兔: 'lièvre', 子: 'suffixe', 兔子: 'lièvre', 农: 'agriculture', 夫: 'homme', 天: 'jour', 等: 'attendre', 没: 'ne pas', 来: 'venir' }
};

const CONTE: Conte = { version: '0.1.0', source: 'test', id: 'essai', titre_fr: 'Essai', versions: [V255, V405] };
const INDEX: IndexConte = { id: 'essai', titre_fr: 'Essai', seuils: ['255', '405'], fichier: 'contes/essai.json' };

const tous = (v: VersionConte): Set<string> => new Set(caracteresDeVersion(v));
const union = (...vs: VersionConte[]): Set<string> => new Set(vs.flatMap(caracteresDeVersion));

describe("l'acquis suit la règle de Ma forêt", () => {
  it('un caractère est acquis quand sa carte passe le seuil de stabilité, pas avant', () => {
    const cartes = [sue('人'), neuve('大')];
    expect(stability(cartes[0])).toBeGreaterThanOrEqual(SEUIL_DEBLOCAGE);
    const a = caracteresAcquis(cartes);
    expect(a.has('人')).toBe(true);
    expect(a.has('大')).toBe(false);
    expect(a.has('天')).toBe(false);
  });
});

describe('les caractères d’une version', () => {
  it('comptent le titre et le texte, sans ponctuation, chiffres ni espaces', () => {
    const v: VersionConte = { seuil: '255', titre: '天', phrases: [{ zh: '人，大 3。', pinyin: '', fr: '' }], glose: {} };
    expect(caracteresDeVersion(v)).toEqual(['天', '人', '大']);
    expect(estHan('。')).toBe(false);
    expect(estHan('A')).toBe(false);
  });

  it("un caractère du titre qu'on ne sait pas lire ferme la version", () => {
    const acquis = tous(V255);
    acquis.delete('和');
    expect(manquants(V255, acquis)).toEqual(['和']);
    expect(versionLisible(CONTE, acquis)).toBeNull();
  });
});

describe('la version ouverte', () => {
  it('est celle du seuil le plus haut dont tous les caractères sont acquis', () => {
    expect(versionLisible(CONTE, union(V255, V405))?.seuil).toBe('405');
    expect(versionLisible(CONTE, tous(V255))?.seuil).toBe('255');
  });

  it('un seul caractère manquant ferme sa version, pas les autres', () => {
    const acquis = union(V255, V405);
    acquis.delete('等');
    expect(versionLisible(CONTE, acquis)?.seuil).toBe('255');
  });
});

describe('un conte sans version lisible', () => {
  it('est fermé, avec le seuil qu’il attend et ce qu’il reste à acquérir', () => {
    const acquis = tous(V255);
    acquis.delete('兔');
    acquis.delete('只');
    const e = entreeConte(INDEX, CONTE, acquis);
    expect(e.version).toBeNull();
    expect(e.attend).toBe('255');
    expect(e.reste).toBe(2);
    expect(e.plusRiche).toBe(false);
  });

  it("sans fichier lisible, il attend le plus bas seuil de l'index, sans rien estimer", () => {
    const e = entreeConte({ ...INDEX, seuils: ['405', '255'] }, null, union(V255, V405));
    expect(e.version).toBeNull();
    expect(e.attend).toBe('255');
    expect(e.reste).toBe(0);
  });
});

describe('une version plus riche (2c.2)', () => {
  const acquis = union(V255, V405);

  it("est signalée quand la version ouverte dépasse toutes celles qu'on a lues", () => {
    const e = entreeConte(INDEX, CONTE, acquis, ['255']);
    expect(e.version?.seuil).toBe('405');
    expect(e.plusRiche).toBe(true);
    expect(e.lue).toBe(false);
  });

  it("ne l'est pas pour un conte jamais lu : tout y est neuf", () => {
    expect(entreeConte(INDEX, CONTE, acquis, []).plusRiche).toBe(false);
  });

  it("ne l'est plus une fois cette version lue", () => {
    const e = entreeConte(INDEX, CONTE, acquis, ['255', '405']);
    expect(e.plusRiche).toBe(false);
    expect(e.lue).toBe(true);
  });
});

describe('le marqueur gratuit', () => {
  it("se lit dans l'index et ne ferme ni n'ouvre aucun conte", () => {
    const ouvert = entreeConte({ ...INDEX, gratuit: false }, CONTE, tous(V255));
    const ferme = entreeConte({ ...INDEX, gratuit: true }, CONTE, new Set());
    expect(ouvert.gratuit).toBe(false);
    expect(ouvert.version?.seuil).toBe('255');
    expect(ferme.gratuit).toBe(true);
    expect(ferme.version).toBeNull();
    expect(entreeConte({ ...INDEX, gratuit: undefined }, CONTE, new Set()).gratuit).toBe(false);
  });
});

describe('la bibliothèque', () => {
  it("est vide sans conte dans l'export", () => {
    expect(bibliotheque([], new Map(), new Set())).toEqual([]);
  });

  it("montre les contes ouverts d'abord, puis les fermés, dans l'ordre de l'index", () => {
    const autre: Conte = { ...CONTE, id: 'autre', titre_fr: 'Autre', versions: [V405] };
    const index = [
      { ...INDEX, id: 'autre', titre_fr: 'Autre', seuils: ['405'] },
      INDEX,
      { ...INDEX, id: 'absent', titre_fr: 'Absent', seuils: ['255'] }
    ];
    const contes = new Map([
      ['essai', CONTE],
      ['autre', autre]
    ]);
    const b = bibliotheque(index, contes, tous(V255), { essai: ['255'] });
    expect(b.map((e) => e.id)).toEqual(['essai', 'autre', 'absent']);
    expect(b[0].lue).toBe(true);
    expect(b[1].attend).toBe('405');
  });
});

describe('le pinyin, syllabe par syllabe', () => {
  it('coupe les mots écrits d’un tenant', () => {
    expect(syllabes('Nóngfū tiāntiān děng tùzi.')).toEqual(['Nóng', 'fū', 'tiān', 'tiān', 'děng', 'tù', 'zi']);
    expect(syllabes('Zhōngguó shēngrì')).toEqual(['Zhōng', 'guó', 'shēng', 'rì']);
  });

  it("au milieu d'un mot, une syllabe commence par une consonne ; l'apostrophe sépare a, o, e", () => {
    expect(syllabes('fāngàn')).toEqual(['fān', 'gàn']);
    expect(syllabes('dàngāo')).toEqual(['dàn', 'gāo']);
    expect(syllabes("Xī'ān")).toEqual(['Xī', 'ān']);
    expect(syllabes('nǚ lǜ èr')).toEqual(['nǚ', 'lǜ', 'èr']);
  });

  it('rend null quand un mot ne se coupe pas', () => {
    expect(syllabes('hello')).toBeNull();
  });
});

describe('le découpage en unités qui se touchent', () => {
  it('la ponctuation est muette ; chaque caractère se touche, avec sa glose et son pinyin', () => {
    const { 看见: _mot, ...seuls } = V255.glose;
    const u = unites(V255.phrases[0], seuls);
    expect(u.map((x) => x.texte).join('|')).toBe('一|个|人|看|见|一|只|兔|。');
    expect(u[4]).toEqual({ texte: '见', pinyin: 'jiàn', sens: 'voir', touchable: true });
    const fin = u[u.length - 1];
    expect(fin).toEqual({ texte: '。', pinyin: null, sens: null, touchable: false });
    expect(u[0]).toEqual({ texte: '一', pinyin: 'Yí', sens: 'un', touchable: true });
    expect(u.find((x) => x.texte === '兔')).toEqual({ texte: '兔', pinyin: 'tù', sens: 'lièvre', touchable: true });
  });

  it('un mot de la glose se touche d’un seul geste, le plus long d’abord', () => {
    const u = unites(V405.phrases[0], V405.glose);
    expect(u.map((x) => x.texte)).toEqual(['农', '夫', '天', '天', '等', '兔子', '。']);
    expect(u[5]).toEqual({ texte: '兔子', pinyin: 'tùzi', sens: 'lièvre', touchable: true });
    const v = unites(V255.phrases[0], V255.glose);
    expect(v.find((x) => x.texte === '看见')).toEqual({ texte: '看见', pinyin: 'kànjiàn', sens: 'apercevoir', touchable: true });
  });

  it('sans pinyin aligné sur les caractères, le pinyin reste nul et la glose demeure', () => {
    const u = unites({ zh: '兔子没来！', pinyin: 'Tùzi méi', fr: '' }, V405.glose);
    expect(u[0]).toEqual({ texte: '兔子', pinyin: null, sens: 'lièvre', touchable: true });
    expect(unitesDuTitre(V405).map((x) => [x.texte, x.pinyin, x.sens])).toEqual([
      ['人', null, 'homme'],
      ['和', null, 'et'],
      ['兔子', null, 'lièvre']
    ]);
  });

  it('aucune ligne ne commence par une ponctuation fermante ni ne finit par une ouvrante', () => {
    const u = unites({ zh: '他说：“等兔子！”人来。', pinyin: '', fr: '' }, V405.glose);
    expect(grouper(u).map((g) => g.map((x) => x.texte).join(''))).toEqual([
      '他', '说：', '“等', '兔子！”', '人', '来。'
    ]);
    expect(grouper(unites({ zh: '“人”', pinyin: '', fr: '' }, {})).map((g) => g.length)).toEqual([3]);
  });

  it("la glose au toucher s'écrit « pinyin, sens », sans vide quand l'un manque", () => {
    expect(ligneGlose({ pinyin: 'tù', sens: 'lièvre' })).toBe('tù, lièvre');
    expect(ligneGlose({ pinyin: null, sens: 'lièvre' })).toBe('lièvre');
    expect(ligneGlose({ pinyin: null, sens: null })).toBe('');
  });
});

describe("« J'ai lu »", () => {
  it('remplit le trophée du conte à ce seuil et nourrit Tao, qui lit par-dessus l’épaule', () => {
    const avant = emptyProgress('2026-03-02');
    const p = noterActivite(noterConteLu(avant, 'essai', '255'), avant.day, 'conte');
    const index = { contes: [INDEX] } as unknown as Index;
    const t = tropheesContes(index, 0, {}, p.contesLus);
    expect(t.find((x) => x.id === 'conte-essai-255')?.obtenu).toBe(true);
    expect(t.find((x) => x.id === 'conte-essai-405')?.obtenu).toBe(false);
    expect(p.tao.croissance - avant.tao.croissance).toBe(POIDS.conte);
    expect(posture('conte')).toBe('lecture');
  });
});

describe('le lecteur', () => {
  const src = readFileSync(new URL('Conte.svelte', import.meta.url), 'utf8');

  it("écrit le conte en police, comme le texte du pas Utiliser : c'est un texte courant", () => {
    expect(src).toContain('class="read');
    /* Seuls les mots du conte, en tête, se dessinent depuis leurs traits (grands caractères). */
    const dessins = src.match(/<Glyph/g) ?? [];
    expect(dessins).toHaveLength(1);
    const carte = src.slice(src.indexOf('class="card mots"'), src.indexOf('</section>'));
    expect(carte).toContain('<Glyph');
  });

  it('souligne les mots expliqués sans cinabre, et leur glose dit « mot du conte »', () => {
    expect(src).toContain('class:explique={u.explique}');
    expect(src).toMatch(/\.read \.s\.explique \{[^}]*text-decoration-color: var\(--mist\)/);
    expect(src).toContain('explique: touchee.explique');
    expect(src).toContain('{TITRE_VOCABULAIRE_DU_CONTE}');
  });

  it("n'a pas de cinabre : un conte n'a pas d'élément ajouté", () => {
    expect(src).not.toMatch(/--zhu|class:new/);
  });

  it('dit ce qu’on touche, et Tao y lit', () => {
    expect(src).toContain('dire(u.texte)');
    expect(src).toContain('posture="lecture"');
  });
});

describe('la traduction', () => {
  it('suit les phrases, dans l’ordre', () => {
    expect(traduction(V405)).toBe('Le paysan attend le lièvre. Le lièvre ne vient pas.');
  });
});

describe('le vrai titre', () => {
  it("l'entrée porte le titre chinois et son pinyin, même quand le conte est fermé", () => {
    const e = entreeConte(
      { ...INDEX, titre_zh: '愚公移山', titre_pinyin: 'yú gōng yí shān' },
      { ...CONTE, titre_zh: '愚公移山', titre_pinyin: 'yú gōng yí shān' },
      new Set()
    );
    expect(e.version).toBeNull();
    expect([e.titre_zh, e.titre_pinyin, e.titre_fr]).toEqual(['愚公移山', 'yú gōng yí shān', 'Essai']);
  });

  it('un export sans vrai titre retombe sur le titre traduit', () => {
    expect(entreeConte(INDEX, CONTE, new Set()).titre_zh).toBe('');
  });

  it("les contes de l'export portent tous leur vrai titre, une syllabe par caractère", () => {
    const index = JSON.parse(readFileSync('public/data/0.1.0/index.json', 'utf8')) as { contes: IndexConte[] };
    expect(index.contes.length).toBeGreaterThan(0);
    for (const c of index.contes) {
      expect(c.titre_zh).toMatch(/^[\u4e00-\u9fff]+$/);
      expect(c.titre_pinyin?.split(' ').length).toBe(Array.from(c.titre_zh ?? '').length);
    }
  });
});


/* ---------- les niveaux prévus (catalogue) ---------- */

const PREVU: CatalogueConte = {
  id: 'essai',
  titre_zh: '守株待兔',
  titre_pinyin: 'shǒu zhū dài tù',
  titre_fr: 'Essai',
  niveaux: ['255', '405', '805'],
  chapitres: 1
};

const A_VENIR: CatalogueConte = {
  id: 'a-venir',
  titre_zh: '画蛇添足',
  titre_pinyin: 'huà shé tiān zú',
  titre_fr: 'À venir',
  niveaux: ['405', '805'],
  chapitres: 1
};

describe('les niveaux d’un conte', () => {
  it('écrit et ouvert, écrit mais fermé, pas encore écrit : rien n’est estimé', () => {
    const n = niveauxDuConte(PREVU.niveaux, INDEX.seuils, CONTE, tous(V255));
    expect(n).toEqual([
      { seuil: '255', etat: 'ouvert' },
      { seuil: '405', etat: 'ferme' },
      { seuil: '805', etat: 'a_ecrire' }
    ]);
  });

  it('un seuil que l’index annonce sans fichier lisible reste écrit mais fermé', () => {
    expect(niveauxDuConte(['255'], ['255'], null, new Set())).toEqual([{ seuil: '255', etat: 'ferme' }]);
  });

  it('un niveau prévu non écrit ne ferme pas le conte : la version écrite s’ouvre', () => {
    const e = entreeConte(INDEX, CONTE, tous(V255), [], false, PREVU);
    expect(e.version?.seuil).toBe('255');
    expect(e.ecrit).toBe(true);
    expect(e.niveaux.map((n) => n.etat)).toEqual(['ouvert', 'ferme', 'a_ecrire']);
  });

  it('la bibliothèque montre chaque conte du catalogue, les pas encore écrits en dernier', () => {
    const contes = new Map([[CONTE.id, CONTE]]);
    const b = bibliotheque([INDEX], contes, tous(V255), {}, false, [A_VENIR, PREVU]);
    expect(b.map((e) => e.id)).toEqual(['essai', 'a-venir']);
    const [, venir] = b;
    expect(venir.version).toBeNull();
    expect(venir.ecrit).toBe(false);
    expect(venir.titre_zh).toBe('画蛇添足');
    expect(venir.niveaux).toEqual([
      { seuil: '405', etat: 'a_ecrire' },
      { seuil: '805', etat: 'a_ecrire' }
    ]);
  });

  it('sans catalogue (export plus ancien), l’index seul, niveaux écrits', () => {
    const b = bibliotheque([INDEX], new Map([[CONTE.id, CONTE]]), tous(V255));
    expect(b[0].niveaux.map((n) => n.seuil)).toEqual(['255', '405']);
  });

  it('le catalogue de l’index se relit ; une entrée sans identifiant est écartée', () => {
    expect(
      lireCatalogueContes([
        { id: 'a', titre_zh: '山', titre_pinyin: 'shān', titre_fr: 'A', niveaux: ['hsk3', 805, 255, 255, 'HSK5', 'hsk10', 0], chapitres: 4 },
        { titre_fr: 'sans id' },
        { id: 'b', niveaux: 'x', chapitres: 0 }
      ])
    ).toEqual([
      { id: 'a', titre_zh: '山', titre_pinyin: 'shān', titre_fr: 'A', niveaux: ['255', '805', 'hsk3', 'hsk5'], chapitres: 4 },
      { id: 'b', titre_zh: '', titre_pinyin: '', titre_fr: '', niveaux: [], chapitres: 1 }
    ]);
    expect(lireCatalogueContes(undefined)).toEqual([]);
  });

  it('l’export porte le catalogue : chaque conte relu y a ses niveaux', () => {
    const index = JSON.parse(readFileSync('public/data/0.1.0/index.json', 'utf-8')) as Index;
    const catalogue = lireCatalogueContes(index.catalogue);
    expect(catalogue.length).toBeGreaterThanOrEqual(index.contes.length);
    for (const c of index.contes) {
      const prevu = catalogue.find((x) => x.id === c.id);
      expect(prevu, c.id).toBeDefined();
      for (const s of lireNiveaux(c.seuils)) expect(prevu?.niveaux).toContain(s);
    }
  });
});

/* ---------- les récits longs, chapitre par chapitre ---------- */

const LONGUE: VersionConte = {
  seuil: '405',
  titre: '人和兔',
  phrases: [],
  glose: { 人: 'homme', 和: 'et', 兔: 'lièvre', 天: 'jour', 大: 'grand', 山: 'montagne', 一: 'un' },
  chapitres: [
    { titre: '天', titre_pinyin: 'tiān', titre_fr: 'Le jour', phrases: [{ zh: '人和兔。', pinyin: 'rén hé tù', fr: 'Un homme et un lièvre.' }] },
    { titre: '大山', titre_pinyin: 'dà shān', titre_fr: 'La montagne', phrases: [{ zh: '一人。', pinyin: 'yī rén', fr: 'Un homme.' }] },
    { titre: '一', titre_pinyin: 'yī', titre_fr: 'Un', phrases: [{ zh: '人。', pinyin: 'rén', fr: 'Homme.' }] }
  ]
};

describe('un récit long', () => {
  it('se lit chapitre par chapitre ; une fable est un seul chapitre sans titre', () => {
    expect(estLongue(LONGUE)).toBe(true);
    expect(chapitresDe(LONGUE).map((c) => c.titre)).toEqual(['天', '大山', '一']);
    expect(estLongue(V255)).toBe(false);
    expect(chapitresDe(V255)).toEqual([{ titre: '', titre_pinyin: '', titre_fr: '', phrases: V255.phrases }]);
  });

  it('les titres des chapitres comptent dans ses caractères', () => {
    const v = { ...LONGUE, phrases: LONGUE.chapitres!.flatMap((c) => c.phrases) };
    expect(caracteresDeVersion(v)).toEqual(['人', '和', '兔', '天', '大', '山', '一']);
    const acquis = tous(v);
    acquis.delete('山');
    expect(manquants(v, acquis)).toEqual(['山']);
  });

  it('le titre d’un chapitre se touche, pinyin aligné', () => {
    const [ch] = chapitresDe(LONGUE).slice(1);
    expect(unitesDuChapitre(ch, LONGUE.glose).map((u) => [u.texte, u.pinyin])).toEqual([
      ['大', 'dà'],
      ['山', 'shān']
    ]);
  });

  it('se relit de l’export : ses chapitres, et leurs phrases à la suite', () => {
    const c = lireConte({
      conte: 'long',
      titre_fr: 'Long',
      versions: {
        '405': {
          titre: '人',
          chapitres: [
            { titre: '天', titre_pinyin: 'tiān', titre_fr: 'Le jour', phrases: [{ zh: '人。', pinyin: 'rén', fr: 'Homme.' }] },
            { titre: '空', phrases: [] },
            { titre: '大', titre_pinyin: 'dà', titre_fr: 'Grand', phrases: [{ zh: '大人。', pinyin: 'dà rén', fr: 'Adulte.' }] }
          ],
          glose: { 人: { pinyin: 'rén', fr: 'homme', en: 'man' } }
        }
      }
    });
    const [v] = c.versions;
    expect(v.chapitres?.map((x) => x.titre)).toEqual(['天', '大']);
    expect(v.phrases.map((p) => p.zh)).toEqual(['人。', '大人。']);
  });

  it('une fable exportée sans chapitres se relit comme avant (rétrocompatibilité)', () => {
    const brut = JSON.parse(readFileSync('public/data/0.1.0/contes/yu-gong-yi-shan.json', 'utf-8')) as unknown;
    const [v] = lireConte(brut).versions;
    expect(v.chapitres).toBeUndefined();
    expect(estLongue(v)).toBe(false);
    expect(chapitresDe(v)[0].phrases).toBe(v.phrases);
  });
});

describe('les chapitres lus et la reprise', () => {
  it('un chapitre non lu ne compte pas : le conte est lu quand tous le sont', () => {
    expect(tousLus([1, 3], 3)).toBe(false);
    expect(tousLus([3], 3)).toBe(false);
    expect(tousLus([1, 2, 3], 3)).toBe(true);
    expect(tousLus([], 0)).toBe(false);
  });

  it('on reprend au chapitre qui suit le dernier lu, puis au premier qui reste', () => {
    let l = lireChapitre(undefined, 1, 3);
    expect(l).toEqual({ lus: [1], reprise: 2 });
    l = lireChapitre(l, 3, 3);
    expect(l).toEqual({ lus: [1, 3], reprise: 2 });
    l = lireChapitre(l, 2, 3);
    expect(l).toEqual({ lus: [1, 2, 3], reprise: 1 });
    expect(chapitreDeReprise({ lus: [1], reprise: 2 }, 3)).toBe(2);
    expect(chapitreDeReprise(undefined, 3)).toBe(1);
    expect(chapitreDeReprise({ lus: [], reprise: 9 }, 3)).toBe(1);
  });

  it('la progression note chapitres et reprise, sans compter le conte avant la fin', () => {
    let p = emptyProgress('2026-09-25');
    p = noterChapitreLu(p, 'long', '405', 1, 3);
    p = noterChapitreLu(p, 'long', '405', 2, 3);
    expect(p.chapitres[cleLecture('long', '405')]).toEqual({ lus: [1, 2], reprise: 3 });
    expect(p.contesLus).toEqual({});
    expect(contesLus(p)).toBe(0);
    p = noterReprise(p, 'long', '405', 1);
    expect(p.chapitres['405/long'].reprise).toBe(1);
    expect(noterChapitreLu(p, 'long', '405', 4, 3)).toBe(p);
  });

  it('les chapitres en cours passent par l’export et l’import JSON', () => {
    let p = emptyProgress('2026-09-25');
    p = noterChapitreLu(p, 'long', '405', 1, 3);
    p = noterReprise(p, 'long', '405', 3);
    expect(fromJSON(toJSON(p), '2026-09-25').chapitres).toEqual({ '405/long': { lus: [1], reprise: 3 } });
    const ancien = JSON.parse(toJSON(p)) as Record<string, unknown>;
    delete ancien.chapitres;
    expect(fromJSON(JSON.stringify(ancien), '2026-09-25').chapitres).toEqual({});
  });

  it('un récit long au niveau HSK se reprend sous `hsk5/<conte>` ; une clé hors niveau est écartée', () => {
    let p = emptyProgress('2026-09-25');
    p = noterChapitreLu(p, 'mei-hou-wang', 'hsk5', 1, 4);
    const brut = JSON.parse(toJSON(p)) as { chapitres: Record<string, unknown> };
    brut.chapitres['hsk10/x'] = { lus: [1], reprise: 2 };
    brut.chapitres['hsk5/'] = { lus: [1], reprise: 2 };
    expect(fromJSON(JSON.stringify(brut), '2026-09-25').chapitres).toEqual({
      'hsk5/mei-hou-wang': { lus: [1], reprise: 2 }
    });
  });
});

/* ---------- les niveaux HSK ---------- */

describe('les niveaux HSK', () => {
  const VHSK3: VersionConte = { ...V405, seuil: 'hsk3' };
  const MIXTE: Conte = { ...CONTE, versions: [VHSK3, V255] };

  it('la version ouverte est celle du niveau le plus haut, par son nombre de caractères', () => {
    expect(versionLisible(MIXTE, union(V255, V405))?.seuil).toBe('hsk3');
    expect(versionLisible(MIXTE, tous(V255))?.seuil).toBe('255');
  });

  it('les niveaux d’un conte se rangent du seuil 255 au HSK, et le plus riche se signale', () => {
    const n = niveauxDuConte(['hsk5', '255', 'hsk3'], [], MIXTE, tous(V255));
    expect(n).toEqual([
      { seuil: '255', etat: 'ouvert' },
      { seuil: 'hsk3', etat: 'ferme' },
      { seuil: 'hsk5', etat: 'a_ecrire' }
    ]);
    const e = entreeConte({ ...INDEX, seuils: ['255', 'hsk3'] }, MIXTE, union(V255, V405), ['255']);
    expect(e.plusRiche).toBe(true);
    const ferme = entreeConte({ ...INDEX, seuils: ['hsk3', '255'] }, null, new Set());
    expect(ferme.attend).toBe('255');
  });
});

/* ---------- les mots expliqués ---------- */

describe('les mots expliqués', () => {
  const LOUP: MotConte = {
    zh: '狼',
    pinyin: 'láng',
    fr: 'loup',
    en: 'wolf',
    explication_fr: 'La bête qui prend les moutons.',
    explication_en: 'The beast that takes the sheep.',
    caracteres: '狼',
    pistes: ['犭']
  };
  /* Une fixture : le loup, hors du niveau, nommé en mot expliqué. */
  const VLOUP: VersionConte = {
    seuil: 'hsk4',
    titre: '人和狼',
    phrases: [{ zh: '一个人看见一只狼。', pinyin: 'yī ge rén kàn jiàn yī zhī láng', fr: 'Un homme voit un loup.' }],
    glose: { 一个: 'un', 人: 'homme', 看见: 'voir', 一只: 'un', 狼: 'loup', 和: 'et' },
    expliques: [LOUP]
  };
  const ACQUIS = new Set(Array.from('一个人看见只和'));

  it("un mot expliqué ne ferme pas un conte : il n'est pas dans ce qui manque", () => {
    expect(caracteresDeVersion(VLOUP)).toContain('狼');
    expect(manquants(VLOUP, ACQUIS)).toEqual([]);
    const conte: Conte = { ...CONTE, versions: [VLOUP] };
    expect(versionLisible(conte, ACQUIS)?.seuil).toBe('hsk4');
    expect(niveauxDuConte(['hsk4'], [], conte, ACQUIS)).toEqual([{ seuil: 'hsk4', etat: 'ouvert' }]);
    expect(entreeConte({ ...INDEX, seuils: ['hsk4'] }, conte, ACQUIS).horsAcquis).toBe(false);
  });

  it('un autre caractère hors de l’acquis ferme toujours le conte', () => {
    const sansHomme = new Set([...ACQUIS].filter((c) => c !== '人'));
    expect(manquants(VLOUP, sansHomme)).toEqual(['人']);
    const sansMot: VersionConte = { ...VLOUP, expliques: undefined };
    expect(manquants(sansMot, ACQUIS)).toEqual(['狼']);
    expect(versionLisible({ ...CONTE, versions: [sansMot] }, ACQUIS)).toBeNull();
  });

  it('seuls ses caractères hors du niveau sont dispensés : 公 de 叶公 reste à acquérir', () => {
    const ye: VersionConte = {
      ...VLOUP,
      titre: '叶公',
      phrases: [{ zh: '叶公爱龙。', pinyin: 'yè gōng ài lóng', fr: 'Monsieur Ye aime les dragons.' }],
      expliques: [{ ...LOUP, zh: '叶公', pinyin: 'yè gōng', caracteres: '叶' }]
    };
    expect(manquants(ye, new Set(['爱', '龙']))).toEqual(['公']);
    expect(manquants(ye, new Set(['爱', '龙', '公']))).toEqual([]);
  });

  it('dans le texte, le mot est marqué et sa glose dit « mot du conte »', () => {
    const us = unites(VLOUP.phrases[0], VLOUP.glose, caracteresExpliques(VLOUP));
    const loup = us.find((u) => u.texte === '狼');
    expect(loup?.explique).toBe(true);
    expect(us.filter((u) => u.explique)).toHaveLength(1);
    expect(ligneGlose({ pinyin: 'láng', sens: 'loup', explique: true })).toBe(`láng, loup · ${MENTION_MOT_DU_CONTE}`);
    expect(MENTION_MOT_DU_CONTE).toBe('mot du conte');
    expect(unitesDuTitre(VLOUP).find((u) => u.texte === '狼')?.explique).toBe(true);
  });

  it('la carte « Vocabulaire du conte » : tout en tête d’une fable, au premier chapitre qui le nomme d’un récit long', () => {
    expect(TITRE_VOCABULAIRE_DU_CONTE).toBe('Vocabulaire du conte');
    expect(motsDuChapitre(VLOUP, 1)).toEqual([LOUP]);
    const singe: MotConte = { ...LOUP, zh: '猴', caracteres: '猴' };
    const long: VersionConte = {
      ...VLOUP,
      titre: '人',
      expliques: [LOUP, singe],
      chapitres: [
        { titre: '人', titre_pinyin: 'rén', titre_fr: 'Un', phrases: [{ zh: '人看见狼。', pinyin: '', fr: '' }] },
        { titre: '狼', titre_pinyin: 'láng', titre_fr: 'Deux', phrases: [{ zh: '猴看见狼。', pinyin: '', fr: '' }] }
      ]
    };
    expect(motsDuChapitre(long, 1)).toEqual([LOUP]);
    expect(motsDuChapitre(long, 2)).toEqual([singe]);
  });

  it('se lisent dans l’export, avec les familles de leurs traits ; une version sans mot expliqué se lit comme avant', () => {
    const c = lireConte({
      conte: 'wang-yang-bu-lao',
      titre_fr: 'Essai',
      versions: {
        hsk4: {
          titre: '人和狼',
          phrases: VLOUP.phrases,
          glose: { 狼: { pinyin: 'láng', fr: 'loup', en: 'wolf' } },
          expliques: [{ ...LOUP, pistes: undefined }, { zh: '', caracteres: '' }]
        },
        hsk6: { titre: '人', phrases: VLOUP.phrases, glose: {} }
      },
      racines: { 狼: '犭' }
    });
    expect(c.versions[0].expliques).toEqual([LOUP]);
    expect('expliques' in c.versions[1]).toBe(false);
  });
});
