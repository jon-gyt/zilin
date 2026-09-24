"""Le dictionnaire éclair (story 4b.4) : source, leurres, export, contrôles.

Un test par règle. Aucun réseau. Les règles : un mot de deux caractères distincts,
un sens rédigé en français et en anglais, jamais deux fois le même mot ni le même
sens, aucun mot exclu ; le pinyin se lit dans Unihan et les surcharges ; trois
leurres, les sens d'autres mots, les voisins d'abord, jamais un proche ; l'export ne
fait entrer aucun caractère dans le périmètre et ne porte aucune définition de
CC-CEDICT.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import eclair as eclair_mod
from wenlu_data import export as export_mod
from wenlu_data.cli import app as cli
from wenlu_data.eclair import (
    LEURRES,
    OBJECTIF,
    MotEclair,
    charger,
    compatibles,
    controles,
    document,
    fautes_leurres,
    fautes_pinyin,
    fautes_sources,
    leurres,
    voisinage,
)

from test_export import TEMOIN_EN, atelier, lire  # noqa: F401 — fixture partagée


def mot(m: str, fr: str, en: str = "", proches: str = "", pinyin: str = "x", numero: int = 1) -> MotEclair:
    return MotEclair(
        mot=m, pinyin=pinyin, fr=fr, en=en or fr, proches=proches, source="rédigé pour l'app", numero=numero
    )


#: Un petit monde : des mots qui partagent des caractères, et d'autres non.
MONDE = [
    mot("火车", "train"),
    mot("火山", "volcan"),
    mot("电车", "tramway"),
    mot("汽车", "voiture"),
    mot("大门", "grande porte", proches="porte"),
    mot("正门", "entrée principale", proches="porte"),
    mot("口水", "salive"),
    mot("明天", "demain"),
]


def ecrire_source(chemin: Path, mots: list[tuple[str, ...]]) -> Path:
    chemin.write_text(
        "\t".join(eclair_mod.COLONNES)
        + "\n"
        + "".join("\t".join(r) + "\n" for r in mots),
        encoding="utf-8",
    )
    return chemin


# ------------------------------------------------------------------------- leurres


def test_le_voisinage_prefere_le_meme_rang() -> None:
    assert voisinage("火车", "火山") == 2
    assert voisinage("火车", "电车") == 2
    assert voisinage("车站", "火车") == 1
    assert voisinage("火车", "明天") == 0


def test_trois_leurres_distincts_jamais_le_mot_les_voisins_d_abord() -> None:
    choisis = leurres(MONDE[0], MONDE)
    assert len(choisis) == LEURRES
    assert len(set(choisis)) == LEURRES
    assert "火车" not in choisis
    assert set(choisis) == {"火山", "电车", "汽车"}, "les trois voisins de 火车 passent devant"


def test_un_proche_n_est_jamais_un_leurre() -> None:
    assert not compatibles(MONDE[4], MONDE[5])
    assert "正门" not in leurres(MONDE[4], MONDE)


def test_un_meme_sens_n_est_jamais_un_leurre() -> None:
    double = mot("列车", "train")
    assert not compatibles(MONDE[0], double)
    assert "列车" not in leurres(MONDE[0], [*MONDE, double])


def test_les_leurres_sont_les_memes_d_un_passage_a_l_autre() -> None:
    assert leurres(MONDE[6], MONDE) == leurres(MONDE[6], list(reversed(MONDE)))


# ------------------------------------------------------------------------- sources


def test_un_mot_doit_avoir_deux_caracteres_distincts() -> None:
    fautes = fautes_sources([mot("天天", "tous les jours"), mot("火", "feu"), mot("火车站", "gare")])
    assert len(fautes) == 3


def test_un_doublon_de_mot_ou_de_sens_est_une_faute() -> None:
    assert fautes_sources([mot("火车", "train", numero=1), mot("火车", "convoi", numero=2)])
    assert fautes_sources([mot("火车", "train", en="train"), mot("列车", "train", en="railway train")])
    assert fautes_sources([mot("火车", "train", en="train"), mot("列车", "convoi", en="train")])


def test_un_champ_vide_ou_un_pinyin_en_deux_morceaux_est_une_faute() -> None:
    assert fautes_sources([MotEclair("火车", "", "train", "train", "", "x")])
    assert fautes_sources([MotEclair("火车", "huǒchē", "", "train", "", "x")])
    assert fautes_sources([MotEclair("火车", "huǒchē", "train", "", "", "x")])
    assert fautes_sources([MotEclair("火车", "huǒchē", "train", "train", "", "")])
    assert fautes_sources([MotEclair("火车", "huǒ chē", "train", "train", "", "x")])


def test_un_mot_exclu_n_entre_pas() -> None:
    assert fautes_sources([mot("王八", "tortue")], exclus={"王八"})
    assert not fautes_sources([mot("火车", "train")], exclus={"王八"})


def test_le_pinyin_se_lit_dans_les_lectures_d_unihan() -> None:
    lectures = {"东": ["dōng"], "西": ["xī"], "火": ["huǒ"], "车": ["chē", "jū"]}
    assert fautes_pinyin([mot("火车", "train", pinyin="huǒchē")], lectures) == []
    # Le ton neutre du mot est admis : 东西, la chose.
    assert fautes_pinyin([mot("东西", "chose", pinyin="dōngxi")], lectures) == []
    assert fautes_pinyin([mot("火车", "train", pinyin="huǒchá")], lectures)


def test_la_source_versionnee_est_propre_et_dans_l_objectif() -> None:
    lus = charger()
    bas, haut = OBJECTIF
    assert bas <= len(lus) <= haut
    assert fautes_sources(lus, eclair_mod._exclus()) == []
    assert all("rédigé pour l'app" in m.source for m in lus)


def test_les_exemples_du_brief_transparents_sont_dans_la_base() -> None:
    par_mot = {m.mot: m for m in charger()}
    assert par_mot["电脑"].fr == "ordinateur"
    assert "手机" in par_mot


# -------------------------------------------------------------------------- export


def test_le_document_ne_sort_que_des_mots_dessinables(tmp_path: Path) -> None:
    source = ecrire_source(
        tmp_path / "mots.tsv",
        [
            ("明日", "míngrì", "demain", "tomorrow", "", "rédigé pour l'app"),
            ("日月", "rìyuè", "le soleil et la lune", "sun and moon", "", "rédigé pour l'app"),
            ("古人", "gǔrén", "les anciens", "the ancients", "", "rédigé pour l'app"),
            ("明月", "míngyuè", "lune claire", "bright moon", "", "rédigé pour l'app"),
            ("口十", "kǒushí", "dix bouches", "ten mouths", "", "rédigé pour l'app"),
        ],
    )
    doc = document(
        "0.9.0",
        caracteres=["明", "日", "月", "十", "口"],
        racines={"明": "日", "日": "日", "月": "月", "十": "十", "口": "口"},
        en_tete={"version": "0.9.0"},
        source=source,
    )
    assert doc["version"] == "0.9.0"
    mots = {m["mot"]: m for m in doc["mots"]}  # type: ignore[union-attr]
    assert set(mots) == {"明日", "日月", "明月", "口十"}, "古人 sort : 古 et 人 ne se dessinent pas"
    assert mots["明日"]["pinyin"] == "míngrì" and mots["明日"]["en"] == "tomorrow"
    for m in mots.values():
        assert len(m["leurres"]) == LEURRES and set(m["leurres"]) <= set(mots)
    assert set(doc["racines"]) == {"明", "日", "月", "十", "口"}  # type: ignore[arg-type]


def test_l_export_ecrit_eclair_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "eclair.json" in rapport.fichiers
    doc = lire(rapport.dossier, "eclair.json")
    assert export_mod.fautes_de_licence("eclair.json", doc) == []
    assert lire(rapport.dossier, "index.json")["eclair"] == "eclair.json"
    assert "CC-CEDICT" in str(doc["source"]) and "rédigés pour l'app" in str(doc["source"])
    assert TEMOIN_EN not in json.dumps(doc, ensure_ascii=False)


def test_changer_un_mot_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "mots.tsv"
    copie.write_text(eclair_mod.MOTS.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(eclair_mod, "MOTS", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ----------------------------------------------------------------------- contrôles


def test_un_leurre_absent_en_double_ou_proche_est_une_faute() -> None:
    sorties = [
        {"mot": "火车", "leurres": ["火山", "火山", "电车"]},
        {"mot": "大门", "leurres": ["正门", "火车", "列车"]},
        {"mot": "火山", "leurres": ["火车", "电车"]},
        {"mot": "电车", "leurres": ["火车", "火山", "大门"]},
        {"mot": "正门", "leurres": ["火车", "火山", "电车"]},
    ]
    fautes = fautes_leurres(sorties, MONDE)
    assert any("火车 : leurres en double" in f for f in fautes)
    assert any("大门 : le leurre 正门 a un sens trop proche" in f for f in fautes)
    assert any("大门 : le leurre 列车 n'est pas un mot exporté" in f for f in fautes)
    assert any("火山 : 2 leurres" in f for f in fautes)
    assert not any(f.startswith("电车") or f.startswith("正门") for f in fautes)


def test_les_controles_disent_les_fautes_de_la_source(tmp_path: Path) -> None:
    source = ecrire_source(
        tmp_path / "mots.tsv",
        [
            ("火车", "huǒchē", "train", "train", "", "rédigé pour l'app"),
            ("火车", "huǒchē", "convoi", "convoy", "", "rédigé pour l'app"),
        ],
    )
    resultats = {c.nom: c for c in controles(tmp_path / "sans-export", build=tmp_path, ingest=tmp_path, source=source)}
    assert not resultats["éclair : sources"].ok and resultats["éclair : sources"].bloquant
    assert "en double" in resultats["éclair : sources"].detail


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(not (VERSIONNE / "eclair.json").exists(), reason="eclair.json pas encore exporté")


@versionne
def test_l_export_versionne_passe_les_controles_de_l_eclair(tmp_path: Path) -> None:
    """Sans build ni ingest (la CI n'en a pas), le pinyin et les parcours ne se lisent pas ; le reste si."""
    resultats = controles(build=tmp_path / "sans-build", ingest=tmp_path / "sans-ingest")
    assert [c.nom for c in resultats if not c.ok and c.bloquant] == []


@versionne
def test_l_export_versionne_trouve_chaque_racine_et_chaque_leurre() -> None:
    doc = json.loads((VERSIONNE / "eclair.json").read_text(encoding="utf-8"))
    mots = {m["mot"]: m for m in doc["mots"]}
    assert len(mots) == len(charger())
    for m in mots.values():
        assert m["pinyin"] and m["fr"] and m["en"]
        for c in m["mot"]:
            assert c in doc["racines"], c
        assert all(x in mots and mots[x]["fr"] != m["fr"] for x in m["leurres"])


@versionne
def test_la_commande_apercu_liste_les_mots_et_leurs_leurres() -> None:
    resultat = CliRunner().invoke(cli, ["eclair", "apercu"])
    assert resultat.exit_code == 0, resultat.output
    assert "电脑\tdiànnǎo\tordinateur\t" in resultat.output
