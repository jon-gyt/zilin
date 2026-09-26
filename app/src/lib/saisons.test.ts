import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fichierSaisons, loadFetes, loadSaisons, type Fetes, type Index, type Saisons } from './content';
import { feteDuJour, poserFete } from './fetes';
import { anecdoteDeLaJournee, annonceLeTerme, journee, phrasesDeTao, pistes, termeDuJour, theme } from './saisons';

/* Les fichiers servis avec l'app, tels que `wenlu export` les écrit. */
const lire = (f: string): string => readFileSync(new URL(`../../public/data/0.1.0/${f}`, import.meta.url), 'utf8');
const index = JSON.parse(lire('index.json')) as Index;

function repondre(corps: string, ok = true): typeof fetch {
  return (async () => ({ ok, status: ok ? 200 : 404, json: async () => JSON.parse(corps) })) as unknown as typeof fetch;
}

const saisons: Saisons = await loadSaisons('data/0.1.0/saisons.json', repondre(lire('saisons.json')));
const fetes: Fetes = await loadFetes('data/0.1.0/fetes.json', repondre(lire('fetes.json')));
const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('le fichier des termes solaires vient du pipeline', () => {
  it("l'index le nomme, et son en-tête cite sa source", () => {
    expect(fichierSaisons(index)).toBe('data/0.1.0/saisons.json');
    expect(saisons.source).toContain("rédigés pour l'app");
    expect(saisons.source).toContain('lunar_python');
    expect(saisons.rubrique).not.toBe('');
  });

  it('vingt-quatre termes, huit ambiances, un caractère à lire propre à chacun', () => {
    expect(Object.keys(saisons.termes)).toHaveLength(24);
    expect(saisons.ambiances).toHaveLength(8);
    const caracteres = Object.values(saisons.termes).map((t) => t.caractere.c);
    expect(new Set(caracteres).size).toBe(24);
    for (const [id, t] of Object.entries(saisons.termes)) {
      expect(saisons.ambiances, id).toContain(t.ambiance);
      expect(t.ligne, id).not.toBe('');
      expect(t.tao.length, id).toBeGreaterThan(0);
      expect(t.caractere.pinyin, id).not.toBe('');
      expect(t.caractere.sens, id).not.toBe('');
      /* son caractère se dessine depuis ses traits : sa famille est connue */
      expect(pistes(saisons, t.caractere.c), id).toHaveLength(1);
    }
  });

  it('chaque jour de 2026 à 2035 a son terme', () => {
    const debut = Date.UTC(2026, 0, 1);
    for (let j = 0; j < 3652; j += 7) {
      const jour = new Date(debut + j * 86_400_000).toISOString().slice(0, 10);
      expect(termeDuJour(saisons, jour), jour).not.toBeNull();
    }
    expect(termeDuJour(saisons, '2035-12-31')?.nomZh).toBe('冬至');
  });

  it('une entrée illisible ou un terme sans textes est écarté, un fichier absent est une erreur', async () => {
    const s = await loadSaisons(
      'x.json',
      repondre(
        JSON.stringify({
          ambiances: ['neige'],
          calendrier: [
            { terme: 'daxue', debut: 'hier', fin: '2026-12-22' },
            { terme: 'inconnu', debut: '2026-12-07', fin: '2026-12-22' },
            { terme: 'orage', debut: '2026-12-07', fin: '2026-12-22' }
          ],
          termes: {
            daxue: { nom_zh: '大雪', fr: 'la grande neige', ambiance: 'neige', ligne: '.', tao: [], caractere: { c: '冰' } },
            orage: { nom_zh: '雷', fr: 'orage', ambiance: 'orage', ligne: '.', tao: [], caractere: { c: '雷' } }
          },
          racines: {}
        })
      )
    );
    expect(s.calendrier).toEqual([]);
    expect(Object.keys(s.termes)).toEqual(['daxue']);
    expect(s.termes.daxue.caractere).toEqual({ c: '冰', pinyin: '', sens: '' });
    await expect(loadSaisons('x.json', repondre('{}', false))).rejects.toThrow('introuvables');
    await expect(loadSaisons('x.json', repondre('{}'))).rejects.toThrow('illisibles');
  });
});

describe('le terme du jour', () => {
  it("秋分 commence le 23 septembre 2026 et court jusqu'au 7 octobre", () => {
    const t = termeDuJour(saisons, '2026-09-23');
    expect(t).toMatchObject({ id: 'qiufen', nomZh: '秋分', fr: "l'équinoxe d'automne", debut: '2026-09-23', commence: true, depuis: 0 });
    expect(t?.fin).toBe('2026-10-08');
    expect(termeDuJour(saisons, '2026-10-07')).toMatchObject({ id: 'qiufen', commence: false, depuis: 14 });
    expect(termeDuJour(saisons, '2026-10-08')?.id).toBe('hanlu');
    expect(termeDuJour(saisons, '2026-09-22')?.id).toBe('bailu');
  });

  it('立春 2027 commence le 4 février, 冬至 2026 le 22 décembre', () => {
    expect(termeDuJour(saisons, '2027-02-04')).toMatchObject({ nomZh: '立春', commence: true });
    expect(termeDuJour(saisons, '2027-02-03')?.nomZh).toBe('大寒');
    expect(termeDuJour(saisons, '2026-12-22')).toMatchObject({ nomZh: '冬至', commence: true });
  });

  it('le caractère du terme, son nom et sa ligne lui sont propres', () => {
    const bailu = termeDuJour(saisons, '2026-09-10');
    expect(bailu?.caractere).toEqual({ c: '露', pinyin: 'lù', sens: 'la rosée' });
    expect(bailu?.pinyin).toBe('báilù');
    const daxue = termeDuJour(saisons, '2026-12-10');
    expect(daxue?.caractere.c).toBe('冰');
    expect(daxue?.ligne).not.toBe(bailu?.ligne);
  });

  it("une date illisible ou hors du calendrier n'a pas de terme", () => {
    expect(termeDuJour(saisons, 'hier')).toBeNull();
    expect(termeDuJour(saisons, '2040-06-01')).toBeNull();
  });
});

describe('la fête a priorité', () => {
  it('中秋 recouvre 秋分 : le thème est celui de la fête, le terme court derrière', () => {
    const j = journee(fetes, saisons, '2026-09-25');
    expect(j.fete?.id).toBe('zhongqiu');
    expect(j.terme?.nomZh).toBe('秋分');
    expect(j.theme).toEqual({ fete: 'zhongqiu', saison: null });
    /* le lendemain de la fête, l'ambiance du terme revient */
    expect(journee(fetes, saisons, '2026-09-27').theme).toEqual({ fete: null, saison: 'feuilles' });
  });

  it('清明 est un terme, mais garde son thème de fête ; le terme revient après la fête', () => {
    expect(journee(fetes, saisons, '2026-04-05').theme).toEqual({ fete: 'qingming', saison: null });
    expect(journee(fetes, saisons, '2026-04-10')).toMatchObject({
      fete: null,
      terme: { nomZh: '清明' },
      theme: { fete: null, saison: 'pluie' }
    });
  });

  it("le jour où commence un terme, l'anecdote l'annonce, sauf un jour de fête", () => {
    const qiufen = journee(fetes, saisons, '2026-09-23');
    expect(qiufen.fete?.id).toBe('zhongqiu');
    expect(annonceLeTerme(qiufen.fete, qiufen.terme)).toBe(false);
    const hanlu = journee(fetes, saisons, '2026-10-08');
    expect(annonceLeTerme(hanlu.fete, hanlu.terme)).toBe(true);
    const lendemain = journee(fetes, saisons, '2026-10-09');
    expect(annonceLeTerme(lendemain.fete, lendemain.terme)).toBe(false);
    /* 清明 et 冬至 : le jour du terme est toujours un jour de fête */
    for (const jour of ['2026-04-05', '2026-12-22']) {
      const j = journee(fetes, saisons, jour);
      expect(annonceLeTerme(j.fete, j.terme), jour).toBe(false);
    }
  });

  it('sans fichier de fêtes ni de termes, aucun thème', () => {
    expect(journee(null, null, '2026-09-25')).toEqual({ fete: null, terme: null, theme: { fete: null, saison: null } });
    expect(theme(null, null)).toEqual({ fete: null, saison: null });
  });
});

describe("l'anecdote de la journée, la même partout où elle se lit", () => {
  const aucunSuivi = { fetesVues: {} };
  const liste = [
    { c: '人', titre: 'Un', texte: 'Premier.' },
    { c: '大', titre: 'Deux', texte: 'Second.' }
  ];

  it('un jour de fête, celle de la fête, avec la famille de son caractère', () => {
    const r = anecdoteDeLaJournee(liste, fetes, saisons, '2026-09-25', aucunSuivi);
    const f = feteDuJour(fetes, '2026-09-25');
    expect(r?.fete?.id).toBe('zhongqiu');
    expect(r?.terme).toBeNull();
    expect(r?.a).toEqual({ c: f?.anecdote.c, titre: f?.anecdote.titre, texte: f?.anecdote.texte });
  });

  it('le jour où commence un terme, celle du terme ; le lendemain, celle du fichier', () => {
    const hanlu = anecdoteDeLaJournee(liste, fetes, saisons, '2026-10-08', aucunSuivi);
    const t = termeDuJour(saisons, '2026-10-08');
    expect(hanlu?.terme?.id).toBe('hanlu');
    expect(hanlu?.a.c).toBe(t?.caractere.c);
    expect(hanlu?.a.titre).toBe(`${t?.nomZh} · ${t?.fr}`);
    expect(hanlu?.pistes).toEqual(pistes(saisons, t?.caractere.c ?? ''));
    const lendemain = anecdoteDeLaJournee(liste, fetes, saisons, '2026-10-09', aucunSuivi);
    expect(lendemain?.fete).toBeNull();
    expect(lendemain?.terme).toBeNull();
    expect(liste).toContainEqual(lendemain?.a);
  });

  it("sans rien à lire, pas d'anecdote", () => {
    expect(anecdoteDeLaJournee(null, null, null, '2026-10-09', aucunSuivi)).toBeNull();
    expect(anecdoteDeLaJournee([], null, null, '2026-10-09', aucunSuivi)).toBeNull();
  });
});

describe('Tao', () => {
  it('commence par le terme, revient à la journée, puis dit son autre phrase de terme', () => {
    const t = termeDuJour(saisons, '2026-10-24');
    expect(t?.nomZh).toBe('霜降');
    expect(phrasesDeTao(null, t, ['A', 'B'])).toEqual([t?.tao[0], 'A', 'B', ...(t?.tao.slice(1) ?? [])]);
  });

  it('un jour de fête, ce sont les phrases de la fête, pas celles du terme', () => {
    const f = feteDuJour(fetes, '2026-09-25');
    const t = termeDuJour(saisons, '2026-09-25');
    expect(phrasesDeTao(f, t, ['A'])[0]).toBe(f?.tao[0]);
    expect(phrasesDeTao(f, t, ['A'])).not.toContain(t?.tao[0]);
    expect(phrasesDeTao(null, null, ['A'])).toEqual(['A']);
  });
});

describe('le thème sur la page', () => {
  function racine(papiers: Record<string, string>) {
    const attrs = new Map<string, string>();
    const meta = new Map<string, string>([['content', '#F4EEE2']]);
    const doc = {
      querySelector: () => ({
        getAttribute: (k: string) => meta.get(k) ?? null,
        setAttribute: (k: string, v: string) => void meta.set(k, v)
      }),
      defaultView: {
        getComputedStyle: () => ({
          getPropertyValue: () => papiers[attrs.get('data-fete') ?? attrs.get('data-saison') ?? ''] ?? '#F4EEE2'
        })
      }
    };
    return {
      attrs,
      meta,
      el: {
        ownerDocument: doc,
        setAttribute: (k: string, v: string) => void attrs.set(k, v),
        removeAttribute: (k: string) => void attrs.delete(k)
      }
    };
  }

  it('data-saison se pose un jour sans fête, et theme-color suit son papier', () => {
    const r = racine({ feuilles: '#F5EDE1', zhongqiu: '#141B2E' });
    poserFete(r.el, null, 'feuilles');
    expect(r.attrs.get('data-saison')).toBe('feuilles');
    expect(r.attrs.has('data-fete')).toBe(false);
    expect(r.meta.get('content')).toBe('#F5EDE1');
  });

  it('un jour de fête, data-saison est retiré : la fête repeint seule', () => {
    const r = racine({ feuilles: '#F5EDE1', zhongqiu: '#141B2E' });
    poserFete(r.el, null, 'feuilles');
    poserFete(r.el, 'zhongqiu', 'feuilles');
    expect(r.attrs.get('data-fete')).toBe('zhongqiu');
    expect(r.attrs.has('data-saison')).toBe(false);
    expect(r.meta.get('content')).toBe('#141B2E');
    poserFete(r.el, null, null);
    expect(r.attrs.size).toBe(0);
    expect(r.meta.get('content')).toBe('#F4EEE2');
  });
});

describe('la charte des ambiances', () => {
  const css = source('tokens.css');
  const decor = source('FeteDecor.svelte');
  const blocs = css
    .split('\n[data-saison="')
    .slice(1)
    .map((b) => ({ id: b.slice(0, b.indexOf('"')), corps: b.slice(0, b.indexOf('}')) }));

  it('chaque ambiance a sa palette légère et son décor', () => {
    expect(blocs.map((b) => b.id).sort()).toEqual([...saisons.ambiances].sort());
    for (const a of saisons.ambiances) expect(decor, a).toContain(`saison === '${a}'`);
  });

  it("une seule palette papier : ni nuit, ni encre changée, ni cases ou bouton repeints", () => {
    for (const b of blocs) {
      expect(b.corps, b.id).not.toContain('color-scheme');
      expect(b.corps, b.id).not.toMatch(/--(ink|ink2|mist|tile-[a-z]+|act|act-ink|zhu|indigo)\s*:/);
      /* un papier clair, comme le papier de riz #F4EEE2 : chaque composante au-dessus de E0 */
      expect(b.corps, b.id).toMatch(/--paper:#[EF][0-9A-F](?:[EF][0-9A-F]){2};/);
    }
  });

  it('ni cinabre, ni rouge de fête, ni doré, ni ombre, ni dégradé', () => {
    for (const b of blocs) expect(b.corps, b.id).not.toMatch(/#C8371F|#9E1F2A|#E3A33B|gold/i);
    expect(decor).not.toMatch(/gradient|box-shadow|drop-shadow|gold/i);
  });

  it("le décor d'ambiance est derrière tout, muet, coupé si l'on réduit les animations", () => {
    expect(decor).toContain('<div class="deco saison" aria-hidden="true">');
    expect(decor).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.deco \{ display: none; \}/);
  });

  it('pas de dragon, même à 惊蛰', () => {
    for (const t of Object.values(saisons.termes)) expect(JSON.stringify(t)).not.toMatch(/dragon|龙/i);
    /* le dragon n'est qu'au Nouvel An et à 端午 : jamais dans les ambiances des termes */
    expect(decor.slice(decor.indexOf('{:else if saison}'), decor.indexOf('<style>'))).not.toMatch(/dragon|龙/i);
  });
});

describe("l'en-tête du menu", () => {
  const menu = source('Menu.svelte');
  const entete = menu.slice(menu.indexOf('<header class="mhead">'), menu.indexOf('</header>'));

  it('un jour de fête, le vœu ; sinon la marque, et le terme en une ligne dessous', () => {
    expect(entete.indexOf('<Voeu')).toBeLessThan(entete.indexOf('{:else}'));
    expect(entete.slice(entete.indexOf('{:else}'))).toContain('{#if terme}');
    expect(entete).toContain('{terme.nomZh}');
    expect(entete).toContain('· {terme.fr}');
  });

  it('le caractère du terme est dessiné depuis ses traits', () => {
    expect(entete).toContain('<Glyph char={terme.caractere.c}');
  });

  it("toucher la ligne de fête ou de terme rouvre l'anecdote du jour", () => {
    expect(entete).toContain('onouvrir={onanecdote}');
    expect(entete).toMatch(/<button class="terme"[^>]*onclick=\{onanecdote\}/);
    const app = source('../App.svelte');
    expect(app).toContain("onanecdote={() => relireAnecdote('menu')}");
  });
});
