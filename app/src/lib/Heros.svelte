<script lang="ts" module>
  /**
   * Le personnage (brief §8) : trois bêtes, douze rangs, une taille continue, une aura.
   * Dessin paramétrique porté de la maquette validée (`wenlu-heros.html`) : proportions
   * « chibi », grosse tête centrée en (200, 132), petit corps habillé ; chaque bête a sa
   * couleur de robe, et les attributs de rang se posent aux mêmes endroits.
   *
   * Un dessin, pas du contenu : les titres, les âges et les seuils viennent de
   * `heros.json`. Ni ombre, ni dégradé, ni doré ; pas de cinabre sur le personnage, il
   * reste au chemin ; pas de dragon. L'abricot est un aplat. Les couleurs sont les jetons
   * `--h-*` de `tokens.css`, fixes : le personnage garde les siennes les jours de fête,
   * comme un papier découpé posé sur la page.
   */
  import type { BeteId } from './heros';

  const ENCRE = 'var(--h-encre)';
  const TRAIT = `stroke="${ENCRE}" stroke-width="3" stroke-linejoin="round"`;

  function yeux(x1: number, x2: number, y: number): string {
    return [x1, x2]
      .map(
        (x) =>
          `<ellipse cx="${x}" cy="${y}" rx="6" ry="7.5" fill="${ENCRE}"/><circle cx="${x + 2}" cy="${y - 3}" r="2.4" fill="var(--h-fourrure)"/><circle cx="${x - 2}" cy="${y + 3}" r="1" fill="var(--h-fourrure)"/>`
      )
      .join('');
  }
  const JOUES = `<ellipse cx="170" cy="150" rx="8" ry="5" fill="var(--h-peche)" opacity=".8"/><ellipse cx="230" cy="150" rx="8" ry="5" fill="var(--h-peche)" opacity=".8"/>`;
  const BOUCHE = `<path d="M193 150q3.5 4 7 0q3.5 4 7 0" stroke="${ENCRE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;

  type Dessin = {
    poil: string;
    patte: string;
    robe: string;
    derriere: () => string;
    tete: string;
    visage: () => string;
  };

  /** Les trois bêtes : 玉兔 le lapin de jade, 熊猫 le panda, 醒狮 le lion dansé. */
  const BETES: Record<BeteId, Dessin> = {
    tu: {
      poil: 'var(--h-fourrure)',
      patte: 'var(--h-fourrure)',
      robe: 'var(--h-indigo)',
      derriere: () =>
        `<path d="M178 98q-16-58 2-70q14 12 10 68z" fill="var(--h-fourrure)" ${TRAIT}/><path d="M222 98q16-58-2-70q-14 12-10 68z" fill="var(--h-fourrure)" ${TRAIT}/><path d="M182 88q-7-34 0-48M218 88q7-34 0-48" stroke="var(--h-peche)" stroke-width="6" stroke-linecap="round"/>`,
      tete: `<ellipse cx="200" cy="132" rx="50" ry="44" fill="var(--h-fourrure)" ${TRAIT}/>`,
      visage: () =>
        yeux(182, 218, 134) +
        `<path d="M196 142q4 4 8 0" fill="var(--h-peche)" stroke="var(--h-peche)" stroke-width="3" stroke-linecap="round"/>` +
        BOUCHE.replace(/150/g, '149') +
        JOUES
    },
    xiongmao: {
      poil: 'var(--h-fourrure)',
      patte: ENCRE,
      robe: 'var(--h-jade)',
      derriere: () => `<circle cx="160" cy="98" r="17" fill="${ENCRE}"/><circle cx="240" cy="98" r="17" fill="${ENCRE}"/>`,
      tete: `<ellipse cx="200" cy="132" rx="52" ry="45" fill="var(--h-fourrure)" ${TRAIT}/>`,
      visage: () =>
        `<ellipse cx="180" cy="136" rx="13" ry="16" transform="rotate(24 180 136)" fill="${ENCRE}"/><ellipse cx="220" cy="136" rx="13" ry="16" transform="rotate(-24 220 136)" fill="${ENCRE}"/><circle cx="182" cy="133" r="4.4" fill="var(--h-fourrure)"/><circle cx="218" cy="133" r="4.4" fill="var(--h-fourrure)"/><ellipse cx="200" cy="148" rx="6" ry="4" fill="${ENCRE}"/>` +
        BOUCHE.replace(/150/g, '155') +
        JOUES.replace(/150/g, '156')
    },
    shi: {
      poil: 'var(--h-abricot)',
      patte: 'var(--h-abricot)',
      robe: 'var(--h-rose)',
      derriere: () =>
        `<g fill="var(--h-indigo)" ${TRAIT}>${Array.from({ length: 12 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 12;
          return `<circle cx="${(200 + Math.cos(a) * 50).toFixed(1)}" cy="${(130 + Math.sin(a) * 44).toFixed(1)}" r="17"/>`;
        }).join('')}</g><path d="M166 94q-6-18 8-20q6 10 4 22z" fill="var(--h-abricot)" ${TRAIT}/><path d="M234 94q6-18-8-20q-6 10-4 22z" fill="var(--h-abricot)" ${TRAIT}/>`,
      tete: `<ellipse cx="200" cy="134" rx="44" ry="40" fill="var(--h-abricot)" ${TRAIT}/>`,
      visage: () =>
        `<path d="M170 118q12-8 22 0M208 118q12-8 22 0" stroke="var(--h-indigo)" stroke-width="6" fill="none" stroke-linecap="round"/>` +
        yeux(183, 217, 136) +
        `<ellipse cx="200" cy="148" rx="7" ry="4.5" fill="${ENCRE}"/>` +
        BOUCHE.replace(/150/g, '155') +
        JOUES.replace(/150/g, '154')
    }
  };

  /**
   * La silhouette change d'étape en étape, un réglage par rang : la tête (dessinée une
   * fois pour toutes, centrée en 200, 132) rapetisse par rapport au corps, le cou monte, la
   * robe s'allonge, les épaules (`ht`) et le bas de la robe (`hb`) s'élargissent.
   */
  const ETAPES = [
    { hs: 1.0, hcy: 182, cou: 214, ourlet: 258, ht: 24, hb: 34 }, // bébé
    { hs: 0.95, hcy: 166, cou: 200, ourlet: 238, ht: 25, hb: 36 }, // tout-petit
    { hs: 0.9, hcy: 152, cou: 186, ourlet: 240, ht: 25, hb: 38 }, // enfant
    { hs: 0.86, hcy: 142, cou: 177, ourlet: 246, ht: 26, hb: 40 }, // grand enfant
    { hs: 0.82, hcy: 132, cou: 167, ourlet: 258, ht: 26, hb: 44 }, // ado
    { hs: 0.8, hcy: 128, cou: 162, ourlet: 259, ht: 27, hb: 46 },
    { hs: 0.78, hcy: 123, cou: 156, ourlet: 260, ht: 28, hb: 48 }, // jeune
    { hs: 0.77, hcy: 120, cou: 153, ourlet: 260, ht: 28, hb: 50 },
    { hs: 0.76, hcy: 117, cou: 149, ourlet: 261, ht: 29, hb: 52 }, // adulte
    { hs: 0.76, hcy: 117, cou: 149, ourlet: 261, ht: 29, hb: 53 },
    { hs: 0.76, hcy: 117, cou: 149, ourlet: 261, ht: 30, hb: 54 },
    { hs: 0.76, hcy: 117, cou: 149, ourlet: 261, ht: 30, hb: 55 }
  ];

  /** Le rang ramené aux douze étapes dessinées. */
  export function etape(n: number): number {
    return Math.max(0, Math.min(ETAPES.length - 1, Math.floor(n)));
  }

  const meche = (): string =>
    `<path d="M196 88q4-12 10-6q-6 0-4 8" stroke="${ENCRE}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

  function fleur(x: number, y: number, r: number): string {
    const petales = [0, 72, 144, 216, 288]
      .map(
        (a) =>
          `<circle cx="${(Math.cos((a * Math.PI) / 180) * r * 0.6).toFixed(1)}" cy="${(Math.sin((a * Math.PI) / 180) * r * 0.6).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="var(--h-peche)"/>`
      )
      .join('');
    return `<g transform="translate(${x} ${y})">${petales}<circle r="${(r * 0.35).toFixed(1)}" fill="var(--h-abricot)"/></g>`;
  }

  const nuage = (x: number, y: number): string =>
    `<path d="M${x} ${y}q0-8 8-8q2-8 10-6q8-2 10 6q8 0 8 8" stroke="var(--h-carte)" stroke-width="2.5" fill="none" opacity=".7" stroke-linecap="round"/>`;

  /** 长命锁 : le cadenas porte-bonheur des enfants, en argent : papier clair cerné d'encre. */
  function verrou(x: number, y: number, k: number): string {
    return `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-22 -18q22 -14 44 0" stroke="var(--h-brume)" stroke-width="3" fill="none"/><path d="M-16 -8h32q4 10-4 18q-12 10-12 10q0 0-12-10q-8-8-4-18z" fill="var(--h-argent)" stroke="${ENCRE}" stroke-width="3" stroke-linejoin="round"/><circle cy="2" r="3" fill="var(--h-brume)"/></g>`;
  }

  /** 虎头鞋 : les chaussons à tête de tigre des tout-petits. */
  function chaussonsTigre(): string {
    return [184, 216]
      .map(
        (x) =>
          `<g transform="translate(${x} 262)"><ellipse rx="15" ry="9" fill="var(--h-abricot)" stroke="${ENCRE}" stroke-width="3"/><circle cx="-6" cy="-9" r="4" fill="var(--h-abricot)" stroke="${ENCRE}" stroke-width="2.5"/><circle cx="6" cy="-9" r="4" fill="var(--h-abricot)" stroke="${ENCRE}" stroke-width="2.5"/><circle cx="-5" cy="-1" r="2" fill="${ENCRE}"/><circle cx="5" cy="-1" r="2" fill="${ENCRE}"/><path d="M-3 4q3 2 6 0" stroke="${ENCRE}" stroke-width="2" fill="none"/></g>`
      )
      .join('');
  }

  /**
   * La coiffe, dans le repère de la tête : la mèche des petits, les deux chignons 总角 de
   * l'écolier, le bonnet du lettré, le bonnet à ailes 乌纱帽 dès 进士, dont les ailes
   * s'allongent, et la fleur des trois premiers du palais.
   */
  function coiffe(n: number): string {
    if (n <= 1) return meche();
    if (n === 2 || n === 3)
      return `<circle cx="178" cy="92" r="9" fill="${ENCRE}"/><circle cx="222" cy="92" r="9" fill="${ENCRE}"/><path d="M170 92h-6M230 92h6" stroke="var(--h-abricot)" stroke-width="4" stroke-linecap="round"/>`;
    if (n <= 6)
      return (
        `<path d="M166 98q34-40 68 0z" fill="${ENCRE}"/><rect x="160" y="94" width="80" height="10" rx="4" fill="${ENCRE}"/>` +
        (n === 6
          ? `<path d="M230 100q18 10 20 34M236 100q24 6 30 28" stroke="${ENCRE}" stroke-width="4" fill="none" stroke-linecap="round"/>`
          : '')
      );
    const aile = n >= 10 ? 62 : n >= 9 ? 54 : 46;
    let c = `<path d="M168 98q32-44 64 0z" fill="${ENCRE}"/><rect x="158" y="92" width="84" height="11" rx="4" fill="${ENCRE}"/><rect x="${164 - aile}" y="91" width="${aile}" height="8" rx="4" fill="${ENCRE}"/><rect x="236" y="91" width="${aile}" height="8" rx="4" fill="${ENCRE}"/>`;
    if (n >= 9) c += fleur(234, 76, n >= 10 ? 11 : 9);
    if (n === 11) c += fleur(166, 76, 11);
    return c;
  }

  /**
   * Le personnage entier, les pieds en (200, 266), à l'échelle `echelle`. Rang par rang :
   * 肚兜 et 长命锁 du bébé ; veste à boutons 盘扣, 虎头鞋 et tambourin 拨浪鼓 du tout-petit ;
   * sac à livres 书袋 de l'écolier ; ceinture et pinceau du 童生 ; bande 襕 et revers du
   * 秀才 ; col bordé et rouleau du 举人 ; gilet 半臂 et éventail du 贡士 ; ceinture de jade du
   * 进士 ; nuages brodés et livre du 翰林 ; 补子 du 探花 ; vagues du 榜眼 ; grand nœud de soie
   * 大红花 du 状元, de pêche et de rose, jamais de cinabre.
   */
  export function personnage(id: BeteId, rang: number, echelle: number): string {
    const b = BETES[id];
    const n = etape(rang);
    const E = ETAPES[n];
    const tete = (x: string): string =>
      `<g transform="translate(200 ${E.hcy}) scale(${E.hs}) translate(-200 -132)">${x}</g>`;
    const T = TRAIT;
    const L = 200 - E.ht;
    const R = 200 + E.ht;
    const mi = E.cou + (E.ourlet - E.cou) * 0.5;
    const mainY = E.cou + (E.ourlet - E.cou) * 0.42;
    const mainG = [200 - E.hb - 8, mainY];
    const mainD = [200 + E.hb + 8, mainY + 2];
    const s: string[] = [];
    const f: string[] = [];

    /* le sol */
    s.push(`<ellipse cx="200" cy="270" rx="${40 + n * 3}" ry="7" fill="var(--line)"/>`);

    if (n === 0) {
      /* 启蒙 : tout bébé, le 肚兜 noué au cou et le 长命锁. */
      s.push(`<ellipse cx="184" cy="262" rx="12" ry="8" fill="${b.patte}" ${T}/><ellipse cx="216" cy="262" rx="12" ry="8" fill="${b.patte}" ${T}/>`);
      s.push(`<ellipse cx="200" cy="236" rx="34" ry="30" fill="${b.poil}" ${T}/>`);
      f.push(`<path d="M200 212l24 22l-24 26l-24-26z" fill="${b.robe}" ${T}/><path d="M178 214q22 10 44 0" stroke="var(--h-abricot)" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
      f.push(`<circle cx="168" cy="234" r="9" fill="${b.patte}" ${T}/><circle cx="232" cy="234" r="9" fill="${b.patte}" ${T}/>`);
      f.push(verrou(200, 226, 0.8));
      return `<g class="heros" style="transform:scale(${echelle})">${s.join('')}${tete(b.derriere())}${f.join('')}${tete(b.tete + b.visage() + coiffe(n))}</g>`;
    }

    /* jambes et chaussures sous l'ourlet */
    if (E.ourlet < 256) {
      s.push(`<rect x="180" y="${E.ourlet - 6}" width="15" height="${262 - E.ourlet}" rx="5" fill="var(--h-carte)" ${T}/><rect x="205" y="${E.ourlet - 6}" width="15" height="${262 - E.ourlet}" rx="5" fill="var(--h-carte)" ${T}/>`);
    }
    s.push(
      n === 1
        ? chaussonsTigre()
        : `<ellipse cx="184" cy="264" rx="15" ry="7" fill="${ENCRE}"/><ellipse cx="216" cy="264" rx="15" ry="7" fill="${ENCRE}"/>`
    );

    /* les manches, avec revers dès 秀才 */
    const manche = (sx: number, hx: number, hy: number): string =>
      `<path d="M${sx} ${E.cou + 6}Q${sx + (hx - sx) * 1.1} ${E.cou + 14} ${hx} ${hy - 8}l${hx < 200 ? 4 : -4} 18Q${sx} ${hy + 6} ${sx + (hx < 200 ? 10 : -10)} ${E.cou + 22}z" fill="${b.robe}" ${T}/>`;
    s.push(manche(L + 2, mainG[0], mainG[1]) + manche(R - 2, mainD[0], mainD[1]));
    if (n >= 4)
      s.push(`<path d="M${mainG[0] - 8} ${mainG[1] + 2}l14 8M${mainD[0] + 8} ${mainD[1] + 2}l-14 8" stroke="${ENCRE}" stroke-width="7" stroke-linecap="round" opacity=".85"/>`);

    /* la robe (ou la veste courte) */
    const robe = `M${L} ${E.cou}Q${L - 8} ${mi} ${200 - E.hb} ${E.ourlet}Q200 ${E.ourlet + 8} ${200 + E.hb} ${E.ourlet}Q${R + 8} ${mi} ${R} ${E.cou}Z`;
    s.push(`<path d="${robe}" fill="${b.robe}" ${T}/>`);
    /* la bande 襕 au bas de la robe, dès 秀才 */
    if (n >= 4)
      s.push(`<path d="M${200 - E.hb + 3} ${E.ourlet - 9}Q200 ${E.ourlet - 1} ${200 + E.hb - 3} ${E.ourlet - 9}" stroke="${ENCRE}" stroke-width="7" fill="none" opacity=".8"/>`);
    /* les vagues 海水 brodées au bas, dès 榜眼 */
    if (n >= 10)
      s.push(`<path d="M${200 - E.hb + 8} ${E.ourlet - 16}q6-6 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0" stroke="var(--h-carte)" stroke-width="2.5" fill="none" opacity=".75"/>`);
    /* les nuages brodés, dès 翰林 */
    if (n >= 8) s.push(nuage(200 - E.hb + 18, E.ourlet - 36) + nuage(200 + E.hb - 22, E.ourlet - 48));
    /* le gilet 半臂, dès 贡士 */
    if (n >= 6)
      s.push(`<path d="M${L + 2} ${E.cou + 2}L${200 - 22} ${E.ourlet - 30}H${200 + 22}L${R - 2} ${E.cou + 2}Z" fill="${ENCRE}" opacity=".18"/>`);
    /* le col croisé */
    s.push(`<path d="M${200 - 14} ${E.cou}l14 ${n <= 1 ? 16 : 28}l14 -${n <= 1 ? 16 : 28}" fill="var(--h-carte)" ${T}/>`);
    if (n >= 5) s.push(`<path d="M${200 - 14} ${E.cou}l14 28l14 -28" stroke="var(--h-abricot)" stroke-width="3" fill="none"/>`);
    if (n >= 4) s.push(`<path d="M200 ${E.cou + 28}V${E.ourlet - 12}" stroke="${ENCRE}" stroke-width="2.4" opacity=".3"/>`);
    /* les boutons 盘扣 de la veste du tout-petit */
    if (n === 1)
      s.push([0, 1, 2].map((i) => `<path d="M194 ${E.cou + 18 + i * 7}h12" stroke="var(--h-abricot)" stroke-width="3" stroke-linecap="round"/>`).join(''));
    /* le 补子, carré brodé d'une grue, dès 探花 */
    if (n >= 9)
      s.push(`<rect x="184" y="${E.cou + 34}" width="32" height="30" rx="3" fill="var(--h-abricot-pale)" ${T}/><path d="M192 ${E.cou + 56}q6-14 16-12M198 ${E.cou + 44}l6-4l2 6" stroke="${ENCRE}" stroke-width="2" fill="none" stroke-linecap="round"/>`);

    /* la ceinture : abricot du 童生 au 贡士, de jade dès 进士 */
    const cy = E.cou + (E.ourlet - E.cou) * (n >= 4 ? 0.36 : 0.5);
    if (n >= 3 && n < 7)
      s.push(`<rect x="${200 - E.hb + 12}" y="${cy}" width="${2 * E.hb - 24}" height="8" rx="4" fill="var(--h-abricot)" ${T}/>`);
    if (n >= 7)
      s.push(
        `<rect x="${200 - E.hb + 10}" y="${cy - 1}" width="${2 * E.hb - 20}" height="10" rx="4" fill="${ENCRE}"/>` +
          [-18, -6, 6, 18].map((dx) => `<rect x="${196 + dx}" y="${cy + 1}" width="8" height="6" rx="1.5" fill="var(--h-jade)"/>`).join('')
      );

    /* le sac à livres 书袋 de l'écolier */
    if (n === 2)
      s.push(`<path d="M${L + 4} ${E.cou + 2}L${R + 6} ${E.ourlet - 22}" stroke="var(--h-ocre)" stroke-width="5" stroke-linecap="round"/><rect x="${R - 2}" y="${E.ourlet - 32}" width="26" height="22" rx="5" fill="var(--h-abricot-pale)" ${T}/><path d="M${R + 4} ${E.ourlet - 26}h14" stroke="var(--h-ocre)" stroke-width="3" stroke-linecap="round"/>`);
    /* l'éventail 折扇 glissé dans la ceinture, dès 贡士 */
    if (n >= 6) s.push(`<path d="M${200 - E.hb + 16} ${cy - 18}l8 30l6-2z" fill="var(--h-carte)" ${T}/>`);

    /* le 长命锁 des petits */
    if (n <= 2) f.push(verrou(200, E.cou + (n === 1 ? 20 : 30), 0.75));
    /* le grand nœud de soie 大红花 du 状元 */
    if (n === 11)
      f.push(`<path d="M${L} ${E.cou + 4}L${200 + E.hb - 10} ${E.ourlet - 40}" stroke="var(--h-peche)" stroke-width="9" stroke-linecap="round"/><g transform="translate(200 ${E.cou + 38})"><circle r="17" fill="var(--h-peche)" ${T}/><circle r="7" fill="var(--h-rose)"/><path d="M-10 14l-8 22M10 14l8 22" stroke="var(--h-peche)" stroke-width="7" stroke-linecap="round"/></g>`);

    /* les mains, et ce qu'elles tiennent */
    f.push(`<circle cx="${mainG[0]}" cy="${mainG[1]}" r="9.5" fill="${b.patte}" ${T}/><circle cx="${mainD[0]}" cy="${mainD[1]}" r="9.5" fill="${b.patte}" ${T}/>`);
    /* le tambourin 拨浪鼓 */
    if (n === 1)
      f.push(`<g transform="translate(${mainD[0]} ${mainD[1]})"><path d="M0 0v-26" stroke="var(--h-ocre)" stroke-width="4" stroke-linecap="round"/><circle cy="-32" r="9" fill="var(--h-abricot)" ${T}/><circle cx="-9" cy="-32" r="3.5" fill="${ENCRE}"/><circle cx="9" cy="-32" r="3.5" fill="${ENCRE}"/></g>`);
    /* le pinceau, qui s'allonge dès 秀才 */
    if (n >= 3) {
      const lg = n >= 4 ? 58 : 40;
      f.push(`<g transform="rotate(-20 ${mainD[0]} ${mainD[1]})"><rect x="${mainD[0] - 3}" y="${mainD[1] - lg + 6}" width="7" height="${lg}" rx="3" fill="var(--h-ocre)" ${T}/><path d="M${mainD[0] - 5} ${mainD[1] + 6}q5 18 5 24q0-6 6-24z" fill="${ENCRE}"/></g>`);
    }
    /* le rouleau, du 举人 au 进士 */
    if (n >= 5 && n < 8)
      f.push(`<g transform="rotate(-8 ${mainG[0]} ${mainG[1]})"><rect x="${mainG[0] - 10}" y="${mainG[1] - 34}" width="20" height="50" rx="6" fill="var(--h-abricot-pale)" stroke="var(--h-ocre)" stroke-width="3"/><rect x="${mainG[0] - 14}" y="${mainG[1] - 38}" width="28" height="8" rx="3" fill="var(--h-ocre)"/><rect x="${mainG[0] - 14}" y="${mainG[1] + 12}" width="28" height="8" rx="3" fill="var(--h-ocre)"/></g>`);
    /* le livre cousu, dès 翰林 */
    if (n >= 8)
      f.push(`<g transform="translate(${mainG[0] - 4} ${mainG[1] - 26}) rotate(-6)"><rect width="30" height="40" rx="3" fill="var(--h-indigo)" ${T}/><rect x="4" y="4" width="10" height="24" fill="var(--h-carte)"/><path d="M26 4v32" stroke="var(--h-carte)" stroke-width="2" stroke-dasharray="3 4"/></g>`);

    return `<g class="heros" style="transform:scale(${echelle})">${s.join('')}${tete(b.derriere())}${f.join('')}${tete(b.tete + b.visage() + coiffe(n))}</g>`;
  }

  /** La tête seule, à son rang (la coiffe comprise) : le portrait de l'en-tête du menu. */
  export function portrait(id: BeteId, rang: number): string {
    const b = BETES[id];
    return `${b.derriere()}${b.tete}${b.visage()}${coiffe(etape(rang))}`;
  }

  /**
   * L'aura : des anneaux au pinceau, à plat, un tous les deux rangs, en tirets qui
   * tournent ; dès le troisième rang, les caractères déjà lus tournent autour.
   */
  export function aura(rang: number, points: number, lus: readonly string[], e = 1): string {
    const n = etape(rang);
    let s = '';
    const couleurs = ['var(--h-jade)', 'var(--h-azur)', 'var(--h-ocre)', 'var(--h-peche)', 'var(--h-abricot)'];
    const anneaux = Math.min(5, Math.floor(n / 2));
    for (let i = 0; i < anneaux; i++) {
      const r = 96 + i * 14;
      s += `<g class="anneau tourne${i % 2 ? ' inverse' : ''}"><circle cx="200" cy="170" r="${r}" fill="none" stroke="${couleurs[i]}" stroke-width="${i % 2 ? 4 : 5}" stroke-linecap="round" stroke-dasharray="${i % 2 ? '2 12' : '26 10'}" opacity=".75"/></g>`;
    }
    if (n >= 2 && lus.length > 0) {
      const k = Math.min(lus.length, 2 + n * 2 + Math.floor(points / 80));
      const r = 96 + Math.max(0, anneaux - 1) * 14 + 16;
      let chars = '';
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 - Math.PI / 2;
        chars += `<text x="${(200 + Math.cos(a) * r).toFixed(1)}" y="${(176 + Math.sin(a) * r * 0.72).toFixed(1)}" text-anchor="middle" font-family="Noto Serif SC, serif" font-weight="500" font-size="${((13 + Math.floor(n / 2)) / Math.max(e, 0.6)).toFixed(1)}" fill="var(--ink2)" opacity=".55">${lus[i]}</text>`;
      }
      s += `<g class="anneau tourne inverse lent">${chars}</g>`;
    }
    return s;
  }
</script>

<script lang="ts">
  /**
   * Trois cadrages du même dessin : la scène de « Mon personnage » (le sol, l'aura, le
   * personnage à sa taille), la vignette du choix (le bébé en pied) et le portrait de
   * l'en-tête du menu (la tête à son rang).
   */
  let {
    bete,
    rang = 0,
    echelle = 1,
    points = 0,
    lus = [],
    cadre = 'scene',
    largeur = 92
  }: {
    bete: BeteId;
    /** Le rang atteint, de 0 (启蒙) à 11 (状元) : la silhouette et la tenue. */
    rang?: number;
    /** La taille continue (`heros.taille`), sur la scène. */
    echelle?: number;
    points?: number;
    /** Les caractères déjà lus, pour l'aura. */
    lus?: readonly string[];
    cadre?: 'scene' | 'vignette' | 'portrait';
    /** La largeur en pixels, pour la vignette et le portrait ; la scène prend la place. */
    largeur?: number;
  } = $props();

  const svg = $derived.by(() => {
    if (cadre === 'portrait') {
      return `<svg width="${largeur}" height="${largeur}" viewBox="125 40 150 150" aria-hidden="true">${portrait(bete, rang)}</svg>`;
    }
    if (cadre === 'vignette') {
      return `<svg width="${largeur}" height="${Math.round((largeur * 252) / 180)}" viewBox="110 28 180 252" aria-hidden="true">${personnage(bete, rang, 1)}</svg>`;
    }
    return `<svg viewBox="0 10 400 290" aria-hidden="true"><g class="aura-echelle" style="transform:scale(${echelle})">${aura(rang, points, lus, echelle)}</g>${personnage(bete, rang, echelle)}</svg>`;
  });
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<span class="heros-svg {cadre}">{@html svg}</span>

<style>
  .heros-svg {
    display: block;
    line-height: 0;
  }
  .heros-svg.portrait,
  .heros-svg.vignette {
    display: inline-block;
  }
  .scene :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .heros-svg :global(.heros),
  .heros-svg :global(.aura-echelle) {
    transform-origin: 200px 266px;
    transform-box: view-box;
  }
  .heros-svg :global(.anneau) {
    transform-origin: 200px 170px;
    transform-box: view-box;
  }
  .heros-svg :global(.tourne) {
    animation: tourne 40s linear infinite;
  }
  .heros-svg :global(.tourne.inverse) {
    animation-direction: reverse;
    animation-duration: 55s;
  }
  .heros-svg :global(.tourne.lent) {
    animation-duration: 90s;
  }
  @keyframes tourne {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .heros-svg :global(.tourne) {
      animation: none;
    }
  }
</style>
