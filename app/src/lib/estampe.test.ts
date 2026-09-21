import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { estampeSaine, estampeUrl, loadEstampe, DOSSIER_ESTAMPES } from './estampe';
import type { Anecdotes } from './content';

const demo = new URL('../../public/data/demo/', import.meta.url);
const fichier = JSON.parse(readFileSync(new URL('anecdotes.json', demo), 'utf8')) as Anecdotes;
const lire = (estampe: string) => readFileSync(new URL(estampe, demo), 'utf8');

/** Les deux seules teintes admises à côté de l'encre : un aplat très pâle. */
const APLATS = ['var(--ocre-soft)', 'var(--jade-soft)'];

describe('les estampes des anecdotes', () => {
  it('sont une par anecdote, nommée par son caractère', () => {
    expect(fichier.anecdotes.length).toBeGreaterThan(0);
    for (const a of fichier.anecdotes) expect(a.estampe).toBe(`estampes/${a.c}.svg`);
  });

  it('sont des fichiers servis avec l’app', () => {
    for (const a of fichier.anecdotes) {
      const f = fileURLToPath(new URL(a.estampe as string, demo));
      expect(existsSync(f), a.estampe).toBe(true);
      expect(statSync(f).size, a.estampe).toBeLessThan(4096);
    }
  });

  it('sont carrées, en traits d’encre d’épaisseur constante', () => {
    for (const a of fichier.anecdotes) {
      const svg = lire(a.estampe as string);
      expect(svg, a.estampe).toContain('viewBox="0 0 240 240"');
      expect(svg, a.estampe).toContain('stroke="currentColor"');
      expect(svg, a.estampe).toContain('stroke-width="6"');
      expect(svg, a.estampe).toContain('stroke-linecap="round"');
      // aucune épaisseur de trait redéfinie dans le dessin
      expect(svg.match(/stroke-width=/g), a.estampe).toHaveLength(1);
    }
  });

  it('ne portent ni script, ni police, ni couleur hors des tokens permis', () => {
    for (const a of fichier.anecdotes) {
      const svg = lire(a.estampe as string);
      expect(svg, a.estampe).not.toMatch(/<\s*(script|style|text|tspan|image|foreignObject)\b/i);
      expect(svg, a.estampe).not.toMatch(/font-|<!\[CDATA\[/i);
      // pas de dégradé, pas d'ombre, pas d'opacité détournée en gris
      expect(svg, a.estampe).not.toMatch(/Gradient|filter|opacity|shadow/i);
      // aucune couleur écrite en dur : ni #hexa, ni rgb(), ni nom de couleur
      expect(svg, a.estampe).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(svg, a.estampe).not.toMatch(/rgb\(|hsl\(/i);
      for (const v of svg.match(/var\(--[a-z-]+\)/g) ?? []) {
        expect(APLATS, `${a.estampe} : ${v}`).toContain(v);
      }
      for (const f of svg.match(/fill="[^"]*"/g) ?? []) {
        expect([...APLATS, 'currentColor', 'none'], `${a.estampe} : ${f}`).toContain(
          f.slice(6, -1)
        );
      }
    }
  });

  it('passent le contrôle de l’app', () => {
    for (const a of fichier.anecdotes) expect(estampeSaine(lire(a.estampe as string))).toBe(true);
  });
});

describe('le chargeur d’estampe', () => {
  it('ne va chercher que dans le dossier des estampes de l’app', () => {
    expect(estampeUrl('estampes/福.svg')).toBe(
      `${import.meta.env.BASE_URL}${DOSSIER_ESTAMPES}estampes/福.svg`
    );
    for (const mauvais of [
      '../secret.svg',
      'estampes/../../secret.svg',
      'estampes/sous/福.svg',
      'https://ailleurs.test/a.svg',
      'estampes/福.png',
      'estampes/福.svg?x=1'
    ]) {
      expect(estampeUrl(mauvais), mauvais).toBeNull();
    }
  });

  it('refuse un SVG qui porte un script, un gestionnaire ou un renvoi extérieur', () => {
    expect(estampeSaine('<svg><script>x()</script></svg>')).toBe(false);
    expect(estampeSaine('<svg onload="x()"></svg>')).toBe(false);
    expect(estampeSaine('<svg><image href="https://ailleurs.test/a.png"/></svg>')).toBe(false);
    expect(estampeSaine('<svg><rect fill="url(https://ailleurs.test/a)"/></svg>')).toBe(false);
    expect(estampeSaine('<div>pas un svg</div>')).toBe(false);
  });

  it('lit le fichier servi avec l’app, et lui seul', async () => {
    const appels: string[] = [];
    const svg = lire('estampes/茶.svg');
    const faux: typeof fetch = async (u) => {
      appels.push(String(u));
      return { ok: true, status: 200, text: async () => svg } as Response;
    };
    await expect(loadEstampe('estampes/茶.svg', faux)).resolves.toContain('<svg');
    expect(appels).toEqual([`${import.meta.env.BASE_URL}${DOSSIER_ESTAMPES}estampes/茶.svg`]);
  });

  it('refuse un chemin hors du dossier, un fichier absent, un contenu douteux', async () => {
    const ok = (corps: string): typeof fetch => async () =>
      ({ ok: true, status: 200, text: async () => corps }) as Response;
    await expect(loadEstampe('../a.svg', ok('<svg></svg>'))).rejects.toThrow('hors du dossier');
    const absent: typeof fetch = async () =>
      ({ ok: false, status: 404, text: async () => '' }) as Response;
    await expect(loadEstampe('estampes/茶.svg', absent)).rejects.toThrow('introuvable');
    await expect(loadEstampe('estampes/茶.svg', ok('<svg><script/></svg>'))).rejects.toThrow(
      'refusée'
    );
  });
});
