"""Les lettres de Que (story 4b.8) : fil, validation, import, relecture, export, contrôles.

Un test par règle. Aucun réseau. Les règles : douze lettres, une par semaine, la lettre n
écrite avec les seuls caractères que le parcours Lire a posés au jour 7n (sinon rejet) ;
40 à 120 sinogrammes ; une question pour finir ; pinyin aux tons du dictionnaire, sans
sandhi, chaque syllabe une lecture du caractère ; glose complète ; traçabilité « session
Claude Code (sans API) » ; statut `a_relire` à l'import ; seules les lettres relues
entrent dans `lettres.json`, les autres dans l'aperçu.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import export as export_mod
from wenlu_data import lettres as lettres_mod
from wenlu_data import surcharges
from wenlu_data.cli import app as cli
from wenlu_data.contes import A_RELIRE, API_SESSION, MODELE_MANUEL, REJETE, RELU, Generation, Glose, Phrase
from wenlu_data.lettres import (
    Episode,
    FeuilletonInvalide,
    BrouillonInvalide,
    Lettre,
    RelectureInvalide,
    acquis_au_jour,
    appliquer_relecture,
    brouillon_depuis_json,
    charger_feuilleton,
    controles,
    importer_brouillon,
    jour_de_lecture,
    lettres,
    lire_brouillon,
    lire_lettre,
    valider,
)

from conftest import SURCHARGES_REELLES
from test_export import atelier, lire  # noqa: F401 — fixture partagée

#: Un parcours miniature : trois jours, puis une semaine.
PARCOURS = {
    "jours": [
        {"jour": 1, "brique": "人", "composes": ["大"]},
        {"jour": 2, "brique": "一", "composes": ["天"]},
        {"jour": 7, "brique": "日", "composes": ["明", "月"]},
        {"jour": 8, "brique": "口", "composes": ["问"]},
    ]
}

EPISODE = Episode(n=1, titre_fr="Le premier matin", titre_en="The first morning", resume_fr="L'aube.")

#: Quarante sinogrammes du jour 7, une question pour finir.
PHRASES = [
    Phrase("天明，一大人。", "tiān míng yī dà rén", "Le jour se lève, un adulte.", "Day breaks, an adult."),
    Phrase("人人一天，天天一日。", "rén rén yī tiān tiān tiān yī rì", "Chacun un jour.", "Each a day."),
    Phrase("日月明，明月大。", "rì yuè míng míng yuè dà", "Soleil et lune.", "Sun and moon."),
    Phrase("大人一日，一月一天。", "dà rén yī rì yī yuè yī tiān", "Un adulte.", "An adult."),
    Phrase("一人一天，一日一月。", "yī rén yī tiān yī rì yī yuè", "Un par un.", "One by one."),
    Phrase("明天月大明？", "míng tiān yuè dà míng", "Demain, la lune ?", "Tomorrow, the moon?"),
]

GLOSE = {
    "天明": Glose(pinyin="tiān míng", fr="aube", en="dawn"),
    "一": Glose(pinyin="yī", fr="un", en="one"),
    "大人": Glose(pinyin="dà rén", fr="adulte", en="adult"),
    "人": Glose(pinyin="rén", fr="personne", en="person"),
    "天": Glose(pinyin="tiān", fr="jour", en="day"),
    "天天": Glose(pinyin="tiān tiān", fr="chaque jour", en="every day"),
    "日": Glose(pinyin="rì", fr="jour, soleil", en="day, sun"),
    "月": Glose(pinyin="yuè", fr="lune, mois", en="moon, month"),
    "明": Glose(pinyin="míng", fr="clair", en="bright"),
    "明月": Glose(pinyin="míng yuè", fr="lune claire", en="bright moon"),
    "大": Glose(pinyin="dà", fr="grand", en="big"),
    "明天": Glose(pinyin="míng tiān", fr="demain", en="tomorrow"),
}

GENERATION = Generation(modele=MODELE_MANUEL, api=API_SESSION, date="2026-09-24", empreinte_invite="sha256:x", essais=1)


def lettre(**kw: object) -> Lettre:
    base: dict[str, object] = dict(
        n=1,
        titre_fr=EPISODE.titre_fr,
        titre_en=EPISODE.titre_en,
        resume_fr=EPISODE.resume_fr,
        phrases=list(PHRASES),
        glose=dict(GLOSE),
        generation=GENERATION,
    )
    base.update(kw)
    return Lettre(**base)  # type: ignore[arg-type]


def brouillon_json(phrases: list[Phrase] = PHRASES, n: int = 1) -> dict[str, object]:
    return {
        "lettre": n,
        "phrases": [{"zh": p.zh, "pinyin": p.pinyin, "fr": p.fr, "en": p.en} for p in phrases],
        "glose": [{"zh": zh, **g.en_json()} for zh, g in GLOSE.items()],
    }


def ecrire_brouillon(dossier: Path, document: dict[str, object], n: int = 1) -> Path:
    chemin = dossier / f"{n:02d}.json"
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return chemin


# ------------------------------------------------------------------------ le fil


def test_le_feuilleton_compte_douze_lettres_dans_l_ordre() -> None:
    fil = charger_feuilleton()
    assert [e.n for e in fil] == list(range(1, 13))
    assert [e.jour for e in fil] == [7 * n for n in range(1, 13)]
    assert all(e.titre_fr and e.titre_en and e.resume_fr for e in fil)


def test_un_feuilleton_troue_est_refuse(tmp_path: Path) -> None:
    chemin = tmp_path / "fil.tsv"
    chemin.write_text("n\ttitre_fr\ttitre_en\tresume_fr\n1\ta\tb\tc\n3\ta\tb\tc\n", encoding="utf-8")
    with pytest.raises(FeuilletonInvalide):
        charger_feuilleton(chemin)


# ---------------------------------------------------------------------- l'acquis


def test_l_acquis_du_jour_est_ce_que_le_parcours_a_pose_jusque_la() -> None:
    assert acquis_au_jour(2, PARCOURS) == ["人", "大", "一", "天"]
    assert acquis_au_jour(7, PARCOURS) == ["人", "大", "一", "天", "日", "明", "月"]
    assert jour_de_lecture("明天", PARCOURS) == 7
    assert jour_de_lecture("雀", PARCOURS) is None


# -------------------------------------------------------------------- validation


def test_une_lettre_conforme_n_a_ni_intrus_ni_ecart() -> None:
    rapport = valider(lettre(), acquis_au_jour(7, PARCOURS))
    assert rapport.conforme and rapport.ecarts == []


def test_un_caractere_hors_de_l_acquis_du_jour_est_un_rejet() -> None:
    phrases = [*PHRASES[:-1], Phrase("明天问月？", "míng tiān wèn yuè", "Demander ?", "Ask?")]
    rapport = valider(lettre(phrases=phrases), acquis_au_jour(7, PARCOURS))
    assert rapport.intrus == ["问"] and not rapport.conforme


def test_une_lettre_trop_courte_ou_sans_question_est_un_ecart() -> None:
    courte = [Phrase("明天月明。", "míng tiān yuè míng", "Demain.", "Tomorrow.")]
    ecarts = valider(lettre(phrases=courte), acquis_au_jour(7, PARCOURS)).ecarts
    assert any("longueur 4" in e for e in ecarts)
    assert any("ne finit pas par une question" in e for e in ecarts)


def test_le_pinyin_suit_les_tons_du_dictionnaire_et_les_lectures() -> None:
    fautive = [Phrase("天明，一大人。", "tiān míng yí dà rén", "a", "b"), *PHRASES[1:]]
    ecarts = valider(lettre(phrases=fautive), acquis_au_jour(7, PARCOURS)).ecarts
    assert any("sandhi" in e and "一 yí" in e for e in ecarts)
    lectures = {"天": ("tiān",), "明": ("míng",), "一": ("yī",), "大": ("dà",), "人": ("rén",)}
    mal_lue = [Phrase("天明，一大人。", "tiān mín yī dà rén", "a", "b")]
    ecarts = lettres_mod.ecarts_pinyin(lettre(phrases=mal_lue), lectures)
    assert any("ne se lit pas" in e for e in ecarts)


def test_la_glose_couvre_chaque_sinogramme_au_pinyin_des_phrases() -> None:
    glose = {k: v for k, v in GLOSE.items() if k != "大人"}
    glose["明天"] = Glose(pinyin="míng tiàn", fr="demain", en="tomorrow")
    glose["雨"] = Glose(pinyin="yǔ", fr="pluie", en="")
    ecarts = lettres_mod.ecarts_glose(lettre(glose=glose))
    assert any(e.startswith("glose hors du texte : 雨") for e in ecarts)
    assert any("glose 明天" in e for e in ecarts)
    assert any("sans sens anglais : 雨" in e for e in ecarts)
    # Sans 大人, 大 et 人 se glosent seuls : la couverture reste complète.
    assert not any(e.startswith("glose absente") for e in ecarts)
    sans_un = {k: v for k, v in GLOSE.items() if k != "一"}
    assert any(e == "glose absente pour 一" for e in lettres_mod.ecarts_glose(lettre(glose=sans_un)))


# -------------------------------------------------------------------- brouillons


def test_un_brouillon_mal_forme_ne_s_importe_pas() -> None:
    with pytest.raises(BrouillonInvalide) as erreur:
        brouillon_depuis_json({**brouillon_json(), "titre": "x", "lettre": 2}, empreinte="e", n=1)
    assert "champ inconnu : titre" in str(erreur.value)
    assert "lettre vaut 2" in str(erreur.value)


def test_l_import_ecrit_la_lettre_a_relire_avec_sa_tracabilite(tmp_path: Path) -> None:
    b = lire_brouillon(ecrire_brouillon(tmp_path / "b", brouillon_json()))
    resultat = importer_brouillon(b, EPISODE, acquis_au_jour(7, PARCOURS), dossier=tmp_path / "v")
    assert resultat.lettre.statut == A_RELIRE
    ecrite = lire_lettre(resultat.chemin)
    assert ecrite.generation.api == API_SESSION and ecrite.generation.modele == MODELE_MANUEL
    assert ecrite.generation.empreinte_invite == b.empreinte
    assert ecrite.jour == 7 and ecrite.parcours == "lire"


def test_un_brouillon_hors_de_l_acquis_est_rejete(tmp_path: Path) -> None:
    doc = brouillon_json()
    doc["phrases"][-1] = {"zh": "明天问月？", "pinyin": "míng tiān wèn yuè", "fr": "?", "en": "?"}  # type: ignore[index]
    b = lire_brouillon(ecrire_brouillon(tmp_path / "b", doc))
    resultat = importer_brouillon(b, EPISODE, acquis_au_jour(7, PARCOURS), dossier=tmp_path / "v")
    assert resultat.lettre.statut == REJETE and resultat.lettre.generation.intrus == ["问"]


def test_une_lettre_relue_le_reste_tant_que_son_brouillon_ne_change_pas(tmp_path: Path) -> None:
    chemin = ecrire_brouillon(tmp_path / "b", brouillon_json())
    acquis = acquis_au_jour(7, PARCOURS)
    importer_brouillon(lire_brouillon(chemin), EPISODE, acquis, dossier=tmp_path / "v")
    appliquer_relecture({"1": RELU}, dossier=tmp_path / "v")
    encore = importer_brouillon(lire_brouillon(chemin), EPISODE, acquis, dossier=tmp_path / "v")
    assert encore.inchange and encore.lettre.statut == RELU
    doc = brouillon_json()
    doc["phrases"][0]["fr"] = "Le jour se lève sur un adulte."  # type: ignore[index]
    ecrire_brouillon(tmp_path / "b", doc)
    modifiee = importer_brouillon(lire_brouillon(chemin), EPISODE, acquis, dossier=tmp_path / "v")
    assert modifiee.lettre.statut == A_RELIRE and modifiee.remplace == RELU


def test_la_relecture_est_tout_ou_rien_et_refuse_une_lettre_rejetee(tmp_path: Path) -> None:
    doc = brouillon_json()
    doc["phrases"][-1] = {"zh": "明天问月？", "pinyin": "míng tiān wèn yuè", "fr": "?", "en": "?"}  # type: ignore[index]
    b = lire_brouillon(ecrire_brouillon(tmp_path / "b", doc))
    importer_brouillon(b, EPISODE, acquis_au_jour(7, PARCOURS), dossier=tmp_path / "v")
    with pytest.raises(RelectureInvalide) as erreur:
        appliquer_relecture({"1": RELU, "2": RELU}, dossier=tmp_path / "v")
    assert "rejetée aux contrôles" in str(erreur.value) and "2 : aucune lettre" in str(erreur.value)
    assert lire_lettre(tmp_path / "v" / "01.json").statut == REJETE


# ------------------------------------------------------------------------ export


def test_seules_les_lettres_relues_entrent_dans_l_export(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    dossier = tmp_path / "lettres"
    monkeypatch.setattr(lettres_mod, "VERSIONS", dossier)
    lettres_mod.ecrire_lettre(lettre(statut=RELU), dossier)
    lettres_mod.ecrire_lettre(lettre(n=2, statut=A_RELIRE), dossier)
    lettres_mod.ecrire_lettre(lettre(n=3, statut=REJETE), dossier)
    rapport = export_mod.export("0.1.0")

    principal = lire(rapport.dossier, "lettres.json")
    assert [l["n"] for l in principal["lettres"]] == [1]
    assert "statut" not in principal["lettres"][0] and principal["semaine"] == 7
    assert export_mod.fautes_de_licence("lettres.json", principal) == []
    assert lire(rapport.dossier, "index.json")["lettres"] == "lettres.json"

    apercu = lire(rapport.dossier, "apercu/lettres.json")
    assert [l["n"] for l in apercu["lettres"]] == [2]
    assert apercu["statut"] == "a_relire" and apercu["lettres"][0]["statut"] == "a_relire"
    index_apercu = lire(rapport.dossier, "apercu/index.json")
    assert index_apercu["lettres"] == "apercu/lettres.json" and index_apercu["compte"]["lettres"] == 1

    resultats = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert resultats["export : aperçu"].ok, resultats["export : aperçu"].detail
    assert resultats["export : à jour"].ok
    exp = next(c for c in controles(dossier=dossier, build=export_mod.BUILD) if c.nom == "lettres : export")
    assert exp.ok, exp.detail


def test_relire_une_lettre_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    dossier = tmp_path / "lettres"
    monkeypatch.setattr(lettres_mod, "VERSIONS", dossier)
    lettres_mod.ecrire_lettre(lettre(), dossier)
    export_mod.export("0.1.0")
    appliquer_relecture({"01": RELU}, dossier=dossier)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok
    exp = next(c for c in controles(dossier=dossier, build=export_mod.BUILD) if c.nom == "lettres : export")
    assert not exp.ok and "relues [1]" in exp.detail


# ------------------------------------------------------------ les vraies lettres


REELLES = lettres_mod.VERSIONS_REELLES


def test_les_douze_lettres_sont_ecrites_et_tracees() -> None:
    ecrites = lettres(REELLES)
    assert [l.n for l in ecrites] == list(range(1, 13))
    for l in ecrites:
        assert l.generation.api == API_SESSION and l.generation.modele == MODELE_MANUEL
        assert l.statut in (A_RELIRE, RELU)
        assert lettres_mod.LONGUEUR_MIN <= len(l.sinogrammes()) <= lettres_mod.LONGUEUR_MAX
        assert l.phrases[-1].zh.endswith("？")
        assert lettres_mod.ecarts_glose(l) == [] and lettres_mod.ecarts_forme(l) == []
        assert lettres_mod.ecarts_pinyin(l) == []


def test_aucune_lettre_ne_culpabilise() -> None:
    """Ni reproche, ni compte de jours manqués (CLAUDE.md, brief §9)."""
    for l in lettres(REELLES):
        texte = " ".join(p.fr for p in l.phrases).lower()
        for interdit in ("pas lu", "oublié", "manqué", "dois", "reproche", "déçu"):
            assert interdit not in texte, (l.n, interdit)


construit = pytest.mark.skipif(
    not (lettres_mod.BUILD / "parcours-lire.json").exists(), reason="parcours pas construit (`wenlu build`)"
)


@construit
def test_chaque_lettre_n_emploie_que_l_acquis_du_jour_7n() -> None:
    parcours = lettres_mod.charger_parcours()
    for l in lettres(REELLES):
        assert valider(l, acquis_au_jour(7 * l.n, parcours)).intrus == [], l.n


@construit
def test_les_controles_des_vraies_lettres_passent(monkeypatch: pytest.MonkeyPatch) -> None:
    # Le pinyin se contrôle avec les surcharges du dépôt (子 zǐ), que les tests écartent.
    monkeypatch.setattr(surcharges, "PINYIN", SURCHARGES_REELLES["PINYIN"])
    resultats = controles(dossier=REELLES)
    assert [c.nom for c in resultats if c.bloquant and not c.ok] == []


def test_la_commande_apercu_montre_les_lettres(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(lettres_mod, "VERSIONS", REELLES)
    resultat = CliRunner().invoke(cli, ["lettres", "apercu"])
    assert resultat.exit_code == 0, resultat.output
    assert "12 lettres." in resultat.output and "好朋友" in resultat.output
