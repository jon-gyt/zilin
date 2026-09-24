import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  NOTER_APRES_ERREUR,
  SANS_WECHAT,
  choisirReplique,
  dialoguesJouables,
  grappes,
  jetons,
  jouable,
  lireWechat,
  mancheWechat,
  manquants,
  prochains,
  toursWechat,
  type Wechat,
  type WechatDonnees
} from './wechat';
import { IDS, JEUX, corpusDeJeu, disponibles, fini, postureDuJeu } from './jeux';
import { SEUIL_DEBLOCAGE, grade } from './srs';
import { VERSION_DONNEES, type Foret } from './content';

/* ---------- deux petits dialogues, en dur : aucun réseau ---------- */

const t = (zh: string, pinyin: string, syllabes: string[], fr = '') => ({ zh, pinyin, fr, en: fr, syllabes });

const BRUT = {
  version: '0.9.0',
  source: 'test',
  ami: { zh: '大明', pinyin: 'Dàmíng', fr: 'ton ami', en: 'your friend' },
  dialogues: [
    {
      id: 'zao',
      cle: '早',
      famille: '日',
      fr: 'Salut',
      en: 'Morning',
      echanges: [
        {
          ami: t('早！', 'Zǎo!', ['zǎo'], 'Salut !'),
          repliques: [
            { ...t('早！', 'Zǎo!', ['zǎo'], 'Salut !'), juste: true },
            { ...t('明天见！', 'Míngtiān jiàn!', ['míng', 'tiān', 'jiàn'], 'À demain !'), juste: false, erreur: 'contresens' },
            { ...t('我喝茶。', 'Wǒ hē chá.', ['wǒ', 'hē', 'chá'], 'Je bois du thé.'), juste: false, erreur: 'hors-sujet' }
          ],
          notes: ['早']
        },
        {
          ami: t('明天见？', 'Míngtiān jiàn?', ['míng', 'tiān', 'jiàn']),
          repliques: [
            { ...t('好，明天见！', 'Hǎo, míngtiān jiàn!', ['hǎo', 'míng', 'tiān', 'jiàn']), juste: true },
            { ...t('早！', 'Zǎo!', ['zǎo']), juste: false, erreur: 'contresens' },
            { ...t('我喝茶。', 'Wǒ hē chá.', ['wǒ', 'hē', 'chá']), juste: false, erreur: 'hors-sujet' }
          ],
          notes: ['好', '明', '天', '见']
        }
      ],
      fin: t('好！', 'Hǎo!', ['hǎo']),
      caracteres: ['早', '明', '天', '见', '我', '喝', '茶', '好'],
      jours: { hsk: 30, lire: 12 }
    },
    {
      id: 'cha',
      cle: '茶',
      famille: '艹',
      fr: 'Le thé',
      en: 'Tea',
      echanges: [
        {
          ami: t('喝茶？', 'Hē chá?', ['hē', 'chá']),
          repliques: [
            { ...t('好，喝茶！', 'Hǎo, hē chá!', ['hǎo', 'hē', 'chá']), juste: true },
            { ...t('好，吃菜！', 'Hǎo, chī cài!', ['hǎo', 'chī', 'cài']), juste: false, erreur: 'contresens' }
          ],
          notes: ['好', '喝', '茶']
        }
      ],
      fin: null,
      caracteres: ['喝', '茶', '好', '吃', '菜'],
      jours: { hsk: 40, lire: 50 }
    }
  ],
  racines: { 早: '日', 茶: '艹' }
};

const DONNEES: WechatDonnees = lireWechat(BRUT);
const ZAO = DONNEES.dialogues[0];
const CHA = DONNEES.dialogues[1];
const TOUT = [...new Set([...ZAO.caracteres, ...CHA.caracteres])];

function wechat(acquis: readonly string[], parcours: string | null = 'lire'): Wechat {
  return { donnees: DONNEES, acquis, parcours };
}

/* ---------- l'export ---------- */

describe('wechat.json', () => {
  it('se lit, et un dialogue mal formé tombe', () => {
    expect(DONNEES.dialogues.map((d) => d.id)).toEqual(['zao', 'cha']);
    expect(DONNEES.ami.zh).toBe('大明');
    const sansJuste = structuredClone(BRUT);
    sansJuste.dialogues[1].echanges[0].repliques[0].juste = false;
    expect(lireWechat(sansJuste).dialogues.map((d) => d.id)).toEqual(['zao']);
    /* Des syllabes qui ne tombent pas juste sont oubliées : la bulle montre la ligne entière. */
    const bancal = structuredClone(BRUT);
    bancal.dialogues[0].echanges[0].ami.syllabes = ['zǎo', 'de trop'];
    expect(lireWechat(bancal).dialogues[0].echanges[0].ami.syllabes).toEqual([]);
    expect(lireWechat(null)).toEqual(SANS_WECHAT);
  });

  it('est exporté, nommé par l’index, et chaque dialogue se lit', () => {
    const brut = JSON.parse(
      readFileSync(new URL(`../../public/data/${VERSION_DONNEES}/wechat.json`, import.meta.url), 'utf8')
    ) as { dialogues: unknown[] };
    const lu = lireWechat(brut);
    expect(lu.dialogues).toHaveLength(brut.dialogues.length);
    expect(lu.dialogues.length).toBeGreaterThanOrEqual(40);
    expect(lu.dialogues.length).toBeLessThanOrEqual(60);
    const index = JSON.parse(
      readFileSync(new URL(`../../public/data/${VERSION_DONNEES}/index.json`, import.meta.url), 'utf8')
    ) as { wechat: string };
    expect(index.wechat).toBe('wechat.json');
    for (const d of lu.dialogues) {
      expect(d.echanges.length).toBeGreaterThanOrEqual(2);
      expect(d.echanges.length).toBeLessThanOrEqual(4);
      for (const e of d.echanges) {
        /* Trois ou quatre répliques, une seule bonne, chacune avec le pinyin de ses caractères. */
        expect(e.repliques.length).toBeGreaterThanOrEqual(3);
        expect(e.repliques.length).toBeLessThanOrEqual(4);
        expect(e.repliques.filter((r) => r.juste)).toHaveLength(1);
        for (const r of [e.ami, ...e.repliques]) expect(r.syllabes.length).toBeGreaterThan(0);
      }
    }
    /* L'exemple de docs/jeux.md. */
    const bonnes = lu.dialogues.flatMap((d) =>
      d.echanges.map((e) => `${e.ami.zh}→${e.repliques.find((r) => r.juste)?.zh}`)
    );
    expect(bonnes).toContain('你好吗？→我很好，你呢？');
  });
});

/* ---------- ce qui se lit ---------- */

describe('les dialogues ouverts', () => {
  it('demandent tous leurs caractères, les mauvaises répliques comprises', () => {
    /* 我, 喝, 茶 ne sont que dans une mauvaise réplique de zao : on les lit pour l'écarter. */
    const sansThe = ZAO.caracteres.filter((c) => c !== '茶');
    expect(jouable(ZAO, sansThe)).toBe(false);
    expect(manquants(ZAO, sansThe)).toEqual(['茶']);
    expect(jouable(ZAO, ZAO.caracteres)).toBe(true);
  });

  it('passent le plus récent du parcours d’abord', () => {
    expect(dialoguesJouables(wechat(TOUT, 'lire')).map((d) => d.id)).toEqual(['cha', 'zao']);
    expect(dialoguesJouables(wechat(TOUT, 'hsk')).map((d) => d.id)).toEqual(['cha', 'zao']);
    expect(dialoguesJouables(wechat(ZAO.caracteres)).map((d) => d.id)).toEqual(['zao']);
    expect(prochains(wechat(ZAO.caracteres)).map((d) => d.id)).toEqual(['cha']);
  });

  it('lisent l’acquis réel, jamais la démonstration de la forêt', () => {
    const foret = {
      familles: [{ c: '茶', pinyin: 'chá', fr: 'thé', avancement: 1, membres: [] }]
    } as unknown as Foret;
    const demo = corpusDeJeu({ foret, cartes: [], wechat: DONNEES });
    expect(demo.acquis).toContain('茶');
    expect(demo.wechat?.acquis).toEqual([]);
    expect(disponibles(demo, 'g')).not.toContain('wechat');

    const cartes = CHA.caracteres.map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE }));
    const vrai = corpusDeJeu({ cartes, wechat: DONNEES, parcours: 'lire' });
    expect(JEUX.wechat.preparer(vrai, 'g')?.tours).toHaveLength(CHA.echanges.length);
    expect(IDS).toContain('wechat');
  });

  it('se taisent sans wechat.json', () => {
    expect(JEUX.wechat.preparer(corpusDeJeu({ cartes: [] }), 'g')).toBeNull();
  });
});

/* ---------- la conversation ---------- */

describe('la conversation', () => {
  it('pose un tour par échange, répliques mélangées d’après la graine', () => {
    const tours = toursWechat(ZAO, 'g');
    expect(tours).toHaveLength(2);
    expect(tours[1].enonce).toBe('明天见？');
    expect(tours[1].reponse).toEqual(['好，明天见！']);
    expect(tours[1].c).toBe('好');
    expect(tours[1].aussi).toEqual(['明', '天', '见']);
    expect([...tours[0].choix].sort()).toEqual(['早！', '明天见！', '我喝茶。'].sort());
    expect(toursWechat(ZAO, 'g')).toEqual(tours);
  });

  it('une mauvaise réplique est écartée, sans aucun événement noté', () => {
    const m = mancheWechat(ZAO, 'g');
    const r = choisirReplique(m, '明天见！', [], 3);
    expect(r.juste).toBe(false);
    expect(r.evenements).toEqual([]);
    expect(r.ecartees).toEqual(['明天见！']);
    expect(r.manche).toBe(m);
    /* Une réplique déjà écartée ne compte plus. */
    expect(choisirReplique(m, '明天见！', r.ecartees, 4).ecartees).toEqual(['明天见！']);
  });

  it('une bonne réplique du premier coup note ses caractères par grade', () => {
    const m = mancheWechat(ZAO, 'g');
    const r = choisirReplique(m, '早！', [], 3);
    expect(r.juste).toBe(true);
    expect(r.evenements).toEqual([{ c: '早', correct: true, tries: 0, seconds: 3, leurres: [] }]);
    expect(grade(r.evenements[0])).toBe(Rating.Easy);
    const lent = choisirReplique(r.manche, '好，明天见！', [], 12);
    expect(lent.evenements.map((e) => e.c)).toEqual(['好', '明', '天', '见']);
    expect(grade(lent.evenements[0])).toBe(Rating.Good);
    expect(fini(lent.manche)).toBe(true);
    expect(lent.manche.trouves).toBe(2);
    expect(JEUX.wechat.constat(lent.manche)).toBe(
      '5 caractères revus, 2 répliques trouvées du premier coup.'
    );
  });

  it('une bonne réplique trouvée après une erreur ne note rien non plus', () => {
    expect(NOTER_APRES_ERREUR).toBe(false);
    const m = mancheWechat(CHA, 'g');
    const faux = choisirReplique(m, '好，吃菜！', [], 2);
    const r = choisirReplique(faux.manche, '好，喝茶！', faux.ecartees, 5);
    expect(r.juste).toBe(true);
    expect(r.evenements).toEqual([]);
    expect(fini(r.manche)).toBe(true);
    expect(r.manche.trouves).toBe(0);
    expect(JEUX.wechat.constat(r.manche)).toBe('Rien de revu cette fois.');
  });

  it('montre le pinyin de chaque caractère, la ponctuation n’en a pas', () => {
    expect(jetons(ZAO.echanges[1].repliques[0])).toEqual([
      { c: '好', py: 'hǎo' },
      { c: '，', py: null },
      { c: '明', py: 'míng' },
      { c: '天', py: 'tiān' },
      { c: '见', py: 'jiàn' },
      { c: '！', py: null }
    ]);
  });

  it('ne laisse jamais une ponctuation seule en tête de ligne', () => {
    const g = grappes({ zh: '会，“天”是“一”。', pinyin: '', fr: '', en: '', syllabes: ['huì', 'tiān', 'shì', 'yī'] });
    expect(g.map((x) => x.map((j) => j.c).join(''))).toEqual(['会，', '“天”', '是', '“一”。']);
  });

  it('ni chronomètre, ni limite, ni point ; Tao lit par-dessus l’épaule', () => {
    expect(JEUX.wechat.chrono).toBe(0);
    expect(JEUX.wechat.limite).toBe(0);
    expect(postureDuJeu('wechat')).toBe('lecture');
  });

  it('ne dit rien qui vienne du code, sans cinabre ni ombre', () => {
    const source = readFileSync(new URL('WeChat.svelte', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\p{Script=Han}/u);
    expect(source).toContain('posture="lecture"');
    const style = source.slice(source.indexOf('<style>'));
    expect(style).not.toMatch(/--zhu|shadow|gradient/);
  });
});
