"""Téléchargement des sources brutes dans data/work/sources/.

Idempotent : un fichier déjà présent n'est pas retéléchargé (sauf `force=True`).
Chaque source déclare une URL officielle et, éventuellement, des URL de repli
(miroirs) essayées dans l'ordre si l'officielle échoue (réseau ou 4xx/5xx).
Une source peut exiger un en-tête : le fichier obtenu est refusé s'il ne le
porte pas, et le repli suivant est tenté.

Chaque passage réécrit data/work/sources/SHA256SUMS et complète
data/work/sources/PROVENANCE.md (URL réellement servie, date, taille, empreinte).
"""
from __future__ import annotations

import gzip
import hashlib
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx

from .ingest import ouvrir_texte
from .paths import SOURCES
from . import cjkdecomp, unihan

MMAH = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/"

# CC-CEDICT : URL officielle MDBG d'abord, puis les sauvegardes datées du même
# fichier publiées sur GitHub (le dépôt miroir télécharge l'archive MDBG et la
# décompresse ; le fichier servi est donc le fichier officiel, non compressé).
CEDICT_MDBG = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
CEDICT_MIROIR = "https://raw.githubusercontent.com/qundao/backup-cc-cedict/main/cedict.txt"

# Ligne d'en-tête officielle de CC-CEDICT : son absence vaut refus du fichier.
ENTETE_CEDICT = "#! license=https://creativecommons.org/licenses/by-sa/4.0/"

# Unihan : l'archive officielle d'Unicode d'abord. `unicode.org` étant bloqué
# depuis certains réseaux, le repli est un miroir GitHub qui sert la même
# archive (empreinte relevée dans PROVENANCE.md). L'en-tête officiel est
# cherché dans un membre de l'archive, pas à sa racine.
UNIHAN_UNICODE = unihan.URL_OFFICIELLE
UNIHAN_MIROIR = unihan.URL_MIROIR
ENTETE_UNIHAN = unihan.ENTETE

# cjk-decomp : décompositions sous licence permissive, source d'IDS de repli.
# Le projet d'origine (codeplex) a fermé ; le fork `amake` fait référence.
CJKDECOMP = cjkdecomp.URL


@dataclass(frozen=True)
class Source:
    nom: str
    fichier: str
    url: str
    licence: str
    replis: tuple[str, ...] = field(default_factory=tuple)
    entete_attendue: str | None = None
    membre: str | None = None  # fichier à ouvrir dans l'archive pour l'en-tête

    @property
    def urls(self) -> tuple[str, ...]:
        """URL officielle d'abord, replis ensuite."""
        return (self.url, *self.replis)


SOURCES_DISTANTES: tuple[Source, ...] = (
    Source(
        nom="Make Me a Hanzi — dictionnaire",
        fichier="dictionary.txt",
        url=MMAH + "dictionary.txt",
        licence="LGPL 3.0 (données)",
    ),
    Source(
        nom="Make Me a Hanzi — graphies",
        fichier="graphics.txt",
        url=MMAH + "graphics.txt",
        licence="Arphic Public License (tracés)",
    ),
    Source(
        nom="CC-CEDICT",
        fichier="cedict_1_0_ts_utf-8_mdbg.txt.gz",
        url=CEDICT_MDBG,
        licence="CC BY-SA 4.0",
        replis=(CEDICT_MIROIR,),
        entete_attendue=ENTETE_CEDICT,
    ),
    Source(
        nom="Unihan (UCD)",
        fichier=unihan.ARCHIVE,
        url=UNIHAN_UNICODE,
        licence=unihan.LICENCE,
        replis=(UNIHAN_MIROIR,),
        entete_attendue=ENTETE_UNIHAN,
        membre=unihan.MEMBRE_TEMOIN,
    ),
    Source(
        nom="cjk-decomp",
        fichier="cjk-decomp.txt",
        url=CJKDECOMP,
        licence=cjkdecomp.LICENCE,
    ),
)


def empreinte(chemin: Path) -> str:
    """SHA-256 du fichier, en hexadécimal."""
    h = hashlib.sha256()
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


PRESENT = "déjà présent"
TELECHARGE = "téléchargé"
REPLI = "téléchargé depuis un miroir de repli"
ENTETE_ABSENTE = "en-tête officiel absent"
INCHANGE = "— (inchangé, voir le bloc du téléchargement)"


@dataclass(frozen=True)
class Resultat:
    """État d'une source et URL qui a réellement servi (None si aucune)."""

    etat: str
    url: str | None = None

    @property
    def echec(self) -> bool:
        return self.etat.startswith("échec")


def recuperer(url: str, dest: Path) -> str | None:
    """Écrit `url` dans `dest`. Retourne None en cas de succès, un message sinon."""
    try:
        with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as reponse:
            reponse.raise_for_status()
            with dest.open("wb") as f:
                for bloc in reponse.iter_bytes(1 << 16):
                    f.write(bloc)
    except httpx.HTTPError as erreur:
        dest.unlink(missing_ok=True)
        return f"{type(erreur).__name__} {erreur}"
    return None


def entete_presente(
    chemin: Path, attendue: str, *, lignes: int = 60, membre: str | None = None
) -> bool:
    """Vrai si `attendue` figure dans les premières lignes, compressées ou non.

    `membre` nomme le fichier à ouvrir quand la source est une archive zip :
    l'en-tête officiel d'Unihan est porté par chaque `Unihan_*.txt`, pas par
    l'archive.
    """
    try:
        if membre is not None:
            with zipfile.ZipFile(chemin) as archive:
                tete = archive.read(membre).decode("utf-8", "replace").splitlines()[:lignes]
            return any(attendue in ligne for ligne in tete)
        with ouvrir_texte(chemin) as f:
            for _ in range(lignes):
                ligne = f.readline()
                if not ligne:
                    return False
                if attendue in ligne:
                    return True
    except (OSError, KeyError, gzip.BadGzipFile, UnicodeDecodeError, zipfile.BadZipFile):
        return False
    return False


def telecharger(source: Source, dest: Path, *, force: bool = False) -> Resultat:
    """Écrit `source` dans `dest` en essayant l'URL officielle puis les replis."""
    if dest.exists() and not force:
        return Resultat(PRESENT)
    dest.parent.mkdir(parents=True, exist_ok=True)
    partiel = dest.with_suffix(dest.suffix + ".partiel")
    echecs: list[str] = []
    for url in source.urls:
        erreur = recuperer(url, partiel)
        if erreur is None and source.entete_attendue is not None:
            if not entete_presente(partiel, source.entete_attendue, membre=source.membre):
                partiel.unlink(missing_ok=True)
                erreur = f"{ENTETE_ABSENTE} ({source.entete_attendue})"
        if erreur is None:
            partiel.replace(dest)
            return Resultat(TELECHARGE if url == source.url else REPLI, url)
        echecs.append(f"{url} : {erreur}")
    return Resultat("échec : " + " ; ".join(echecs))


def ecrire_sommes(dossier: Path, sources: tuple[Source, ...]) -> Path:
    """Écrit SHA256SUMS au format `sha256sum` (empreinte, deux espaces, nom)."""
    lignes = [
        f"{empreinte(dossier / s.fichier)}  {s.fichier}"
        for s in sources
        if (dossier / s.fichier).exists()
    ]
    chemin = dossier / "SHA256SUMS"
    chemin.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    return chemin


def _resultat(valeur: Resultat | str) -> Resultat:
    return valeur if isinstance(valeur, Resultat) else Resultat(valeur)


def journaliser(
    dossier: Path, sources: tuple[Source, ...], etat: dict[str, Resultat | str]
) -> Path:
    """Ajoute au PROVENANCE.md un bloc daté : URL servie, taille, empreinte, action."""
    chemin = dossier / "PROVENANCE.md"
    if not chemin.exists():
        entete = (
            "# Provenance des sources\n\n"
            "Journal produit par `uv run zilin fetch`. Un bloc par passage.\n"
            "« URL servie » est l'URL dont le fichier provient réellement : l'URL\n"
            "officielle, ou un miroir de repli quand l'officielle a échoué.\n"
        )
        chemin.write_text(entete, encoding="utf-8")
    date = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    lignes = [
        f"\n## {date}\n",
        "| Fichier | URL servie | Octets | SHA-256 | Licence | Action |",
        "|---|---|---|---|---|---|",
    ]
    for s in sources:
        f = dossier / s.fichier
        octets = f.stat().st_size if f.exists() else 0
        somme = empreinte(f) if f.exists() else "—"
        resultat = _resultat(etat.get(s.fichier, "inconnu"))
        # Un fichier déjà présent ne vient d'aucune URL de ce passage : ne pas
        # laisser croire qu'il vient de l'URL officielle alors qu'un bloc
        # antérieur peut le donner comme venu d'un miroir.
        url = resultat.url or (INCHANGE if resultat.etat == PRESENT else s.url)
        lignes.append(
            f"| `{s.fichier}` | {url} | {octets} | `{somme}` | {s.licence} | {resultat.etat} |"
        )
    with chemin.open("a", encoding="utf-8") as sortie:
        sortie.write("\n".join(lignes) + "\n")
    return chemin


def fetch(*, force: bool = False, dossier: Path | None = None) -> dict[str, str]:
    """Télécharge toutes les sources. Retourne {fichier: état}."""
    dossier = dossier or SOURCES
    dossier.mkdir(parents=True, exist_ok=True)
    resultats = {
        s.fichier: telecharger(s, dossier / s.fichier, force=force) for s in SOURCES_DISTANTES
    }
    ecrire_sommes(dossier, SOURCES_DISTANTES)
    journaliser(dossier, SOURCES_DISTANTES, dict(resultats))
    return {fichier: r.etat for fichier, r in resultats.items()}
