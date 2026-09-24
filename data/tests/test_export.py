"""Export JSON versionné : un test par règle. Aucun réseau, aucune clé d'API.

Le build des tests est en dur et minuscule : sept briques, trois composés, deux
listes. Il imite la sortie des stories 1.2 et 1.3 pour que la règle testée se
lise sans ouvrir les 9 574 caractères du dictionnaire.

Les fixtures portent des définitions anglaises (`definition_en`), comme les
vraies données ingérées : c'est ce qui permet de vérifier qu'aucune ne ressort
dans l'export (`docs/sources-licences.md` §4.2).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import contes as contes_mod
from wenlu_data import export as export_mod
from wenlu_data import fiches as fiches_mod
from wenlu_data.cli import app as cli
from wenlu_data.export import (
    ARPHIC,
    LICENCE_TRAITS,
    UNICODE_NOTICE,
    Noeud,
    controles,
    export,
    fautes_de_licence,
    nom_fichier,
    parse_paires,
    perimetre,
)
from wenlu_data.models import Famille

#: Témoin de définition anglaise : présent dans les fixtures ingérées, jamais
#: dans l'export. Un seul mot suffit à le grep.
TEMOIN_EN = "bright-shining-witness"

BRIQUES = ("木", "日", "月", "十", "口", "亻")
COMPOSES = {"休": ["亻", "木"], "明": ["日", "月"], "古": ["十", "口"], "林": ["木", "木"]}
RACINES = {"休": "亻", "明": "日", "古": "十", "林": "木"}

# 休 et 明 sont au seuil, 古 au HSK 1 ; 林 n'est dans aucune liste et n'est la
# brique de personne : il ne doit pas sortir.
LISTES = {"seuil-255": ["休", "明"], "hsk-1": ["古"]}

PINYIN_UNIHAN = {
    "木": "mù", "日": "rì", "月": "yuè", "十": "shí", "口": "kǒu", "亻": "rén",
    "休": "xiū", "明": "míng", "古": "gǔ", "林": "lín",
}


def _ecrire(chemin: Path, contenu: object) -> None:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=1), encoding="utf-8")


@pytest.fixture
def atelier(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Un build complet en miniature, et tous les chemins du module redirigés ici."""
    build = tmp_path / "build"
    ingest = tmp_path / "ingest"

    caracteres = [
        {"c": c, "composants": [c], "structure": c, "reconcilie": True, "inconnus": [], "cycle": [], "sources": []}
        for c in BRIQUES
    ] + [
        {
            "c": c,
            "composants": parts,
            "structure": "⿰" + "".join(parts),
            "reconcilie": True,
            "inconnus": [],
            "cycle": [],
            "sources": ["makemeahanzi"],
        }
        for c, parts in COMPOSES.items()
    ]
    _ecrire(build / "decompositions.json", {"norme": "GF 0014-2009", "caracteres": caracteres})

    noeuds = [
        {"c": c, "genre": "brique", "prerequis": [], "dependants": 1, "racine": c, "reconcilie": True}
        for c in BRIQUES
    ] + [
        {
            "c": c,
            "genre": "caractere",
            "prerequis": list(dict.fromkeys(parts)),
            "dependants": 0,
            "racine": RACINES[c],
            "reconcilie": True,
        }
        for c, parts in COMPOSES.items()
    ]
    _ecrire(build / "graphe.json", {"norme": "GF 0014-2009", "noeuds": noeuds, "familles": [], "cycles": []})

    _ecrire(
        build / "parcours-lire.json",
        {
            "parcours": "lire",
            "liste": "seuil-255",
            "regle": "une seule brique nouvelle par session de 10 minutes",
            "cible": LISTES["seuil-255"],
            "jours": [
                {"jour": 1, "brique": "亻", "composes": [], "non_reconcilie": False},
                {"jour": 2, "brique": "木", "composes": ["休"], "non_reconcilie": False},
                {"jour": 3, "brique": "日", "composes": [], "non_reconcilie": False},
                {"jour": 4, "brique": "月", "composes": ["明"], "non_reconcilie": False},
            ],
        },
    )
    _ecrire(
        build / "parcours-hsk.json",
        {
            "parcours": "hsk",
            "liste": "hsk-1",
            "regle": "une seule brique nouvelle par session de 10 minutes",
            "cible": LISTES["hsk-1"],
            "jours": [
                {"jour": 1, "brique": "口", "composes": [], "non_reconcilie": False},
                {"jour": 2, "brique": "十", "composes": ["古"], "non_reconcilie": False},
            ],
        },
    )

    _ecrire(ingest / "listes.json", LISTES)
    _ecrire(
        ingest / "graphies.json",
        [
            {"c": c, "strokes": [f"M 0 0 L 10 10 {c}"], "medians": [[[0, 0], [10, 10]]]}
            for c in PINYIN_UNIHAN
        ],
    )
    _ecrire(
        ingest / "unihan.json",
        {
            "source": "Unihan",
            "licence": "Unicode License",
            "caracteres": [
                {"c": c, "code": "U+0000", "pinyin": p, "lectures": [p], "traits": 4, "frequence": None}
                for c, p in PINYIN_UNIHAN.items()
            ],
        },
    )
    # Ce que l'export ne doit jamais lire : les définitions anglaises.
    _ecrire(
        ingest / "caracteres.json",
        [{"c": "明", "decomposition": "⿰日月", "pinyin": ["ming2"], "definition_en": TEMOIN_EN}],
    )
    _ecrire(ingest / "unihan-definitions.json", {"definitions": [{"c": "明", "definition_en": TEMOIN_EN}]})
    _ecrire(
        ingest / "mots.json",
        [{"traditionnel": "明天", "simplifie": "明天", "pinyin": "ming2 tian1", "definitions_en": [TEMOIN_EN]}],
    )

    monkeypatch.setattr(export_mod, "BUILD", build)
    monkeypatch.setattr(export_mod, "INGEST", ingest)
    monkeypatch.setattr(export_mod, "EXPORT", tmp_path / "public")
    monkeypatch.setattr(fiches_mod, "FICHES_WORK", tmp_path / "fiches")
    monkeypatch.setattr(contes_mod, "CONTES_WORK", tmp_path / "contes")
    return tmp_path


def lire(dossier: Path, relatif: str) -> dict[str, object]:
    return json.loads((dossier / relatif).read_text(encoding="utf-8"))


def fiche_de(dossier: Path, racine: str, c: str) -> dict[str, object]:
    famille = lire(dossier, f"familles/{racine}.json")
    return next(f for f in famille["fiches"] if f["c"] == c)  # type: ignore[index, union-attr]


def fiche_generee(c: str, *, statut: str) -> fiches_mod.Fiche:
    """Une fiche du format de la story 1.4, avec des textes reconnaissables."""
    return fiches_mod.Fiche(
        c=c,
        parcours="lire",
        jour=2,
        pinyin=("xiū",),
        composants=tuple(COMPOSES[c]),
        structure="⿰" + "".join(COMPOSES[c]),
        origine_fr="Une personne contre un arbre. Elle s'arrête. Elle se repose.",
        origine_en="A person against a tree. They stop. They rest.",
        etiquette="atteste",
        roles={"亻": "sens", "木": "sens"},
        mots=[fiches_mod.Mot(hanzi="休息", pinyin="xiū xi", fr="se reposer", en="to rest")],
        phrase=fiches_mod.Phrase(zh="人休。", pinyin="rén xiū.", fr="La personne se repose.", en="The person rests."),
        generation=fiches_mod.Generation(
            modele="claude-opus-5", api="messages", date="2026-09-21T10:00:00Z",
            empreinte_invite="sha256:0", essais=1,
        ),
        statut=statut,
    )


# --------------------------------------------------------------------------- périmètre


def test_le_perimetre_est_les_listes_et_leurs_briques(atelier: Path) -> None:
    rapport = export("0.1.0")
    index = lire(rapport.dossier, "index.json")
    exportes = {
        f["c"]
        for entree in index["familles"]  # type: ignore[union-attr]
        for f in lire(rapport.dossier, entree["fichier"])["fiches"]  # type: ignore[index, union-attr]
    }
    assert exportes == {"休", "明", "古", "亻", "木", "日", "月", "十", "口"}
    assert "林" not in exportes, "un caractère hors liste, brique de personne, ne s'exporte pas"


def test_une_famille_groupe_ses_membres_sous_sa_racine(atelier: Path) -> None:
    rapport = export("0.1.0")
    famille = lire(rapport.dossier, "familles/亻.json")
    assert famille["racine"]["c"] == "亻"  # type: ignore[index]
    assert [f["c"] for f in famille["fiches"]] == ["亻", "休"]  # type: ignore[union-attr]


def test_le_perimetre_se_calcule_sans_lire_les_fichiers() -> None:
    noeuds = {
        "亻": Noeud("亻", "brique", (), "亻", True),
        "木": Noeud("木", "brique", (), "木", True),
        "休": Noeud("休", "caractere", ("亻", "木"), "亻", True),
    }
    per = perimetre(noeuds, ["休"])
    assert per.caracteres == ("亻", "休", "木")
    assert per.racines == ("亻", "木")


# ----------------------------------------------------------------------- déterminisme


def test_deux_passes_ecrivent_les_memes_octets(atelier: Path) -> None:
    premier = export("0.1.0")
    avant = {c: c.read_bytes() for c in sorted(premier.dossier.rglob("*")) if c.is_file()}
    second = export("0.1.0")
    apres = {c: c.read_bytes() for c in sorted(second.dossier.rglob("*")) if c.is_file()}
    assert avant == apres
    assert premier.date == second.date, "la date ne bouge pas tant que le contenu ne bouge pas"


def test_seul_l_index_bouge_quand_seule_l_empreinte_change(atelier: Path, monkeypatch) -> None:
    """Un fichier dont le contenu n'a pas changé garde sa date, même un autre jour.

    Sans cela, corriger l'exporteur (donc l'empreinte) réécrivait des centaines de
    fichiers pour la seule note de modification.
    """
    from datetime import datetime, timezone

    import wenlu_data.export as module

    premier = module.export("0.1.0", moment=datetime(2026, 9, 21, tzinfo=timezone.utc))
    avant = {c: c.read_bytes() for c in sorted(premier.dossier.rglob("*")) if c.is_file()}
    monkeypatch.setattr(module, "FORMAT_EXPORT", module.FORMAT_EXPORT + 1)
    second = module.export("0.1.0", moment=datetime(2026, 9, 24, tzinfo=timezone.utc))
    apres = {c: c.read_bytes() for c in sorted(second.dossier.rglob("*")) if c.is_file()}
    changes = sorted(str(c.relative_to(second.dossier)) for c in apres if avant.get(c) != apres[c])
    assert changes == ["index.json"]
    assert second.date.startswith("2026-09-24")


def test_un_fichier_devenu_hors_perimetre_est_retire(atelier: Path) -> None:
    rapport = export("0.1.0")
    intrus = rapport.dossier / "familles" / "林.json"
    intrus.write_text("{}", encoding="utf-8")
    suivant = export("0.1.0")
    assert not intrus.exists()
    assert "familles/林.json" in suivant.supprimes


def test_l_audio_deja_exporte_survit_a_un_reexport(atelier: Path) -> None:
    """`audio/` appartient à `wenlu audio exporter` : l'export ne le purge pas.

    Sans cela, réexporter effaçait la voix de tous les caractères, et rien ne le
    disait — le manifeste de `data/work/` restait, lui, intact.
    """
    rapport = export("0.1.0")
    audio = rapport.dossier / "audio"
    audio.mkdir()
    (audio / "manifeste.json").write_text('{"chemins": {}}', encoding="utf-8")
    (audio / "0123456789abcdef.mp3").write_bytes(b"ID3")

    suivant = export("0.1.0")
    assert suivant.supprimes == []
    assert (audio / "0123456789abcdef.mp3").exists()
    assert (audio / "manifeste.json").exists()
    assert suivant.date == rapport.date, "un dossier étranger ne rend pas l'export périmé"


# ------------------------------------------------------------------------- validation


def test_chaque_famille_exportee_est_une_famille_valide(atelier: Path) -> None:
    rapport = export("0.1.0")
    for chemin in sorted((rapport.dossier / "familles").glob("*.json")):
        document = json.loads(chemin.read_text(encoding="utf-8"))
        famille = Famille.model_validate(document)
        assert famille.version == "0.1.0"
        assert famille.racine.c == chemin.stem
        assert famille.fiches


def test_la_decomposition_nomme_sa_source(atelier: Path) -> None:
    rapport = export("0.1.0")
    assert fiche_de(rapport.dossier, "亻", "休")["sources"] == ["makemeahanzi"]
    assert fiche_de(rapport.dossier, "亻", "亻")["sources"] == [], "une brique ne se décompose pas"


def test_l_element_ajoute_est_celui_du_jour(atelier: Path) -> None:
    rapport = export("0.1.0")
    休 = fiche_de(rapport.dossier, "亻", "休")
    assert 休["parts"] == ["亻", "木"]
    assert 休["nouveau"] == [1], "木 est posé le même jour que 休 : c'est lui, le cinabre"


def test_le_parcours_de_reference_d_un_caractere_des_deux_listes_est_lire() -> None:
    """Un caractère posé par les deux parcours prend `lire` pour référence.

    C'est `lire` qui donne alors la brique du jour, donc l'élément en cinabre.
    """
    poses = export_mod._jours_par_caractere(
        {
            "hsk": {"jours": [{"jour": 7, "brique": "口", "composes": ["休"]}]},
            "lire": {"jours": [{"jour": 2, "brique": "木", "composes": ["休"]}]},
        }
    )
    assert poses["休"] == ("lire", 2, "木")


def test_le_pinyin_vient_d_unihan(atelier: Path) -> None:
    rapport = export("0.1.0")
    assert fiche_de(rapport.dossier, "日", "明")["pinyin"] == "míng"


def test_les_niveaux_disent_de_quelle_liste_vient_le_caractere(atelier: Path) -> None:
    rapport = export("0.1.0")
    assert fiche_de(rapport.dossier, "亻", "休")["niveaux"] == {"seuil": 255}
    assert fiche_de(rapport.dossier, "十", "古")["niveaux"] == {"hsk": 1}
    assert fiche_de(rapport.dossier, "木", "木")["niveaux"] == {}


# ------------------------------------------------------------------------ relecture


def test_une_fiche_non_relue_n_entre_pas_dans_l_export(atelier: Path) -> None:
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.A_RELIRE))
    rapport = export("0.1.0")
    休 = fiche_de(rapport.dossier, "亻", "休")
    assert 休["statut"] == "sans_fiche"
    assert 休["origine_fr"] == "" and 休["origine_en"] == ""
    assert 休["mots"] == [] and 休["phrase"] is None
    assert 休["etiquette"] is None, "pas d'étiquette sans origine : jamais l'un pour l'autre"
    assert rapport.fiches_relues == 0


def test_une_fiche_relue_porte_ses_textes_et_ses_mots(atelier: Path) -> None:
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.RELU))
    rapport = export("0.1.0")
    休 = fiche_de(rapport.dossier, "亻", "休")
    assert 休["statut"] == "relu"
    assert 休["origine_fr"].startswith("Une personne")  # type: ignore[union-attr]
    assert 休["etiquette"] == "atteste"
    assert 休["roles"] == {"亻": "sens", "木": "sens"}
    assert 休["role"] == "sens", "le rôle exporté est celui de l'élément ajouté"
    assert 休["mots"][0]["hanzi"] == "休息"  # type: ignore[index]
    assert rapport.fiches_relues == 1
    index = lire(rapport.dossier, "index.json")
    famille = next(f for f in index["familles"] if f["racine"] == "亻")  # type: ignore[union-attr]
    assert famille["avancement_possible"] == 0.5


def test_un_conte_non_relu_n_entre_pas_dans_l_export(atelier: Path) -> None:
    generation = contes_mod.Generation(
        modele="claude-opus-5", api="messages", date="2026-09-21T10:00:00Z",
        empreinte_invite="sha256:0", essais=1,
    )
    commun = dict(
        conte="temoin", titre="明日", titre_pinyin="míng rì", titre_fr="Témoin",
        titre_en="Witness", ouvrage="《témoin》", resume_fr="Un témoin.",
        glose={"明": "clair"}, generation=generation,
    )
    contes_mod.ecrire_version(
        contes_mod.Version(
            seuil=255,
            phrases=[contes_mod.Phrase(zh="明日。", pinyin="míng rì", fr="Demain.", en="Tomorrow.")],
            statut=contes_mod.A_RELIRE,
            **commun,  # type: ignore[arg-type]
        )
    )
    rapport = export("0.1.0")
    assert rapport.contes == 0
    assert not (rapport.dossier / "contes").exists()

    contes_mod.ecrire_version(
        contes_mod.Version(
            seuil=255,
            phrases=[contes_mod.Phrase(zh="明日。", pinyin="míng rì", fr="Demain.", en="Tomorrow.")],
            statut=contes_mod.RELU,
            **commun,  # type: ignore[arg-type]
        )
    )
    rapport = export("0.1.0")
    assert rapport.contes == 1
    conte = lire(rapport.dossier, "contes/temoin.json")
    assert list(conte["versions"]) == ["255"]  # type: ignore[arg-type]
    index = lire(rapport.dossier, "index.json")
    assert index["contes"] == [
        {
            "id": "temoin",
            "titre_zh": "",
            "titre_pinyin": "",
            "titre_fr": "Témoin",
            "titre_en": "Witness",
            "seuils": [255],
            "fichier": "contes/temoin.json",
        }
    ]
    assert conte["titre_en"] == "Witness"
    lue = conte["versions"]["255"]  # type: ignore[index]
    assert lue["titre_pinyin"] == "míng rì"
    assert lue["phrases"] == [{"zh": "明日。", "pinyin": "míng rì", "fr": "Demain.", "en": "Tomorrow."}]
    assert lue["glose"] == {"明": {"pinyin": "", "fr": "clair", "en": ""}}


# ---------------------------------------------------------------------------- aperçu


def version_conte(statut: str, *, seuil: int = 255, conte: str = "temoin") -> contes_mod.Version:
    """Une version de conte reconnaissable, au statut voulu."""
    return contes_mod.Version(
        conte=conte,
        seuil=seuil,
        titre="明日",
        titre_pinyin="míng rì",
        titre_fr="Témoin",
        titre_en="Witness",
        ouvrage="《témoin》",
        resume_fr="Un témoin.",
        phrases=[contes_mod.Phrase(zh="明日休。", pinyin="míng rì xiū", fr="Demain, repos.", en="Rest tomorrow.")],
        glose={"明": "clair"},
        generation=contes_mod.Generation(
            modele="claude-opus-5", api="messages", date="2026-09-21T10:00:00Z",
            empreinte_invite="sha256:0", essais=1,
        ),
        statut=statut,
    )


def _controle_apercu() -> object:
    resultats = {
        c.nom: c for c in controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)
    }
    return resultats["export : aperçu"]


def test_une_fiche_a_relire_entre_dans_l_apercu_et_pas_dans_l_export(atelier: Path) -> None:
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.A_RELIRE))
    rapport = export("0.1.0")
    assert fiche_de(rapport.dossier, "亻", "休")["statut"] == "sans_fiche", "l'export principal reste sans texte"

    index = lire(rapport.dossier, "index.json")
    assert index["apercu"] == "apercu/index.json"
    apercu = lire(rapport.dossier, "apercu/index.json")
    assert apercu["statut"] == "a_relire"
    assert apercu["familles"] == [
        {"racine": "亻", "fichier": "apercu/familles/亻.json", "caracteres": ["休"]}
    ]
    assert apercu["compte"] == {"fiches": 1, "contes": 0, "versions": 0}

    famille = lire(rapport.dossier, "apercu/familles/亻.json")
    assert famille["statut"] == "a_relire" and famille["racine"] == "亻"
    (休,) = famille["fiches"]  # type: ignore[misc]
    assert 休["statut"] == "a_relire"
    assert 休["origine_fr"].startswith("Une personne")
    assert 休["etiquette"] == "atteste"
    assert 休["role"] == "sens", "le rôle de l'élément ajouté, lu sur la décomposition exportée"
    assert 休["mots"][0]["hanzi"] == "休息"
    assert 休["phrase"]["hanzi"] == "人休。"
    assert "parts" not in 休 and "pinyin" not in 休, "la décomposition reste celle de familles/"
    assert rapport.apercu_fiches == 1 and rapport.octets_apercu > 0
    assert _controle_apercu().ok  # type: ignore[attr-defined]


def test_une_fiche_relue_ou_rejetee_n_entre_jamais_dans_l_apercu(atelier: Path) -> None:
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.RELU))
    fiches_mod.ecrire_fiche(fiche_generee("明", statut=fiches_mod.REJETE))
    rapport = export("0.1.0")
    assert not (rapport.dossier / "apercu").exists()
    assert "apercu" not in lire(rapport.dossier, "index.json"), "le champ est optionnel : rien à relire, rien à renvoyer"
    assert rapport.apercu_fiches == 0
    assert _controle_apercu().ok  # type: ignore[attr-defined]


def test_un_conte_a_relire_entre_dans_l_apercu(atelier: Path) -> None:
    contes_mod.ecrire_version(version_conte(contes_mod.A_RELIRE))
    contes_mod.ecrire_version(version_conte(contes_mod.REJETE, conte="rejete"))
    rapport = export("0.1.0")
    assert lire(rapport.dossier, "index.json")["contes"] == []
    assert not (rapport.dossier / "contes").exists()

    apercu = lire(rapport.dossier, "apercu/index.json")
    assert apercu["contes"] == [
        {
            "id": "temoin",
            "titre_fr": "Témoin",
            "titre_en": "Witness",
            "seuils": [255],
            "fichier": "apercu/contes/temoin.json",
            "statut": "a_relire",
        }
    ]
    conte = lire(rapport.dossier, "apercu/contes/temoin.json")
    assert conte["statut"] == "a_relire" and conte["conte"] == "temoin"
    assert conte["versions"]["255"]["statut"] == "a_relire"  # type: ignore[index]
    assert conte["versions"]["255"]["phrases"][0]["zh"] == "明日休。"  # type: ignore[index]
    assert rapport.apercu_versions == 1
    assert _controle_apercu().ok  # type: ignore[attr-defined]


def test_l_apercu_est_deterministe_et_dans_l_empreinte(atelier: Path) -> None:
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.A_RELIRE))
    contes_mod.ecrire_version(version_conte(contes_mod.A_RELIRE))
    premier = export("0.1.0")
    avant = {c: c.read_bytes() for c in sorted(premier.dossier.rglob("*")) if c.is_file()}
    second = export("0.1.0")
    apres = {c: c.read_bytes() for c in sorted(second.dossier.rglob("*")) if c.is_file()}
    assert avant == apres
    assert _a_jour()

    # Relire la fiche change sa source : l'export est périmé, et l'aperçu fautif.
    fiches_mod.relire("休", fiches_mod.RELU)
    assert not _a_jour()
    controle = _controle_apercu()
    assert not controle.ok and controle.bloquant  # type: ignore[attr-defined]
    assert "休 n'est plus à relire" in controle.detail  # type: ignore[attr-defined]

    # Réexporter la range dans l'export principal et la retire de l'aperçu.
    rapport = export("0.1.0")
    assert fiche_de(rapport.dossier, "亻", "休")["statut"] == "relu"
    assert not (rapport.dossier / "apercu" / "familles").exists()
    assert _controle_apercu().ok  # type: ignore[attr-defined]


def test_le_controle_refuse_un_texte_relu_dans_l_apercu(atelier: Path) -> None:
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.A_RELIRE))
    rapport = export("0.1.0")
    chemin = rapport.dossier / "apercu" / "familles" / "亻.json"
    famille = lire(rapport.dossier, "apercu/familles/亻.json")
    famille["fiches"][0]["statut"] = "relu"  # type: ignore[index]
    chemin.write_text(json.dumps(famille, ensure_ascii=False), encoding="utf-8")
    controle = _controle_apercu()
    assert not controle.ok and controle.bloquant  # type: ignore[attr-defined]
    assert "au statut 'relu'" in controle.detail  # type: ignore[attr-defined]


def test_le_controle_refuse_un_fichier_d_apercu_hors_index(atelier: Path) -> None:
    rapport = export("0.1.0")
    intrus = rapport.dossier / "apercu" / "contes" / "intrus.json"
    intrus.parent.mkdir(parents=True)
    intrus.write_text("{}", encoding="utf-8")
    controle = _controle_apercu()
    assert not controle.ok  # type: ignore[attr-defined]
    assert "apercu/contes/intrus.json : hors de l'index" in controle.detail  # type: ignore[attr-defined]
    export("0.1.0")
    assert not intrus.exists(), "l'export retire ce qu'il n'écrit pas"


# -------------------------------------------------------------------------- licences


def test_aucune_definition_anglaise_dans_l_export(atelier: Path) -> None:
    """Le grep : rien de l'anglais ingéré ne ressort (sources-licences §4.2)."""
    fiches_mod.ecrire_fiche(fiche_generee("休", statut=fiches_mod.RELU))
    rapport = export("0.1.0")
    for chemin in sorted(rapport.dossier.rglob("*")):
        if chemin.is_file():
            assert TEMOIN_EN not in chemin.read_text(encoding="utf-8"), chemin


def test_les_traits_sont_a_part_avec_leur_licence(atelier: Path) -> None:
    rapport = export("0.1.0")
    traits = lire(rapport.dossier, "traits/亻.json")
    assert traits["license"] == LICENCE_TRAITS
    assert traits["license_file"] == ARPHIC
    assert set(traits["traits"]) == {"亻", "休"}  # type: ignore[arg-type]
    assert set(traits["traits"]["亻"]) == {"s", "m"}  # type: ignore[index]
    assert "conversion de format" in traits["modified"]  # type: ignore[operator]

    for chemin in sorted((rapport.dossier / "familles").glob("*.json")):
        famille = json.loads(chemin.read_text(encoding="utf-8"))
        for fiche in famille["fiches"]:
            assert fiche["traits"] == [] and fiche["medianes"] == [], "aucun tracé hors de traits/"


def test_la_licence_arphic_est_copiee_inalteree(atelier: Path) -> None:
    rapport = export("0.1.0")
    originale = (export_mod.LICENCES_SOURCE / ARPHIC).read_text(encoding="utf-8")
    assert (rapport.dossier / ARPHIC).read_text(encoding="utf-8") == originale
    assert (rapport.dossier / "traits" / ARPHIC).read_text(encoding="utf-8") == originale
    note = (rapport.dossier / "traits" / "MODIFICATIONS.md").read_text(encoding="utf-8")
    assert "Arphic Public License" in note and "Sous-ensemble" in note


def test_licences_md_liste_chaque_source(atelier: Path) -> None:
    rapport = export("0.1.0")
    texte = (rapport.dossier / "LICENCES.md").read_text(encoding="utf-8")
    for attendu in (
        "Arphic Public License",
        "Unicode License",
        "LGPL 3.0",
        "MIT",
        "CC BY-SA 4.0",
        "GF 0014-2009",
        ARPHIC,
        UNICODE_NOTICE,
        "Copyright (C) 1999 Arphic Technology Co., Ltd.",
    ):
        assert attendu in texte, attendu
    assert (rapport.dossier / UNICODE_NOTICE).exists(), "le pinyin d'Unihan vient avec sa notice"


def test_chaque_fichier_porte_son_en_tete_de_licence(atelier: Path) -> None:
    rapport = export("0.1.0")
    for chemin in sorted(rapport.dossier.rglob("*.json")):
        relatif = str(chemin.relative_to(rapport.dossier))
        document = json.loads(chemin.read_text(encoding="utf-8"))
        assert fautes_de_licence(relatif, document) == [], relatif


def test_un_fichier_qui_mele_deux_regimes_est_une_faute() -> None:
    melange = {
        "license": "propriétaire", "source": "x", "source_url": "x", "modified": "x",
        "fiches": [{"c": "休", "traits": ["M 0 0"], "medianes": []}],
    }
    assert fautes_de_licence("familles/亻.json", melange) == [
        "tracés dans une fiche propriétaire : 休"
    ]
    assert "en-tête sans license" in fautes_de_licence("traits/亻.json", {"traits": {}})


# ----------------------------------------------------------------------------- index


def test_l_index_porte_la_version_les_listes_et_les_jours(atelier: Path) -> None:
    rapport = export("0.1.0")
    index = lire(rapport.dossier, "index.json")
    assert index["version"] == "0.1.0"
    assert index["date"] == rapport.date and index["empreinte"] == rapport.empreinte
    assert index["listes"] == LISTES
    assert index["parcours"]["lire"]["jours"][1] == {  # type: ignore[index]
        "jour": 2, "brique": "木", "composes": ["休"], "non_reconcilie": False,
    }
    assert index["compte"] == {  # type: ignore[comparison-overlap]
        "familles": 6, "caracteres": 9, "briques": 6, "muettes": 0, "decoupees": 0,
        "fiches_relues": 0, "contes": 0,
    }
    assert {f["racine"] for f in index["familles"]} == set(BRIQUES)  # type: ignore[union-attr]


def test_les_paires_se_reduisent_au_perimetre(atelier: Path, tmp_path: Path) -> None:
    source = tmp_path / "paires.tsv"
    source.write_text("# témoin\n日\t月\t林\n休\t体\n古\n", encoding="utf-8")
    rapport = export("0.1.0", paires=source)
    assert lire(rapport.dossier, "paires.json")["paires"] == [["日", "月"]]
    assert rapport.paires == 1


def test_parse_paires_ignore_commentaires_et_groupes_seuls() -> None:
    assert parse_paires(["# rien", "", "己 已 巳", "天\t夫", "seul"]) == [
        ["己", "已", "巳"], ["天", "夫"]
    ]


def test_un_nom_de_fichier_sans_point_de_code_passe_par_unicode() -> None:
    assert nom_fichier("木") == "木"
    assert nom_fichier("⿰亻木") == "U+2FF0-U+4EBB-U+6728"
    assert nom_fichier("a/b") == "U+0061-U+002F-U+0062"


# ---------------------------------------------------------------------------- check


def test_le_controle_voit_un_texte_de_licence_disparu(atelier: Path) -> None:
    """L'APL veut sa licence à côté des tracés : la retirer est une faute bloquante."""
    rapport = export("0.1.0")
    (rapport.dossier / "traits" / ARPHIC).unlink()

    resultats = {
        c.nom: c for c in controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)
    }
    controle = resultats["export : textes de licence"]
    assert not controle.ok and controle.bloquant
    assert f"traits/{ARPHIC}" in controle.detail


def test_le_controle_dit_si_l_export_est_a_jour(atelier: Path) -> None:
    absent = controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)
    assert [c.nom for c in absent] == ["export : à jour"]
    assert absent[0].ok, "aucun export écrit n'est pas une faute"

    export("0.1.0")
    resultats = {
        c.nom: c for c in controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)
    }
    assert resultats["export : à jour"].ok
    assert resultats["export : séparation des licences"].ok
    assert not resultats["export : familles sans fiche relue"].ok
    assert not resultats["export : familles sans fiche relue"].bloquant

    (export_mod.INGEST / "listes.json").write_text(
        json.dumps({**LISTES, "hsk-1": ["古", "明"]}, ensure_ascii=False), encoding="utf-8"
    )
    perime = {
        c.nom: c for c in controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)
    }
    assert not perime["export : à jour"].ok and perime["export : à jour"].bloquant
    assert "0.1.0" in perime["export : à jour"].detail


def _a_jour() -> bool:
    resultats = {
        c.nom: c for c in controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)
    }
    return resultats["export : à jour"].ok


def test_corriger_l_exporteur_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Le code qui écrit l'export fait partie de l'empreinte : entrées égales, code changé, export périmé."""
    copie = tmp_path / "export.py"
    copie.write_bytes(export_mod.EXPORTEUR.read_bytes())
    monkeypatch.setattr(export_mod, "EXPORTEUR", copie)
    export("0.1.0")
    assert _a_jour()

    copie.write_bytes(copie.read_bytes() + b"\n# correction de l'exporteur\n")
    assert not _a_jour()


def test_changer_de_format_rend_l_export_perime(
    atelier: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    export("0.1.0")
    assert _a_jour()
    monkeypatch.setattr(export_mod, "FORMAT_EXPORT", export_mod.FORMAT_EXPORT + 1)
    assert not _a_jour()


def test_la_commande_export_ecrit_et_rapporte(atelier: Path) -> None:
    resultat = CliRunner().invoke(cli, ["export", "--version", "0.2.0"])
    assert resultat.exit_code == 0, resultat.output
    assert "familles : 6" in resultat.output
    assert "Aucune fiche relue" in resultat.output
    assert (export_mod.EXPORT / "0.2.0" / "index.json").exists()


def test_la_commande_export_refuse_sans_build(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(export_mod, "BUILD", tmp_path / "vide")
    monkeypatch.setattr(export_mod, "INGEST", tmp_path / "vide")
    monkeypatch.setattr(export_mod, "EXPORT", tmp_path / "public")
    resultat = CliRunner().invoke(cli, ["export"])
    assert resultat.exit_code == 1
    assert "wenlu build" in resultat.output


# ------------------------------------------------------- l'export versionné dans git


VERSIONNE = export_mod.EXPORT / export_mod.VERSION

versionne = pytest.mark.skipif(
    not (VERSIONNE / "index.json").exists(),
    reason="l'export versionné n'est pas encore écrit",
)


@versionne
def test_l_export_versionne_est_valide() -> None:
    index = json.loads((VERSIONNE / "index.json").read_text(encoding="utf-8"))
    assert index["version"] == export_mod.VERSION
    for entree in index["familles"]:
        famille = Famille.model_validate(
            json.loads((VERSIONNE / entree["fichier"]).read_text(encoding="utf-8"))
        )
        assert len(famille.fiches) == entree["n"]
        assert (VERSIONNE / entree["traits"]).exists()


@versionne
def test_l_export_versionne_separe_les_licences() -> None:
    for chemin in sorted(VERSIONNE.rglob("*.json")):
        relatif = str(chemin.relative_to(VERSIONNE)).replace("\\", "/")
        document = json.loads(chemin.read_text(encoding="utf-8"))
        assert fautes_de_licence(relatif, document) == [], relatif
    assert (VERSIONNE / ARPHIC).read_text(encoding="utf-8") == (
        export_mod.LICENCES_SOURCE / ARPHIC
    ).read_text(encoding="utf-8")


@versionne
def test_l_export_versionne_ne_porte_aucun_texte_anglais_de_source() -> None:
    """Sans fiche relue, aucun champ de texte n'est rempli : rien à traduire, rien à reprendre."""
    index = json.loads((VERSIONNE / "index.json").read_text(encoding="utf-8"))
    for entree in index["familles"]:
        famille = json.loads((VERSIONNE / entree["fichier"]).read_text(encoding="utf-8"))
        for fiche in famille["fiches"]:
            if fiche["statut"] == "sans_fiche":
                assert fiche["en"] == "" and fiche["origine_en"] == "" and fiche["fr"] == ""
                assert fiche["mots"] == []


def test_les_caracteres_de_l_interface_se_lisent(tmp_path: Path) -> None:
    """La marque et les cases du menu : un par ligne, commentaires ignorés, sans doublon."""
    from wenlu_data.export import caracteres_interface

    f = tmp_path / "caracteres.txt"
    f.write_text("# commentaire\n文\n温\n\n温\n玩 读\n", encoding="utf-8")
    assert caracteres_interface(f) == ["文", "温", "玩", "读"]
    assert caracteres_interface(tmp_path / "absent.txt") == []


def test_les_cases_du_menu_sont_dans_le_fichier_d_interface() -> None:
    """Les caractères des cases (Menu.svelte) doivent avoir leurs traits dans l'export."""
    from wenlu_data.export import caracteres_interface

    from wenlu_data.paths import INTERFACE

    assert {"文", "温", "玩", "读", "林"} <= set(caracteres_interface(INTERFACE))
