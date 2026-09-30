/**
 * L'écran du dictionnaire (story 10.8, `dico-ecran.ts`, `recentes.ts`, la loupe de
 * `Chercher.svelte`) : un test par règle. Sur le vrai `dico/index.json` et les vrais textes
 * d'écran quand c'est la règle qui compte ; sur de petites entrées écrites à la main sinon.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Brique, Famille, Fiche, FicheLue } from './content';
import {
  compagnonDuDico,
  estMotDUnCaractere,
  filtrerParTon,
  gloseDeLigne,
  glosesRelues,
  lectureDeLigne,
  libelleNiveau,
  libelleStatut,
  ligneResultats,
  motsDUnCaractere,
  motsProches,
  motsQuiContiennent,
  nombre,
  origineDeFiche,
  pastillesDeTon,
  pinyinDe,
  ranger,
  rolesDesBriques,
  sensDeFiche,
  statutCaractere,
  statutMot,
  type ContexteStatut
} from './dico-ecran';
import { chercherDico, lireIndexDico, lireLectures, type OrigineDico } from './dictionnaire';
import { lireEcrans } from './ecrans';
import { MAX_RECENTES, lireRecentes, noterRecente } from './recentes';
import { emptyProgress, fromJSON, toJSON } from './session';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const INDEX = lireIndexDico(JSON.parse(source('../../public/data/0.1.0/dico/index.json')) as unknown);
const T = lireEcrans(JSON.parse(source('../../public/data/0.1.0/ecrans.json')) as unknown).dico;
/** Le code sans ses commentaires : ils décrivent parfois ce qu'on n'écrit pas. */
const code = (f: string): string => source(f).replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|^\s*\/\/.*$/gm, '');

/** L'apprenant de la maquette : 40 jours du chemin faits ; 好 et 口 lus, 看 à venir, 豪 hors du chemin. */
const CTX: ContexteStatut = {
  lus: new Set(['好', '女', '子', '口']),
  cartes: new Set(['好', '女', '子', '口', '人']),
  chemin: new Map([
    ['好', 13],
    ['女', 12],
    ['子', 11],
    ['人', 1],
    ['大', 38],
    ['看', 162],
    ['亠', 180],
    ['口', 30]
  ]),
  fait: 40
};

describe('le statut de Mon chemin', () => {
  it('lu au jade, « dans N j » en jours du chemin, en cours, hors du chemin', () => {
    expect(statutCaractere('好', CTX)).toEqual({ k: 'lu', jour: 13 });
    expect(statutCaractere('看', CTX)).toEqual({ k: 'chemin', n: 122, jour: 162 });
    expect(statutCaractere('人', CTX)).toEqual({ k: 'encours', jour: 1 });
    expect(statutCaractere('大', CTX)).toEqual({ k: 'encours', jour: 38 });
    expect(statutCaractere('豪', CTX)).toEqual({ k: 'hors' });
    expect(libelleStatut(statutCaractere('看', CTX), T)).toBe('dans 122 j');
    expect(libelleStatut(statutCaractere('好', CTX), T)).toBe('lu');
    expect(libelleStatut(statutCaractere('口', CTX), T, true)).toBe('lue');
    expect(libelleStatut(statutCaractere('豪', CTX), T)).toBe('hors du chemin');
  });

  it('un mot prend le statut de ses caractères : lu, le dernier à venir, ou hors du chemin', () => {
    expect(statutMot('好女', CTX).k).toBe('lu');
    expect(statutMot('好看', CTX)).toEqual({ k: 'chemin', n: 122, jour: 162 });
    expect(statutMot('自豪', CTX).k).toBe('hors');
    expect(statutMot('人好', CTX).k).toBe('encours');
  });

  it('la charte : le lu au jade, le chemin à l’indigo, ni cinabre, ni ombre, ni dégradé', () => {
    for (const f of ['Chercher.svelte', 'FicheCaractere.svelte', 'FicheMot.svelte', 'LigneDico.svelte', 'OrdreTraits.svelte', 'EcrireAuDoigt.svelte']) {
      const c = code(f);
      expect(c, f).not.toMatch(/--zhu|#C8371F|cinabre/i);
      expect(c, f).not.toMatch(/gradient|box-shadow|drop-shadow|text-shadow|gold|doré/i);
    }
    expect(code('LigneDico.svelte')).toMatch(/\.st\.lu\s*\{[^}]*var\(--jade\)/);
    expect(code('LigneDico.svelte')).toMatch(/\.st\.chemin\s*\{[^}]*var\(--indigo\)/);
  });
});

describe('le pinyin et le niveau', () => {
  it('le pinyin accentué, d’un tenant, l’apostrophe devant a, e, o, le ü', () => {
    expect(pinyinDe(lireLectures('hao3 kan4')[0])).toBe('hǎokàn');
    expect(pinyinDe(lireLectures('xi1 an1')[0])).toBe("xī'ān");
    expect(pinyinDe(lireLectures('nv3 er2')[0])).toBe("nǚ'ér");
    expect(pinyinDe(lireLectures('zhi1 dao5')[0])).toBe('zhīdao');
    expect(pinyinDe(lireLectures('hao3 wan2 r5')[0])).toBe('hǎowánr');
  });

  it('les niveaux du HSK 3.0 : 1 à 6, puis 7-9', () => {
    expect(libelleNiveau(1, T)).toBe('HSK 1');
    expect(libelleNiveau(7, T)).toBe('HSK 7-9');
    expect(libelleNiveau(0, T)).toBe(T['hors-hsk']);
    expect(nombre(11092)).toBe('11 092');
  });
});

describe('un mot d’un seul caractère se range sous le caractère', () => {
  it('好 adjectif n’a pas sa ligne : la fiche de 好 le porte', () => {
    const r = ranger(chercherDico('好', INDEX).resultats, INDEX);
    expect(r.caracteres.map((e) => e.id)).toEqual(['好']);
    expect(r.mots.every((e) => !estMotDUnCaractere(e))).toBe(true);
    expect(r.mots.map((e) => e.formes[0])).toContain('好看');
    expect(motsDUnCaractere('好', INDEX).map((e) => e.id)).toEqual(['L1-0138', 'L2-0214', 'L4-0317']);
  });

  it('un mot d’un caractère trouvé seul fait paraître son caractère, une fois', () => {
    const mot = INDEX.entrees.find((e) => e.id === 'L1-0138');
    expect(mot).toBeDefined();
    const r = ranger([{ ...mot!, rang: 6, cle: 0 }], INDEX);
    expect(r.caracteres.map((e) => e.id)).toEqual(['好']);
    expect(r.mots).toEqual([]);
  });

  it('les mots de la fiche : ceux qui le contiennent, sans ceux d’un seul caractère', () => {
    const ids = ['L1-0002', 'L1-0138', 'L1-0140'];
    expect(motsQuiContiennent(ids, INDEX).map((e) => e.formes[0])).toEqual(['爱好', '好看']);
  });

  it('les mots proches : un caractère en commun, la même longueur, le niveau voisin d’abord', () => {
    const haokan = INDEX.entrees.find((e) => e.id === 'L1-0140')!;
    const p = motsProches(haokan, INDEX);
    expect(p.length).toBeGreaterThan(0);
    expect(p.length).toBeLessThanOrEqual(6);
    for (const e of p) {
      expect(Array.from(e.formes[0]).length).toBe(2);
      expect(Array.from(e.formes[0]).some((c) => c === '好' || c === '看')).toBe(true);
    }
    expect(p[0].niveau).toBe(1);
  });
});

describe('les pastilles de ton', () => {
  it('« hao » : háo, hǎo, hào ; le filtre garde le ton choisi et montre sa lecture', () => {
    const r = ranger(chercherDico('hao', INDEX).resultats, INDEX);
    const p = pastillesDeTon('hao', r, INDEX.syllabes);
    expect(p).not.toBeNull();
    expect(p!.tons).toEqual([2, 3, 4]);
    const quatre = filtrerParTon(r, p, 4);
    expect(quatre.caracteres.map((e) => e.id)).toContain('好');
    expect(quatre.caracteres.map((e) => e.id)).not.toContain('豪');
    const hao = quatre.caracteres.find((e) => e.id === '好')!;
    expect(pinyinDe(lectureDeLigne(hao, p, 4))).toBe('hào');
    expect(pinyinDe(lectureDeLigne(hao, p, 0))).toBe('hǎo');
    expect(filtrerParTon(r, p, 0)).toBe(r);
  });

  it('pas de pastilles pour un ton déjà dit, un caractère, plusieurs syllabes ou du français', () => {
    for (const q of ['hao3', '好', 'haokan', 'bon']) {
      const r = ranger(chercherDico(q, INDEX).resultats, INDEX);
      expect(pastillesDeTon(q, r, INDEX.syllabes), q).toBeNull();
    }
  });
});

const fiche = (x: Partial<FicheLue>): FicheLue => ({
  c: '好',
  pinyin: 'hǎo',
  fr: 'bon, bien, très',
  en: '',
  parts: ['女', '子'],
  nouveau: [1],
  role: 'sens',
  roles: { 女: 'sens', 子: 'sens' },
  statut: 'relu',
  origine_fr: 'Sur les os oraculaires, 好 réunit une femme et un enfant.',
  origine_en: '',
  etiquette: 'atteste',
  mots: [],
  niveaux: {},
  traits: [],
  medianes: [],
  source: 'export',
  ...x
});

describe('le sens ne se montre que relu', () => {
  it('le sens du dictionnaire relu, sinon celui d’une fiche relue, sinon en relecture', () => {
    const relu = { statut: 'relu' as const, glose: 'bon ; bien', acceptions: [{ categorie: 'Adj', fr: 'bon' }] };
    expect(sensDeFiche(relu, 'bon, bien, très')?.glose).toBe('bon ; bien');
    expect(sensDeFiche(null, 'bon, bien, très')).toEqual({ glose: 'bon, bien, très', acceptions: [] });
    expect(sensDeFiche(null, '')).toBeNull();
    expect(T['sens-relecture']).not.toBe('');
  });

  it('les gloses des lignes : l’index relu, puis les fiches relues ; jamais une fiche à relire', () => {
    const f = (c: string, statut: Fiche['statut'], fr: string, mots: Fiche['mots'] = []): Fiche =>
      ({ ...fiche({ c, statut, fr, mots }), source: undefined }) as unknown as Fiche;
    const fam = {
      version: '',
      source: '',
      racine: {} as Brique,
      fiches: [
        f('好', 'relu', 'bon, bien, très', [{ hanzi: '好看', pinyin: 'hǎokàn', fr: 'beau', en: '' }]),
        f('妈', 'sans_fiche', 'maman')
      ]
    } as Famille;
    const g = glosesRelues([fam]);
    expect(g.get('好')).toBe('bon, bien, très');
    expect(g.get('好看')).toBe('beau');
    expect(g.has('妈')).toBe(false);
    expect(gloseDeLigne({ glose: '', formes: ['好看'] }, g)).toBe('beau');
    expect(gloseDeLigne({ glose: 'joli', formes: ['好看'] }, g)).toBe('joli');
    expect(gloseDeLigne({ glose: '', formes: ['妈'] }, g)).toBe('');
  });
});

describe('l’origine, attestée ou mnémotechnique, jamais l’une pour l’autre', () => {
  it('le texte et l’étiquette de la même fiche relue', () => {
    expect(origineDeFiche(fiche({}), null)).toEqual({ texte: fiche({}).origine_fr, etiquette: 'atteste' });
    expect(origineDeFiche(fiche({ etiquette: 'mnemotechnique' }), null)?.etiquette).toBe('mnemotechnique');
  });

  it('ni démonstration, ni aperçu à relire, ni étiquette sans texte : origine à venir', () => {
    expect(origineDeFiche(fiche({ source: 'demonstration' }), null)).toBeNull();
    expect(origineDeFiche(fiche({ source: 'apercu', statut: 'a_relire' }), null)).toBeNull();
    expect(origineDeFiche(fiche({ origine_fr: '' }), null)).toBeNull();
    expect(origineDeFiche(fiche({ etiquette: null }), null)).toBeNull();
    expect(origineDeFiche(null, null)).toBeNull();
  });

  it('la brique racine d’une famille, relue, avec sa propre étiquette', () => {
    const r: Brique = { c: '亠', pinyin: 'tóu', fr: 'couvercle', en: '', origine: '亠 ressemble à un couvercle.', etiquette: 'mnemotechnique' };
    expect(origineDeFiche(null, r)).toEqual({ texte: r.origine, etiquette: 'mnemotechnique' });
    expect(origineDeFiche(null, { ...r, etiquette: null })).toBeNull();
    /* la fiche relue passe devant, avec son étiquette, jamais celle de la brique */
    expect(origineDeFiche(fiche({}), r)?.etiquette).toBe('atteste');
  });

  it('les rôles des briques : ceux de la fiche relue, pour la même décomposition seulement', () => {
    expect(rolesDesBriques(fiche({}), ['女', '子'])).toEqual({ 女: 'sens', 子: 'sens' });
    expect(rolesDesBriques(fiche({}), ['女', '子', '一'])).toBeNull();
    expect(rolesDesBriques(fiche({ source: 'demonstration' }), ['女', '子'])).toBeNull();
  });

  it('hors des familles, l’origine relue que porte l’entrée du dictionnaire, avec son étiquette', () => {
    const dico: OrigineDico = {
      statut: 'relu',
      etiquette: 'mnemotechnique',
      fr: 'Un texte du dictionnaire.',
      en: 'A dictionary text.',
      roles: { 女: 'sens', 子: 'forme' }
    };
    expect(origineDeFiche(null, null, dico)).toEqual({ texte: dico.fr, etiquette: 'mnemotechnique' });
    /* la fiche relue des familles passe devant, avec son étiquette à elle */
    expect(origineDeFiche(fiche({}), null, dico)?.etiquette).toBe('atteste');
    /* ni étiquette sans texte, ni texte sans étiquette */
    expect(origineDeFiche(null, null, { ...dico, fr: ' ' })).toBeNull();
    expect(rolesDesBriques(null, ['女', '子'], dico)).toEqual({ 女: 'sens', 子: 'forme' });
    expect(rolesDesBriques(null, ['女', '子', '一'], dico)).toBeNull();
    expect(rolesDesBriques(null, ['女', '子'], { ...dico, roles: {} })).toBeNull();
  });

  it('« origine à venir » ne dit ni attesté ni mnémotechnique', () => {
    expect(T['origine-a-venir']).toContain('{c}');
    expect(T['origine-a-venir']).not.toMatch(/attest|mnémotechnique/i);
  });
});

describe('le compagnon', () => {
  it('Tao lit par-dessus l’épaule avant le 县试, Xing tient le livre ouvert après', () => {
    expect(compagnonDuDico(false)).toEqual({ guide: 'tao', posture: 'lecture' });
    expect(compagnonDuDico(true)).toEqual({ guide: 'xing', posture: 'consulte' });
  });

  it('l’écran passe par `compagnonDuDico`, et Xing explique l’origine dans sa bulle', () => {
    expect(code('Chercher.svelte')).toContain('compagnonDuDico(xing)');
    expect(code('FicheCaractere.svelte')).toMatch(/<Xing posture="explique"/);
  });
});

describe('les recherches récentes', () => {
  it('la plus récente en tête, sans doublon, huit au plus', () => {
    let l = noterRecente([], { genre: 'saisie', v: 'hao' });
    l = noterRecente(l, { genre: 'caractere', v: '好' });
    l = noterRecente(l, { genre: 'saisie', v: ' HAO ' });
    expect(l).toEqual([
      { genre: 'saisie', v: 'HAO' },
      { genre: 'caractere', v: '好' }
    ]);
    for (let k = 0; k < 20; k++) l = noterRecente(l, { genre: 'saisie', v: `q${k}` });
    expect(l.length).toBe(MAX_RECENTES);
    expect(noterRecente(l, { genre: 'saisie', v: '   ' })).toEqual(l);
  });

  it('gardées dans la progression : l’export les emporte, l’import les relit, un export ancien n’en a pas', () => {
    const p = { ...emptyProgress('2026-09-29'), recentes: [{ genre: 'mot' as const, v: 'L1-0140' }, { genre: 'saisie' as const, v: 'hao' }] };
    expect(fromJSON(toJSON(p), '2026-09-29').recentes).toEqual(p.recentes);
    const ancien = JSON.parse(toJSON(emptyProgress('2026-09-29'))) as Record<string, unknown>;
    delete ancien.recentes;
    expect(fromJSON(JSON.stringify(ancien), '2026-09-29').recentes).toEqual([]);
    expect(lireRecentes([{ genre: 'podium', v: 'x' }, { genre: 'saisie', v: 3 }, 'hao'])).toEqual([]);
  });

  it('effaçables : « Effacer » les vide dans la progression', () => {
    expect(code('Chercher.svelte')).toContain('onrecentes([])');
  });
});

describe('les textes viennent du pipeline', () => {
  it('« 1 caractère, 12 mots. Touche une ligne pour ouvrir sa fiche. »', () => {
    expect(ligneResultats(T, 1, 12)).toBe('1 caractère, 12 mots. Touche une ligne pour ouvrir sa fiche.');
    expect(ligneResultats(T, 3, 0)).toBe('3 caractères, 0 mot. Touche une ligne pour ouvrir sa fiche.');
  });

  it('aucun libellé de la maquette n’est écrit dans le code', () => {
    const libelles = ['Pas encore appris', 'Ses briques', 'Trait suivant', 'Récentes', 'Mots proches', 'Wenlu complet', 'Écrire au doigt', 'origine à venir', 'Origine à venir'];
    for (const f of ['Chercher.svelte', 'FicheCaractere.svelte', 'FicheMot.svelte', 'LigneDico.svelte', 'OrdreTraits.svelte', 'EcrireAuDoigt.svelte', 'dico-ecran.ts']) {
      for (const t of libelles) expect(code(f), `${f} : ${t}`).not.toContain(t);
    }
  });
});

describe('les grands caractères depuis les traits, jamais depuis une police', () => {
  it('la fiche dessine son caractère par l’ordre des traits, et il ne s’anime pas en mouvement réduit', () => {
    expect(code('FicheCaractere.svelte')).toContain('<OrdreTraits');
    const o = code('OrdreTraits.svelte');
    expect(o).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(o).toMatch(/if \(!reduit\)/);
    expect(o).not.toMatch(/font-family/);
  });

  it('les lots de traits se chargent par le dictionnaire, sans réseau hors des assets', () => {
    expect(code('DicoGlyph.svelte')).toContain('.traits(');
    for (const f of ['Chercher.svelte', 'FicheCaractere.svelte', 'FicheMot.svelte', 'DicoGlyph.svelte']) {
      expect(code(f), f).not.toMatch(/https?:\/\//);
    }
  });
});
