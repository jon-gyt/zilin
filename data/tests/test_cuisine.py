"""La cuisine de Tao (story 4b.6) : sources, export, contrôles.

Un test par règle. Aucun réseau. Les règles : dix recettes, trois gratuites en tête ;
chaque ingrédient écrit dans une étape et sur l'étal ; des leurres distincts, jamais la
bonne réponse, jamais un autre ingrédient de la recette, jamais du même sens ; une
question note les caractères que le premier leurre n'a pas ; chaque texte se lit dans
son pinyin ; chaque caractère est posé par un parcours, et les plats gratuits se
cuisinent dans chacun ; une recette n'est jouable qu'une fois ses caractères acquis,
et l'export les liste.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import cuisine as cuisine_mod
from wenlu_data import export as export_mod
from wenlu_data.cli import app as cli
from wenlu_data.cuisine import (
    GRATUITS,
    OBJECTIF,
    Cuisine,
    Ingredient,
    caracteres_de,
    charger,
    controles,
    document,
    fautes_export,
    fautes_parcours,
    fautes_pinyin,
    fautes_sources,
    hanzi,
    jour_possible,
    jours_par_parcours,
    notes,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée

#: Une petite cuisine, écrite dans un dossier de test : trois plats gratuits et un autre.
RECETTES = """id\tgratuit\tzh\tpinyin\tfr\ten\tsource
mifan\toui\t米饭\tmǐfàn\tle riz\trice\tx
mian\toui\t面\tmiàn\tles nouilles\tnoodles\tx
niurou\toui\t牛肉面\tniúròumiàn\tnouilles au bœuf\tbeef noodles\tx
cha\tnon\t茶\tchá\tle thé\ttea\tx
"""
ETAPES = """recette\tzh\tpinyin\tfr\ten
mifan\t水里下米。\tShuǐ lǐ xià mǐ.\tLe riz dans l'eau.\tRice in water.
mifan\t米饭好了！\tMǐfàn hǎo le!\tPrêt !\tReady!
mian\t水开了，下面。\tShuǐ kāi le, xià miàn.\tL'eau bout.\tBoiling.
mian\t面好了！\tMiàn hǎo le!\tPrêt !\tReady!
niurou\t牛肉下水。\tNiúròu xià shuǐ.\tLe bœuf dans l'eau.\tBeef in water.
niurou\t再下面。\tZài xià miàn.\tPuis les nouilles.\tThen noodles.
cha\t水开了，下茶。\tShuǐ kāi le, xià chá.\tL'eau bout.\tBoiling.
cha\t茶好了！\tChá hǎo le!\tPrêt !\tReady!
"""
INGREDIENTS = """recette\tzh\tfr\ten\tleurres
mifan\t米\tdu riz\trice\t面 米酒
mifan\t水\tde l'eau\twater\t酒 茶
mian\t面\tdes nouilles\tnoodles\t米 米酒
mian\t水\tde l'eau\twater\t酒 茶
niurou\t牛肉\tdu bœuf\tbeef\t牛奶 米酒
niurou\t面\tdes nouilles\tnoodles\t米 牛奶
cha\t茶\tdu thé\ttea\t菜 酒
cha\t水\tde l'eau\twater\t酒 米酒
"""
ETAL = """zh\tpinyin\tfr\ten\tsource
米\tmǐ\tdu riz\trice\tx
米酒\tmǐjiǔ\tdu vin de riz\trice wine\tx
面\tmiàn\tdes nouilles\tnoodles\tx
水\tshuǐ\tde l'eau\twater\tx
酒\tjiǔ\tde l'alcool\talcohol\tx
茶\tchá\tdu thé\ttea\tx
菜\tcài\tdes légumes\tvegetables\tx
牛肉\tniúròu\tdu bœuf\tbeef\tx
牛奶\tniúnǎi\tdu lait\tmilk\tx
"""
TAO = """cle\tzh\tpinyin\tfr\ten\tsource
lit\t我来看看！\tWǒ lái kànkan!\tVoyons !\tLet me see!\tx
bon\t好吃！\tHǎochī!\tC'est bon !\tDelicious!\tx
grimace\t再来一个吧！\tZài lái yī gè ba!\tOn en refait un ?\tAnother one?\tx
"""

#: Les lectures du petit monde, comme `lectures()` les rendrait.
LECTURES = {
    "米": ["mǐ"], "饭": ["fàn"], "面": ["miàn"], "牛": ["niú"], "肉": ["ròu"], "茶": ["chá"],
    "水": ["shuǐ"], "里": ["lǐ"], "下": ["xià"], "好": ["hǎo"], "了": ["le", "liǎo"],
    "开": ["kāi"], "再": ["zài"], "酒": ["jiǔ"], "菜": ["cài"], "奶": ["nǎi"], "我": ["wǒ"],
    "来": ["lái"], "看": ["kàn"], "吃": ["chī"], "一": ["yī"], "个": ["gè"], "吧": ["ba"],
}

#: Deux parcours : `lire` pose tout sauf 牛 ; `hsk` pose tout.
TOUS = sorted(LECTURES)
PARCOURS = {
    "hsk": {"jours": [{"jour": k + 1, "brique": c, "composes": []} for k, c in enumerate(TOUS)]},
    "lire": {
        "jours": [{"jour": k + 1, "brique": c, "composes": []} for k, c in enumerate(x for x in TOUS if x != "牛")]
    },
}


@pytest.fixture
def dossier(tmp_path: Path) -> Path:
    d = tmp_path / "cuisine"
    d.mkdir()
    for nom, texte in (
        ("recettes.tsv", RECETTES),
        ("etapes.tsv", ETAPES),
        ("ingredients.tsv", INGREDIENTS),
        ("etal.tsv", ETAL),
        ("tao.tsv", TAO),
    ):
        (d / nom).write_text(texte, encoding="utf-8")
    return d


def ingredient(zh: str = "牛肉", leurres: tuple[str, ...] = ("牛奶", "鸡肉")) -> Ingredient:
    return Ingredient(recette="r", zh=zh, fr="du bœuf", en="beef", leurres=leurres)


def avec_ingredients(c: Cuisine, *ingredients: Ingredient) -> Cuisine:
    return replace(c, ingredients=tuple(ingredients))


# -------------------------------------------------------------------- les sources


def test_les_sources_versionnees_sont_propres() -> None:
    c = charger()
    assert fautes_sources(c) == []
    assert len(c.recettes) == OBJECTIF
    gratuits = [r.id for r in c.recettes if r.gratuit == "oui"]
    assert gratuits == [r.id for r in c.recettes[:GRATUITS]]


def test_le_petit_monde_est_propre(dossier: Path) -> None:
    c = charger(dossier)
    assert fautes_sources(c) == []
    assert [e.texte.zh for e in c.etapes_de("mifan")] == ["水里下米。", "米饭好了！"]


def test_trois_plats_gratuits_en_tete(dossier: Path) -> None:
    c = charger(dossier)
    quatre = replace(c, recettes=tuple(replace(r, gratuit="oui") for r in c.recettes))
    assert any("4 plats gratuits" in f for f in fautes_sources(quatre))
    renverse = replace(c, recettes=tuple(reversed(c.recettes)))
    assert any("trois premiers" in f for f in fautes_sources(renverse))


def test_un_leurre_ne_vaut_jamais_la_bonne_reponse(dossier: Path) -> None:
    c = charger(dossier)
    faux = replace(c.ingredients[0], leurres=("米", "面"))
    fautes = fautes_sources(avec_ingredients(c, faux, *c.ingredients[1:]))
    assert any("est la bonne réponse" in f for f in fautes)


def test_un_leurre_n_est_jamais_un_autre_ingredient_de_la_recette(dossier: Path) -> None:
    c = charger(dossier)
    faux = replace(c.ingredients[0], leurres=("水", "面"))  # 水 est l'autre ingrédient du riz
    fautes = fautes_sources(avec_ingredients(c, faux, *c.ingredients[1:]))
    assert any("autre ingrédient" in f for f in fautes)


def test_un_leurre_est_sur_l_etal_et_n_a_pas_le_meme_sens(dossier: Path) -> None:
    c = charger(dossier)
    absent = replace(c.ingredients[0], leurres=("面", "饭"))
    assert any("pas sur l'étal" in f for f in fautes_sources(avec_ingredients(c, absent, *c.ingredients[1:])))
    etal = tuple(
        replace(m, texte=replace(m.texte, fr="du riz")) if m.texte.zh == "米酒" else m for m in c.etal
    )
    assert any("même sens" in f for f in fautes_sources(replace(c, etal=etal)))


def test_deux_ou_trois_leurres_distincts(dossier: Path) -> None:
    c = charger(dossier)
    seul = replace(c.ingredients[0], leurres=("面",))
    double = replace(c.ingredients[0], leurres=("面", "面"))
    assert any("1 leurres" in f for f in fautes_sources(avec_ingredients(c, seul, *c.ingredients[1:])))
    assert any("deux fois le même leurre" in f for f in fautes_sources(avec_ingredients(c, double, *c.ingredients[1:])))


def test_chaque_ingredient_est_ecrit_dans_une_etape(dossier: Path) -> None:
    c = charger(dossier)
    etranger = replace(c.ingredients[0], zh="茶", leurres=("菜", "酒"))
    fautes = fautes_sources(avec_ingredients(c, etranger, *c.ingredients[1:]))
    assert any("n'est écrit dans aucune étape" in f for f in fautes)


def test_tao_dit_ses_trois_repliques(dossier: Path) -> None:
    c = charger(dossier)
    fautes = fautes_sources(replace(c, tao=tuple(t for t in c.tao if t.cle != "grimace")))
    assert any("grimace" in f for f in fautes)


# ------------------------------------------------------------- ce qui se note


def test_une_question_note_ce_que_le_premier_leurre_n_a_pas() -> None:
    """牛肉 contre 牛奶 : l'erreur se lit sur 肉, pas sur 牛."""
    assert notes(ingredient()) == ["肉"]
    assert notes(ingredient("米饭", ("米酒",))) == ["饭"]
    assert notes(ingredient("米", ("面",))) == ["米"]


def test_un_premier_leurre_qui_contient_toute_la_reponse_est_une_faute(dossier: Path) -> None:
    c = charger(dossier)
    assert notes(ingredient("米", ("米酒", "面"))) == []
    faux = replace(c.ingredients[0], leurres=("米酒", "面"))
    assert any("aucun caractère" in f for f in fautes_sources(avec_ingredients(c, faux, *c.ingredients[1:])))


def test_une_recette_se_lit_avec_son_nom_ses_etapes_et_ses_ingredients(dossier: Path) -> None:
    """Les leurres n'en sont pas : ils se lisent pour être écartés."""
    c = charger(dossier)
    r = next(x for x in c.recettes if x.id == "niurou")
    assert caracteres_de(r, c) == ["牛", "肉", "面", "下", "水", "再"]
    assert "奶" not in caracteres_de(r, c)


def test_hanzi_saute_la_ponctuation() -> None:
    assert hanzi("水开了，下面。") == ["水", "开", "了", "下", "面"]


# ---------------------------------------------------------------------- pinyin


def test_chaque_texte_se_lit_dans_son_pinyin(dossier: Path) -> None:
    c = charger(dossier)
    assert fautes_pinyin(c, LECTURES) == []
    faux = replace(c.etapes[0], texte=replace(c.etapes[0].texte, pinyin="Shuǐ lǐ xià miàn."))
    fautes = fautes_pinyin(replace(c, etapes=(faux, *c.etapes[1:])), LECTURES)
    assert len(fautes) == 1 and "水里下米" in fautes[0]


# -------------------------------------------------------------------- parcours


def test_le_jour_d_une_recette_est_celui_de_son_dernier_caractere() -> None:
    jours = jours_par_parcours(PARCOURS)
    assert jour_possible(["米", "饭"], jours["hsk"]) == max(jours["hsk"]["米"], jours["hsk"]["饭"])
    assert jour_possible(["牛", "肉"], jours["lire"]) is None
    assert jour_possible([], jours["lire"]) is None


def test_un_plat_gratuit_se_cuisine_dans_chaque_parcours(dossier: Path) -> None:
    """牛肉面 est gratuit dans le petit monde, mais `lire` ne pose pas 牛."""
    c = charger(dossier)
    fautes = fautes_parcours(c, PARCOURS)
    assert fautes == ["niurou (gratuit) : 牛 hors du parcours lire"]


def test_un_caractere_hors_parcours_est_une_faute(dossier: Path) -> None:
    c = charger(dossier)
    sans_the = {nom: {"jours": [j for j in d["jours"] if j["brique"] != "茶"]} for nom, d in PARCOURS.items()}
    assert "茶 hors parcours" in fautes_parcours(c, sans_the)


# ---------------------------------------------------------------------- export


def test_le_document_dit_ce_qu_il_faut_acquerir_et_quand(dossier: Path) -> None:
    doc = document("0.9.0", parcours=PARCOURS, racines={"米": "米"}, en_tete={"version": "0.9.0"}, dossier=dossier)
    assert doc["version"] == "0.9.0"
    recettes = {r["id"]: r for r in doc["recettes"]}  # type: ignore[union-attr]
    assert [r["id"] for r in doc["recettes"]] == ["mifan", "mian", "niurou", "cha"]  # type: ignore[union-attr]
    niurou = recettes["niurou"]
    assert niurou["gratuit"] is True and recettes["cha"]["gratuit"] is False
    assert niurou["jours"]["lire"] is None and niurou["jours"]["hsk"] is not None
    boeuf = niurou["ingredients"][0]
    assert boeuf == {
        "zh": "牛肉",
        "pinyin": "niúròu",
        "fr": "du bœuf",
        "en": "beef",
        "leurres": ["牛奶", "米酒"],
        "notes": ["肉"],
    }
    assert doc["etal"]["牛奶"] == {"pinyin": "niúnǎi", "fr": "du lait", "en": "milk"}  # type: ignore[index]
    assert set(doc["tao"]) == {"lit", "bon", "grimace"}  # type: ignore[arg-type]
    assert doc["racines"] == {"米": "米"}


def test_l_export_se_controle_contre_les_sources(dossier: Path) -> None:
    c = charger(dossier)
    doc = document("0.9.0", parcours=PARCOURS, racines={}, dossier=dossier)
    sorties = list(doc["recettes"])  # type: ignore[call-overload]
    assert fautes_export(sorties, c) == []
    mauvaise = json.loads(json.dumps(sorties))
    mauvaise[0]["ingredients"][0]["leurres"].append("米")
    mauvaise[1]["caracteres"] = ["面"]
    fautes = fautes_export(mauvaise[:-1], c)
    assert any("est la bonne réponse" in f for f in fautes)
    assert any("incomplets" in f for f in fautes)
    assert any("non exportées : cha" in f for f in fautes)


def test_l_export_ecrit_cuisine_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "cuisine.json" in rapport.fichiers
    doc = lire(rapport.dossier, "cuisine.json")
    assert export_mod.fautes_de_licence("cuisine.json", doc) == []
    assert lire(rapport.dossier, "index.json")["cuisine"] == "cuisine.json"


def test_changer_une_recette_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "etapes.tsv"
    copie.write_text(cuisine_mod.ETAPES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(cuisine_mod, "ETAPES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(not (VERSIONNE / "cuisine.json").exists(), reason="cuisine.json pas encore exporté")


@versionne
def test_l_export_versionne_passe_les_controles_de_la_cuisine(tmp_path: Path) -> None:
    """Sans build ni ingest (la CI n'en a pas), le pinyin et les parcours ne se lisent pas ; le reste si."""
    resultats = controles(build=tmp_path / "sans-build", ingest=tmp_path / "sans-ingest")
    assert [c.nom for c in resultats if not c.ok] == []


@versionne
def test_l_export_versionne_porte_le_piege_du_brief() -> None:
    """牛奶 pour 牛肉 (brief §9, docs/jeux.md) : l'erreur type du bœuf, qui note 肉."""
    doc = json.loads((VERSIONNE / "cuisine.json").read_text(encoding="utf-8"))
    assert len(doc["recettes"]) == OBJECTIF
    boeufs = [i for r in doc["recettes"] for i in r["ingredients"] if i["zh"] == "牛肉"]
    assert boeufs and all(i["leurres"][0] == "牛奶" and i["notes"] == ["肉"] for i in boeufs)
    for r in doc["recettes"]:
        for c in r["caracteres"]:
            assert c in doc["racines"], c
    assert sum(1 for r in doc["recettes"] if r["gratuit"]) == GRATUITS


@versionne
def test_la_commande_apercu_liste_les_recettes() -> None:
    resultat = CliRunner().invoke(cli, ["cuisine", "apercu"])
    assert resultat.exit_code == 0, resultat.output
    assert "牛肉面" in resultat.output and "10 recettes." in resultat.output
