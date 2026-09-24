"""Les messages de la coquille (story 4b.3) : sources, export, contrôles.

Un test par règle. Aucun réseau. Les règles : un message compte de 6 à 12 caractères,
tous du seuil 255 ; il nomme ses pièges, et chaque piège appartient à un groupe de
`paires` et garde un intrus absent du message ; l'export ne garde que ce qui se dessine
et ne piège qu'avec un groupe de `paires.json` ; la source est tracée « rédigé pour l'app ».
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import coquilles as coquilles_mod
from wenlu_data import export as export_mod
from wenlu_data.cli import app as cli
from wenlu_data.coquilles import (
    MESSAGE_MAX,
    MESSAGE_MIN,
    OBJECTIF_MAX,
    OBJECTIF_MIN,
    Coquille,
    charger,
    charger_liste,
    controles,
    document,
    fautes_export,
    fautes_sources,
    intrus,
    signes,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée

PAIRES = [["天", "夫"], ["日", "曰"], ["王", "玉", "主"]]
LISTE = list("今天气很好我明去山里是星期一大夫生日")


def coquille(message: str = "今天天气很好。", pieges: tuple[str, ...] = ("天",), **champs: object) -> Coquille:
    valeurs: dict[str, object] = {
        "message": message,
        "pieges": pieges,
        "fr": "Il fait beau aujourd'hui.",
        "en": "The weather is nice today.",
        "source": "rédigé pour l'app",
        "numero": 1,
    }
    valeurs.update(champs)
    return Coquille(**valeurs)  # type: ignore[arg-type]


# ------------------------------------------------------------------------- lecture


def test_les_signes_laissent_la_ponctuation() -> None:
    assert signes("今天有雨，明天也有雨。") == list("今天有雨明天也有雨")
    assert coquille("今天天气很好。").id == "今天天气很好"


def test_l_intrus_vient_du_groupe_du_piege_et_manque_au_message() -> None:
    assert intrus("天", list("今天天气很好"), PAIRES) == ["夫"]
    assert intrus("王", list("王老师"), PAIRES) == ["玉", "主"]
    # 夫 est déjà dans le message : deux caractères faux, jamais.
    assert intrus("天", list("大夫今天来"), PAIRES) == []
    assert intrus("我", list("我明天去"), PAIRES) == []


# ------------------------------------------------------------------------ sources


def test_un_message_juste_ne_fait_aucune_faute() -> None:
    assert fautes_sources([coquille()], LISTE, PAIRES) == []


def test_un_message_compte_de_six_a_douze_caracteres() -> None:
    court = coquille("今天好。")
    long = coquille("今天" * 7)
    fautes = " ".join(fautes_sources([court, long], LISTE, PAIRES))
    assert f"4 caractères, pour {MESSAGE_MIN} à {MESSAGE_MAX}" in fautes
    assert "14 caractères" in fautes


def test_un_message_ne_s_ecrit_qu_avec_le_seuil_255() -> None:
    fautes = fautes_sources([coquille("今天天气很热。")], LISTE, PAIRES)
    assert fautes == ["coquilles.tsv:1 : 热 hors du seuil-255"]


def test_un_piege_est_dans_son_message_et_dans_un_groupe_de_paires() -> None:
    fautes = " ".join(
        fautes_sources(
            [
                coquille(pieges=("日",), numero=1),
                coquille("我明天去山里。", pieges=("我",), numero=2),
                coquille("明天大夫去山里。", pieges=("天",), numero=3),
                coquille("我明天去山里。", pieges=(), numero=4),
            ],
            LISTE,
            PAIRES,
        )
    )
    assert "coquilles.tsv:1 : le piège 日 n'est pas dans le message" in fautes
    assert "coquilles.tsv:2 : le piège 我 n'a pas de groupe dans paires.tsv" in fautes
    assert "coquilles.tsv:3 : le piège 天 n'a aucun intrus absent du message" in fautes
    assert "coquilles.tsv:4 : aucun piège" in fautes


def test_un_message_est_traduit_source_et_unique() -> None:
    fautes = " ".join(
        fautes_sources([coquille(), coquille(fr="", en="", source="", numero=2)], LISTE, PAIRES)
    )
    assert "message en double" in fautes
    assert "sans fr" in fautes and "sans en" in fautes and "sans source" in fautes


def test_la_source_versionnee_est_redigee_pour_l_app_et_tient_ses_regles() -> None:
    lues = charger()
    assert OBJECTIF_MIN <= len(lues) <= OBJECTIF_MAX
    assert {q.source for q in lues} == {"rédigé pour l'app"}
    groupes = export_mod.charger_paires()
    assert fautes_sources(lues, charger_liste(), groupes) == []
    # L'exemple du brief : 夫 pour 天.
    assert any("天" in q.pieges for q in lues)


# ------------------------------------------------------------------------- export


def test_le_document_ne_sort_que_des_messages_dessinables(tmp_path: Path) -> None:
    source = tmp_path / "coquilles.tsv"
    source.write_text(
        "\t".join(coquilles_mod.COLONNES)
        + "\n今天天气很好。\t天\tIl fait beau.\tNice weather.\trédigé pour l'app\n"
        + "我明天去山里。\t天\tDemain, la montagne.\tTomorrow, the mountains.\trédigé pour l'app\n"
        + "今天是我生日。\t天 日\tMon anniversaire.\tMy birthday.\trédigé pour l'app\n",
        encoding="utf-8",
    )
    dessinables = list("今天气很好是我生日夫")
    doc = document(
        "0.9.0",
        caracteres=dessinables,
        paires=PAIRES,
        racines={c: "大" for c in dessinables},
        en_tete={"version": "0.9.0"},
        source=source,
    )
    assert doc["version"] == "0.9.0"
    # 我明天去山里 sort : ni 明 ni 山 ne se dessinent. 日 n'a pas d'intrus dessinable (曰).
    assert [(q["id"], q["pieges"]) for q in doc["coquilles"]] == [
        ("今天天气很好", ["天"]),
        ("今天是我生日", ["天"]),
    ]
    assert set(doc["racines"]) == set("今天气很好是我生日夫")


def test_l_export_ne_piege_qu_avec_un_groupe_de_paires_json() -> None:
    sortie = {"id": "今天天气很好", "message": "今天天气很好。", "pieges": ["天"]}
    traits = set("今天气很好夫")
    assert fautes_export([sortie], [["天", "夫"]], traits) == []
    assert fautes_export([sortie], [["日", "曰"]], traits) == [
        "今天天气很好 : le piège 天 sans intrus dans paires.json"
    ]
    assert fautes_export([sortie], [["天", "夫"]], set("今天气好夫")) == ["今天天气很好 : 很 sans traits"]


def test_l_export_ecrit_coquilles_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    dossier = rapport.dossier
    assert "coquilles.json" in rapport.fichiers
    doc = lire(dossier, "coquilles.json")
    assert export_mod.fautes_de_licence("coquilles.json", doc) == []
    assert "rédigés pour l'app" in str(doc["source"])
    assert lire(dossier, "index.json")["coquilles"] == "coquilles.json"


def test_changer_un_message_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "coquilles.tsv"
    copie.write_text(coquilles_mod.COQUILLES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(coquilles_mod, "COQUILLES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(
    not (VERSIONNE / "coquilles.json").exists(), reason="coquilles.json pas encore exporté"
)


@versionne
def test_l_export_versionne_passe_les_controles_des_coquilles(tmp_path: Path) -> None:
    """Sans build (la CI n'en a pas), les parcours ne se lisent pas ; le reste si."""
    resultats = controles(build=tmp_path / "sans-build")
    assert [c.nom for c in resultats if not c.ok and c.nom != "coquilles : parcours"] == []


@versionne
def test_l_export_versionne_porte_chaque_message_et_ses_racines() -> None:
    doc = json.loads((VERSIONNE / "coquilles.json").read_text(encoding="utf-8"))
    paires = json.loads((VERSIONNE / "paires.json").read_text(encoding="utf-8"))["paires"]
    assert len(doc["coquilles"]) == len(charger())
    for q in doc["coquilles"]:
        s = signes(q["message"])
        for c in s:
            assert c in doc["racines"], c
        for p in q["pieges"]:
            assert any(p in g for g in paires)
            for x in intrus(p, s, paires):
                assert x in doc["racines"], x


# ------------------------------------------------------------------------ commande


@versionne
def test_la_commande_apercu_liste_les_messages() -> None:
    resultat = CliRunner().invoke(cli, ["coquilles", "apercu"])
    assert resultat.exit_code == 0, resultat.output
    assert "今天天气很好。\t天→夫" in resultat.output
