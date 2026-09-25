"""Ingestion d'Unihan : un test par règle. Aucun accès réseau.

Les extraits sont des lignes réelles d'Unihan 17.0.0 (archive publiée par
Unicode le 24 juillet 2025), et, pour `kFrequency`, d'une version antérieure
qui portait encore le champ.
"""
from __future__ import annotations

import zipfile
from pathlib import Path

import pytest

from wenlu_data.unihan import (
    FREQUENCE,
    UnihanInvalide,
    collecter,
    document,
    document_definitions,
    lire_entete,
    parse_ligne,
    rangs_frequence,
)

LECTURES = """# Unihan_Readings.txt
# Date: 2025-07-24 00:00:00 GMT [KL]
# Unicode Version 17.0.0
#
# Unicode Character Database
# © 2025 Unicode®, Inc.
# For terms of use and license, see https://www.unicode.org/terms_of_use.html
#
U+4E00\tkDefinition\tone; a, an; alone
U+4E00\tkMandarin\tyī
U+4E07\tkMandarin\twàn mò
U+4E2D\tkDefinition\tcentral; center, middle; in the midst of; hit (target); attain
U+4E2D\tkMandarin\tzhōng
"""

IRG = """# Unihan_IRGSources.txt
# Date: 2025-07-24 00:00:00 GMT [KL]
# Unicode Version 17.0.0
#
U+4E00\tkRSUnicode\t1.0
U+4E00\tkTotalStrokes\t1
U+4E2D\tkRSUnicode\t2.3
U+4E2D\tkTotalStrokes\t4
"""

# Unicode 12.0.0 : ancien format d'en-tête (« Unicode version: ») et `kFrequency`
# encore publié.
DICTIONNAIRE_ANCIEN = """# Unihan_DictionaryLikeData.txt
# Date: 2018-11-09 21:36:19 GMT [JHJ]
# Unicode version: 12.0.0
#
U+4E00\tkFrequency\t1
U+4E07\tkFrequency\t2
U+4E2D\tkFrequency\t1
"""


def dossier(chemin: Path, **fichiers: str) -> Path:
    chemin.mkdir(parents=True, exist_ok=True)
    for nom, contenu in fichiers.items():
        (chemin / f"Unihan_{nom}.txt").write_text(contenu, encoding="utf-8")
    return chemin


def test_entete_officiel(tmp_path: Path) -> None:
    """L'en-tête donne le nom du fichier, sa date et la version d'Unicode."""
    entete = lire_entete(LECTURES.splitlines())
    assert entete.fichier == "Unihan_Readings.txt"
    assert entete.date == "2025-07-24 00:00:00 GMT [KL]"
    assert entete.version == "17.0.0"


def test_ancien_format_d_entete() -> None:
    """« Unicode version: 12.0.0 » est lu comme « Unicode Version 17.0.0 »."""
    assert lire_entete(DICTIONNAIRE_ANCIEN.splitlines()).version == "12.0.0"


def test_entete_absent_refuse() -> None:
    """Un fichier sans en-tête officiel est refusé, pas ingéré à l'aveugle."""
    with pytest.raises(UnihanInvalide):
        lire_entete(["U+4E00\tkMandarin\tyī"])
    with pytest.raises(UnihanInvalide):
        lire_entete(["# Unihan_Readings.txt", "# Date: 2025-07-24 00:00:00 GMT [KL]"])


def test_ligne_illisible_refusee() -> None:
    with pytest.raises(UnihanInvalide):
        parse_ligne("4E00 kMandarin yī")
    assert parse_ligne("# commentaire") is None


def test_pinyin_multiple_prend_la_premiere_lecture(tmp_path: Path) -> None:
    """`kMandarin wàn mò` : la première lecture fait le pinyin, les autres sont gardées."""
    unihan = collecter(dossier(tmp_path / "unihan", Readings=LECTURES, IRGSources=IRG))
    par_caractere = {c.c: c for c in unihan.caracteres}
    assert par_caractere["万"].pinyin == "wàn"
    assert par_caractere["万"].lectures == ("wàn", "mò")
    assert par_caractere["中"].pinyin == "zhōng"


def test_les_dictionnaires_gardent_toutes_les_lectures(tmp_path: Path) -> None:
    """`kTGHZ2013` et `kXHC1983` disent toutes les lectures d'un polyphone, que
    `kMandarin` tait : 好 hǎo et hào. L'ordre est gardé, sans doublon."""
    lectures = LECTURES + (
        "U+597D\tkMandarin\thǎo\n"
        "U+597D\tkTGHZ2013\t132.140:hǎo 133.010:hào\n"
        "U+597D\tkXHC1983\t0445.030:hǎo 0448.030:hào\n"
        "U+5F97\tkMandarin\tdé\n"
        "U+5F97\tkXHC1983\t0223.030:dé 0225.010,0225.020:de 0225.040:děi\n"
    )
    unihan = collecter(dossier(tmp_path / "unihan", Readings=lectures, IRGSources=IRG))
    par_caractere = {c.c: c for c in unihan.caracteres}
    assert par_caractere["好"].lectures == ("hǎo",)
    assert par_caractere["好"].lectures_dico == ("hǎo", "hào")
    assert par_caractere["得"].lectures_dico == ("dé", "de", "děi")
    assert par_caractere["中"].lectures_dico == ()
    principal = document(unihan, url="https://exemple.invalide/", licence="Unicode License")
    lus = {e["c"]: e for e in principal["caracteres"]}  # type: ignore[union-attr]
    assert lus["好"]["lectures_dico"] == ["hǎo", "hào"]


def test_traits_et_point_de_code(tmp_path: Path) -> None:
    """`kTotalStrokes` donne le nombre de traits ; le point de code est conservé."""
    unihan = collecter(dossier(tmp_path / "unihan", Readings=LECTURES, IRGSources=IRG))
    par_caractere = {c.c: c for c in unihan.caracteres}
    assert par_caractere["中"].traits == 4
    assert par_caractere["中"].code == "U+4E2D"
    assert par_caractere["一"].traits == 1


def test_definitions_anglaises_a_part(tmp_path: Path) -> None:
    """`kDefinition` ne figure jamais dans `unihan.json` : elle part dans son fichier."""
    unihan = collecter(dossier(tmp_path / "unihan", Readings=LECTURES, IRGSources=IRG))
    principal = document(unihan, url="https://exemple.invalide/", licence="Unicode License")
    assert "one; a, an; alone" not in str(principal)
    definitions = document_definitions(
        unihan, url="https://exemple.invalide/", licence="Unicode License"
    )
    assert {"c": "一", "definition_en": "one; a, an; alone"} in definitions["definitions"]
    assert "fiches FR" in str(definitions["regime"])


def test_version_et_provenance(tmp_path: Path) -> None:
    """Le document porte la version, la date et l'en-tête de chaque fichier lu."""
    unihan = collecter(dossier(tmp_path / "unihan", Readings=LECTURES, IRGSources=IRG))
    principal = document(unihan, url="https://exemple.invalide/", licence="Unicode License")
    assert principal["version"] == "17.0.0"
    assert principal["licence"] == "Unicode License"
    assert {e.fichier for e in unihan.fichiers} == {
        "Unihan_Readings.txt",
        "Unihan_IRGSources.txt",
    }


def test_versions_melees_refusees(tmp_path: Path) -> None:
    """Deux fichiers de versions différentes ne sont pas ingérés ensemble."""
    melange = dossier(
        tmp_path / "unihan", Readings=LECTURES, DictionaryLikeData=DICTIONNAIRE_ANCIEN
    )
    with pytest.raises(UnihanInvalide):
        collecter(melange)


def test_frequence_absente_dunicode_17(tmp_path: Path) -> None:
    """Unicode 17.0.0 ne publie plus `kFrequency` : `frequence` reste vide."""
    unihan = collecter(dossier(tmp_path / "unihan", Readings=LECTURES, IRGSources=IRG))
    assert not unihan.avec_frequence
    assert all(c.frequence is None for c in unihan.caracteres)
    assert rangs_frequence(unihan.caracteres) == {}
    principal = document(unihan, url="https://exemple.invalide/", licence="Unicode License")
    assert principal["frequence"] == f"{FREQUENCE} absent de cette version"


def test_frequence_branchee_quand_le_champ_existe(tmp_path: Path) -> None:
    """Si la version servie porte `kFrequency`, le rang de fréquence est calculé."""
    unihan = collecter(dossier(tmp_path / "unihan", DictionaryLikeData=DICTIONNAIRE_ANCIEN))
    assert unihan.avec_frequence
    rangs = rangs_frequence(unihan.caracteres)
    # Palier 1 avant palier 2 ; à palier égal, le point de code départage.
    assert rangs == {"一": 1, "中": 2, "万": 3}
    principal = document(unihan, url="https://exemple.invalide/", licence="Unicode License")
    assert principal["frequence"] == FREQUENCE
    assert {c["c"]: c["frequence"] for c in principal["caracteres"]}["一"] == 1


def test_archive_zip_lue_comme_un_dossier(tmp_path: Path) -> None:
    """`Unihan.zip` est lu directement : pas besoin de l'extraire."""
    archive = tmp_path / "Unihan.zip"
    with zipfile.ZipFile(archive, "w") as zip_:
        zip_.writestr("Unihan_Readings.txt", LECTURES)
        zip_.writestr("Unihan_IRGSources.txt", IRG)
    unihan = collecter(archive)
    assert unihan.version == "17.0.0"
    assert {c.c for c in unihan.caracteres} == {"一", "万", "中"}


def test_fichier_renomme_refuse(tmp_path: Path) -> None:
    """Un fichier qui ne porte pas son propre en-tête est refusé."""
    chemin = dossier(tmp_path / "unihan", Readings=IRG)
    with pytest.raises(UnihanInvalide):
        collecter(chemin)
