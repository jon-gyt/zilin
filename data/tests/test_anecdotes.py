"""Les anecdotes du jour : source, contrôles, export.

Un test par règle. Aucun réseau. Les règles : un caractère par anecdote, jamais deux
fois le même ; un titre et un texte, de trois à cinq phrases, bornés en longueur, le
caractère cité ; chaque texte rédigé pour l'app, avec la nature de ce qui le fonde ;
pas d'emoji, pas de dragon ; une origine de caractère ou de mot porte l'étiquette
attesté ou mnémotechnique, une légende se dit comme telle ; `anecdotes.json` dit ce que
dit la source, avec son en-tête de licence, et chaque caractère se dessine.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import anecdotes as anecdotes_mod
from wenlu_data import export as export_mod
from wenlu_data.anecdotes import (
    OBJECTIF,
    REDIGE,
    Anecdote,
    charger,
    controles,
    document,
    fautes_charte,
    fautes_etymologie,
    fautes_export,
    fautes_forme,
    fautes_sources,
    phrases,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée

TEXTE = (
    "四 sì, quatre, sonne presque comme 死 sǐ, mourir. Beaucoup d'immeubles sautent le 4e étage,"
    " et l'on évite d'offrir quatre de quelque chose. À l'inverse, 八 bā, huit, ressemble à 发 fā,"
    " s'enrichir."
)
BONNE = Anecdote("四", "Pourquoi il n'y a pas de 4e étage.", TEXTE, "coutume", "", "a_relire", REDIGE, 1)


# ------------------------------------------------------------------- la source versionnée


def test_la_source_versionnee_passe_tous_les_controles_de_la_source() -> None:
    lues = charger()
    assert fautes_sources(lues) == []
    assert fautes_forme(lues) == []
    assert fautes_charte(lues) == []
    assert fautes_etymologie(lues) == []


def test_au_moins_soixante_anecdotes_ordinaires_chacune_redigee_pour_l_app() -> None:
    lues = charger()
    assert len(lues) >= OBJECTIF
    assert all(REDIGE in a.source for a in lues)
    assert REDIGE in anecdotes_mod.ANECDOTES.read_text(encoding="utf-8").split("\n", 5)[2]


def test_les_douze_de_la_maquette_restent_sauf_le_dragon() -> None:
    cs = {a.c for a in charger()}
    assert {"福", "四", "送", "红", "姓", "茶", "面", "筷", "岁", "春", "喜"} <= cs
    assert "龙" not in cs


# ------------------------------------------------------------------------- les règles


def test_une_anecdote_valide_ne_fait_aucune_faute() -> None:
    assert fautes_sources([BONNE]) == []
    assert fautes_forme([BONNE]) == []
    assert fautes_charte([BONNE]) == []
    assert fautes_etymologie([BONNE]) == []


def test_un_caractere_par_anecdote_jamais_deux_fois() -> None:
    assert any("déjà une anecdote" in f for f in fautes_sources([BONNE, replace(BONNE, numero=2)]))
    assert any("un seul caractère" in f for f in fautes_sources([replace(BONNE, c="四八")]))
    assert any("un seul caractère" in f for f in fautes_sources([replace(BONNE, c="")]))


def test_titre_texte_et_source_sont_exiges() -> None:
    fautes = fautes_sources([replace(BONNE, titre="", texte="", source="")])
    assert {"sans titre", "sans texte", "sans source"} <= {f.split(" : 四 ")[-1] for f in fautes}
    assert any("rédigé pour l'app" in f for f in fautes_sources([replace(BONNE, source="Wikipédia")]))


def test_appui_etiquette_et_statut_ont_leurs_valeurs() -> None:
    fautes = fautes_sources([replace(BONNE, appui="blog", etiquette="probable", statut="vu")])
    assert any("appui inconnu" in f for f in fautes)
    assert any("étiquette inconnue" in f for f in fautes)
    assert any("statut inconnu" in f for f in fautes)


def test_trois_a_cinq_phrases() -> None:
    assert phrases(TEXTE) == 3
    deux = "Une phrase assez longue pour passer la borne des signes, avec 四 dedans et encore des mots. " * 2
    assert any("2 phrases" in f for f in fautes_forme([replace(BONNE, texte=deux.strip())]))
    trop = " ".join(["四 est un chiffre qui fait peur."] * 6)
    assert any("6 phrases" in f for f in fautes_forme([replace(BONNE, texte=trop)]))


def test_une_citation_qui_se_termine_par_un_point_d_interrogation_ne_coupe_pas_la_phrase() -> None:
    assert phrases("On lit : « un ami qui arrive de loin, n'est-ce pas une joie ? ». Puis on sourit. Voilà.") == 3


def test_longueurs_bornees_et_caractere_cite() -> None:
    assert any("titre de" in f for f in fautes_forme([replace(BONNE, titre="Court")]))
    assert any("texte de" in f for f in fautes_forme([replace(BONNE, texte="四 fait peur. Oui. Non.")]))
    sans = replace(BONNE, titre="Pourquoi il n'y a pas d'étage.", texte=TEXTE.replace("四", "quatre"))
    assert any("n'apparaît ni" in f for f in fautes_forme([sans]))


def test_ni_emoji_ni_dragon() -> None:
    assert any("emoji" in f for f in fautes_charte([replace(BONNE, titre=BONNE.titre + " \U0001F409")]))
    assert any("dragon" in f for f in fautes_charte([replace(BONNE, texte=TEXTE + " Le dragon aussi.")]))
    assert any("dragon" in f for f in fautes_charte([replace(BONNE, texte=TEXTE + " 龙 aussi.")]))


def test_une_origine_sans_etiquette_est_refusee() -> None:
    etym = replace(BONNE, texte=TEXTE + " Le caractère vient d'un dessin de tortue.")
    assert any("sans étiquette" in f for f in fautes_etymologie([etym]))
    assert fautes_etymologie([replace(etym, etiquette="atteste")]) == []
    assert fautes_etymologie([replace(etym, etiquette="mnemotechnique")]) == []
    assert any("histoire d'un caractère" in f for f in fautes_etymologie([replace(BONNE, appui="ecriture")]))


def test_revenu_n_est_pas_une_origine() -> None:
    assert fautes_etymologie([replace(BONNE, texte=TEXTE + " Il est revenu de la mer.")]) == []


def test_une_legende_se_dit_comme_telle() -> None:
    assert any("légende" in f for f in fautes_etymologie([replace(BONNE, appui="legende")]))
    assert fautes_etymologie([replace(BONNE, appui="legende", texte=TEXTE + " La légende le raconte.")]) == []


# ----------------------------------------------------------------------------- l'export


def test_le_document_porte_la_racine_et_ecarte_ce_qui_ne_se_dessine_pas(tmp_path: Path) -> None:
    source = tmp_path / "anecdotes.tsv"
    lignes = ["\t".join(anecdotes_mod.COLONNES)]
    for c in ("明", "龟"):
        lignes.append("\t".join([c, f"Titre de {c}.", TEXTE.replace("四", c), "langue", "", "a_relire", REDIGE]))
    source.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    doc = document(racines={"明": "日"}, en_tete={"version": "0.2.0"}, source=source)
    assert doc["version"] == "0.2.0"
    assert [a["c"] for a in doc["anecdotes"]] == ["明"]  # type: ignore[index]
    assert doc["anecdotes"][0]["racine"] == "日"  # type: ignore[index]
    assert "etiquette" not in doc["anecdotes"][0]  # type: ignore[index]
    lues = charger(source)
    assert any("non exportée" in f for f in fautes_export(lues, doc, {"明"}))
    assert any("sans traits" in f for f in fautes_export(lues[:1], doc, set()))


def test_l_export_ecrit_anecdotes_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "anecdotes.json" in rapport.fichiers
    doc = lire(rapport.dossier, "anecdotes.json")
    assert export_mod.fautes_de_licence("anecdotes.json", doc) == []
    assert doc["source"] == anecdotes_mod.SOURCE_EXPORT
    # l'atelier ne dessine que quelques caractères : seules leurs anecdotes s'écrivent
    assert {a["c"] for a in doc["anecdotes"]} <= set("木日月十口亻休明古林")  # type: ignore[union-attr]


def test_changer_une_anecdote_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "anecdotes.tsv"
    copie.write_text(anecdotes_mod.ANECDOTES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(anecdotes_mod, "ANECDOTES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(
    not (VERSIONNE / "anecdotes.json").exists(), reason="anecdotes.json pas encore exporté"
)


@versionne
def test_l_export_versionne_passe_les_controles_bloquants_des_anecdotes() -> None:
    assert [c.nom for c in controles() if c.bloquant and not c.ok] == []


@versionne
def test_l_export_versionne_dessine_chaque_caractere_depuis_sa_famille() -> None:
    doc = json.loads((VERSIONNE / "anecdotes.json").read_text(encoding="utf-8"))
    assert len(doc["anecdotes"]) >= OBJECTIF
    for a in doc["anecdotes"]:
        assert (VERSIONNE / "traits" / f"{export_mod.nom_fichier(a['racine'])}.json").exists(), a["c"]
