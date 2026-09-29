/**
 * Le pavé « Écrire au doigt » (`PaveEcriture.svelte`, maquette `dictionnaire.html`, écran 5) :
 * rendu côté serveur avec les textes exportés, et sa source lue pour la charte. Un test par
 * règle. Le tracé lui-même et les candidats se vérifient dans le navigateur (captures).
 */
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import PaveEcriture from './PaveEcriture.svelte';
import { CLES_ECRIRE, lireEcrans } from './ecrans';

const ECRANS = lireEcrans(
  JSON.parse(readFileSync(new URL('../../public/data/0.1.0/ecrans.json', import.meta.url), 'utf8')) as unknown
);
const t = ECRANS.ecrire;
const SOURCE = readFileSync(new URL('./PaveEcriture.svelte', import.meta.url), 'utf8');
const STYLE = SOURCE.slice(SOURCE.indexOf('<style>'));
const GABARIT = SOURCE.slice(SOURCE.indexOf('</script>'), SOURCE.indexOf('<style>'));

const rendre = (props: Record<string, unknown>) =>
  render(PaveEcriture, { props: { onchoisir: () => undefined, textes: t, ...props } as never }).body;

describe('pavé « Écrire au doigt »', () => {
  it('ses textes viennent du pipeline, tous écrits', () => {
    for (const cle of CLES_ECRIRE) expect(t[cle], cle).not.toBe('');
    expect(t.annuler).toBe('Annuler le trait');
    expect(t.effacer).toBe('Effacer');
  });

  it("aucun texte en dur : le gabarit n'écrit que des textes lus", () => {
    const texte = GABARIT.replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]*>/g, ' ');
    expect(texte.replace(/\s+/g, '')).toBe('');
  });

  it('ouvert : le pavé, son 米字格, « Annuler le trait » et « Effacer », et la ligne d’aide', () => {
    const html = rendre({ ouvert: true });
    expect(html).toContain('class="pave');
    expect(html).toContain(`aria-label="${t.pave}"`);
    expect(html).toContain('class="grille');
    expect(html).toContain(t.annuler);
    expect(html).toContain(t.effacer);
    expect(html).toContain(t.aide);
    /* rien de tracé : rien à annuler ni à effacer */
    expect(html.match(/<button[^>]*class="ctl[^"]*"[^>]*disabled/g)).toHaveLength(2);
  });

  it('fermé (sans Wenlu complet) : une ligne et un lien à la même place, sans pavé ni cadenas', () => {
    const html = rendre({ ouvert: false, ondecouvrir: () => undefined });
    expect(html).toContain(t.complet);
    expect(html).toContain(t['complet-texte']);
    expect(html).toContain(t['complet-lien'].replace('›', '›'));
    expect(html).not.toContain('class="pave');
    expect(html).not.toMatch(/cadenas|🔒|lock/i);
  });

  it('les candidats se dessinent depuis leurs traits, par le composant de glyphe, jamais en police', () => {
    expect(SOURCE).toContain("import Glyph from './Glyph.svelte'");
    expect(GABARIT).toMatch(/<Glyph[^>]*donnees=\{m\.donnees\}/);
    expect(SOURCE).toContain('donnees ? { c, donnees, pinyin } : null');
    expect(STYLE).not.toMatch(/font-family|var\(--hz\)/);
  });

  it('charte : ni cinabre, ni ombre, ni dégradé, ni doré', () => {
    expect(SOURCE).not.toMatch(/--zhu|cinabre\)|box-shadow|text-shadow|drop-shadow|gradient|gold|dor[ée]\b/i);
  });

  it('des cibles de 44 px au moins', () => {
    const regle = (sel: string) => {
      const i = STYLE.indexOf(`${sel} {`);
      return STYLE.slice(i, STYLE.indexOf('}', i));
    };
    expect(regle('.ctl')).toMatch(/min-height: 44px/);
    expect(regle('.lien')).toMatch(/min-height: 44px/);
    expect(regle('.cand')).toMatch(/width: 58px/);
    expect(regle('.cand')).toMatch(/min-height: 68px/);
  });

  it("rien ne s'anime : ni animation, ni transition, avec ou sans prefers-reduced-motion", () => {
    expect(STYLE).not.toMatch(/animation|transition|@keyframes/);
    expect(GABARIT).toMatch(/write=\{false\}/);
  });

  it("émet le caractère touché, et ne lit aucun gabarit tant qu'il est fermé", () => {
    expect(GABARIT).toContain('onclick={() => onchoisir(m.c)}');
    expect(SOURCE).toMatch(/\$effect\(\(\) => \{\n\s+if \(!ouvert\) return;/);
  });
});
