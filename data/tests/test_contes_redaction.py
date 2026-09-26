"""Contes rédigés sans API : emplacements, brouillons, import, validation, relecture.

Aucun accès réseau, aucune clé d'API. Les textes chinois des brouillons de test sont
des suites de caractères sans récit, jamais des contes. Seul le dernier test lit les
vrais brouillons du dépôt, pour vérifier que chaque version importée porte
l'empreinte de son brouillon et passe les contrôles sans écart.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import contes, paths
from wenlu_data.cli import app as cli
from wenlu_data.contes import (
    A_RELIRE,
    API_SESSION,
    MODELE_MANUEL,
    REJETE,
    RELU,
    BrouillonInvalide,
    Conte,
    Glose,
    RelectureInvalide,
    Version,
    appliquer_relecture,
    brouillon_depuis_json,
    exporter_relecture,
    lire_brouillon,
    lire_version,
    segmenter,
    valider,
    version_depuis_brouillon,
)

LISTE = list("人大天口日月山水火木上下")

CONTE = Conte(
    id="conte-de-test",
    titre_zh="山水",
    titre_fr="Titre de test",
    titre_en="Test title",
    ouvrage="《测试》",
    resume_fr="Un résumé d'intrigue en une phrase.",
)

#: Dix fois six sinogrammes : la longueur minimale du seuil 255.
PHRASE = {"zh": "山上水，山下火。", "pinyin": "shān shàng shuǐ shān xià huǒ", "fr": "Une phrase.", "en": "A sentence."}


def brouillon(**champs: object) -> dict[str, object]:
    """Un brouillon conforme, sans aucun écart, modifiable champ à champ."""
    document: dict[str, object] = {
        "conte": "conte-de-test",
        "seuil": 255,
        "ouvrage": "《测试》",
        "titre": {"zh": "山水", "pinyin": "shān shuǐ"},
        "phrases": [dict(PHRASE) for _ in range(10)],
        "glose": [
            {"zh": "山上", "pinyin": "shān shàng", "fr": "sur la montagne", "en": "on the mountain"},
            {"zh": "山", "pinyin": "shān", "fr": "montagne", "en": "mountain"},
            {"zh": "水", "pinyin": "shuǐ", "fr": "eau", "en": "water"},
            {"zh": "下", "pinyin": "xià", "fr": "sous", "en": "below"},
            {"zh": "火", "pinyin": "huǒ", "fr": "feu", "en": "fire"},
        ],
    }
    document.update(champs)
    return document


def ecrire_brouillon(dossier: Path, document: dict[str, object], seuil: int | str = 255) -> Path:
    chemin = dossier / str(document.get("conte", "conte-de-test")) / f"{seuil}.json"
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")
    return chemin


def version_de(document: dict[str, object]) -> Version:
    lu = brouillon_depuis_json(document, empreinte="sha256:" + "0" * 64)
    return version_depuis_brouillon(lu, CONTE, horloge=lambda: "2026-09-24")


@pytest.fixture
def depot(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Brouillons, versions, listes et catalogue de test à la place de ceux du dépôt."""
    monkeypatch.setattr(contes, "BROUILLONS", tmp_path / "brouillons")
    monkeypatch.setattr(contes, "CONTES_WORK", tmp_path / "versions")
    monkeypatch.setattr(contes, "LISTES", tmp_path / "listes")
    monkeypatch.setattr(contes, "RELECTURE", tmp_path / "work" / "relecture-contes.json")
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE])
    monkeypatch.setattr(contes, "_aujourdhui", lambda: "2026-09-24")
    (tmp_path / "listes").mkdir()
    (tmp_path / "listes" / "seuil-255.txt").write_text("\n".join(LISTE) + "\n", encoding="utf-8")
    return tmp_path


def importer(*args: str) -> tuple[int, str]:
    resultat = CliRunner().invoke(cli, ["contes", "importer", *args])
    return resultat.exit_code, resultat.output


# --------------------------------------------------------------------------- emplacements


def test_les_versions_sont_versionnees_et_le_journal_des_lots_reste_hors_depot() -> None:
    """Versions et brouillons dans `data/sources/`, le journal des lots d'API dans `work/`."""
    assert paths.CONTES_WORK == paths.DATA / "sources" / "contes-versions"
    assert contes.BROUILLONS == paths.DATA / "sources" / "contes-brouillons"
    assert contes.dossier_lots() == paths.WORK / "contes" / "lots"
    assert contes.RELECTURE.parent == paths.WORK


# --------------------------------------------------------------------------- import


def test_un_brouillon_conforme_s_importe_a_relire_avec_sa_tracabilite(depot: Path) -> None:
    """Même contrôle qu'un conte généré ; la traçabilité dit une rédaction sans API."""
    chemin = ecrire_brouillon(depot / "brouillons", brouillon())
    code, sortie = importer()
    assert code == 0, sortie
    assert "écart" not in sortie
    assert "60 sinogrammes" in sortie

    version = lire_version(depot / "versions" / "255" / "conte-de-test.json")
    assert version.statut == A_RELIRE
    assert version.generation.api == API_SESSION == "session Claude Code (sans API)"
    assert version.generation.modele == MODELE_MANUEL == "rédaction manuelle"
    assert version.generation.empreinte_invite == "sha256:" + hashlib.sha256(chemin.read_bytes()).hexdigest()
    assert version.generation.date == "2026-09-24"
    assert version.generation.essais == 1
    assert version.generation.intrus == []
    assert version.titre_fr == CONTE.titre_fr and version.titre_en == CONTE.titre_en
    assert version.ouvrage == CONTE.ouvrage
    assert version.glose["山上"] == Glose(fr="sur la montagne", pinyin="shān shàng", en="on the mountain")


def test_un_brouillon_hsk_s_importe_sous_son_niveau(depot: Path) -> None:
    """`<id>/hsk1.json`, `"seuil": "hsk1"` : même import, même relecture, rangé sous hsk1/."""
    (depot / "listes" / "hsk-1.txt").write_text("\n".join(LISTE) + "\n", encoding="utf-8")
    ecrire_brouillon(depot / "brouillons", brouillon(seuil="hsk1"), seuil="hsk1")
    code, sortie = importer("--niveau", "hsk1")
    assert code == 0, sortie
    assert "écart" not in sortie
    version = lire_version(depot / "versions" / "hsk1" / "conte-de-test.json")
    assert version.seuil == "hsk1" and version.statut == A_RELIRE
    (relue,) = appliquer_relecture({"hsk1/conte-de-test": "relu"})
    assert relue.statut == RELU


def test_un_brouillon_hsk_dit_le_niveau_de_son_fichier(depot: Path) -> None:
    chemin = ecrire_brouillon(depot / "brouillons", brouillon(seuil=255), seuil="hsk1")
    with pytest.raises(BrouillonInvalide, match="dans un fichier nommé hsk1.json"):
        lire_brouillon(chemin)
    autre = ecrire_brouillon(depot / "brouillons", brouillon(seuil="hsk8"), seuil="hsk8")
    with pytest.raises(BrouillonInvalide, match="le nom de son niveau"):
        lire_brouillon(autre)


def test_un_caractere_hors_seuil_est_rejete_et_nomme(depot: Path) -> None:
    """La contrainte dure : un seul caractère hors liste, et le conte est rejeté."""
    phrases = [dict(PHRASE) for _ in range(10)]
    phrases[3] = {**PHRASE, "zh": "山上鸟，山下火。"}
    ecrire_brouillon(depot / "brouillons", brouillon(phrases=phrases))
    code, sortie = importer()
    assert code == 1
    assert "hors du niveau 255 : 鸟" in sortie
    version = lire_version(depot / "versions" / "255" / "conte-de-test.json")
    assert version.statut == REJETE
    assert version.generation.intrus == ["鸟"]


def test_un_brouillon_inchange_garde_sa_relecture_un_brouillon_modifie_la_perd(depot: Path) -> None:
    chemin = ecrire_brouillon(depot / "brouillons", brouillon())
    assert importer()[0] == 0
    contes.relire("conte-de-test", 255, RELU)

    code, sortie = importer()
    assert code == 0 and "inchangée, statut relu" in sortie
    assert lire_version(depot / "versions" / "255" / "conte-de-test.json").statut == RELU

    chemin.write_text(json.dumps(brouillon(titre={"zh": "山水", "pinyin": "shān shuǐ"}), ensure_ascii=False), encoding="utf-8")
    code, sortie = importer()
    assert code == 0 and "remplace une version relu" in sortie
    version = lire_version(depot / "versions" / "255" / "conte-de-test.json")
    assert version.statut == A_RELIRE
    assert version.generation.essais == 2


@pytest.mark.parametrize(
    "document, motif",
    [
        (brouillon(auteur="moi"), "champ inconnu : auteur"),
        ({k: v for k, v in brouillon().items() if k != "glose"}, "champ manquant : glose"),
        (brouillon(conte="autre-conte"), "dans le dossier conte-de-test/"),
        (brouillon(seuil=405), "dans un fichier nommé 255.json"),
        (brouillon(titre={"zh": "山水"}), "titre : pinyin manquant"),
        (brouillon(phrases=[{"zh": "山。", "pinyin": "shān", "fr": "Montagne."}]), "phrase 1 : en manquant"),
        (
            brouillon(glose=[{"zh": "山", "pinyin": "shān", "fr": "a", "en": "a"}] * 2),
            "glose 2 : 山 déjà glosé",
        ),
        ({k: v for k, v in brouillon().items() if k != "phrases"}, "champ manquant : phrases"),
        (brouillon(chapitres=[]), "l'un ou l'autre"),
        (
            {**{k: v for k, v in brouillon().items() if k != "phrases"}, "chapitres": [{"phrases": [PHRASE]}]},
            "chapitre 1, titre : attendu un objet",
        ),
        (
            {
                **{k: v for k, v in brouillon().items() if k != "phrases"},
                "chapitres": [{"titre": {"zh": "山", "pinyin": "shān"}, "phrases": [], "note": "x"}],
            },
            "chapitre 1 : clé inconnue note",
        ),
    ],
)
def test_un_brouillon_hors_format_n_ecrit_rien(depot: Path, document: dict[str, object], motif: str) -> None:
    chemin = depot / "brouillons" / "conte-de-test" / "255.json"
    chemin.parent.mkdir(parents=True)
    chemin.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(BrouillonInvalide, match=motif):
        lire_brouillon(chemin)
    code, sortie = importer()
    assert code == 1 and "rien n'est écrit" in sortie
    assert not (depot / "versions").exists()


def test_la_source_n_est_citee_que_si_elle_est_exacte(depot: Path) -> None:
    """L'ouvrage du catalogue à l'identique, ou `null` : jamais une source inexacte."""
    with pytest.raises(BrouillonInvalide, match="le catalogue cite"):
        version_de(brouillon(ouvrage="《韩非子》"))
    assert version_de(brouillon(ouvrage=None)).ouvrage == ""
    assert version_de(brouillon()).ouvrage == "《测试》"


# --------------------------------------------------------------------------- validation


def test_le_brouillon_de_reference_passe_sans_ecart() -> None:
    rapport = valider(version_de(brouillon()), LISTE)
    assert rapport.conforme and rapport.ecarts == []


def test_la_glose_se_lit_comme_le_lecteur_la_decoupe() -> None:
    """À chaque position, l'entrée la plus longue qui commence là ; la ponctuation passe."""
    assert segmenter("山上水，山下火。", ["山", "山上", "水", "下"]) == [
        (0, "山上"),
        (2, "水"),
        (4, "山"),
        (5, "下"),
        (6, ""),
    ]


def test_un_sinogramme_sans_glose_est_un_ecart() -> None:
    document = brouillon()
    document["glose"] = [g for g in document["glose"] if g["zh"] != "火"]  # type: ignore[union-attr]
    rapport = valider(version_de(document), LISTE)
    assert rapport.conforme
    assert "glose absente pour 火" in rapport.ecarts


def test_une_glose_hors_du_texte_ou_sans_anglais_est_un_ecart() -> None:
    document = brouillon()
    document["glose"] = [  # type: ignore[index]
        *document["glose"],  # type: ignore[misc]
        {"zh": "木", "pinyin": "mù", "fr": "arbre", "en": "tree"},
    ]
    document["glose"][4]["en"] = ""  # type: ignore[index]
    ecarts = valider(version_de(document), LISTE).ecarts
    assert "glose hors du texte : 木" in ecarts
    assert "glose sans sens anglais : 火" in ecarts


def test_le_pinyin_de_la_glose_est_celui_des_phrases() -> None:
    """Une entrée ne dit pas un autre son que la phrase où on la touche."""
    document = brouillon()
    document["glose"][3]["pinyin"] = "xiá"  # type: ignore[index]
    ecarts = valider(version_de(document), LISTE).ecarts
    assert any(e.startswith("glose 下 « xiá »") for e in ecarts)


def test_le_pinyin_s_aligne_une_syllabe_par_sinogramme() -> None:
    phrases = [dict(PHRASE) for _ in range(10)]
    phrases[1] = {**PHRASE, "pinyin": "shānshàng shuǐ shān xià huǒ"}
    phrases[2] = {**PHRASE, "pinyin": "Shān shàng shuǐ, shān xià huǒ."}
    ecarts = valider(version_de(brouillon(phrases=phrases)), LISTE).ecarts
    assert "pinyin de la phrase 2 : 5 syllabes pour 6 caractères" in ecarts
    assert any(e.startswith("pinyin de la phrase 3 hors forme") and "Shān" in e for e in ecarts)


def test_les_tons_de_yi_et_bu_sont_ceux_du_dictionnaire() -> None:
    """Sans sandhi : 一 reste yī et 不 reste bù, devant n'importe quel ton."""
    liste = LISTE + ["一", "不"]
    phrases = [dict(PHRASE) for _ in range(9)] + [
        {"zh": "一山不火。", "pinyin": "yì shān bú huǒ", "fr": "Une phrase.", "en": "A sentence."}
    ]
    document = brouillon(phrases=phrases)
    document["glose"] = [  # type: ignore[index]
        *document["glose"],  # type: ignore[misc]
        {"zh": "一", "pinyin": "yì", "fr": "un", "en": "one"},
        {"zh": "不", "pinyin": "bú", "fr": "ne pas", "en": "not"},
    ]
    ecarts = valider(version_de(document), liste).ecarts
    assert any("sandhi" in e and "一 yì" in e and "不 bú" in e for e in ecarts)


def test_yi_d_un_verbe_redouble_est_au_ton_neutre() -> None:
    """Décision du propriétaire, le 现代汉语词典 : 看一看 kàn yi kàn. Un 一 plein entre un
    verbe et sa répétition est un écart ; 一个一个 garde yī."""
    assert contes.redoublements_en_yi("去看一看，一个一个，看。一看") == [2]
    liste = LISTE + ["一", "看", "个"]
    phrases = [dict(PHRASE) for _ in range(8)] + [
        {"zh": "山上看一看。", "pinyin": "shān shàng kàn yī kàn", "fr": "Une phrase.", "en": "A sentence."},
        {"zh": "一个一个看。", "pinyin": "yī gè yī gè kàn", "fr": "Une phrase.", "en": "A sentence."},
    ]
    document = brouillon(phrases=phrases)
    document["glose"] = [  # type: ignore[index]
        *document["glose"],  # type: ignore[misc]
        {"zh": "看一看", "pinyin": "kàn yī kàn", "fr": "jeter un œil", "en": "take a look"},
        {"zh": "一个一个", "pinyin": "yī gè yī gè", "fr": "un par un", "en": "one by one"},
        {"zh": "看", "pinyin": "kàn", "fr": "regarder", "en": "look"},
    ]
    ecarts = valider(version_de(document), liste).ecarts
    assert [e for e in ecarts if "redoublé" in e] == [
        "pinyin de la phrase 9 : 一 d'un verbe redoublé au ton neutre, yi (看一看 kàn yi kàn) : 看一看 yī"
    ]
    phrases[8] = {**phrases[8], "pinyin": "shān shàng kàn yi kàn"}
    document["phrases"] = phrases
    document["glose"][-3]["pinyin"] = "kàn yi kàn"  # type: ignore[index]
    assert not [e for e in valider(version_de(document), liste).ecarts if "redoublé" in e]


def test_la_traduction_anglaise_manquante_est_un_ecart() -> None:
    phrases = [dict(PHRASE) for _ in range(10)]
    phrases[0] = {**PHRASE, "en": ""}
    ecarts = valider(version_de(brouillon(phrases=phrases)), LISTE).ecarts
    assert "traduction anglaise absente : phrases 1" in ecarts


# --------------------------------------------------------------------------- contexte


def test_le_contexte_donne_la_liste_exacte_le_resume_et_les_contraintes(depot: Path) -> None:
    resultat = CliRunner().invoke(cli, ["contes", "contexte", "conte-de-test", "--seuil", "255"])
    assert resultat.exit_code == 0, resultat.output
    assert "".join(LISTE) in resultat.output
    assert f"Les {len(LISTE)} seuls caractères autorisés au seuil 255" in resultat.output
    assert CONTE.resume_fr in resultat.output
    assert CONTE.ouvrage in resultat.output
    assert "60 à 120 sinogrammes" in resultat.output
    assert "Contraintes, vérifiées par `wenlu contes importer`" in resultat.output
    assert "conte-de-test/255.json" in resultat.output


def test_le_contexte_d_un_conte_inconnu_sort_en_1(depot: Path) -> None:
    resultat = CliRunner().invoke(cli, ["contes", "contexte", "inconnu", "--seuil", "255"])
    assert resultat.exit_code == 1
    assert "conte inconnu" in resultat.output


# --------------------------------------------------------------------------- relecture


def test_la_relecture_s_exporte_puis_s_applique(depot: Path) -> None:
    ecrire_brouillon(depot / "brouillons", brouillon())
    assert importer()[0] == 0

    sortie, nombre = exporter_relecture(horloge=lambda: "2026-09-24T10:00:00Z")
    assert nombre == 1 and sortie == depot / "work" / "relecture-contes.json"
    document = json.loads(sortie.read_text(encoding="utf-8"))
    assert document["contes"][0]["cle"] == "255/conte-de-test"
    assert document["contes"][0]["ecarts"] == []

    (relue,) = appliquer_relecture({"255/conte-de-test": "relu"})
    assert relue.statut == RELU
    assert lire_version(depot / "versions" / "255" / "conte-de-test.json").statut == RELU


def test_la_relecture_est_tout_ou_rien(depot: Path) -> None:
    phrases = [dict(PHRASE) for _ in range(10)]
    phrases[0] = {**PHRASE, "zh": "山上鸟，山下火。"}
    ecrire_brouillon(depot / "brouillons", brouillon(phrases=phrases))
    importer()

    with pytest.raises(RelectureInvalide) as erreur:
        appliquer_relecture({"255/conte-de-test": "relu", "conte-de-test": "relu", "255/absent": "rejete"})
    assert any("rejetée aux contrôles" in p for p in erreur.value.problemes)
    assert any("clé attendue <niveau>/<conte>" in p for p in erreur.value.problemes)
    assert any("aucune version" in p for p in erreur.value.problemes)
    assert lire_version(depot / "versions" / "255" / "conte-de-test.json").statut == REJETE


# --------------------------------------------------------------------------- dépôt


def test_les_contes_du_depot_portent_l_empreinte_de_leur_brouillon() -> None:
    """Chaque brouillon versionné est importé tel quel, et sa version passe sans écart."""
    catalogue = contes.charger_catalogue()
    brouillons = contes.brouillons_ecrits()
    for chemin in brouillons:
        lu = lire_brouillon(chemin)
        version = lire_version(contes.chemin_version(lu.seuil, lu.conte))
        assert version.generation.api == API_SESSION
        assert version.generation.empreinte_invite == lu.empreinte, f"{lu.nom} : réimporter le brouillon"
        assert version.statut in (A_RELIRE, RELU)
        conte = contes.conte_par_id(lu.conte, catalogue)
        assert version.ouvrage in ("", conte.ouvrage)
        rapport = valider(version, contes.charger_seuil(lu.seuil), conte)
        assert rapport.conforme and rapport.ecarts == [], f"{lu.nom} : {rapport.intrus} {rapport.refus} {rapport.ecarts}"


def test_les_trois_contes_gratuits_du_seuil_255_sont_rediges() -> None:
    """Brief §10 : trois contes gratuits au seuil 255."""
    ecrits = {(p.parent.name, p.stem) for p in contes.brouillons_ecrits()}
    assert len({conte for conte, seuil in ecrits if seuil == "255"}) >= 3


# --------------------------------------------------------------------------- récits longs

CONTE_LONG = Conte(
    id="conte-long",
    titre_zh="山水",
    titre_fr="Récit long",
    titre_en="Long tale",
    titre_pinyin="shān shuǐ",
    ouvrage="《测试》",
    resume_fr="Un récit en deux chapitres.",
    niveaux=(255, 505),
    chapitres=2,
    plan=(
        contes.ChapitrePrevu(1, "Le haut", "Up", "Le premier."),
        contes.ChapitrePrevu(2, "Le bas", "Down", "Le second."),
    ),
)


def brouillon_long(**champs: object) -> dict[str, object]:
    """Un brouillon de récit long conforme : deux chapitres titrés de dix phrases."""
    document = {k: v for k, v in brouillon(conte="conte-long").items() if k != "phrases"}
    document["chapitres"] = [
        {"titre": {"zh": "山上", "pinyin": "shān shàng"}, "phrases": [dict(PHRASE) for _ in range(10)]},
        {"titre": {"zh": "山下", "pinyin": "shān xià"}, "phrases": [dict(PHRASE) for _ in range(10)]},
    ]
    document.update(champs)
    return document


def test_un_recit_long_s_importe_chapitre_par_chapitre(depot: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Mêmes contrôles qu'une fable, chapitre par chapitre ; les titres français et anglais
    des chapitres viennent du catalogue."""
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE, CONTE_LONG])
    ecrire_brouillon(depot / "brouillons", brouillon_long())
    code, sortie = importer()
    assert code == 0, sortie
    assert "écart" not in sortie
    version = lire_version(depot / "versions" / "255" / "conte-long.json")
    assert version.statut == A_RELIRE and not version.courte
    assert [(c.titre, c.titre_fr, c.titre_en) for c in version.chapitres] == [
        ("山上", "Le haut", "Up"),
        ("山下", "Le bas", "Down"),
    ]
    assert len(version.phrases) == 20
    brut = json.loads((depot / "versions" / "255" / "conte-long.json").read_text(encoding="utf-8"))
    assert "phrases" not in brut and len(brut["chapitres"]) == 2


def test_un_chapitre_de_trop_ou_un_seuil_non_prevu_sont_des_ecarts(
    depot: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE, CONTE_LONG])
    document = brouillon_long()
    document["chapitres"] = [*document["chapitres"], document["chapitres"][0]]  # type: ignore[index]
    ecrire_brouillon(depot / "brouillons", document)
    code, sortie = importer()
    assert code == 0, "un écart n'est pas un rejet"
    assert "3 chapitre(s) pour 2 prévu(s) au catalogue" in sortie
    assert "chapitres sans titre français ou anglais (chapitres.tsv) : 3" in sortie


def test_le_contexte_d_un_recit_long_donne_ses_chapitres_et_son_squelette(
    depot: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE, CONTE_LONG])
    resultat = CliRunner().invoke(cli, ["contes", "contexte", "conte-long", "--seuil", "255"])
    assert resultat.exit_code == 0
    assert "Niveaux prévus : 255, 505" in resultat.output
    assert "par chapitre" in resultat.output
    assert "1. « Le haut » / “Up” : Le premier." in resultat.output
    squelette = contes.squelette(CONTE_LONG, 255)
    assert "phrases" not in squelette and len(squelette["chapitres"]) == 2  # type: ignore[arg-type]
    assert "phrases" in contes.squelette(CONTE, 255)


# --------------------------------------------------------------------------- mots expliqués

#: Le récit de test, qui déclare 鸟 et 鱼 comme personnages clés, et 山 comme caractère clé.
CONTE_OISEAU = replace(CONTE, cles="山", expliquables="鸟鱼")

#: 鸟, hors de la liste de test : le personnage clé du récit.
OISEAU = {
    "zh": "鸟",
    "pinyin": "niǎo",
    "fr": "oiseau",
    "en": "bird",
    "explication_fr": "L'oiseau du récit, qui vit sur la montagne.",
    "explication_en": "The bird of the tale, who lives on the mountain.",
}


def brouillon_oiseau(expliques: object = None, caracteres: str = "鸟") -> dict[str, object]:
    """Un brouillon conforme dont une phrase nomme des caractères hors de la liste."""
    phrases = [dict(PHRASE) for _ in range(10)]
    phrases[3] = {
        **PHRASE,
        "zh": f"山上{caracteres}，山下火。",
        "pinyin": "shān shàng " + " ".join("niǎo" for _ in caracteres) + " shān xià huǒ",
    }
    document = brouillon(phrases=phrases)
    document["glose"] = [
        *document["glose"],  # type: ignore[misc]
        *({"zh": c, "pinyin": "niǎo", "fr": "oiseau", "en": "bird"} for c in caracteres),
    ]
    if expliques is not None:
        document["expliques"] = expliques
    return document


def test_un_mot_explique_declare_est_admis_hors_du_niveau(depot: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Le loup de 亡羊补牢 : hors du niveau, il nomme un personnage clé déclaré au catalogue."""
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE_OISEAU])
    ecrire_brouillon(depot / "brouillons", brouillon_oiseau([OISEAU]))
    code, sortie = importer()
    assert code == 0, sortie
    assert "écart" not in sortie
    assert "mots expliqués, hors du niveau : 鸟" in sortie
    version = lire_version(depot / "versions" / "255" / "conte-de-test.json")
    assert version.statut == A_RELIRE and version.generation.intrus == []
    assert version.expliques == [contes.MotExplique(**OISEAU)]
    brut = json.loads((depot / "versions" / "255" / "conte-de-test.json").read_text(encoding="utf-8"))
    assert brut["expliques"] == [OISEAU]


def test_un_mot_explique_non_declare_au_catalogue_est_refuse(depot: Path) -> None:
    """Le catalogue de test ne déclare rien : le mot expliqué ne passe pas, 鸟 reste un intrus."""
    ecrire_brouillon(depot / "brouillons", brouillon_oiseau([OISEAU]))
    code, sortie = importer()
    assert code == 1
    assert "mot expliqué non déclaré : 鸟" in sortie
    assert "hors du niveau 255 : 鸟" in sortie
    version = lire_version(depot / "versions" / "255" / "conte-de-test.json")
    assert version.statut == REJETE and version.generation.intrus == ["鸟"]


def test_un_personnage_declare_mais_pas_explique_reste_un_intrus(
    depot: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Le catalogue permet, la version doit déclarer : sans `expliques`, 鸟 est un intrus."""
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE_OISEAU])
    ecrire_brouillon(depot / "brouillons", brouillon_oiseau())
    code, sortie = importer()
    assert code == 1
    assert "hors du niveau 255 : 鸟" in sortie


def test_plus_de_trois_caracteres_expliques_sont_refuses() -> None:
    """Au plus trois caractères hors du niveau par version : au-delà, aucun ne passe."""
    quatre = replace(CONTE, cles="鸟", expliquables="鱼虫花")
    mots = [{**OISEAU, "zh": c} for c in "鸟鱼虫花"]
    rapport = valider(version_de(brouillon_oiseau(mots, caracteres="鸟鱼虫花")), LISTE, quatre)
    assert not rapport.conforme
    assert rapport.intrus == list("鸟鱼虫花")
    assert rapport.refus == ["4 caractères hors du niveau expliqués (鸟 鱼 虫 花), 3 au plus"]
    trois = replace(CONTE, cles="鸟", expliquables="鱼虫")
    rapport = valider(version_de(brouillon_oiseau(mots[:3], caracteres="鸟鱼虫")), LISTE, trois)
    assert rapport.conforme, rapport
    assert rapport.expliques == list("鸟鱼虫")


def test_un_recit_long_explique_trois_caracteres_nouveaux_par_chapitre() -> None:
    """Récit long : trois nouveaux au plus par chapitre ; un mot expliqué le reste ensuite."""
    conte = replace(CONTE_LONG, cles="山", expliquables="鸟鱼虫花草石竹")

    def version_longue(premier: str, second: str) -> Version:
        document = brouillon_long(expliques=[{**OISEAU, "zh": c} for c in dict.fromkeys(premier + second)])
        for chapitre, caracteres in zip(document["chapitres"], (premier, second)):  # type: ignore[call-overload]
            chapitre["phrases"][0] = {**PHRASE, "zh": f"山上{caracteres}。"}
        lu = brouillon_depuis_json(document, empreinte="sha256:0")
        return version_depuis_brouillon(lu, conte, horloge=lambda: "2026-09-25")

    rapport = valider(version_longue("鸟鱼虫", "鸟花草石"), LISTE, conte)
    assert rapport.conforme, rapport.refus
    assert rapport.expliques == list("鸟鱼虫花草石")
    assert contes.nouveaux_par_chapitre(version_longue("鸟鱼虫", "鸟花草石"), "鸟鱼虫花草石") == [
        list("鸟鱼虫"),
        list("花草石"),
    ]
    rapport = valider(version_longue("鸟鱼虫", "花草石竹"), LISTE, conte)
    assert not rapport.conforme and rapport.intrus == list("鸟鱼虫花草石竹")
    assert rapport.refus == [
        "chapitre 2 : 4 caractères hors du niveau expliqués pour la première fois (花 草 石 竹), 3 au plus par chapitre"
    ]


def test_un_mot_explique_qui_n_a_rien_a_expliquer_est_un_ecart() -> None:
    """Absent du texte, déjà dans le niveau, sans explication : des écarts, pas des rejets."""
    mots = [
        {**OISEAU, "explication_en": ""},
        {**OISEAU, "zh": "鱼", "pinyin": "yú"},
        {**OISEAU, "zh": "山水", "pinyin": "shān"},
    ]
    rapport = valider(version_de(brouillon_oiseau(mots)), LISTE, CONTE_OISEAU)
    assert rapport.conforme
    assert "mot expliqué 鸟 sans explication_en" in rapport.ecarts
    assert "mot expliqué 鱼 absent du texte" in rapport.ecarts
    assert "mot expliqué 山水 déjà dans le niveau : inutile de l'expliquer" in rapport.ecarts
    assert "mot expliqué 山水 : pinyin sans une syllabe par caractère" in rapport.ecarts


@pytest.mark.parametrize(
    "fautif, motif",
    [
        ("鸟", "expliques : attendu une liste"),
        ([{"zh": "鸟"}], "mot expliqué 1 : pinyin, fr, en, explication_fr, explication_en manquant"),
        ([OISEAU, OISEAU], "mot expliqué 2 : 鸟 déjà expliqué"),
    ],
)
def test_un_mot_explique_hors_format_n_ecrit_rien(fautif: object, motif: str) -> None:
    with pytest.raises(BrouillonInvalide, match=motif):
        brouillon_depuis_json(brouillon_oiseau(fautif), empreinte="sha256:0")


def test_une_version_sans_mot_explique_s_ecrit_comme_avant() -> None:
    """Rétrocompatibilité : sans `expliques`, ni le brouillon ni la version n'en portent la
    clé, et chaque version du dépôt se relit et se réécrit octet pour octet."""
    version = version_de(brouillon())
    assert version.expliques == [] and "expliques" not in version.en_json()
    for chemin in contes.versions_ecrites():
        texte = json.dumps(lire_version(chemin).en_json(), ensure_ascii=False, indent=1)
        assert texte == chemin.read_text(encoding="utf-8"), chemin


def test_l_export_dit_les_caracteres_expliques_et_leur_famille(depot: Path) -> None:
    """`contes/<id>.json` : chaque mot expliqué, ses caractères hors du niveau (ceux que l'app
    ne compte pas dans l'acquis), et la famille de chacun pour trouver ses traits. Une version
    sans mot expliqué s'exporte comme avant."""
    from wenlu_data import export as export_mod

    mots = [OISEAU, {**OISEAU, "zh": "山鸟", "pinyin": "shān niǎo"}]
    version = version_de(brouillon_oiseau(mots))
    document = export_mod.document_conte("conte-de-test", [version], "0.1.0", {"鸟": "鸟", "山": "山"})
    exporte = document["versions"]["255"]  # type: ignore[index]
    assert exporte["expliques"] == [  # type: ignore[index]
        {**OISEAU, "caracteres": "鸟"},
        {**OISEAU, "zh": "山鸟", "pinyin": "shān niǎo", "caracteres": "鸟"},
    ]
    assert document["racines"] == {"山": "山", "鸟": "鸟"}, "tous les caractères des mots expliqués se dessinent"
    assert export_mod.caracteres_expliques(version) == ["鸟"]
    sans = export_mod.document_conte("conte-de-test", [version_de(brouillon())], "0.1.0", {"鸟": "鸟"})
    assert "racines" not in sans and "expliques" not in sans["versions"]["255"]  # type: ignore[index]


def test_le_contexte_dit_les_mots_expliques_possibles(depot: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(contes, "charger_catalogue", lambda *a, **k: [CONTE_OISEAU])
    resultat = CliRunner().invoke(cli, ["contes", "contexte", "conte-de-test", "--seuil", "255"])
    assert resultat.exit_code == 0, resultat.output
    assert "Mots expliqués possibles" in resultat.output
    assert ": 鸟 鱼 ; déclarés au catalogue : 鸟 鱼" in resultat.output
    assert "expliques" in contes.squelette(CONTE_OISEAU, 255)
    assert "expliques" not in contes.squelette(CONTE, 255)
