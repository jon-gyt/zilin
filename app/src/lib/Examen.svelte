<script lang="ts">
  /**
   * L'écran de l'examen 科举 et du 月课 (story 8.3), d'après la maquette validée par le
   * propriétaire le 29 septembre 2026 (`maquettes/examen.html`), qui fait foi.
   *
   * - L'annonce : la scène (le 号舍, Tao au col bleu d'écolier 青衿, sans robe, avec son pinceau et le
   *   panier 考篮 ; au 月课, le 书院 et Tao un livre sous le bras), le nom de l'examen dessiné
   *   depuis ses traits, ce qu'il donne, les règles, le bouton.
   * - La question : « Quitter », l'examen et le rang de la question, les pastilles (jade du
   *   premier coup, ocre manquée), la mise en situation dessinée à plat, les choix. Une
   *   seconde chance : après une erreur, une autre réponse se touche ; rattrapée, elle donne
   *   son point 读 mais ne compte pas pour le premier coup. Tao attend à la porte avec le
   *   panier, puis dit ce qu'on vient de lire. Sans chronomètre ; « Quitter » reprend à la
   *   même question. Entre deux essais, Tao ne donne jamais la bonne réponse, ni directement
   *   ni par une glose (signalement du propriétaire du 29 septembre 2026) : au plus ce que
   *   veut dire le choix touché, ou une invitation à relire ; l'explication vient à la fin.
   *   Aux premiers examens (décision du propriétaire du 29 septembre 2026, « jusqu'à HSK
   *   1 »), le pinyin se lit sous chaque caractère du support, de l'affirmation d'un vrai ou
   *   faux et des répliques à choisir ; jamais sous l'objet ni les choix d'une question de
   *   revue, où il donnerait la réponse (`pinyinDeQuestion`).
   * - Le résultat : un constat, jamais en ocre (« 9 sur 10 du premier coup. Reçu au 县试. »,
   *   « 6 sur 10 du premier coup. Pas encore. »), les caractères manqués dessinés depuis leurs
   *   traits et nommés avec l'endroit où on les a croisés, les points 读.
   * - Le 放榜, après un examen à titre reçu : la liste au mur, des noms inventés écrits avec
   *   l'acquis, sans numéro ni rang, le nom du personnage au pinceau, cerclé de jade ; le
   *   personnage et Tao la lisent. Le 月课 n'a pas de liste : on revient au menu.
   *
   * Rien en dur : les textes de l'écran et les phrases de Tao viennent de `examens.json`
   * (`textes`), les noms du 放榜 aussi ; ce qui se décide est dans `examens.ts` et
   * `session.ts`. Charte : l'indigo pour l'action, le jade pour le reçu, l'ocre pour une
   * réponse fausse seulement ; ni cinabre, ni ombre, ni dégradé, ni doré, ni emoji.
   */
  import { untrack } from 'svelte';
  import Glyph from './Glyph.svelte';
  import Heros from './Heros.svelte';
  import SupportExamen from './SupportExamen.svelte';
  import Tao from './Tao.svelte';
  import Xing from './Xing.svelte';
  import { fiche, traitsDe } from './content';
  import {
    ACADEMIE,
    ACADEMIE_TAO,
    ACADEMIE_XING,
    BANG,
    BANG_FIN,
    BANG_HEROS,
    BANG_TAO,
    BANG_XING,
    HAOSHE,
    HAOSHE_TAO,
    HAOSHE_VUE,
    HAOSHE_XING,
    dessinAcademie,
    dessinBang,
    dessinHaoshe
  } from './examen-dessins';
  import {
    SANS_PINYIN,
    avecPinyin,
    cheminDesExamens,
    corriger,
    dateDuBang,
    examenDuChemin,
    examensPassables,
    genresDe,
    manquesDetailles,
    morceaux,
    pinyinDeQuestion,
    prochainATitre,
    questionFinie,
    questionsDe,
    rangsPosables,
    retourQuestion,
    reussite,
    serieDe,
    serieDeTentative,
    situation,
    grappesDePhrase,
    texteExamen,
    titreAvec,
    type Bilan,
    type Examen,
    type ExamensDonnees,
    type Manque,
    type Phrase,
    type QuestionExamen,
    type Sens,
    type SerieExamen
  } from './examens';
  import type { StrokeData } from './glyph';
  import { meriteDe, rangTenu, type HerosDonnees } from './heros';
  import type { Progress } from './session';
  import { stade } from './tao';
  import { POSTURES, humeurXing } from './xing';

  let {
    p,
    donnees,
    heros = null,
    lus,
    xing = false,
    oncommencer,
    onrepondre,
    onavancer,
    onterminer,
    onquitter,
    onretour
  }: {
    p: Progress;
    donnees: ExamensDonnees;
    /** Les rangs du personnage (`heros.json`) : le titre et son mot à mot, sa silhouette. */
    heros?: HerosDonnees | null;
    /** Les caractères lus, au seuil de Ma forêt : l'examen ouvert se lit dessus. */
    lus: number;
    /**
     * Le maître Xing 杏 est rencontré (`xing.ts`) : c'est lui l'examinateur. Il pose les
     * questions derrière sa petite table, accorde la seconde chance et lit le 榜 ; Tao passe
     * l'examen au col d'écolier, comme avant. Avant la rencontre, Tao dit tout, sans changement.
     */
    xing?: boolean;
    /** Commence (ou reprend) l'examen, avec les questions posables de la série. */
    oncommencer: (poses: number[]) => void;
    /** Une réponse touchée à la question `i`. */
    onrepondre: (i: number, q: QuestionExamen, donnee: number | boolean) => void;
    /** La question suivante. */
    onavancer: (i: number) => void;
    /** La dernière question répondue : le constat. */
    onterminer: (questions: number) => Bilan;
    /** « Quitter » : sauvegarde, et on reprendra à la même question. */
    onquitter: () => void;
    /** Retour au menu, depuis l'annonce, le résultat ou le 放榜. */
    onretour: () => void;
  } = $props();

  const t = (cle: string, v: Readonly<Record<string, string | number>> = {}): string => texteExamen(donnees, cle, v);

  /* ---------- l'examen du moment, gardé pour le résultat et le 放榜 ---------- */

  const chemin = $derived(cheminDesExamens(p.parcours));
  const liste = $derived(examensPassables(donnees, chemin));
  const s0 = untrack(() => situation(examensPassables(donnees, cheminDesExamens(p.parcours)), p.examens, lus, p.cartes));
  /** L'examen de cet écran : figé à l'ouverture, il reste le même au résultat. */
  const examen: Examen | null = s0.etat === 'aucun' ? null : s0.examen;
  type Vue = 'intro' | 'question' | 'resultat' | 'bang';
  let vue = $state<Vue>(s0.etat === 'en_cours' ? 'question' : 'intro');

  const tentative = $derived(p.examens.tentative !== null && p.examens.tentative.examen === examen?.id ? p.examens.tentative : null);
  const serie = $derived(tentative === null ? null : serieDe(donnees, tentative));
  const questions = $derived(serie !== null && tentative !== null ? questionsDe(serie, tentative) : []);
  const i = $derived(tentative?.i ?? 0);
  const q = $derived(questions[i] ?? null);
  const essais = $derived(tentative?.essais ?? []);
  const fini = $derived(q !== null && questionFinie(q, essais));
  const support = $derived(q?.support === undefined || serie === null ? null : (serie.supports.find((x) => x.id === q.support) ?? null));
  /** Le pinyin sous les caractères : l'examen le porte sur ce chemin (l'export le dit). */
  const pinyin = $derived(tentative !== null && avecPinyin(donnees, tentative.chemin, tentative.examen));
  /** Où cette question le montre : jamais sur ce qui donnerait la réponse. */
  const py = $derived(q === null || serie === null ? SANS_PINYIN : pinyinDeQuestion(q, serie, pinyin));
  /** Les mots de la glose : avec le pinyin, un mot ne se coupe pas en fin de ligne. */
  const entrees = $derived(serie === null ? [] : Object.keys(serie.glose));

  /* ---------- les traits des grands caractères ---------- */

  let traits = $state(new Map<string, StrokeData>());
  /** Charge les traits de ce qui se dessine en SVG : noms, plaques, enseigne, 放榜. */
  function charger(chars: Iterable<string>): void {
    const manquants = [...new Set(chars)].filter((c) => /[㐀-鿿]/.test(c) && !traits.has(c));
    if (manquants.length === 0) return;
    void Promise.all(manquants.map((c) => traitsDe(c).then((d) => [c, d] as const).catch(() => [c, null] as const))).then((l) => {
      const m = new Map(traits);
      for (const [c, d] of l) if (d) m.set(c, d);
      traits = m;
    });
  }
  const plaquesHaoshe = $derived(t('plaques_haoshe').split(/\s+/).filter((x) => x !== ''));
  const plaqueAcademie = $derived(t('plaque_academie'));
  const enteteBang = $derived(t('bang_entete'));
  $effect(() => {
    const e = examen;
    charger([...(e?.hz ?? ''), ...plaquesHaoshe.join(''), ...plaqueAcademie, ...(p.heros?.nom ?? '')]);
  });
  $effect(() => {
    if (support?.genre === 'enseigne') charger(support.lignes.map((l) => l.zh).join(''));
  });

  /* ---------- l'annonce ---------- */

  const rangs = $derived(heros?.rangs ?? []);
  const sensDuTitre = (hz: string): string => rangs.find((r) => r.hz === hz)?.fr ?? '';
  const donne = $derived.by(() => {
    if (examen === null) return '';
    if (examen.sorte === 'yueke') return t('donne_yueke');
    if (examen.titre !== null) return t('donne_titre', { titre: examen.titre, sens: sensDuTitre(examen.titre) });
    const avec = titreAvec(donnees.examens, examen);
    return avec === null || avec.titre === null
      ? ''
      : t('donne_avec', { suivant: avec.hz, palier: avec.palier, titre: avec.titre, sens: sensDuTitre(avec.titre) });
  });
  /** La série de la prochaine tentative : A d'abord, l'autre à chaque reprise. */
  const serieAVenir = $derived.by((): SerieExamen | null => {
    if (examen === null) return null;
    const avant = p.examens.tentative;
    const numero = avant !== null && avant.examen === examen.id ? avant.numero + (avant.echec === null ? 0 : 1) : 0;
    return examenDuChemin(donnees, chemin, examen.id)?.series[serieDeTentative(numero)] ?? null;
  });
  const avecCarte = $derived(new Set(p.cartes.map((c) => c.id)));
  const aPoser = $derived(serieAVenir === null ? [] : rangsPosables(serieAVenir, avecCarte));
  const nombreQuestions = $derived(tentative !== null && tentative.echec === null ? questions.length : aPoser.length);
  const supportsDits = $derived(serieAVenir === null ? '' : genresDe(serieAVenir).map((g) => t(`genre_${g}`)).join(', '));
  const troncon = $derived(examen === null ? [] : (examenDuChemin(donnees, chemin, examen.id)?.troncon ?? []));
  const precedent = $derived.by(() => {
    if (examen === null) return null;
    const k = donnees.examens.findIndex((e) => e.id === examen.id);
    return k > 0 ? donnees.examens[k - 1] : null;
  });

  function commencer(): void {
    if (tentative === null || tentative.echec !== null) oncommencer(aPoser);
    vue = 'question';
  }

  /* ---------- la question ---------- */

  const kicker = $derived(q === null ? '' : support !== null ? support.contexte.fr : t('kicker_revue'));
  const pips = $derived(
    questions.map((_, k) =>
      tentative === null ? '' : k < tentative.reponses.length ? (tentative.reponses[k] ? 'ok' : 'ko') : k === i ? 'cur' : ''
    )
  );

  function toucher(donnee: number | boolean): void {
    if (q === null || fini || essais.includes(donnee)) return;
    onrepondre(i, q, donnee);
  }

  /**
   * Le retour de Tao : l'explication complète une fois la question close ; entre deux
   * essais, jamais la bonne réponse, ni directement ni par une glose (`retourSecondEssai`).
   */
  const retour = $derived(q === null || serie === null ? null : retourQuestion(q, essais, serie, support, t));

  /* ---------- le résultat ---------- */

  let bilan = $state<Bilan | null>(null);
  let manques = $state<Manque[]>([]);
  /** Les réponses du premier coup, gardées : reçu, la tentative se ferme. */
  let reponsesFin = $state<boolean[]>([]);
  /** Le pinyin et le premier sens des caractères manqués, lus dans leur fiche. */
  let infos = $state<Record<string, { pinyin: string; fr: string }>>({});

  function suivante(): void {
    if (tentative === null || serie === null) return;
    if (i < questions.length - 1) {
      onavancer(i);
      return;
    }
    manques = manquesDetailles(serie, tentative);
    reponsesFin = [...tentative.reponses];
    bilan = onterminer(questions.length);
    vue = 'resultat';
    for (const m of manques) {
      void fiche(m.c)
        .then((f) => {
          if (f) infos = { ...infos, [m.c]: { pinyin: f.pinyin, fr: f.fr.split(/[,;，；]/)[0]?.trim() ?? '' } };
        })
        .catch(() => undefined);
    }
  }

  const ou = (m: Manque): string =>
    m.support === null ? t('ou_revue') : m.support.contexte.fr.charAt(0).toLowerCase() + m.support.contexte.fr.slice(1);
  const points = $derived(bilan === null ? 0 : bilan.justes + bilan.rattrapees);
  const ligneDesPoints = $derived.by(() => {
    if (bilan === null) return '';
    if (bilan.rattrapees === 0) return t('points', { points, justes: bilan.justes });
    if (bilan.rattrapees === 1) return t('points_rattrape_un', { points, justes: bilan.justes });
    return t('points_rattrapes', { points, justes: bilan.justes, rattrapees: bilan.rattrapees });
  });
  const aTitreSuivant = $derived(examen === null ? null : prochainATitre(donnees.examens, examen.id));
  const suite = $derived.by(() => {
    const e = aTitreSuivant;
    if (e === null || e.titre === null || examen === null) return '';
    return examen.sorte === 'yueke'
      ? t('suite_yueke', { examen: e.hz, palier: e.palier, titre: e.titre })
      : t('suite_titre', { examen: e.hz, palier: e.palier, titre: e.titre, sens: sensDuTitre(e.titre) });
  });

  /* ---------- le 放榜 ---------- */

  const noms = $derived(examen === null ? [] : (examenDuChemin(donnees, chemin, examen.id)?.noms ?? []));
  const nomHeros = $derived(p.heros?.nom ?? '');
  const rangHeros = $derived(rangTenu(rangs, meriteDe(p, lus)));
  const date = $derived(dateDuBang(p.day));

  /* ---------- Tao ---------- */

  const taoStade = $derived(stade(p.tao.croissance));
  const yueke = $derived(examen?.sorte === 'yueke');

  /* ---------- Xing, l'examinateur ---------- */

  /** Qui parle : le maître une fois rencontré, Tao avant. Les phrases viennent de `examens.json`. */
  const dit = (cleTao: string, cleXing: string): string => t(xing ? cleXing : cleTao);
</script>

{#snippet riche(texte: string)}
  {#each morceaux(texte) as m, k (k)}
    {#if m.gras}<b>{@render hanzi(m.t)}</b>{:else}{@render hanzi(m.t)}{/if}
  {/each}
{/snippet}

{#snippet hanzi(texte: string)}
  {#each texte.split(/([㐀-鿿]+)/) as x, k (k)}
    {#if k % 2 === 1}<span class="cn">{x}</span>{:else}{x}{/if}
  {/each}
{/snippet}

{#snippet rubis(p: Phrase)}
  <!-- une phrase, le pinyin sous chaque caractère ; rien sous la ponctuation -->
  <span class="rubis cn" lang="zh-Hans"
    >{#each grappesDePhrase(p, entrees) as g, j (j)}<span class="grappe"
        >{#each g as x, k (k)}<span class="rubi"><span class="rb">{x.c}</span><span class="rt" aria-hidden="true">{x.py ?? ''}</span></span>{/each}</span
      >{/each}</span
  >
{/snippet}

{#snippet pastilles(etats: readonly string[], grand: boolean)}
  <div class={grand ? 'grospips' : 'pips'} aria-hidden="true">
    {#each etats as e, k (k)}
      <i class={e}>
        {#if grand && e === 'ok'}
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="var(--card)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {/if}
      </i>
    {/each}
  </div>
{/snippet}

{#snippet marque(touche: boolean, juste: boolean)}
  {#if touche}
    <svg class="m" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {#if juste}
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      {:else}
        <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      {/if}
    </svg>
  {/if}
{/snippet}

{#snippet mizi(c: string, size: number)}
  <span class="mizi" style="width:{size}px;height:{size}px">
    <svg class="grille" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
      ><path d="M0 0L100 100M100 0L0 100M50 0V100M0 50H100" stroke="var(--grille)" stroke-width=".8" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" fill="none" /></svg
    >
    <Glyph char={c} size={Math.round(size * 0.82)} write={false} />
  </span>
{/snippet}

{#snippet icone(nom: 'feuille' | 'sceau' | 'sable' | 'retour' | 'livre')}
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="var(--ink2)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    {#if nom === 'feuille'}
      <path d="M6 3h9l4 4v14H6z M15 3v4h4 M9 11h7M9 14h7M9 17h4" />
    {:else if nom === 'sceau'}
      <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12.5l3 3 5-6" />
    {:else if nom === 'sable'}
      <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9M4 20L20 4" />
    {:else if nom === 'retour'}
      <path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M17.5 3.5v4h-4" />
    {:else}
      <path d="M4 5c3-1 6-1 8 1v14c-2-2-5-2-8-1zM20 5c-3-1-6-1-8 1v14c2-2 5-2 8-1z" />
    {/if}
  </svg>
{/snippet}

<!-- L'examen suivant : sa porte de ville 城门, au pointillé d'indigo (plus de stèle depuis la
     décision du propriétaire du 29 septembre 2026, maquettes/chemin.html). -->
{#snippet porte()}
  <svg width="34" height="24" viewBox="-40 0 80 52" aria-hidden="true"
    ><path d="M-38 16q13-2 19-14h38q6 12 19 14z" fill="var(--card)" stroke="var(--indigo)" stroke-width="3" stroke-dasharray="5 4" /><rect
      x="-31"
      y="16"
      width="62"
      height="34"
      fill="var(--card)"
      stroke="var(--indigo)"
      stroke-width="3"
      stroke-dasharray="5 4"
    /><path d="M-10 50v-11a10 10 0 0 1 20 0v11" fill="var(--card)" stroke="var(--indigo)" stroke-width="3" stroke-dasharray="5 4" /></svg
  >
{/snippet}

<main class="examen" data-vue={vue}>
  {#if examen === null}
    <div class="top"><button class="lien" onclick={onretour}>‹ {t('menu')}</button><span></span></div>
  {:else if vue === 'intro'}
    <!-- ---------- l'annonce ---------- -->
    <div class="top">
      <button class="lien" onclick={onretour}>‹ {t('menu')}</button>
      <span class="kicker">{examen.fr.split(',')[0]}</span>
    </div>
    <div class="scene">
      {#if yueke}
        <svg class="dessin" viewBox="0 0 {ACADEMIE.w} {ACADEMIE.h}" role="img" aria-label={plaqueAcademie}
          ><!-- eslint-disable-next-line svelte/no-at-html-tags -->{@html dessinAcademie(plaqueAcademie, traits)}</svg
        >
        <div class="tao-pose" style="left:{ACADEMIE_TAO.left * 100}%;top:{ACADEMIE_TAO.top * 100}%;width:{ACADEMIE_TAO.width * 100}%">
          <Tao stade={taoStade} posture="chemin" humeur="calme" livre size={120} />
        </div>
        {#if xing}
          <!-- le maître de l'académie, à sa table, à la taille de Tao -->
          <div class="tao-pose" style="left:{ACADEMIE_XING.left * 100}%;top:{ACADEMIE_TAO.top * 100}%;width:{ACADEMIE_TAO.width * 100}%">
            <Xing posture={POSTURES.examen} humeur="calme" size={120} />
          </div>
          <div class="bulle bl apparait" style="--dl:.5s">{@render hanzi(t('xing_avant_yueke'))}</div>
        {/if}
      {:else}
        <svg class="dessin" viewBox="0 {HAOSHE_VUE.y} {HAOSHE.w} {HAOSHE_VUE.h}" aria-hidden="true"
          ><!-- eslint-disable-next-line svelte/no-at-html-tags -->{@html dessinHaoshe(plaquesHaoshe, traits)}</svg
        >
        <div class="tao-pose" style="left:{HAOSHE_TAO.left * 100}%;top:{HAOSHE_TAO.top * 100}%;width:{HAOSHE_TAO.width * 100}%">
          <Tao stade={taoStade} posture="chemin" humeur="calme" ecolier panier size={160} />
        </div>
        {#if xing}
          <!-- l'examinateur, derrière sa petite table, à la taille de Tao -->
          <div class="tao-pose" style="left:{HAOSHE_XING.left * 100}%;top:{HAOSHE_TAO.top * 100}%;width:{HAOSHE_TAO.width * 100}%">
            <Xing posture={POSTURES.examen} humeur="calme" size={160} />
          </div>
          <div class="bulle bl apparait" style="--dl:.5s">{@render hanzi(t('xing_avant'))}</div>
        {:else}
          <div class="bulle br apparait" style="--dl:.5s">{@render hanzi(t('tao_avant'))}</div>
        {/if}
      {/if}
    </div>
    <div class="titre-ex">
      <span class="nom" role="img" aria-label="{examen.hz}, {examen.pinyin}">
        {#each [...examen.hz] as c, k (k)}<Glyph char={c} size={yueke ? 50 : 54} label="" />{/each}
      </span>
      <div><div class="py">{examen.pinyin}</div><div class="fr">{examen.fr}</div></div>
    </div>
    {#if donne !== ''}<p class="donne">{@render hanzi(donne)}</p>{/if}
    {#if yueke && troncon.length > 0 && precedent !== null}
      <div class="kicker">{@render hanzi(t('troncon', { n: troncon.length, examen: precedent.hz }))}</div>
      <div class="troncon">
        {#each troncon.slice(0, 10) as c, k (k)}<Glyph char={c} size={26} write={false} />{/each}
        {#if troncon.length > 10}<span class="plus">{t('troncon_plus', { n: troncon.length - 10 })}</span>{/if}
      </div>
    {/if}
    <ul class="regles">
      <li>
        {@render icone('feuille')}<span
          >{@render riche(yueke ? t('regle_questions_yueke', { questions: nombreQuestions }) : t('regle_questions', { questions: nombreQuestions, supports: supportsDits }))}</span
        >
      </li>
      <li>{@render icone('sceau')}<span>{@render riche(t('regle_reussite', { reussite: reussite(nombreQuestions, donnees.regle), questions: nombreQuestions }))}</span></li>
      {#if yueke}
        <li>{@render icone('livre')}<span>{@render riche(t('regle_yueke'))}</span></li>
      {:else}
        <li>{@render icone('sable')}<span>{@render riche(t('regle_chrono'))}</span></li>
        <li>{@render icone('retour')}<span>{@render riche(t('regle_reprise'))}</span></li>
      {/if}
    </ul>
    <div class="bas">
      <button class="btn-ex" onclick={commencer}>
        {#if tentative !== null && tentative.echec === null}
          {t('reprendre', { n: i + 1 })}
        {:else}
          {@render hanzi(yueke ? t('commencer_yueke') : t('commencer'))}
        {/if}
      </button>
    </div>
  {:else if vue === 'question' && q !== null && tentative !== null}
    <!-- ---------- la question ---------- -->
    <div class="qtop">
      <button class="lien gris" onclick={onquitter}>{t('quitter')}</button>
      <div class="ex"><span class="cn">{examen.hz}</span> · {t('question_n', { n: i + 1, questions: questions.length })}</div>
      {@render pastilles(pips, false)}
    </div>
    <div class="kicker">{kicker}</div>
    <h1 class="qtxt">{q.consigne.fr}</h1>

    {#if support !== null}
      <div class="illu">
        <SupportExamen
          {support}
          {traits}
          mots={q.type === 'reperer' ? (q.choix as string[]) : []}
          etats={Object.fromEntries(essais.map((d) => [d as number, corriger(q, d) ? 'ok' : 'ko']))}
          ontoucher={(k) => toucher(k)}
          {fini}
          reponse={q.type === 'replique' && fini ? (q.choix[q.reponse as number] as Phrase) : null}
          placeholder={q.type === 'replique' ? t('ta_reponse') : ''}
          pinyin={py.support}
          {entrees}
        />
      </div>
    {/if}

    {#if q.type === 'vrai_faux' && q.affirmation !== undefined}
      <p class="affirmation cn" class:avec-py={py.affirmation}>{#if py.affirmation}{@render rubis(q.affirmation)}{:else}{q.affirmation.zh}{/if}</p>
      <div class="opts deux">
        {#each [true, false] as v (String(v))}
          {@const touche = essais.includes(v)}
          <button class="opt" class:ok={touche && corriger(q, v)} class:ko={touche && !corriger(q, v)} class:fin={fini && !touche} disabled={fini} onclick={() => toucher(v)}>
            <span class="l">{t(v ? 'vrai' : 'faux')}</span>{@render marque(touche, corriger(q, v))}
          </button>
        {/each}
      </div>
    {:else if q.type === 'sens' || q.type === 'caractere' || q.type === 'trou' || q.type === 'ton'}
      {#if q.objet !== undefined}
        <div class="objet">
          {#if q.type === 'caractere'}
            <span class="sens-objet">« {q.objet.fr} »</span>
          {:else if q.type === 'trou'}
            {#each [...q.objet.zh] as c, k (k)}
              {#if k === q.trou}<span class="trou" aria-label="?"></span>{:else}<Glyph char={c} size={64} write={false} seul />{/if}
            {/each}
            <span class="sens-objet petit">« {q.objet.fr} »</span>
          {:else}
            {#each [...q.objet.zh] as c, k (k)}<Glyph char={c} size={72} seul />{/each}
          {/if}
        </div>
      {/if}
      {#if q.type === 'caractere' || q.type === 'trou'}
        <div class="opts grille">
          {#each q.choix as c, k (k)}
            {@const touche = essais.includes(k)}
            <button class="opt carre" class:ok={touche && corriger(q, k)} class:ko={touche && !corriger(q, k)} class:fin={fini && !touche} disabled={fini} onclick={() => toucher(k)}>
              {#each [...String(c)] as x, j (j)}<Glyph char={x} size={64} write={false} seul />{/each}
              <span class="coin">{@render marque(touche, corriger(q, k))}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="opts">
          {#each q.choix as c, k (k)}
            {@const touche = essais.includes(k)}
            <button class="opt" class:ok={touche && corriger(q, k)} class:ko={touche && !corriger(q, k)} class:fin={fini && !touche} disabled={fini} onclick={() => toucher(k)}>
              <span class="l">{typeof c === 'string' ? c : (c as Sens).fr}</span>{@render marque(touche, corriger(q, k))}
            </button>
          {/each}
        </div>
      {/if}
    {:else if q.type === 'comprendre' || q.type === 'replique'}
      <div class="opts">
        {#each q.choix as c, k (k)}
          {@const touche = essais.includes(k)}
          <button
            class="opt"
            class:avec-py={q.type === 'replique' && py.choix}
            class:ok={touche && corriger(q, k)}
            class:ko={touche && !corriger(q, k)}
            class:fin={fini && !touche}
            disabled={fini}
            onclick={() => toucher(k)}
          >
            {#if q.type === 'replique' && py.choix}
              <span class="l">{@render rubis(c as Phrase)}</span>
            {:else if q.type === 'replique'}
              <span class="l cn">{(c as Phrase).zh}</span>
            {:else}
              <span class="l">{(c as Sens).fr}</span>
            {/if}
            {@render marque(touche, corriger(q, k))}
          </button>
        {/each}
      </div>
    {/if}

    {#if retour !== null}
      {#key essais.length}
        <div class="fb" class:ko={!retour.ok} class:duo={xing}>
          {#if xing}
            <span class="duo-poses">
              <Xing posture={POSTURES.examen} humeur={humeurXing(retour.ok ? 'juste' : 'pas-celle')} size={72} />
              <Tao stade={taoStade} posture="chemin" humeur={retour.ok ? 'joie' : 'calme'} ecolier size={72} reaction={retour.ok ? 'bond' : null} />
            </span>
          {:else}
            <Tao stade={taoStade} posture="chemin" humeur={retour.ok ? 'joie' : 'calme'} size={64} reaction={retour.ok ? 'bond' : null} />
          {/if}
          <div class="txt">
            <b>{retour.titre}</b>
            {#if retour.texte !== ''}{@render hanzi(retour.texte)}{/if}
            {#if retour.suite !== ''}<span class="mist">{@render hanzi(retour.suite)}</span>{/if}
          </div>
        </div>
      {/key}
    {:else}
      <div class="fb attente" class:duo={xing}>
        {#if xing}
          <span class="duo-poses">
            <Xing posture={POSTURES.examen} humeur={humeurXing('question')} size={72} />
            <Tao stade={taoStade} posture="chemin" humeur="calme" ecolier panier size={72} />
          </span>
        {:else}
          <Tao stade={taoStade} posture="chemin" humeur="calme" panier size={76} />
        {/if}
        <div class="txt">{dit('tao_attente', 'xing_attente')}</div>
      </div>
    {/if}
    <div class="bas">
      {#if essais.length > 0}
        <button class="btn-ex" onclick={suivante}>{i < questions.length - 1 ? t('continuer') : t('voir_resultat')}</button>
      {/if}
    </div>
  {:else if vue === 'resultat' && bilan !== null}
    <!-- ---------- le résultat : un constat ---------- -->
    <div class="top"><span class="kicker"><span class="cn">{examen.hz}</span> · {t('resultat')}</span><span></span></div>
    {@render pastilles(reponsesFin.map((r) => (r ? 'ok' : 'ko')), true)}
    <p class="constat apparait">{t('constat', { justes: bilan.justes, questions: bilan.questions })}</p>
    {#if bilan.recu}
      <p class="constat2 apparait" style="--dl:.25s">{@render hanzi(t('recu', { examen: examen.hz }))}</p>
      <div class="taoligne">
        <Tao stade={taoStade} posture="chemin" humeur="joie" panier={!yueke} livre={yueke} size={80} reaction="bond" />
        {#if xing}
          <!-- le maître parle : il se tient à côté de sa bulle -->
          <Xing posture={POSTURES.examen} humeur={humeurXing('recu')} size={80} />
        {/if}
        <div class="bulle g">{@render hanzi(yueke ? dit('tao_recu_yueke', 'xing_recu_yueke') : dit('tao_recu', 'xing_recu'))}</div>
      </div>
      {#if manques.length > 0}
        <div class="arevoir">
          <div class="chars">
            {#each manques.slice(0, 3) as m (m.c)}
              <div class="mini">{@render mizi(m.c, 56)}<small>{infos[m.c]?.pinyin ?? ''}</small></div>
            {/each}
          </div>
          <div class="t">{@render riche(t(manques.length > 1 ? 'a_revoir' : 'a_revoir_un', { ou: ou(manques[0]) }))}</div>
        </div>
      {:else}
        <div class="arevoir"><div class="t">{t('rien_a_revoir')}</div></div>
      {/if}
      <p class="info">{@render hanzi(ligneDesPoints)}{#if yueke}&nbsp;{@render hanzi(t('info_yueke'))}{/if}</p>
      {#if yueke && suite !== ''}
        <div class="suite">{@render porte()}<div class="t">{@render riche(suite)}</div></div>
      {/if}
      <div class="bas">
        {#if yueke}
          <button class="btn-ex" onclick={onretour}>{t('retour_menu')}</button>
        {:else}
          <button class="btn-ex" onclick={() => (vue = 'bang')}>{@render hanzi(t('voir_liste'))}</button>
        {/if}
      </div>
    {:else}
      <p class="constat2 encre">{t('pas_encore')}</p>
      <div class="taoligne">
        <Tao stade={taoStade} posture="chemin" humeur="calme" size={76} />
        {#if xing}
          <Xing posture={POSTURES.examen} humeur={humeurXing('pas-encore')} size={76} />
        {/if}
        <div class="bulle g">{dit('tao_pas_encore', 'xing_pas_encore')}</div>
      </div>
      <div class="kicker">{t('ciblees')}</div>
      <div class="ciblees">
        {#each manques.slice(0, 4) as m, k (m.c)}
          <div class="cible apparait" style="--dl:{(0.1 + k * 0.08).toFixed(2)}s">
            {@render mizi(m.c, 48)}
            <div>
              <div class="py">{infos[m.c]?.pinyin ?? ''}<span>{infos[m.c]?.fr ?? ''}</span></div>
              <small>{t('croise_sur', { ou: ou(m) })}</small>
            </div>
            <small class="etat">{t('etat_a_revoir')}</small>
          </div>
        {/each}
      </div>
      <p class="info">{@render riche(t('info_pause'))}<br />{t('rien_perdu')}</p>
      <div class="bas"><button class="btn-ex contour" onclick={onretour}>{t('retour_menu')}</button></div>
    {/if}
  {:else if vue === 'bang'}
    <!-- ---------- le 放榜 : la liste affichée ---------- -->
    <div class="top">
      <button class="lien gris" onclick={() => (vue = 'resultat')}>‹ {t('fangbang_retour')}</button>
      <span class="kicker">{@render hanzi(t('fangbang_kicker'))}</span>
    </div>
    <div class="bang">
      <svg viewBox="0 0 {BANG.w} {BANG.h}" role="img" aria-label="{enteteBang} {examen.hz} : {[...noms, nomHeros].join(', ')}"
        ><!-- eslint-disable-next-line svelte/no-at-html-tags -->{@html dessinBang(examen.hz, enteteBang, noms, nomHeros, date, traits)}</svg
      >
      {#if p.heros}
        <div class="pose" style="left:{BANG_HEROS.left * 100}%;top:{BANG_HEROS.top * 100}%;width:{BANG_HEROS.width * 100}%">
          <Heros bete={p.heros.bete} rang={rangHeros} cadre="vignette" largeur={108} />
        </div>
      {/if}
      <div class="pose" style="left:{BANG_TAO.left * 100}%;top:{BANG_TAO.top * 100}%;width:{BANG_TAO.width * 100}%">
        <Tao stade={taoStade} posture="chemin" humeur="joie" panier size={122} />
      </div>
      {#if xing}
        <!-- le maître lit la liste, ses lamelles à la main, à la taille de Tao -->
        <div class="pose" style="left:{BANG_XING.left * 100}%;top:{BANG_TAO.top * 100}%;width:{BANG_TAO.width * 100}%">
          <Xing posture="explique" humeur={humeurXing('recu')} size={122} />
        </div>
      {/if}
    </div>
    {#if xing}
      <p class="bulle lit apparait" style="--dl:{BANG_FIN}s">{@render hanzi(t('xing_bang'))}</p>
    {/if}
    <div class="apparait apres" style="--dl:{BANG_FIN}s">
      {#if nomHeros !== ''}<p class="constat gauche">{@render hanzi(t('sur_la_liste', { nom: nomHeros }))}</p>{/if}
      <p class="constat gauche jade">{@render hanzi(t('recu', { examen: examen.hz }))}</p>
      {#if suite !== ''}<div class="suite">{@render porte()}<div class="t">{@render riche(suite)}</div></div>{/if}
    </div>
    <div class="bas"><button class="btn-ex" onclick={onretour}>{t('retour_menu')}</button></div>
  {/if}
</main>

<style>
  .examen {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    padding: calc(env(safe-area-inset-top) + 10px) 18px calc(env(safe-area-inset-bottom) + 16px);
    background: var(--paper);
    color: var(--ink);
  }
  .examen > * {
    flex-shrink: 0;
  }
  .cn {
    font-family: var(--hz);
    font-weight: 500;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    margin: -4px 0 6px;
  }
  .lien {
    color: var(--indigo);
    font: 600 16px var(--sans);
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .lien.gris {
    color: var(--mist);
  }
  .kicker {
    font: 700 12px/1.3 var(--sans);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mist);
  }
  .kicker .cn {
    letter-spacing: 0.02em;
  }
  .bas {
    margin-top: auto;
    padding-top: 12px;
  }
  .btn-ex {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 56px;
    border-radius: 999px;
    background: var(--indigo);
    color: var(--on);
    font: 600 18px var(--sans);
    transition: transform 0.12s;
  }
  .btn-ex:active {
    transform: scale(0.98);
  }
  .btn-ex.contour {
    background: transparent;
    color: var(--ink);
    border: 1.5px solid var(--line);
  }
  .btn-ex .cn {
    font-size: 19px;
  }
  .mist {
    color: var(--mist);
  }

  /* l'annonce */
  .scene,
  .bang {
    position: relative;
    margin: 0 -18px;
  }
  .scene .dessin,
  .bang > svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .tao-pose,
  .pose {
    position: absolute;
    line-height: 0;
  }
  .tao-pose :global(svg),
  .pose :global(svg) {
    width: 100%;
    height: auto;
  }
  .bulle {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--ink);
    border-radius: 16px;
    padding: 7px 12px;
    font: 400 14px/1.3 var(--sans);
    color: var(--ink);
  }
  .scene .bulle {
    position: absolute;
    right: 16px;
    top: 6px;
    max-width: 236px;
  }
  .bulle.br::after {
    content: '';
    position: absolute;
    right: 50px;
    bottom: -8px;
    width: 12px;
    height: 12px;
    background: var(--card);
    border-right: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    transform: rotate(45deg);
  }
  .bulle.bl::after {
    content: '';
    position: absolute;
    left: 50px;
    bottom: -8px;
    width: 12px;
    height: 12px;
    background: var(--card);
    border-right: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    transform: rotate(45deg);
  }
  .scene .bulle.bl {
    right: auto;
    left: 16px;
  }
  /* au 放榜, ce que dit le maître qui lit la liste */
  .bulle.lit {
    margin: 10px 0 0;
  }
  .bulle.lit::after {
    content: '';
    position: absolute;
    left: 58px;
    top: -7px;
    width: 12px;
    height: 12px;
    background: var(--card);
    border-left: 1.5px solid var(--ink);
    border-top: 1.5px solid var(--ink);
    transform: rotate(45deg);
  }
  .bulle.g::after {
    content: '';
    position: absolute;
    left: -8px;
    top: 50%;
    width: 12px;
    height: 12px;
    background: var(--card);
    border-left: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    transform: translateY(-50%) rotate(45deg);
  }
  .titre-ex {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 2px 0 2px;
  }
  .titre-ex .nom {
    display: inline-flex;
    gap: 2px;
    flex: none;
  }
  .titre-ex .py {
    font: italic 400 18px var(--sans);
    color: var(--ink2);
  }
  .titre-ex .fr {
    font: 700 17px/1.25 var(--head);
    color: var(--ink);
  }
  .donne {
    color: var(--ink2);
    font-size: 15px;
    margin: 2px 0 10px;
  }
  .donne .cn {
    color: var(--ink);
  }
  .troncon {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 2px;
    margin: 4px 0 12px;
    align-items: center;
  }
  .troncon .plus {
    color: var(--mist);
    font-size: 14px;
    margin-left: 6px;
  }
  .regles {
    list-style: none;
    margin: 0 0 14px;
    padding: 0;
    display: grid;
    gap: 5px;
  }
  .regles li {
    display: grid;
    grid-template-columns: 26px 1fr;
    gap: 8px;
    align-items: start;
    font-size: 15px;
    color: var(--ink2);
    line-height: 1.3;
  }
  .regles :global(b),
  .info :global(b),
  .suite :global(b),
  .arevoir :global(b) {
    color: var(--ink);
    font-weight: 600;
  }

  /* la question */
  .qtop {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    margin: -4px 0 6px;
  }
  .qtop .ex {
    text-align: center;
    font: 600 13px var(--sans);
    color: var(--mist);
    white-space: nowrap;
  }
  .qtop .ex .cn {
    color: var(--ink2);
    font-size: 14px;
  }
  .pips {
    display: flex;
    gap: 4px;
  }
  .pips i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--line);
  }
  .pips i.ok {
    background: var(--jade);
    border-color: var(--jade);
  }
  .pips i.ko {
    border-color: var(--ocre);
  }
  .pips i.cur {
    border-color: var(--ink);
  }
  .qtxt {
    font: 700 20px/1.25 var(--head);
    margin: 4px 0 10px;
  }
  .illu {
    margin-bottom: 12px;
  }
  .affirmation {
    font-size: 22px;
    line-height: 1.4;
    margin: 0 0 12px;
    padding: 8px 12px;
    border-left: 3px solid var(--line);
  }
  /* le pinyin sous chaque caractère, à la manière d'un ruby : petit, à la brume */
  .rubis {
    display: inline-flex;
    flex-wrap: wrap;
    row-gap: 4px;
  }
  .rubis .grappe {
    display: inline-flex;
    white-space: nowrap;
  }
  .rubi {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.15;
    padding: 0 2px;
  }
  .rubi .rt {
    min-height: 1.3em;
    font: 400 11px/1.3 var(--sans);
    color: var(--mist);
    white-space: nowrap;
  }
  .affirmation.avec-py {
    line-height: 1.15;
  }
  /* une réplique et son pinyin : la ligne de pinyin prend la place du jour du bouton */
  .opt.avec-py {
    padding-top: 5px;
    padding-bottom: 5px;
  }
  .opt.ok .rt,
  .opt.ko .rt {
    color: inherit;
  }
  .objet {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 14px;
  }
  .sens-objet {
    font: 700 22px var(--head);
    color: var(--ink);
  }
  .sens-objet.petit {
    flex-basis: 100%;
    text-align: center;
    font: 400 15px var(--sans);
    color: var(--ink2);
  }
  .trou {
    width: 60px;
    height: 60px;
    border: 2px dashed var(--grille);
    border-radius: 8px;
  }
  .opts {
    display: grid;
    gap: 8px;
  }
  .opts.deux,
  .opts.grille {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .opt {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--card);
    border: 1.5px solid var(--line);
    text-align: left;
    font-size: 17px;
    color: var(--ink);
    transition:
      border-color 0.15s,
      color 0.15s,
      transform 0.12s;
  }
  .opt:active {
    transform: scale(0.985);
  }
  .opt .l {
    flex: 1;
    text-align: left;
  }
  .opt .m {
    flex: none;
  }
  .opt.carre {
    position: relative;
  }
  .coin {
    position: absolute;
    right: 10px;
    top: 10px;
    line-height: 0;
  }
  .opt .cn {
    font-size: 21px;
  }
  .opt.carre {
    justify-content: center;
    min-height: 104px;
  }
  .opt.ok {
    border: 2px solid var(--jade);
    color: var(--jade);
  }
  .opt.ko {
    border: 2px solid var(--ocre);
    color: var(--ocre);
  }
  .opt.fin {
    opacity: 0.5;
  }
  .opt:disabled {
    cursor: default;
  }
  .fb {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 10px;
    align-items: center;
    margin-top: 10px;
    font-size: 15px;
    line-height: 1.35;
    color: var(--ink2);
    animation: entre 0.3s ease both;
  }
  .fb.attente {
    grid-template-columns: 76px 1fr;
  }
  /* le maître et Tao côte à côte, à la même taille */
  .fb.duo {
    grid-template-columns: 132px 1fr;
  }
  .duo-poses {
    display: flex;
    line-height: 0;
  }
  .duo-poses :global(.tao) {
    margin-left: -12px;
  }
  .fb .txt {
    border-left: 3px solid var(--jade);
    padding: 2px 0 2px 10px;
  }
  .fb.attente .txt {
    border-left-color: var(--line);
    color: var(--mist);
  }
  .fb.ko .txt {
    border-left-color: var(--ocre);
  }
  .fb .txt b {
    color: var(--jade);
  }
  .fb.ko .txt b {
    color: var(--ocre);
  }
  .fb .cn {
    color: var(--ink);
  }

  /* le résultat */
  .grospips {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin: 14px 0 14px;
  }
  .grospips i {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2.5px solid var(--line);
    display: grid;
    place-items: center;
  }
  .grospips i.ok {
    background: var(--jade);
    border-color: var(--jade);
  }
  .grospips i.ko {
    border-color: var(--ocre);
  }
  .constat {
    text-align: center;
    font: 800 24px/1.2 var(--head);
    margin: 0;
  }
  .constat.gauche {
    text-align: left;
    font-size: 22px;
  }
  .constat2 {
    text-align: center;
    font: 800 24px/1.2 var(--head);
    margin: 2px 0 0;
    color: var(--jade);
  }
  .constat2.encre {
    color: var(--ink2);
  }
  .jade {
    color: var(--jade);
  }
  .taoligne {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 12px 0 8px;
  }
  .taoligne .bulle {
    flex: 1;
    font-size: 15px;
  }
  .arevoir {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 12px 0 0;
    padding: 12px 0 0;
    border-top: 1px solid var(--line);
  }
  .arevoir .chars {
    display: flex;
    gap: 8px;
  }
  .arevoir .t {
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.35;
  }
  .mini {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .mini small {
    font-size: 13px;
    color: var(--ink2);
  }
  .mizi {
    position: relative;
    background: var(--card);
    border: 1.5px solid var(--grille);
    border-radius: 8px;
    display: grid;
    place-items: center;
    flex: none;
  }
  .mizi .grille {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .ciblees {
    display: grid;
    gap: 8px;
    margin: 8px 0 0;
  }
  .cible {
    display: grid;
    grid-template-columns: 52px 1fr auto;
    gap: 12px;
    align-items: center;
    background: var(--card);
    border-radius: 14px;
    padding: 8px 12px 8px 8px;
  }
  .cible .py {
    font: 700 16px var(--head);
    color: var(--indigo);
  }
  .cible .py span {
    font: 400 15px var(--sans);
    color: var(--ink2);
    margin-left: 6px;
  }
  .cible small {
    display: block;
    color: var(--mist);
    font-size: 13px;
    line-height: 1.3;
  }
  .info {
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.4;
    margin: 12px 0 0;
  }

  /* le 放榜 */
  .apres {
    margin-top: 12px;
  }
  .suite {
    display: flex;
    gap: 12px;
    align-items: center;
    border-top: 1px solid var(--line);
    padding: 12px 0 0;
    margin-top: 12px;
    font-size: 14px;
    color: var(--ink2);
    line-height: 1.35;
  }

  /* les animations, coupées si l'on réduit les animations */
  .apparait {
    animation: apparait 0.5s ease var(--dl, 0s) both;
  }
  .bang :global(.apparait) {
    animation: apparait 0.5s ease var(--dl, 0s) both;
  }
  .bang :global(.cercle) {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: cercle 0.7s ease var(--dl, 0s) forwards;
  }
  @keyframes apparait {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes cercle {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes entre {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .apparait,
    .fb,
    .bang :global(.apparait) {
      animation: none;
    }
    .bang :global(.cercle) {
      animation: none;
      stroke-dashoffset: 0;
    }
  }
</style>
