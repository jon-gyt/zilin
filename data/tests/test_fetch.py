"""Téléchargement : empreintes, journal, idempotence et repli. Aucun accès réseau."""
from __future__ import annotations

import gzip
import io
import zipfile
from pathlib import Path

import pytest

from zilin_data import fetch as module
from zilin_data.fetch import (
    CEDICT_MDBG,
    CEDICT_MIROIR,
    ENTETE_CEDICT,
    ENTETE_UNIHAN,
    INCHANGE,
    PRESENT,
    REPLI,
    SOURCES_DISTANTES,
    TELECHARGE,
    UNIHAN_MIROIR,
    UNIHAN_UNICODE,
    Resultat,
    Source,
    ecrire_sommes,
    empreinte,
    entete_presente,
    journaliser,
    telecharger,
)

OFFICIELLE = "https://exemple.invalide/officiel.txt"
MIROIR = "https://exemple.invalide/miroir.txt"

ENTETE = "# CC-CEDICT\n#! entries=3\n" + ENTETE_CEDICT + "\n#! date=2026-09-19T09:05:23Z\n"
CORPS = "好 好 [hao3] /good/\n"


def source_avec_repli(*, entete: str | None = ENTETE_CEDICT) -> Source:
    return Source(
        nom="essai",
        fichier="a.txt",
        url=OFFICIELLE,
        licence="CC BY-SA 4.0",
        replis=(MIROIR,),
        entete_attendue=entete,
    )


def servir(reponses: dict[str, bytes | None]):
    """Remplace le téléchargement réseau : {url: contenu} ; None vaut échec."""

    def faux_recuperer(url: str, dest: Path) -> str | None:
        contenu = reponses.get(url)
        if contenu is None:
            dest.unlink(missing_ok=True)
            return "HTTPStatusError 503"
        dest.write_bytes(contenu)
        return None

    return faux_recuperer


def test_empreinte(tmp_path: Path) -> None:
    """SHA-256 du contenu, en hexadécimal."""
    f = tmp_path / "a.txt"
    f.write_bytes(b"zilin")
    assert empreinte(f) == "dcbbe1af4fe6cfde59a47e4bacebf132afa3ce3250fc40a3e7089ffef2bc197c"


def test_telecharger_est_idempotent(tmp_path: Path) -> None:
    """Un fichier déjà présent n'est pas retéléchargé (donc aucun appel réseau)."""
    source = Source(nom="essai", fichier="a.txt", url=OFFICIELLE, licence="—")
    dest = tmp_path / "a.txt"
    dest.write_text("déjà là", encoding="utf-8")
    assert telecharger(source, dest).etat == PRESENT
    assert dest.read_text(encoding="utf-8") == "déjà là"


def test_sommes_au_format_sha256sum(tmp_path: Path) -> None:
    """SHA256SUMS : empreinte, deux espaces, nom de fichier."""
    source = Source(nom="essai", fichier="a.txt", url=OFFICIELLE, licence="—")
    (tmp_path / "a.txt").write_bytes(b"zilin")
    ligne = ecrire_sommes(tmp_path, (source,)).read_text(encoding="utf-8").strip()
    somme, nom = ligne.split("  ")
    assert nom == "a.txt"
    assert somme == empreinte(tmp_path / "a.txt")


def test_journal_de_provenance(tmp_path: Path) -> None:
    """PROVENANCE.md garde l'URL, la taille, l'empreinte et l'action de chaque source."""
    source = Source(nom="essai", fichier="a.txt", url=OFFICIELLE, licence="CC BY-SA 4.0")
    (tmp_path / "a.txt").write_bytes(b"zilin")
    journaliser(tmp_path, (source,), {"a.txt": Resultat(TELECHARGE, OFFICIELLE)})
    journaliser(tmp_path, (source,), {"a.txt": Resultat(PRESENT)})
    texte = (tmp_path / "PROVENANCE.md").read_text(encoding="utf-8")
    assert OFFICIELLE in texte
    assert "CC BY-SA 4.0" in texte
    assert TELECHARGE in texte and PRESENT in texte
    assert texte.count("| `a.txt` |") == 2
    # Un fichier déjà présent ne se voit attribuer aucune URL de ce passage.
    assert texte.count(OFFICIELLE) == 1
    assert INCHANGE in texte


def test_sources_declarees() -> None:
    """Les sources du pipeline sont déclarées, avec leur licence."""
    fichiers = {s.fichier for s in SOURCES_DISTANTES}
    assert fichiers == {
        "dictionary.txt",
        "graphics.txt",
        "cedict_1_0_ts_utf-8_mdbg.txt.gz",
        "Unihan.zip",
        "cjk-decomp.txt",
    }
    assert all(s.url.startswith("https://") and s.licence for s in SOURCES_DISTANTES)


# ------------------------------------------------------------------ repli par miroir


def test_cedict_declare_mdbg_puis_un_miroir() -> None:
    """CC-CEDICT : l'URL officielle MDBG d'abord, le miroir GitHub ensuite."""
    (cedict,) = [s for s in SOURCES_DISTANTES if s.nom == "CC-CEDICT"]
    assert cedict.urls == (CEDICT_MDBG, CEDICT_MIROIR)
    assert cedict.entete_attendue == ENTETE_CEDICT


def test_url_officielle_prioritaire(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Tant que l'URL officielle répond, le miroir n'est pas sollicité."""
    monkeypatch.setattr(
        module,
        "recuperer",
        servir({OFFICIELLE: (ENTETE + CORPS).encode(), MIROIR: b"ne devrait pas servir"}),
    )
    resultat = telecharger(source_avec_repli(), tmp_path / "a.txt")
    assert resultat == Resultat(TELECHARGE, OFFICIELLE)


def test_repli_sur_le_miroir_quand_l_officielle_echoue(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """URL officielle en échec : le miroir sert, et le résultat dit laquelle a servi."""
    monkeypatch.setattr(
        module, "recuperer", servir({OFFICIELLE: None, MIROIR: (ENTETE + CORPS).encode()})
    )
    dest = tmp_path / "a.txt"
    resultat = telecharger(source_avec_repli(), dest)
    assert resultat == Resultat(REPLI, MIROIR)
    assert CORPS in dest.read_text(encoding="utf-8")


def test_repli_refuse_sans_en_tete_officiel(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un fichier sans la ligne de licence officielle est refusé, rien n'est écrit."""
    monkeypatch.setattr(
        module, "recuperer", servir({OFFICIELLE: None, MIROIR: b"# pas la bonne licence\n"})
    )
    dest = tmp_path / "a.txt"
    resultat = telecharger(source_avec_repli(), dest)
    assert resultat.echec
    assert "en-tête officiel absent" in resultat.etat
    assert not dest.exists()


def test_miroir_non_compresse_accepte(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Le miroir sert le fichier officiel non compressé : l'en-tête est lu quand même."""
    monkeypatch.setattr(module, "recuperer", servir({OFFICIELLE: None, MIROIR: ENTETE.encode()}))
    dest = tmp_path / "cedict_1_0_ts_utf-8_mdbg.txt.gz"
    assert telecharger(source_avec_repli(), dest).url == MIROIR
    assert entete_presente(dest, ENTETE_CEDICT)


def test_en_tete_lu_aussi_dans_une_archive_gzip(tmp_path: Path) -> None:
    """L'en-tête est vérifié aussi bien sur le .gz officiel que sur le texte du miroir."""
    compresse = tmp_path / "c.gz"
    compresse.write_bytes(gzip.compress((ENTETE + CORPS).encode()))
    assert entete_presente(compresse, ENTETE_CEDICT)
    assert not entete_presente(compresse, "#! license=https://exemple.invalide/")


def test_journal_signale_le_miroir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """PROVENANCE.md nomme l'URL qui a réellement servi, pas l'URL officielle."""
    monkeypatch.setattr(
        module, "recuperer", servir({OFFICIELLE: None, MIROIR: (ENTETE + CORPS).encode()})
    )
    source = source_avec_repli()
    resultat = telecharger(source, tmp_path / "a.txt")
    journaliser(tmp_path, (source,), {"a.txt": resultat})
    texte = (tmp_path / "PROVENANCE.md").read_text(encoding="utf-8")
    assert MIROIR in texte
    assert REPLI in texte


def test_echec_de_toutes_les_urls(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Toutes les URL en échec : l'état les nomme toutes et aucun fichier n'est écrit."""
    monkeypatch.setattr(module, "recuperer", servir({OFFICIELLE: None, MIROIR: None}))
    dest = tmp_path / "a.txt"
    resultat = telecharger(source_avec_repli(), dest)
    assert resultat.echec
    assert OFFICIELLE in resultat.etat and MIROIR in resultat.etat
    assert not dest.exists()


# ------------------------------------------------------------------------ Unihan

# En-tête réel d'Unihan 17.0.0.
ENTETE_LECTURES = (
    "# Unihan_Readings.txt\n"
    "# Date: 2025-07-24 00:00:00 GMT [KL]\n"
    "# Unicode Version 17.0.0\n"
    "#\n"
)


def archive(contenu: str) -> bytes:
    """Archive zip d'un seul membre `Unihan_Readings.txt`."""
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w") as zip_:
        zip_.writestr("Unihan_Readings.txt", contenu)
    return tampon.getvalue()


def source_unihan() -> Source:
    (unihan,) = [s for s in SOURCES_DISTANTES if s.fichier == "Unihan.zip"]
    return unihan


def test_unihan_declare_unicode_puis_un_miroir() -> None:
    """Unihan : l'archive officielle d'unicode.org d'abord, le miroir GitHub ensuite."""
    unihan = source_unihan()
    assert unihan.urls == (UNIHAN_UNICODE, UNIHAN_MIROIR)
    assert unihan.url.startswith("https://www.unicode.org/")
    assert unihan.entete_attendue == ENTETE_UNIHAN
    assert unihan.membre == "Unihan_Readings.txt"
    assert unihan.licence == "Unicode License"


def test_entete_unihan_lue_dans_l_archive(tmp_path: Path) -> None:
    """L'en-tête officiel est cherché dans un membre de l'archive, pas à sa racine."""
    dest = tmp_path / "Unihan.zip"
    dest.write_bytes(archive(ENTETE_LECTURES + "U+4E00\tkMandarin\tyī\n"))
    assert entete_presente(dest, ENTETE_UNIHAN, membre="Unihan_Readings.txt")
    assert not entete_presente(dest, ENTETE_UNIHAN)


def test_archive_unihan_sans_entete_refusee(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Une archive qui ne porte pas l'en-tête d'Unicode est refusée, rien n'est écrit."""
    monkeypatch.setattr(
        module,
        "recuperer",
        servir({UNIHAN_UNICODE: None, UNIHAN_MIROIR: archive("# autre chose\n")}),
    )
    dest = tmp_path / "Unihan.zip"
    resultat = telecharger(source_unihan(), dest)
    assert resultat.echec
    assert "en-tête officiel absent" in resultat.etat
    assert not dest.exists()


def test_repli_unihan_sur_le_miroir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """unicode.org injoignable : le miroir sert la même archive, l'en-tête est vérifiée."""
    monkeypatch.setattr(
        module,
        "recuperer",
        servir({UNIHAN_UNICODE: None, UNIHAN_MIROIR: archive(ENTETE_LECTURES)}),
    )
    dest = tmp_path / "Unihan.zip"
    assert telecharger(source_unihan(), dest) == Resultat(REPLI, UNIHAN_MIROIR)
    assert entete_presente(dest, ENTETE_UNIHAN, membre="Unihan_Readings.txt")


def test_l_empreinte_est_la_meme_fonction_partout() -> None:
    """Une seule implémentation du SHA-256 d'un fichier, partagée (`outils.py`)."""
    from zilin_data import export as export_mod
    from zilin_data.outils import empreinte_fichier

    assert empreinte is empreinte_fichier
    assert export_mod.empreinte_fichier is empreinte_fichier
