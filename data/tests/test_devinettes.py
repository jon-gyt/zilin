"""Les devinettes de lanternes (story 4b.5) : sources, leurres, export, contrôles.

Un test par règle. Aucun réseau. Les règles : un énoncé dit exactement la
décomposition exportée et sa disposition ; trois leurres distincts, choisis par
ressemblance de composants comme dans l'app, jamais la réponse, jamais une brique
citée, jamais un caractère qui porterait toutes les briques ; tout ce qui se
dessine a ses traits ; l'export ne fait entrer aucun caractère dans le périmètre.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import devinettes as devinettes_mod
from wenlu_data import export as export_mod
from wenlu_data.cli import app as cli
from wenlu_data.devinettes import (
    LEURRES,
    Devinette,
    charger,
    charger_noms,
    controles,
    document,
    fautes_decomposition,
    fautes_leurres,
    fautes_sources,
    leurres,
    porte_tout,
    ressemblance,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée

#: Un petit monde : des décompositions GF 0014-2009, telles que le build les donne.
DECOMPOSITIONS = {
    "休": ["亻", "木"],
    "体": ["亻", "本"],
    "你": ["亻", "⺈", "小"],
    "们": ["亻", "门"],
    "林": ["木", "木"],
    "李": ["木", "子"],
    "机": ["木", "几"],
    "好": ["女", "子"],
    "明": ["日", "月"],
    "朋": ["月", "月"],
    "天": ["天"],
    "夫": ["夫"],
    "本": ["本"],
}
STRUCTURES = {"休": "⿰亻木", "体": "⿰亻本", "们": "⿰亻门", "林": "⿰木木", "李": "⿱木子", "机": "⿰木几"}


def devinette(c: str = "休", **champs: object) -> Devinette:
    valeurs: dict[str, object] = {
        "c": c,
        "disposition": "cote",
        "briques": ("亻", "木"),
        "enonce": "Un homme adossé à un arbre",
        "zh": "",
        "sens": "se reposer",
        "source": "rédigé pour l'app",
        "numero": 1,
    }
    valeurs.update(champs)
    return Devinette(**valeurs)  # type: ignore[arg-type]


# ------------------------------------------------------------------- ressemblance


def test_la_ressemblance_est_celle_de_l_app() -> None:
    """Jaccard sur les composants, 0,25 à nombre égal, 2 pour une paire (`questions.ts`)."""
    assert ressemblance("体", "休", DECOMPOSITIONS) == pytest.approx(1 / 3 + 0.25)
    assert ressemblance("你", "休", DECOMPOSITIONS) == pytest.approx(1 / 4)
    assert ressemblance("天", "夫", DECOMPOSITIONS) == pytest.approx(0.25)
    assert ressemblance("天", "夫", DECOMPOSITIONS, [["天", "夫"]]) == pytest.approx(2.25)
    # Une brique sans décomposition est sa propre brique.
    assert ressemblance("本", "本", DECOMPOSITIONS) == pytest.approx(1.25)


def test_porter_toutes_les_briques_compte_les_doublons() -> None:
    assert porte_tout("林", ["木"], DECOMPOSITIONS)
    assert not porte_tout("李", ["木", "木"], DECOMPOSITIONS)
    assert porte_tout("林", ["木", "木"], DECOMPOSITIONS)


# ------------------------------------------------------------------------ leurres


def test_trois_leurres_distincts_jamais_la_reponse_ni_une_brique() -> None:
    candidats = [*DECOMPOSITIONS, "亻", "木"]
    choisis = leurres("休", ["亻", "木"], candidats, DECOMPOSITIONS, structures=STRUCTURES)
    assert len(choisis) == LEURRES == len(set(choisis))
    assert "休" not in choisis
    assert not {"亻", "木"} & set(choisis)


def test_chaque_brique_citee_a_son_leurre() -> None:
    """Un leurre porte l'homme, un autre l'arbre : la devinette se lit brique par brique."""
    choisis = leurres("休", ["亻", "木"], list(DECOMPOSITIONS), DECOMPOSITIONS, structures=STRUCTURES)
    assert any("亻" in DECOMPOSITIONS[x] for x in choisis)
    assert any("木" in DECOMPOSITIONS[x] for x in choisis)


def test_un_caractere_qui_porte_toutes_les_briques_n_est_jamais_un_leurre() -> None:
    """林 porte deux arbres : pour « deux arbres », ce serait une seconde réponse."""
    monde = {**DECOMPOSITIONS, "森": ["木", "木", "木"]}
    choisis = leurres("林", ["木", "木"], list(monde), monde)
    assert "森" not in choisis


def test_les_leurres_sont_les_memes_d_un_passage_a_l_autre() -> None:
    a = leurres("明", ["日", "月"], list(DECOMPOSITIONS), DECOMPOSITIONS)
    b = leurres("明", ["日", "月"], list(reversed(DECOMPOSITIONS)), DECOMPOSITIONS)
    assert a == b


def test_a_ressemblance_egale_la_meme_disposition_passe_devant() -> None:
    """Pour 休 (côte à côte), 机 et 李 portent tous deux l'arbre : 机 est côte à côte aussi."""
    choisis = leurres("休", ["亻", "木"], ["李", "机"], DECOMPOSITIONS, n=1, structures=STRUCTURES)
    assert choisis == ["机"]


# ------------------------------------------------------------------------ sources


def test_les_sources_versionnees_sont_propres_et_couvrent_l_objectif_minimal() -> None:
    lues = charger()
    assert len(lues) >= 60
    assert fautes_sources(lues, charger_noms()) == []


def test_chaque_devinette_a_une_reponse_unique() -> None:
    lues = charger()
    assert len({d.c for d in lues}) == len(lues)


def test_une_brique_sans_nom_ou_une_disposition_inconnue_est_une_faute() -> None:
    fautes = fautes_sources(
        [devinette(disposition="dessous"), devinette(c="休", briques=("亻", "木"))],
        {"亻": "un homme"},
    )
    texte = " ".join(fautes)
    assert "disposition inconnue" in texte
    assert "cite 木, sans nom" in texte
    assert "a déjà une devinette" in texte


def test_un_enonce_vide_ou_sans_source_est_une_faute() -> None:
    fautes = fautes_sources([devinette(enonce="", source="")], {"亻": "x", "木": "y"})
    assert any("sans enonce_fr" in f for f in fautes)
    assert any("sans source" in f for f in fautes)


def test_l_enonce_chinois_n_est_donne_que_s_il_existe() -> None:
    """Colonne vide, pas de texte inventé : peu de devinettes ont un 字谜 traditionnel."""
    lues = charger()
    avec = [d for d in lues if d.zh]
    assert 0 < len(avec) < len(lues)
    for d in avec:
        assert "字谜" in d.source


# ---------------------------------------------------------------- décomposition


def test_l_enonce_doit_citer_les_briques_exportees() -> None:
    parts = {"休": ["亻", "木"]}
    assert fautes_decomposition([devinette()], parts, {"休": "⿰亻木"}) == []
    fautes = fautes_decomposition([devinette(briques=("人", "木"))], parts, {})
    assert fautes and "l'export dit 亻 木" in fautes[0]


def test_la_disposition_doit_etre_celle_de_la_structure() -> None:
    fautes = fautes_decomposition([devinette(disposition="superpose")], {"休": ["亻", "木"]}, {"休": "⿰亻木"})
    assert fautes and "dit cote" in fautes[0]


def test_une_reponse_sans_decomposition_exportee_est_une_faute() -> None:
    assert fautes_decomposition([devinette(c="木")], {"木": []}, {})


# ------------------------------------------------------------------ leurres exportés


def test_un_leurre_en_double_la_reponse_ou_une_seconde_reponse_sont_des_fautes() -> None:
    sortie = {"c": "林", "briques": ["木", "木"], "leurres": ["林", "森", "森"]}
    fautes = " ".join(fautes_leurres([sortie], {"森": ["木", "木", "木"]}))
    assert "en double" in fautes
    assert "la réponse est parmi les leurres" in fautes
    assert "森 porte toutes les briques" in fautes


# ------------------------------------------------------------------------- export


def test_le_document_ne_sort_que_des_devinettes_dessinables(tmp_path: Path) -> None:
    source = tmp_path / "devinettes.tsv"
    source.write_text(
        "\t".join(devinettes_mod.COLONNES)
        + "\n休\tcote\t亻 木\tUn homme adossé à un arbre\t\tse reposer\trédigé pour l'app\n"
        + "好\tcote\t女 子\tUne femme et un enfant\t\tbien\trédigé pour l'app\n",
        encoding="utf-8",
    )
    noms = tmp_path / "briques.tsv"
    noms.write_text("brique\tnom\tsource\n亻\tun homme\tx\n木\tun arbre\tx\n", encoding="utf-8")
    dessinables = ["休", "亻", "木", "体", "们", "李", "机", "林"]
    doc = document(
        "0.9.0",
        caracteres=dessinables,
        candidats=dessinables,
        decompositions=DECOMPOSITIONS,
        pinyin={"休": "xiū"},
        racines={c: "木" for c in dessinables},
        structures=STRUCTURES,
        en_tete={"version": "0.9.0"},
        source=source,
        noms=noms,
    )
    assert doc["version"] == "0.9.0"
    (seule,) = doc["devinettes"]  # 好 sort : ni 女 ni 子 ne se dessinent
    assert seule["c"] == "休" and seule["pinyin"] == "xiū" and seule["zh"] is None
    assert doc["noms"] == {"亻": "un homme", "木": "un arbre"}
    assert set(doc["racines"]) == {"休", "亻", "木", *seule["leurres"]}


def test_l_export_ecrit_devinettes_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    dossier = rapport.dossier
    assert "devinettes.json" in rapport.fichiers
    doc = lire(dossier, "devinettes.json")
    assert export_mod.fautes_de_licence("devinettes.json", doc) == []
    assert lire(dossier, "index.json")["devinettes"] == "devinettes.json"


def test_changer_une_devinette_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "devinettes.tsv"
    copie.write_text(devinettes_mod.DEVINETTES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(devinettes_mod, "DEVINETTES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(
    not (VERSIONNE / "devinettes.json").exists(), reason="devinettes.json pas encore exporté"
)


@versionne
def test_l_export_versionne_passe_les_controles_des_devinettes(tmp_path: Path) -> None:
    """Sans build (la CI n'en a pas), la disposition et les parcours ne se lisent pas ; le reste si."""
    resultats = controles(build=tmp_path / "sans-build")
    assert [c.nom for c in resultats if not c.ok] == []


@versionne
def test_l_export_versionne_nomme_chaque_brique_et_trouve_chaque_racine() -> None:
    doc = json.loads((VERSIONNE / "devinettes.json").read_text(encoding="utf-8"))
    assert len(doc["devinettes"]) >= 60
    for d in doc["devinettes"]:
        for b in d["briques"]:
            assert doc["noms"][b]
        for x in [d["c"], *d["briques"], *d["leurres"]]:
            assert x in doc["racines"], x
        assert d["pinyin"]


@versionne
def test_l_exemple_du_prototype_est_dans_la_base() -> None:
    """休 = 亻 + 木, l'écran validé ; 明 et 告 portent leur 字谜 traditionnel."""
    doc = json.loads((VERSIONNE / "devinettes.json").read_text(encoding="utf-8"))
    par_c = {d["c"]: d for d in doc["devinettes"]}
    assert par_c["休"]["briques"] == ["亻", "木"]
    assert par_c["明"]["zh"] == "一月一日非今天"
    assert par_c["告"]["zh"] == "一口咬掉牛尾巴"


# ------------------------------------------------------------------------ commande


@versionne
def test_la_commande_apercu_liste_les_devinettes() -> None:
    resultat = CliRunner().invoke(cli, ["devinettes", "apercu"])
    assert resultat.exit_code == 0, resultat.output
    assert "休\t亻 + 木" in resultat.output
