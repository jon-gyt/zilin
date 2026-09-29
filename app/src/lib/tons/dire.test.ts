/**
 * « Dis-le » (story 9.1) : un test par règle produit. Le corpus est écrit en dur ; les
 * textes viennent de l'export (`ecrans.json`, écran `dire`), comme dans l'app.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rating } from 'ts-fsrs';
import type { Fiche } from '../content';
import { lireEcrans } from '../ecrans';
import { serie, type Corpus } from '../questions';
import { grade } from '../srs';
import { emptyProgress, fromJSON, noterRevision, noterVoix, planifierCarte, setDireTons, setVoixReference, toJSON } from '../session';
import { juger, type Ton } from './classifieur';
import {
  ESSAIS_DIRE,
  choisirDire,
  cibleDEssai,
  cibleDeFiche,
  cibleDire,
  courbeModele,
  courbes,
  issueDire,
  messageDire,
  revisionDire
} from './dire';
import { MIN_VOIX, refLocuteur } from './voix';

const T = lireEcrans(JSON.parse(readFileSync(new URL('../../../public/data/0.1.0/ecrans.json', import.meta.url), 'utf8'))).dire;

const f = (c: string, pinyin: string, fr: string, lectures: string[] = [pinyin]): Fiche => ({
  c,
  pinyin,
  fr,
  en: '',
  parts: [],
  role: 'sens',
  origine_fr: '',
  origine_en: '',
  etiquette: 'atteste',
  mots: [],
  nouveau: [],
  niveaux: {},
  traits: [],
  medianes: [],
  lectures
});

const FICHES: Fiche[] = [
  f('人', 'rén', 'une personne'),
  f('大', 'dà', 'grand'),
  f('天', 'tiān', 'le ciel'),
  f('马', 'mǎ', 'le cheval'),
  f('吗', 'ma', 'particule interrogative'),
  f('好', 'hǎo', 'bon', ['hǎo', 'hào']),
  f('子', 'zǐ', '')
];

const acquis = (cs: string[], stabilite = 30) => cs.map((c) => ({ c, stabilite }));
const corpus = (cs: string[], stabilite = 30): Corpus => ({ fiches: FICHES, decompositions: {}, acquis: acquis(cs, stabilite) });
const OUI = { reglage: true, micro: true, modele: true };
const JOUR = '2026-09-29';

describe('la cible : un caractère isolé déjà acquis', () => {
  it('un caractère acquis, sa lecture connue, un des quatre tons, un sens : oui', () => {
    expect(cibleDire('马', corpus(['马']))).toEqual({ c: '马', ton: 3, pinyin: 'mǎ', sens: 'le cheval' });
  });

  it('un caractère pas encore acquis (stabilité sous le seuil) : non', () => {
    expect(cibleDire('马', corpus(['马'], 2))).toBeNull();
  });

  it('le ton neutre, qu’un caractère isolé n’a pas : non', () => {
    expect(cibleDire('吗', corpus(['吗']))).toBeNull();
  });

  it('un caractère sans sens à montrer : non', () => {
    expect(cibleDeFiche(FICHES.find((x) => x.c === '子') as Fiche)).toBeNull();
  });

  it('un polyphone : seule la lecture principale est attendue', () => {
    expect(cibleDire('好', corpus(['好']))?.ton).toBe(3);
    expect(cibleDeFiche({ ...(FICHES.find((x) => x.c === '好') as Fiche), lectures: undefined })).toBeNull();
  });
});

describe('où la question se pose', () => {
  const qs = serie(['人', '大', '天', '马'], corpus(['人', '大', '天', '马']), 'rev/2026-09-29');

  it('au plus une question « Dis-le » par séance, sur une cible, toujours la même pour la même graine', () => {
    const i = choisirDire(qs, corpus(['人', '大', '天', '马']), 'rev/2026-09-29', OUI);
    expect(i).not.toBeNull();
    expect(cibleDire(qs[i as number].c, corpus(['人', '大', '天', '马']))).not.toBeNull();
    expect(choisirDire(qs, corpus(['人', '大', '天', '马']), 'rev/2026-09-29', OUI)).toBe(i);
  });

  it('jamais si le micro est refusé ou absent', () => {
    expect(choisirDire(qs, corpus(['人', '大', '天', '马']), 'g', { ...OUI, micro: false })).toBeNull();
  });

  it('jamais si le réglage « Dire les tons » est éteint', () => {
    expect(choisirDire(qs, corpus(['人', '大', '天', '马']), 'g', { ...OUI, reglage: false })).toBeNull();
  });

  it('jamais sans modèle des tons', () => {
    expect(choisirDire(qs, corpus(['人', '大', '天', '马']), 'g', { ...OUI, modele: false })).toBeNull();
  });

  it('jamais sans caractère acquis dans la séance', () => {
    expect(choisirDire(qs, corpus([]), 'g', OUI)).toBeNull();
  });
});

describe('la notation, automatique', () => {
  it('le ton reconnu : noté, « Bien », et un point 说', () => {
    expect(issueDire('juste', 1)).toBe('note');
    const r = revisionDire('马', 1.2);
    expect(grade(r)).toBe(Rating.Good);
    expect(r.art).toBe('shuo');
    const p = noterRevision(emptyProgress(JOUR), JOUR, r);
    expect(p.arts.shuo).toBe(1);
    const carte = planifierCarte(emptyProgress(JOUR), '马', r, new Date('2026-09-29T09:00:00Z')).cartes[0];
    expect(carte.history[0].rating).toBe(Rating.Good);
  });

  it('un autre ton ou une confiance basse : rien n’est noté, on redemande', () => {
    expect(issueDire('autre', 1)).toBe('redemander');
    expect(issueDire('redemander', 2)).toBe('redemander');
    expect(issueDire(null, 1)).toBe('redemander');
  });

  it('trois essais au plus, puis on passe sans rien noter', () => {
    expect(ESSAIS_DIRE).toBe(3);
    expect(issueDire('autre', 3)).toBe('passer');
    expect(issueDire(null, 3)).toBe('passer');
    expect(issueDire('juste', 3)).toBe('note');
  });
});

describe('la courbe du modèle : la forme canonique du ton attendu', () => {
  it('le ton 1 est plat et haut, le 2 monte, le 3 creuse puis remonte, le 4 tombe', () => {
    const c1 = courbeModele(1);
    expect(Math.max(...c1) - Math.min(...c1)).toBe(0);
    expect(c1[0]).toBeGreaterThan(0);
    const c2 = courbeModele(2);
    expect(c2[29]).toBeGreaterThan(c2[0]);
    const c3 = courbeModele(3);
    const creux = c3.indexOf(Math.min(...c3));
    expect(creux).toBeGreaterThan(5);
    expect(creux).toBeLessThan(25);
    const c4 = courbeModele(4);
    expect(c4[29]).toBeLessThan(c4[0]);
  });

  it('sans voix connue, les deux courbes sont centrées : on compare les formes', () => {
    const contour = { points: courbeModele(1).map(() => 0), moyenne: 220, duree: 0.4, voisement: 1 };
    const { voix, modele } = courbes(contour, 1, undefined);
    expect(Math.abs(modele.reduce((a, b) => a + b, 0))).toBeLessThan(1e-9);
    expect(voix).toEqual(contour.points);
    const connue = courbes(contour, 1, 110);
    expect(connue.voix?.[0]).toBeCloseTo(12, 5);
  });
});

describe('les phrases', () => {
  const REPROCHE = /\b(faux|fausse|erreur|rat[ée]|mauvais|échec|dommage|non|nul)\b/i;

  it('viennent du pipeline, toutes présentes', () => {
    for (const [cle, texte] of Object.entries(T)) expect(texte, cle).not.toBe('');
  });

  it('le ton reconnu est nommé par sa forme', () => {
    expect(messageDire(T, juger(3, [0.05, 0.05, 0.85, 0.03, 0.02]), null)).toMatch(/^Ton 3 : ta voix descend dans le grave puis remonte/);
  });

  it('un autre ton sûr : le ton entendu et un conseil qui dit quoi faire', () => {
    const m = messageDire(T, juger(2, [0.01, 0.02, 0.95, 0.01, 0.01]), null);
    expect(m).toMatch(/^Ton 2 attendu/);
    expect(m).toContain('ton 3');
    expect(m).toContain('Monte tout de suite');
  });

  it('aucune phrase ne fait de reproche, quel que soit le couple', () => {
    for (const a of [1, 2, 3, 4] as Ton[]) {
      for (let i = 0; i < 5; i++) {
        const p = [0, 1, 2, 3, 4].map((k) => (k === i ? 0.96 : 0.01));
        expect(messageDire(T, juger(a, p), null)).not.toMatch(REPROCHE);
      }
    }
    for (const pb of ['silence', 'court', 'sature'] as const) expect(messageDire(T, null, pb)).not.toMatch(REPROCHE);
    expect(T.passer).not.toMatch(REPROCHE);
  });
});

describe('l’essai des Réglages', () => {
  it('prend un caractère acquis au hasard', () => {
    const c = corpus(['马', '大']);
    expect(['马', '大']).toContain(cibleDEssai(c, [], 0.1)?.c);
    expect(['马', '大']).toContain(cibleDEssai(c, [], 0.99)?.c);
  });

  it('sans acquis, un caractère rencontré, sinon n’importe quelle fiche : l’essai n’est jamais muet', () => {
    expect(cibleDEssai(corpus([], 1), ['天'], 0.5)?.c).toBe('天');
    expect(cibleDEssai(corpus([], 1), [], 0.5)).not.toBeNull();
  });
});

describe('la progression', () => {
  it('« Dire les tons » est allumé par défaut, et relu allumé d’un export qui ne le porte pas', () => {
    expect(emptyProgress(JOUR).direTons).toBe(true);
    const ancien = JSON.parse(toJSON(emptyProgress(JOUR))) as Record<string, unknown>;
    delete ancien.direTons;
    delete ancien.voix;
    const relu = fromJSON(JSON.stringify(ancien), JOUR);
    expect(relu.direTons).toBe(true);
    expect(relu.voix).toEqual([]);
  });

  it('le réglage éteint sort et rentre avec l’export', () => {
    const p = setDireTons(emptyProgress(JOUR), false);
    expect(fromJSON(toJSON(p), JOUR).direTons).toBe(false);
  });

  it('la voix s’apprend en cinq syllabes, et seule sa moyenne est gardée, jamais le son', () => {
    let p = emptyProgress(JOUR);
    for (const hz of [210, 190, 205, 200]) p = noterVoix(p, hz);
    expect(refLocuteur(p.voix)).toBeUndefined();
    p = noterVoix(p, 400);
    expect(p.voix.length).toBe(MIN_VOIX);
    expect(refLocuteur(p.voix)).toBeCloseTo(205, 6);
    const exporte = JSON.parse(toJSON(p)) as Record<string, unknown>;
    expect(exporte.voix).toEqual([210, 190, 205, 200, 400]);
    expect((exporte.voix as unknown[]).every((v) => typeof v === 'number')).toBe(true);
    expect(fromJSON(toJSON(p), JOUR).voix).toEqual(p.voix);
  });
});

describe('le réglage « Voix »', () => {
  it('la voix par défaut d’abord ; le choix se garde, s’exporte et se réimporte ; un choix inconnu rend le défaut', () => {
    expect(emptyProgress(JOUR).voixReference).toBeNull();
    const p = setVoixReference(emptyProgress(JOUR), 'enregistree');
    expect(fromJSON(toJSON(p), JOUR).voixReference).toBe('enregistree');
    const ancien = JSON.parse(toJSON(emptyProgress(JOUR))) as Record<string, unknown>;
    delete ancien.voixReference;
    expect(fromJSON(JSON.stringify(ancien), JOUR).voixReference).toBeNull();
    expect(fromJSON(JSON.stringify({ ...ancien, voixReference: 'robot' }), JOUR).voixReference).toBeNull();
  });
});

