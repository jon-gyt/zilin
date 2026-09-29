/**
 * VoiceOver (rapport comparatif du 28 septembre 2026, §2.12, la partie accessibilité) : un
 * test par règle.
 *
 * - un caractère dessiné depuis ses traits porte un nom : le caractère, son pinyin et son
 *   sens, « 住, zhù, habiter » ; une question ne souffle pas sa réponse ;
 * - un bouton-icône a un label ;
 * - un décor est caché aux lecteurs d'écran.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aria, glyph, nomAccessible, premierSens, type StrokeData } from './glyph';
import { lireTraits } from './strokes';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const demo: Record<string, StrokeData> = lireTraits(
  JSON.parse(readFileSync(new URL('../../public/strokes-demo.json', import.meta.url), 'utf8'))
);

/** Tous les composants de l'app, et l'aiguillage. */
const COMPOSANTS: Record<string, string> = Object.fromEntries([
  ...readdirSync(new URL('.', import.meta.url))
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => [f, source(f)]),
  ['App.svelte', source('../App.svelte')]
]);

/** Sans les commentaires : ils décrivent parfois ce qu'on n'écrit pas. */
const sansCommentaires = (s: string): string => s.replace(/<!--[\s\S]*?-->/g, '');

/** La fin d'une balise ouvrante, en sautant les accolades de Svelte (`onclick={() => …}`). */
function finBalise(s: string, i: number): number {
  let prof = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === '{') prof++;
    else if (s[k] === '}') prof--;
    else if (s[k] === '>' && prof === 0) return k;
  }
  return -1;
}

/** Les boutons d'un composant : la balise ouvrante et son contenu. */
function boutons(s: string): { balise: string; contenu: string }[] {
  const out: { balise: string; contenu: string }[] = [];
  let i = 0;
  for (;;) {
    const d = s.indexOf('<button', i);
    if (d < 0) break;
    const fin = finBalise(s, d);
    const ferme = fin < 0 ? -1 : s.indexOf('</button>', fin);
    if (ferme < 0) break;
    out.push({ balise: s.slice(d, fin + 1), contenu: s.slice(fin + 1, ferme) });
    i = ferme;
  }
  return out;
}

/** Ce qu'un bouton dit sans label : son texte, hors dessins et symboles. */
function texteVisible(contenu: string): string {
  return contenu
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/\{@html[^}]*\}/g, '')
    .replace(/<[A-Z][\s\S]*?\/>/g, '')
    .replace(/<span aria-hidden="true">[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '');
}

describe('un caractère dessiné porte un nom', () => {
  it('le caractère, son pinyin et son premier sens : « 住, zhù, habiter »', () => {
    expect(nomAccessible('住', 'zhù', 'habiter, vivre')).toBe('住, zhù, habiter');
    expect(premierSens('enfant ; fils')).toBe('enfant');
  });

  it('ce qu’on ne sait pas est omis, jamais inventé', () => {
    expect(nomAccessible('亻', 'rén', '')).toBe('亻, rén');
    expect(nomAccessible('龘')).toBe('龘');
  });

  it('le dessin est une image nommée, que VoiceOver annonce', () => {
    const nom = nomAccessible('住', 'zhù', 'habiter');
    for (const h of [glyph('住', demo['住'], 48, { label: nom }), glyph('住', demo['住'], 120, { label: nom })]) {
      expect(h).toMatch(/^<svg [^>]*role="img" aria-label="住, zhù, habiter"/);
    }
  });

  it('sans traits, le repli en police garde le nom et la langue', () => {
    const h = glyph('龘', undefined, 60, { label: '龘, dá' });
    expect(h).toContain('role="img" aria-label="龘, dá"');
    expect(h).toContain('lang="zh-Hans"');
  });

  it('un nom ne casse pas l’attribut', () => {
    expect(aria('« a » & "b"')).toBe('role="img" aria-label="« a » &amp; &quot;b&quot;"');
  });

  it('Glyph lit le pinyin et le sens dans la fiche de l’export, avec les traits', () => {
    const g = source('Glyph.svelte');
    expect(g).toContain('fiche(c, p)');
    expect(g).toContain('traitsDe(c, p)');
    expect(g).toContain('nomAccessible(c, f.pinyin, sensDit(f))');
    expect(g).toMatch(/label: nom/);
  });

  it('une question ne souffle pas sa réponse : dans les questions et les jeux, le caractère seul', () => {
    for (const f of ['Ask.svelte', 'Game.svelte', 'EclairTour.svelte']) {
      const glyphes = COMPOSANTS[f].match(/<Glyph\b[^>]*>/g) ?? [];
      expect(glyphes.length, f).toBeGreaterThan(0);
      for (const x of glyphes) expect(x, f).toMatch(/<Glyph\s+seul\b/);
    }
  });

  it('le nom accessible d’un choix ne donne pas la réponse : ni pinyin, ni sens, ni glose', () => {
    /* VoiceOver lit l’aria-label d’un bouton à la place de son contenu : un nom qui dirait
       « 马, mǎ » sous « quel élément donne le son ? » soufflerait la réponse. */
    for (const f of ['Ask.svelte', 'Game.svelte', 'EclairTour.svelte', 'RepliquesWechat.svelte', 'Cuisine.svelte', 'FilWechat.svelte']) {
      const noms = sansCommentaires(COMPOSANTS[f]).match(/aria-label=(\{[^}]*\}|"[^"]*")/g) ?? [];
      for (const n of noms) {
        const expressions = n.match(/\{[^}]*\}/g) ?? [];
        for (const e of expressions) expect(e, `${f} ${n}`).not.toMatch(/\.(pinyin|fr|sens)\b|glose\(|sens\(|lecture\(|nomAccessible|pinyinDe/);
      }
    }
    /* Le tracé de mémoire : si les traits manquent, le repli se nomme par le seul caractère. */
    expect(COMPOSANTS['Trace.svelte']).toContain('seul={quiz}');
  });

  it('un caractère en police dans le texte se dit en mandarin', () => {
    expect(source('Hz.svelte')).toContain('<span class="hz" lang="zh-Hans">');
  });

  it('les pavés d’un sentier et les auberges du chemin se nomment par le caractère, son pinyin et son sens', () => {
    expect(COMPOSANTS['Tree.svelte']).toContain('aria-label="Fiche de {nomDuNoeud(q.c)}"');
    expect(COMPOSANTS['Chemin.svelte']).toContain("aria-label={remplir(tc['auberge-voix'], { nom: nomAccessible(a.racine, a.pinyin, a.fr) })}");
  });

  it('un dessin qui porte des boutons n’est pas une image : ses boutons resteraient muets', () => {
    for (const f of ['Tree.svelte', 'Chemin.svelte']) {
      const svg = COMPOSANTS[f].match(/<svg\b[^>]*>[\s\S]*?role="button"/g) ?? [];
      expect(svg.length, f).toBeGreaterThan(0);
      for (const x of svg) expect(x.match(/<svg\b[^>]*>/)?.[0], f).not.toContain('role="img"');
    }
  });
});

describe('un bouton-icône a un label', () => {
  it('chaque bouton dit quelque chose : son texte, ou son aria-label', () => {
    const muets: string[] = [];
    for (const [f, s] of Object.entries(COMPOSANTS)) {
      for (const b of boutons(sansCommentaires(s))) {
        if (/aria-label/.test(b.balise)) continue;
        if (!/[\p{L}\p{N}{]/u.test(texteVisible(b.contenu))) muets.push(`${f} : ${b.balise.slice(0, 60)}`);
      }
    }
    expect(muets).toEqual([]);
  });

  it('les icônes de l’en-tête du menu ont leur label, et « Devant › » le sien', () => {
    expect(COMPOSANTS['Menu.svelte']).toContain('aria-label="Chercher un caractère"');
    expect(COMPOSANTS['Menu.svelte']).toContain('aria-label="Réglages"');
    expect(COMPOSANTS['Menu.svelte']).toContain("aria-label={tc['devant-voix']}");
  });

  it('le bouton qui fait réentendre le leurre se nomme « Écouter », la note ♪ est cachée', () => {
    expect(COMPOSANTS['Ask.svelte']).toContain('aria-label="Écouter {entenduAuLieu}"');
  });
});

describe('un décor est caché aux lecteurs d’écran', () => {
  it('le décor des fêtes et des termes, le dragon compris', () => {
    expect(COMPOSANTS['FeteDecor.svelte']).toMatch(/<div class="deco" aria-hidden="true">/);
    expect(COMPOSANTS['CercleDecor.svelte']).toContain('aria-hidden="true"');
  });

  it('Tao, le personnage, la porte de ville, les icônes des entrées', () => {
    for (const f of ['Tao.svelte', 'Heros.svelte', 'Porte.svelte', 'TropheesEntree.svelte', 'RevisionsEntree.svelte']) {
      const svgs = COMPOSANTS[f].match(/<svg\b[^>]*>/g) ?? [];
      const caches = svgs.filter((x) => x.includes('aria-hidden="true"')).length;
      const dansUnCache = (COMPOSANTS[f].match(/aria-hidden="true">\s*<svg/g) ?? []).length;
      expect(caches + dansUnCache, f).toBeGreaterThanOrEqual(svgs.length);
    }
    /* le décor de fête de Mon chemin, derrière le chemin, ne se touche pas */
    expect(COMPOSANTS['Chemin.svelte']).toContain('<div class="decor-haut"><CercleDecor {decor} /></div>');
  });

  it('un dessin sans nom est un décor : aria-hidden, sans rôle', () => {
    const h = glyph('住', demo['住'], 26, { label: '' });
    expect(h).toContain('aria-hidden="true"');
    expect(h).not.toContain('role="img"');
    expect(COMPOSANTS['Voeu.svelte']).toContain("label: ''");
  });
});
