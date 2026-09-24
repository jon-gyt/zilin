/**
 * Le mode Lire, un test par règle (backlog 2c.1, 2c.2). Les contes ci-dessous sont des
 * fixtures de test, écrites pour exercer les règles : l'app n'en contient aucun, tout
 * conte lu à l'exécution vient de l'export (`contes/<id>.json`, `data/schema.md`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Conte, Index, IndexConte, VersionConte } from './content';
import { emptyProgress, noterActivite, noterConteLu } from './session';
import { POIDS, posture } from './tao';
import { tropheesContes } from './trophees';
import {
  bibliotheque,
  caracteresAcquis,
  caracteresDeVersion,
  entreeConte,
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
  seuil: 255,
  titre: '人和兔',
  phrases: [
    { zh: '一个人看见一只兔。', pinyin: 'Yí gè rén kànjiàn yì zhī tù.', fr: 'Un homme voit un lièvre.' }
  ],
  glose: { 一: 'un', 个: 'classificateur', 人: 'homme', 看: 'regarder', 见: 'voir', 看见: 'apercevoir', 只: 'classificateur', 兔: 'lièvre', 和: 'et' }
};

const V405: VersionConte = {
  seuil: 405,
  titre: '人和兔子',
  phrases: [
    { zh: '农夫天天等兔子。', pinyin: 'Nóngfū tiāntiān děng tùzi.', fr: 'Le paysan attend le lièvre.' },
    { zh: '兔子没来！', pinyin: 'Tùzi méi lái!', fr: 'Le lièvre ne vient pas.' }
  ],
  glose: { 人: 'homme', 和: 'et', 兔: 'lièvre', 子: 'suffixe', 兔子: 'lièvre', 农: 'agriculture', 夫: 'homme', 天: 'jour', 等: 'attendre', 没: 'ne pas', 来: 'venir' }
};

const CONTE: Conte = { version: '0.1.0', source: 'test', id: 'essai', titre_fr: 'Essai', versions: [V255, V405] };
const INDEX: IndexConte = { id: 'essai', titre_fr: 'Essai', seuils: [255, 405], fichier: 'contes/essai.json' };

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
    const v: VersionConte = { seuil: 255, titre: '天', phrases: [{ zh: '人，大 3。', pinyin: '', fr: '' }], glose: {} };
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
    expect(versionLisible(CONTE, union(V255, V405))?.seuil).toBe(405);
    expect(versionLisible(CONTE, tous(V255))?.seuil).toBe(255);
  });

  it('un seul caractère manquant ferme sa version, pas les autres', () => {
    const acquis = union(V255, V405);
    acquis.delete('等');
    expect(versionLisible(CONTE, acquis)?.seuil).toBe(255);
  });
});

describe('un conte sans version lisible', () => {
  it('est fermé, avec le seuil qu’il attend et ce qu’il reste à acquérir', () => {
    const acquis = tous(V255);
    acquis.delete('兔');
    acquis.delete('只');
    const e = entreeConte(INDEX, CONTE, acquis);
    expect(e.version).toBeNull();
    expect(e.attend).toBe(255);
    expect(e.reste).toBe(2);
    expect(e.plusRiche).toBe(false);
  });

  it("sans fichier lisible, il attend le plus bas seuil de l'index, sans rien estimer", () => {
    const e = entreeConte({ ...INDEX, seuils: [405, 255] }, null, union(V255, V405));
    expect(e.version).toBeNull();
    expect(e.attend).toBe(255);
    expect(e.reste).toBe(0);
  });
});

describe('une version plus riche (2c.2)', () => {
  const acquis = union(V255, V405);

  it("est signalée quand la version ouverte dépasse toutes celles qu'on a lues", () => {
    const e = entreeConte(INDEX, CONTE, acquis, [255]);
    expect(e.version?.seuil).toBe(405);
    expect(e.plusRiche).toBe(true);
    expect(e.lue).toBe(false);
  });

  it("ne l'est pas pour un conte jamais lu : tout y est neuf", () => {
    expect(entreeConte(INDEX, CONTE, acquis, []).plusRiche).toBe(false);
  });

  it("ne l'est plus une fois cette version lue", () => {
    const e = entreeConte(INDEX, CONTE, acquis, [255, 405]);
    expect(e.plusRiche).toBe(false);
    expect(e.lue).toBe(true);
  });
});

describe('le marqueur gratuit', () => {
  it("se lit dans l'index et ne ferme ni n'ouvre aucun conte", () => {
    const ouvert = entreeConte({ ...INDEX, gratuit: false }, CONTE, tous(V255));
    const ferme = entreeConte({ ...INDEX, gratuit: true }, CONTE, new Set());
    expect(ouvert.gratuit).toBe(false);
    expect(ouvert.version?.seuil).toBe(255);
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
      { ...INDEX, id: 'autre', titre_fr: 'Autre', seuils: [405] },
      INDEX,
      { ...INDEX, id: 'absent', titre_fr: 'Absent', seuils: [255] }
    ];
    const contes = new Map([
      ['essai', CONTE],
      ['autre', autre]
    ]);
    const b = bibliotheque(index, contes, tous(V255), { essai: [255] });
    expect(b.map((e) => e.id)).toEqual(['essai', 'autre', 'absent']);
    expect(b[0].lue).toBe(true);
    expect(b[1].attend).toBe(405);
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
    const p = noterActivite(noterConteLu(avant, 'essai', 255), avant.day, 'conte');
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
    expect(src).not.toMatch(/import Glyph|<Glyph/);
    expect(src).toContain('class="read');
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
