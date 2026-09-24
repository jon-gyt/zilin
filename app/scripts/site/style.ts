/**
 * La feuille de styles du site public : les tokens de la charte, tirés de
 * `src/lib/tokens.css` au moment de la génération (jamais recopiés), puis la mise en
 * page du site.
 *
 * Tiré de `tokens.css` : les `@font-face` des polices auto-hébergées de l'app, le
 * premier bloc `:root` (papier, encre, cinabre, indigo, ocre…), le rendu des caractères
 * depuis leurs traits (`.g`, `.g.write`, le pinceau et sa version sans animation) et
 * `.hz`. Les thèmes de fête n'en sont pas : le site garde le papier clair.
 *
 * Charte : papier clair, pas d'ombre, pas de dégradé, pas de doré. L'indigo est
 * l'action et le lien ; le cinabre ne marque que l'élément ajouté, et le point de la
 * marque 文.
 */

/** Le bloc qui commence à `debut` dans `css`, accolades équilibrées. */
function bloc(css: string, debut: number): string {
  let profondeur = 0;
  for (let i = css.indexOf('{', debut); i < css.length; i++) {
    if (css[i] === '{') profondeur++;
    else if (css[i] === '}' && --profondeur === 0) return css.slice(debut, i + 1);
  }
  throw new Error('tokens.css : accolade non fermée');
}

/**
 * Extrait de `tokens.css` ce que le site reprend. `polices` est le chemin, relatif à
 * la feuille du site, du dossier des polices de l'app.
 */
export function tokensDuSite(tokensCss: string, polices: string): string {
  const faces = tokensCss.match(/@font-face\{[^}]*\}/g) ?? [];
  if (faces.length === 0) throw new Error('tokens.css : aucune @font-face');
  const racine = tokensCss.indexOf(':root{');
  if (racine < 0) throw new Error('tokens.css : pas de bloc :root');
  const regles = tokensCss
    .split('\n')
    .filter((l) =>
      /^(\.hz\{|\.g\{|\.g path\{|\.g \.zhu\{|\.g\.write |@keyframes (brush|hold)\{|@media \(prefers-reduced-motion:reduce\)\{\.g\.write)/.test(l)
    );
  if (!regles.some((l) => l.startsWith('.g.write .br'))) throw new Error('tokens.css : rendu au pinceau introuvable');
  return [
    ...faces.map((f) => f.replace(/url\(\/fonts\//g, `url(${polices}`)),
    bloc(tokensCss, racine),
    ...regles
  ].join('\n');
}

/** La mise en page du site, après les tokens. */
export const MISE_EN_PAGE = `
*{box-sizing:border-box}
html{background:var(--paper);color-scheme:light;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.5}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:var(--grain-o);background-image:var(--grain)}
.page{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:16px 16px 40px}
a{color:var(--indigo);text-underline-offset:3px;text-decoration-thickness:1px}
a:focus-visible{outline:2px solid var(--indigo);outline-offset:2px;border-radius:4px}
h1,h2{font-family:var(--head);font-weight:700;letter-spacing:-.02em;line-height:1.15}
h1{font-size:30px;margin:0 0 6px}
h2{font-size:20px;margin:0 0 12px}
p{margin:0 0 12px}
.k{font-family:var(--sans);font-weight:400;font-size:13px;letter-spacing:0;color:var(--mist)}
[lang|="zh"]{font-family:var(--hz);font-weight:500}

.entete{display:flex;align-items:center;gap:10px;min-height:44px;margin-bottom:18px}
.marque{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none}
.marque .g{width:30px;height:30px}
.marque .nom{font-family:var(--head);font-weight:700;font-size:22px;letter-spacing:-.03em;line-height:1}
.entete .langue{margin-left:auto;font-size:15px;display:inline-flex;align-items:center;min-height:44px;padding:0 4px}

.carte{background:var(--card);border-radius:16px;padding:18px}
.carte + .carte,.carte + section,section + section,section + .carte{margin-top:14px}
section.carte h2{margin-bottom:10px}

.tete{display:grid;grid-template-columns:1fr;gap:18px;align-items:center}
.grand{position:relative;width:min(100%,260px);aspect-ratio:1;margin:0 auto}
.grand .grille,.case .grille{position:absolute;inset:0;width:100%;height:100%}
.grille rect,.grille path{fill:none;stroke:var(--grille);stroke-width:1}
.grille path{stroke-dasharray:3 4}
.grand .g{position:absolute;inset:6%;width:88%;height:88%}
.fiche h1{display:flex;align-items:baseline;gap:14px;margin-bottom:8px}
.fiche h1 .hz{font-size:34px}
.py{color:var(--indigo);font-family:var(--sans);font-weight:600;font-size:24px;letter-spacing:0}
.fait{color:var(--ink2);margin:0 0 4px}
.sens{font-size:19px;margin:6px 0 0}
.puces{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}
.puces li{padding:2px 10px;border:1px solid var(--line);border-radius:999px;font-size:13px;color:var(--ink2)}
.tag{display:inline-block;margin-top:10px;padding:2px 10px;border:1px solid var(--line);border-radius:999px;font-size:13px;color:var(--mist)}
.origine{color:var(--ink2);font-size:16px;margin:0}

.formule{display:flex;align-items:flex-start;flex-wrap:wrap;gap:6px 10px;margin:4px 0 10px}
.formule .op{color:var(--mist);font-size:22px;align-self:center;padding-bottom:18px}
.part{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:64px;padding:4px;border-radius:12px;color:var(--ink);text-decoration:none}
a.part:hover{background:var(--paper)}
.part .g{width:56px;height:56px}
.part .muet{display:flex;align-items:center;justify-content:center;width:56px;height:56px;font-size:34px;color:var(--mist)}
.part .p-py{font-size:13px;color:var(--mist)}
.part.sens .g{color:var(--ocre)}
.part.son .g{color:var(--indigo)}
.part.nouveau .g,.part.nouveau .muet{color:var(--zhu)}
.egal{font-size:15px;color:var(--ink2);margin:0}
.egal .hz{font-size:19px;color:var(--ink)}
.note{font-size:14px;color:var(--mist);margin:8px 0 0}

.traits{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:8px;margin:0;padding:0;list-style:none}
.traits li{position:relative}
.case{position:relative;display:block;aspect-ratio:1;background:var(--paper);border-radius:8px}
.case .g{position:absolute;inset:6%;width:88%;height:88%}
.case .g .avant{fill:var(--grille)}
.traits .n{position:absolute;left:5px;top:2px;font-size:12px;color:var(--mist);font-variant-numeric:tabular-nums}

.liste{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.liste a,.liste span{display:inline-flex;align-items:baseline;gap:6px;min-height:44px;padding:8px 12px;border-radius:10px;background:var(--paper);color:var(--ink);text-decoration:none}
.liste a:hover{background:var(--line)}
.liste .hz{font-size:22px}
.liste small{font-size:14px;color:var(--mist)}
.liste [aria-current]{outline:1px solid var(--rule)}
.plus{margin:12px 0 0;font-size:15px}

.mots{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.mots li{border-radius:8px;padding:8px 12px;font-size:15px;color:var(--ink2);background:var(--paper)}
.mots .hz{font-size:19px;color:var(--ink);margin-right:6px}
.phrase{font-size:24px;line-height:1.5;margin:14px 0 2px}
.trad{color:var(--ink2);font-size:15px;margin:0}

.appel{display:flex;flex-direction:column;align-items:center;gap:8px;margin:24px 0 0;text-align:center}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:12px;background:var(--act);color:var(--act-ink);font-weight:600;font-size:17px;text-decoration:none;width:100%;max-width:420px}
.appel p{font-size:14px;color:var(--mist);margin:0}

.familles{display:grid;grid-template-columns:1fr;gap:14px}
.famille h2{display:flex;align-items:baseline;gap:10px;margin:0 0 10px;font-size:18px}
.famille h2 .hz{font-size:30px;font-family:var(--hz);font-weight:500}
.famille h2 a{color:var(--ink);text-decoration:none}
.famille h2 small{font-family:var(--sans);font-weight:400;font-size:14px;color:var(--mist);letter-spacing:0}
.famille .liste a{min-height:40px;padding:6px 10px}
.famille .liste .hz{font-size:20px}
.intro{color:var(--ink2);max-width:60ch}

.licences table{border-collapse:collapse;width:100%;font-size:14px}
.licences th,.licences td{text-align:left;vertical-align:top;padding:8px 6px;border-top:1px solid var(--line)}
.licences .defile{overflow-x:auto;margin:0 -4px 14px}
.licences code{font-size:.92em;background:var(--paper);padding:1px 4px;border-radius:4px;word-break:break-word}
.licences h2{margin-top:18px}
.fichiers{columns:3 7em;font-size:14px;margin:0;padding:0;list-style:none}
.fichiers a{display:inline-block;min-height:32px;padding:4px 0}

.pied{margin-top:32px;padding-top:16px;border-top:1px solid var(--line);font-size:13.5px;color:var(--ink2)}
.pied p{margin:0 0 8px}

@media (min-width:760px){
  .page{padding:28px 24px 56px}
  h1{font-size:36px}
  .tete{grid-template-columns:260px 1fr;gap:28px}
  .grand{margin:0}
  .familles{grid-template-columns:1fr 1fr}
  .traits{grid-template-columns:repeat(auto-fill,minmax(64px,1fr))}
}
`;
