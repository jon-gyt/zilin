/**
 * L'écran de « Dis-le » (story 9.1) : la charte et ce que l'écran s'interdit, une règle par
 * test. Ni cinabre, ni ombre, ni dégradé, ni doré, ni dragon ; aucune couleur hors des
 * jetons ; le caractère depuis ses traits ; ni pinyin ni son avant la réponse ; le son n'est
 * jamais gardé ni envoyé ; l'essai reste dans Réglages.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const sansCommentaires = (s: string): string =>
  s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const FICHIERS = ['Dire.svelte', 'CourbeTon.svelte', 'DireEssai.svelte'];
const code = FICHIERS.map((f) => sansCommentaires(source(f))).join('\n');
const dire = source('Dire.svelte');
const TONS = ['tons/micro.ts', 'tons/classifieur.ts', 'tons/pitch.ts', 'tons/voix.ts', 'tons/dire.ts', 'tons/modele.ts', 'tons/reecoute.ts'];

describe('l’écran de « Dis-le »', () => {
  it('ni cinabre, ni ombre, ni dégradé, ni doré, ni dragon', () => {
    expect(code).not.toMatch(/--zhu|box-shadow|drop-shadow|gradient|gold|doré|dragon|龙/i);
  });

  it('aucune couleur hors des jetons de tokens.css', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/rgba?\(/);
  });

  it('l’indigo pour l’action, le jade pour le ton reconnu, l’ocre pour un autre ton', () => {
    expect(dire).toMatch(/\.micro \{[^}]*background: var\(--act\)/);
    expect(dire).toMatch(/\.etat\.juste \{[^}]*color: var\(--jade\)/);
    expect(dire).toMatch(/\.etat\.autre \{[^}]*color: var\(--ocre\)/);
  });

  it('le caractère se dessine depuis ses traits, sans son pinyin pour nom', () => {
    expect(dire).toMatch(/<Glyph seul char=\{cible\.c\}/);
  });

  it('ni pinyin accentué, ni son avant la réponse', () => {
    expect(dire.indexOf('<div class="q dire"')).toBeGreaterThan(0);
    const avant = dire.slice(dire.indexOf('<div class="q dire"'), dire.indexOf("{#if phase === 'fin'}"));
    expect(avant).not.toMatch(/cible\.pinyin|prononcer/);
    expect(dire).not.toMatch(/\$effect\([^)]*prononcer/);
  });

  it('les phrases viennent du pipeline : aucune n’est écrite dans l’écran', () => {
    for (const cle of ['enonce', 'appuie', 'ecoute', 'redire', 'confidentialite', 'passer', 'ecouter', 'suivant', 'reecouter', 'reecouter-aide']) {
      expect(dire).toMatch(new RegExp(`t\\.${cle}\\b|t\\['${cle}'\\]`));
    }
  });

  it('le son ne sort pas de l’appareil et n’est pas gardé : ni requête, ni stockage', () => {
    for (const f of TONS.filter((x) => x !== 'tons/modele.ts')) {
      expect(sansCommentaires(source(f)), f).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|MediaRecorder/);
    }
    expect(sansCommentaires(source('Dire.svelte'))).not.toMatch(/fetch\(|localStorage|indexedDB|MediaRecorder/);
  });

  it('l’essai n’est pas une porte de l’aventure : on n’y entre que par Réglages', () => {
    const app = source('../App.svelte');
    expect(app).toMatch(/<Settings [^>]*onessayer=\{\(\) => \(ecran = 'dire'\)\}/);
    expect(app.match(/ecran = 'dire'/g)?.length).toBe(1);
    expect(source('ouvertures.ts')).not.toMatch(/dire|Dis-le/);
  });

  it('« Réécouter » : la prise de la question est oubliée à la question suivante et quand l’écran s’en va', () => {
    expect(dire).toMatch(/void cle;\s*reecoute\.oublier\(\)/);
    expect(dire.match(/reecoute\.oublier\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(dire).toMatch(/reecoute\.garder\(enr\.brut, enr\.srBrut\)/);
  });

  it('un mot : « Bien » note la carte du caractère ; seule la voix d’un caractère isolé s’apprend', () => {
    expect(dire).toMatch(/const carte = \$derived\(cible\.mot\?\.carte \?\? cible\.c\)/);
    expect(dire).toMatch(/onnote\(revisionDire\(carte,/);
    expect(dire).toMatch(/if \(contour && !cible\.mot\) onvoix\(/);
    expect(dire).toMatch(/analyser\(x, sr, attendus, modele, ref, \{\}, cible\.mot\?\.liees \?\? null\)/);
  });

  it('rien ne joue pendant la prise : le micro n’entend ni « Écouter » ni « Réécouter »', () => {
    expect(dire).toMatch(/taire\(\);\s*phase = 'ecoute'/);
  });
});

