/**
 * « Dis-le » sur un mot de deux syllabes (story 9.1, 30 septembre 2026) : un test par règle.
 * Les textes des mots viennent de la source du pipeline (`data/sources/ecrans/dire.tsv`) :
 * l'export de l'app ne les porte pas encore, et la question de mot ne se pose pas sans eux.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Fiche, Mot } from '../content';
import { lireEcrans, SANS_ECRANS } from '../ecrans';
import type { Corpus } from '../questions';
import { analyser, juger, REGLAGES_MOTS, SEUILS_JUGEMENT, type Modele, type Ton, type Verdict } from './classifieur';
import {
  MESURE_MOTS_DIRE,
  MOTS_DIRE,
  SEUILS_MOTS_DIRE,
  attendusDe,
  cibleDEssai,
  cibleDeMot,
  cibleDire,
  commenceVoisee,
  courbesMot,
  messageDireMot,
  motsJustifies,
  motsLisibles,
  motsPossibles,
  notesMot,
  revisionDire,
  tonsDeSurface,
  type CibleMot
} from './dire';
import { lireModele } from './modele';
import { lireModeleMots } from './profil';
import { courbesTons, syllabe } from './synthese';

/** Les textes de « Dis-le » tels que la source du pipeline les écrit. */
function textesSource() {
  const tsv = readFileSync(new URL('../../../../data/sources/ecrans/dire.tsv', import.meta.url), 'utf8');
  const dire: Record<string, string> = {};
  for (const l of tsv.split('\n')) {
    if (l.startsWith('#') || l.trim() === '') continue;
    const [cle, fr] = l.split('\t');
    if (cle !== 'cle') dire[cle] = fr;
  }
  return lireEcrans({ dire });
}
const { dire: T, direMots: TM } = textesSource();
const modele = lireModele(JSON.parse(readFileSync(new URL('../../../public/data/0.1.0/tons.json', import.meta.url), 'utf8'))) as Modele;

const mot = (hanzi: string, pinyin: string, fr: string): Mot => ({ hanzi, pinyin, fr, en: '' });
const f = (c: string, pinyin: string, fr: string, mots: Mot[] = []): Fiche => ({
  c,
  pinyin,
  fr,
  en: '',
  parts: [],
  role: 'sens',
  origine_fr: '',
  origine_en: '',
  etiquette: 'atteste',
  mots,
  nouveau: [],
  niveaux: {},
  traits: [],
  medianes: [],
  lectures: [pinyin]
});
const FICHES: Fiche[] = [
  f('你', 'nǐ', 'tu', [mot('你好', 'nǐhǎo', 'bonjour')]),
  f('好', 'hǎo', 'bon', [mot('你好', 'nǐhǎo', 'bonjour'), mot('好看', 'hǎokàn', 'beau')]),
  f('看', 'kàn', 'regarder'),
  f('朋', 'péng', 'ami', [mot('朋友', 'péngyou', 'ami')]),
  f('友', 'yǒu', 'ami'),
  f('不', 'bù', 'ne pas', [mot('不用', 'bùyòng', 'inutile de'), mot('不好', 'bùhǎo', 'pas bon')]),
  f('用', 'yòng', 'utiliser'),
  f('一', 'yī', 'un', [mot('一样', 'yīyàng', 'pareil')]),
  f('样', 'yàng', 'forme')
];
const corpus = (cs: string[]): Corpus => ({ fiches: FICHES, decompositions: {}, acquis: cs.map((c) => ({ c, stabilite: 30 })) });
const TOUS = corpus(FICHES.map((x) => x.c));
const cibleMot = (h: string, carte: string, c = TOUS) => cibleDeMot(FICHES.find((x) => x.c === carte)!.mots.find((m) => m.hanzi === h)!, carte, c);

describe('la cible : un mot de deux caractères acquis', () => {
  it('un mot de la fiche, ses deux caractères acquis : oui, et la carte notée reste celle du caractère', () => {
    const c = cibleMot('好看', '好');
    expect(c?.c).toBe('好看');
    expect(c?.mot?.carte).toBe('好');
    expect(c?.mot?.syllabes).toEqual(['hǎo', 'kàn']);
    expect(attendusDe(c!)).toEqual([3, 4]);
    expect(revisionDire(c!.mot!.carte, 1).c).toBe('好');
  });

  it('un des deux caractères pas encore acquis : non', () => {
    expect(cibleMot('好看', '好', corpus(['好']))).toBeNull();
  });

  it('一 en tête, dont le ton dépend de l’emploi : non', () => {
    expect(cibleMot('一样', '一')).toBeNull();
  });

  it('le ton neutre en deuxième syllabe est attendu tel quel ; jamais en tête', () => {
    expect(attendusDe(cibleMot('朋友', '朋')!)).toEqual([2, 5]);
    expect(cibleDeMot(mot('桌子', 'zhuōzi', 'table'), '桌', TOUS)).toBeNull();
    expect(cibleDeMot(mot('子桌', 'zizhuō', 'rien'), '子', TOUS)).toBeNull();
  });
});

describe('les tons que la voix fait : le sandhi', () => {
  it('deux tons 3 de suite : le premier se dit au ton 2, c’est lui qu’on attend', () => {
    expect(tonsDeSurface('你好', [3, 3])).toEqual({ attendus: [2, 3], sandhi: 'trois-trois' });
    expect(cibleMot('你好', '你')?.mot).toMatchObject({ dico: [3, 3], attendus: [2, 3], sandhi: 'trois-trois' });
  });

  it('不 devant un ton 4 se dit au ton 2 ; devant un autre ton, il garde le sien', () => {
    expect(cibleMot('不用', '不')?.mot).toMatchObject({ dico: [4, 4], attendus: [2, 4], sandhi: 'bu' });
    expect(cibleMot('不好', '不')?.mot).toMatchObject({ attendus: [4, 3], sandhi: null });
  });

  it('la correction le dit, sans reproche, après l’essai', () => {
    const m = cibleMot('你好', '你')!.mot!;
    expect(notesMot(TM, m)).toEqual([TM['sandhi-33']]);
    expect(TM['sandhi-33']).toMatch(/ton 2/);
    expect(notesMot(TM, cibleMot('朋友', '朋')!.mot!)).toEqual([TM.neutre]);
  });
});

describe('la question de mot ne se pose que si la mesure le justifie', () => {
  it('le seuil des mots reconnus est de 77 % (décision du 7 octobre 2026), l’autre ton à tort et le reconnu à tort de 3 %', () => {
    expect(SEUILS_MOTS_DIRE).toEqual({ reconnu: 0.77, autreATort: 0.03, reconnuATort: 0.03 });
    expect(motsJustifies({ reconnu: 0.77, autreATort: 0.03, reconnuATort: 0.03 })).toBe(true);
    expect(motsJustifies({ reconnu: 0.769, autreATort: 0.02, reconnuATort: 0.02 })).toBe(false);
    expect(motsJustifies({ reconnu: 0.9, autreATort: 0.031, reconnuATort: 0.01 })).toBe(false);
    expect(motsJustifies({ reconnu: 0.9, autreATort: 0.01, reconnuATort: 0.031 })).toBe(false);
  });

  it('la mesure du modèle final (77,6 %, 1,9 %, 2,5 %) passe ces seuils : la question de mot est allumée', () => {
    expect(MESURE_MOTS_DIRE).toEqual({ reconnu: 0.776, autreATort: 0.019, reconnuATort: 0.025 });
    expect(motsJustifies()).toBe(true);
    expect(MOTS_DIRE).toBe(true);
    // la mesure du 30 septembre (syllabe par syllabe) ne les passerait pas
    expect(motsJustifies({ reconnu: 0.675, autreATort: 0.021, reconnuATort: 0.017 })).toBe(false);
  });

  it('les mots ne se posent qu’avec le modèle des mots que la mesure a jugé, et leurs textes', () => {
    const mm = lireModeleMots(JSON.parse(readFileSync(new URL('../../../public/data/0.1.0/tons-mots.json', import.meta.url), 'utf8')));
    expect(mm).not.toBeNull();
    expect(motsPossibles(mm, TM)).toBe(true);
    expect(motsPossibles(null, TM)).toBe(false);
    expect(motsPossibles(undefined, TM)).toBe(false);
    expect(motsPossibles(mm, SANS_ECRANS.direMots)).toBe(false);
    expect(motsPossibles(mm, TM, false)).toBe(false);
  });

  it('allumée, la séance demande des mots ; éteinte, que des caractères', () => {
    const graines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(graines.some((g) => cibleDire('好', TOUS, g)?.mot !== undefined)).toBe(true);
    for (const g of graines) expect(cibleDire('好', TOUS, g, false)?.mot).toBeUndefined();
    expect(cibleDEssai(TOUS, [], 0.99, false)?.mot).toBeUndefined();
  });

  it('allumée, une séance sur deux environ demande un mot de la fiche, jamais un mot dont un caractère manque', () => {
    const graines = Array.from({ length: 40 }, (_, k) => `rev/${k}`);
    const mots = graines.filter((g) => cibleDire('好', TOUS, g, true)?.mot !== undefined);
    expect(mots.length).toBeGreaterThan(8);
    expect(mots.length).toBeLessThan(32);
    for (const g of graines) expect(cibleDire('好', corpus(['好']), g, true)?.mot).toBeUndefined();
  });

  it('sans ses textes (un export d’avant), la question de mot ne se pose pas', () => {
    expect(motsLisibles(TM)).toBe(true);
    expect(motsLisibles(SANS_ECRANS.direMots)).toBe(false);
  });
});

describe('la voix coupée en deux syllabes', () => {
  it('une syllabe qui commence par une voix (m, n, l, r, y, w, une voyelle) est liée à la précédente', () => {
    expect(['mā', 'nǐ', 'lè', 'rén', 'yǒu', 'wǒ', 'ài', 'ōu', 'è'].every(commenceVoisee)).toBe(true);
    expect(['kàn', 'shì', 'zhōng', 'bù', 'hǎo', 'xiè'].some(commenceVoisee)).toBe(false);
    expect(cibleMot('朋友', '朋')?.mot?.liees).toEqual([true]);
    expect(cibleMot('好看', '好')?.mot?.liees).toEqual([false]);
  });

  it('un mot synthétique ton 1 puis ton 4, sans silence entre les syllabes : les deux tons reconnus', () => {
    const c = courbesTons(200);
    const x = new Float32Array([...syllabe(c[1], 0.3, { marge: 0.15 }).slice(0, -2400), ...syllabe(c[4], 0.3, { marge: 0.15 }).slice(2400)]);
    const a = analyser(x, 16000, [1, 4], modele, 200, {}, [true]);
    expect(a.syllabes.length).toBe(2);
    expect(a.syllabes.map((s) => s.verdict.entendu)).toEqual([1, 4]);
    expect(a.etat).toBe('juste');
  });

  it('dans un mot, le ton neutre n’est jamais entendu en tête', () => {
    const c = courbesTons(200);
    const x = new Float32Array([...syllabe((u) => 180 - 10 * u, 0.12), ...syllabe(c[1], 0.3)]);
    const a = analyser(x, 16000, [5, 1] as Ton[], modele, 200);
    expect(a.syllabes[0]?.verdict.probabilites[4]).toBe(0);
  });

  it('pour affirmer un autre ton dans un mot, l’app doit en être plus sûre que sur un caractère', () => {
    expect(REGLAGES_MOTS.seuils.autre).toBeGreaterThan(SEUILS_JUGEMENT.autre);
    expect(REGLAGES_MOTS.seuils.attenduMax).toBeLessThan(SEUILS_JUGEMENT.attenduMax);
    const p = [0.02, 0.03, 0.93, 0.01, 0.01];
    expect(juger(2, p).etat).toBe('autre');
    expect(juger(2, p, undefined, { ...SEUILS_JUGEMENT, ...REGLAGES_MOTS.seuils }).etat).toBe('redemander');
  });

  it('le mot est reconnu seulement si ses deux syllabes le sont', () => {
    const c = courbesTons(200);
    const x = new Float32Array([...syllabe(c[1], 0.3), ...syllabe(c[4], 0.3)]);
    expect(analyser(x, 16000, [1, 4], modele, 200).etat).toBe('juste');
    expect(analyser(x, 16000, [1, 2], modele, 200).etat).not.toBe('juste');
  });
});

describe('la courbe et les phrases d’un mot', () => {
  it('la courbe enchaîne les deux syllabes, quinze points chacune, et le modèle suit les tons attendus', () => {
    const c = (moyenne: number) => ({ points: Array.from({ length: 30 }, () => 0), moyenne, duree: 0.2, voisement: 1 });
    const { voix, modele: m } = courbesMot([c(220), c(180)], [1, 4], undefined);
    expect(voix?.length).toBe(30);
    expect(m.length).toBe(30);
    expect((voix as number[])[0]).toBeGreaterThan((voix as number[])[29]);
    expect(m[14]).toBeGreaterThan(m[29]);
    expect(courbesMot(null, [2, 3], 200).voix).toBeNull();
  });

  const cm = cibleMot('你好', '你')!.mot as CibleMot;
  const v = (attendu: Ton, p: number[]): Verdict => juger(attendu, p);

  it('reconnu : les deux tons nommés, puis ce que le mot a de particulier', () => {
    const vs = [v(2, [0.02, 0.9, 0.05, 0.02, 0.01]), v(3, [0.02, 0.02, 0.9, 0.05, 0.01])];
    const m = messageDireMot(T, TM, cm, vs, 'juste', null);
    expect(m).toMatch(/^Ton 2 puis ton 3 : c'est bien ça\./);
    expect(m).toContain(TM['sandhi-33']);
  });

  it('un autre ton sûr : la syllabe nommée par son rang, le ton entendu et un conseil', () => {
    const vs = [v(2, [0.005, 0.005, 0.985, 0.0025, 0.0025]), v(3, [0.02, 0.02, 0.9, 0.05, 0.01])];
    const m = messageDireMot(T, TM, cm, vs, 'autre', null);
    expect(m).toMatch(/^Première syllabe, ton 2 attendu/);
    expect(m).toContain('ton 3');
    expect(m).toContain(T['conseil-2-3']);
  });

  it('aucune phrase de mot ne fait de reproche, quel que soit le couple', () => {
    const REPROCHE = /\b(faux|fausse|erreur|rat[ée]|mauvais|échec|dommage|non|nul)\b/i;
    for (const [cle, texte] of Object.entries(TM)) {
      expect(texte, cle).not.toBe('');
      expect(texte, cle).not.toMatch(REPROCHE);
    }
    const neutre = cibleMot('朋友', '朋')!.mot as CibleMot;
    for (const e of [1, 2, 3, 4, 5] as Ton[]) {
      const p = [0, 1, 2, 3, 4].map((k) => (k === e - 1 ? 0.996 : 0.001));
      const vs = [v(2, [0.02, 0.9, 0.05, 0.02, 0.01]), v(5, p)];
      expect(messageDireMot(T, TM, neutre, vs, vs[1].etat === 'juste' ? 'juste' : vs[1].etat, null)).not.toMatch(REPROCHE);
    }
    for (const pb of ['silence', 'court', 'sature'] as const) expect(messageDireMot(T, TM, cm, null, null, pb)).not.toMatch(REPROCHE);
  });
});
