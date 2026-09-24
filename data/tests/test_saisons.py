"""Les vingt-quatre termes solaires : calendrier, textes, export et contrôles. Aucun réseau.

Les dates de référence sont celles des éphémérides publiées, à l'heure de Pékin :
秋分 2026-09-23 (08:05), 冬至 2026-12-22 (04:50), 立春 2027-02-04 (09:46), 夏至
2026-06-21, 清明 2026-04-05. Elles sont aussi relues dans l'autre sens : pour chaque
jour de début du calendrier, `lunar_python` doit nommer le même terme.
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import saisons as saisons_mod
from wenlu_data.saisons import (
    AMBIANCES,
    ORDRE,
    calculer,
    charger_termes,
    charger_textes,
    controles,
    debut_de,
    fautes_termes,
    fautes_textes,
    textes_par_terme,
    tsv_termes,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée


# ---------------------------------------------------------------------------- dates


@pytest.mark.parametrize(
    ("nom", "annee", "attendue"),
    [
        ("秋分", 2026, "2026-09-23"),
        ("冬至", 2026, "2026-12-22"),
        ("立春", 2027, "2027-02-04"),
        ("立春", 2026, "2026-02-04"),
        ("夏至", 2026, "2026-06-21"),
        ("清明", 2026, "2026-04-05"),
        ("白露", 2026, "2026-09-07"),
        ("冬至", 2028, "2028-12-21"),
    ],
)
def test_les_dates_connues_sortent_de_lunar_python(nom: str, annee: int, attendue: str) -> None:
    assert debut_de(nom, annee).isoformat() == attendue


def test_l_heure_est_celle_de_pekin() -> None:
    """秋分 2026 tombe le 23 à 08:05 à Pékin, soit le 23 à 00:05 UTC : même jour."""
    automne = next(e for e in calculer(2026, 2026) if e.nom == "秋分")
    assert (automne.debut, automne.heure) == ("2026-09-23", "08:05:14")
    hiver = next(e for e in calculer(2026, 2026) if e.nom == "冬至" and e.debut.startswith("2026"))
    assert hiver.heure.startswith("04:50")


def test_chaque_jour_de_debut_porte_son_terme_pour_la_bibliotheque() -> None:
    """Contre-vérification : relu dans l'autre sens, chaque jour de début est celui du terme."""
    from lunar_python import Solar

    for e in charger_termes():
        a, m, j = map(int, e.debut.split("-"))
        assert Solar.fromYmd(a, m, j).getLunar().getJieQi() == e.nom, e


def test_le_calendrier_couvre_chaque_jour_de_2026_a_2035_sans_trou() -> None:
    entrees = charger_termes()
    assert entrees[0].debut <= "2026-01-01" and entrees[-1].fin > "2035-12-31"
    assert len({(e.nom, e.debut[:4]) for e in entrees if "2026" <= e.debut[:4] <= "2035"}) == 240
    for a, b in zip(entrees, entrees[1:]):
        assert a.fin == b.debut
    # chaque jour a un et un seul terme
    jour, fin = date(2026, 1, 1), date(2035, 12, 31)
    while jour <= fin:
        iso = jour.isoformat()
        assert sum(1 for e in entrees if e.debut <= iso < e.fin) == 1, iso
        jour += timedelta(days=30)


def test_les_termes_se_suivent_dans_l_ordre_de_l_annee() -> None:
    noms = [e.nom for e in charger_termes()]
    ordre = [t.nom for t in ORDRE]
    depart = ordre.index(noms[0])
    assert noms == [ordre[(depart + i) % 24] for i in range(len(noms))]


def test_le_calendrier_versionne_est_celui_que_la_commande_ecrit() -> None:
    """`termes.tsv` n'est jamais édité à la main : le recalcul redonne les mêmes octets."""
    assert saisons_mod.TERMES.read_text(encoding="utf-8") == tsv_termes(calculer())


def test_le_calendrier_versionne_est_sans_faute() -> None:
    assert fautes_termes(charger_termes()) == []


def test_une_date_retouchee_ou_un_trou_sont_des_fautes() -> None:
    entrees = charger_termes()
    i = next(i for i, e in enumerate(entrees) if e.debut == "2026-09-23")
    retouche = list(entrees)
    retouche[i] = saisons_mod.Entree(**{**entrees[i].__dict__, "debut": "2026-09-22"})
    retouche[i - 1] = saisons_mod.Entree(**{**entrees[i - 1].__dict__, "fin": "2026-09-22"})
    assert any("2026-09-22" in f and "autre date" in f for f in fautes_termes(retouche))
    trou = entrees[:i] + entrees[i + 1:]
    assert any("finit le" in f for f in fautes_termes(trou, recalculer=False))
    assert any("n'a pas de terme" in f for f in fautes_termes(entrees[5:], recalculer=False))


# ---------------------------------------------------------------------------- textes


def test_les_textes_versionnes_sont_complets_et_sources() -> None:
    textes = charger_textes()
    assert fautes_textes(textes) == []
    assert all(t.source == "rédigé pour l'app" for t in textes)


def test_chaque_terme_a_son_caractere_a_lire_propre() -> None:
    par = textes_par_terme(charger_textes())
    caracteres = [par[t.id]["c"][0] for t in ORDRE]
    assert len(set(caracteres)) == 24
    assert par["bailu"]["c"] == ["露"] and par["xiaoxue"]["c"] == ["雪"] and par["jingzhe"]["c"] == ["雷"]
    assert par["qiufen"]["fr"] == ["l'équinoxe d'automne"]
    assert par["bailu"]["pinyin"] == ["báilù"]


def test_huit_ambiances_de_trois_termes_consecutifs() -> None:
    par = textes_par_terme(charger_textes())
    ambiances = [par[t.id]["ambiance"][0] for t in ORDRE]
    assert [ambiances[i] for i in range(0, 24, 3)] == list(AMBIANCES)
    for i in range(0, 24, 3):
        assert len(set(ambiances[i:i + 3])) == 1, ORDRE[i].nom


def test_tao_dit_une_ou_deux_phrases_et_la_ligne_tient_en_une_phrase() -> None:
    par = textes_par_terme(charger_textes())
    for t in ORDRE:
        assert 1 <= len(par[t.id]["tao"]) <= 2, t.nom
        assert par[t.id]["ligne"][0].count(". ") == 0, t.nom


def test_pas_de_dragon_meme_a_jingzhe() -> None:
    for t in charger_textes():
        assert "dragon" not in t.valeur.lower() and "龙" not in t.valeur, f"textes.tsv:{t.numero}"
    fautes = fautes_textes([*charger_textes(), saisons_mod.Texte("jingzhe", "tao", "Le 龙 s'éveille.", "x", 999)])
    assert any("dragon" in f for f in fautes)


def test_un_texte_manquant_une_ambiance_inconnue_un_caractere_repete_sont_des_fautes() -> None:
    textes = [t for t in charger_textes() if not (t.terme == "bailu" and t.cle == "ligne")]
    textes = [
        saisons_mod.Texte(t.terme, t.cle, "orage", t.source, t.numero)
        if (t.terme, t.cle) == ("dashu", "ambiance")
        else saisons_mod.Texte(t.terme, t.cle, "雪", t.source, t.numero)
        if (t.terme, t.cle) == ("hanlu", "c")
        else t
        for t in textes
    ]
    fautes = " | ".join(fautes_textes(textes))
    assert "bailu : sans ligne" in fautes
    assert "ambiance inconnue 'orage'" in fautes
    assert "xiaoxue : 雪 est déjà le caractère de hanlu" in fautes


# ---------------------------------------------------------------------------- export


def test_l_export_ecrit_saisons_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.1.0")
    document = lire(rapport.dossier, "saisons.json")
    assert export_mod.fautes_de_licence("saisons.json", document) == []
    assert "rédigés pour l'app" in str(document["source"])
    assert "lunar_python" in str(document["source"])
    assert lire(rapport.dossier, "index.json")["saisons"] == "saisons.json"
    assert document["ambiances"] == list(AMBIANCES)
    assert document["rubrique"] and "vingt-quatre" in str(document["explication"])
    automne = next(e for e in document["calendrier"] if e["debut"] == "2026-09-23")  # type: ignore[union-attr]
    assert automne == {"terme": "qiufen", "debut": "2026-09-23", "fin": "2026-10-08"}
    qiufen = document["termes"]["qiufen"]  # type: ignore[index]
    assert qiufen["nom_zh"] == "秋分" and qiufen["fr"] == "l'équinoxe d'automne"
    assert qiufen["caractere"]["c"] == "半" and qiufen["caractere"]["sens"] == "la moitié"
    assert len(document["termes"]) == 24  # type: ignore[arg-type]


def test_le_caractere_d_un_terme_entre_dans_le_perimetre(atelier: Path) -> None:  # noqa: F811
    """日 (夏至) et 明 (清明) sont dans le build miniature : exportés, avec leur racine."""
    rapport = export_mod.export("0.1.0")
    document = lire(rapport.dossier, "saisons.json")
    assert document["racines"]["日"] == "日"  # type: ignore[index]
    assert document["racines"]["明"] == "日"  # type: ignore[index]
    assert document["termes"]["xiazhi"]["caractere"]["pinyin"] == "rì"  # type: ignore[index]


def test_changer_un_texte_de_terme_rend_l_export_perime(atelier: Path, tmp_path: Path, monkeypatch) -> None:  # noqa: F811
    copie = tmp_path / "textes.tsv"
    copie.write_text(saisons_mod.TEXTES.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(saisons_mod, "TEXTES", copie)
    export_mod.export("0.1.0")
    a_jour = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert a_jour["export : à jour"].ok
    copie.write_text(copie.read_text(encoding="utf-8").replace("Tout est blanc !", "Tout est blanc."), encoding="utf-8")
    perime = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert not perime["export : à jour"].ok


# ---------------------------------------------------------------------------- check


def test_le_controle_voit_un_caractere_de_terme_sans_traits(atelier: Path) -> None:  # noqa: F811
    export_mod.export("0.1.0")
    resultats = {c.nom: c for c in controles(export_mod.EXPORT)}
    assert resultats["saisons : calendrier"].ok
    assert resultats["saisons : textes"].ok
    dessines = resultats["saisons : caractères dessinés"]
    assert not dessines.ok and dessines.bloquant
    assert "0.1.0:露" in dessines.detail and "0.1.0:日" not in dessines.detail


def test_sans_export_le_controle_des_caracteres_ne_bloque_pas(tmp_path: Path) -> None:
    assert {c.nom: c for c in controles(tmp_path / "vide")}["saisons : caractères dessinés"].ok


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "saisons.json").exists(), reason="export versionné absent")
def test_l_export_versionne_dessine_le_caractere_de_chaque_terme() -> None:
    document = json.loads((VERSIONNE / "saisons.json").read_text(encoding="utf-8"))
    caracteres = {t["caractere"]["c"]: t["caractere"]["pinyin"] for t in document["termes"].values()}
    assert set(document["racines"]) == set(caracteres)
    assert caracteres["露"] == "lù" and caracteres["雪"] == "xuě"
    assert all(caracteres.values())
    assert all(c.ok for c in controles())
