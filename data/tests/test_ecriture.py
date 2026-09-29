"""Les gabarits de l'écriture au doigt (`ecriture.py`) : géométrie, format, licence, contrôles.

Un test par règle. Aucun réseau : des médianes écrites à la main, un export et une ingestion
en miniature dans un dossier temporaire.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data import ecriture as e
from wenlu_data import export as export_mod
from wenlu_data import fonts as fonts_mod

from test_export import atelier, lire  # noqa: F401 — fixture partagée

LICENCES = Path(__file__).resolve().parents[1] / "sources" / "licences"

#: Trois caractères en miniature : une barre, une croix, un carré ouvert, au repère de Make Me a Hanzi.
MEDIANES = {
    "一": [[[100, 400], [900, 400]]],
    "十": [[[100, 400], [900, 400]], [[500, 800], [500, 0]]],
    "口": [[[200, 700], [200, 100]], [[200, 700], [800, 700], [800, 100]], [[200, 100], [800, 100]]],
}
LISTES = {"hsk-1": ["一", "十"], "hsk-2": ["口"], "seuil-255": ["人"]}


def ingestion(dossier: Path, listes: dict = LISTES, medianes: dict = MEDIANES) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "listes.json").write_text(json.dumps(listes, ensure_ascii=False), encoding="utf-8")
    graphies = [{"c": c, "strokes": ["M 0 0"] * len(m), "medians": m} for c, m in medianes.items()]
    (dossier / "graphies.json").write_text(json.dumps(graphies, ensure_ascii=False), encoding="utf-8")
    return dossier


def export_mini(dossier: Path, ingest: Path, *, index: dict | None = None) -> Path:
    """Une version exportée qui ne porte que l'index et les fichiers de `ecriture/`."""
    version = dossier / "0.1.0"
    version.mkdir(parents=True, exist_ok=True)
    for relatif, texte in e.fichiers("0.1.0", ingest=ingest, licences=LICENCES, jour="2026-09-29").items():
        (version / relatif).parent.mkdir(parents=True, exist_ok=True)
        (version / relatif).write_text(texte, encoding="utf-8")
    (version / "index.json").write_text(json.dumps(index or {"ecriture": e.FICHIER}), encoding="utf-8")
    return dossier


# ------------------------------------------------------------------------ géométrie


def test_un_trait_se_reechantillonne_en_points_egalement_espaces() -> None:
    pts = e.reechantillonner([(0, 0), (1, 0), (2, 0), (70, 0)])
    assert len(pts) == e.POINTS
    assert pts[0] == (0, 0) and pts[-1] == pytest.approx((70, 0))
    pas = [b[0] - a[0] for a, b in zip(pts, pts[1:])]
    assert pas == pytest.approx([70 / (e.POINTS - 1)] * (e.POINTS - 1))


def test_un_point_reste_un_point() -> None:
    assert e.reechantillonner([(5, 5)]) == [(5.0, 5.0)] * e.POINTS
    assert e.reechantillonner([(5, 5), (5, 5)]) == [(5.0, 5.0)] * e.POINTS


def test_la_boite_est_centree_et_garde_ses_proportions() -> None:
    (barre,) = e.gabarit(MEDIANES["一"])
    assert [x for x, _ in barre] == [e.cran(-0.5 + i / (e.POINTS - 1)) for i in range(e.POINTS)]
    assert {y for _, y in barre} == {e.cran(0)}
    xs = [x for t in e.gabarit(MEDIANES["口"]) for x, _ in t]
    ys = [y for t in e.gabarit(MEDIANES["口"]) for _, y in t]
    assert (min(xs), max(xs), min(ys), max(ys)) == (0, e.NIVEAUX - 1, 0, e.NIVEAUX - 1)


def test_y_est_retourne_vers_le_bas_comme_sur_un_ecran() -> None:
    """丨 de 十 descend : dans Make Me a Hanzi, y décroît ; sur l'écran, il croît."""
    _, vertical = e.gabarit(MEDIANES["十"])
    assert vertical[0][1] < vertical[-1][1]


def test_chaque_cran_tient_dans_un_signe_base64() -> None:
    assert len(e.ALPHABET) == e.NIVEAUX == 64
    assert e.cran(-0.5) == 0 and e.cran(0.5) == e.NIVEAUX - 1
    assert e.cran(-3) == 0 and e.cran(3) == e.NIVEAUX - 1


# ------------------------------------------------------------------------ format


def test_les_caracteres_du_hsk_niveau_par_niveau_sans_doublon() -> None:
    listes = {"hsk-2": ["口", "一"], "hsk-1": ["一", "十"], "seuil-255": ["人"]}
    assert e.caracteres_hsk(listes) == ["一", "十", "口"]


def test_encoder_puis_decoder_rend_les_memes_crans() -> None:
    traits, gabarits = e.encoder(list(MEDIANES), MEDIANES)
    assert traits == "BCD"
    assert len(gabarits) == 6 * e.POINTS * 2
    lus = e.decoder({"caracteres": "一十口", "traits": traits, "gabarits": gabarits})
    assert lus == {c: e.gabarit(m) for c, m in MEDIANES.items()}


def test_le_document_porte_l_en_tete_de_l_arphic_public_license() -> None:
    doc = e.document("0.1.0", LISTES, MEDIANES, "2026-09-29")
    assert doc["license"] == "Arphic Public License"
    assert doc["license_file"] == "ARPHICPL.TXT"
    assert doc["source_url"] == e.URL
    assert "2026-09-29" in str(doc["modified"]) and "MODIFICATIONS.md" in str(doc["modified"])
    assert set(doc) <= e.CLES
    assert doc["listes"] == [[nom, len(LISTES.get(nom, ()))] for nom in e.LISTES_HSK]
    assert doc["caracteres"] == "一十口"


def test_un_caractere_du_hsk_sans_medianes_arrete_l_export() -> None:
    with pytest.raises(ValueError, match="sans médianes"):
        e.document("0.1.0", {"hsk-1": ["一", "丁"]}, MEDIANES, "2026-09-29")


def test_la_note_de_modification_dit_ce_qui_a_ete_change() -> None:
    note = e.modifications_md("0.1.0", 3000, "2026-09-29")
    for mot in ("rééchantillonnée", "retourné", "crans", "contours", "HSK 3.0", "ARPHICPL.TXT"):
        assert mot in note


# ------------------------------------------------------------------------ licences


def test_un_fichier_de_gabarits_sans_licence_ou_melange_est_une_faute() -> None:
    doc = e.document("0.1.0", LISTES, MEDIANES, "2026-09-29")
    assert e.fautes(doc, export_mod.ENTETE_LICENCE) == []
    assert "gabarits hors Arphic Public License" in e.fautes({**doc, "license": "propriétaire"}, ())
    assert any("clés étrangères" in f for f in e.fautes({**doc, "fiches": []}, ()))
    assert any("sans source" in f for f in e.fautes({**doc, "source": ""}, export_mod.ENTETE_LICENCE))


def test_l_export_ecrit_les_gabarits_sous_licence_et_l_index_les_nomme(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.1.0")
    dossier = rapport.dossier
    for relatif in (e.FICHIER, e.MODIFICATIONS, f"{e.DOSSIER}{e.ARPHIC}"):
        assert (dossier / relatif).exists(), relatif
    assert lire(dossier, "index.json")["ecriture"] == e.FICHIER
    doc = lire(dossier, e.FICHIER)
    assert export_mod.fautes_de_licence(e.FICHIER, doc) == []
    assert "@jour@" not in str(doc["modified"])
    licences = (dossier / "LICENCES.md").read_text(encoding="utf-8")
    assert "`ecriture/`" in licences


def test_la_police_ne_prend_pas_les_caracteres_des_gabarits(tmp_path: Path) -> None:
    dossier = export_mini(tmp_path / "public", ingestion(tmp_path / "ingest"))
    assert fonts_mod.caracteres_des_textes(dossier) == set()


# ------------------------------------------------------------------------ contrôles


def controles(tmp_path: Path, **kw) -> dict[str, object]:
    ingest = ingestion(tmp_path / "ingest")
    dossier = export_mini(tmp_path / "public", ingest, **kw)
    return {c.nom: c for c in e.controles(dossier, ingest)}


def test_les_controles_passent_sur_un_export_juste(tmp_path: Path) -> None:
    for nom, c in controles(tmp_path).items():
        assert c.ok, (nom, c.detail)


def test_un_index_qui_ne_nomme_pas_les_gabarits_est_bloquant(tmp_path: Path) -> None:
    c = controles(tmp_path, index={"version": "0.1.0"})["écriture : gabarits"]
    assert not c.ok and c.bloquant


def test_la_licence_absente_a_cote_est_bloquante(tmp_path: Path) -> None:
    ingest = ingestion(tmp_path / "ingest")
    dossier = export_mini(tmp_path / "public", ingest)
    (dossier / "0.1.0" / e.DOSSIER / e.ARPHIC).unlink()
    c = {x.nom: x for x in e.controles(dossier, ingest)}["écriture : gabarits"]
    assert not c.ok and c.bloquant and "ARPHICPL.TXT" in c.detail


def test_un_caractere_de_la_liste_absent_des_gabarits_est_bloquant(tmp_path: Path) -> None:
    ingest = ingestion(tmp_path / "ingest")
    dossier = export_mini(tmp_path / "public", ingest)
    # la liste gagne un caractère après l'export
    ingestion(ingest, listes={**LISTES, "hsk-3": ["丁"]}, medianes={**MEDIANES, "丁": MEDIANES["十"]})
    c = {x.nom: x for x in e.controles(dossier, ingest)}["écriture : couverture"]
    assert not c.ok and c.bloquant and "丁" in c.detail


def test_un_gabarit_qui_n_a_pas_les_traits_de_ses_medianes_est_bloquant(tmp_path: Path) -> None:
    ingest = ingestion(tmp_path / "ingest")
    dossier = export_mini(tmp_path / "public", ingest)
    ingestion(ingest, medianes={**MEDIANES, "口": MEDIANES["口"][:2]})
    c = {x.nom: x for x in e.controles(dossier, ingest)}["écriture : couverture"]
    assert not c.ok and c.bloquant and "口 3 traits pour 2 médianes" in c.detail


def test_au_dela_du_budget_c_est_bloquant(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(e, "BUDGET_OCTETS", 100)
    c = controles(tmp_path)["écriture : taille"]
    assert not c.ok and c.bloquant
