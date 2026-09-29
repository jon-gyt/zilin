"""L'image du chemin (décisions du propriétaire du 29 septembre 2026) : un test par règle.

- aucun texte affiché ne dit graine, forêt, arbre, borne ni stèle ;
- chacun des cinq mots est refusé, au singulier comme au pluriel, quelle que soit la casse ;
- « l'arbre des caractères », la décomposition, reste permis ;
- le contenu n'est pas relu : 翰林, « la forêt des pinceaux », est le nom d'un rang ;
- `wenlu check` porte le contrôle, bloquant.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from wenlu_data import cli
from wenlu_data.vocabulaire import SOURCES, controles, fautes, fichiers, mots_interdits


def test_les_textes_affiches_versionnes_suivent_le_chemin() -> None:
    assert fautes() == []
    assert all(c.ok for c in controles())


@pytest.mark.parametrize(
    ("texte", "mot"),
    [
        ("Graine plantée, une seule par jour", "graine"),
        ("Sept graines font un arbre.", "graines"),
        ("Une nouvelle porte : Ma forêt 林.", "forêt"),
        ("Deux ARBRES de plus.", "arbres"),
        ("Prochaine borne : 50 caractères.", "borne"),
        ("Sa stèle se dresse sur la route.", "stèle"),
    ],
)
def test_chaque_mot_de_l_ancienne_image_est_refuse(texte: str, mot: str) -> None:
    assert mot in mots_interdits(texte)


def test_les_mots_voisins_passent() -> None:
    assert mots_interdits("Une durée bornée, une pierre posée, un pavillon, une auberge 客栈.") == []


def test_l_arbre_de_la_decomposition_reste_permis() -> None:
    assert mots_interdits("L'arbre des caractères qui apprend à lire.") == []
    assert mots_interdits("L'arbre de décomposition, puis un arbre de plus.") == ["arbre"]


def test_le_contenu_et_le_rang_hanlin_ne_sont_pas_relus() -> None:
    relus = {f.relative_to(SOURCES).as_posix() for f, _ in fichiers()}
    assert "ecrans/chemin.tsv" in relus and "ouvertures/portes.tsv" in relus
    assert not any(r.startswith(("contes", "fiches", "devinettes", "anecdotes", "saisons")) for r in relus)
    assert "heros/rangs.tsv" not in relus


def test_une_source_qui_revient_a_la_foret_est_signalee(tmp_path: Path) -> None:
    (tmp_path / "ecrans").mkdir()
    (tmp_path / "ecrans" / "chemin.tsv").write_text(
        "cle\tfr\tsource\ncase\tMa forêt\trédigé pour l'app\n", encoding="utf-8"
    )
    (tmp_path / "ouvertures").mkdir()
    (tmp_path / "ouvertures" / "portes.tsv").write_text(
        "porte\tannonce\nroute\tLa borne du jour.\n", encoding="utf-8"
    )
    f = fautes(tmp_path)
    assert "ecrans/chemin.tsv:2 : fr dit forêt" in f
    assert "ouvertures/portes.tsv:2 : annonce dit borne" in f
    (c,) = controles(tmp_path)
    assert not c.ok and c.bloquant


def test_wenlu_check_porte_le_controle() -> None:
    import inspect

    assert "controles_vocabulaire()" in inspect.getsource(cli.check)
