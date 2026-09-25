import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  A_REVOIR,
  SUR,
  AVANCE_MS,
  LECTURE_MAX_MS,
  cartesEnAttente,
  corpusFixer,
  corpusRevision,
  decompositionsDe,
  delai,
  delaiAvance,
  derniereNote,
  ficheDeVoisin,
  fichesDuCorpus,
  graineDuJour,
  ligneEnAttente,
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
  horsSerie,
  lirePaires,
  posable,
  ressemblance,
  typesPossibles
} from './questions';
import { RETOUR_MINUTES, SEUIL_DEBLOCAGE, newCard, schedule, stability } from './srs';
import {
  VERSION_DONNEES,
  surcoucher,
  type Famille,
  type Fiche,
  type Foret,
  type Index,
  type Voisins
} from './content';
import { ciblesAssemblage, ciblesJumeaux, corpusDeJeu } from './jeux';
import {
  carte,
  cartesDues,
  emptyProgress,
  fromJSON,
  nombreDues,
  setEnAttente,
  toJSON
} from './session';
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

  it("n'offre le type « à l'oreille » qu'avec la voix de l'appareil ou un fichier du manifeste", () => {
    expect(corpus.voix).toBe(false);
    for (const f of corpus.fiches) {
      expect(typesPossibles(f, corpus)).not.toContain('oreille');
    }
    const avecVoix = corpusRevision({ ...sources, voix: true });
    expect(avecVoix.voix).toBe(true);
    expect(typesPossibles(ficheDuCorpus('住', avecVoix)!, avecVoix)).toContain('oreille');
    /* Sans voix, le fichier du manifeste audio suffit, pour le seul caractère qu'il porte. */
    const avecFichier = corpusRevision({ ...sources, manifeste: { 住: 'data/0.1.0/audio/zhu.mp3' } });
    expect(avecFichier.voix).toBe(false);
    expect(typesPossibles(ficheDuCorpus('住', avecFichier)!, avecFichier)).toContain('oreille');
    expect(typesPossibles(ficheDuCorpus('他', avecFichier)!, avecFichier)).not.toContain('oreille');
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

describe('le pas Fixer, sur les huit types', () => {
  /* À la fin d'Apprendre, les cartes du jour sont neuves : la vérification tient quand même. */
  const neuves = ['主', '住'].map((c) => newCard(c, T0));
  const corpus = corpusFixer({ famille, voisins, cartes: neuves, paires });
  const qs = questionsFixer(famille, corpus, JOUR);

  it('pose le sens du composé, la brique, puis l’assemblage', () => {
    expect(qs.map((q) => q.type)).toEqual(['sens', 'caractere', 'assemblage']);
    expect(qs.map((q) => q.c)).toEqual(['住', '主', '住']);
  });

  it('prend ses questions dans le module des huit types', () => {
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

/* ---------- une carte sans fiche ne reste pas due en silence ---------- */

describe('une carte sans fiche au pas Échauffer', () => {
  /* 龍 n'est ni dans l'export, ni dans la démonstration : une carte hors export. */
  const HORS = '龍';
  const corpus = corpusRevision(sources);

  it('est passée par la série, et nommée', () => {
    expect(ficheDuCorpus(HORS, corpus)).toBeNull();
    const pile = ['主', HORS, '住'];
    const qs = questionsRevision(pile, corpus, JOUR);
    expect(qs.map((q) => q.c)).toEqual(['主', '住']);
    expect(horsSerie(pile, corpus)).toEqual([HORS]);
    /* La série et les cartes nommées couvrent toute la pile : rien ne se perd en route. */
    for (const c of pile) expect(posable(c, corpus) !== horsSerie(pile, corpus).includes(c)).toBe(true);
  });

  it('se dit dans le résumé par une ligne neutre', () => {
    expect(ligneEnAttente([])).toBe('');
    const une = ligneEnAttente([HORS]);
    expect(une).toContain(HORS);
    expect(une).toContain('gardée');
    const deux = ligneEnAttente([HORS, '龜']);
    expect(deux).toContain('龍 龜');
    for (const l of [une, deux]) {
      expect(l).not.toMatch(/erreur|échec|désolé|bravo|!|impossible/i);
    }
  });

  it('sort de la pile due sans quitter la progression, et revient avec sa fiche', () => {
    const T1 = new Date('2026-03-05T08:00:00Z');
    let p = emptyProgress(JOUR);
    p = { ...p, cartes: [newCard('主', T0), newCard(HORS, T0)] };
    expect(cartesDues(p, T1).map((c) => c.id)).toEqual(['主', HORS]);

    /* Le pas Échauffer réévalue : la carte hors export est mise de côté. */
    const attente = cartesEnAttente(['主', HORS], p.enAttente, corpus);
    expect(attente).toEqual([HORS]);
    p = setEnAttente(p, attente);
    expect(p.enAttente).toEqual([HORS]);
    expect(cartesDues(p, T1).map((c) => c.id)).toEqual(['主']);
    expect(nombreDues(p, T1)).toBe(1);
    /* Jamais perdue : la carte reste, avec son échéance, et passe l'export. */
    expect(carte(p, HORS)).not.toBeNull();
    const relue = fromJSON(toJSON(p), JOUR);
    expect(relue.enAttente).toEqual([HORS]);
    expect(carte(relue, HORS)).not.toBeNull();
    expect(fromJSON(JSON.stringify({ version: 1, day: JOUR }), JOUR).enAttente).toEqual([]);
    /* Une carte que la progression ne porte pas ne se met pas de côté. */
    expect(setEnAttente(p, [HORS, 'inconnu']).enAttente).toEqual([HORS]);
    expect(setEnAttente(p, [HORS])).toBe(p);

    /* Le contenu porte enfin sa fiche : la réévaluation la rend, elle redevient due. */
    const avecFiche = corpusRevision({
      ...sources,
      voisins: { ...voisins, voisins: [...voisins.voisins, { c: HORS, pinyin: 'lóng', fr: 'dragon', parts: [] }] }
    });
    expect(cartesEnAttente([], p.enAttente, avecFiche)).toEqual([]);
    p = setEnAttente(p, []);
    expect(cartesDues(p, T1).map((c) => c.id)).toEqual(['主', HORS]);
  });

  it("l'écran la signale, et l'aiguillage la range", () => {
    const warm = readFileSync(new URL('Warm.svelte', import.meta.url), 'utf8');
    expect(warm).toContain('horsSerie(p.revue, corpus)');
    expect(warm).toContain('cartesEnAttente(p.revue, p.enAttente, corpus)');
    expect(warm).toContain('ligneEnAttente(passees)');
    const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
    expect(app).toContain('onattente={echaufferAttente}');
    expect(app).toContain('setEnAttente(p, ids)');
  });
});

/* ---------- l'export versionné, tel que le pas Échauffer le lit ---------- */

describe("les cartes de la première session et des jeux, dans le corpus d'Échauffer", () => {
  const lire = (f: string): unknown => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
  const dossier = `../../public/data/${VERSION_DONNEES}`;
  const index = lire(`${dossier}/index.json`) as Index;
  const familles = index.familles.map((f) => lire(`${dossier}/${f.fichier}`) as Famille);
  /* La surcouche de `content.surcouchesDemo` : les familles 人 et 主, puis les voisins. */
  const demo = new Map<string, Fiche>();
  for (const nom of ['人', '主']) {
    for (const x of (lire(`../../public/data/demo/familles/${nom}.json`) as Famille).fiches) {
      if (!demo.has(x.c)) demo.set(x.c, x);
    }
  }
  for (const v of voisins.voisins) {
    if (!demo.has(v.c)) demo.set(v.c, { ...ficheDeVoisin(v), parts: [], role: null, etiquette: null });
  }
  /* `content.toutesLesFiches` : toutes les fiches de l'export, surcouchées. */
  const fiches = familles.flatMap((f) => f.fiches.map((x) => surcoucher(x, demo.get(x.c) ?? null)));
  const pairesExport = lirePaires(lire(`${dossier}/paires.json`));
  const premiere = ['人', '大', '天'];
  const cartesPremiere = premiere.map((c) => newCard(c, T0));
  const corpusDe = (trace: boolean) =>
    corpusRevision({ fiches, voisins, cartes: cartesPremiere, paires: pairesExport, trace });

  it('pose 人, 大 et 天 en question, tracé activé ou non', () => {
    for (const trace of [true, false]) {
      const corpus = corpusDe(trace);
      for (const c of premiere) {
        expect(fiches.some((f) => f.c === c), c).toBe(true);
        expect(posable(c, corpus), c).toBe(true);
      }
      expect(questionsRevision(premiere, corpus, JOUR).map((q) => q.c)).toEqual(premiere);
    }
  });

  it('pose les cartes que les jeux créent, ou les nomme : aucune ne se perd', () => {
    const foret = lire('../../public/data/demo/foret.json') as Foret;
    const traitsExport = index.familles.flatMap((f) =>
      Object.keys((lire(`${dossier}/${f.traits}`) as { traits: Record<string, unknown> }).traits)
    );
    const traitsDemo = Object.keys(lire('../../public/strokes-demo.json') as Record<string, unknown>);
    const jeux = corpusDeJeu({
      fiches,
      voisins,
      foret,
      paires: pairesExport,
      traits: [...new Set([...traitsExport, ...traitsDemo])],
      cartes: cartesPremiere
    });
    /* Un jeu ne crée de carte que pour le caractère d'un tour : une cible. */
    const cibles = [...new Set([...ciblesAssemblage(jeux), ...ciblesJumeaux(jeux)])];
    expect(cibles.length).toBeGreaterThan(0);
    for (const trace of [true, false]) {
      const corpus = corpusDe(trace);
      const posees = questionsRevision(cibles, corpus, JOUR).map((q) => q.c);
      const nommees = horsSerie(cibles, corpus);
      expect([...posees, ...nommees].sort()).toEqual([...cibles].sort());
    }
    /* Tracé activé, le cas par défaut : toutes se posent. */
    expect(horsSerie(cibles, corpusDe(true))).toEqual([]);
  });
});

describe("avance automatique : la correction se lit avant de partir", () => {
  it('une correction courte part après 1,3 s, pas avant', () => {
    expect(delaiAvance('Oui.')).toBe(AVANCE_MS);
  });

  it('une correction de deux lignes laisse le temps de la lire', () => {
    const d = delaiAvance('Oui. 大 dà, grand. Ajoute un trait horizontal aux bras.');
    expect(d).not.toBeNull();
    expect(d as number).toBeGreaterThan(AVANCE_MS);
    expect(d as number).toBeLessThanOrEqual(LECTURE_MAX_MS);
  });

  it('une correction trop longue ne part pas toute seule : on avance au tap', () => {
    const texte =
      "Oui. 人 rén, personne. Deux traits : un homme de profil, qui marche. C'est le radical le plus fréquent de toute la langue.";
    expect(delaiAvance(texte)).toBeNull();
  });

  it("l'écran de question cale l'avance sur la correction, plus sur une constante", () => {
    const src = readFileSync(new URL('Ask.svelte', import.meta.url), 'utf8');
    expect(src).toContain('delaiAvance(');
    expect(src).not.toMatch(/setTimeout\(avancer, AVANCE_MS\)/);
  });
});
