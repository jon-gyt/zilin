"""Contes par niveau : un test par règle. Aucun accès réseau, aucune clé d'API.

Le client Claude est simulé ; les textes chinois des fixtures sont des suites de
caractères sans récit, jamais des contes : un conte ne s'écrit pas à la main dans
le dépôt, il sort du pipeline.
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import contes
from wenlu_data.cli import app as cli
from wenlu_data.contes import (
    A_RELIRE,
    ESSAIS_MAX,
    REJETE,
    RELU,
    CatalogueInvalide,
    CleAbsente,
    Conte,
    Invite,
    RequeteLot,
    ResultatLot,
    SeuilInconnu,
    SeuilSansListe,
    caracteres_hors_liste,
    charger_catalogue,
    charger_seuil,
    controles,
    ecrire_version,
    generer_version,
    invite,
    lire_reponse,
    lots_en_cours,
    parse_catalogue,
    recuperer_lot,
    soumettre_lot,
    valider,
)

LISTE = list("人大天口日月山水火木")

CONTE = Conte(
    id="conte-de-test",
    titre_zh="山水",
    titre_fr="Titre de test",
    ouvrage="《测试》",
    resume_fr="Un résumé d'intrigue en une phrase.",
)


def reponse(titre: str, phrases: list[str], glose: list[str] | None = None) -> str:
    """Une réponse du modèle, telle que `output_config.format` la contraint."""
    distincts = glose if glose is not None else list(dict.fromkeys(titre + "".join(phrases)))

    def syllabes(zh: str) -> str:
        return " ".join("pīn" for c in zh if c not in "。，、")

    return json.dumps(
        {
            "titre": titre,
            "titre_pinyin": syllabes(titre),
            "phrases": [
                {"zh": zh, "pinyin": syllabes(zh), "fr": "Traduction.", "en": "Translation."} for zh in phrases
            ],
            "glose": [
                {"zh": c, "pinyin": "pīn", "fr": "sens", "en": "meaning"} for c in distincts if c not in "。，、"
            ],
        },
        ensure_ascii=False,
    )


CONFORME = reponse("山水", ["日月。", "人大天。"])
INTRUS = reponse("山水", ["日月鸟。", "鱼人。"])


class ClientSimule:
    """Client injectable : rend des réponses préparées et retient les invites reçues."""

    def __init__(self, reponses: list[str], modele: str = "modele-de-test") -> None:
        self.modele = modele
        self.reponses = list(reponses)
        self.invites: list[Invite] = []
        self.lots: dict[str, list[RequeteLot]] = {}
        self.statut = "ended"
        self._compteur = 0

    def generer(self, demande: Invite) -> str:
        self.invites.append(demande)
        return self.reponses.pop(0)

    def soumettre(self, requetes) -> str:
        self._compteur += 1
        identifiant = f"msgbatch_{self._compteur}"
        self.lots[identifiant] = list(requetes)
        self.invites.extend(r.invite for r in requetes)
        return identifiant

    def statut_lot(self, lot: str) -> str:
        return self.statut

    def resultats(self, lot: str):
        for requete in self.lots[lot]:
            yield ResultatLot(requete.custom_id, texte=self.reponses.pop(0))


def horloge() -> str:
    return "2026-09-21T10:00:00Z"


def ecrire_liste(dossier: Path, seuil: int, caracteres: list[str]) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / f"seuil-{seuil}.txt"
    chemin.write_text("\n".join(caracteres) + "\n", encoding="utf-8")
    return chemin


# --------------------------------------------------------------------------- catalogue


def test_catalogue_dix_contes_avec_leur_source() -> None:
    """Dix récits, identifiants uniques, titres FR et EN, ouvrage d'origine et résumé."""
    catalogue = charger_catalogue()
    assert len(catalogue) == 10
    assert len({c.id for c in catalogue}) == 10
    for conte in catalogue:
        assert conte.id == conte.id.lower() and " " not in conte.id
        assert conte.titre_zh and conte.titre_fr and conte.titre_en
        assert "《" in conte.ouvrage and "》" in conte.ouvrage
        assert conte.resume_fr.endswith(".")


def test_catalogue_refuse_un_doublon() -> None:
    """Deux fois le même identifiant, c'est deux fichiers de sortie pour un conte."""
    lignes = [
        "\t".join(contes.COLONNES),
        "a\t山\tTitre\tTitle\t《测试》\tRésumé.",
        "a\t水\tAutre\tOther\t《测试》\tRésumé.",
    ]
    with pytest.raises(CatalogueInvalide, match="doublon"):
        parse_catalogue(lignes)


def test_catalogue_refuse_un_entete_inattendu() -> None:
    with pytest.raises(CatalogueInvalide, match="en-tête"):
        parse_catalogue(["id\ttitre", "a\t山"])


# --------------------------------------------------------------------------- seuils


def test_seuil_sans_liste_refuse(tmp_path: Path) -> None:
    """405 à 1555 n'ont pas encore de liste : on refuse, on n'invente pas."""
    with pytest.raises(SeuilSansListe, match="405"):
        charger_seuil(405, tmp_path)


def test_seuil_hors_referentiel_refuse(tmp_path: Path) -> None:
    with pytest.raises(SeuilInconnu):
        charger_seuil(300, tmp_path)


def test_seuil_accepte_nimporte_quelle_liste(tmp_path: Path) -> None:
    """Le code ne connaît que le nom du fichier : une liste 805 se charge pareil."""
    ecrire_liste(tmp_path, 805, LISTE)
    assert charger_seuil(805, tmp_path) == LISTE


def test_seuil_255_est_versionne() -> None:
    assert len(charger_seuil(255)) == 255


# --------------------------------------------------------------------------- invite


def test_invite_porte_la_liste_du_seuil_et_la_source() -> None:
    """L'invite donne les caractères autorisés, le récit et son ouvrage d'origine."""
    demande = invite(CONTE, 255, LISTE)
    assert "".join(LISTE) in demande.utilisateur
    assert CONTE.titre_zh in demande.utilisateur
    assert CONTE.ouvrage in demande.utilisateur
    assert CONTE.resume_fr in demande.utilisateur
    assert "60 à 120" in demande.utilisateur
    assert demande.empreinte.startswith("sha256:")


def test_invite_demande_une_glose_redigee_par_le_modele() -> None:
    """La glose vient du modèle, en français et en anglais, en ses propres mots : rien
    n'est traduit ni repris d'un dictionnaire (`docs/sources-licences.md` §4.2)."""
    demande = invite(CONTE, 255, LISTE)
    assert "en français" in demande.systeme and "en anglais" in demande.systeme
    assert "rédigé par toi" in demande.systeme
    assert "jamais de définition reprise d'un dictionnaire" in demande.systeme


def test_invite_demande_le_pinyin_du_dictionnaire() -> None:
    """Une syllabe par caractère, les tons du dictionnaire : ni sandhi ni ponctuation."""
    demande = invite(CONTE, 255, LISTE)
    assert "une syllabe par caractère" in demande.systeme
    assert "sans sandhi" in demande.systeme


def test_invite_ne_touche_jamais_aux_definitions_anglaises_de_cedict() -> None:
    """Règle de licence (`docs/sources-licences.md` §4.2) : aucune entrée CC-CEDICT
    n'entre dans une invite de génération FR. Le module ne lit pas ces sources.

    Contrôle sur le code lui-même, docstring du module exclue : seules les listes de
    caractères et le test d'appartenance aux blocs sinographiques viennent d'`ingest`.
    """
    source = Path(contes.__file__).read_text(encoding="utf-8")
    code = source.split('"""', 2)[2]
    for interdit in ("cedict", "mots.json", "definition", "dictionary.txt", "etymolog"):
        assert interdit not in code.lower()

    importe = {
        alias.name
        for noeud in ast.walk(ast.parse(source))
        if isinstance(noeud, ast.ImportFrom) and noeud.module == "ingest"
        for alias in noeud.names
    }
    assert importe == {"charger_liste", "est_sinogramme"}


def test_invite_signale_les_intrus_de_lessai_precedent() -> None:
    """La relance nomme les caractères refusés, et change l'empreinte de l'invite."""
    premiere = invite(CONTE, 255, LISTE)
    seconde = invite(CONTE, 255, LISTE, intrus=["鸟", "鱼"])
    assert "鸟 鱼" in seconde.utilisateur
    assert "refusé" in seconde.utilisateur
    assert seconde.empreinte != premiere.empreinte


# --------------------------------------------------------------------------- validation


def generation_de_test(essais: int = 1) -> contes.Generation:
    return contes.Generation(
        modele="modele-de-test",
        api=contes.API_UNITAIRE,
        date=horloge(),
        empreinte_invite="sha256:" + "0" * 64,
        essais=essais,
    )


def test_validation_accepte_un_texte_de_la_liste() -> None:
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    rapport = valider(version, LISTE)
    assert rapport.conforme
    assert rapport.intrus == []


def test_validation_rejette_avec_la_liste_exacte_des_intrus() -> None:
    """Un caractère hors liste suffit : rejet, et on dit lesquels, dans l'ordre."""
    version = lire_reponse(INTRUS, conte=CONTE, seuil=255, generation=generation_de_test())
    rapport = valider(version, LISTE)
    assert not rapport.conforme
    assert rapport.intrus == ["鸟", "鱼"]


def test_validation_laisse_passer_la_ponctuation_chinoise() -> None:
    assert caracteres_hors_liste("日月。人、大！", LISTE) == []


def test_validation_signale_une_glose_incomplete_sans_rejeter() -> None:
    """La glose manquante est un écart de relecture, pas un caractère interdit."""
    brut = json.loads(CONFORME)
    brut["glose"] = brut["glose"][:1]
    version = lire_reponse(json.dumps(brut, ensure_ascii=False), conte=CONTE, seuil=255, generation=generation_de_test())
    rapport = valider(version, LISTE)
    assert rapport.conforme
    assert any("glose absente" in e for e in rapport.ecarts)


def test_validation_signale_la_longueur_hors_cible() -> None:
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    rapport = valider(version, LISTE)
    assert any("longueur" in e for e in rapport.ecarts)


# --------------------------------------------------------------------------- génération


def test_relance_sur_intrus_avec_client_simule() -> None:
    """Premier essai hors liste, relance avec les intrus signalés, second essai accepté."""
    client = ClientSimule([INTRUS, CONFORME])
    version, rapport = generer_version(CONTE, 255, LISTE, client, horloge=horloge)
    assert rapport.conforme
    assert version.statut == A_RELIRE
    assert version.generation.essais == 2
    assert len(client.invites) == 2
    assert "鸟 鱼" in client.invites[1].utilisateur


def test_trois_essais_au_plus_puis_rejet() -> None:
    """Au-delà de trois essais on s'arrête : la version est marquée rejetée."""
    client = ClientSimule([INTRUS] * (ESSAIS_MAX + 1))
    version, rapport = generer_version(CONTE, 255, LISTE, client, horloge=horloge)
    assert not rapport.conforme
    assert version.statut == REJETE
    assert version.generation.essais == ESSAIS_MAX
    assert len(client.invites) == ESSAIS_MAX
    assert version.generation.intrus == ["鸟", "鱼"]


def test_tracabilite_complete_dans_le_fichier_ecrit(tmp_path: Path) -> None:
    """Conte, seuil, modèle, date, empreinte, essais, statut, source : tout est écrit."""
    client = ClientSimule([INTRUS, CONFORME])
    version, _ = generer_version(CONTE, 255, LISTE, client, horloge=horloge)
    chemin = ecrire_version(version, tmp_path)
    assert chemin == tmp_path / "255" / "conte-de-test.json"

    document = json.loads(chemin.read_text(encoding="utf-8"))
    assert document["conte"] == "conte-de-test"
    assert document["seuil"] == 255
    assert document["source"] == {"ouvrage": CONTE.ouvrage, "resume_fr": CONTE.resume_fr}
    assert document["statut"] == A_RELIRE
    assert [p["zh"] for p in document["phrases"]] == ["日月。", "人大天。"]
    assert document["glose"]["山"] == {"pinyin": "pīn", "fr": "sens", "en": "meaning"}
    assert [p["en"] for p in document["phrases"]] == ["Translation.", "Translation."]
    assert document["titre_pinyin"] == "pīn pīn"
    generation = document["generation"]
    assert generation["modele"] == "modele-de-test"
    assert generation["api"] == "messages"
    assert generation["date"] == horloge()
    assert generation["empreinte_invite"] == client.invites[1].empreinte
    assert generation["essais"] == 2
    assert generation["intrus"] == []


# --------------------------------------------------------------------------- lots


def test_lot_soumis_puis_recupere(tmp_path: Path) -> None:
    """Un seul envoi pour tous les contes d'un seuil, puis récupération et écriture."""
    client = ClientSimule([CONFORME, CONFORME])
    catalogue = [CONTE, Conte("autre-conte", "水火", "Autre", "《测试》", "Résumé.")]
    lot = soumettre_lot(catalogue, 255, LISTE, client, dossier=tmp_path, horloge=horloge)

    assert lot["statut"] == "en_cours"
    assert [r["custom_id"] for r in lot["requetes"]] == ["255-conte-de-test-1", "255-autre-conte-1"]
    fichiers = lots_en_cours(tmp_path)
    assert [f.name for f in fichiers] == [f"{lot['lot']}.json"]

    journal = recuperer_lot(fichiers[0], client, catalogue=catalogue, autorises=LISTE, dossier=tmp_path, horloge=horloge)
    assert len(journal) == 2
    assert (tmp_path / "255" / "conte-de-test.json").exists()
    assert (tmp_path / "255" / "autre-conte.json").exists()
    assert json.loads(fichiers[0].read_text(encoding="utf-8"))["statut"] == "recupere"
    assert lots_en_cours(tmp_path) == []


def test_lot_relance_les_rejets_avec_les_intrus(tmp_path: Path) -> None:
    """Un conte hors liste repart dans un nouveau lot, avec ses intrus signalés."""
    client = ClientSimule([INTRUS])
    lot = soumettre_lot([CONTE], 255, LISTE, client, dossier=tmp_path, horloge=horloge)
    journal = recuperer_lot(
        lots_en_cours(tmp_path)[0], client, catalogue=[CONTE], autorises=LISTE, dossier=tmp_path, horloge=horloge
    )

    assert any("鸟 鱼" in ligne for ligne in journal)
    document = json.loads((tmp_path / "255" / "conte-de-test.json").read_text(encoding="utf-8"))
    assert document["statut"] == REJETE
    assert document["generation"]["intrus"] == ["鸟", "鱼"]

    relance = lots_en_cours(tmp_path)
    assert len(relance) == 1
    suivant = json.loads(relance[0].read_text(encoding="utf-8"))
    assert suivant["lot"] != lot["lot"]
    assert suivant["requetes"][0]["essai"] == 2
    assert "鸟 鱼" in client.invites[-1].utilisateur


def test_lot_non_termine_ne_recupere_rien(tmp_path: Path) -> None:
    client = ClientSimule([])
    soumettre_lot([CONTE], 255, LISTE, client, dossier=tmp_path, horloge=horloge)
    client.statut = "in_progress"
    journal = recuperer_lot(lots_en_cours(tmp_path)[0], client, catalogue=[CONTE], autorises=LISTE, dossier=tmp_path)
    assert "in_progress" in journal[0]
    assert not (tmp_path / "255").exists()
    assert len(lots_en_cours(tmp_path)) == 1


# --------------------------------------------------------------------------- check


def test_controle_check_detecte_les_caracteres_hors_liste(tmp_path: Path) -> None:
    """`wenlu check` relit les versions écrites : un intrus est bloquant."""
    listes = tmp_path / "listes"
    ecrire_liste(listes, 255, LISTE)
    version = lire_reponse(INTRUS, conte=CONTE, seuil=255, generation=generation_de_test())
    ecrire_version(version, tmp_path)

    controle = controles(tmp_path, listes)[0]
    assert controle.nom == "contes : caractères hors liste"
    assert not controle.ok and controle.bloquant
    assert "鸟 鱼" in controle.detail


def test_controle_check_accepte_une_version_conforme(tmp_path: Path) -> None:
    listes = tmp_path / "listes"
    ecrire_liste(listes, 255, LISTE)
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    ecrire_version(version, tmp_path)

    hors_liste, relecture = controles(tmp_path, listes)
    assert hors_liste.ok
    assert not relecture.ok and not relecture.bloquant
    assert "1 versions sur 1" in relecture.detail


def test_controle_check_sans_contes_ne_bloque_pas(tmp_path: Path) -> None:
    """Le contrôle lit les fichiers s'ils existent, et se tait sinon."""
    assert controles(tmp_path, tmp_path)[0].ok


def test_controle_check_compte_les_versions_relues(tmp_path: Path) -> None:
    listes = tmp_path / "listes"
    ecrire_liste(listes, 255, LISTE)
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    version.statut = RELU
    ecrire_version(version, tmp_path)
    assert controles(tmp_path, listes)[1].ok


# --------------------------------------------------------------------------- SDK


class BlocTexte:
    type = "text"

    def __init__(self, texte: str) -> None:
        self.text = texte


class MessageSimule:
    def __init__(self, texte: str, stop_reason: str = "end_turn") -> None:
        self.content = [BlocTexte(texte)]
        self.stop_reason = stop_reason


class LotsSimules:
    """Double de `client.messages.batches` : retient l'envoi, ne parle à personne."""

    def __init__(self) -> None:
        self.envoyees: list[dict] = []

    def create(self, requests):
        self.envoyees = list(requests)
        return type("Lot", (), {"id": "msgbatch_sdk"})()

    def retrieve(self, lot: str):
        return type("Etat", (), {"processing_status": "ended"})()

    def results(self, lot: str):
        succes = type("R", (), {"type": "succeeded", "message": MessageSimule(CONFORME)})()
        echec = type("R", (), {"type": "errored"})()
        return iter(
            [
                type("L", (), {"custom_id": "255-a-1", "result": succes})(),
                type("L", (), {"custom_id": "255-b-1", "result": echec})(),
            ]
        )


class MessagesSimules:
    def __init__(self, stop_reason: str = "end_turn") -> None:
        self.batches = LotsSimules()
        self.params: dict | None = None
        self._stop_reason = stop_reason

    def create(self, **params):
        self.params = params
        return MessageSimule(CONFORME, self._stop_reason)


class SdkSimule:
    def __init__(self, stop_reason: str = "end_turn") -> None:
        self.messages = MessagesSimules(stop_reason)


def test_le_client_sdk_envoie_la_meme_invite_en_unitaire_et_en_lot() -> None:
    """Messages API et Message Batches partagent le même corps de requête."""
    sdk = SdkSimule()
    client = contes.ClientAnthropic(sdk, modele=contes.MODELE)
    demande = invite(CONTE, 255, LISTE)

    assert client.generer(demande) == CONFORME
    unitaire = sdk.messages.params
    assert unitaire is not None
    assert unitaire["model"] == contes.MODELE
    assert unitaire["system"] == demande.systeme
    assert unitaire["output_config"]["format"]["type"] == "json_schema"

    assert client.soumettre([RequeteLot("255-a-1", demande)]) == "msgbatch_sdk"
    envoyee = sdk.messages.batches.envoyees[0]
    assert envoyee["custom_id"] == "255-a-1"
    assert dict(envoyee["params"]) == unitaire


def test_le_client_sdk_rend_les_resultats_dun_lot() -> None:
    client = contes.ClientAnthropic(SdkSimule(), modele=contes.MODELE)
    assert client.statut_lot("msgbatch_sdk") == "ended"
    obtenus = list(client.resultats("msgbatch_sdk"))
    assert obtenus[0] == ResultatLot("255-a-1", texte=CONFORME)
    assert obtenus[1] == ResultatLot("255-b-1", erreur="errored")


def test_le_client_sdk_refuse_une_reponse_refusee() -> None:
    client = contes.ClientAnthropic(SdkSimule("refusal"), modele=contes.MODELE)
    with pytest.raises(contes.ReponseInvalide, match="refus"):
        client.generer(invite(CONTE, 255, LISTE))


# --------------------------------------------------------------------------- clé d'API


def test_sans_cle_le_client_refuse_de_partir(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(CleAbsente, match="ANTHROPIC_API_KEY"):
        contes.client_anthropic()


def test_sans_cle_la_commande_sort_en_2_sans_rien_ecrire(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Pas de clé : on le dit, on sort en 2, et aucun fichier n'est écrit."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(contes, "CONTES_WORK", tmp_path)

    resultat = CliRunner().invoke(cli, ["contes", "generer", "--seuil", "255"])
    assert resultat.exit_code == 2
    assert "ANTHROPIC_API_KEY" in resultat.output
    assert list(tmp_path.iterdir()) == []


def test_seuil_sans_liste_sort_en_1(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(contes, "CONTES_WORK", tmp_path)
    resultat = CliRunner().invoke(cli, ["contes", "generer", "--seuil", "405"])
    assert resultat.exit_code == 1
    assert "liste absente" in resultat.output
    assert list(tmp_path.iterdir()) == []
