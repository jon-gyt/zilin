/**
 * Les jeux du pas Utiliser (brief §9) : le dictionnaire éclair (« pas Utiliser, compteur
 * mots devinés ») et le message WeChat (« pas Utiliser, dès la 2e semaine »).
 *
 * Le pas garde ses vues, les mots et la phrase puis les trois lignes ; certains jours, un
 * jeu s'ajoute après le texte. La règle, déterministe, ne lit que le rang de la journée
 * (`rangDuJour` de `session.ts`), le budget et ce que l'acquis réel ouvre :
 *
 * - au plus un jeu par journée : jamais l'éclair et le message le même jour, et la
 *   session de plus n'en pose pas un second ;
 * - le message WeChat à partir du 8e jour, un jour sur trois (8e, 11e, 14e…), quand un
 *   dialogue pas encore lu au pas Utiliser est ouvert par l'acquis réel et tient dans le
 *   budget ; le plus récent du parcours d'abord ;
 * - sinon le dictionnaire éclair un jour sur deux (les jours pairs), quand un mot jamais
 *   appris a ses deux caractères acquis : un seul tour, un mot ;
 * - jamais plus long que le budget : le pas Utiliser dure ce que le chemin annonce (1, 2
 *   ou 4 minutes) ; les mots et la phrase en prennent 30 s, le texte 50 s, un mot de
 *   l'éclair 20 s, un échange du message 20 s. À 5 minutes, aucun jeu ; à 10, l'éclair ou
 *   un dialogue de deux échanges ; à 20, tous les dialogues.
 *
 * Le choix est fait une fois, à l'entrée du pas, et rangé dans la progression
 * (`poserJeuUtiliser`) : la reprise au pas exact retombe sur le même mot, le même dialogue.
 * Rien ici ne lit l'horloge ni n'écrit dans un stockage ; seul `chargerCorpus` lit les
 * fichiers de l'export, comme l'écran des jeux.
 */
import { toutesLesFiches, traitsDeFamilles } from './content';
import { eclairOnce, motsPossibles } from './eclair';
import { corpusDeJeu, type CorpusJeux } from './jeux';
import { melange } from './questions';
import type { Budget, JeuUtiliser, Progress } from './session';
import { dialoguesJouables, wechatOnce } from './wechat';

/** Le message WeChat s'ouvre au 8e jour : la 2e semaine. */
export const PREMIER_JOUR_MESSAGE = 8;

/** Puis un jour sur trois. */
export const MESSAGE_TOUS_LES = 3;

/** L'éclair, un jour sur deux. */
export const ECLAIR_TOUS_LES = 2;

/** La durée du pas Utiliser que le chemin annonce, en secondes, par budget (`sessionSteps`). */
export const SECONDES_PAS: Record<Budget, number> = { 5: 60, 10: 120, 20: 240 };

/** Ce que prend chaque vue du pas, estimé : ce que le budget doit absorber. */
export const SECONDES_VUE = { mots: 30, texte: 50, eclair: 20, echange: 20 } as const;

/** Ce que l'acquis ouvre aujourd'hui, tel que le contenu le dit. */
export type Offre = {
  /** Les mots de l'éclair qui peuvent se poser (`motsPossibles`), dans l'ordre de l'export. */
  mots: readonly string[];
  /** Les dialogues jouables (`dialoguesJouables`), le plus récent d'abord, et leur longueur. */
  dialogues: readonly { id: string; echanges: number }[];
  /** Les dialogues déjà lus au pas Utiliser : ils ne se reposent pas. */
  lus: readonly string[];
};

/** Le jeu choisi : lequel, et sur quel mot ou quel dialogue. */
export type Choix = { jeu: JeuUtiliser; id: string };

/** Un jour de message : à partir du 8e, un jour sur trois. */
export function jourDeMessage(rang: number): boolean {
  return rang >= PREMIER_JOUR_MESSAGE && (rang - PREMIER_JOUR_MESSAGE) % MESSAGE_TOUS_LES === 0;
}

/** Un jour d'éclair : un jour sur deux. */
export function jourDEclair(rang: number): boolean {
  return rang >= 1 && rang % ECLAIR_TOUS_LES === 0;
}

/** Le temps du pas avec ce jeu : les mots, le texte, et le jeu. */
export function secondesDuPas(jeu: JeuUtiliser | null, echanges = 0): number {
  const base = SECONDES_VUE.mots + SECONDES_VUE.texte;
  if (jeu === 'eclair') return base + SECONDES_VUE.eclair;
  if (jeu === 'message') return base + SECONDES_VUE.echange * echanges;
  return base;
}

/** Le pas tient-il dans ce que le chemin annonce ? */
export function tient(budget: Budget, secondes: number): boolean {
  return secondes <= SECONDES_PAS[budget];
}

/**
 * Le jeu du pas Utiliser pour la journée de rang `rang`, ou `null`. Le message passe
 * avant l'éclair son jour ; sans dialogue qui tienne, l'éclair prend la place si c'est
 * aussi un jour pair. Le mot de l'éclair est tiré d'après la graine (la journée).
 */
export function choisirJeu(rang: number, budget: Budget, offre: Offre, graine: string): Choix | null {
  if (jourDeMessage(rang)) {
    const lus = new Set(offre.lus);
    const d = offre.dialogues.find(
      (x) => !lus.has(x.id) && x.echanges > 0 && tient(budget, secondesDuPas('message', x.echanges))
    );
    if (d !== undefined) return { jeu: 'message', id: d.id };
  }
  if (jourDEclair(rang) && offre.mots.length > 0 && tient(budget, secondesDuPas('eclair'))) {
    return { jeu: 'eclair', id: melange(offre.mots, `${graine}/utiliser/eclair`)[0] };
  }
  return null;
}

/** L'offre du jour, lue sur le corpus des jeux : l'acquis réel seul, jamais la démonstration. */
export function offreDuCorpus(corpus: CorpusJeux, lus: readonly string[]): Offre {
  return {
    mots: motsPossibles(corpus).map((m) => m.id),
    dialogues: corpus.wechat
      ? dialoguesJouables(corpus.wechat).map((d) => ({ id: d.id, echanges: d.echanges.length }))
      : [],
    lus
  };
}

/** La graine des tours du pas Utiliser : la journée. Même journée, même tour. */
export function graineUtiliser(jour: string): string {
  return `${jour}/utiliser`;
}

/**
 * Le corpus des deux jeux, lu dans l'export : les fiches (sens et pinyin pour la
 * correction, mots déjà lus), le dictionnaire éclair, les dialogues, et les tracés des
 * caractères acquis de l'éclair — un mot ne se pose que si ses deux caractères se
 * dessinent depuis leurs traits.
 */
export async function chargerCorpus(p: Progress): Promise<CorpusJeux> {
  const [fiches, eclair, wechat] = await Promise.all([
    toutesLesFiches().catch(() => []),
    eclairOnce().catch(() => null),
    wechatOnce().catch(() => null)
  ]);
  const sources = {
    fiches,
    cartes: p.cartes,
    eclair,
    devines: p.motsDevines,
    wechat,
    parcours: p.parcours
  };
  const acquis = new Set(corpusDeJeu(sources).eclair?.acquis ?? []);
  const racines = (eclair?.mots ?? []).flatMap((m) =>
    [...m.mot].every((c) => acquis.has(c)) ? [...m.mot].map((c) => eclair?.racines[c] ?? '') : []
  );
  const traits = await traitsDeFamilles(racines.filter((r) => r !== '')).catch(() => ({}));
  return corpusDeJeu({ ...sources, traits: Object.keys(traits) });
}
