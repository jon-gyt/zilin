"""Les fuites de réponse : rien, avant la réponse, ne la souffle (retour du 29 septembre 2026).

Un test par règle. Aucun réseau. Les règles : le sens d'une fiche ne cite pas son
caractère ; l'énoncé d'une devinette ne cite ni la réponse, ni son pinyin, ni son sens ;
les sens de l'éclair, montrés sans parenthèses, restent distincts et sans caractère ; le
titre d'un dialogue WeChat ne donne pas de réplique ; ce que Tao demande en cuisine et sa
bulle de l'écran Jouer ne citent aucun caractère. Chaque règle bloque `wenlu check`.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data.fuites import (
    contient_suite,
    controles,
    fautes_cuisine,
    fautes_devinettes,
    fautes_eclair,
    fautes_fiches,
    fautes_tao,
    fautes_wechat,
    sans_parentheses,
    segments_du_sens,
)


# ------------------------------------------------------------------------- outils


def test_un_sens_se_compare_sans_article_et_sans_parentheses() -> None:
    assert segments_du_sens("la terre, le sol") == [("terre",), ("sol",)]
    assert segments_du_sens("il, lui") == [("il",), ("lui",)]
    assert segments_du_sens("quoi (suivi de 么)") == [("quoi",)]
    assert contient_suite("La terre, elle aussi", ("terre",))
    assert not contient_suite("Un homme à côté de dix", ("quoi",))


def test_les_parentheses_tombent_comme_dans_l_app() -> None:
    """`questions.sensDuChoix` dans l'app : même retrait, même résultat."""
    assert sans_parentheses("but (au football)") == "but"
    assert sans_parentheses("ans (âge), année") == "ans, année"
    assert sans_parentheses("(seul)") == "(seul)"


# ------------------------------------------------------------------------- fiches


def test_le_sens_d_une_fiche_ne_cite_pas_son_caractere() -> None:
    """« Lequel se lit shén et veut dire « quoi (dans 什么) » ? » donnait 什 dans l'énoncé."""
    assert fautes_fiches([{"c": "什", "fr": "quoi (dans 什么)"}]) != []
    assert fautes_fiches([{"c": "什", "fr": "quoi (suivi de 么)"}]) == []


# --------------------------------------------------------------------- devinettes


def devinette(**champs: object) -> dict[str, object]:
    d: dict[str, object] = {"c": "她", "pinyin": "tā", "sens": "elle", "enonce": "Une femme, et puis aussi", "zh": None}
    d.update(champs)
    return d


def test_l_enonce_d_une_devinette_ne_dit_pas_le_sens_de_la_reponse() -> None:
    """« Une femme, elle aussi » : qui lit « elle » prend 她 sans rien décomposer."""
    assert fautes_devinettes([devinette()]) == []
    assert any("dit son sens" in f for f in fautes_devinettes([devinette(enonce="Une femme, elle aussi")]))
    terre = devinette(c="地", pinyin="dì", sens="la terre, le sol", enonce="La terre, elle aussi")
    assert any("« terre »" in f for f in fautes_devinettes([terre]))


def test_l_enonce_d_une_devinette_ne_cite_ni_la_reponse_ni_son_pinyin() -> None:
    assert any("cite la réponse" in f for f in fautes_devinettes([devinette(enonce="Une femme : 她")]))
    assert any("cite la réponse" in f for f in fautes_devinettes([devinette(zh="她也")]))
    ming = devinette(c="明", pinyin="míng", sens="clair", enonce="Ming : le soleil et la lune")
    assert any("pinyin" in f for f in fautes_devinettes([ming]))
    # Un pinyin qui est aussi un petit mot français (« de », « le ») ne compte pas.
    de = devinette(c="的", pinyin="de", sens="particule", enonce="Le blanc à côté de la cuillère")
    assert fautes_devinettes([de]) == []


# ------------------------------------------------------------------------- éclair


def test_les_sens_de_l_eclair_restent_distincts_sans_parentheses() -> None:
    mots = [
        {"id": "球门", "mot": "球门", "fr": "but (au football)", "leurres": ["目的"]},
        {"id": "目的", "mot": "目的", "fr": "but (visé)", "leurres": ["球门"]},
    ]
    assert any("se confondent" in f for f in fautes_eclair(mots))
    mots[1]["fr"] = "objectif"
    assert fautes_eclair(mots) == []


def test_aucun_sens_de_l_eclair_ne_cite_un_caractere() -> None:
    mots = [{"id": "火车", "mot": "火车", "fr": "le 车 du feu", "leurres": []}]
    assert any("cite un caractère" in f for f in fautes_eclair(mots))


# ------------------------------------------------------------------------- WeChat


def dialogue(titre: str) -> dict[str, object]:
    return {
        "id": "nihao",
        "fr": titre,
        "echanges": [
            {
                "ami": {"fr": "Tu rentres demain ?"},
                "repliques": [
                    {"fr": "Non, je rentre après-demain.", "juste": True},
                    {"fr": "Non, je rentre demain.", "juste": False},
                    {"fr": "J'ai trois tasses.", "juste": False},
                ],
            }
        ],
    }


def test_le_titre_d_un_dialogue_ne_donne_pas_la_replique() -> None:
    """« Retour après-demain » départageait « après-demain » de « demain » avant toute lecture."""
    assert any("après-demain" in f for f in fautes_wechat([dialogue("Retour après-demain")]))
    assert fautes_wechat([dialogue("Un retour")]) == []


def test_ce_que_l_ami_a_deja_dit_ne_fuit_pas() -> None:
    """« demain » est dans le message de l'ami : le titre le répète sans rien donner."""
    assert fautes_wechat([dialogue("Demain ?")]) == []


# ------------------------------------------------------------------ cuisine et Tao


def test_ce_que_tao_demande_en_cuisine_ne_cite_aucun_caractere() -> None:
    recette = {"id": "mifan", "ingredients": [{"fr": "du riz (米)"}]}
    assert fautes_cuisine([recette]) != []
    recette["ingredients"] = [{"fr": "du riz"}]
    assert fautes_cuisine([recette]) == []


def test_la_bulle_de_tao_ne_cite_aucun_caractere() -> None:
    assert fautes_tao({"invite": "On joue à 拼 ?"}) != []
    assert fautes_tao({"invite": "On joue à celui-ci ?"}) == []


# ----------------------------------------------------------------------- contrôles


def test_chaque_fuite_bloque_wenlu_check(tmp_path: Path) -> None:
    dossier = tmp_path / "0.9.0"
    (dossier / "familles").mkdir(parents=True)
    (dossier / "index.json").write_text("{}", encoding="utf-8")
    (dossier / "familles" / "亻.json").write_text(
        json.dumps({"fiches": [{"c": "什", "fr": "quoi (dans 什么)"}]}, ensure_ascii=False), encoding="utf-8"
    )
    (dossier / "devinettes.json").write_text(
        json.dumps({"devinettes": [devinette(enonce="Une femme, elle aussi")]}, ensure_ascii=False),
        encoding="utf-8",
    )
    (dossier / "wechat.json").write_text(
        json.dumps({"dialogues": [dialogue("Retour après-demain")]}, ensure_ascii=False), encoding="utf-8"
    )
    resultats = {c.nom: c for c in controles(tmp_path)}
    for nom in ("fuites : fiches", "fuites : devinettes", "fuites : WeChat"):
        assert not resultats[nom].ok and resultats[nom].bloquant, nom
    assert resultats["fuites : éclair"].ok


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "index.json").exists(), reason="export pas encore écrit")
def test_l_export_versionne_ne_souffle_aucune_reponse() -> None:
    assert [c.detail for c in controles() if not c.ok] == []
