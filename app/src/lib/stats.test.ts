/**
 * Le tableau des révisions (`stats.ts`) : un test par règle.
 */
import { readFileSync } from 'node:fs';
import { Rating, type Grade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { lireEcrans } from './ecrans';
import { emptyProgress, planifierCarte, type Progress } from './session';
import { newCard, type ReviewCard, type ReviewLogEntry } from './srs';
import {
  FENETRE_JOURS,
  MAX_RESISTENT,
  MIN_MESURE,
  aVenir,
  ligneAVenir,
  ligneBarre,
  ligneEntree,
  ligneManques,
  ligneRetention,
  nomDuJour,
  resistent,
  retention,
  totalAVenir
} from './stats';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const TEXTES = lireEcrans(JSON.parse(source('../../public/data/0.1.0/ecrans.json')) as unknown).revisions;

/** Un mardi, 10 h, heure locale. */
const MAINTENANT = new Date(2026, 8, 29, 10, 0);
const JOUR = 86_400_000;

function a(jours: number, heures = 0): Date {
  return new Date(MAINTENANT.getTime() + jours * JOUR + heures * 3_600_000);
}

/** Une carte due à une date donnée, sans historique. */
function due(id: string, quand: Date): ReviewCard {
  const k = newCard(id, a(-40));
  return { ...k, card: { ...k.card, due: quand } };
}

/** Une ligne d'historique : quand, quelle note, et l'intervalle planifié ensuite, en jours. */
function ligne(jours: number, rating: Grade, intervalle: number): ReviewLogEntry {
  return { at: a(jours), rating, due: a(jours + intervalle) };
}

function histoire(id: string, lignes: ReviewLogEntry[], stabilite = 5): ReviewCard {
  const k = newCard(id, a(-60));
  return { ...k, card: { ...k.card, stability: stabilite }, history: lignes };
}

describe('ce qui revient, les sept prochains jours', () => {
  it('une carte par jour d’échéance, en heure locale, aujourd’hui compris', () => {
    const jours = aVenir([due('人', a(0, 3)), due('大', a(1)), due('天', a(1, 2)), due('口', a(6))], MAINTENANT);
    expect(jours.map((j) => j.n)).toEqual([1, 2, 0, 0, 0, 0, 1]);
    expect(totalAVenir(jours)).toBe(4);
  });

  it('aujourd’hui compte aussi les cartes déjà dues', () => {
    expect(aVenir([due('人', a(-3))], MAINTENANT)[0].n).toBe(1);
  });

  it('au-delà de sept jours, rien', () => {
    expect(totalAVenir(aVenir([due('人', a(8))], MAINTENANT))).toBe(0);
  });

  it('les cartes mises de côté ne comptent pas, comme dans la pile due', () => {
    expect(totalAVenir(aVenir([due('人', a(1))], MAINTENANT, ['人']))).toBe(0);
  });

  it('chaque jour porte son jour de semaine, le premier dit « auj. »', () => {
    const jours = aVenir([], MAINTENANT);
    expect(jours.map((j) => j.semaine)).toEqual([2, 3, 4, 5, 6, 0, 1]);
    expect(jours.map((j) => nomDuJour(TEXTES, j))).toEqual(['auj.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.', 'lun.']);
  });
});

describe('ce qu’on retient, sur trente jours', () => {
  it('parmi les cartes revenues à leur échéance, la part de celles qu’on savait', () => {
    const cartes = Array.from({ length: 10 }, (_, i) =>
      histoire(`c${i}`, [ligne(-20, Rating.Good, 4), ligne(-16, i < 8 ? Rating.Good : Rating.Again, 10)])
    );
    const r = retention(cartes, MAINTENANT);
    expect(r).toEqual({ revues: 10, sues: 8, mesure: 0.8 });
  });

  it('juste après une erreur, la carte est sue : seul « Oublié » compte faux', () => {
    const cartes = Array.from({ length: 10 }, (_, i) =>
      histoire(`c${i}`, [ligne(-20, Rating.Good, 4), ligne(-16, Rating.Hard, 3)])
    );
    expect(retention(cartes, MAINTENANT).mesure).toBe(1);
  });

  it('la première rencontre et le retour à dix minutes ne sont pas des échéances', () => {
    const k = histoire('人', [
      ligne(-10, Rating.Again, 10 / 1440),
      { at: new Date(a(-10).getTime() + 600_000), rating: Rating.Good, due: a(-6) },
      ligne(-6, Rating.Good, 8)
    ]);
    expect(retention([k], MAINTENANT).revues).toBe(1);
  });

  it('hors de la fenêtre de trente jours, rien', () => {
    const k = histoire('人', [ligne(-50, Rating.Good, 10), ligne(-40, Rating.Again, 1)]);
    expect(retention([k], MAINTENANT).revues).toBe(0);
    expect(FENETRE_JOURS).toBe(30);
  });

  it('sous dix cartes revenues, la rétention ne se mesure pas', () => {
    const cartes = Array.from({ length: MIN_MESURE - 1 }, (_, i) =>
      histoire(`c${i}`, [ligne(-20, Rating.Good, 4), ligne(-16, Rating.Good, 10)])
    );
    const r = retention(cartes, MAINTENANT);
    expect(r.mesure).toBeNull();
    expect(ligneRetention(TEXTES, r, 0.9)).toBe(
      'Sur 30 jours, pas encore assez de cartes revenues à leur échéance pour mesurer : il en faut 10.'
    );
  });

  it('la mesure se dit face à la cible réglée', () => {
    expect(ligneRetention(TEXTES, { revues: 64, sues: 56, mesure: 56 / 64 }, 0.9)).toBe(
      'Sur 30 jours, tu as su 88 % des 64 cartes revenues à leur échéance. La cible est de 90 %.'
    );
  });

  it('se calcule sur ce que la progression garde déjà, la notation de srs.ts', () => {
    let p: Progress = emptyProgress('2026-08-01');
    for (let j = 0; j < 12; j++) {
      p = planifierCarte(p, `k${j}`, { correct: true, tries: 0, seconds: 2 }, a(-25));
      p = planifierCarte(p, `k${j}`, { correct: j !== 0, tries: 0, seconds: 2 }, a(-12));
    }
    const r = retention(p.cartes, MAINTENANT);
    expect(r.revues).toBe(12);
    expect(r.sues).toBe(11);
  });
});

describe('ceux qui te résistent', () => {
  it('les plus souvent manqués sur trente jours, le plus manqué d’abord', () => {
    const cartes = [
      histoire('人', [ligne(-5, Rating.Again, 0), ligne(-4, Rating.Good, 2)]),
      histoire('大', [ligne(-9, Rating.Again, 0), ligne(-7, Rating.Again, 0), ligne(-3, Rating.Good, 2)]),
      histoire('天', [ligne(-3, Rating.Good, 5)])
    ];
    expect(resistent(cartes, MAINTENANT)).toEqual([
      { c: '大', manques: 2 },
      { c: '人', manques: 1 }
    ]);
  });

  it('à égalité, le plus fragile d’abord', () => {
    const cartes = [
      histoire('人', [ligne(-5, Rating.Again, 0)], 9),
      histoire('大', [ligne(-5, Rating.Again, 0)], 2)
    ];
    expect(resistent(cartes, MAINTENANT).map((x) => x.c)).toEqual(['大', '人']);
  });

  it('une erreur d’il y a plus de trente jours ne compte plus', () => {
    expect(resistent([histoire('人', [ligne(-31, Rating.Again, 1)])], MAINTENANT)).toEqual([]);
  });

  it('au plus cinq', () => {
    const cartes = Array.from({ length: 8 }, (_, i) => histoire(`c${i}`, [ligne(-2, Rating.Again, 0)]));
    expect(resistent(cartes, MAINTENANT)).toHaveLength(MAX_RESISTENT);
  });
});

describe('les lignes viennent du pipeline', () => {
  it('l’entrée de Ma forêt : « Demain 2 · cette semaine 4 »', () => {
    const jours = aVenir([due('人', a(0, 3)), due('大', a(1)), due('天', a(1, 2)), due('口', a(6))], MAINTENANT);
    expect(ligneEntree(TEXTES, jours)).toBe('Demain 2 · cette semaine 4');
    expect(ligneEntree(TEXTES, aVenir([], MAINTENANT))).toBe(TEXTES['entree-vide']);
  });

  it('les sept jours, les barres, les manques', () => {
    expect(ligneAVenir(TEXTES, 41)).toBe('41 cartes reviennent cette semaine.');
    expect(ligneAVenir(TEXTES, 1)).toBe('Une carte revient cette semaine.');
    expect(ligneAVenir(TEXTES, 0)).toBe('Aucune carte ne revient cette semaine.');
    expect(ligneBarre(TEXTES, { decalage: 1, semaine: 3, n: 4 })).toBe('mer. : 4 cartes');
    expect(ligneBarre(TEXTES, { decalage: 0, semaine: 2, n: 1 })).toBe('auj. : une carte');
    expect(ligneManques(TEXTES, 3)).toBe('manqué 3 fois');
    expect(ligneManques(TEXTES, 1)).toBe('manqué une fois');
  });

  it('aucun texte de l’écran n’est écrit dans le code', () => {
    for (const f of ['stats.ts', 'Revisions.svelte', 'RevisionsEntree.svelte']) {
      for (const t of ['Tes révisions', 'Ceux qui te résistent', 'Ce que tu retiens', 'prochains jours']) {
        const sans = source(f).replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/.*$/gm, '');
        expect(sans, `${f} : ${t}`).not.toContain(t);
      }
    }
  });
});

describe('la charte : rien au temps passé, ni classement, ni percentile', () => {
  const code = (f: string): string => source(f).replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/.*$/gm, '');

  it('aucune règle ne lit une durée ni un temps de réponse', () => {
    expect(code('stats.ts')).not.toMatch(/seconds|elapsed|duree|durée|chrono/i);
  });

  it('ni classement, ni percentile, ni comparaison', () => {
    for (const f of ['stats.ts', 'Revisions.svelte', 'RevisionsEntree.svelte']) {
      expect(code(f), f).not.toMatch(/classement|percentile|\bmieux que\b|leaderboard/i);
    }
  });

  it('des barres à plat : ni cinabre, ni ombre, ni dégradé', () => {
    for (const f of ['Revisions.svelte', 'RevisionsEntree.svelte']) {
      const c = code(f);
      expect(c, f).not.toMatch(/--zhu|#C8371F|cinabre/i);
      expect(c, f).not.toMatch(/gradient|box-shadow|drop-shadow|text-shadow/i);
    }
  });

  it('les caractères qui résistent se dessinent depuis leurs traits', () => {
    expect(source('Revisions.svelte')).toMatch(/<Glyph\b/);
  });
});
