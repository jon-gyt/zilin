<script lang="ts">
  /**
   * Tao 桃, le noyau de pêche qui fait la route. Cinq stades, une posture par activité, trois
   * humeurs. Traits simples, encre et jade, dans l'esprit de la maquette.
   *
   * Elle ne devient pas un arbre (décision du propriétaire du 29 septembre 2026 : « plus le
   * thème ») : elle garde sa pousse et s'équipe pour le chemin. Le baluchon à l'épaule à 100,
   * le chapeau de paille 斗笠 à 300, la gourde 葫芦 à la hanche à 1 000. Le chapeau ne la
   * quitte pas ; baluchon et gourde se posent quand les mains ou le côté sont pris (bol,
   * feuille, cuisine, examen). Au pavillon, le chapeau pend au poteau.
   *
   * Aucun cinabre : le rouge reste le sceau de l'app. Ni ombre, ni dégradé, ni doré.
   * Elle ne tombe jamais malade et ne pleure jamais : après une absence, elle t'attend assise
   * au pavillon 亭, un bol de thé à côté (`halte`, maquette validée `maquettes/chemin.html`).
   *
   * Les jours de fête, elle porte l'accessoire de la fête (brief §9). Au-dessus de la tête :
   * un flocon au Nouvel An 春节, un brin de saule à 清明, une étoile à 七夕, un chrysanthème
   * au double neuf 重阳. À côté d'elle : un bol de 汤圆 à la fête des Lanternes 元宵, un
   * 粽子 à la fête des bateaux 端午, un gâteau de lune 月饼 à la mi-automne 中秋, un 饺子 au
   * solstice d'hiver 冬至. Tous sont toujours dessinés et cachés ; `data-fete` sur <html>
   * montre le bon (`tokens.css`), sans que chaque écran ait à passer la fête. Pas
   * d'accessoire là où la place est déjà prise : ceux de la tête cèdent la place à la bulle
   * et à la lanterne, ceux d'à côté au bol, à la feuille et au pavillon.
   *
   * En cuisine, elle goûte (`goute`) : un bol fumant à côté d'elle, la cuillère à la
   * bouche. Contente, elle saute (l'humeur `joie`) ; quand un ingrédient a été pris pour
   * un autre, elle grimace (`grimace`) : les yeux plissés, la bouche en vague, un frisson,
   * et rien de plus. Ni teint malade, ni larme.
   *
   * En révision, elle mange (`reaction`, `tao.reagir`) : une carte juste, une bouchée prise
   * au bol ; une erreur, la même grimace brève ; trois justes d'affilée, un bond. Le geste
   * ne dure que le temps de le voir, et aucun chiffre ne dit la série. Sans animation (le
   * réglage « réduire les animations »), seul le visage change : la grimace ou la joie.
   *
   * À l'examen (brief §9, maquette validée le 29 septembre 2026), elle porte le col bleu de
   * l'écolier 青衿 et le pinceau (`ecolier`), sans robe, et le panier 考篮 à côté d'elle
   * (`panier`), avec lequel elle attend à la porte, puis lit la liste 榜 ; au 月课, un livre
   * sous le bras (`livre`). Ces couleurs sont fixes, comme celles du personnage.
   */
  import type { Humeur, PostureVue, Reaction, Stade } from './tao';

  let {
    stade = 'noyau',
    posture = 'chemin',
    humeur = 'calme',
    size = 110,
    caractere = '住',
    penchee = false,
    grimace = false,
    reaction = null,
    allumee = false,
    ecolier = false,
    panier = false,
    livre = false
  }: {
    stade?: Stade;
    posture?: PostureVue;
    humeur?: Humeur;
    size?: number;
    /** Le caractère de la bulle, en posture « leçon ». */
    caractere?: string;
    /** En posture « jeu », la tête penchée sur un mot, sans lanterne (le dictionnaire éclair). */
    penchee?: boolean;
    /** Elle vient de goûter un plat où un ingrédient a été pris pour un autre. */
    grimace?: boolean;
    /** En révision, son geste pour la dernière réponse : bouchée, grimace ou bond. */
    reaction?: Reaction | null;
    /**
     * En posture « jeu », sa lanterne est allumée : la devinette du jour a été trouvée.
     * Un aplat de pigment (`--t2`, celui de la lanterne de l'écran Jouer), sans halo ni
     * dégradé ; éteinte, la lanterne n'a que son contour.
     */
    allumee?: boolean;
    /**
     * À l'examen : le col bleu de l'écolier 青衿 et le pinceau à la main. Pas de robe : elle
     * l'élargissait (décision du propriétaire du 29 septembre 2026, « ça le grossit »).
     */
    ecolier?: boolean;
    /** Le panier d'examen 考篮, deux étages, un couvercle, une anse, posé à côté d'elle. */
    panier?: boolean;
    /** Au 月课, un livre sous le bras, sans col d'écolier : il ne donne pas de titre. */
    livre?: boolean;
  } = $props();

  /** Ce qu'elle porte à côté d'elle : les accessoires de fête de ce côté-là lui cèdent la place. */
  const porte = $derived(ecolier || panier || livre);

  /** Au pavillon, elle attend : assise, plus petite, sous le toit. */
  const halte = $derived(posture === 'halte');
  const pousse = $derived(stade !== 'noyau');
  /** Le chapeau de paille, à 300 : sur la tête, sauf à l'examen et au pavillon, où il pend au poteau. */
  const coiffee = $derived((stade === 'chapeau' || stade === 'gourde') && !ecolier && !halte);
  const chapeauPendu = $derived((stade === 'chapeau' || stade === 'gourde') && halte);
  /** Les mains et le flanc libres : pas de bol, de feuille, de cuisine, d'examen ni de pavillon. */
  const libre = $derived(
    !halte && !porte && posture !== 'revision' && posture !== 'lecture' && posture !== 'goute'
  );
  const baluchon = $derived(libre && (stade === 'baluchon' || stade === 'chapeau' || stade === 'gourde'));
  const gourde = $derived(libre && stade === 'gourde');
  /** L'accessoire de fête de la tête : sous le chapeau, la pousse monte, il se décale à droite. */
  const teteAcc = $derived(coiffee ? 'translate(160 74)' : 'translate(140 62)');
  const grimace_ = $derived(grimace || reaction === 'grimace');
  /* Une bouchée la réveille : l'ennui cède au calme le temps de manger. */
  const regard = $derived(
    grimace_
        ? 'grimace'
        : reaction === 'bond'
          ? 'joie'
          : reaction === 'bouchee' && humeur === 'ennui'
            ? 'calme'
            : humeur
  );
  /** La bouchée monte du bol à la bouche : une carte juste, et le bond aussi. */
  const mange = $derived(posture === 'revision' && (reaction === 'bouchee' || reaction === 'bond'));

</script>

<svg
  class="tao {stade} {posture} {humeur}"
  class:penchee
  class:grimace={grimace_ && !halte}
  class:croque={mange}
  class:bondit={reaction === 'bond' && !halte}
  width={size}
  height={size}
  viewBox="0 0 200 200"
  aria-hidden="true"
>
  {#if halte}
    <!-- La halte : le pavillon 亭, son toit de malachite, ses poteaux et son banc de gomme-gutte. -->
    <g class="pavillon">
      <path d="M6 64q44-6 94-46q50 40 94 46z" fill="var(--chemin-toit)" />
      <path d="M20 64h160M28 66v124M172 66v124" stroke="var(--chemin-bois)" stroke-width="7" stroke-linecap="round" />
      <path d="M12 192h176" stroke="var(--line)" stroke-width="4" stroke-linecap="round" />
      <path d="M44 146h112" stroke="var(--chemin-bois)" stroke-width="6" stroke-linecap="round" />
      <path d="M52 146v34M148 146v34" stroke="var(--chemin-bois)" stroke-width="4" stroke-linecap="round" />
      {#if chapeauPendu}
        <!-- son chapeau de paille, pendu au poteau le temps de la halte -->
        <g transform="translate(-17 50) scale(0.45)">
          <path d="M52 106L100 78L148 106q-48 10-96 0z" fill="var(--h-abricot-pale)" stroke="var(--ink)" stroke-width="7" stroke-linejoin="round" />
        </g>
      {/if}
    </g>
  {:else}
    <path class="sol" d="M60 168q40 12 80 0" stroke="var(--line)" stroke-width="4" fill="none" stroke-linecap="round" />
  {/if}

  <g transform={halte ? 'translate(18 30) scale(0.68)' : undefined}>
  <g class="vivant">
    {#if ecolier}
      <!-- l'écolière : ni robe ni habit qui l'élargit, seulement le col bleu 青衿 qui lui donne son nom -->
      <path class="pieds" d="M88 156v14M112 156v14" stroke="var(--jade)" stroke-width="7" stroke-linecap="round" />
      <!-- le pinceau, tenu à la main -->
      <g class="pinceau-ecolier">
        <g transform="rotate(-22 60 164)">
          <rect x="56.5" y="114" width="7" height="48" rx="3" fill="var(--h-ocre)" stroke="var(--h-encre)" stroke-width="2.5" />
          <rect x="55" y="158" width="10" height="6" rx="1.5" fill="var(--h-carte)" stroke="var(--h-encre)" stroke-width="2" />
          <path d="M54.5 164q1 12 5.5 22q4.5-10 5.5-22z" fill="var(--h-encre)" />
        </g>
      </g>
    {:else if posture === 'chemin' || halte}
      <path class="pieds" d="M88 156v14M112 156v14" stroke="var(--jade)" stroke-width="7" stroke-linecap="round" />
    {:else if posture === 'anecdote'}
      <path
        class="assise"
        d="M76 156q-10 12 4 14h40q14-2 4-14"
        fill="none"
        stroke="var(--jade)"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}

    {#if baluchon}
      <!-- 包袱 : le baluchon à l'épaule, un carré de toile rose pêcher noué au bout du bâton -->
      <g class="baluchon">
        <path d="M78 152L44 90" stroke="var(--h-ocre)" stroke-width="5" stroke-linecap="round" />
        <path d="M60 92q-14-16-30-2q-6 18 12 24q20 2 18-22z" fill="var(--h-peche)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
        <path d="M50 90l-8-10M44 90l-10-6" stroke="var(--h-rose)" stroke-width="3.5" stroke-linecap="round" />
      </g>
    {/if}

    <g class="corps">
      <g class="plante">
        {#if pousse}
          <!-- sous le chapeau, la pousse passe au travers : elle remonte d'autant -->
          <g transform={coiffee ? 'translate(0 -20)' : undefined}>
            <g class="feuilles">
              <path d="M100 96q-30-8-34-40q26 4 34 30M100 96q30-8 34-40q-26 4-34 30" fill="var(--jade)" />
              <path d="M100 98v-18" stroke="var(--jade)" stroke-width="7" stroke-linecap="round" />
            </g>
          </g>
        {/if}
        <!-- le noyau : une amande d'encre, le noyau de pêche -->
        <path
          class="noyau"
          d="M100 98q36 6 36 30t-36 30q-36-6-36-30t36-30z"
          fill="var(--card)"
          stroke="var(--ink)"
          stroke-width="5"
          stroke-linejoin="round"
        />
        <path
          class="sillons"
          d="M76 140q7 6 11 12M124 140q-7 6-11 12"
          stroke="var(--ink)"
          stroke-width="3"
          fill="none"
          opacity=".3"
          stroke-linecap="round"
        />
        {#if ecolier}
          <!-- 青衿 : le col bleu de l'écolier, croisé, sur le bas du noyau -->
          <g class="col">
            <path d="M73 146q27 17 54 0" stroke="var(--h-azur)" stroke-width="8" fill="none" stroke-linecap="round" />
            <path d="M91 150l9 8l9-8" stroke="var(--h-carte)" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </g>
          <circle cx="66" cy="160" r="6.5" fill="var(--h-carte)" stroke="var(--h-encre)" stroke-width="3" />
        {/if}
        {#if coiffee}
          <!-- 斗笠 : le chapeau de paille conique, posé sur la tête, la pousse passe au travers -->
          <g class="chapeau">
            <path d="M52 106L100 78L148 106q-48 10-96 0z" fill="var(--h-abricot-pale)" stroke="var(--ink)" stroke-width="4.5" stroke-linejoin="round" />
            <path d="M76 100L100 86M124 100L100 86" stroke="var(--h-gutte)" stroke-width="2.5" opacity=".6" stroke-linecap="round" />
          </g>
        {/if}

        <g class="visage">
          {#if regard === 'joie'}
            <path
              d="M81 127q7-8 14 0M105 127q7-8 14 0"
              stroke="var(--ink)"
              stroke-width="5"
              fill="none"
              stroke-linecap="round"
            />
            <path d="M91 138q9 10 18 0" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round" />
          {:else if regard === 'grimace'}
            <!-- les yeux plissés, la bouche en vague : ça surprend, rien de plus -->
            <path
              d="M82 121l11 5-11 5M118 121l-11 5 11 5"
              stroke="var(--ink)"
              stroke-width="4.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M88 141q3-4 6 0t6 0t6 0t6 0"
              stroke="var(--ink)"
              stroke-width="4.5"
              fill="none"
              stroke-linecap="round"
            />
          {:else if regard === 'ennui'}
            <path d="M82 127h12M106 127h12" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
            <path d="M93 140h14" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
          {:else}
            <g class="yeux">
              <circle cx="88" cy="126" r="4.5" fill="var(--ink)" />
              <circle cx="112" cy="126" r="4.5" fill="var(--ink)" />
            </g>
            <path d="M93 139q7 5 14 0" stroke="var(--ink)" stroke-width="5" fill="none" stroke-linecap="round" />
          {/if}
        </g>
      </g>
    </g>
    {#if gourde}
      <!-- 葫芦 : la gourde de calebasse, pendue à la hanche -->
      <g class="gourde">
        <path d="M130 132q6 2 8 10" stroke="var(--h-ocre)" stroke-width="3" fill="none" stroke-linecap="round" />
        <circle cx="140" cy="146" r="6.5" fill="var(--h-abricot)" stroke="var(--ink)" stroke-width="3.5" />
        <circle cx="142" cy="162" r="10" fill="var(--h-abricot)" stroke="var(--ink)" stroke-width="3.5" />
        <path d="M134 146h12" stroke="var(--h-ocre)" stroke-width="3" stroke-linecap="round" />
      </g>
    {/if}
  </g>
  </g>

  {#if halte}
    <!-- Au retour, elle t'attend au pavillon, sans reproche : un bol de thé fume à côté d'elle. -->
    <g class="the">
      <path d="M126 130h30q-2 14-15 14t-15-14z" fill="var(--card)" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round" />
      <path class="vapeur" d="M136 120q-4-6 0-11M147 120q-4-6 0-11" stroke="var(--mist)" stroke-width="3" fill="none" stroke-linecap="round" />
    </g>
  {:else if posture === 'lecon'}
    <g class="bulle">
      <rect x="132" y="18" width="56" height="46" rx="12" fill="var(--card)" stroke="var(--ink)" stroke-width="4" />
      <path d="M146 64v14l16-14z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <text x="160" y="52" text-anchor="middle" class="hz" font-size="30" fill="var(--ink)">{caractere}</text>
    </g>
  {:else if posture === 'revision'}
    <!-- une carte, une bouchée : le bol -->
    <g class="bol">
      <path d="M26 146h44q-2 22-22 22t-22-22z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M22 146h52" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" />
    </g>
    {#if mange}
      <!-- la bouchée : un grain de riz, du bol à la bouche -->
      <ellipse class="bouchee" cx="48" cy="140" rx="10" ry="8" fill="var(--card)" stroke="var(--ink)" stroke-width="4" />
    {/if}
  {:else if posture === 'lecture'}
    <g class="feuille">
      <path d="M22 122h50v42H22z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M32 134h30M32 144h30M32 154h18" stroke="var(--ink)" stroke-width="3" opacity=".45" stroke-linecap="round" />
    </g>
  {:else if posture === 'trace'}
    <g class="pinceau">
      <path d="M150 104l26-26" stroke="var(--ocre)" stroke-width="7" stroke-linecap="round" />
      <path d="M142 112l10-10" stroke="var(--ink)" stroke-width="11" stroke-linecap="round" />
      <path class="trait" d="M136 126h40" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" fill="none" />
    </g>
  {:else if posture === 'goute'}
    <!-- en cuisine : le bol fumant, et la cuillère qu'elle porte à la bouche -->
    <g class="bol-fumant">
      <path class="vapeur" d="M38 136q-5-7 0-14M50 132q-5-7 0-14M62 136q-5-7 0-14" stroke="var(--line)" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M22 146h52q-2 22-26 22t-26-22z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M18 146h60" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" />
    </g>
    <g class="cuillere">
      <path d="M121 143l26-22" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" />
      <ellipse cx="113" cy="146" rx="9" ry="5" fill="var(--card)" stroke="var(--ink)" stroke-width="3.5" />
    </g>
  {:else if posture === 'jeu' && !penchee}
    <g class="lanterne" class:allumee>
      <path d="M164 26v12" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="164" cy="56" rx="17" ry="18" fill={allumee ? 'var(--t2)' : 'var(--card)'} stroke="var(--ocre)" stroke-width="4" />
      <path d="M152 40h24M152 72h24" stroke="var(--ocre)" stroke-width="4" stroke-linecap="round" />
      <path d="M164 38v36" stroke={allumee ? 'var(--card)' : 'var(--ocre)'} stroke-width="2" opacity=".5" />
      <path d="M164 74v10" stroke="var(--ocre)" stroke-width="3" stroke-linecap="round" />
    </g>
  {/if}

  {#if panier}
    <!-- 考篮 : le panier d'examen, deux étages, un couvercle, une anse -->
    <g class="panier" transform="translate(152 150)">
      <path d="M4 2Q20 -26 36 2" fill="none" stroke="var(--h-encre)" stroke-width="3.5" stroke-linecap="round" />
      <rect x="0" y="2" width="40" height="8" rx="2" fill="var(--h-ocre)" stroke="var(--h-encre)" stroke-width="3" />
      <rect x="2" y="10" width="36" height="12" fill="var(--h-gutte)" stroke="var(--h-encre)" stroke-width="3" />
      <rect x="2" y="22" width="36" height="12" fill="var(--h-gutte)" stroke="var(--h-encre)" stroke-width="3" />
      <path d="M8 16h24M8 28h24" stroke="var(--h-abricot-pale)" stroke-width="2" stroke-dasharray="3 3" />
    </g>
  {/if}
  {#if livre}
    <!-- au 月课 : un livre sous le bras -->
    <g class="livre">
      <g transform="translate(122 146) rotate(8)">
        <rect width="26" height="32" rx="2" fill="var(--h-azur)" stroke="var(--h-encre)" stroke-width="3" />
        <rect x="5" y="5" width="8" height="18" fill="var(--h-carte)" />
      </g>
      <circle cx="126" cy="164" r="6" fill="var(--h-carte)" stroke="var(--h-encre)" stroke-width="3" />
    </g>
  {/if}

  <!-- au-dessus de la tête, là où la bulle, la lanterne et le toit du pavillon ne sont pas -->
  {#if posture !== 'lecon' && posture !== 'jeu' && !halte}
    <g class="fete-acc flocon" transform={teteAcc} stroke="var(--t1)" stroke-width="4" stroke-linecap="round">
      <path d="M0-13v26M-11.3-6.5l22.6 13M-11.3 6.5l22.6-13" />
    </g>
    <!-- 清明 : un brin de saule, qu'on porte ce jour-là -->
    <g class="fete-acc saule" transform={teteAcc}>
      <path d="M-14 18q4-18 20-30" stroke="var(--saule-fonce)" stroke-width="3.5" fill="none" stroke-linecap="round" />
      <g fill="var(--saule)">
        <ellipse cx="-9" cy="6" rx="3" ry="7" transform="rotate(-35 -9 6)" />
        <ellipse cx="-2" cy="-3" rx="3" ry="7" transform="rotate(-50 -2 -3)" />
        <ellipse cx="4" cy="-9" rx="3" ry="7" transform="rotate(-65 4 -9)" />
        <ellipse cx="-4" cy="12" rx="3" ry="6.5" transform="rotate(40 -4 12)" />
        <ellipse cx="3" cy="2" rx="3" ry="6.5" transform="rotate(25 3 2)" />
      </g>
    </g>
    <!-- 七夕 : une étoile, Véga ou Altaïr -->
    <g class="fete-acc etoile" transform={teteAcc}>
      <path d="M0-15q2.4 12.6 15 15q-12.6 2.4-15 15q-2.4-12.6-15-15q12.6-2.4 15-15z" fill="var(--etoile)" />
    </g>
    <!-- 重阳 : un chrysanthème -->
    <g class="fete-acc ju" transform={teteAcc}>
      <g fill="var(--ju)">
        {#each [0, 36, 72, 108, 144, 180, 216, 252, 288, 324] as a (a)}<ellipse cx="0" cy="-8" rx="3.2" ry="7" transform="rotate({a})" />{/each}
      </g>
      <circle r="4.5" fill="var(--ju-coeur)" />
    </g>
  {/if}
  <!-- à côté d'elle, là où le bol, la feuille et le pavillon ne sont pas -->
  {#if !halte && posture !== 'revision' && posture !== 'lecture' && posture !== 'goute' && !porte}
    <g class="fete-acc yuebing">
      <circle cx="46" cy="148" r="19" fill="var(--t2)" stroke="var(--ink)" stroke-width="4" />
      <circle cx="46" cy="148" r="10" fill="none" stroke="var(--ink)" stroke-width="3" opacity=".55" />
      <path d="M46 138v20M36 148h20" stroke="var(--ink)" stroke-width="3" opacity=".55" />
    </g>
    <!-- 元宵 : un bol de 汤圆 -->
    <g class="fete-acc tangyuan">
      <circle cx="36" cy="146" r="7" fill="var(--tangyuan)" stroke="var(--ink)" stroke-width="3" />
      <circle cx="52" cy="144" r="7" fill="var(--tangyuan)" stroke="var(--ink)" stroke-width="3" />
      <circle cx="44" cy="139" r="6" fill="var(--tangyuan)" stroke="var(--ink)" stroke-width="3" />
      <path d="M22 150h48q-2 18-24 18t-24-18z" fill="var(--card)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
    </g>
    <!-- 端午 : un 粽子 ficelé -->
    <g class="fete-acc zongzi">
      <path d="M26 164L46 128L66 164Z" fill="var(--roseau)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M36 146L56 164M46 128L41 164" stroke="var(--roseau-clair)" stroke-width="2.5" opacity=".8" />
      <path d="M33 152h26" stroke="var(--ficelle)" stroke-width="4" stroke-linecap="round" />
    </g>
    <!-- 冬至 : un 饺子 -->
    <g class="fete-acc jiaozi">
      <path d="M22 158q24-34 48 0q-24 9-48 0z" fill="var(--raviole)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
      <path d="M36 146q3 5 1 9M46 141v10M56 146q-3 5-1 9" stroke="var(--ink)" stroke-width="3" opacity=".45" fill="none" stroke-linecap="round" />
    </g>
  {/if}
</svg>

<style>
  /* Le dictionnaire éclair : la tête penchée sur le mot, immobile, comme on réfléchit. */
  .penchee .vivant {
    transform-origin: 100px 168px;
    transform: rotate(-9deg);
  }
  /* La cuillère monte à la bouche et redescend ; la vapeur ondule. La grimace est un
     frisson bref, trois fois, puis elle se tient tranquille. */
  .cuillere {
    transform-origin: 147px 121px;
    animation: gouter 1.8s ease-in-out infinite alternate;
  }
  .vapeur {
    animation: vapeur 2.4s ease-in-out infinite alternate;
  }
  .tao.grimace .plante {
    transform-origin: 100px 160px;
    animation: frisson 0.45s ease-in-out 3;
  }
  /* En révision : la bouchée monte du bol à la bouche, puis elle croque ; au bond, elle
     saute deux fois sur place, le bol reste posé. Une fois, jamais en boucle. */
  .bouchee {
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
    animation: bouchee 0.8s ease-in-out forwards;
  }
  .tao.croque .plante {
    animation: croque 0.18s ease-in-out 0.72s 2 alternate;
  }
  .tao.bondit .vivant {
    transform-origin: 100px 168px;
    animation: saut 0.28s cubic-bezier(0.3, 0, 0.3, 1) 0.1s 4 alternate;
  }
  @keyframes bouchee {
    0% {
      opacity: 0;
      transform: none;
    }
    15% {
      opacity: 1;
    }
    55% {
      transform: translate(26px, -30px);
    }
    85% {
      opacity: 1;
      transform: translate(52px, -2px) scale(0.8);
    }
    100% {
      opacity: 0;
      transform: translate(52px, 0) scale(0.4);
    }
  }
  @keyframes croque {
    to {
      transform: scale(1.04, 0.95);
    }
  }
  @keyframes saut {
    to {
      transform: translateY(-16px);
    }
  }
  @keyframes gouter {
    from {
      transform: rotate(6deg) translateY(4px);
    }
    to {
      transform: none;
    }
  }
  @keyframes vapeur {
    from {
      opacity: 0.35;
      transform: translateY(2px);
    }
    to {
      opacity: 0.8;
      transform: translateY(-2px);
    }
  }
  @keyframes frisson {
    0%,
    100% {
      transform: none;
    }
    25% {
      transform: rotate(-3deg) scale(1.02, 0.98);
    }
    75% {
      transform: rotate(3deg) scale(1.02, 0.98);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cuillere,
    .vapeur,
    .tao.grimace .plante,
    .tao.croque .plante,
    .tao.bondit .vivant {
      animation: none;
    }
    .bouchee {
      display: none;
    }
  }
</style>
