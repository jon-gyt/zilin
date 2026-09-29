/**
 * « Lire le monde » (`lecteur-libre.ts`) : un test par règle.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lireEcrans } from './ecrans';
import { caracteresLus, estSinogramme, lexique, ligneCompte, ligneDans, lire, unites, type Contexte } from './lecteur-libre';
import { SEUIL_DEBLOCAGE, newCard, type ReviewCard } from './srs';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const TEXTES = lireEcrans(JSON.parse(source('../../public/data/0.1.0/ecrans.json')) as unknown).lire;

const T0 = new Date('2026-09-01T08:00:00Z');

/** Une carte d'une stabilité donnée, sans passer par FSRS. */
function carte(id: string, s: number): ReviewCard {
  const k = newCard(id, T0);
  return { ...k, card: { ...k.card, stability: s } };
}

function ctx(partiel: Partial<Contexte> = {}): Contexte {
  return { lus: new Set(), chemin: new Map(), fait: 0, mots: new Map(), ...partiel };
}

describe('les sinogrammes', () => {
  it('seuls les sinogrammes comptent : ni ponctuation, ni lettres, ni chiffres', () => {
    const l = lire('北京，Beijing 2026！大学。', ctx({ lus: new Set(['北', '大']) }));
    expect(l.total).toBe(4);
    expect(l.lus).toBe(2);
    expect(estSinogramme('，')).toBe(false);
    expect(estSinogramme('B')).toBe(false);
    expect(estSinogramme('𠂒')).toBe(true);
  });

  it('les autres signes restent dans le texte montré, dans l’ordre', () => {
    const l = lire('出口 →', ctx());
    expect(l.signes.map((s) => (s.han ? s.c : s.t))).toEqual(['出', '口', ' →']);
  });

  it('chaque occurrence compte : « 天天 » fait deux caractères sur deux', () => {
    const l = lire('天天', ctx({ lus: new Set(['天']) }));
    expect([l.lus, l.total]).toEqual([2, 2]);
  });
});

describe('ce qu’on lit', () => {
  it('lu : la carte passe le seuil de déblocage, la règle de Mon chemin', () => {
    const lus = caracteresLus([carte('人', SEUIL_DEBLOCAGE), carte('大', SEUIL_DEBLOCAGE - 0.1)]);
    expect([...lus]).toEqual(['人']);
    const l = lire('人大', ctx({ lus }));
    expect(l.signes.map((s) => s.han && s.etat)).toEqual(['lu', 'encre']);
  });

  it('sur le chemin : « dans N j », en jours du chemin, comme l’étagère « Bientôt »', () => {
    const chemin = new Map([
      ['学', 30],
      ['校', 12],
      ['人', 1]
    ]);
    const l = lire('学校人', ctx({ chemin, fait: 10 }));
    expect(l.signes.map((s) => s.han && [s.etat, s.dans])).toEqual([
      ['chemin', 20],
      ['chemin', 2],
      /* déjà passé, pas encore lu : rien ne s'annonce */
      ['encre', null]
    ]);
  });

  it('hors du chemin : à l’encre, sans compte', () => {
    const l = lire('龟', ctx({ chemin: new Map([['人', 1]]), fait: 0 }));
    expect(l.signes[0]).toMatchObject({ han: true, etat: 'encre', dans: null });
  });

  it('un caractère lu ne dit jamais « dans N j »', () => {
    const l = lire('人', ctx({ lus: new Set(['人']), chemin: new Map([['人', 5]]), fait: 0 }));
    expect(l.signes[0]).toMatchObject({ etat: 'lu', dans: null });
  });
});

describe('les mots de deux caractères', () => {
  const mots = lexique(
    [{ hanzi: '大学', pinyin: 'dàxué', fr: 'université' }],
    [
      { hanzi: '北京', pinyin: 'Běijīng', fr: 'Pékin' },
      { hanzi: '大学', pinyin: 'x', fr: 'doublon' },
      { hanzi: '天', pinyin: 'tiān', fr: 'ciel' },
      { hanzi: '学生', pinyin: 'xuésheng', fr: '' }
    ]
  );

  it('le lexique ne garde que les mots de deux sinogrammes avec un sens, le premier venu', () => {
    expect([...mots.keys()]).toEqual(['大学', '北京']);
    expect(mots.get('大学')?.fr).toBe('université');
  });

  it('deux caractères lus côte à côte qui forment un mot sont reconnus', () => {
    const l = lire('北京大学', ctx({ lus: new Set(['北', '京', '大', '学']), mots }));
    expect(l.mots.map((m) => m.hanzi)).toEqual(['北京', '大学']);
    expect(l.signes.map((s) => s.han && s.mot?.place)).toEqual(['debut', 'fin', 'debut', 'fin']);
  });

  it('un mot dont un caractère n’est pas lu n’est pas reconnu', () => {
    const l = lire('大学', ctx({ lus: new Set(['大']), mots }));
    expect(l.mots).toEqual([]);
  });

  it('la ponctuation coupe un mot', () => {
    const l = lire('大，学', ctx({ lus: new Set(['大', '学']), mots }));
    expect(l.mots).toEqual([]);
  });

  it('un mot qui revient est listé une fois', () => {
    const l = lire('大学大学', ctx({ lus: new Set(['大', '学']), mots }));
    expect(l.mots).toHaveLength(1);
    expect(l.signes.filter((s) => s.han && s.mot?.i === 0)).toHaveLength(4);
  });

  it('un mot ne se coupe pas en fin de ligne : ses deux caractères font une unité', () => {
    const l = lire('一北京。', ctx({ lus: new Set(['一', '北', '京']), mots }));
    expect(unites(l.signes).map((u) => [u.signes.map((s) => (s.han ? s.c : s.t)).join(''), u.mot])).toEqual([
      ['一', null],
      ['北京', 0],
      ['。', null]
    ]);
  });

  it('sans données de mots, aucun mot n’est reconnu', () => {
    const l = lire('大学', ctx({ lus: new Set(['大', '学']) }));
    expect(l.mots).toEqual([]);
  });
});

describe('les lignes viennent du pipeline', () => {
  it('« Tu lis 9 caractères sur 14. »', () => {
    expect(ligneCompte(TEXTES, { lus: 9, total: 14 })).toBe('Tu lis 9 caractères sur 14.');
    expect(ligneCompte(TEXTES, { lus: 1, total: 4 })).toBe('Tu lis 1 caractère sur 4.');
    expect(ligneCompte(TEXTES, { lus: 0, total: 4 })).toBe('Tu lis 0 caractère sur 4.');
    expect(ligneCompte(TEXTES, { lus: 0, total: 0 })).toBe(TEXTES['sans-chinois']);
  });

  it('« dans 12 j », et « demain » pour le jour suivant', () => {
    expect(ligneDans(TEXTES, 12)).toBe('dans 12 j');
    expect(ligneDans(TEXTES, 1)).toBe('demain');
  });

  it('aucun texte de l’écran n’est écrit dans le code', () => {
    const code = (f: string): string => source(f).replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/.*$/gm, '');
    for (const t of ['Tu lis', 'Texte en direct', 'Un texte', 'Les mots que tu lis', 'Colle ou tape']) {
      expect(code('Chercher.svelte'), t).not.toContain(t);
      expect(code('lecteur-libre.ts'), t).not.toContain(t);
    }
  });
});

describe('la charte de l’écran', () => {
  it('jade pour l’acquis, ni cinabre, ni ombre, ni dégradé', () => {
    const code = source('Chercher.svelte').replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
    expect(code).toMatch(/\.lu\s*\{[^}]*var\(--jade\)/);
    expect(code).not.toMatch(/--zhu|#C8371F|cinabre/i);
    expect(code).not.toMatch(/gradient|box-shadow|drop-shadow|text-shadow/i);
  });

  it('aucune requête réseau : l’écran ne lit que l’export et la progression', () => {
    for (const f of ['lecteur-libre.ts', 'Chercher.svelte']) {
      expect(source(f), f).not.toMatch(/\bfetch\(|XMLHttpRequest|https?:\/\//);
    }
  });
});
