/**
 * Le maître Xing 杏 (décision du propriétaire du 29 septembre 2026) : sa rencontre, qui a les
 * rôles avant et après, ses humeurs, ses lignes et la charte de son dessin. Un test par règle.
 * Le calendrier et les textes sont ceux de l'export versionné, que le pipeline écrit et contrôle.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lireExamensDonnees } from './examens';
import { CLES_XING, lireEcrans } from './ecrans';
import { etatNeuf, lireCalendrier, mesure, retourAuMenu, visible, type Calendrier, type EtatOuvertures } from './ouvertures';
import { emptyProgress, fromJSON, toJSON, type Progress } from './session';
import {
  HUMEURS,
  PORTE_XING,
  POSTURES,
  POSTURES_TAO,
  POSTURE_RENCONTRE,
  ROLES,
  cleExplication,
  guide,
  humeurXing,
  rencontre,
  type Moment
} from './xing';

const source = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
const CAL: Calendrier = lireCalendrier(JSON.parse(source('../../public/data/0.1.0/ouvertures.json')) as unknown);
const EXAMENS = lireExamensDonnees(JSON.parse(source('../../public/data/0.1.0/examens.json')) as unknown);
const ECRANS = lireEcrans(JSON.parse(source('../../public/data/0.1.0/ecrans.json')) as unknown);
const XIAN = EXAMENS.examens[0];
const JOUR = '2026-09-29';

/** Une suite de retours au menu, à une même mesure. */
function retours(etat: EtatOuvertures | null, jour: number, lus: number, n: number): { etat: EtatOuvertures; annonces: string[] } {
  let e = etat;
  const annonces: string[] = [];
  for (let k = 0; k < n; k++) {
    const r = retourAuMenu(e, CAL, mesure(jour, lus), JOUR);
    e = r.etat;
    if (r.annonce) annonces.push(r.annonce.id);
  }
  return { etat: e ?? etatNeuf(), annonces };
}

describe('la porte de la rencontre', () => {
  it('Tao rencontre Xing à la porte du premier examen, le 县试, au palier qui l’ouvre', () => {
    expect(XIAN.hz).toBe('县试');
    const porte = CAL.find((p) => p.id === PORTE_XING);
    expect(porte).toMatchObject({ unite: 'lus', seuil: XIAN.palier, parent: null });
    expect(porte?.annonce).toContain('杏');
    expect(porte?.annonce).toContain('县试');
  });

  it('elle ne s’ouvre pas avant le palier', () => {
    const { etat, annonces } = retours(etatNeuf(), 30, XIAN.palier - 1, 25);
    expect(annonces).not.toContain(PORTE_XING);
    expect(rencontre(etat, CAL)).toBe(false);
  });

  it('le jour où l’examen s’ouvre, la rencontre s’annonce avant toute autre porte', () => {
    /* Jour 25 : les contes s'ouvrent aussi ; toutes les portes d'avant sont déjà montrées. */
    const avant = retours(etatNeuf(), 24, XIAN.palier - 1, 25).etat;
    const r = retourAuMenu(avant, CAL, mesure(25, XIAN.palier), JOUR);
    expect(Object.keys(r.etat.ouvertes)).toContain('contes');
    expect(r.annonce?.id).toBe(PORTE_XING);
    expect(rencontre(r.etat, CAL)).toBe(true);
  });

  it('une progression d’avant l’aventure le rencontre en silence, sans annonce', () => {
    const { etat, annonces } = retours(null, 60, 120, 3);
    expect(annonces).toEqual([]);
    expect(rencontre(etat, CAL)).toBe(true);
    /* Moins de lus : pas encore. */
    expect(rencontre(retours(null, 10, 12, 3).etat, CAL)).toBe(false);
  });

  it('une rencontre reste faite, même quand le compte des lus redescend', () => {
    const { etat } = retours(etatNeuf(), 30, XIAN.palier, 25);
    const apres = retourAuMenu(etat, CAL, mesure(30, 10), JOUR).etat;
    expect(rencontre(apres, CAL)).toBe(true);
  });
});

describe('qui a le rôle, avant et après la rencontre', () => {
  it('avant, Tao garde tous les rôles, dans ses postures d’avant', () => {
    for (const role of ROLES) expect(guide(role, false)).toBe('tao');
    expect(POSTURES_TAO).toEqual({ examen: 'chemin', etymologie: 'lecon', conte: 'lecture', anecdote: 'anecdote', dictionnaire: 'lecture' });
  });

  it('après, Xing les tient tous, chacun dans sa posture', () => {
    for (const role of ROLES) expect(guide(role, true)).toBe('xing');
    expect(POSTURES).toEqual({ examen: 'examine', etymologie: 'explique', conte: 'raconte', anecdote: 'raconte', dictionnaire: 'consulte' });
    expect(POSTURE_RENCONTRE).toBe('salue');
  });

  it('la rencontre se lit sur les portes que la progression garde : aucun champ de plus, export et import compris', () => {
    const { etat } = retours(etatNeuf(), 30, XIAN.palier, 25);
    const p: Progress = { ...emptyProgress(JOUR), premiere: false, ouvertures: etat };
    const relue = fromJSON(toJSON(p), JOUR);
    expect(rencontre(relue.ouvertures, CAL)).toBe(true);
    expect(Object.keys(JSON.parse(toJSON(p)) as object).some((k) => /xing|maitre|rencontre/i.test(k))).toBe(false);
  });

  it('sans calendrier lu, sans état suivi, ou avec un export sans la rencontre, Tao garde ses rôles', () => {
    const { etat } = retours(etatNeuf(), 30, XIAN.palier, 25);
    expect(rencontre(etat, null)).toBe(false);
    expect(rencontre(null, CAL)).toBe(false);
    expect(rencontre(etat, CAL.filter((p) => p.id !== PORTE_XING))).toBe(false);
    /* Un export sans calendrier montre tout, mais ne présente pas Xing. */
    expect(visible(etat, [], PORTE_XING)).toBe(true);
    expect(rencontre(etat, [])).toBe(false);
  });
});

describe('ses humeurs', () => {
  it('deux humeurs au plus, jamais négatives', () => {
    expect(HUMEURS).toEqual(['calme', 'content']);
  });

  it('il ne gronde jamais : une réponse à reprendre ou un examen pas encore reçu le laissent calme', () => {
    expect(humeurXing('pas-celle')).toBe('calme');
    expect(humeurXing('pas-encore')).toBe('calme');
    expect(humeurXing('question')).toBe('calme');
  });

  it('il est content d’une réponse trouvée, rattrapée comprise, d’un examen reçu et de la rencontre', () => {
    for (const m of ['juste', 'rattrapee', 'recu', 'rencontre'] as Moment[]) expect(humeurXing(m)).toBe('content');
  });
});

describe('il distingue attesté et mnémotechnique', () => {
  it('sa ligne suit l’étiquette de la fiche, jamais l’autre', () => {
    expect(cleExplication('brique', 'atteste', 'Un homme debout.')).toBe('brique-atteste');
    expect(cleExplication('brique', 'mnemotechnique', 'Pour retenir.')).toBe('brique-mnemo');
    expect(cleExplication('compose', 'atteste', 'x')).toBe('compose-atteste');
    expect(cleExplication('compose', 'mnemotechnique', 'x')).toBe('compose-mnemo');
  });

  it('sans origine relue, il ne dit ni l’un ni l’autre', () => {
    expect(cleExplication('brique', null, '')).toBe('brique-sans');
    expect(cleExplication('brique', 'atteste', '')).toBe('brique-sans');
  });

  it('les lignes exportées disent chacune leur étiquette, et elle seule', () => {
    for (const vue of ['brique', 'compose']) {
      expect(ECRANS.xing[`${vue}-atteste` as 'brique-atteste']).toMatch(/attest/i);
      expect(ECRANS.xing[`${vue}-atteste` as 'brique-atteste']).not.toMatch(/mnémotechnique/i);
      expect(ECRANS.xing[`${vue}-mnemo` as 'brique-mnemo']).toMatch(/mnémotechnique/i);
      expect(ECRANS.xing[`${vue}-mnemo` as 'brique-mnemo']).not.toMatch(/attest/i);
    }
  });
});

describe('ses textes viennent du pipeline', () => {
  it('chaque ligne de la rencontre et du pas Apprendre est exportée', () => {
    for (const cle of CLES_XING) expect(ECRANS.xing[cle], cle).not.toBe('');
    expect(ECRANS.xing.caractere).toBe('杏');
  });

  it('ses lignes d’examinateur sont exportées, et « on se revoit au prochain »', () => {
    for (const cle of ['xing_avant', 'xing_avant_yueke', 'xing_attente', 'xing_recu', 'xing_recu_yueke', 'xing_pas_encore', 'xing_bang']) {
      expect(EXAMENS.textes[cle], cle).toBeTruthy();
    }
    expect(EXAMENS.textes.xing_pas_encore).toContain('prochain');
  });

  it('les écrans n’écrivent aucune de ses phrases en dur', () => {
    for (const f of ['Rencontre.svelte', 'Examen.svelte', 'Learn.svelte']) {
      expect(source(f), f).not.toMatch(/Je suis Xing|on se revoit/);
    }
  });
});

describe('la charte de son dessin', () => {
  const code = source('Xing.svelte').replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, '');

  it('ni cinabre, ni ombre, ni dégradé, ni doré, ni dragon, ni emoji', () => {
    expect(code).not.toMatch(/--zhu|#C8371F|gradient|box-shadow|drop-shadow|gold|doré|dragon|龙/i);
    expect(code).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('ses couleurs sont fixes : des jetons --x-*, aucune couleur en dur', () => {
    expect(code).toMatch(/var\(--x-corps\)/);
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source('tokens.css')).toMatch(/--x-corps:#F7E6C4/);
  });

  it('le même repère que Tao : à la même taille, il n’est pas plus grand qu’elle', () => {
    expect(code).toContain('viewBox="0 0 200 200"');
    expect(source('Tao.svelte')).toContain('viewBox="0 0 200 200"');
  });

  it('les accessoires ne lisent que ses points d’ancrage', () => {
    expect(code).toContain('const ANCRES');
    expect(code).toMatch(/ANCRES\.main/);
    expect(code).toMatch(/ANCRES\.devant/);
  });

  it("il respire doucement, et tout s'arrête si l'on réduit les animations", () => {
    expect(code).toMatch(/respire-xing/);
    expect(code).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.xing \*\s*\{\s*animation: none !important;/);
  });
});
