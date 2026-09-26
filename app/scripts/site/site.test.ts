/// <reference types="node" />
/**
 * Story 5.2, le site public : une page par caractère, FR et EN, tirée de l'export
 * versionné. Un test par règle : le compte des pages, les liens internes, aucune
 * définition anglaise tierce, l'attribution de l'Arphic Public License, les grands
 * caractères dessinés depuis leurs traits, les fiches non relues muettes, et le service
 * worker de l'app qui laisse le site au réseau.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VERSION_DONNEES } from '../../src/lib/content';
import { cheminPage, motifPagesDuSite } from './chemins';
import { genererSite, lireExport, type Export, type Fichier } from './generer';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicDir = join(app, 'public');
const BASE = '/zilin/';
const ORIGINE = 'https://exemple.test';
const tokensCss = readFileSync(join(app, 'src/lib/tokens.css'), 'utf8');
const ex = lireExport(join(publicDir, 'data', VERSION_DONNEES));
const fichiers = genererSite(ex, { base: BASE, origine: ORIGINE, tokensCss });
const parChemin = new Map(fichiers.map((f) => [f.chemin, f.contenu]));
const pages = fichiers.filter((f) => f.chemin.endsWith('.html'));

/** Les caractères de l'export qui ont des traits : ceux qui ont une page. */
const dessinables = new Set(ex.familles.flatMap((f) => f.fiches.map((x) => x.c)).filter((c) => ex.traits[c]?.s.length));

function page(chemin: string): string {
  const contenu = parChemin.get(`${decodeURIComponent(chemin)}index.html`);
  if (!contenu) throw new Error(`page absente : ${chemin}`);
  return contenu;
}

describe('site public', () => {
  it('écrit une page par caractère dessinable, en français et en anglais, plus les index', () => {
    expect(dessinables.size).toBeGreaterThan(400);
    const caracteres = pages.filter((f) => /^(en\/)?c\//.test(f.chemin));
    expect(caracteres).toHaveLength(2 * dessinables.size);
    // deux index des familles, deux pages de licences, deux de confidentialité
    expect(pages).toHaveLength(2 * dessinables.size + 6);
    for (const c of dessinables) {
      expect(parChemin.has(`c/${c}/index.html`)).toBe(true);
      expect(parChemin.has(`en/c/${c}/index.html`)).toBe(true);
    }
    // le composant non identifié du pipeline n'a pas de page
    expect(parChemin.has('c/？/index.html')).toBe(false);
  });

  it('un composant découpé a sa page, et ce qui sort de la police s’écrit en traits', () => {
    for (const c of ['𠂒', '⿰𠄌丶', '𭕄']) expect(dessinables.has(c), c).toBe(true);
    const xian = page(cheminPage('fr', 'caractere', '先'));
    const egal = xian.match(/<p class="egal">(.*?)<\/p>/s)?.[1] ?? '';
    expect(egal).toContain('aria-label="𠂒"');
    expect(egal).not.toMatch(/>𠂒</);
    const yi = page(cheminPage('fr', 'caractere', '⿰𠄌丶'));
    const h1 = yi.match(/<h1>(.*?)<\/h1>/s)?.[1] ?? '';
    expect(h1).toContain('<svg');
    expect(h1).not.toMatch(/>⿰/);
  });

  it("n'a que des liens internes valides", () => {
    let vus = 0;
    for (const f of fichiers.filter((x) => x.chemin.endsWith('.html'))) {
      for (const [, href] of f.contenu.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (/^https?:/.test(href) || href.startsWith('#')) continue;
        expect(href.startsWith(BASE), `${f.chemin} : ${href}`).toBe(true);
        const chemin = decodeURIComponent(href.slice(BASE.length).split(/[?#]/)[0]);
        vus++;
        if (chemin === '') continue; // l'app, écrite par vite build
        const cible = chemin.endsWith('/') ? `${chemin}index.html` : chemin;
        const existe = parChemin.has(cible) || existsSync(join(publicDir, cible));
        expect(existe, `${f.chemin} → ${href}`).toBe(true);
      }
      // les ancres vers l'index des familles existent
      for (const [, ancre] of f.contenu.matchAll(/familles\/#(f-[^"]+)"/g)) {
        expect(page('familles/')).toContain(`id="${ancre}"`);
      }
    }
    expect(vus).toBeGreaterThan(10000);
  });

  it('fait renvoyer chaque composant de la décomposition à sa page', () => {
    const f = ex.familles.flatMap((x) => x.fiches).find((x) => x.c === '休')!;
    const html = page(cheminPage('fr', 'caractere', '休'));
    for (const p of f.parts) expect(html).toContain(`href="${BASE}${cheminPage('fr', 'caractere', p)}"`);
    expect(page(cheminPage('en', 'caractere', '休'))).toContain(`href="${BASE}${cheminPage('en', 'caractere', '亻')}"`);
  });

  it("porte l'attribution de l'Arphic Public License et le lien vers son texte sur chaque page", () => {
    for (const f of pages) {
      expect(f.contenu, f.chemin).toContain('Arphic Public License');
      expect(f.contenu, f.chemin).toContain(`href="${BASE}data/${VERSION_DONNEES}/traits/ARPHICPL.TXT"`);
      expect(f.contenu, f.chemin).toContain('Make Me a Hanzi');
    }
    // les fichiers de tracés dérivés sont publiés depuis la page des licences (APL §2 b)
    for (const t of ex.fichiersTraits) expect(page('licences/')).toContain(`traits/${encodeURIComponent(t)}"`);
  });

  it('publie la politique de confidentialité à une adresse stable, liée depuis chaque page', () => {
    // L'adresse que l'on déclare dans App Store Connect : elle ne doit pas bouger.
    expect(cheminPage('fr', 'confidentialite')).toBe('confidentialite/');
    expect(cheminPage('en', 'confidentialite')).toBe('en/privacy/');
    const fr = page('confidentialite/');
    const en = page('en/privacy/');
    expect(fr).toContain('<h1>Confidentialité</h1>');
    expect(fr).toContain('Wenlu ne collecte rien');
    expect(en).toContain('<h1>Privacy</h1>');
    expect(en).toContain('Wenlu collects nothing');
    expect(fr).toContain(`<link rel="canonical" href="${ORIGINE}${BASE}confidentialite/">`);
    expect(en).toContain(`hreflang="fr" href="${ORIGINE}${BASE}confidentialite/"`);
    for (const f of pages) {
      const cible = f.chemin.startsWith('en/') ? 'en/privacy/' : 'confidentialite/';
      expect(f.contenu, f.chemin).toContain(`href="${BASE}${cible}"`);
    }
    expect(parChemin.get('sitemap.xml')).toContain(`<loc>${ORIGINE}${BASE}en/privacy/</loc>`);
    expect(motifPagesDuSite(BASE).test('/zilin/confidentialite/')).toBe(true);
    expect(motifPagesDuSite(BASE).test('/zilin/en/privacy/')).toBe(true);
  });

  it('dessine les grands caractères depuis leurs traits, jamais depuis une police', () => {
    const html = page(cheminPage('fr', 'caractere', '休'));
    const grand = /<div class="grand">([\s\S]*?)<\/div>/.exec(html)![1];
    expect(grand).toContain('<svg class="g write"');
    expect(grand).toContain(ex.traits['休'].s[0]);
    expect(grand).not.toContain('class="hz"');
    // l'ordre des traits : une case par trait
    expect(html.match(/<li><span class="case">/g)).toHaveLength(ex.traits['休'].s.length);
  });

  it("n'écrit aucune définition anglaise ni aucun texte d'une fiche non relue", () => {
    const relues = ex.familles.flatMap((f) => f.fiches).filter((x) => x.statut === 'relu');
    if (relues.length === 0) {
      for (const f of pages) expect(f.contenu, f.chemin).not.toMatch(/class="(sens|origine|mots|phrase|tag)"/);
    }
    // Une fiche sans relecture qui porterait du texte (fuite du pipeline) reste muette.
    const fuite: Export = structuredClone(ex);
    const cible = fuite.familles.flatMap((f) => f.fiches).find((x) => x.c === '休')!;
    Object.assign(cible, {
      statut: 'sans_fiche',
      fr: 'se reposer',
      en: 'to rest; to stop',
      origine_fr: 'ORIGINE-FR',
      origine_en: 'ORIGIN-EN',
      etiquette: 'atteste',
      mots: [{ hanzi: '休息', pinyin: 'xiūxi', fr: 'repos', en: 'rest' }]
    });
    const muet = genererSite(fuite, { base: BASE, origine: ORIGINE, tokensCss });
    const texte = (fs: Fichier[]) => fs.map((f) => f.contenu).join('\n');
    for (const mot of ['to rest', 'se reposer', 'ORIGINE-FR', 'ORIGIN-EN', '休息']) expect(texte(muet)).not.toContain(mot);
    // Relue, la même fiche parle, chaque langue dans la sienne, avec son étiquette.
    cible.statut = 'relu';
    const relu = genererSite(fuite, { base: BASE, origine: ORIGINE, tokensCss });
    const fr = relu.find((f) => f.chemin === 'c/休/index.html')!.contenu;
    const en = relu.find((f) => f.chemin === 'en/c/休/index.html')!.contenu;
    expect(fr).toContain('ORIGINE-FR');
    expect(fr).toContain('attesté');
    expect(fr).not.toContain('ORIGIN-EN');
    expect(en).toContain('to rest; to stop');
    expect(fr).toContain('CC BY-SA 4.0');
  });

  it('se rend indexable : titre, description, canonique, hreflang, données structurées, plan du site', () => {
    const fr = page(cheminPage('fr', 'caractere', '休'));
    const en = page(cheminPage('en', 'caractere', '休'));
    const abs = (l: 'fr' | 'en') => `${ORIGINE}${BASE}${cheminPage(l, 'caractere', '休')}`;
    expect(fr).toMatch(/<title>休 xiū : caractère chinois/);
    expect(en).toMatch(/<title>休 xiū: Chinese character/);
    expect(fr).toMatch(/<meta name="description" content="休 \(xiū\) : [^"]*亻 \+ 木/);
    expect(fr).toContain(`<link rel="canonical" href="${abs('fr')}">`);
    expect(en).toContain(`<link rel="canonical" href="${abs('en')}">`);
    for (const h of [fr, en]) {
      expect(h).toContain(`hreflang="fr" href="${abs('fr')}"`);
      expect(h).toContain(`hreflang="en" href="${abs('en')}"`);
      expect(h).toContain(`hreflang="x-default" href="${abs('fr')}"`);
    }
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(fr)![1]);
    expect(ld['@type']).toBe('DefinedTerm');
    expect(ld.name).toBe('休');
    const plan = parChemin.get('sitemap.xml')!;
    expect(plan.match(/<loc>/g)).toHaveLength(2 * dessinables.size + 6 + 1);
    expect(plan).toContain(`<loc>${abs('en')}</loc>`);
    expect(parChemin.get('robots.txt')).toContain(`Sitemap: ${ORIGINE}${BASE}sitemap.xml`);
    // aucune page ne demande de JavaScript
    for (const f of pages) expect(f.contenu.replace(/<script type="application\/ld\+json">.*?<\/script>/g, '')).not.toContain('<script');
  });

  it('garde la charte : tokens de tokens.css, polices de l’app, ni ombre ni dégradé', () => {
    const css = parChemin.get('site/site.css')!;
    expect(css).toContain('--paper:#F4EEE2');
    expect(css).toContain('url(../fonts/manrope-700.woff2)');
    expect(css).not.toMatch(/box-shadow|text-shadow|gradient\(/);
    for (const f of pages) expect(f.contenu, f.chemin).not.toMatch(/fonts\.googleapis|gradient\(|box-shadow/);
  });

  it("tient la base configurable et laisse le site hors du service worker de l'app", () => {
    const autre = genererSite(ex, { base: '/', origine: ORIGINE, tokensCss });
    const html = autre.find((f) => f.chemin === 'c/休/index.html')!.contenu;
    expect(html).toContain('href="/site/site.css');
    expect(html).not.toContain('/zilin/');
    const motif = motifPagesDuSite(BASE);
    expect(motif.test('/zilin/c/%E4%BC%91/')).toBe(true);
    expect(motif.test('/zilin/en/c/%E4%BC%91/')).toBe(true);
    expect(motif.test('/zilin/familles/')).toBe(true);
    expect(motif.test('/zilin/')).toBe(false);
    expect(motif.test('/zilin/index.html')).toBe(false);
  });
});
