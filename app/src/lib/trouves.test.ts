/**
 * Les caractères trouvés en chemin : celui que l'anecdote d'une fête ou d'un terme solaire
 * fait découvrir. Une règle par test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FETES, loadFetes, loadSaisons, type Fetes, type Saisons } from './content';
import { journee } from './saisons';
import { emptyProgress, fromJSON, toJSON, type Progress } from './session';
import {
  collection,
  leJour,
  ligneTrouve,
  lireTrouves,
  montrerCollection,
  noterTrouve,
  rencontreDuJour,
  type Trouve
} from './trouves';

/* Les fichiers servis avec l'app, tels que `wenlu export` les écrit. */
const lire = (f: string): string => readFileSync(new URL(`../../public/data/0.1.0/${f}`, import.meta.url), 'utf8');
const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

function repondre(corps: string): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => JSON.parse(corps) })) as unknown as typeof fetch;
}

const fetes: Fetes = await loadFetes('data/0.1.0/fetes.json', repondre(lire('fetes.json')));
const saisons: Saisons = await loadSaisons('data/0.1.0/saisons.json', repondre(lire('saisons.json')));

const JOUR = '2026-09-25';
const vide = (): Progress => emptyProgress(JOUR);
const rencontre = (jour: string) => rencontreDuJour(journee(fetes, saisons, jour), {}, jour);

describe("la rencontre du jour : le caractère que l'anecdote fait découvrir", () => {
  it('un jour de fête, le caractère bonus de la fête (月 à la mi-automne, 25 septembre 2026)', () => {
    expect(rencontre('2026-09-25')).toEqual({ c: '月', fete: 'zhongqiu' });
    /* chaque jour de la fenêtre : la veille de la mi-automne aussi */
    expect(rencontre('2026-09-24')).toEqual({ c: '月', fete: 'zhongqiu' });
  });

  it("le jour où un terme commence, son caractère à lire (寒 à 寒露, 8 octobre 2026)", () => {
    expect(rencontre('2026-10-08')).toEqual({ c: '寒', terme: 'hanlu' });
  });

  it("les autres jours d'un terme, et un jour ordinaire, rien", () => {
    expect(rencontre('2026-10-10')).toBeNull();
    expect(rencontreDuJour({ fete: null, terme: null, theme: { fete: null, saison: null } }, {}, JOUR)).toBeNull();
  });

  it('la fête garde la priorité sur le terme qui commence le même jour (清明 2027 : 雨, pas 明)', () => {
    expect(rencontre('2027-04-05')).toEqual({ c: '雨', fete: 'qingming' });
  });
});

describe('noter un caractère trouvé', () => {
  it('il est gardé avec sa journée et sa fête ou son terme', () => {
    const p = noterTrouve(vide(), { c: '月', fete: 'zhongqiu' }, '2026-09-25');
    expect(p.trouves).toEqual([{ c: '月', jour: '2026-09-25', fete: 'zhongqiu' }]);
    const q = noterTrouve(p, { c: '寒', terme: 'hanlu' }, '2026-10-08');
    expect(q.trouves[1]).toEqual({ c: '寒', jour: '2026-10-08', terme: 'hanlu' });
  });

  it('un caractère compte une fois : trouvé de nouveau, il garde sa première journée et sa source', () => {
    const a = noterTrouve(vide(), { c: '冬', terme: 'lidong' }, '2026-11-07');
    const b = noterTrouve(a, { c: '冬', fete: 'dongzhi' }, '2026-12-22');
    expect(b).toBe(a);
    expect(b.trouves).toEqual([{ c: '冬', jour: '2026-11-07', terme: 'lidong' }]);
    /* la mi-automne dure cinq jours : l'anecdote revient, le caractère reste unique */
    const c = noterTrouve(noterTrouve(vide(), rencontre('2026-09-24'), '2026-09-24'), rencontre('2026-09-25'), '2026-09-25');
    expect(c.trouves.map((t) => t.c)).toEqual(['月']);
    expect(c.trouves[0].jour).toBe('2026-09-24');
  });

  it("rien à noter un jour sans rencontre, ni avec une journée illisible : l'état est rendu tel quel", () => {
    const p = vide();
    expect(noterTrouve(p, null, JOUR)).toBe(p);
    expect(noterTrouve(p, { c: '', fete: 'zhongqiu' }, JOUR)).toBe(p);
    expect(noterTrouve(p, { c: '月', fete: 'zhongqiu' }, 'demain')).toBe(p);
  });

  it("un caractère trouvé n'est pas une brique : aucune carte FSRS, rien en révision", () => {
    const p = vide();
    const q = noterTrouve(p, { c: '月', fete: 'zhongqiu' }, JOUR);
    expect(q.cartes).toBe(p.cartes);
    expect(q.cartes).toHaveLength(0);
    expect(q.due).toBe(p.due);
    expect(q.revue).toEqual(p.revue);
  });

  it('App note la rencontre du jour quand l’anecdote est lue ou passée', () => {
    const app = source('../App.svelte');
    expect(app).toContain('p = noterTrouve(anecdoteFaite(p, p.day), rencontreDuJour(laJournee, p.fetesVues, p.day), p.day);');
  });
});

describe("l'export et l'import de la progression", () => {
  const trouves: Trouve[] = [
    { c: '露', jour: '2026-09-07', terme: 'bailu' },
    { c: '月', jour: '2026-09-25', fete: 'zhongqiu' }
  ];

  it('les caractères trouvés font l’aller-retour, dans l’ordre', () => {
    const p = { ...vide(), trouves };
    expect(fromJSON(toJSON(p), JOUR).trouves).toEqual(trouves);
  });

  it("un export plus ancien, sans le champ, se relit sans caractère trouvé", () => {
    const ancien = JSON.parse(toJSON(vide())) as Record<string, unknown>;
    delete ancien.trouves;
    expect(fromJSON(JSON.stringify(ancien), JOUR).trouves).toEqual([]);
  });

  it('une entrée aberrante est écartée, un doublon garde la première', () => {
    expect(
      lireTrouves([
        { c: '月', jour: '2026-09-25', fete: 'zhongqiu' },
        { c: '月', jour: '2026-10-01', terme: 'qiufen' },
        { c: '龙', jour: '2026-06-19', fete: 'dragon' },
        { c: '', jour: '2026-09-25', fete: 'zhongqiu' },
        { c: '霜', jour: 'hier', terme: 'shuangjiang' },
        { c: '雪', jour: '2026-11-22' },
        'n',
        null
      ])
    ).toEqual([{ c: '月', jour: '2026-09-25', fete: 'zhongqiu' }]);
    expect(lireTrouves('rien')).toEqual([]);
  });
});

describe('la collection « trouvés en chemin » de Ma forêt', () => {
  it('chaque caractère porte son pinyin, son sens, et le nom de sa fête ou de son terme', () => {
    const pieces = collection(
      [
        { c: '露', jour: '2026-09-07', terme: 'bailu' },
        { c: '月', jour: '2026-09-25', fete: 'zhongqiu' }
      ],
      fetes,
      saisons
    );
    expect(pieces.map((x) => [x.c, x.pinyin, x.source, x.nomZh])).toEqual([
      ['露', 'lù', 'terme', '白露'],
      ['月', 'yuè', 'fete', '中秋节']
    ]);
    expect(ligneTrouve(pieces[0])).toBe('白露, la rosée blanche, le 7 septembre 2026');
    expect(ligneTrouve(pieces[1])).toBe(`${fetes.fetes.zhongqiu?.nom} 中秋节, le 25 septembre 2026`);
    /* les traits se trouvent par la famille que le contenu nomme */
    expect(pieces[0].pistes).toEqual(['雨']);
    expect(pieces[1].pistes).toEqual(['月']);
  });

  it("chaque fête et chaque terme du contenu a son caractère dans la collection", () => {
    const tous: Trouve[] = [
      ...FETES.map((id) => ({ c: fetes.fetes[id]?.anecdote.c ?? '', jour: JOUR, fete: id })),
      ...Object.entries(saisons.termes).map(([id, t]) => ({ c: t.caractere.c, jour: JOUR, terme: id }))
    ];
    const pieces = collection(tous, fetes, saisons);
    expect(pieces).toHaveLength(tous.length);
    for (const x of pieces) {
      expect(x.pinyin, x.c).not.toBe('');
      expect(x.sens, x.c).not.toBe('');
    }
  });

  it("montrée seulement une fois un caractère trouvé, et jamais avec un nom inventé", () => {
    expect(montrerCollection(collection([], fetes, saisons))).toBe(false);
    /* un terme ou une fête que le contenu ne porte plus ne s'affiche pas */
    expect(collection([{ c: '雷', jour: JOUR, terme: 'inconnu' }], fetes, saisons)).toEqual([]);
    /* contenu pas encore lu : rien */
    expect(collection([{ c: '月', jour: JOUR, fete: 'zhongqiu' }], null, null)).toEqual([]);
    expect(montrerCollection(collection([{ c: '月', jour: JOUR, fete: 'zhongqiu' }], fetes, saisons))).toBe(true);
  });

  it('Ma forêt dessine chaque caractère depuis ses traits, le dit au toucher, sous condition', () => {
    const foret = source('Forest.svelte');
    expect(foret).toContain('{#if montrerCollection(pieces)}');
    expect(foret).toContain('<Glyph char={x.c} size={40} write={x.c === touche} pistes={x.pistes} />');
    expect(foret).toContain('void dire(x.c);');
    expect(foret).toContain('collection(p.trouves, fetes, saisons)');
  });

  it('la date se dit en toutes lettres', () => {
    expect(leJour('2026-10-01')).toBe('le 1er octobre 2026');
    expect(leJour('2026-13-01')).toBe('');
  });
});
