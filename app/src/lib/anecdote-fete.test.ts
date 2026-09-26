/**
 * L'anecdote d'une fête se montre une fois par occurrence (retour du propriétaire du
 * 26 septembre 2026 : « Pourquoi l'anecdote n'a pas changé depuis 3 jours !!! »). Le décor,
 * le vœu et Tao restent toute la fenêtre ; l'anecdote, elle, revient à l'ordinaire. Une
 * règle par test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFetes, loadSaisons, type Anecdote, type Fetes, type Saisons } from './content';
import { feteDuJour } from './fetes';
import { anecdoteDeFete, anecdoteDeLaJournee, journee, noterAnecdoteMontree, suiviDe } from './saisons';
import { emptyProgress, fromJSON, toJSON, type Progress } from './session';
import { rencontreDuJour } from './trouves';

/* Les fichiers servis avec l'app, tels que `wenlu export` les écrit. */
const lire = (f: string): string => readFileSync(new URL(`../../public/data/0.1.0/${f}`, import.meta.url), 'utf8');

function repondre(corps: string): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => JSON.parse(corps) })) as unknown as typeof fetch;
}

const fetes: Fetes = await loadFetes('data/0.1.0/fetes.json', repondre(lire('fetes.json')));
const saisons: Saisons = await loadSaisons('data/0.1.0/saisons.json', repondre(lire('saisons.json')));

const liste: Anecdote[] = [
  { c: '人', titre: 'Un', texte: 'Premier.' },
  { c: '大', titre: 'Deux', texte: 'Second.' },
  { c: '天', titre: 'Trois', texte: 'Troisième.' }
];

/* La mi-automne 2026 tombe le 25 septembre, fenêtre de trois jours avant au lendemain. */
const FENETRE = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];

/** Ce que l'écran Ouvrir montre ce jour-là, et la progression après l'avoir montré. */
function ouvrir(p: Progress, jour: string) {
  const r = anecdoteDeLaJournee(liste, fetes, saisons, jour, suiviDe(p));
  return { r, p: noterAnecdoteMontree(p, r, jour) };
}

/** Ouvre l'app chaque jour de `jours`, dans l'ordre : ce que chaque journée a montré. */
function suivre(jours: readonly string[], depart: Progress = emptyProgress(jours[0])) {
  let p = depart;
  const montrees: { jour: string; fete: boolean; c: string }[] = [];
  for (const jour of jours) {
    const o = ouvrir(p, jour);
    p = o.p;
    montrees.push({ jour, fete: o.r?.fete != null, c: o.r?.a.c ?? '' });
  }
  return { p, montrees };
}

describe("l'anecdote d'une fête, une fois par occurrence", () => {
  it('la fenêtre de la mi-automne 2026 couvre cinq jours, du 22 au 26 septembre', () => {
    for (const jour of FENETRE) expect(feteDuJour(fetes, jour)?.id, jour).toBe('zhongqiu');
    expect(feteDuJour(fetes, '2026-09-21')).toBeNull();
    expect(feteDuJour(fetes, '2026-09-27')).toBeNull();
  });

  it("ouverte chaque jour de la fenêtre, l'anecdote de la fête se montre une seule fois, le premier jour", () => {
    const { montrees, p } = suivre(FENETRE);
    expect(montrees.filter((m) => m.fete).map((m) => m.jour)).toEqual(['2026-09-22']);
    expect(montrees[0].c).toBe(feteDuJour(fetes, '2026-09-22')?.anecdote.c);
    expect(p.fetesVues).toEqual({ zhongqiu: '2026-09-22' });
  });

  it("le lendemain, c'est l'anecdote ordinaire du jour", () => {
    const { montrees } = suivre(FENETRE);
    for (const m of montrees.slice(1)) {
      expect(m.fete, m.jour).toBe(false);
      expect(liste.map((a) => a.c), m.jour).toContain(m.c);
    }
  });

  it("qui n'ouvre l'app qu'après la fête la trouve quand même, le lendemain de la fête", () => {
    const { montrees } = suivre(['2026-09-20', '2026-09-26', '2026-09-27']);
    expect(montrees.map((m) => m.fete)).toEqual([false, true, false]);
    /* et son caractère bonus est trouvé ce jour-là */
    const p = { ...emptyProgress('2026-09-26'), fetesVues: { zhongqiu: '2026-09-26' } };
    expect(rencontreDuJour(journee(fetes, saisons, '2026-09-26'), p.fetesVues, '2026-09-26')).toEqual({
      c: '月',
      fete: 'zhongqiu'
    });
  });

  it('le décor, le vœu et Tao restent toute la fenêtre, anecdote vue ou pas', () => {
    const { p } = suivre(FENETRE);
    for (const jour of FENETRE) {
      const j = journee(fetes, saisons, jour);
      expect(j.theme.fete, jour).toBe('zhongqiu');
      expect(j.fete?.voeu.zh, jour).not.toBe('');
      expect(j.fete?.tao.length, jour).toBeGreaterThan(0);
      /* la journée ne dépend pas de la progression : seule l'anecdote en dépend */
      expect(anecdoteDeFete(j.fete, p.fetesVues, jour), jour).toBe(jour === '2026-09-22');
    }
  });

  it("relue le même jour, depuis Lire ou l'en-tête du menu, c'est la même que l'écran Ouvrir", () => {
    const matin = ouvrir(emptyProgress('2026-09-24'), '2026-09-24');
    const relue = anecdoteDeLaJournee(liste, fetes, saisons, '2026-09-24', suiviDe(matin.p));
    expect(relue?.fete?.id).toBe('zhongqiu');
    expect(relue?.a).toEqual(matin.r?.a);
    /* le lendemain, l'ordinaire, relue autant qu'on veut, toujours la même */
    const demain = ouvrir(matin.p, '2026-09-25');
    const relueDemain = anecdoteDeLaJournee(liste, fetes, saisons, '2026-09-25', suiviDe(demain.p));
    expect(demain.r?.fete).toBeNull();
    expect(relueDemain?.a).toEqual(demain.r?.a);
    /* la fête reste notée à sa journée ; seule l'anecdote ordinaire du lendemain s'ajoute */
    expect(demain.p.fetesVues).toEqual(matin.p.fetesVues);
  });

  it("une occurrence d'une autre année ne compte pas : la mi-automne 2027 se montre de nouveau", () => {
    const { p } = suivre(FENETRE);
    const o = ouvrir(p, '2027-09-14');
    expect(o.r?.fete?.id).toBe('zhongqiu');
    expect(o.p.fetesVues).toEqual({ zhongqiu: '2027-09-14' });
  });

  it('le Nouvel An, quinze jours de fenêtre, ne montre son anecdote qu’une fois', () => {
    const jours = Array.from({ length: 15 }, (_, i) => new Date(Date.UTC(2026, 1, 16 + i)).toISOString().slice(0, 10));
    for (const jour of jours) expect(feteDuJour(fetes, jour)?.id, jour).toBe('chunjie');
    const { montrees } = suivre(jours);
    expect(montrees.filter((m) => m.fete)).toHaveLength(1);
  });

  it("le caractère bonus ne se trouve que le jour où l'anecdote de la fête se montre", () => {
    const vues = { zhongqiu: '2026-09-22' };
    expect(rencontreDuJour(journee(fetes, saisons, '2026-09-22'), vues, '2026-09-22')?.c).toBe('月');
    expect(rencontreDuJour(journee(fetes, saisons, '2026-09-23'), vues, '2026-09-23')).toBeNull();
  });
});

describe("l'export et l'import des fêtes vues", () => {
  it('les fêtes vues font l’aller-retour', () => {
    const p = { ...emptyProgress('2026-09-26'), fetesVues: { zhongqiu: '2026-09-22', chunjie: '2026-02-16' } };
    expect(fromJSON(toJSON(p), '2026-09-26').fetesVues).toEqual(p.fetesVues);
  });

  it('un export plus ancien, sans le champ, se relit sans fête vue ; une entrée aberrante est écartée', () => {
    const ancien = JSON.parse(toJSON(emptyProgress('2026-09-26'))) as Record<string, unknown>;
    delete ancien.fetesVues;
    expect(fromJSON(JSON.stringify(ancien), '2026-09-26').fetesVues).toEqual({});
    ancien.fetesVues = { zhongqiu: 'hier', '': '2026-09-22', chunjie: '2026-02-16', qixi: 7 };
    expect(fromJSON(JSON.stringify(ancien), '2026-09-26').fetesVues).toEqual({ chunjie: '2026-02-16' });
  });
});
