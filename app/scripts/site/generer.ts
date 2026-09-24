/// <reference types="node" />
/**
 * Le site public (story 5.2) : une page par caractère, en français et en anglais,
 * générée à partir de l'export versionné (`public/data/<version>/`), sans framework
 * et sans JavaScript dans les pages.
 *
 * Ce que dit une page : le caractère, dessiné depuis ses traits (jamais depuis une
 * police), son pinyin (Unihan), sa décomposition GF 0014-2009 dont chaque composant
 * renvoie à sa page, sa famille, les caractères qui le contiennent, et l'ordre de ses
 * traits en cases numérotées. Les textes d'une fiche (sens, origine, étiquette, mots,
 * phrase) n'apparaissent que si la fiche est relue : l'export ne porte alors rien
 * d'autre, et le générateur ne lit ces champs que sous `statut === 'relu'`. Aucune
 * définition anglaise tierce (CC-CEDICT, Unihan `kDefinition`) : l'export n'en a pas.
 *
 * Un caractère sans traits dans l'export n'a pas de page : on ne le dessinerait qu'avec
 * une police. Il apparaît en petit, sans lien, dans les décompositions qui le citent.
 *
 * `genererSite` est pure : elle rend la liste des fichiers à écrire, chemin relatif à
 * `dist/` et contenu. `cli.ts` les écrit.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glyph, horsPolice, type StrokeData } from '../../src/lib/glyph';
import type { Famille, Fiche, Index, Mot } from '../../src/lib/content';
import { cheminPage, DOSSIER_COMMUN, fichierPage, LANGUES, normaliserBase, type Langue } from './chemins';
import { echapper, markdown } from './markdown';
import { MISE_EN_PAGE, tokensDuSite } from './style';

/** L'export versionné, tel que le lit le générateur. */
export type Export = {
  index: Index;
  familles: Famille[];
  traits: Record<string, StrokeData>;
  /** `LICENCES.md`, écrit par `wenlu export`. */
  licences: string;
  /** Les fichiers de `traits/`, publiés sous APL (§2 b) : noms relatifs à `traits/`. */
  fichiersTraits: string[];
};

export type Options = {
  /** La base de l'artefact Pages, `/zilin/` en production. */
  base: string;
  /** L'origine absolue, pour les URL canoniques, `hreflang` et le plan du site. */
  origine: string;
  /** Le contenu de `src/lib/tokens.css`. */
  tokensCss: string;
};

/** Un fichier à écrire : chemin relatif à `dist/`, contenu. */
export type Fichier = { chemin: string; contenu: string };

/** Lit l'export versionné d'un dossier (`public/data/<version>/`). */
export function lireExport(dossier: string): Export {
  const index = JSON.parse(readFileSync(join(dossier, 'index.json'), 'utf8')) as Index;
  const familles: Famille[] = [];
  const traits: Record<string, StrokeData> = {};
  for (const f of index.familles) {
    familles.push(JSON.parse(readFileSync(join(dossier, f.fichier), 'utf8')) as Famille);
    const t = JSON.parse(readFileSync(join(dossier, f.traits), 'utf8')) as { traits: Record<string, StrokeData> };
    for (const [c, d] of Object.entries(t.traits)) if (!(c in traits)) traits[c] = d;
  }
  const fichiersTraits = readdirSync(join(dossier, 'traits')).sort();
  return { index, familles, traits, licences: readFileSync(join(dossier, 'LICENCES.md'), 'utf8'), fichiersTraits };
}

// ---------------------------------------------------------------------------------
// Les textes de l'interface du site. Pas de contenu ici : le contenu vient de l'export.

type Textes = {
  langue: string;
  autre: string;
  titre: (c: string, py: string) => string;
  caractere: string;
  traits: (n: number) => string;
  famille: (r: string, n: number) => string;
  racineDe: (r: string, n: number) => string;
  niveaux: Record<string, (n: number) => string>;
  jour: (parcours: string, j: number) => string;
  parcours: Record<string, string>;
  decomposition: string;
  brique: string;
  inconnu: string;
  inconnuNote: string;
  nouveau: string;
  roles: string;
  ordre: string;
  ordreNote: string;
  trait: (i: number) => string;
  saFamille: (r: string) => string;
  toutesFamilles: string;
  contenu: (c: string) => string;
  sens: string;
  origine: string;
  etiquette: Record<'atteste' | 'mnemotechnique', string>;
  mots: string;
  phrase: string;
  appel: string;
  appelNote: string;
  description: (f: Fiche, n: number, contenants: string[], sens: string) => string;
  familles: { titre: string; h1: string; intro: (c: number, f: number) => string; description: string; n: (n: number) => string };
  licences: { titre: string; h1: string; intro: string; traces: string; tracesNote: string; textes: string; description: string };
  pied: { traces: string; separateur: string; derives: string; pinyin: string; licenceUnicode: string; decomposition: string; mots: string; licences: string; version: (v: string) => string };
  nav: string;
};

const FR: Textes = {
  langue: 'Français',
  autre: 'English',
  titre: (c, py) => `${c}${py ? ` ${py}` : ''} : caractère chinois, décomposition et ordre des traits · Wenlu`,
  caractere: 'Caractère chinois',
  traits: (n) => `${n} trait${n > 1 ? 's' : ''}`,
  famille: (r, n) => `famille de ${r} (${n} caractère${n > 1 ? 's' : ''})`,
  racineDe: (r, n) => `racine de la famille ${r} (${n} caractère${n > 1 ? 's' : ''})`,
  niveaux: { seuil: (n) => `Seuil ${n} de l'Éducation nationale`, hsk: (n) => `HSK ${n}` },
  jour: (p, j) => `Jour ${j} du parcours ${p}`,
  parcours: { lire: 'Lire', hsk: 'HSK' },
  decomposition: 'Décomposition',
  brique:
    "Brique de la norme GF 0014-2009 : ce composant ne se décompose pas. D'autres caractères se construisent sur lui.",
  inconnu: 'composant sans tracé',
  inconnuNote:
    "En gris, un composant que l'export ne sait pas encore dessiner, ou que le pipeline n'a pas identifié (« ? ») : il n'a pas de page.",
  nouveau: "En cinabre, l'élément nouveau du jour où le parcours de Wenlu fait lire ce caractère.",
  roles: 'En ocre, la brique de sens ; en indigo, la brique de son.',
  ordre: 'Ordre des traits',
  ordreNote: "Chaque case ajoute un trait, en encre ; les traits déjà écrits sont en gris.",
  trait: (i) => `trait ${i}`,
  saFamille: (r) => `La famille de ${r}`,
  toutesFamilles: 'Toutes les familles',
  contenu: (c) => `Les caractères qui contiennent ${c}`,
  sens: 'Sens',
  origine: 'Origine',
  etiquette: { atteste: 'attesté', mnemotechnique: 'mnémotechnique' },
  mots: 'Mots',
  phrase: 'Phrase',
  appel: 'Apprendre ce caractère dans Wenlu',
  appelNote: "Wenlu apprend à lire le chinois par les familles de caractères, dix minutes par jour.",
  description: (f, n, cont, sens) => {
    const tete = `${f.c}${f.pinyin ? ` (${f.pinyin})` : ''}${sens ? ` « ${sens} »` : ''}`;
    const corps = f.parts.length
      ? `caractère chinois de ${FR.traits(n)}, formé de ${f.parts.join(' + ')} selon la norme GF 0014-2009.`
      : `composant de base de la norme GF 0014-2009, ${FR.traits(n)}.`;
    const dans = cont.length ? ` Il entre dans ${cont.slice(0, 4).join(', ')}${cont.length > 4 ? '…' : ''}.` : '';
    return `${tete} : ${corps}${dans} Ordre des traits et famille.`;
  },
  familles: {
    titre: 'Les familles de caractères chinois · Wenlu',
    h1: 'Les familles de caractères',
    intro: (c, f) =>
      `${c} caractères chinois, rangés en ${f} familles. Chaque caractère se décompose selon la norme GF 0014-2009 ; chaque page le dessine trait par trait.`,
    description:
      'Les caractères chinois du seuil 255 et du HSK 1, rangés par familles, avec leur décomposition GF 0014-2009 et l’ordre des traits.',
    n: (n) => `${n} caractère${n > 1 ? 's' : ''}`
  },
  licences: {
    titre: 'Licences et sources · Wenlu',
    h1: 'Licences et sources',
    intro: 'Les sources des données de Wenlu, leur licence et leur attribution, telles que les écrit le pipeline de données.',
    traces: 'Fichiers de tracés dérivés',
    tracesNote:
      "Les tracés des caractères sont dérivés de Make Me a Hanzi (graphics.txt), sous Arphic Public License. Ils sont publiés ici en entier, sous la même licence, avec la note de modification (APL §2).",
    textes: 'Textes des licences',
    description: 'Les sources et licences des données de Wenlu : tracés sous Arphic Public License, pinyin Unihan, norme GF 0014-2009.'
  },
  pied: {
    traces: "Tracés des caractères : Make Me a Hanzi (graphics.txt), d'après les polices d'Arphic Technology, © 1999 Arphic Technology Co., Ltd., sous",
    separateur: ' ; ',
    derives: 'fichiers de tracés dérivés',
    pinyin: 'Pinyin : Unihan, © Unicode, Inc.,',
    licenceUnicode: 'licence Unicode',
    decomposition: 'Décomposition selon la norme GF 0014-2009, réconciliée par le pipeline Wenlu.',
    mots: 'Mots : CC-CEDICT, publié par MDBG, fichier modifié, sous',
    licences: 'Licences et sources',
    version: (v) => `données version ${v}`
  },
  nav: 'Navigation'
};

const EN: Textes = {
  langue: 'English',
  autre: 'Français',
  titre: (c, py) => `${c}${py ? ` ${py}` : ''}: Chinese character, components and stroke order · Wenlu`,
  caractere: 'Chinese character',
  traits: (n) => `${n} stroke${n > 1 ? 's' : ''}`,
  famille: (r, n) => `${r} family (${n} character${n > 1 ? 's' : ''})`,
  racineDe: (r, n) => `root of the ${r} family (${n} character${n > 1 ? 's' : ''})`,
  niveaux: { seuil: (n) => `French national list, ${n} characters`, hsk: (n) => `HSK ${n}` },
  jour: (p, j) => `Day ${j} of the ${p} path`,
  parcours: { lire: 'Read', hsk: 'HSK' },
  decomposition: 'Components',
  brique: 'A building block of the GF 0014-2009 standard: this component does not break down further. Other characters are built on it.',
  inconnu: 'component without stroke data',
  inconnuNote:
    'In grey, a component the export cannot draw yet, or that the pipeline has not identified (“?”): it has no page.',
  nouveau: 'In cinnabar, the new element on the day the Wenlu path teaches this character.',
  roles: 'In ochre, the meaning component; in indigo, the sound component.',
  ordre: 'Stroke order',
  ordreNote: 'Each box adds one stroke, in ink; strokes already written are grey.',
  trait: (i) => `stroke ${i}`,
  saFamille: (r) => `The ${r} family`,
  toutesFamilles: 'All families',
  contenu: (c) => `Characters that contain ${c}`,
  sens: 'Meaning',
  origine: 'Origin',
  etiquette: { atteste: 'attested', mnemotechnique: 'mnemonic' },
  mots: 'Words',
  phrase: 'Sentence',
  appel: 'Learn this character in Wenlu',
  appelNote: 'Wenlu teaches you to read Chinese through character families, ten minutes a day.',
  description: (f, n, cont, sens) => {
    const tete = `${f.c}${f.pinyin ? ` (${f.pinyin})` : ''}${sens ? ` “${sens}”` : ''}`;
    const corps = f.parts.length
      ? `a Chinese character of ${EN.traits(n)}, made of ${f.parts.join(' + ')} under the GF 0014-2009 standard.`
      : `a basic component of the GF 0014-2009 standard, ${EN.traits(n)}.`;
    const dans = cont.length ? ` It appears in ${cont.slice(0, 4).join(', ')}${cont.length > 4 ? '…' : ''}.` : '';
    return `${tete}: ${corps}${dans} Stroke order and family.`;
  },
  familles: {
    titre: 'Chinese character families · Wenlu',
    h1: 'Character families',
    intro: (c, f) =>
      `${c} Chinese characters, grouped into ${f} families. Each character breaks down under the GF 0014-2009 standard; each page draws it stroke by stroke.`,
    description:
      'Chinese characters of the French 255 list and HSK 1, grouped by family, with their GF 0014-2009 components and stroke order.',
    n: (n) => `${n} character${n > 1 ? 's' : ''}`
  },
  licences: {
    titre: 'Licenses and sources · Wenlu',
    h1: 'Licenses and sources',
    intro: 'The sources of Wenlu’s data, their licenses and attributions, as written by the data pipeline. The table is kept in French.',
    traces: 'Derived stroke files',
    tracesNote:
      'Character strokes are derived from Make Me a Hanzi (graphics.txt), under the Arphic Public License. They are published here in full, under the same license, with the modification notice (APL §2).',
    textes: 'License texts',
    description: 'Sources and licenses of Wenlu’s data: strokes under the Arphic Public License, Unihan pinyin, GF 0014-2009 standard.'
  },
  pied: {
    traces: 'Character strokes: Make Me a Hanzi (graphics.txt), after the Arphic Technology fonts, © 1999 Arphic Technology Co., Ltd., under the',
    separateur: '; ',
    derives: 'derived stroke files',
    pinyin: 'Pinyin: Unihan, © Unicode, Inc.,',
    licenceUnicode: 'Unicode license',
    decomposition: 'Components follow the GF 0014-2009 standard, reconciled by the Wenlu pipeline.',
    mots: 'Words: CC-CEDICT, published by MDBG, modified, under',
    licences: 'Licenses and sources',
    version: (v) => `data version ${v}`
  },
  nav: 'Navigation'
};

const TEXTES: Record<Langue, Textes> = { fr: FR, en: EN };

// ---------------------------------------------------------------------------------

type Entree = { fiche: Fiche; racine: string };

/** Le modèle du site : ce que chaque page doit savoir des autres. */
type Modele = {
  version: string;
  date: string;
  entrees: Map<string, Entree>;
  traits: Record<string, StrokeData>;
  /** Les caractères qui ont une page : ceux qui ont des traits. */
  pages: Set<string>;
  familles: Map<string, string[]>;
  contenants: Map<string, string[]>;
  jours: Map<string, { parcours: string; jour: number }>;
};

function construireModele(ex: Export): Modele {
  const entrees = new Map<string, Entree>();
  const familles = new Map<string, string[]>();
  for (const f of ex.familles) {
    const membres: string[] = [];
    for (const fiche of f.fiches) {
      if (!entrees.has(fiche.c)) entrees.set(fiche.c, { fiche, racine: f.racine.c });
      membres.push(fiche.c);
    }
    familles.set(f.racine.c, membres);
  }
  const pages = new Set([...entrees.keys()].filter((c) => ex.traits[c]?.s?.length));

  // L'ordre de lecture : le jour du parcours Lire, puis celui du parcours HSK.
  const jours = new Map<string, { parcours: string; jour: number }>();
  for (const nom of ['lire', 'hsk', ...Object.keys(ex.index.parcours)]) {
    for (const j of ex.index.parcours[nom]?.jours ?? []) {
      for (const c of [j.brique, ...j.composes]) if (c && !jours.has(c)) jours.set(c, { parcours: nom, jour: j.jour });
    }
  }
  const rang = (c: string) => {
    const j = jours.get(c);
    return j ? (j.parcours === 'lire' ? 0 : 100000) + j.jour : 1e9;
  };
  const trier = (cs: Iterable<string>) =>
    [...new Set(cs)].sort((a, b) => rang(a) - rang(b) || (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0));

  const contenants = new Map<string, string[]>();
  for (const { fiche } of entrees.values()) {
    for (const p of new Set(fiche.parts)) contenants.set(p, [...(contenants.get(p) ?? []), fiche.c]);
  }
  for (const [c, l] of contenants) contenants.set(c, trier(l));
  for (const [r, l] of familles) familles.set(r, trier(l));
  return { version: ex.index.version, date: ex.index.date, entrees, traits: ex.traits, pages, familles, contenants, jours };
}

/** Les champs d'une fiche relue, et rien si elle ne l'est pas. */
function textesRelus(f: Fiche, langue: Langue) {
  if (f.statut !== 'relu') return null;
  const en = langue === 'en';
  return {
    sens: (en ? f.en : f.fr) ?? '',
    origine: (en ? f.origine_en : f.origine_fr) ?? '',
    etiquette: f.etiquette,
    memo: (en ? f.memo_en : f.memo_fr) ?? '',
    mots: f.mots ?? [],
    phrase: f.phrase ?? null
  };
}

// ---------------------------------------------------------------------------------

type Contexte = { m: Modele; base: string; origine: string };

const ZH = 'lang="zh-Hans"';
const hz = (c: string, cls = 'hz') => `<span class="${cls}" ${ZH}>${echapper(c)}</span>`;

/**
 * Un caractère dans le texte d'une page. Hors police (`horsPolice` : ⿰𠄌丶, 𠂒, 𠃊…),
 * il serait un carré vide ou une suite d'opérateurs IDS : on le dessine depuis ses
 * traits, à la taille du texte (1em), avec son nom accessible.
 */
function hzc(ctx: Contexte, c: string): string {
  const d = ctx.m.traits[c];
  if (!horsPolice(c) || !d?.s?.length) return hz(c);
  const svg = glyph(c, d, 16, { write: false }).replace(' width="16" height="16"', ' width="1em" height="1em"');
  return `<span class="hz hz-trace" ${ZH}>${svg}</span>`;
}

function lien(ctx: Contexte, chemin: string): string {
  return `${ctx.base}${chemin}`;
}
function absolu(ctx: Contexte, chemin: string): string {
  return `${ctx.origine}${ctx.base}${chemin}`;
}
function donnees(ctx: Contexte, fichier: string): string {
  return `${ctx.base}data/${ctx.m.version}/${fichier}`;
}

/** La grille d'écolier 米字格, en filets fins, derrière un grand caractère. */
const MIZI =
  '<svg class="grille" viewBox="0 0 104 104" aria-hidden="true"><rect x=".5" y=".5" width="103" height="103" rx="12"/><path d="M52 1v102M1 52h102M4.5 4.5l95 95M99.5 4.5l-95 95"/></svg>';

/** L'ordre des traits : une case par trait, les tracés définis une fois et réutilisés. */
function ordreDesTraits(ctx: Contexte, c: string, d: StrokeData, t: Textes): string {
  const id = `t${[...c].map((x) => x.codePointAt(0)!.toString(16)).join('')}`;
  const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${d.s
    .map((p, i) => `<path id="${id}-${i}" d="${p}"/>`)
    .join('')}</defs></svg>`;
  const cases = d.s
    .map((_, i) => {
      const uses = d.s
        .slice(0, i + 1)
        .map((__, k) => `<use href="#${id}-${k}"${k < i ? ' class="avant"' : ''}/>`)
        .join('');
      return `<li><span class="case"><svg class="g" viewBox="0 0 1024 1024" role="img" aria-label="${echapper(
        t.trait(i + 1)
      )}"><g transform="scale(1,-1) translate(0,-900)" fill="currentColor">${uses}</g></svg></span><span class="n" aria-hidden="true">${i + 1}</span></li>`;
    })
    .join('');
  return `${defs}<ol class="traits">${cases}</ol>`;
}

function listeCaracteres(ctx: Contexte, langue: Langue, cs: string[], courant?: string): string {
  const items = cs.map((c) => {
    const e = ctx.m.entrees.get(c);
    const py = e?.fiche.pinyin ? ` <small>${echapper(e.fiche.pinyin)}</small>` : '';
    if (!ctx.m.pages.has(c)) return `<li><span>${hzc(ctx, c)}${py}</span></li>`;
    const cur = c === courant ? ' aria-current="page"' : '';
    return `<li><a href="${lien(ctx, cheminPage(langue, 'caractere', c))}"${cur}>${hzc(ctx, c)}${py}</a></li>`;
  });
  return `<ul class="liste">${items.join('')}</ul>`;
}

function motHtml(m: Mot, langue: Langue): string {
  const trad = langue === 'en' ? m.en : m.fr;
  return `<li>${hz(m.hanzi)}${echapper(m.pinyin)}${trad ? ` · ${echapper(trad)}` : ''}</li>`;
}

type Tete = {
  langue: Langue;
  titre: string;
  description: string;
  /** Le chemin de cette page et de son équivalent dans l'autre langue. */
  chemins: Record<Langue, string>;
  jsonld?: unknown;
};

function document(ctx: Contexte, tete: Tete, corps: string, options: { mots?: boolean } = {}): string {
  const { langue } = tete;
  const t = TEXTES[langue];
  const autre: Langue = langue === 'fr' ? 'en' : 'fr';
  const alternates = LANGUES.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${absolu(ctx, tete.chemins[l])}">`
  ).join('\n');
  const jsonld = tete.jsonld
    ? `<script type="application/ld+json">${JSON.stringify(tete.jsonld).replace(/</g, '\\u003c')}</script>\n`
    : '';
  const marque = glyph('文', ctx.m.traits['文'], 30, { write: false, cinabre: [0], label: 'Wenlu' });
  const pied = `<footer class="pied">
<p>${t.pied.traces} <a href="${donnees(ctx, 'traits/ARPHICPL.TXT')}">Arphic Public License</a>${t.pied.separateur}<a href="${lien(
    ctx,
    cheminPage(langue, 'licences')
  )}#traces">${t.pied.derives}</a>.</p>
<p>${t.pied.pinyin} <a href="${donnees(ctx, 'UNICODE-LICENSE.txt')}">${t.pied.licenceUnicode}</a>. ${t.pied.decomposition}</p>
${options.mots ? `<p>${t.pied.mots} <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener">CC BY-SA 4.0</a>.</p>\n` : ''}<p><a href="${lien(
    ctx,
    cheminPage(langue, 'licences')
  )}">${t.pied.licences}</a> · ${t.pied.version(ctx.m.version)}</p>
</footer>`;
  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#F4EEE2">
<title>${echapper(tete.titre)}</title>
<meta name="description" content="${echapper(tete.description)}">
<link rel="canonical" href="${absolu(ctx, tete.chemins[langue])}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${absolu(ctx, tete.chemins.fr)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wenlu 文路">
<meta property="og:title" content="${echapper(tete.titre)}">
<meta property="og:description" content="${echapper(tete.description)}">
<meta property="og:url" content="${absolu(ctx, tete.chemins[langue])}">
<meta property="og:locale" content="${langue === 'fr' ? 'fr_FR' : 'en_US'}">
<link rel="icon" type="image/svg+xml" href="${lien(ctx, 'icons/favicon.svg')}">
<link rel="stylesheet" href="${lien(ctx, `${DOSSIER_COMMUN}/site.css`)}?v=${ctx.m.version}">
${jsonld}</head>
<body>
<div class="page">
<header class="entete">
<a class="marque" href="${lien(ctx, cheminPage(langue, 'familles'))}">${marque}<span class="nom">Wenlu <span ${ZH}>文路</span></span></a>
<a class="langue" href="${lien(ctx, tete.chemins[autre])}" hreflang="${autre}" lang="${autre}">${t.autre}</a>
</header>
<main>
${corps}
</main>
${pied}
</div>
</body>
</html>
`;
}

function pageCaractere(ctx: Contexte, c: string, langue: Langue): string {
  const t = TEXTES[langue];
  const { fiche, racine } = ctx.m.entrees.get(c)!;
  const d = ctx.m.traits[c];
  const n = d.s.length;
  const relu = textesRelus(fiche, langue);
  const contenants = ctx.m.contenants.get(c) ?? [];
  const membres = ctx.m.familles.get(racine) ?? [c];
  const chemins = { fr: cheminPage('fr', 'caractere', c), en: cheminPage('en', 'caractere', c) };

  // En-tête : le grand caractère au pinceau, le pinyin, les faits.
  const faits = [
    `${t.caractere} · ${t.traits(n)}`,
    racine === c ? t.racineDe(racine, membres.length) : t.famille(racine, membres.length)
  ];
  const puces: string[] = [];
  for (const [k, v] of Object.entries(fiche.niveaux ?? {})) if (t.niveaux[k]) puces.push(t.niveaux[k](v));
  const jour = ctx.m.jours.get(c);
  if (jour) puces.push(t.jour(t.parcours[jour.parcours] ?? jour.parcours, jour.jour));
  const tete = `<div class="carte tete fiche">
<div class="grand">${MIZI}${glyph(c, d, 240, { write: true })}</div>
<div>
<h1>${hzc(ctx, c)}${fiche.pinyin ? ` <span class="py">${echapper(fiche.pinyin)}</span>` : ''}</h1>
${faits
  .map((f) => (horsPolice(racine) ? echapper(f).replace(echapper(racine), hzc(ctx, racine)) : echapper(f)))
  .map((f) => `<p class="fait">${f}</p>`)
  .join('\n')}
${relu?.sens ? `<p class="sens">${echapper(relu.sens)}</p>` : ''}
${puces.length ? `<ul class="puces">${puces.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul>` : ''}
</div>
</div>`;

  // Origine, mots et phrase : seulement d'une fiche relue.
  let ficheRelue = '';
  if (relu && (relu.origine || relu.mots.length || relu.phrase)) {
    const parts: string[] = [];
    if (relu.origine) {
      parts.push(`<h2>${t.origine}</h2><p class="origine">${echapper(relu.origine)}</p>`);
      if (relu.etiquette) parts.push(`<span class="tag">${t.etiquette[relu.etiquette]}</span>`);
      if (relu.memo) parts.push(`<p class="origine">${echapper(relu.memo)}</p>`);
    }
    if (relu.mots.length) parts.push(`<h2>${t.mots}</h2><ul class="mots">${relu.mots.map((m) => motHtml(m, langue)).join('')}</ul>`);
    if (relu.phrase) {
      const p = relu.phrase;
      parts.push(
        `<h2>${t.phrase}</h2><p class="phrase" ${ZH}>${echapper(p.hanzi)}</p><p class="trad">${echapper(p.pinyin)}</p><p class="trad">${echapper(
          langue === 'en' ? p.en : p.fr
        )}</p>`
      );
    }
    ficheRelue = `<section class="carte">${parts.join('\n')}</section>`;
  }

  // Décomposition GF 0014-2009.
  let decomposition: string;
  if (fiche.parts.length) {
    const roles = fiche.statut === 'relu' ? fiche.roles ?? {} : {};
    const tuiles = fiche.parts.map((p, i) => {
      const e = ctx.m.entrees.get(p);
      const classes = ['part'];
      if (roles[p] === 'sens' || roles[p] === 'son') classes.push(roles[p]);
      if (fiche.nouveau.includes(i)) classes.push('nouveau');
      const py = e?.fiche.pinyin ? `<span class="p-py">${echapper(e.fiche.pinyin)}</span>` : '<span class="p-py">&nbsp;</span>';
      if (ctx.m.pages.has(p)) {
        return `<a class="${classes.join(' ')}" href="${lien(ctx, cheminPage(langue, 'caractere', p))}">${glyph(
          p,
          ctx.m.traits[p],
          56,
          { write: false }
        )}${py}</a>`;
      }
      return `<span class="${classes.join(' ')}" title="${echapper(t.inconnu)}"><span class="muet" ${ZH}>${echapper(p)}</span>${py}</span>`;
    });
    const notes: string[] = [];
    if (fiche.nouveau.length) notes.push(t.nouveau);
    if (fiche.parts.some((p) => !ctx.m.pages.has(p))) notes.push(t.inconnuNote);
    if (Object.values(roles).some((r) => r === 'sens' || r === 'son')) notes.push(t.roles);
    decomposition = `<section class="carte"><h2>${t.decomposition} <small class="k">GF 0014-2009</small></h2>
<div class="formule">${tuiles.join('<span class="op" aria-hidden="true">+</span>')}</div>
<p class="egal">${hzc(ctx, c)} = ${fiche.parts.map((p) => hzc(ctx, p)).join(' + ')}</p>
${notes.map((x) => `<p class="note">${echapper(x)}</p>`).join('\n')}</section>`;
  } else {
    decomposition = `<section class="carte"><h2>${t.decomposition} <small class="k">GF 0014-2009</small></h2><p class="egal">${echapper(
      t.brique
    )}</p></section>`;
  }

  const ordre = `<section class="carte"><h2>${t.ordre}</h2>${ordreDesTraits(ctx, c, d, t)}<p class="note">${echapper(
    t.ordreNote
  )}</p></section>`;

  const famille = `<section class="carte"><h2>${t.saFamille(hzc(ctx, racine))}</h2>${listeCaracteres(ctx, langue, membres, c)}
<p class="plus"><a href="${lien(ctx, cheminPage(langue, 'familles'))}#f-${encodeURIComponent(racine)}">${t.toutesFamilles}</a></p></section>`;

  const dans = contenants.length
    ? `<section class="carte"><h2>${t.contenu(hzc(ctx, c))}</h2>${listeCaracteres(ctx, langue, contenants)}</section>`
    : '';

  const appel = `<div class="appel"><a class="btn" href="${ctx.base}">${t.appel}</a><p>${t.appelNote}</p></div>`;

  const description = t.description(fiche, n, contenants, relu?.sens ?? '');
  const jsonld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: c,
    ...(fiche.pinyin ? { alternateName: fiche.pinyin } : {}),
    termCode: [...c].map((x) => `U+${x.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' '),
    url: absolu(ctx, chemins[langue]),
    inLanguage: 'zh-Hans',
    ...(relu?.sens ? { description: relu.sens } : {}),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: langue === 'fr' ? 'Wenlu : les familles de caractères chinois' : 'Wenlu: Chinese character families',
      url: absolu(ctx, cheminPage(langue, 'familles'))
    }
  };
  return document(
    ctx,
    { langue, titre: t.titre(c, fiche.pinyin), description, chemins, jsonld },
    [tete, ficheRelue, decomposition, ordre, famille, dans, appel].filter(Boolean).join('\n'),
    { mots: Boolean(relu?.mots.length || relu?.phrase) }
  );
}

function pageFamilles(ctx: Contexte, langue: Langue): string {
  const t = TEXTES[langue];
  const familles = [...ctx.m.familles.entries()]
    .map(([r, membres]) => ({ r, membres: membres.filter((c) => ctx.m.pages.has(c)) }))
    .filter((f) => f.membres.length > 0)
    .sort((a, b) => b.membres.length - a.membres.length || (a.r.codePointAt(0) ?? 0) - (b.r.codePointAt(0) ?? 0));
  const nb = familles.reduce((s, f) => s + f.membres.length, 0);
  const blocs = familles.map(({ r, membres }) => {
    const py = ctx.m.entrees.get(r)?.fiche.pinyin ?? '';
    const tete = ctx.m.pages.has(r) ? `<a href="${lien(ctx, cheminPage(langue, 'caractere', r))}">${hzc(ctx, r)}</a>` : hzc(ctx, r);
    return `<section class="carte famille" id="f-${encodeURIComponent(r)}"><h2>${tete}<small>${echapper(py)}${py ? ' · ' : ''}${t.familles.n(
      membres.length
    )}</small></h2>${listeCaracteres(ctx, langue, membres)}</section>`;
  });
  const corps = `<h1>${t.familles.h1}</h1>
<p class="intro">${echapper(t.familles.intro(nb, familles.length))}</p>
<div class="familles">${blocs.join('\n')}</div>
<div class="appel"><a class="btn" href="${ctx.base}">${langue === 'fr' ? 'Ouvrir Wenlu' : 'Open Wenlu'}</a><p>${t.appelNote}</p></div>`;
  return document(ctx, {
    langue,
    titre: t.familles.titre,
    description: t.familles.description,
    chemins: { fr: cheminPage('fr', 'familles'), en: cheminPage('en', 'familles') }
  }, corps);
}

function pageLicences(ctx: Contexte, ex: Export, langue: Langue): string {
  const t = TEXTES[langue];
  const traces = ex.fichiersTraits
    .map((f) => `<li><a href="${donnees(ctx, `traits/${encodeURIComponent(f)}`)}">${echapper(f)}</a></li>`)
    .join('');
  const textes = [
    ['traits/ARPHICPL.TXT', 'Arphic Public License'],
    ['traits/MODIFICATIONS.md', 'MODIFICATIONS.md'],
    ['UNICODE-LICENSE.txt', 'Unicode License'],
    ['LICENCES.md', 'LICENCES.md']
  ];
  const corps = `<div class="licences">
<h1>${t.licences.h1}</h1>
<p class="intro">${echapper(t.licences.intro)}</p>
<section class="carte" lang="fr">${markdown(ex.licences, 1)}</section>
<section class="carte" id="traces"><h2>${t.licences.traces}</h2><p>${echapper(t.licences.tracesNote)}</p>
<ul class="fichiers">${traces}</ul></section>
<section class="carte"><h2>${t.licences.textes}</h2><ul>${textes
    .map(([f, nom]) => `<li><a href="${donnees(ctx, f)}">${echapper(nom)}</a></li>`)
    .join('')}</ul></section>
</div>`;
  return document(ctx, {
    langue,
    titre: t.licences.titre,
    description: t.licences.description,
    chemins: { fr: cheminPage('fr', 'licences'), en: cheminPage('en', 'licences') }
  }, corps);
}

function planDuSite(ctx: Contexte): string {
  const lastmod = ctx.m.date.slice(0, 10);
  const groupes: Record<Langue, string>[] = [
    { fr: cheminPage('fr', 'familles'), en: cheminPage('en', 'familles') },
    ...[...ctx.m.pages].sort().map((c) => ({ fr: cheminPage('fr', 'caractere', c), en: cheminPage('en', 'caractere', c) })),
    { fr: cheminPage('fr', 'licences'), en: cheminPage('en', 'licences') }
  ];
  const urls = groupes.flatMap((g) =>
    LANGUES.map(
      (l) =>
        `<url><loc>${absolu(ctx, g[l])}</loc><lastmod>${lastmod}</lastmod>${LANGUES.map(
          (a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${absolu(ctx, g[a])}"/>`
        ).join('')}</url>`
    )
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${absolu(ctx, '')}</loc><lastmod>${lastmod}</lastmod></url>
${urls.join('\n')}
</urlset>
`;
}

/** Génère le site : la liste des fichiers à écrire dans `dist/`. */
export function genererSite(ex: Export, o: Options): Fichier[] {
  const base = normaliserBase(o.base);
  const ctx: Contexte = { m: construireModele(ex), base, origine: o.origine.replace(/\/+$/, '') };
  if (!ctx.m.traits['文']) throw new Error("l'export ne porte pas les traits de 文, la marque");
  const fichiers: Fichier[] = [];
  for (const langue of LANGUES) {
    for (const c of [...ctx.m.pages].sort()) {
      fichiers.push({ chemin: fichierPage(cheminPage(langue, 'caractere', c)), contenu: pageCaractere(ctx, c, langue) });
    }
    fichiers.push({ chemin: fichierPage(cheminPage(langue, 'familles')), contenu: pageFamilles(ctx, langue) });
    fichiers.push({ chemin: fichierPage(cheminPage(langue, 'licences')), contenu: pageLicences(ctx, ex, langue) });
  }
  fichiers.push({ chemin: `${DOSSIER_COMMUN}/site.css`, contenu: `${tokensDuSite(o.tokensCss, '../fonts/')}\n${MISE_EN_PAGE}` });
  fichiers.push({ chemin: 'sitemap.xml', contenu: planDuSite(ctx) });
  fichiers.push({
    chemin: 'robots.txt',
    contenu: `User-agent: *\nAllow: /\n\nSitemap: ${absolu(ctx, 'sitemap.xml')}\n`
  });
  return fichiers;
}
