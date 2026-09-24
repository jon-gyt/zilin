"""Fiches rédigées sans API : emplacements, brouillons, import, lots, relecture.

Aucun accès réseau, aucune clé d'API. Le corpus est celui, minuscule, de
`test_fiches.py` ; les textes des brouillons de test sont des suites de mots sans
contenu. Seul le dernier test lit les vrais brouillons du dépôt, pour vérifier que
chaque fiche importée porte l'empreinte de son brouillon.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from test_fiches import CARACTERES, corpus, table  # noqa: F401 — fixtures partagées
from wenlu_data import fiches, paths
from wenlu_data.cli import app as cli
from wenlu_data.fiches import (
    A_RELIRE,
    API_SESSION,
    MODELE_MANUEL,
    REJETE,
    RELU,
    BrouillonInvalide,
    Corpus,
    RelectureInvalide,
    a_rediger,
    appliquer_relecture,
    brouillon_depuis_json,
    exporter_relecture,
    fiches_ecrites,
    importer_brouillon,
    lire_brouillon,
    lire_fiche,
)


def aujourdhui() -> str:
    return "2026-09-24"


def brouillon(c: str = "住", **champs: object) -> dict[str, object]:
    """Un brouillon conforme pour 住 (jour 5 du corpus de test), modifiable champ à champ."""
    document: dict[str, object] = {
        "c": c,
        "origine_fr": "Une première. Une deuxième. Une troisième.",
        "origine_en": "One first. One second. One third.",
        "etiquette": "mnémotechnique",
        "memo_fr": None,
        "memo_en": None,
        "roles": {"亻": "sens", "主": "son"},
        "mots": [
            {"hanzi": "住口", "pinyin": "zhù kǒu", "fr": "un mot", "en": "a word"},
            {"hanzi": "问住", "pinyin": "wèn zhù", "fr": "un autre", "en": "another"},
        ],
        "phrase": {"zh": "主人住口。", "pinyin": "Zhǔrén zhù kǒu.", "fr": "Une phrase.", "en": "A sentence."},
    }
    document.update(champs)
    return document


def ecrire_brouillon(dossier: Path, document: dict[str, object]) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / f"{document['c']}.json"
    chemin.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")
    return chemin


@pytest.fixture
def depot(corpus: Corpus, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Brouillons, fiches, listes et corpus de test à la place de ceux du dépôt."""
    monkeypatch.setattr(fiches, "BROUILLONS", tmp_path / "brouillons")
    monkeypatch.setattr(fiches, "FICHES_WORK", tmp_path / "fiches")
    monkeypatch.setattr(fiches, "LISTES", tmp_path / "listes")
    monkeypatch.setattr(fiches, "RELECTURE", tmp_path / "work" / "relecture.json")
    monkeypatch.setattr(fiches, "charger_corpus", lambda *a, **k: corpus)
    monkeypatch.setattr(fiches, "_aujourdhui", aujourdhui)
    (tmp_path / "listes").mkdir()
    (tmp_path / "listes" / "seuil-6.txt").write_text("# test\n住\n问\n人\n口\n门\n主\n", encoding="utf-8")
    return tmp_path


# --------------------------------------------------------------------------- emplacements


def test_les_fiches_sont_versionnees_le_journal_des_lots_non() -> None:
    """Les fiches vivent dans `data/sources/fiches/`, le journal des lots dans `data/work/`."""
    assert paths.FICHES_WORK == paths.DATA / "sources" / "fiches"
    assert fiches.dossier_lots() == paths.WORK / "fiches" / "lots"
    assert fiches.dossier_lots(Path("ailleurs")) == Path("ailleurs") / "lots"


# --------------------------------------------------------------------------- import


def test_brouillon_conforme_importe_a_relire(corpus: Corpus, tmp_path: Path) -> None:
    """Contexte du corpus, `valider()`, écriture au statut `a_relire`."""
    chemin = ecrire_brouillon(tmp_path / "brouillons", brouillon())
    resultat = importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=aujourdhui)

    assert resultat.rapport.conforme
    fiche = lire_fiche(tmp_path / "住.json")
    assert fiche.statut == A_RELIRE
    assert (fiche.parcours, fiche.jour) == ("lire", 5)
    assert fiche.composants == ("亻", "主") and fiche.structure == "⿰亻主"
    assert fiche.etiquette == "mnemotechnique"  # écrit accentué, gardé en code


def test_import_trace_une_redaction_manuelle(corpus: Corpus, tmp_path: Path) -> None:
    """`generation` dit ce qu'est la fiche : une rédaction sans API, et de quel brouillon."""
    chemin = ecrire_brouillon(tmp_path / "brouillons", brouillon())
    importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=aujourdhui)

    generation = json.loads((tmp_path / "住.json").read_text(encoding="utf-8"))["generation"]
    assert generation == {
        "modele": MODELE_MANUEL,
        "api": API_SESSION,
        "date": "2026-09-24",
        "empreinte_invite": "sha256:" + hashlib.sha256(chemin.read_bytes()).hexdigest(),
        "essais": 1,
        "refus": [],
    }
    assert generation["api"] == "session Claude Code (sans API)"
    assert generation["modele"] == "rédaction manuelle"


def test_brouillon_hors_acquis_rejete_et_signale(corpus: Corpus, tmp_path: Path) -> None:
    """Un caractère pas encore posé dans la phrase : rejet, l'intrus est nommé."""
    phrase = {"zh": "主人住口，鸟。", "pinyin": "…", "fr": "…", "en": "…"}
    chemin = ecrire_brouillon(tmp_path / "brouillons", brouillon(phrase=phrase))
    resultat = importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=aujourdhui)

    assert not resultat.rapport.conforme
    assert resultat.rapport.intrus == ["鸟"]
    document = json.loads((tmp_path / "住.json").read_text(encoding="utf-8"))
    assert document["statut"] == REJETE
    assert document["generation"]["refus"] == ["phrase hors de l'acquis : 鸟"]


def test_commande_importer_affiche_les_ecarts_et_sort_en_1(depot: Path) -> None:
    phrase = {"zh": "主人住口，鸟。", "pinyin": "…", "fr": "…", "en": ""}
    ecrire_brouillon(depot / "brouillons", brouillon(phrase=phrase))
    ecrire_brouillon(depot / "brouillons", brouillon(c="问", roles={"门": "son", "口": "sens"},
                                                     mots=[], phrase={"zh": "人问。", "pinyin": "…",
                                                                      "fr": "…", "en": "…"}))

    resultat = CliRunner().invoke(cli, ["fiches", "importer"])
    assert resultat.exit_code == 1
    assert "rejet 住" in resultat.output
    assert "refus : phrase hors de l'acquis : 鸟" in resultat.output
    assert "acquis au jour 5 : 人口门问主亻住" in resultat.output
    assert "écart : traduction vide : phrase.en" in resultat.output
    assert "ok    问" in resultat.output
    assert lire_fiche(depot / "fiches" / "问.json").statut == A_RELIRE


def test_brouillon_mal_forme_rien_nest_ecrit(depot: Path) -> None:
    """Tous les problèmes de format d'un coup, et aucune fiche écrite."""
    document = brouillon(memo="oui", etiquette=3)
    del document["phrase"]
    document["mots"] = [{"hanzi": "住口", "pinyin": "zhù kǒu", "fr": "un mot"}]
    ecrire_brouillon(depot / "brouillons", document)
    with pytest.raises(BrouillonInvalide) as erreur:
        lire_brouillon(depot / "brouillons" / "住.json")
    texte = str(erreur.value)
    for attendu in ("champ manquant : phrase", "champ inconnu : memo", "etiquette", "mot 1 : en"):
        assert attendu in texte

    resultat = CliRunner().invoke(cli, ["fiches", "importer", "住"])
    assert resultat.exit_code == 1
    assert "brouillon illisible" in resultat.output
    assert fiches_ecrites(depot / "fiches") == []


def test_brouillon_au_mauvais_nom_refuse() -> None:
    with pytest.raises(BrouillonInvalide, match="nommé 问.json"):
        brouillon_depuis_json(brouillon(), empreinte="sha256:0", nom="问")


def test_etiquette_inconnue_passe_a_valider_qui_la_refuse(corpus: Corpus, tmp_path: Path) -> None:
    chemin = ecrire_brouillon(tmp_path / "brouillons", brouillon(etiquette="probable"))
    resultat = importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=aujourdhui)
    assert any("étiquette 'probable'" in motif for motif in resultat.rapport.refus)
    assert resultat.fiche.statut == REJETE


def test_brouillon_inchange_garde_la_relecture(corpus: Corpus, tmp_path: Path) -> None:
    """Réimporter le même brouillon ne touche pas une fiche relue ; le modifier la remet à relire."""
    chemin = ecrire_brouillon(tmp_path / "brouillons", brouillon())
    importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=aujourdhui)
    fiches.relire("住", RELU, tmp_path)
    avant = (tmp_path / "住.json").read_bytes()

    resultat = importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=lambda: "2027-01-01")
    assert resultat.inchange
    assert (tmp_path / "住.json").read_bytes() == avant

    ecrire_brouillon(tmp_path / "brouillons", brouillon(memo_fr="Un mémo."))
    resultat = importer_brouillon(lire_brouillon(chemin), corpus, dossier=tmp_path, horloge=aujourdhui)
    assert not resultat.inchange and resultat.remplace == RELU
    fiche = lire_fiche(tmp_path / "住.json")
    assert (fiche.statut, fiche.generation.essais, fiche.memo_fr) == (A_RELIRE, 2, "Un mémo.")


# --------------------------------------------------------------------------- aide à la rédaction


def test_contexte_donne_lacquis_et_les_candidats_sans_definition(depot: Path) -> None:
    resultat = CliRunner().invoke(cli, ["fiches", "contexte", "住", "问"])
    assert resultat.exit_code == 0, resultat.output
    sortie = resultat.output
    assert "== 住 (zhù) — parcours lire, jour 5" in sortie
    assert "Décomposition GF 0014-2009 : ⿰亻主" in sortie
    assert "人口门问主亻住" in sortie
    assert "- 住口 (zhu4 kou3)" in sortie and "鸟人" not in sortie
    assert "exactement 3 phrases" in sortie
    assert '"roles"' in sortie  # le squelette du brouillon
    for c in "住问":  # aucune définition anglaise
        assert str(CARACTERES[c]["definition_en"]) not in sortie


def test_contexte_hors_parcours_sort_en_1(depot: Path) -> None:
    resultat = CliRunner().invoke(cli, ["fiches", "contexte", "龍"])
    assert resultat.exit_code == 1
    assert "n'est pas posé" in resultat.output


# --------------------------------------------------------------------------- lots


def test_a_rediger_suit_le_parcours_et_decoupe_en_lots(corpus: Corpus, depot: Path) -> None:
    """Ordre du parcours, lots contigus et équilibrés, sans recouvrement ni trou."""
    tous = a_rediger(6, corpus, dossier=depot / "fiches", listes=depot / "listes")
    assert tous == ["人", "口", "门", "问", "主", "住"]
    lots = [a_rediger(6, corpus, lot=n, sur=4, dossier=depot / "fiches", listes=depot / "listes") for n in (1, 2, 3, 4)]
    assert lots == [["人", "口"], ["门", "问"], ["主"], ["住"]]
    with pytest.raises(ValueError):
        a_rediger(6, corpus, lot=5, sur=4, listes=depot / "listes")


def test_a_rediger_ecarte_les_fiches_conformes_et_garde_les_lots_stables(corpus: Corpus, depot: Path) -> None:
    """Une fiche conforme retire son caractère ; les lots ne glissent pas pour autant."""
    ecrire_brouillon(depot / "brouillons", brouillon())
    importer_brouillon(lire_brouillon(depot / "brouillons" / "住.json"), corpus, dossier=depot / "fiches")
    phrase = {"zh": "鸟。", "pinyin": "…", "fr": "…", "en": "…"}
    ecrire_brouillon(depot / "brouillons", brouillon(c="问", roles={}, mots=[], phrase=phrase))
    importer_brouillon(lire_brouillon(depot / "brouillons" / "问.json"), corpus, dossier=depot / "fiches")

    options = {"dossier": depot / "fiches", "listes": depot / "listes"}
    assert a_rediger(6, corpus, **options) == ["人", "口", "门", "问", "主"]  # 问 rejeté : à refaire
    assert a_rediger(6, corpus, lot=4, sur=4, **options) == []
    assert a_rediger(6, corpus, lot=3, sur=4, **options) == ["主"]

    resultat = CliRunner().invoke(cli, ["fiches", "a-rediger", "--seuil", "6", "--lot", "2", "--sur", "4"])
    assert resultat.exit_code == 0, resultat.output
    assert "lot 2 sur 4 : 2 caractères" in resultat.output
    assert resultat.output.strip().endswith("门 问")


# --------------------------------------------------------------------------- relecture


def _importer(corpus: Corpus, depot: Path, document: dict[str, object]) -> None:
    ecrire_brouillon(depot / "brouillons", document)
    chemin = depot / "brouillons" / f"{document['c']}.json"
    importer_brouillon(lire_brouillon(chemin), corpus, dossier=depot / "fiches")


def test_exporter_relecture_rassemble_les_fiches_a_relire(corpus: Corpus, depot: Path) -> None:
    _importer(corpus, depot, brouillon())
    _importer(corpus, depot, brouillon(c="问", roles={"门": "son"}, mots=[],
                                        phrase={"zh": "人问。", "pinyin": "…", "fr": "…", "en": "…"}))
    _importer(corpus, depot, brouillon(c="人", roles={}, mots=[], phrase={"zh": "鸟。", "pinyin": "…",
                                                                          "fr": "…", "en": "…"}))

    resultat = CliRunner().invoke(cli, ["fiches", "exporter-relecture"])
    assert resultat.exit_code == 0, resultat.output
    document = json.loads((depot / "work" / "relecture.json").read_text(encoding="utf-8"))
    assert [f["c"] for f in document["fiches"]] == ["问", "住"]  # par jour ; 人 rejeté n'y est pas
    assert "rôle absent pour 口" in document["fiches"][0]["ecarts"]
    assert document["decisions"] == [RELU, REJETE]


def test_appliquer_relecture(corpus: Corpus, depot: Path) -> None:
    _importer(corpus, depot, brouillon())
    _importer(corpus, depot, brouillon(c="问", roles={"门": "son", "口": "sens"}, mots=[],
                                        phrase={"zh": "人问。", "pinyin": "…", "fr": "…", "en": "…"}))
    decisions = depot / "decisions.json"
    decisions.write_text(json.dumps({"住": "relu", "问": "rejete", "口": None}), encoding="utf-8")

    resultat = CliRunner().invoke(cli, ["fiches", "appliquer-relecture", str(decisions)])
    assert resultat.exit_code == 0, resultat.output
    assert lire_fiche(depot / "fiches" / "住.json").statut == RELU
    assert lire_fiche(depot / "fiches" / "问.json").statut == REJETE
    assert "2 décisions appliquées" in resultat.output


def test_appliquer_relecture_tout_ou_rien(corpus: Corpus, depot: Path) -> None:
    """Une décision fautive, et rien n'est appliqué : ni statut inconnu, ni fiche absente,
    ni fiche rejetée aux contrôles marquée relue."""
    _importer(corpus, depot, brouillon())
    _importer(corpus, depot, brouillon(c="问", roles={}, mots=[], phrase={"zh": "鸟。", "pinyin": "…",
                                                                          "fr": "…", "en": "…"}))
    with pytest.raises(RelectureInvalide) as erreur:
        appliquer_relecture({"住": "relu", "问": "relu", "口": "relu", "人": "vu"}, depot / "fiches")
    assert len(erreur.value.problemes) == 3
    assert lire_fiche(depot / "fiches" / "住.json").statut == A_RELIRE

    fichier = depot / "decisions.json"
    fichier.write_text(json.dumps({"住": "peut-être"}), encoding="utf-8")
    resultat = CliRunner().invoke(cli, ["fiches", "appliquer-relecture", str(fichier)])
    assert resultat.exit_code == 1
    assert "Rien n'est appliqué" in resultat.output
    assert lire_fiche(depot / "fiches" / "住.json").statut == A_RELIRE


# --------------------------------------------------------------------------- dépôt


def test_chaque_fiche_redigee_porte_lempreinte_de_son_brouillon() -> None:
    """Traçabilité dans le dépôt : une fiche manuelle a son brouillon, et il n'a pas bougé depuis l'import."""
    for chemin in fiches_ecrites():
        fiche = lire_fiche(chemin)
        if fiche.generation.api != API_SESSION:
            continue
        source = fiches.BROUILLONS / f"{fiche.c}.json"
        assert source.exists(), f"{fiche.c} : brouillon absent"
        assert lire_brouillon(source).empreinte == fiche.generation.empreinte_invite, (
            f"{fiche.c} : brouillon modifié depuis l'import, relancer `wenlu fiches importer`"
        )
