"""Deux outils que plusieurs étapes du pipeline partagent.

`ingest`, `gf0014` et `graphe` écrivaient le même JSON avec trois copies de la
même fonction ; `fetch` et `export` calculaient la même empreinte avec deux.
La règle d'écriture — UTF-8 sans échappement, indentation d'un espace, dossier
créé au besoin — et le SHA-256 d'un fichier tiennent ici : un changement de
format n'a plus qu'un seul endroit où se faire.

Rien d'autre n'entre dans ce module : il ne doit dépendre que de la bibliothèque
standard, pour rester importable depuis n'importe quelle étape.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

#: Taille des blocs lus pour l'empreinte : 1 Mio.
BLOC = 1 << 20


def ecrire_json(chemin: Path, contenu: object) -> Path:
    """Écrit `contenu` en JSON UTF-8 lisible. Rend le chemin écrit."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=1), encoding="utf-8")
    return chemin


def empreinte_fichier(chemin: Path) -> str:
    """SHA-256 du fichier, en hexadécimal, lu par blocs."""
    h = hashlib.sha256()
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(BLOC), b""):
            h.update(bloc)
    return h.hexdigest()
