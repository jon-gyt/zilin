/**
 * Suivi de hauteur (F0) par YIN, en TypeScript pur, sans dépendance (story 9.1, « Dis-le »).
 * Repris du prototype de l'étude de faisabilité du 29 septembre 2026 : les poids du
 * classifieur (`classifieur.ts`) ont été appris sur les caractéristiques que ce code calcule,
 * et toute retouche du suivi se mesure sur les voix de test de l'étude avant d'entrer
 * (`data/sources/tons/PROVENANCE.md`). Une seule depuis : le nettoyage de la fin de la
 * syllabe (`nettoyer`, le même jour), qui ne touche qu'aux courbes abîmées. Sans réentraîner,
 * il fait passer le ton reconnu en tête de 88,5 à 91,3 % des caractères de Yue Tan (test) et
 * de 90,6 à 91,4 % des syllabes de Chen Wang, et les fins qui bondissent de plus de 5
 * demi-tons de 2,6 à 0,1 % et de 4,8 à 1,7 %.
 *
 * De Cheveigné et Kawahara, « YIN, a fundamental frequency estimator for speech
 * and music », JASA 111(4), 2002 : fonction de différence, différence cumulée
 * normalisée, seuil absolu, interpolation parabolique. Pensé pour un tampon de
 * micro mono à 16 kHz (la fréquence visée dans l'app), mais toute fréquence
 * d'échantillonnage convient.
 *
 * Puis le post-traitement propre à une syllabe prononcée : décision de voisement
 * (périodicité et énergie relative), correction des sauts d'octave, lissage par
 * médiane, découpe de la partie voisée (une ou plusieurs syllabes), et nettoyage de sa fin
 * quand la voix s'éteint.
 */

export interface Trame {
  /** Centre de la trame, en secondes. */
  t: number;
  /** Fréquence fondamentale en Hz, 0 si la trame n'est pas voisée. */
  f0: number;
  /** Minimum de la différence cumulée normalisée : 0 périodique, 1 bruit. */
  aperiodicite: number;
  /** Énergie efficace de la trame (échelle du signal, 1 = pleine échelle). */
  rms: number;
  voisee: boolean;
}

export interface OptionsHauteur {
  sr?: number;
  /** Bornes de recherche. 60 Hz couvre le creux grave du ton 3 d'une voix d'homme ; 600 Hz, la fin d'un ton 2 appuyé d'une voix aiguë (une voix de femme monte à 490 Hz dans le corpus). */
  fmin?: number;
  fmax?: number;
  /** Fenêtre d'intégration en secondes (25 ms). */
  fenetre?: number;
  /** Pas entre deux trames en secondes (10 ms). */
  pas?: number;
  /** Seuil absolu de YIN sur la différence cumulée normalisée. */
  seuil?: number;
  /** Une trame est voisée si son apériodicité est sous ce plafond… */
  apMax?: number;
  /** …et si son énergie est à moins de tant de dB de la trame la plus forte. */
  dbSousMax?: number;
  /** Coût d'un saut d'une octave entre deux trames (chemin de Viterbi). */
  poidsSaut?: number;
  /** Bonus par octave vers l'aigu, contre les sous-harmoniques. */
  bonusOctave?: number;
  /** Ramener à la médiane de l'énoncé les trames à plus de 1,8 fois ou moins de 0,5 fois. */
  corrigerOctaves?: boolean;
}

export const OPTIONS_DEFAUT: Required<OptionsHauteur> = {
  sr: 16000,
  fmin: 60,
  fmax: 600,
  fenetre: 0.025,
  pas: 0.01,
  seuil: 0.15,
  apMax: 0.35,
  dbSousMax: 20,
  poidsSaut: 2,
  bonusOctave: 0.1,
  corrigerOctaves: false,
};

/**
 * YIN sur une trame. `d` est un tampon de travail de longueur tauMax + 1,
 * réutilisé d'une trame à l'autre pour ne rien allouer.
 */
export function yinTrame(
  x: Float32Array,
  debut: number,
  W: number,
  tauMin: number,
  tauMax: number,
  seuil: number,
  d: Float64Array,
): { tau: number; ap: number } {
  // 1. fonction de différence
  d[0] = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) {
      const e = x[debut + j] - x[debut + j + tau];
      s += e * e;
    }
    d[tau] = s;
  }
  // 2. différence cumulée normalisée (en place)
  let cumul = 0;
  d[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) {
    cumul += d[tau];
    d[tau] = cumul > 0 ? (d[tau] * tau) / cumul : 1;
  }
  // 3. seuil absolu : premier creux sous le seuil, sinon le minimum global
  let best = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (d[tau] < seuil) {
      while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
      best = tau;
      break;
    }
  }
  if (best < 0) {
    best = tauMin;
    for (let tau = tauMin + 1; tau <= tauMax; tau++) if (d[tau] < d[best]) best = tau;
  }
  // 4. interpolation parabolique
  let tauFin = best;
  if (best > tauMin && best < tauMax) {
    const a = d[best - 1], b = d[best], c = d[best + 1];
    const den = a - 2 * b + c;
    if (den > 0) tauFin = best + (0.5 * (a - c)) / den;
  }
  return { tau: tauFin, ap: d[best] };
}

export interface Candidat {
  f0: number;
  ap: number;
}

/**
 * Les creux de la différence cumulée normalisée (déjà calculée dans `d` par
 * `yinTrame`) : jusqu'à `max` candidats sous `plafond`, du plus net au moins net.
 * Le choix entre eux se fait ensuite sur toute la syllabe (`viterbi`), comme
 * dans pYIN (Mauch et Dixon, ICASSP 2014), en plus simple.
 */
export function candidats(d: Float64Array, sr: number, tauMin: number, tauMax: number, max = 4, plafond = 0.6): Candidat[] {
  const out: Candidat[] = [];
  for (let tau = tauMin + 1; tau < tauMax; tau++) {
    if (d[tau] < plafond && d[tau] <= d[tau - 1] && d[tau] < d[tau + 1]) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1];
      const den = a - 2 * b + c;
      const t = den > 0 ? tau + (0.5 * (a - c)) / den : tau;
      out.push({ f0: sr / t, ap: b });
    }
  }
  out.sort((p, q) => p.ap - q.ap);
  return out.slice(0, max);
}

/**
 * Chemin de moindre coût à travers les candidats d'une plage voisée : coût
 * propre (l'apériodicité) plus un saut en octaves pondéré. Corrige les erreurs
 * d'octave d'une trame à l'autre sans lisser les chutes rapides du ton 4
 * (un demi-ton par trame ne coûte que 0,08 × `poidsSaut`).
 */
export function viterbi(cands: Candidat[][], poidsSaut = 2, bonusOctave = 0): number[] {
  const n = cands.length;
  if (n === 0) return [];
  // coût propre : l'apériodicité, moins un petit bonus par octave vers l'aigu
  // (comme le « octave cost » de Praat) contre les sous-harmoniques de la voix craquée
  const propre = (c: Candidat) => c.ap - bonusOctave * Math.log2(c.f0 / 50);
  const cout: number[][] = [cands[0].map(propre)];
  const prec: number[][] = [cands[0].map(() => -1)];
  for (let i = 1; i < n; i++) {
    cout.push([]);
    prec.push([]);
    for (const c of cands[i]) {
      let best = Infinity, arg = 0;
      cands[i - 1].forEach((p, j) => {
        const v = cout[i - 1][j] + poidsSaut * Math.abs(Math.log2(c.f0 / p.f0));
        if (v < best) { best = v; arg = j; }
      });
      cout[i].push(best + propre(c));
      prec[i].push(arg);
    }
  }
  let k = 0;
  cout[n - 1].forEach((v, j) => { if (v < cout[n - 1][k]) k = j; });
  const chemin = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) { chemin[i] = cands[i][k].f0; k = prec[i][k]; }
  return chemin;
}

/** Suivi de hauteur trame par trame, puis voisement, octaves et lissage. */
export function suivreHauteur(x: Float32Array, opts: OptionsHauteur = {}): Trame[] {
  const o = { ...OPTIONS_DEFAUT, ...opts };
  const W = Math.round(o.fenetre * o.sr);
  const hop = Math.round(o.pas * o.sr);
  const tauMin = Math.max(2, Math.floor(o.sr / o.fmax));
  const tauMax = Math.ceil(o.sr / o.fmin);
  const d = new Float64Array(tauMax + 2);

  // composante continue retirée une fois pour toutes
  let moy = 0;
  for (let i = 0; i < x.length; i++) moy += x[i];
  moy /= x.length || 1;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] - moy;

  const trames: Trame[] = [];
  const cands: Candidat[][] = [];
  for (let debut = 0; debut + W + tauMax < y.length; debut += hop) {
    let e = 0;
    for (let j = 0; j < W; j++) e += y[debut + j] * y[debut + j];
    const rms = Math.sqrt(e / W);
    const { tau, ap } = rms > 1e-5 ? yinTrame(y, debut, W, tauMin, tauMax, o.seuil, d) : { tau: 0, ap: 1 };
    const f0 = tau > 0 ? o.sr / tau : 0;
    const cs = rms > 1e-5 ? candidats(d, o.sr, tauMin, tauMax) : [];
    if (f0 > 0 && !cs.some((c) => Math.abs(c.f0 - f0) < 0.5)) cs.push({ f0, ap });
    cands.push(cs);
    trames.push({ t: (debut + W / 2) / o.sr, f0, aperiodicite: ap, rms, voisee: false });
  }
  if (trames.length === 0) return trames;

  const rmsMax = trames.reduce((m, tr) => Math.max(m, tr.rms), 0);
  const plancher = rmsMax * Math.pow(10, -o.dbSousMax / 20);
  for (const tr of trames) {
    tr.voisee = tr.aperiodicite < o.apMax && tr.rms > plancher && tr.rms > 3e-4;
    if (!tr.voisee) tr.f0 = 0;
  }
  // une trame voisée isolée entre deux silences est un faux positif
  for (let i = 0; i < trames.length; i++) {
    const g = i > 0 && trames[i - 1].voisee, dr = i + 1 < trames.length && trames[i + 1].voisee;
    if (trames[i].voisee && !g && !dr) { trames[i].voisee = false; trames[i].f0 = 0; }
  }
  for (const [a, b] of plagesVoisees(trames)) {
    const chemin = viterbi(cands.slice(a, b).map((cs, i) => (cs.length ? cs : [{ f0: trames[a + i].f0, ap: trames[a + i].aperiodicite }])), o.poidsSaut, o.bonusOctave);
    chemin.forEach((f, i) => { trames[a + i].f0 = f; });
  }
  if (o.corrigerOctaves) corrigerOctaves(trames);
  lisserMediane(trames, 5);
  return trames;
}

function mediane(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Plages [début, fin) de trames voisées consécutives. */
export function plagesVoisees(trames: Trame[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = 0;
  while (i < trames.length) {
    if (!trames[i].voisee) { i++; continue; }
    let j = i;
    while (j < trames.length && trames[j].voisee) j++;
    out.push([i, j]);
    i = j;
  }
  return out;
}

/** Ramène à l'octave de la médiane de l'énoncé les trames doublées ou divisées par deux. */
function corrigerOctaves(trames: Trame[]): void {
  const med = mediane(trames.filter((t) => t.voisee).map((t) => t.f0));
  if (med <= 0) return;
  for (const t of trames) {
    if (!t.voisee) continue;
    if (t.f0 > med * 1.8) t.f0 /= 2;
    else if (t.f0 < med * 0.5) t.f0 *= 2;
  }
}

function lisserMediane(trames: Trame[], k: number): void {
  const h = k >> 1;
  for (const [a, b] of plagesVoisees(trames)) {
    const v = trames.slice(a, b).map((t) => t.f0);
    for (let i = a; i < b; i++) {
      const fen = v.slice(Math.max(0, i - a - h), Math.min(v.length, i - a + h + 1));
      trames[i].f0 = mediane(fen);
    }
  }
}

export interface Segment {
  /** Indices [début, fin) dans le tableau de trames. */
  debut: number;
  fin: number;
  /** F0 en Hz, trous non voisés comblés par interpolation linéaire. */
  f0: number[];
  /** Temps (s) de chaque point. */
  t: number[];
  /** Durée voisée (s), trous comblés compris. */
  duree: number;
  /** Part des trames réellement voisées dans le segment. */
  voisement: number;
}

/**
 * La partie voisée d'un énoncé de `n` syllabes. Les trous de moins de `trouMax`
 * secondes sont comblés (le creux craqué du ton 3 coupe souvent le voisement) ;
 * on garde l'étendue qui porte le plus d'énergie, puis on la coupe en `n`
 * syllabes : aux plus grands trous non voisés s'il y en a, sinon au creux
 * d'énergie le plus net du milieu de chaque part (pour deux syllabes : le creux le plus
 * marqué entre deux crêtes, `creux`). Chaque syllabe est ensuite nettoyée
 * (`OptionsFin`, `FIN_DEFAUT`) ; `fin` à `null` rend l'ancienne découpe, pour la mesure.
 *
 * `liees` (les mots, story 9.1) : pour chaque frontière, vrai si la syllabe suivante commence
 * par une voix (m, n, l, r, y, w, une voyelle) ; un trou de moins de `TROU_LIE` n'y est pas
 * une coupe. Mesure du 30 septembre 2026, mots de Yue Tan (dev) : la première syllabe d'un
 * mot à frontière voisée passe de 73,6 à 83,8 % de tons reconnus en tête.
 */
export function segmenter(
  trames: Trame[],
  n = 1,
  trouMax = 0.12,
  fin: Partial<OptionsFin> | null = {},
  liees: readonly boolean[] | null = null,
): Segment[] {
  const of = fin === null ? null : { ...FIN_DEFAUT, ...fin };
  const plages = plagesVoisees(trames);
  if (plages.length === 0) return [];
  const pas = trames.length > 1 ? trames[1].t - trames[0].t : 0.01;
  const trouT = Math.round(trouMax / pas);
  // regroupe les plages voisines en étendues
  const etendues: Array<{ a: number; b: number; trous: Array<[number, number]>; e: number }> = [];
  for (const [a, b] of plages) {
    const der = etendues[etendues.length - 1];
    const e = trames.slice(a, b).reduce((s, t) => s + t.rms * t.rms, 0);
    const trouLimite = n > 1 ? trouT * 3 : trouT;
    if (der && a - der.b <= trouLimite) {
      der.trous.push([der.b, a]);
      der.b = b;
      der.e += e;
    } else etendues.push({ a, b, trous: [], e });
  }
  const ext = etendues.reduce((m, x) => (x.e > m.e ? x : m));

  // coupes
  const coupes: Array<[number, number]> = [];
  if (n > 1) {
    const len = ext.b - ext.a;
    // une seconde syllabe qui commence par une voix (m, n, l, r, y, w, une voyelle) n'a pas
    // de silence devant elle : un trou court y est le creux craqué d'un ton 3, pas la coupe
    const liee = liees !== null && liees.length === n - 1 && liees.every((l) => l);
    const trouLie = Math.round(TROU_LIE / pas);
    const candidats = ext.trous
      .filter(([a, b]) => a - ext.a > 0.15 * len && ext.b - b > 0.15 * len)
      .filter(([a, b]) => !liee || b - a >= trouLie)
      .sort((p, q) => q[1] - q[0] - (p[1] - p[0]));
    const pris = candidats.slice(0, n - 1).sort((p, q) => p[0] - q[0]);
    coupes.push(...pris);
    // deux syllabes sans trou : au creux d'énergie le plus marqué entre deux crêtes
    if (coupes.length < n - 1 && n === 2) {
      const c = creux(trames, ext.a, ext.b);
      if (c >= 0) coupes.push([c, c + 1]);
    }
    // pas assez de trous : couper au creux d'énergie de la part la plus longue
    while (coupes.length < n - 1) {
      const bornes = [ext.a, ...coupes.flatMap((c) => c), ext.b];
      let meilleure = 0, lmax = -1;
      for (let i = 0; i < bornes.length; i += 2) {
        if (bornes[i + 1] - bornes[i] > lmax) { lmax = bornes[i + 1] - bornes[i]; meilleure = i; }
      }
      const a = bornes[meilleure], b = bornes[meilleure + 1];
      const l = b - a;
      const lis = (i: number) => (trames[i - 1].rms + trames[i].rms + trames[i + 1].rms) / 3;
      let im = a + Math.round(0.5 * l);
      let vm = Infinity;
      for (let i = a + Math.round(0.25 * l); i < a + Math.round(0.75 * l); i++) {
        const v = lis(i);
        if (v < vm) { vm = v; im = i; }
      }
      coupes.push([im, im + 1]);
      coupes.sort((p, q) => p[0] - q[0]);
    }
  }
  const bornes: Array<[number, number]> = [];
  let debut = ext.a;
  for (const [ca, cb] of coupes) { bornes.push([debut, ca]); debut = cb; }
  bornes.push([debut, ext.b]);

  return bornes.map(([a, b]) => {
    // retire les trames non voisées des bords
    while (a < b && !trames[a].voisee) a++;
    while (b > a && !trames[b - 1].voisee) b--;
    // la hauteur de travail : celle des trames, corrigée à la fin et aux sauts d'octave
    const hz = trames.map((tr) => (tr.voisee ? tr.f0 : 0));
    if (of !== null && b > a) b = nettoyer(trames, hz, a, b, of);
    // comble l'intérieur
    const f0: number[] = [];
    const t: number[] = [];
    let vois = 0;
    for (let i = a; i < b; i++) {
      t.push(trames[i].t);
      if (hz[i] > 0) { f0.push(hz[i]); vois++; continue; }
      let g = i - 1; while (g >= a && !(hz[g] > 0)) g--;
      let d = i + 1; while (d < b && !(hz[d] > 0)) d++;
      const fg = hz[g], fd = hz[d];
      f0.push(fg * Math.pow(fd / fg, (i - g) / (d - g)));
    }
    if (of !== null && of.mediane > 1) lisser(f0, of.mediane);
    return { debut: a, fin: b, f0, t, duree: (b - a) * pas, voisement: b > a ? vois / (b - a) : 0 };
  });
}

/** Devant une syllabe liée, un trou plus court que ça (s) n'est pas la frontière. */
export const TROU_LIE = 0.15;

/**
 * Le creux d'énergie le plus marqué entre deux syllabes voisées : l'énergie en dB, lissée sur
 * cinq trames ; parmi les minimums locaux du milieu de l'étendue, celui dont la
 * proéminence (la plus basse des deux crêtes qui l'encadrent, moins lui) est la plus
 * grande. -1 s'il n'y en a pas.
 */
export function creux(trames: Trame[], a: number, b: number, bord = 0.2): number {
  const db = trames.map((t) => 20 * Math.log10(Math.max(t.rms, 1e-7)));
  const l: number[] = [];
  for (let i = a; i < b; i++) {
    let s = 0, k = 0;
    for (let j = Math.max(a, i - 2); j <= Math.min(b - 1, i + 2); j++) { s += db[j]; k++; }
    l.push(s / k);
  }
  const i0 = Math.max(1, Math.round(bord * l.length)), i1 = Math.min(l.length - 1, Math.round((1 - bord) * l.length));
  let meilleur = -1, prom = -Infinity;
  for (let i = i0; i < i1; i++) {
    if (!(l[i] <= l[i - 1] && l[i] <= l[i + 1])) continue;
    let g = -Infinity, d = -Infinity;
    for (let j = 0; j < i; j++) g = Math.max(g, l[j]);
    for (let j = i + 1; j < l.length; j++) d = Math.max(d, l[j]);
    const p = Math.min(g, d) - l[i];
    if (p > prom) { prom = p; meilleur = i; }
  }
  return meilleur < 0 ? -1 : a + meilleur;
}

/**
 * Le nettoyage d'une syllabe, avant qu'elle ne devienne une courbe (retour du propriétaire
 * du 29 septembre 2026 : « le ton détecté semble monter d'un coup à la fin »). Quand la voix
 * s'éteint (souffle, voix craquée, énergie qui tombe), YIN prend un harmonique ou du bruit
 * pour la hauteur : la courbe bondit vers l'aigu sur ses dernières trames.
 */
export interface OptionsFin {
  /** La fin est coupée tant que ses trames sont à plus de tant de dB sous le pic de la syllabe… */
  dbSousPic: number;
  /** …ou que leur apériodicité (la confiance de YIN, 0 périodique, 1 bruit) dépasse ce plafond… */
  apFin: number;
  /** …sans jamais retirer plus de cette part de la syllabe. */
  partMax: number;
  /** Un saut de plus de tant de demi-tons d'une trame voisée à la suivante n'est pas une voix. */
  saut: number;
  /** Un saut final vers l'aigu est écarté si ce qui le suit tient dans cette part de la syllabe. */
  partSaut: number;
  /** Un aller et retour de plus de `saut` demi-tons sur au plus tant de trames est un saut d'octave. */
  allerRetour: number;
  /** Lissage médian de la courbe comblée, en trames (1 : aucun). */
  mediane: number;
}

export const FIN_DEFAUT: OptionsFin = {
  dbSousPic: 15,
  apFin: 0.3,
  partMax: 0.3,
  saut: 7,
  partSaut: 0.35,
  allerRetour: 12,
  mediane: 3,
};

/**
 * Corrige `hz` (0 : trame écartée) entre `a` et `b`, et rend la nouvelle fin. Trois règles :
 * - la fin qui s'éteint : on retire les dernières trames trop faibles face au pic de la
 *   syllabe, ou trop peu périodiques, dans la limite de `partMax` ;
 * - l'aller et retour : un saut de plus de `saut` demi-tons suivi, en peu de trames, du saut
 *   inverse est un saut d'octave ; les trames du milieu sont ramenées à l'octave de leurs
 *   voisines (ou écartées quand l'écart n'est pas une octave) ;
 * - le saut final vers l'aigu sans retour, sur la fin de la syllabe : écarté.
 */
function nettoyer(trames: Trame[], hz: number[], a: number, b: number, o: OptionsFin): number {
  const long = b - a;
  let pic = 0;
  for (let i = a; i < b; i++) if (hz[i] > 0) pic = Math.max(pic, trames[i].rms);
  const plancher = pic * Math.pow(10, -o.dbSousPic / 20);
  const minFin = b - Math.floor(o.partMax * long);
  while (b > minFin && (hz[b - 1] <= 0 || trames[b - 1].rms < plancher || trames[b - 1].aperiodicite > o.apFin)) b--;
  while (b > a && hz[b - 1] <= 0) b--;

  // les trames voisées restantes, et leurs sauts
  const v: number[] = [];
  for (let i = a; i < b; i++) if (hz[i] > 0) v.push(i);
  const st = (k: number) => 12 * Math.log2(hz[v[k]] / hz[v[k - 1]]);
  for (let k = 1; k < v.length; k++) {
    const d = st(k);
    if (Math.abs(d) <= o.saut) continue;
    // cherche le retour : le saut inverse, qui ramène près de la hauteur d'avant le saut
    let m = -1;
    for (let j = k + 1; j < v.length && j - k <= o.allerRetour; j++) {
      const r = st(j);
      const retour = Math.abs(12 * Math.log2(hz[v[j]] / hz[v[k - 1]])) <= o.saut;
      if (Math.sign(r) === -Math.sign(d) && Math.abs(r) > o.saut && retour) { m = j; break; }
    }
    if (m > 0) {
      const oct = Math.round(d / 12);
      for (let j = k; j < m; j++) {
        if (oct !== 0 && Math.abs(d - 12 * oct) < 3) hz[v[j]] /= Math.pow(2, oct);
        else hz[v[j]] = 0;
      }
      k = m - 1;
      continue;
    }
    // un saut vers l'aigu sans retour, sur la fin : on écarte ce qui le suit
    if (d > 0 && b - v[k] <= o.partSaut * long) {
      for (let j = k; j < v.length; j++) hz[v[j]] = 0;
      b = v[k - 1] + 1;
      break;
    }
  }
  return b;
}

/** Médiane glissante de `k` points (impair), en place, bords compris. */
function lisser(f: number[], k: number): void {
  const h = k >> 1;
  const v = [...f];
  for (let i = 0; i < f.length; i++) f[i] = mediane(v.slice(Math.max(0, i - h), Math.min(v.length, i + h + 1)));
}

/** Hz vers demi-tons autour d'une référence (la moyenne du locuteur). */
export function demiTons(f0: number, ref: number): number {
  return 12 * Math.log2(f0 / ref);
}

/** Moyenne géométrique (en Hz) d'un contour : la référence d'un énoncé seul. */
export function moyenneLog(f0: number[]): number {
  if (f0.length === 0) return 0;
  let s = 0;
  for (const f of f0) s += Math.log2(f);
  return Math.pow(2, s / f0.length);
}
