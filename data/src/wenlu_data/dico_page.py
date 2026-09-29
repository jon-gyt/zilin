"""La page de relecture du dictionnaire (`wenlu dico apercu`) : un HTML autonome.

Le propriétaire la lit sur son téléphone, lot par lot : pour chaque entrée, le mot ou le
caractère, son pinyin, sa glose, ses acceptions et ses phrases. Il marque « Bon », corrige
(glose, acceptions, phrases), ou renvoie « À refaire » avec une note ; ses avis restent
dans le navigateur (`localStorage`, s'il est permis) et se copient en JSON (bouton, ou
sélection du texte en repli). `wenlu dico appliquer-relecture` réintègre ce JSON.

La page commence par `<title>` puis `<style>`, sans balises `html`, `head` ni `body` : elle
se publie telle quelle. Les données sont incluses, rien n'est chargé que la police.
"""
from __future__ import annotations

import json
from typing import Mapping, Sequence

from .dico_sens import CATEGORIES, FORMAT_RELECTURE, GLOSE_MAX, Referentiel


def donnees(lots: Sequence[Mapping[str, object]], ref: Referentiel, date: str) -> dict[str, object]:
    """Ce que la page affiche : les lots, et pour chaque caractère les mots de la liste qu'il porte."""
    sortie = []
    for lot in lots:
        entrees = []
        for e in lot.get("entrees") or ():  # type: ignore[union-attr]
            x = {k: e[k] for k in ("id", "genre", "hanzi", "pinyin", "sens", "exemples") if k in e}
            m = ref.par_id.get(str(e["id"]))
            if m is not None:
                x["niveau"] = m.niveau
                x["categories"] = list(m.categorie)
                x["officiel"] = m.officiel
            else:
                x["niveau"] = ref.caracteres.get(str(e["id"]), "")
                x["mots"] = [
                    {"id": s.id, "officiel": s.officiel, "pinyin": s.forme.pinyin, "categories": list(s.categorie), "niveau": s.niveau}
                    for s in ref.simples.get(str(e["id"]), [])
                ]
            entrees.append(x)
        sortie.append({"niveau": lot.get("niveau"), "lot": lot.get("lot"), "date": (lot.get("generation") or {}).get("date"), "entrees": entrees})  # type: ignore[union-attr]
    return {"date": date, "format": FORMAT_RELECTURE, "glose_max": GLOSE_MAX, "categories": CATEGORIES, "lots": sortie}


def page(lots: Sequence[Mapping[str, object]], ref: Referentiel, *, date: str) -> str:
    texte = json.dumps(donnees(lots, ref, date), ensure_ascii=False, separators=(",", ":"))
    return PAGE.replace("__DONNEES__", texte.replace("</", "<\\/"))


PAGE = r"""<title>Relecture du dictionnaire</title>
<style>
/* Une colonne de fiches à relire, lot par lot ; la barre des retours reste en bas. */
:root{
  --papier:#F3F0E8; --carte:#FBFAF6; --encre:#1E1C1A; --encre2:#4B4640; --brume:#7D776F; --filet:#DAD4C8; --trait:#C9C1B2;
  --indigo:#2B4C7E; --indigo-doux:#DCE3EF; --jade:#3F7552; --jade-doux:#DCE9DF; --ocre:#8C5A2B; --ocre-doux:#F1E5D4;
  --hz:"Noto Serif SC","Songti SC","PingFang SC",serif;
  --texte:"Source Sans 3","Helvetica Neue",Helvetica,Arial,sans-serif;
  --titre:"Manrope","Helvetica Neue",Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --papier:#181715; --carte:#221F1C; --encre:#EEE9E0; --encre2:#C9C2B6; --brume:#9C958A; --filet:#37332E; --trait:#4A453E;
  --indigo:#9DB5DC; --indigo-doux:#26324A; --jade:#8CC39E; --jade-doux:#1F3326; --ocre:#E0AE7C; --ocre-doux:#3A2A1B; color-scheme:dark}}
:root[data-theme="dark"]{
  --papier:#181715; --carte:#221F1C; --encre:#EEE9E0; --encre2:#C9C2B6; --brume:#9C958A; --filet:#37332E; --trait:#4A453E;
  --indigo:#9DB5DC; --indigo-doux:#26324A; --jade:#8CC39E; --jade-doux:#1F3326; --ocre:#E0AE7C; --ocre-doux:#3A2A1B; color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--papier);color:var(--encre);font-family:var(--texte);font-size:16px;line-height:1.5}
.page{max-width:760px;margin:0 auto;padding-inline:16px;padding-block:24px 120px;display:grid;gap:14px}
h1{font-family:var(--titre);font-weight:700;font-size:26px;line-height:1.15;letter-spacing:-.02em;margin:0;text-wrap:balance}
.sur{color:var(--brume);font-size:13px;letter-spacing:.06em;text-transform:uppercase}
.chapo{margin:0;color:var(--encre2);max-width:62ch}
button,select,input,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--indigo);outline-offset:2px}
.barre{position:sticky;top:env(safe-area-inset-top,0px);z-index:2;background:var(--papier);display:grid;gap:8px;padding-block:10px;border-bottom:1px solid var(--filet)}
.ligne{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
select{min-height:42px;border:1.5px solid var(--trait);border-radius:10px;background:var(--carte);padding:6px 10px;max-width:100%}
.filtres button{border:1px solid var(--trait);background:none;border-radius:999px;padding:5px 12px;font-size:14px;color:var(--encre2);min-height:36px}
.filtres button.on{border-color:var(--indigo);background:var(--indigo-doux);color:var(--encre)}
.jauge{height:6px;border-radius:3px;background:var(--filet);overflow:hidden;display:flex}
.jauge i{display:block;height:100%}.jauge .b{background:var(--jade)}.jauge .c{background:var(--indigo)}.jauge .r{background:var(--ocre)}
.compte{font-size:14px;color:var(--encre2);font-variant-numeric:tabular-nums}
.liste{display:grid;gap:12px}
.it{background:var(--carte);border:1px solid var(--filet);border-radius:14px;padding:14px;display:grid;gap:12px;min-width:0}
.it.bon{border-color:var(--jade)}.it.corrige{border-color:var(--indigo)}.it.a_refaire{border-color:var(--ocre)}
.tete{display:flex;gap:12px;align-items:flex-start}
.tete .c{font-family:var(--hz);font-size:40px;line-height:1.05;flex:none;min-width:48px;text-align:center}
.tete .t{flex:1;min-width:0;display:grid;gap:2px}
.tete .py{font-size:18px;font-weight:600}
.tete .meta{font-size:13px;color:var(--brume)}
.tete .meta .hz{font-family:var(--hz);color:var(--encre2)}
.pill{font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;white-space:nowrap;background:var(--filet);color:var(--encre2)}
.pill.bon{background:var(--jade-doux);color:var(--jade)}.pill.corrige{background:var(--indigo-doux);color:var(--indigo)}.pill.a_refaire{background:var(--ocre-doux);color:var(--ocre)}
.sens{display:grid;gap:6px}
.glose{font-size:18px;font-weight:600}
.etat{font-size:12px;color:var(--brume);font-weight:400;margin-left:6px}
.etat.relu{color:var(--jade)}
.acc{margin:0;padding:0;list-style:none;display:grid;gap:4px}
.acc li{display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:baseline;min-width:0}
.cat{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--brume)}
.acc .lec{color:var(--indigo);font-weight:600;margin-right:6px}
.ex{display:grid;gap:10px;border-top:1px solid var(--filet);padding-top:10px}
.ph{display:grid;gap:1px;min-width:0}
.ph .zh{font-family:var(--hz);font-size:21px;line-height:1.35}
.ph .zh mark{background:none;color:inherit;text-decoration:underline;text-decoration-color:var(--indigo);text-underline-offset:4px}
.ph .p{font-size:14.5px;color:var(--encre2)}
.ph .fr{font-size:15px}
.vide{color:var(--brume);font-size:14px}
.actions{display:flex;flex-wrap:wrap;gap:8px}
.actions button{border-radius:10px;padding:8px 16px;min-height:44px;border:1.5px solid var(--trait);background:var(--papier);font-weight:600}
.actions .bon.on{background:var(--jade);border-color:var(--jade);color:var(--carte)}
.actions .corriger.on{background:var(--indigo);border-color:var(--indigo);color:var(--carte)}
.actions .refaire.on{background:var(--ocre);border-color:var(--ocre);color:var(--carte)}
textarea,input[type=text]{width:100%;min-width:0;border:1.5px solid var(--trait);border-radius:10px;padding:8px 10px;background:var(--papier)}
textarea{resize:vertical;min-height:44px}
.edit{display:grid;gap:10px;border-top:1px dashed var(--trait);padding-top:10px}
.edit label{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--brume);display:grid;gap:4px}
.edit label input{font-size:16px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--encre)}
.aide{color:var(--encre2);font-size:15px;max-width:62ch}.aide summary{cursor:pointer;color:var(--indigo);font-weight:600;min-height:32px}.aide p{margin:6px 0 0}
.edit .rang{display:grid;grid-template-columns:120px 1fr 90px 44px;gap:6px;align-items:center}
.edit .rang-ph{display:grid;gap:6px;border:1px solid var(--filet);border-radius:10px;padding:8px}
.edit .zhin{font-family:var(--hz);font-size:19px}
.edit .petit{border:1px solid var(--trait);background:none;border-radius:8px;min-height:40px;padding:4px 10px;color:var(--encre2)}
.edit .ok{border:1.5px solid var(--indigo);background:var(--indigo);color:var(--carte);border-radius:10px;min-height:44px;font-weight:600;padding:8px 16px}
.alerte{color:var(--ocre);font-size:14px}
.tous{border:1.5px solid var(--jade);color:var(--jade);background:none;border-radius:10px;padding:6px 12px;font-weight:600;min-height:40px}
.pied{position:fixed;left:0;right:0;bottom:0;z-index:3;background:var(--carte);border-top:1px solid var(--filet);padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px))}
.pied .dedans{max-width:760px;margin:0 auto;display:grid;gap:6px}
.pied .ligne{flex-wrap:nowrap}.pied .compte{font-size:13px;min-width:0}
.pied button{border:1.5px solid var(--indigo);background:var(--indigo);color:var(--carte);border-radius:10px;min-height:42px;padding:6px 12px;font-weight:600;white-space:nowrap;flex:none}
.pied button.second{background:none;color:var(--indigo)}
.pied textarea{font-family:ui-monospace,Menlo,monospace;font-size:12px;height:110px}
@media (max-width:520px){.edit label input{font-size:16px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--encre)}
.aide{color:var(--encre2);font-size:15px;max-width:62ch}.aide summary{cursor:pointer;color:var(--indigo);font-weight:600;min-height:32px}.aide p{margin:6px 0 0}
.edit .rang{grid-template-columns:1fr 1fr}.edit .rang input.frin{grid-column:1/-1}.acc li{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@700&family=Source+Sans+3:wght@400;600&family=Noto+Serif+SC:wght@500&display=swap">

<div class="page">
  <div class="sur" id="sur">Wenlu 文路 · dictionnaire</div>
  <h1>Relecture des sens et des phrases</h1>
  <p class="chapo">Pour chaque fiche : la glose (la ligne des résultats), les acceptions, les phrases d'exemple. Marque-la bonne, corrige-la, ou renvoie-la.</p>
  <details class="aide"><summary>Comment ça marche</summary>
    <p>« Bon » passe à relu tout ce qui est à relire dans la fiche. « Corriger » l'ouvre pour la réécrire : ce que tu enregistres devient relu, et le texte d'avant reste tracé dans le pipeline. « À refaire » la renvoie à la rédaction, avec ta note. Une glose marquée « relue, fiche » l'a déjà été dans les fiches ; seules ses phrases attendent.</p>
    <p>Tes avis restent dans ce navigateur. « Copier les retours » les met en JSON, pour <code>wenlu dico appliquer-relecture</code> ; si la copie est refusée, le texte reste sélectionné.</p>
  </details>
  <div class="barre">
    <div class="ligne"><label for="lot" class="sur">Lot</label><select id="lot"></select></div>
    <div class="ligne filtres" id="filtres">
      <button data-f="attente" class="on">À relire</button>
      <button data-f="decides">Décidés</button>
      <button data-f="tout">Tout le lot</button>
    </div>
    <div class="jauge" aria-hidden="true"><i class="b" id="j-b"></i><i class="c" id="j-c"></i><i class="r" id="j-r"></i></div>
    <div class="compte" id="compte" role="status"></div>
  </div>
  <div class="ligne" id="tous"></div>
  <div class="liste" id="liste"></div>
</div>
<div class="pied">
  <div class="dedans">
    <div class="ligne"><button id="copier">Copier les retours</button><button id="selection" class="second">Sélectionner</button><span class="compte" id="retour"></span></div>
    <textarea id="sortie" hidden readonly aria-label="Retours en JSON"></textarea>
  </div>
</div>

<script type="application/json" id="donnees">__DONNEES__</script>
<script>
const D = JSON.parse(document.getElementById("donnees").textContent);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const HAN = /[⺀-⿟㐀-䶿一-鿿豈-﫿]/;
const CLE = "wenlu-dico-relecture";
let AVIS = {};
try { AVIS = JSON.parse(localStorage.getItem(CLE) || "{}") || {}; } catch (e) { AVIS = {}; }
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(AVIS)); } catch (e) {} };
const LOTS = D.lots.map((l) => ({ ...l, cle: `${l.niveau}-${l.lot}` }));
let vue = { lot: LOTS[0]?.cle, filtre: "attente" };
try { const v = JSON.parse(localStorage.getItem(CLE + "-vue") || "null"); if (v && LOTS.some((l) => l.cle === v.lot)) vue = v; } catch (e) {}
const garderVue = () => { try { localStorage.setItem(CLE + "-vue", JSON.stringify(vue)); } catch (e) {} };
const ouverts = new Set();
let confirmerTous = false;

const aRelire = (e) => (e.sens?.statut === "a_relire" ? 1 : 0) + (e.exemples || []).filter((x) => x.statut === "a_relire").length;
const lot = () => LOTS.find((l) => l.cle === vue.lot);
const cat = (c) => D.categories[c] || c || "—";
function souligne(zh, h) {
  if (!h || !zh.includes(h)) return esc(zh);
  return zh.split(h).map(esc).join(`<mark>${esc(h)}</mark>`);
}
function etiquette(s) {
  if (!s) return "";
  if (s.statut === "relu") return `<span class="etat relu">relue${s.provenance?.reprise ? ", fiche" : ""}</span>`;
  if (s.statut === "rejete") return `<span class="etat">renvoyée</span>`;
  return "";
}
function lecture(e) {
  const a = AVIS[e.id];
  const s = a?.decision === "corrige" && a.sens ? a.sens : e.sens || {};
  const ex = a?.decision === "corrige" && a.exemples ? a.exemples : e.exemples || [];
  const accs = (s.acceptions || []).map((x) => `<li><span class="cat">${esc(cat(x.categorie))}</span><span>${x.pinyin ? `<span class="lec">${esc(x.pinyin)}</span>` : ""}${esc(x.fr)}</span></li>`).join("");
  const phrases = ex.length
    ? ex.map((x) => `<div class="ph"><span class="zh">${souligne(x.zh, e.hanzi)}</span><span class="p">${esc(x.pinyin)}</span><span class="fr">${esc(x.fr)}</span></div>`).join("")
    : `<span class="vide">Pas de phrase : ce caractère n'est pas un mot à lui seul.</span>`;
  return `<div class="sens"><div class="glose">${esc(s.glose)}${a?.decision === "corrige" ? "" : etiquette(e.sens)}</div>${accs ? `<ol class="acc">${accs}</ol>` : `<span class="vide">Pas d'acception : la glose seule.</span>`}</div><div class="ex">${phrases}</div>`;
}
function meta(e) {
  if (e.genre === "mot") return `mot · HSK ${esc(e.niveau)} · ${esc((e.categories || []).map(cat).join(", ") || "sans catégorie dans la liste")} · ${esc(e.id)}`;
  const mots = (e.mots || []).map((m) => `<span class="hz">${esc(m.officiel)}</span> ${esc(m.pinyin)} (${esc(m.categories.map(cat).join(", ") || "—")}, HSK ${esc(m.niveau)})`).join(" ; ");
  return `caractère · HSK ${esc(e.niveau)}${mots ? ` · aussi mot : ${mots}` : " · pas un mot à lui seul"}`;
}
function carte(e) {
  const a = AVIS[e.id] || {};
  const n = aRelire(e);
  const pill = a.decision ? `<span class="pill ${a.decision}">${{ bon: "bon", corrige: "corrigé", a_refaire: "à refaire" }[a.decision]}</span>` : n ? `<span class="pill">${n} à relire</span>` : `<span class="pill bon">relu</span>`;
  const actions = `<div class="actions">
    <button class="bon ${a.decision === "bon" ? "on" : ""}" data-d="bon" data-id="${esc(e.id)}">Bon</button>
    <button class="corriger ${a.decision === "corrige" || ouverts.has(e.id) ? "on" : ""}" data-edit="${esc(e.id)}">Corriger</button>
    <button class="refaire ${a.decision === "a_refaire" ? "on" : ""}" data-d="a_refaire" data-id="${esc(e.id)}">À refaire</button>
  </div>
  <textarea data-note="${esc(e.id)}" placeholder="Note (facultative ; à dire pour « À refaire »)" aria-label="Note">${esc(a.note)}</textarea>`;
  return `<article class="it ${a.decision || ""}" id="e-${esc(e.id)}">
    <div class="tete"><span class="c">${esc(e.hanzi)}</span><div class="t"><span class="py">${esc(e.pinyin)}</span><span class="meta">${meta(e)}</span></div>${pill}</div>
    ${lecture(e)}${n || a.decision ? actions : ""}${ouverts.has(e.id) ? formulaire(e) : ""}</article>`;
}
function formulaire(e) {
  const a = AVIS[e.id];
  const s = a?.decision === "corrige" && a.sens ? a.sens : e.sens || {};
  const ex = a?.decision === "corrige" && a.exemples ? a.exemples : (e.exemples || []).map((x) => ({ zh: x.zh, pinyin: x.pinyin, fr: x.fr }));
  const options = (v) => Object.entries(D.categories).map(([k, l]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(l)}</option>`).join("");
  const accs = (s.acceptions || []).map((x) => `<div class="rang"><select aria-label="Catégorie">${options(x.categorie)}</select><input type="text" class="frin" value="${esc(x.fr)}" aria-label="Acception"><input type="text" value="${esc(x.pinyin || "")}" placeholder="lecture" aria-label="Autre lecture"><button class="petit" data-moins>×</button></div>`).join("");
  const phs = ex.map((x) => `<div class="rang-ph"><input type="text" class="zhin" value="${esc(x.zh)}" aria-label="Phrase"><input type="text" value="${esc(x.pinyin)}" aria-label="Pinyin"><input type="text" value="${esc(x.fr)}" aria-label="Traduction"><button class="petit" data-moins>Retirer la phrase</button></div>`).join("");
  return `<form class="edit" data-form="${esc(e.id)}">
    <label>Glose (${D.glose_max} caractères au plus)<input type="text" name="glose" value="${esc(s.glose)}" maxlength="${D.glose_max}"></label>
    <div class="sur">Acceptions (1 à 3)</div><div data-accs>${accs}</div><button class="petit" type="button" data-plus-acc>Ajouter une acception</button>
    <div class="sur">Phrases (2 au plus ; changer le chinois demande de changer le pinyin)</div><div data-phs>${phs}</div><button class="petit" type="button" data-plus-ph>Ajouter une phrase</button>
    <span class="alerte" data-alerte></span>
    <div class="ligne"><button class="ok" type="submit">Enregistrer la correction</button><button class="petit" type="button" data-fermer>Fermer sans rien changer</button></div>
  </form>`;
}
function rendre() {
  const l = lot();
  $("lot").innerHTML = LOTS.map((x) => { const r = x.entrees.reduce((s, e) => s + (aRelire(e) && !AVIS[e.id] ? 1 : 0), 0); return `<option value="${x.cle}" ${x.cle === vue.lot ? "selected" : ""}>HSK ${esc(x.niveau)} · lot ${esc(x.lot)} · ${x.entrees[0]?.hanzi || ""}… · ${r ? r + " à relire" : "fait"}</option>`; }).join("");
  document.querySelectorAll("[data-f]").forEach((b) => b.classList.toggle("on", b.dataset.f === vue.filtre));
  if (!l) { $("liste").innerHTML = `<p class="vide">Aucun lot rédigé.</p>`; return; }
  const aDecider = l.entrees.filter((e) => aRelire(e));
  const nb = (d) => aDecider.filter((e) => AVIS[e.id]?.decision === d).length;
  const t = aDecider.length || 1;
  $("j-b").style.width = (nb("bon") / t) * 100 + "%"; $("j-c").style.width = (nb("corrige") / t) * 100 + "%"; $("j-r").style.width = (nb("a_refaire") / t) * 100 + "%";
  const reste = aDecider.length - nb("bon") - nb("corrige") - nb("a_refaire");
  $("compte").textContent = `${l.entrees.length} fiches, dont ${aDecider.length} à relire : ${nb("bon")} bonnes, ${nb("corrige")} corrigées, ${nb("a_refaire")} à refaire, ${reste} en attente.`;
  const vis = l.entrees.filter((e) => vue.filtre === "tout" || (vue.filtre === "attente" ? aRelire(e) && !AVIS[e.id] : !!AVIS[e.id]) || ouverts.has(e.id));
  const restants = l.entrees.filter((e) => aRelire(e) && !AVIS[e.id]);
  $("tous").innerHTML = vue.filtre === "attente" && restants.length ? `<button class="tous" id="toutBon">${confirmerTous ? `Confirmer : marquer bonnes les ${restants.length} fiches restantes du lot` : `Tout lu, rien à redire : ${restants.length} fiches bonnes`}</button>` : "";
  $("liste").innerHTML = vis.length ? vis.map(carte).join("") : `<p class="vide">Rien dans ce filtre pour ce lot.</p>`;
  const n = Object.values(AVIS).filter((a) => a && a.decision).length;
  $("retour").textContent = n ? `${n} avis en tout` : "Aucun avis pour l'instant";
}
function retours() {
  const decisions = {};
  for (const [id, a] of Object.entries(AVIS)) if (a && a.decision) decisions[id] = a;
  return JSON.stringify({ format: D.format, page: D.date, decisions }, null, 1);
}
function lireFormulaire(f, e) {
  const glose = f.querySelector("[name=glose]").value.trim();
  const acceptions = [...f.querySelectorAll("[data-accs] .rang")].map((r) => { const [s] = r.querySelectorAll("select"); const i = r.querySelectorAll("input"); const x = { categorie: s.value, fr: i[0].value.trim() }; if (i[1].value.trim()) x.pinyin = i[1].value.trim(); return x; }).filter((x) => x.fr);
  const exemples = [...f.querySelectorAll("[data-phs] .rang-ph")].map((r) => { const i = r.querySelectorAll("input"); return { zh: i[0].value.trim(), pinyin: i[1].value.trim(), fr: i[2].value.trim() }; }).filter((x) => x.zh);
  const fautes = [];
  if (!glose || glose.length > D.glose_max) fautes.push(`glose vide ou de plus de ${D.glose_max} caractères`);
  if (HAN.test(glose)) fautes.push("sinogramme dans la glose");
  if (acceptions.length > 3) fautes.push("trois acceptions au plus");
  const repriseIntacte = e && e.sens && e.sens.provenance && e.sens.provenance.reprise && glose === e.sens.glose;
  if (!acceptions.length && !repriseIntacte) fautes.push("au moins une acception, avec sa catégorie");
  if (exemples.length > 2) fautes.push("deux phrases au plus");
  if (exemples.some((x) => !x.pinyin || !x.fr)) fautes.push("chaque phrase a son pinyin et sa traduction");
  return { glose, acceptions, exemples, fautes };
}
$("lot").addEventListener("change", (ev) => { vue.lot = ev.target.value; confirmerTous = false; garderVue(); rendre(); window.scrollTo(0, 0); });
document.addEventListener("click", (ev) => {
  const f = ev.target.closest("[data-f]");
  if (f) { vue.filtre = f.dataset.f; confirmerTous = false; garderVue(); rendre(); return; }
  const d = ev.target.closest("[data-d]");
  if (d) {
    const id = d.dataset.id, note = document.querySelector(`[data-note="${CSS.escape(id)}"]`)?.value || "";
    AVIS[id] = AVIS[id]?.decision === d.dataset.d ? (note ? { note } : undefined) : { decision: d.dataset.d, note };
    if (!AVIS[id]) delete AVIS[id];
    ouverts.delete(id); garder(); rendre(); return;
  }
  const e = ev.target.closest("[data-edit]");
  if (e) { const id = e.dataset.edit; ouverts.has(id) ? ouverts.delete(id) : ouverts.add(id); rendre(); document.getElementById("e-" + id)?.scrollIntoView({ block: "nearest" }); return; }
  if (ev.target.closest("[data-fermer]")) { ouverts.delete(ev.target.closest("[data-form]").dataset.form); rendre(); return; }
  if (ev.target.closest("[data-moins]")) { ev.preventDefault(); ev.target.closest(".rang, .rang-ph").remove(); return; }
  if (ev.target.closest("[data-plus-acc]")) {
    const box = ev.target.closest("form").querySelector("[data-accs]");
    if (box.children.length >= 3) return;
    box.insertAdjacentHTML("beforeend", `<div class="rang"><select aria-label="Catégorie">${Object.entries(D.categories).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select><input type="text" class="frin" aria-label="Acception"><input type="text" placeholder="lecture" aria-label="Autre lecture"><button class="petit" data-moins>×</button></div>`);
    return;
  }
  if (ev.target.closest("[data-plus-ph]")) {
    const box = ev.target.closest("form").querySelector("[data-phs]");
    if (box.children.length >= 2) return;
    box.insertAdjacentHTML("beforeend", `<div class="rang-ph"><input type="text" class="zhin" aria-label="Phrase"><input type="text" aria-label="Pinyin"><input type="text" aria-label="Traduction"><button class="petit" data-moins>Retirer la phrase</button></div>`);
    return;
  }
  if (ev.target.id === "toutBon") {
    if (!confirmerTous) { confirmerTous = true; rendre(); return; }
    for (const e2 of lot().entrees) if (aRelire(e2) && !AVIS[e2.id]) AVIS[e2.id] = { decision: "bon", note: "" };
    confirmerTous = false; garder(); rendre(); return;
  }
  if (ev.target.id === "copier" || ev.target.id === "selection") {
    const t = $("sortie"); t.value = retours(); t.hidden = false; t.focus(); t.select();
    if (ev.target.id === "copier") {
      const n = Object.keys(JSON.parse(t.value).decisions).length;
      navigator.clipboard?.writeText(t.value).then(() => { $("retour").textContent = `${n} avis copiés.`; }, () => { $("retour").textContent = "Copie refusée : le texte est sélectionné, copie-le à la main."; });
      if (!navigator.clipboard) $("retour").textContent = "Copie indisponible : le texte est sélectionné, copie-le à la main.";
    }
  }
});
document.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const f = ev.target.closest("[data-form]"); if (!f) return;
  const id = f.dataset.form, lu = lireFormulaire(f, LOTS.flatMap((l) => l.entrees).find((x) => x.id === id));
  if (lu.fautes.length) { f.querySelector("[data-alerte]").textContent = lu.fautes.join(" ; ") + "."; return; }
  const note = document.querySelector(`[data-note="${CSS.escape(id)}"]`)?.value || "";
  AVIS[id] = { decision: "corrige", note, sens: { glose: lu.glose, acceptions: lu.acceptions }, exemples: lu.exemples };
  ouverts.delete(id); garder(); rendre();
});
document.addEventListener("change", (ev) => {
  const t = ev.target.closest("[data-note]"); if (!t) return;
  const id = t.dataset.note;
  if (AVIS[id]) AVIS[id].note = t.value; else if (t.value) AVIS[id] = { note: t.value };
  garder(); rendre();
});
$("sur").textContent = `Wenlu 文路 · dictionnaire · page du ${D.date}`;
rendre();
</script>
"""
