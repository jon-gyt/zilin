/**
 * L'image du chemin (décisions du propriétaire du 29 septembre 2026, maquette validée
 * `maquettes/chemin.html`) : « Ma forêt » devient « Mon chemin 路 », et toute l'image change ;
 * plus aucune borne ni stèle. Un test par règle :
 *
 * - aucun texte affiché par un composant ne dit graine, forêt, arbre, borne ni stèle : ce que
 *   montre le balisage et chaque chaîne du code, commentaires à part ;
 * - pas plus dans les modules qui écrivent des textes d'écran ;
 * - l'arbre de la décomposition, terme d'usage, reste permis ;
 * - les textes de l'image viennent du pipeline (`ecrans.json`, `chemin`), et le disent.
 *
 * Le contrôle jumeau côté pipeline est `wenlu check`, « image du chemin » (`vocabulaire.py`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLES_CHEMIN, lireEcrans } from './ecrans';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Les mots de l'ancienne image, au singulier et au pluriel ; les identifiants sans accent n'en sont pas. */
const MOTS = /(?<![\p{L}\p{N}_$-])(graines?|forêts?|arbres?|bornes?|stèles?)(?![\p{L}\p{N}_$-])/giu;
/** L'arbre de la décomposition, terme d'usage (décision du 29 septembre 2026), reste permis. */
const DECOMPOSITION = /arbres? (?:de (?:la )?décomposition|des caractères)/giu;

export function motsInterdits(texte: string): string[] {
  return [...texte.replace(DECOMPOSITION, '').matchAll(MOTS)].map((m) => m[1].toLowerCase());
}

/**
 * Les chaînes d'un code TypeScript, sans ses commentaires : les littéraux entre apostrophes,
 * guillemets et accents graves (les `${…}` relus comme du code). Une expression régulière
 * littérale est sautée : elle n'est pas un texte affiché.
 */
export function chaines(code: string): string[] {
  const out: string[] = [];
  let i = 0;
  let precedent = '';
  const lire = (fin: number): void => {
    while (i < fin) {
      const c = code[i];
      const d = code[i + 1];
      if (c === '/' && d === '/') {
        i = code.indexOf('\n', i);
        if (i < 0) i = fin;
        continue;
      }
      if (c === '/' && d === '*') {
        const f = code.indexOf('*/', i + 2);
        i = f < 0 ? fin : f + 2;
        continue;
      }
      if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$|return|typeof/.test(precedent)) {
        /* une expression régulière littérale : jusqu'au `/` qui la ferme, hors classe */
        let k = i + 1;
        let classe = false;
        while (k < fin && code[k] !== '\n') {
          if (code[k] === '\\') k += 2;
          else {
            if (code[k] === '[') classe = true;
            else if (code[k] === ']') classe = false;
            else if (code[k] === '/' && !classe) break;
            k += 1;
          }
        }
        i = k + 1;
        precedent = 'x';
        continue;
      }
      if (c === "'" || c === '"') {
        let k = i + 1;
        let s = '';
        while (k < fin && code[k] !== c && code[k] !== '\n') {
          if (code[k] === '\\') {
            s += code[k + 1] ?? '';
            k += 2;
          } else s += code[k++];
        }
        out.push(s);
        i = k + 1;
        precedent = 'x';
        continue;
      }
      if (c === '`') {
        let k = i + 1;
        let s = '';
        while (k < fin && code[k] !== '`') {
          if (code[k] === '\\') {
            s += code[k + 1] ?? '';
            k += 2;
          } else if (code[k] === '$' && code[k + 1] === '{') {
            /* l'interpolation est du code : ses chaînes sont relues, son nom n'est pas un texte */
            let prof = 1;
            let f = k + 2;
            while (f < fin && prof > 0) {
              if (code[f] === '{') prof++;
              else if (code[f] === '}') prof--;
              f++;
            }
            out.push(...chaines(code.slice(k + 2, f - 1)));
            s += ' ';
            k = f;
          } else s += code[k++];
        }
        out.push(s);
        i = k + 1;
        precedent = 'x';
        continue;
      }
      if (!/\s/.test(c)) precedent = /[\w$]/.test(c) ? code.slice(Math.max(0, i - 5), i + 1).match(/(return|typeof|[\w$])$/)?.[0] ?? c : c;
      i += 1;
    }
  };
  lire(code.length);
  return out;
}

/**
 * Ce qu'un composant affiche ou dit : le texte du balisage et ses attributs, et les chaînes
 * de ses scripts et de ses expressions. Sans les styles ni les commentaires.
 */
export function textesDuComposant(svelte: string): string[] {
  const sans = svelte.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const out: string[] = [];
  const scripts = [...sans.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  for (const s of scripts) out.push(...chaines(s[1]));
  const balisage = sans.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  let texte = '';
  let i = 0;
  while (i < balisage.length) {
    if (balisage[i] === '{') {
      let prof = 1;
      let f = i + 1;
      while (f < balisage.length && prof > 0) {
        if (balisage[f] === '{') prof++;
        else if (balisage[f] === '}') prof--;
        f++;
      }
      out.push(...chaines(balisage.slice(i + 1, f - 1)));
      texte += ' ';
      i = f;
    } else texte += balisage[i++];
  }
  out.push(texte);
  return out;
}

const COMPOSANTS: [string, string][] = [
  ...readdirSync(new URL('.', import.meta.url))
    .filter((f) => f.endsWith('.svelte'))
    .map((f): [string, string] => [f, source(f)]),
  ['App.svelte', source('../App.svelte')]
];

/** Les modules qui écrivent des textes d'écran, hors tests. */
const MODULES: [string, string][] = readdirSync(new URL('.', import.meta.url))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f): [string, string] => [f, source(f)]);

describe("l'image du chemin : ni graine, ni forêt, ni arbre, ni borne, ni stèle", () => {
  it('le relevé trouve chacun des cinq mots, et laisse passer ce qui n’en est pas', () => {
    expect(motsInterdits('Graine plantée · Sept graines font un arbre.')).toEqual(['graine', 'graines', 'arbre']);
    expect(motsInterdits('‹ Ma forêt')).toEqual(['forêt']);
    expect(motsInterdits('Prochaine borne : 50 caractères, sa stèle')).toEqual(['borne', 'stèle']);
    expect(motsInterdits("L'arbre des caractères qui apprend à lire, bornée, la graineterie")).toEqual([]);
    /* un identifiant n'est pas un texte : `foret`, `graineDuJour`, `bornerRetention` */
    expect(textesDuComposant("<script>const foret = graineDuJour(x); bornerRetention(r);</script><p>{foret}</p>")).not.toContain('foret');
    expect(chaines('const s = `${graine}/eclair`; // la graine du jour\n/* un arbre */ const t = "Mon chemin";')).toEqual([
      ' /eclair',
      'Mon chemin'
    ]);
  });

  it('aucun composant ne l’affiche ni ne le fait dire à VoiceOver', () => {
    const fautes: string[] = [];
    for (const [f, s] of COMPOSANTS) {
      for (const t of textesDuComposant(s)) for (const m of motsInterdits(t)) fautes.push(`${f} : ${m}`);
    }
    expect(fautes).toEqual([]);
  });

  it('aucun module n’écrit un texte qui le dise', () => {
    const fautes: string[] = [];
    for (const [f, s] of MODULES) {
      for (const t of chaines(s)) for (const m of motsInterdits(t)) fautes.push(`${f} : ${m} (« ${t.slice(0, 50)} »)`);
    }
    expect(fautes).toEqual([]);
  });

  it('les textes de l’image viennent du pipeline : Mon chemin, la pierre posée, les rendez-vous', () => {
    const t = lireEcrans(JSON.parse(source('../../public/data/0.1.0/ecrans.json')) as unknown).chemin;
    for (const cle of CLES_CHEMIN) {
      expect(t[cle], cle).not.toBe('');
      expect(motsInterdits(t[cle]), cle).toEqual([]);
    }
    expect(t.case).toBe('Mon chemin');
    expect(t['menu-faite']).toBe('Pierre posée, une seule par jour');
    expect(t.devant).toBe('Devant ›');
    expect(t['rdv-prochain']).toBe('Prochain rendez-vous :');
    /* le menu, Clore et Mon chemin les lisent, sans les réécrire */
    expect(source('parcours.ts')).toContain("tc['menu-faite']");
    expect(source('Close.svelte')).toContain("remplir(tc['clore-titre'], { c: caractere })");
    expect(source('Chemin.svelte')).toContain("tc['rdv-prochain']");
  });

  it('le caractère 路 de la case se dessine depuis ses traits, exportés avec l’interface', () => {
    expect(source('Menu.svelte')).toContain("{ id: 'foret', c: '路', t: '' }");
    const traits = readdirSync(new URL('../../public/data/0.1.0/traits/', import.meta.url)).some((f) =>
      source(`../../public/data/0.1.0/traits/${f}`).includes('"路"')
    );
    expect(traits).toBe(true);
  });
});
