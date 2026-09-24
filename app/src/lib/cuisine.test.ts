import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import {
  ESSAIS_CUISINE,
  choisir,
  gout,
  jouable,
  lireCuisine,
  mancheCuisine,
  manquants,
  recetteAProposer,
  recettesJouables,
  signesPris,
  toursCuisine,
  type Cuisine,
  type CuisineDonnees,
  type Recette
} from './cuisine';
import { IDS, JEUX, corpusDeJeu, disponibles, fini, repondre, tour, type Manche } from './jeux';
import { emptyProgress, fromJSON, noterRecette, toJSON } from './session';
import { SEUIL_DEBLOCAGE, grade } from './srs';
import { journal, posture, POIDS, ajouter, taoVide } from './tao';
import { VERSION_DONNEES, type Foret } from './content';

/* ---------- une petite cuisine, en dur : aucun réseau ---------- */

const BRUT = {
  version: '0.9.0',
  source: 'test',
  recettes: [
    {
      id: 'niuroumian',
      zh: '牛肉面',
      pinyin: 'niúròumiàn',
      fr: 'les nouilles au bœuf',
      en: 'beef noodles',
      gratuit: false,
      etapes: [{ zh: '牛肉下水。', pinyin: 'Niúròu xià shuǐ.', fr: 'Le bœuf dans l’eau.', en: 'Beef in.' }],
      ingredients: [
        { zh: '牛肉', pinyin: 'niúròu', fr: 'du bœuf', en: 'beef', leurres: ['牛奶', '鸡肉'], notes: ['肉'] },
        { zh: '面', pinyin: 'miàn', fr: 'des nouilles', en: 'noodles', leurres: ['米', '面包'], notes: ['面'] }
      ],
      caracteres: ['牛', '肉', '面', '下', '水'],
      jours: { hsk: 198, lire: null }
    },
    {
      id: 'mifan',
      zh: '米饭',
      pinyin: 'mǐfàn',
      fr: 'le riz blanc',
      en: 'plain rice',
      gratuit: true,
      etapes: [{ zh: '水里下米。', pinyin: 'Shuǐ lǐ xià mǐ.', fr: 'Le riz dans l’eau.', en: 'Rice in.' }],
      ingredients: [
        { zh: '米', pinyin: 'mǐ', fr: 'du riz', en: 'rice', leurres: ['面', '米酒'], notes: ['米'] },
        { zh: '水', pinyin: 'shuǐ', fr: 'de l’eau', en: 'water', leurres: ['酒', '茶'], notes: ['水'] }
      ],
      caracteres: ['米', '饭', '水', '里', '下'],
      jours: { hsk: 165, lire: 153 }
    },
    /* Mal formées : sans id, sans ingrédient jouable. Elles tombent. */
    { zh: '茶', etapes: [], ingredients: [], caracteres: ['茶'] },
    {
      id: 'vide',
      zh: '菜',
      etapes: [{ zh: '菜。' }],
      ingredients: [{ zh: '菜', fr: 'des légumes', leurres: ['菜'], notes: ['菜'] }],
      caracteres: ['菜']
    }
  ],
  etal: { 牛奶: { pinyin: 'niúnǎi', fr: 'du lait', en: 'milk' } },
  tao: {
    lit: { zh: '我来看看！', pinyin: 'Wǒ lái kànkan!', fr: 'Voyons voir !', en: 'Let me see!' },
    bon: { zh: '好吃！', pinyin: 'Hǎochī!', fr: 'C’est bon !', en: 'Delicious!' },
    grimace: { zh: '再来一个吧！', pinyin: 'Zài lái yī gè ba!', fr: 'On en refait un ?', en: 'Another?' }
  },
  racines: { 米: '米' }
};

const DONNEES: CuisineDonnees = lireCuisine(BRUT);
const [BOEUF, RIZ] = DONNEES.recettes as [Recette, Recette];
const TOUT = [...new Set(DONNEES.recettes.flatMap((r) => r.caracteres))];

function cuisine(acquis: readonly string[], cuisinees: readonly string[] = []): Cuisine {
  return { donnees: DONNEES, acquis, cuisinees };
}

/** Une manche jouée jusqu'au bout : chaque tour pris juste, ou raté deux fois. */
function jouer(r: Recette, justes: boolean[]): Manche {
  let m = mancheCuisine(r, 'g');
  if (!m) throw new Error('manche attendue');
  for (const juste of justes) {
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    let pris: string[] = [];
    const faux = t.choix.find((x) => x !== t.reponse[0]) ?? '';
    const suite = juste ? [t.reponse[0]] : [faux, t.choix.find((x) => x !== t.reponse[0] && x !== faux) ?? faux];
    for (const mot of suite) {
      const e = choisir(t, mot, pris, 2);
      pris = e.pris;
      if (e.outcome) m = repondre(m, mot, e.outcome).manche;
    }
  }
  return m;
}

/* ---------- les données ---------- */

describe('cuisine.json', () => {
  it('se lit en écartant les recettes mal formées', () => {
    expect(DONNEES.recettes.map((r) => r.id)).toEqual(['niuroumian', 'mifan']);
    expect(BOEUF.jours).toEqual({ hsk: 198, lire: null });
    expect(RIZ.gratuit).toBe(true);
    expect(DONNEES.tao.grimace?.zh).toBe('再来一个吧！');
    expect(lireCuisine(null).recettes).toEqual([]);
  });

  it('l’export versionné porte dix plats, trois gratuits, et les phrases de Tao', () => {
    const brut = JSON.parse(
      readFileSync(new URL(`../../public/data/${VERSION_DONNEES}/cuisine.json`, import.meta.url), 'utf8')
    ) as unknown;
    const d = lireCuisine(brut);
    expect(d.recettes).toHaveLength(10);
    expect(d.recettes.filter((r) => r.gratuit)).toHaveLength(3);
    expect(Object.keys(d.tao).sort()).toEqual(['bon', 'grimace', 'lit']);
    for (const r of d.recettes) {
      for (const i of r.ingredients) {
        expect(i.leurres).not.toContain(i.zh);
        expect(d.etal[i.zh]?.fr).toBeTruthy();
        for (const l of i.leurres) expect(d.etal[l]?.fr).toBeTruthy();
      }
    }
    const index = JSON.parse(
      readFileSync(new URL(`../../public/data/${VERSION_DONNEES}/index.json`, import.meta.url), 'utf8')
    ) as { cuisine: string };
    expect(index.cuisine).toBe('cuisine.json');
  });
});

/* ---------- une recette n'est jouable que si ses caractères sont acquis ---------- */

describe('ce qui se cuisine', () => {
  it('attend que tous les caractères de la recette soient acquis', () => {
    expect(jouable(RIZ, ['米', '饭', '水', '里'])).toBe(false);
    expect(manquants(RIZ, ['米', '饭', '水', '里'])).toEqual(['下']);
    expect(jouable(RIZ, RIZ.caracteres)).toBe(true);
  });

  it('ne demande pas d’avoir appris les leurres', () => {
    /* 奶, 鸡, 包 ne sont que des leurres : on les écarte, on ne les apprend pas d'abord. */
    expect(jouable(BOEUF, BOEUF.caracteres)).toBe(true);
    expect(BOEUF.caracteres).not.toContain('奶');
  });

  it('propose d’abord un plat pas encore réussi', () => {
    expect(recetteAProposer(cuisine(TOUT))?.id).toBe('niuroumian');
    expect(recetteAProposer(cuisine(TOUT, ['niuroumian']))?.id).toBe('mifan');
    expect(recetteAProposer(cuisine(TOUT, ['niuroumian', 'mifan']))?.id).toBe('niuroumian');
    expect(recetteAProposer(cuisine([]))).toBeNull();
    expect(recettesJouables(cuisine(RIZ.caracteres)).map((r) => r.id)).toEqual(['mifan']);
  });

  it('lit l’acquis réel, jamais la démonstration de la forêt', () => {
    const foret: Foret = {
      familles: [{ c: '米', pinyin: 'mǐ', fr: 'riz', avancement: 1, membres: [] }]
    } as unknown as Foret;
    const demo = corpusDeJeu({ foret, cartes: [], cuisine: DONNEES });
    expect(demo.acquis).toContain('米');
    expect(demo.cuisine?.acquis).toEqual([]);
    expect(JEUX.cuisine.preparer(demo, 'g')).toBeNull();
    expect(disponibles(demo, 'g')).not.toContain('cuisine');

    const cartes = RIZ.caracteres.map((c) => ({ c, stabilite: SEUIL_DEBLOCAGE }));
    const vrai = corpusDeJeu({ cartes, cuisine: DONNEES, cuisinees: [] });
    expect(JEUX.cuisine.preparer(vrai, 'g')?.tours).toHaveLength(RIZ.ingredients.length);
    expect(IDS).toContain('cuisine');
  });

  it('se tait sans cuisine.json', () => {
    expect(JEUX.cuisine.preparer(corpusDeJeu({ cartes: [] }), 'g')).toBeNull();
  });
});

/* ---------- l'étal : des questions notées, sans temps ni vie ---------- */

describe('l’étal', () => {
  it('pose une question par ingrédient, notée sur ce que le premier leurre n’a pas', () => {
    const tours = toursCuisine(BOEUF, 'g');
    expect(tours).toHaveLength(2);
    expect(tours[0].c).toBe('肉');
    expect(tours[0].aussi).toEqual([]);
    expect(tours[0].enonce).toBe('du bœuf');
    expect(tours[0].reponse).toEqual(['牛肉']);
    expect([...tours[0].choix].sort()).toEqual(['牛奶', '牛肉', '鸡肉'].sort());
    /* Même graine, même étal. */
    expect(toursCuisine(BOEUF, 'g')).toEqual(tours);
  });

  it('laisse deux essais, comme toute question, et note par grade', () => {
    const m = mancheCuisine(BOEUF, 'g');
    if (!m) throw new Error('manche attendue');
    const t = tour(m);
    if (!t) throw new Error('tour attendu');
    expect(ESSAIS_CUISINE).toBe(2);

    const premier = choisir(t, '牛肉', [], 2);
    expect(premier.outcome).toEqual({ correct: true, tries: 0, seconds: 2, leurres: [] });
    expect(grade(repondre(m, '牛肉', premier.outcome!).evenement)).toBe(Rating.Easy);

    const rate = choisir(t, '牛奶', [], 2);
    expect(rate.outcome).toBeNull();
    const second = choisir(t, '牛肉', rate.pris, 4);
    expect(second.outcome).toMatchObject({ correct: true, tries: 1 });
    expect(grade(repondre(m, '牛肉', second.outcome!).evenement)).toBe(Rating.Hard);

    const montre = choisir(t, '鸡肉', rate.pris, 4);
    expect(montre.outcome).toMatchObject({ correct: false, tries: 2 });
    const r = repondre(m, '鸡肉', montre.outcome!);
    expect(r.montre).toBe(true);
    expect(grade(r.evenement)).toBe(Rating.Again);
  });

  it('garde le leurre pris, caractère par caractère : 牛奶 pour 牛肉, c’est 奶', () => {
    expect(signesPris(['牛奶'], '牛肉')).toEqual(['奶']);
    expect(signesPris(['牛奶', '鸡肉'], '牛肉')).toEqual(['奶', '鸡']);
    const t = toursCuisine(BOEUF, 'g')[0];
    expect(choisir(t, '牛肉', ['牛奶'], 3).outcome?.leurres).toEqual(['奶']);
  });

  it('n’a ni chronomètre, ni limite, ni point', () => {
    expect(JEUX.cuisine.chrono).toBe(0);
    expect(JEUX.cuisine.limite).toBe(0);
    const m = jouer(RIZ, [true, false]);
    expect(fini(m)).toBe(true);
    expect(JEUX.cuisine.constat(m)).toBe('2 caractères revus, 1 ingrédient trouvé.');
    expect(JEUX.cuisine.constat(m)).not.toMatch(/point|score|vie|bravo/i);
  });
});

/* ---------- Tao goûte ---------- */

describe('Tao goûte', () => {
  it('est contente quand chaque ingrédient a été trouvé, même au second essai', () => {
    expect(gout(jouer(RIZ, [true, true]))).toBe('bon');
  });

  it('grimace quand un ingrédient a été pris pour un autre', () => {
    expect(gout(jouer(RIZ, [true, false]))).toBe('grimace');
  });

  it('goûte en posture « goûte », et le plat se dit le soir sans reproche', () => {
    expect(posture('cuisine')).toBe('goute');
    const t = ajouter(taoVide(), '2026-09-24', 'cuisine');
    expect(t.croissance).toBe(POIDS.cuisine);
    expect(journal(t.activites, '2026-09-24')).toBe("Aujourd'hui, un plat cuisiné.");
  });

  it('ne dit rien qui vienne du code : aucun caractère chinois écrit en dur à l’écran', () => {
    const source = readFileSync(new URL('Cuisine.svelte', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\p{Script=Han}/u);
    expect(source).toContain('posture="goute"');
    expect(source).toContain('grimace=');
    const tao = readFileSync(new URL('Tao.svelte', import.meta.url), 'utf8');
    expect(tao).toContain("posture === 'goute'");
    /* La grimace est à l'encre, comme le reste de son visage : aucun cinabre, aucun teint. */
    const grimace = tao.slice(tao.indexOf("regard === 'grimace'"), tao.indexOf("regard === 'ennui'"));
    expect(grimace).toContain('var(--ink)');
    expect(grimace).not.toMatch(/--zhu|--jade|#/);
  });
});

/* ---------- la progression ---------- */

describe('les plats réussis', () => {
  it('comptent une fois chacun, et survivent à l’export de la progression', () => {
    let p = emptyProgress('2026-09-24');
    expect(p.recettes).toEqual([]);
    p = noterRecette(noterRecette(p, 'mifan'), 'mifan');
    expect(p.recettes).toEqual(['mifan']);
    expect(noterRecette(p, '')).toBe(p);
    expect(fromJSON(toJSON(p), '2026-09-24').recettes).toEqual(['mifan']);
  });

  it('manquent sans dommage dans une progression plus ancienne', () => {
    const ancienne = JSON.parse(toJSON(emptyProgress('2026-09-24'))) as Record<string, unknown>;
    delete ancienne.recettes;
    expect(fromJSON(JSON.stringify(ancienne), '2026-09-24').recettes).toEqual([]);
  });
});
