/**
 * L'écriture au doigt : les gabarits exportés (`public/data/0.1.0/ecriture/gabarits.json`) et
 * le moteur (`reconnaissance.ts`). Un test par règle. Les tracés viennent des médianes
 * d'origine des caractères que l'export dessine (`traits/`, pleine précision), jamais des
 * gabarits arrondis eux-mêmes, et sont déformés comme une main : penchés, écrasés, déplacés.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALPHABET, lireGabarits, NIVEAUX, POINTS, type Gabarits } from './gabarits';
import { CANDIDATS, preparer, reconnaitre, reechantillonner, type Point, type Trace } from './reconnaissance';

const EXPORT = new URL('../../../public/data/0.1.0/', import.meta.url);
const brut = JSON.parse(readFileSync(new URL('ecriture/gabarits.json', EXPORT), 'utf8')) as Record<
  string,
  unknown
>;
const g = lireGabarits(brut);

/** Les médianes d'origine des caractères que l'export dessine. */
const medianes = new Map<string, number[][][]>();
for (const f of readdirSync(new URL('traits/', EXPORT))) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(readFileSync(new URL(`traits/${f}`, EXPORT), 'utf8')) as {
    traits: Record<string, { m: number[][][] }>;
  };
  for (const [c, t] of Object.entries(d.traits)) medianes.set(c, t.m);
}

type Main = { echelle?: number; cisaillement?: number; etirement?: number; x?: number; y?: number };

/** Un caractère tracé sur un pavé de 300 px : penché, étiré, à sa place, quelques points par trait. */
function tracer(c: string, m: Main = {}): Point[][] {
  const { echelle = 0.26, cisaillement = 0.12, etirement = 1.15, x = 20, y = 30 } = m;
  const med = medianes.get(c);
  if (!med) throw new Error(`pas de médianes pour ${c}`);
  return med.map((tr) =>
    tr.map(([u, v]) => {
      const yy = 900 - v;
      return [x + echelle * (u * etirement + cisaillement * yy), y + echelle * yy] as Point;
    })
  );
}

const rang = (traces: readonly Trace[], c: string) => reconnaitre(g, traces).findIndex((x) => x.c === c);

describe('gabarits', () => {
  it('portent les 3 000 caractères du HSK 3.0, niveau par niveau', () => {
    expect(g.caracteres).toHaveLength(3000);
    expect(new Set(g.caracteres).size).toBe(3000);
    expect(g.niveau[0]).toBe(1);
    expect(g.niveau[299]).toBe(1);
    expect(g.niveau[300]).toBe(2);
    expect(g.niveau[2999]).toBe(7);
  });

  it('autant de traits que les médianes, en POINTS points chacun, dans la boîte [-0,5 ; 0,5]', () => {
    for (const c of ['一', '口', '好', '我']) {
      const i = g.caracteres.indexOf(c);
      expect(g.debut[i + 1] - g.debut[i], c).toBe(medianes.get(c)!.length);
    }
    expect(g.points.length).toBe(g.debut[g.caracteres.length] * POINTS * 2);
    for (const v of g.points) expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
  });

  it('un cran par signe base64 : le premier et le dernier bornent la boîte', () => {
    expect(ALPHABET).toHaveLength(NIVEAUX);
    const sous = {
      ...brut,
      caracteres: '一',
      traits: ALPHABET[1],
      gabarits: 'A'.repeat(POINTS * 2 - 1) + '_',
      listes: [['hsk-1', 1]]
    };
    const un = lireGabarits(sous);
    expect(un.points[0]).toBeCloseTo(-0.5);
    expect(un.points[POINTS * 2 - 1]).toBeCloseTo(0.5);
  });

  it('refusent un autre format plutôt que de deviner', () => {
    expect(() => lireGabarits({ ...brut, format: { points: 6, niveaux: 64, alphabet: ALPHABET } })).toThrow();
    expect(() => lireGabarits({ ...brut, gabarits: String(brut.gabarits).slice(1) })).toThrow();
    expect(() => lireGabarits({ ...brut, gabarits: '*' + String(brut.gabarits).slice(1) })).toThrow();
  });
});

describe('préparation du tracé', () => {
  it('rééchantillonne un trait à POINTS points également espacés, extrémités gardées', () => {
    /* un geste droit, aux événements serrés au début, espacés à la fin */
    const p = reechantillonner([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [70, 0]
    ]);
    expect(p).toHaveLength(POINTS);
    expect(p[0]).toEqual([0, 0]);
    expect(p[POINTS - 1][0]).toBeCloseTo(70);
    for (let i = 1; i < POINTS; i++) expect(p[i][0] - p[i - 1][0]).toBeCloseTo(70 / (POINTS - 1), 4);
  });

  it('un point touché sans glisser reste un point', () => {
    expect(new Set(reechantillonner([[5, 5]]).map((q) => q.join()))).toEqual(new Set(['5,5']));
  });

  it('normalise : ni la taille ni la place du tracé ne changent rien', () => {
    const a = tracer('好');
    const b = a.map((t) => t.map(([x, y]) => [3 * x + 500, 3 * y - 40] as Point));
    const pa = preparer(a);
    const pb = preparer(b);
    for (let i = 0; i < pa.points.length; i++) expect(pb.points[i]).toBeCloseTo(pa.points[i], 5);
    expect(reconnaitre(g, b).map((x) => x.c)).toEqual(reconnaitre(g, a).map((x) => x.c));
  });

  it('écarte les traits vides', () => {
    expect(preparer([[], ...tracer('人'), []]).n).toBe(2);
  });
});

describe('reconnaissance', () => {
  const COURANTS = [...'人大口日月好我字学中国水火山木女子马门车书天下上小心手耳目生'];

  it('trouve en premier chaque caractère tracé depuis ses médianes, penché et étiré', () => {
    const rates = COURANTS.filter((c) => rang(tracer(c), c) !== 0);
    expect(rates).toEqual([]);
  });

  it('rend au plus CANDIDATS candidats, du plus proche au moins proche', () => {
    const l = reconnaitre(g, tracer('学'));
    expect(l).toHaveLength(CANDIDATS);
    for (let i = 1; i < l.length; i++) expect(l[i].score).toBeGreaterThanOrEqual(l[i - 1].score);
    expect(reconnaitre(g, tracer('学'), 3)).toEqual(l.slice(0, 3));
  });

  it('candidats stables : le même tracé donne les mêmes candidats, dans le même ordre', () => {
    const a = tracer('国');
    const premiers = reconnaitre(g, a);
    reconnaitre(g, tracer('水'));
    expect(reconnaitre(g, a)).toEqual(premiers);
  });

  it("un tracé vide n'a aucun candidat", () => {
    expect(reconnaitre(g, [])).toEqual([]);
    expect(reconnaitre(g, [[]])).toEqual([]);
  });

  it("tolère l'ordre des traits : deux traits inversés", () => {
    const t = tracer('好');
    [t[0], t[3]] = [t[3], t[0]];
    expect(rang(t, '好')).toBe(0);
    const u = tracer('国');
    [u[1], u[2]] = [u[2], u[1]];
    expect(rang(u, '国')).toBe(0);
  });

  it('tolère un trait en moins', () => {
    for (const c of ['我', '国', '学']) {
      const t = tracer(c);
      t.splice(2, 1);
      expect(rang(t, c), c).toBeGreaterThanOrEqual(0);
      expect(rang(t, c), c).toBeLessThan(5);
    }
  });

  it('tolère un trait en trop', () => {
    const t = tracer('我');
    t.push([
      [150, 250],
      [158, 256]
    ]);
    expect(rang(t, '我')).toBeGreaterThanOrEqual(0);
    expect(rang(t, '我')).toBeLessThan(5);
  });

  it("tolère deux traits liés d'un seul geste", () => {
    for (const [c, i] of [
      ['口', 1],
      ['日', 2],
      ['学', 5]
    ] as const) {
      const t = tracer(c);
      t.splice(i, 2, [...t[i], ...t[i + 1]]);
      expect(rang(t, c), c).toBeGreaterThanOrEqual(0);
      expect(rang(t, c), c).toBeLessThan(5);
    }
  });

  it('tolère un trait tracé à rebours', () => {
    const t = tracer('天');
    t[3] = [...t[3]].reverse();
    expect(rang(t, '天')).toBe(0);
  });

  it('recale une main très penchée et écrasée', () => {
    for (const c of ['我', '学', '国']) {
      expect(rang(tracer(c, { cisaillement: -0.35, etirement: 0.7 }), c), c).toBe(0);
    }
  });

  it("s'affine trait après trait : le début d'un caractère propose ceux qui commencent ainsi", () => {
    /* 女 tracé seul : 女 d'abord, et déjà les caractères qui commencent par lui */
    const seul = reconnaitre(g, tracer('女')).map((x) => x.c);
    expect(seul[0]).toBe('女');
    expect(seul.slice(1).some((c) => '好妈她姐妹奶如'.includes(c))).toBe(true);
    /* les trois premiers traits de 好, étroits à gauche comme dans 好 : 好 déjà proposé */
    const t = tracer('好');
    const apres3 = reconnaitre(g, t.slice(0, 3)).map((x) => x.c);
    expect(apres3.slice(0, 3)).toContain('好');
    /* chaque trait de plus : 好 reste proposé, et finit premier */
    for (let k = 3; k <= t.length; k++)
      expect(rang(t.slice(0, k), '好'), `${k} traits`).toBeGreaterThanOrEqual(0);
    expect(reconnaitre(g, t)[0].c).toBe('好');
  });

  it('à tracé égal, le caractère du niveau le plus bas passe devant', () => {
    /* deux gabarits identiques : l'un au HSK 1, l'autre au HSK 7 */
    const i = g.caracteres.indexOf('人');
    const pts = g.points.slice(g.debut[i] * POINTS * 2, g.debut[i + 1] * POINTS * 2);
    const deux: Gabarits = {
      caracteres: ['乙', '甲'],
      niveau: Uint8Array.from([7, 1]),
      debut: Uint32Array.from([0, 2, 4]),
      points: Float32Array.from([...pts, ...pts])
    };
    expect(reconnaitre(deux, tracer('人')).map((x) => x.c)).toEqual(['甲', '乙']);
  });

  it('se met à jour en moins de 50 ms, même sur un caractère de douze traits', () => {
    const t = tracer('道');
    expect(t).toHaveLength(12);
    for (let k = 0; k < 3; k++) reconnaitre(g, t);
    const a = performance.now();
    for (let k = 0; k < 10; k++) reconnaitre(g, t);
    expect((performance.now() - a) / 10).toBeLessThan(50);
  });
});
