"""Ingestion : un test par règle. Extraits courts en dur, aucun accès réseau."""
from __future__ import annotations

import gzip
import json
from pathlib import Path

import pytest

from zilin_data.ingest import (
    ListeInvalide,
    SourceInvalide,
    charger_liste,
    est_sinogramme,
    ingest,
    parse_ligne_cedict,
    parse_ligne_dictionnaire,
    parse_ligne_graphies,
    parse_liste,
)

LIGNE_DICTIONNAIRE = json.dumps(
    {
        "character": "好",
        "definition": "good, excellent, fine; well",
        "pinyin": ["hǎo", "hào"],
        "decomposition": "⿰女子",
        "etymology": {"type": "ideographic", "hint": "A woman 女 with a child 子"},
        "radical": "女",
        "matches": [[0], [0], [0], [1], [1], [1]],
    },
    ensure_ascii=False,
)

LIGNE_GRAPHIES = json.dumps(
    {
        "character": "一",
        "strokes": ["M 123 456 Q 200 400 300 456 Z"],
        "medians": [[[123, 456], [300, 456]]],
    },
    ensure_ascii=False,
)

LIGNE_CEDICT = "好 好 [hao3] /good/well/proper/good to/easy to/very/so/"


def test_parse_ligne_dictionnaire() -> None:
    """Une ligne de dictionary.txt donne décomposition, radical, pinyin et définition."""
    c = parse_ligne_dictionnaire(LIGNE_DICTIONNAIRE)
    assert c.c == "好"
    assert c.decomposition == "⿰女子"
    assert c.radical == "女"
    assert c.pinyin == ["hǎo", "hào"]
    assert c.definition_en == "good, excellent, fine; well"


def test_etymologie_separee_de_la_decomposition() -> None:
    """L'étymologie est une couche à part, typée, jamais la décomposition canonique."""
    c = parse_ligne_dictionnaire(LIGNE_DICTIONNAIRE)
    assert c.etymologie is not None
    assert c.etymologie.type == "ideographic"
    assert c.etymologie.hint == "A woman 女 with a child 子"
    assert c.etymologie.phonetic is None


def test_dictionnaire_sans_etymologie() -> None:
    """Un caractère sans étymologie reste valide."""
    ligne = json.dumps({"character": "丿", "pinyin": [], "decomposition": "？", "radical": "丿"})
    assert parse_ligne_dictionnaire(ligne).etymologie is None


def test_dictionnaire_type_etymologie_inconnu() -> None:
    """Un type d'étymologie hors des trois types attendus est refusé."""
    ligne = json.dumps({"character": "好", "etymology": {"type": "poetique"}})
    with pytest.raises(SourceInvalide):
        parse_ligne_dictionnaire(ligne)


def test_parse_ligne_graphies() -> None:
    """Une ligne de graphics.txt donne les traits et les médianes."""
    g = parse_ligne_graphies(LIGNE_GRAPHIES)
    assert g.c == "一"
    assert g.strokes == ["M 123 456 Q 200 400 300 456 Z"]
    assert g.medians == [[[123, 456], [300, 456]]]


def test_graphies_traits_et_medianes_en_nombre_egal() -> None:
    """Autant de médianes que de traits, sinon la ligne est refusée."""
    ligne = json.dumps({"character": "二", "strokes": ["M 1 2", "M 3 4"], "medians": [[[1, 2]]]})
    with pytest.raises(SourceInvalide):
        parse_ligne_graphies(ligne)


def test_parse_ligne_cedict() -> None:
    """Une ligne CC-CEDICT donne traditionnel, simplifié, pinyin et définitions."""
    m = parse_ligne_cedict(LIGNE_CEDICT)
    assert m is not None
    assert (m.traditionnel, m.simplifie, m.pinyin) == ("好", "好", "hao3")
    assert m.definitions_en == ["good", "well", "proper", "good to", "easy to", "very", "so"]


def test_cedict_traditionnel_et_simplifie_distincts() -> None:
    """Les deux graphies sont conservées séparément."""
    m = parse_ligne_cedict("漢語 汉语 [Han4 yu3] /Chinese language/")
    assert m is not None
    assert m.traditionnel == "漢語"
    assert m.simplifie == "汉语"


def test_cedict_ignore_les_commentaires() -> None:
    """L'en-tête `#` et les lignes vides ne produisent pas d'entrée."""
    assert parse_ligne_cedict("# CC-CEDICT") is None
    assert parse_ligne_cedict("#! version=1") is None
    assert parse_ligne_cedict("\n") is None


def test_cedict_ligne_illisible() -> None:
    """Une ligne qui ne suit pas le format est refusée."""
    with pytest.raises(SourceInvalide):
        parse_ligne_cedict("好 好 hao3 good")


def test_charger_liste(tmp_path: Path) -> None:
    """Une liste se charge dans l'ordre du fichier, commentaires ignorés."""
    fichier = tmp_path / "seuil-255.txt"
    fichier.write_text("# source : Eduscol\n人\n大\n\n天  # commentaire de fin de ligne\n", encoding="utf-8")
    assert charger_liste(fichier) == ["人", "大", "天"]


def test_liste_refuse_les_doublons() -> None:
    """Un caractère répété invalide la liste."""
    with pytest.raises(ListeInvalide, match="doublon"):
        parse_liste(["人", "大", "人"])


def test_liste_refuse_les_non_sinogrammes() -> None:
    """Latin, ponctuation et groupes de caractères sont refusés."""
    for entree in ("a", "人大", "、", "1"):
        with pytest.raises(ListeInvalide):
            parse_liste([entree])


def test_est_sinogramme() -> None:
    """Un sinogramme unique, et rien d'autre."""
    assert est_sinogramme("人")
    assert est_sinogramme("好")
    assert not est_sinogramme("")
    assert not est_sinogramme("人人")
    assert not est_sinogramme("é")


def test_liste_hsk_1_du_depot() -> None:
    """La liste HSK 1 versionnée est valide et complète (300 caractères)."""
    from zilin_data.paths import LISTES

    assert charger_liste(LISTES / "hsk-1.txt") == charger_liste(LISTES / "hsk-1.txt")
    assert len(charger_liste(LISTES / "hsk-1.txt")) == 300


def test_ingest_bout_en_bout(tmp_path: Path) -> None:
    """ingest() lit les trois sources et les listes, et écrit le JSON normalisé."""
    sources = tmp_path / "sources"
    sources.mkdir()
    (sources / "dictionary.txt").write_text(LIGNE_DICTIONNAIRE + "\n", encoding="utf-8")
    (sources / "graphics.txt").write_text(LIGNE_GRAPHIES + "\n", encoding="utf-8")
    with gzip.open(sources / "cedict_1_0_ts_utf-8_mdbg.txt.gz", "wt", encoding="utf-8") as f:
        f.write("# CC-CEDICT\n" + LIGNE_CEDICT + "\n")

    listes = tmp_path / "listes"
    listes.mkdir()
    (listes / "essai.txt").write_text("# essai\n好\n人\n", encoding="utf-8")

    sortie = tmp_path / "ingest"
    rapport = ingest(sources=sources, sortie=sortie, listes=listes)

    assert rapport["caracteres"] == 1
    assert rapport["graphies"] == 1
    assert rapport["mots"] == 1
    assert rapport["liste_essai"] == 2
    assert rapport["liste_essai_absents_du_dictionnaire"] == 1  # 人 n'est pas dans l'extrait
    assert json.loads((sortie / "mots.json").read_text(encoding="utf-8"))[0]["simplifie"] == "好"
    assert json.loads((sortie / "listes.json").read_text(encoding="utf-8")) == {"essai": ["好", "人"]}


def test_ingest_sans_cedict(tmp_path: Path) -> None:
    """CC-CEDICT absent : l'ingestion aboutit et le rapport le signale."""
    sources = tmp_path / "sources"
    sources.mkdir()
    (sources / "dictionary.txt").write_text(LIGNE_DICTIONNAIRE + "\n", encoding="utf-8")
    (sources / "graphics.txt").write_text(LIGNE_GRAPHIES + "\n", encoding="utf-8")
    listes = tmp_path / "listes"
    listes.mkdir()

    rapport = ingest(sources=sources, sortie=tmp_path / "ingest", listes=listes)
    assert "source absente" in str(rapport["mots"])
