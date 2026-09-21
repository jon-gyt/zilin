"""Sous-ensembles de caractères des polices embarquées. Aucun accès réseau."""
from __future__ import annotations

from zilin_data.fonts import (
    CHIFFRES,
    FONTES_A_PRODUIRE,
    LICENCES,
    PONCTUATION_CHINOISE,
    POLICES_DISTANTES,
    caracteres_de_liste,
    sous_ensemble_chinois,
    sous_ensemble_latin,
)

LISTE = """# Seuil sinographique 255
#   commentaire indenté, avec des caractères 天 地 à ignorer
人
大

  天
"""


def test_liste_ignore_les_commentaires() -> None:
    """Une liste de niveau : un caractère par ligne, `#` commente, lignes vides ignorées."""
    assert caracteres_de_liste(LISTE) == {"人", "大", "天"}


def test_sous_ensemble_chinois_reunit_traits_listes_ponctuation_et_chiffres() -> None:
    """Le woff2 chinois couvre ce que l'app affiche, et rien d'autre."""
    retenus = sous_ensemble_chinois(["字", "林", "亻"], [LISTE])
    assert set("字林亻人大天") <= set(retenus)
    assert set(PONCTUATION_CHINOISE) <= set(retenus)
    assert set(CHIFFRES) <= set(retenus)
    assert "地" not in retenus  # vu seulement dans un commentaire


def test_sous_ensemble_chinois_est_trie_et_sans_doublon() -> None:
    """La liste écrite dans app/public/fonts/ doit être rejouable à l'identique."""
    retenus = sous_ensemble_chinois(["字", "字", "林"], [LISTE, LISTE])
    assert list(retenus) == sorted(set(retenus))


def test_sous_ensemble_latin_couvre_le_francais() -> None:
    """Latin-1, Latin Extended-A, guillemets français, apostrophe courbe, insécable, tirets."""
    latin = set(sous_ensemble_latin())
    assert set("AZaz0123456789éèêàçùôïœŒÆæ") <= latin
    assert set("«» ") <= latin  # guillemets français et espace insécable
    assert set("’‘“”") <= latin  # apostrophes et guillemets courbes
    assert set("–—…") <= latin  # demi-cadratin, cadratin, points de suspension
    assert set("Łſ") <= latin  # Latin Extended-A
    assert "字" not in latin


def test_polices_declarees() -> None:
    """Cinq woff2 : Manrope 500 et 700, Source Sans 3 400 et 600, Noto Serif SC 500."""
    assert {(f.sortie, f.graisse) for f in FONTES_A_PRODUIRE} == {
        ("manrope-500.woff2", 500),
        ("manrope-700.woff2", 700),
        ("source-sans-3-400.woff2", 400),
        ("source-sans-3-600.woff2", 600),
        ("noto-serif-sc-500.woff2", 500),
    }
    sources = {s.fichier for s in POLICES_DISTANTES}
    assert {f.source for f in FONTES_A_PRODUIRE} <= sources
    assert set(LICENCES) <= sources  # chaque licence OFL est téléchargée puis copiée
    assert all(s.url.startswith("https://") and "Open Font License" in s.licence for s in POLICES_DISTANTES)
