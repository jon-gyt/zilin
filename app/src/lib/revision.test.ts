import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  A_REVOIR,
  SUR,
  corpusFixer,
  corpusRevision,
  decompositionsDe,
  delai,
  derniereNote,
  ficheDeVoisin,
  fichesDuCorpus,
  graineDuJour,
  pinyinDe,
  questionsFixer,
  questionsRevision,
  resume,
  rolesDesElements,
  sures
} from './revision';
import {
  acquis,
  composantSon,
  fiche as ficheDuCorpus,
  lirePaires,
  ressemblance,
  typesPossibles
} from './questions';
import { RETOUR_MINUTES, SEUIL_DEBLOCAGE, newCard, schedule, stability } from './srs';
import type { Famille, Voisins } from './content';
import type { ReviewCard } from './srs';

/* ---------- le contenu servi avec l'app, lu sur disque : aucune requête ---------- */

const famille = JSON.parse(
  readFileSync(new URL('../../public/data/demo/familles/主.json', import.meta.url), 'utf8')
) as Famille;
const voisins = JSON.parse(
  readFileSync(new URL('../../public/data/demo/voisins.json', import.meta.url), 'utf8')
) as Voisins;
const paires = lirePaires(
  JSON.parse(readFileSync(new URL('../../public/data/demo/paires.json', import.meta.url), 'utf8'))
);

const JOUR = '2026-03-02';
const T0 = new Date('2026-03-02T08:00:00Z');
const JUSTE = { correct: true, tries: 0, seconds: 2 };
const FAUX = { correct: false, tries: 2, seconds: 12 };

/** Une carte déjà sue : la stabilité passe le seuil de déblocage. */
const sue = (c: string): ReviewCard => schedule(newCard(c, T0), JUSTE, T0).card;

const cartes = ['主', '住', '王', '他', '们', '休'].map(sue);
const sources = { famille, voisins, cartes, paires };

describe('le corpus assemblé pour les questions', () => {
  const corpus = corpusRevision(sources);

  it('porte les fiches de la famille, les voisins, puis les briques citées', () => {
    const cs = corpus.fiches.map((f) => f.c);
    expect(cs.slice(0, 2)).toEqual(['主', '住']);
    expect(cs).toEqual(expect.arrayContaining(['王', '他', '们', '休']));
    /* Les composants n'ont pas de fiche à eux : le corpus leur en fabrique une, vide. */
    expect(cs).toEqual(expect.arrayContaining(['丶', '亻', '也', '门', '木']));
    expect(ficheDuCorpus('亻', corpus)?.fr).toBe('');
  });

  it('prend ses décompositions dans les fiches, jamais ailleurs', () => {
    expect(corpus.decompositions['住']).toEqual(['亻', '主']);
    expect(corpus.decompositions['他']).toEqual(['亻', '也']);
    expect(decompositionsDe([])).toEqual({});
  });

  it("tient l'acquis des cartes, et lui seul", () => {
    expect(corpus.acquis).toBe(cartes);
    expect(stability(cartes[0])).toBeGreaterThanOrEqual(SEUIL_DEBLOCAGE);
    expect(acquis(corpus)).toEqual(['主', '住', '王', '他', '们', '休']);
  });

  it('ne compte pas comme acquise une carte encore fragile', () => {
    const neuve = corpusRevision({ ...sources, cartes: [newCard('主', T0)] });
    expect(stability(neuve.acquis[0] as ReviewCard)).toBeLessThan(SEUIL_DEBLOCAGE);
    expect(acquis(neuve)).toEqual([]);
  });

  it('charge les paires à ne pas confondre, qui passent devant les autres leurres', () => {
    expect(corpus.paires).toEqual(expect.arrayContaining([['王', '玉', '主']]));
    const sansPaires = corpusRevision({ ...sources, paires: [] });
    expect(ressemblance('王', '主', corpus)).toBeGreaterThan(ressemblance('王', '主', sansPaires));
  });

  it("reporte le rôle de l'élément ajouté sur la fiche du composant", () => {
    /* 住 déclare `role: son` pour son élément ajouté 主 : c'est 主 qui donne le son. */
    expect(rolesDesElements(famille.fiches)).toEqual({ 丶: 'forme', 主: 'son' });
    expect(composantSon(ficheDuCorpus('住', corpus)!, corpus)).toBe('主');
  });

  it('rend le pinyin des choix depuis les fiches, jamais écrit en dur', () => {
    expect(pinyinDe('住', corpus)).toBe('zhù');
    expect(pinyinDe('他', corpus)).toBe('tā');
    expect(pinyinDe('鬱', corpus)).toBe('');
  });

  it("n'invente ni origine ni décomposition pour un voisin", () => {
    const f = ficheDeVoisin({ c: '他', pinyin: 'tā', fr: 'il', parts: ['亻', '也'] });
    expect(f.origine_fr).toBe('');
    expect(f.parts).toEqual(['亻', '也']);
    expect(fichesDuCorpus(null, null)).toEqual([]);
  });

  it("n'offre pas le type « à l'oreille » : aucune fiche ne porte encore d'audio", () => {
    for (const f of corpus.fiches) {
      expect(typesPossibles(f, corpus)).not.toContain('oreille');
    }
  });

  it('laisse le tracé se couper par le réglage', () => {
    const sansTrace = corpusRevision({ ...sources, trace: false });
    expect(typesPossibles(ficheDuCorpus('王', corpus)!, corpus)).toContain('trace');
    expect(typesPossibles(ficheDuCorpus('王', sansTrace)!, sansTrace)).not.toContain('trace');
  });
});

describe('la séance du pas Échauffer', () => {
  const corpus = corpusRevision(sources);
  const pile = cartes.map((c) => c.id);

  it('pose une question par carte de la pile, dans l’ordre de la pile', () => {
    const qs = questionsRevision(pile, corpus, JOUR);
    expect(qs.map((q) => q.c)).toEqual(pile);
  });

  it('ne pose que des types que la fiche permet', () => {
    for (const q of questionsRevision(pile, corpus, JOUR)) {
      expect(typesPossibles(ficheDuCorpus(q.c, corpus)!, corpus)).toContain(q.type);
    }
  });

  it('reprend à la question exacte : même jour, même pile, même question', () => {
    const avant = questionsRevision(pile, corpus, JOUR);
    const apres = questionsRevision(pile, corpus, JOUR);
    expect(apres[2]).toEqual(avant[2]);
    expect(graineDuJour('rev', JOUR)).toBe(`rev/${JOUR}`);
  });

  it('change de questions le lendemain', () => {
    const demain = questionsRevision(pile, corpus, '2026-03-03');
    const aujourdhui = questionsRevision(pile, corpus, JOUR);
    expect(demain.map((q) => `${q.type}${q.choix.join('')}`)).not.toEqual(
      aujourdhui.map((q) => `${q.type}${q.choix.join('')}`)
    );
  });

  it('ne tire jamais comme la vérification du même jour', () => {
    expect(graineDuJour('rev', JOUR)).not.toBe(graineDuJour('fix', JOUR));
  });
});

describe('le pas Fixer, sur les sept types', () => {
  /* À la fin d'Apprendre, les cartes du jour sont neuves : la vérification tient quand même. */
  const neuves = ['主', '住'].map((c) => newCard(c, T0));
  const corpus = corpusFixer({ famille, voisins, cartes: neuves, paires });
  const qs = questionsFixer(famille, corpus, JOUR);

  it('pose le sens du composé, la brique, puis l’assemblage', () => {
    expect(qs.map((q) => q.type)).toEqual(['sens', 'caractere', 'assemblage']);
    expect(qs.map((q) => q.c)).toEqual(['住', '主', '住']);
  });

  it('prend ses questions dans le module des sept types', () => {
    expect(qs[0].reponse).toEqual(['habiter']);
    expect(qs[0].choix).toContain('habiter');
    expect(qs[1].choix).toContain('主');
    /* L'assemblage attend les briques dans l'ordre d'écriture. */
    expect(qs[2].reponse).toEqual(['亻', '主']);
  });

  it('explique par les briques, avec le texte de la fiche', () => {
    expect(qs[0].explication.texte).toContain('亻 + 主');
    expect(qs[0].explication.texte).toContain(famille.fiches[1].origine_fr);
    expect(qs[0].explication.etiquette).toBe('atteste');
  });

  it('montre quatre choix : les voisins de forme servent de leurres', () => {
    expect(qs[0].choix).toHaveLength(4);
    expect(qs[1].choix).toHaveLength(4);
    expect(qs[1].choix).toContain('王');
  });

  it('repose la même vérification toute la journée', () => {
    expect(questionsFixer(famille, corpus, JOUR)).toEqual(qs);
    expect(questionsFixer(famille, corpus, '2026-03-03')).not.toEqual(qs);
  });
});

describe('ce que FSRS a décidé, dit en clair', () => {
  it('compte en minutes, en heures, puis en jours', () => {
    const t = (ms: number) => delai(T0, new Date(T0.getTime() + ms));
    expect(t(RETOUR_MINUTES * 60_000)).toBe('10 minutes');
    expect(t(30_000)).toBe('une minute');
    expect(t(3 * 3_600_000)).toBe('3 heures');
    expect(t(86_400_000)).toBe('1 jour');
    expect(t(4 * 86_400_000)).toBe('4 jours');
    expect(t(12 * 86_400_000)).toBe('12 jours');
    expect(t(-5000)).toBe('une minute');
  });
});

describe('le résumé de fin de séance', () => {
  const corpus = corpusRevision(sources);
  const pile = ['主', '住'];
  const qs = questionsRevision(pile, corpus, JOUR);

  /** Une séance : 主 su du premier coup, 住 raté deux fois. */
  const apres = [
    schedule(cartes[0], JUSTE, T0).card,
    schedule(cartes[1], FAUX, T0).card,
    ...cartes.slice(2)
  ];

  it('dit ce qui est sûr, ce qui est à revoir, et compte le premier coup', () => {
    const lignes = resume(qs, apres, T0);
    expect(lignes.map((l) => l.c)).toEqual(pile);
    expect(lignes[0].sure).toBe(true);
    expect(lignes[0].verdict).toBe(SUR);
    expect(lignes[1].sure).toBe(false);
    expect(lignes[1].verdict).toBe(A_REVOIR);
    expect(sures(lignes)).toBe(1);
  });

  it("annonce l'échéance réelle des cartes, jamais une constante", () => {
    const lignes = resume(qs, apres, T0);
    expect(lignes[0].quand).toBe(delai(T0, apres[0].card.due));
    /* Faux deux fois : la carte revient dans dix minutes, et le résumé le dit. */
    expect(lignes[1].quand).toBe('10 minutes');
    expect(derniereNote(apres[1])?.due).toEqual(apres[1].card.due);
  });

  it('porte le type de chaque question posée', () => {
    const lignes = resume(qs, apres, T0);
    expect(lignes.map((l) => l.label)).toEqual(qs.map((q) => q.label));
  });

  it('ne promet rien pour une carte qui n’a pas été notée', () => {
    const lignes = resume(qs, [newCard('主', T0)], T0);
    expect(lignes[0].quand).toBe('');
    expect(lignes[0].sure).toBe(false);
    expect(derniereNote(null)).toBeNull();
  });
});
