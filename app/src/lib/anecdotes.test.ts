/**
 * L'anecdote ordinaire du jour : un caractère que l'apprenant vient de rencontrer, sinon
 * un tour de la liste, jamais de redite en trente jours, la même toute la journée. Une
 * règle par test, sur les fichiers que `wenlu export` écrit.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JOURS_RECENTS, SANS_REDITE, autourDuJour, choisirAnecdote, prochains, recents } from './anecdotes';
import { loadSaisons, type Anecdote, type Anecdotes, type Index, type Saisons } from './content';
import { anecdoteDeLaJournee, noterAnecdoteMontree, suiviDe } from './saisons';
import { emptyProgress, fromJSON, jourRencontre, toJSON, type Progress } from './session';

const lire = (f: string): string => readFileSync(new URL(`../../public/data/0.1.0/${f}`, import.meta.url), 'utf8');
const index = JSON.parse(lire('index.json')) as Index;
const liste = (JSON.parse(lire('anecdotes.json')) as Anecdotes).anecdotes;
function repondre(corps: string): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => JSON.parse(corps) })) as unknown as typeof fetch;
}
const saisons: Saisons = await loadSaisons('data/0.1.0/saisons.json', repondre(lire('saisons.json')));

/** Une date AAAA-MM-JJ, `n` jours après le 1er mars 2026 (ni fête, ni terme n'y comptent ici). */
const jour = (n: number): string => new Date(Date.UTC(2026, 2, 1 + n)).toISOString().slice(0, 10);

/** Une progression faite, au jour `j` du parcours Lire, avant la leçon du jour. */
function auJour(j: number, jourCivil: string): Progress {
  return { ...emptyProgress(jourCivil), premiere: false, parcours: 'lire', jourParcours: j, days: j };
}

/** Ce que l'écran Ouvrir montre ce jour-là (sans fête ni terme), puis la progression notée. */
function ouvrir(p: Progress, j: string) {
  const suivi = suiviDe(p, autourDuJour(index, p.parcours, jourRencontre(p)));
  const r = anecdoteDeLaJournee(liste, null, null, j, suivi);
  return { r, p: noterAnecdoteMontree(p, r, j) };
}

const avecAnecdote = new Set(liste.map((a) => a.c));
const briqueDuJour = (j: number): string | null => index.parcours.lire.jours[j - 1]?.brique ?? null;

describe('le fichier du pipeline', () => {
  it('porte plus de soixante anecdotes, sur des caractères du parcours Lire surtout', () => {
    expect(liste.length).toBeGreaterThanOrEqual(60);
    const tot = new Set(index.parcours.lire.jours.slice(0, 90).flatMap((j) => [j.brique, ...j.composes]));
    expect(liste.filter((a) => tot.has(a.c)).length).toBeGreaterThanOrEqual(60);
    expect(new Set(liste.map((a) => a.c)).size).toBe(liste.length);
  });

  it('ni emoji ni dragon', () => {
    for (const a of liste) {
      expect(`${a.titre} ${a.texte}`, a.c).not.toMatch(/龙|龍|dragon|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/iu);
    }
  });
});

describe("les caractères que l'apprenant vient de rencontrer", () => {
  it('la brique du jour et ses composés d’abord, puis ceux des jours d’avant', () => {
    /* jour 5 : 日, 明, 以 ; jour 4 : 月, 从, 朋 ; jours 3 et 2 : 天, 大 ; le jour 1 est trop loin */
    const r = recents(index, 'lire', 5);
    expect(r).toEqual(['日', '明', '以', '月', '从', '朋', '天', '大']);
    expect(r).not.toContain('人');
  });

  it(`pas plus de ${JOURS_RECENTS} jours en arrière`, () => {
    const r = recents(index, 'lire', 40);
    const fenetre = index.parcours.lire.jours
      .filter((j) => j.jour <= 40 && j.jour >= 40 - JOURS_RECENTS)
      .flatMap((j) => [j.brique, ...j.composes]);
    expect(new Set(r)).toEqual(new Set(fenetre.filter(Boolean)));
    expect(r).not.toContain(briqueDuJour(40 - JOURS_RECENTS - 1));
  });

  it('le jour rencontré : la leçon du jour, apprise ou à apprendre ; la veille en rattrapage ; aucun avant la première session', () => {
    expect(jourRencontre(auJour(36, jour(0)))).toBe(36);
    expect(jourRencontre({ ...auJour(37, jour(0)), jourAppris: 36 })).toBe(36);
    expect(jourRencontre({ ...auJour(36, jour(0)), catchup: true })).toBe(35);
    expect(jourRencontre(emptyProgress(jour(0)))).toBe(0);
    expect(recents(index, 'lire', 0)).toEqual([]);
  });
});

describe("l'anecdote ordinaire du jour", () => {
  it('parle de la brique du jour quand elle en a une (文 au jour 36)', () => {
    expect(briqueDuJour(36)).toBe('文');
    expect(ouvrir(auJour(36, jour(0)), jour(0)).r?.a.c).toBe('文');
  });

  it("sinon d'un caractère des derniers jours (工, jour 26, n'en a pas : 心, jour 24)", () => {
    expect(avecAnecdote.has('工')).toBe(false);
    expect(avecAnecdote.has('今')).toBe(false);
    expect(ouvrir(auJour(26, jour(0)), jour(0)).r?.a.c).toBe('心');
  });

  it('sinon le tour de la liste, le même pour une même journée', () => {
    const vide = { ...auJour(1, jour(0)), premiere: true };
    const a = choisirAnecdote(liste, jour(3), [], {});
    expect(a).not.toBeNull();
    expect(choisirAnecdote(liste, jour(3), [], {})).toBe(a);
    expect(ouvrir(vide, jour(3)).r?.a).toBe(a);
    expect(choisirAnecdote(liste, jour(4), [], {})).not.toBe(a);
  });

  it('la même toute la journée, où qu’on la relise, même si la leçon avance entre-temps', () => {
    const matin = ouvrir(auJour(36, jour(0)), jour(0));
    /* la leçon du jour faite, le parcours avance : les récents changent… */
    const soir = { ...matin.p, jourAppris: 36, jourParcours: 37 };
    const plus = { ...soir, jourAppris: undefined };
    for (const q of [matin.p, soir, plus]) {
      const relue = anecdoteDeLaJournee(liste, null, null, jour(0), suiviDe(q, autourDuJour(index, 'lire', jourRencontre(q))));
      expect(relue?.a).toEqual(matin.r?.a);
    }
    /* … et noter de nouveau ne change rien */
    expect(noterAnecdoteMontree(matin.p, matin.r, jour(0))).toBe(matin.p);
  });

  it(`jamais la même anecdote deux fois en ${SANS_REDITE} jours, même quand la leçon piétine`, () => {
    /* en rattrapage, aucune brique nouvelle : les récents restent les mêmes des semaines */
    let p: Progress = { ...auJour(36, jour(0)), catchup: true };
    const montrees: string[] = [];
    for (let n = 0; n < 120; n++) {
      const o = ouvrir({ ...p, day: jour(n) }, jour(n));
      p = o.p;
      montrees.push(o.r?.a.c ?? '');
    }
    for (let n = 0; n < montrees.length; n++) {
      const fenetre = montrees.slice(Math.max(0, n - SANS_REDITE + 1), n);
      expect(fenetre, `${jour(n)} : ${montrees[n]}`).not.toContain(montrees[n]);
    }
    /* les premiers jours parlent des caractères récents (jours 32 à 35) */
    expect(recents(index, 'lire', 35)).toContain(montrees[0]);
  });

  it('en avançant d’une brique par jour, elle suit le chemin, sans redite', () => {
    let p = auJour(1, jour(0));
    const montrees: string[] = [];
    for (let n = 0; n < 90; n++) {
      const o = ouvrir({ ...p, day: jour(n), jourParcours: n + 1, jourAppris: undefined }, jour(n));
      p = o.p;
      montrees.push(o.r?.a.c ?? '');
      if (avecAnecdote.has(briqueDuJour(n + 1) ?? '')) expect(o.r?.a.c, `jour ${n + 1}`).toBe(briqueDuJour(n + 1));
    }
    for (let n = 0; n < montrees.length; n++) {
      expect(montrees.slice(Math.max(0, n - SANS_REDITE + 1), n), `jour ${n + 1}`).not.toContain(montrees[n]);
    }
  });

  it('le tour de la liste garde pour leur jour les caractères que le parcours pose dans le mois', () => {
    const aVenir = prochains(index, 'lire', 40);
    expect(aVenir).toContain(briqueDuJour(41));
    expect(aVenir).not.toContain(briqueDuJour(40));
    expect(aVenir).not.toContain(briqueDuJour(40 + SANS_REDITE + 1));
    for (let n = 0; n < 30; n++) {
      expect(aVenir, jour(n)).not.toContain(choisirAnecdote(liste, jour(n), [], {}, aVenir)?.c);
    }
    /* s'il ne reste qu'eux, on les prend quand même */
    const seul = [{ c: '京', titre: 'Un', texte: 'Un.' }];
    expect(choisirAnecdote(seul, jour(0), [], {}, ['京'])?.c).toBe('京');
  });

  it("une liste plus courte que le mois : celle qui a été montrée le plus tôt revient", () => {
    const courte: Anecdote[] = [
      { c: '人', titre: 'Un', texte: 'Un.' },
      { c: '大', titre: 'Deux', texte: 'Deux.' }
    ];
    const vues = { 人: jour(8), 大: jour(9) };
    expect(choisirAnecdote(courte, jour(10), [], vues)?.c).toBe('人');
    expect(choisirAnecdote([], jour(10), [], {})).toBeNull();
    expect(choisirAnecdote(courte, 'pas une date', [], {})).toBeNull();
  });

  it("le jour où commence un terme, l'anecdote du terme, qui ne se note pas", () => {
    const debut = saisons.calendrier.find((e) => e.debut >= '2026-10-01')?.debut ?? '';
    const p = auJour(36, debut);
    const r = anecdoteDeLaJournee(liste, null, saisons, debut, suiviDe(p, autourDuJour(index, 'lire', 36)));
    expect(r?.terme).not.toBeNull();
    expect(noterAnecdoteMontree(p, r, debut)).toBe(p);
  });

  it('la famille de son caractère vient du fichier : ses traits se lisent sans tout relire', () => {
    const r = ouvrir(auJour(36, jour(0)), jour(0)).r;
    expect(r?.pistes).toEqual([liste.find((a) => a.c === '文')?.racine]);
  });
});

describe("l'export et l'import des anecdotes vues", () => {
  it('les anecdotes vues font l’aller-retour', () => {
    const p = { ...emptyProgress(jour(0)), anecdotesVues: { 文: jour(0), 心: jour(-3) } };
    expect(fromJSON(toJSON(p), jour(0)).anecdotesVues).toEqual(p.anecdotesVues);
  });

  it('un export plus ancien, sans le champ, se relit sans anecdote vue', () => {
    const ancien = JSON.parse(toJSON(emptyProgress(jour(0)))) as Record<string, unknown>;
    delete ancien.anecdotesVues;
    expect(fromJSON(JSON.stringify(ancien), jour(0)).anecdotesVues).toEqual({});
  });
});
