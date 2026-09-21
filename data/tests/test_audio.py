"""Audio pré-généré : un test par règle. Aucun réseau, aucune clé, aucun audio réel.

Le fournisseur est simulé : ce qu'il rend est une suite d'octets déterministe, pas de
la parole. Aucun fichier audio réel n'entre dans le dépôt, et aucun n'est inventé.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from zilin_data import audio as module
from zilin_data.audio import (
    CARACTERE,
    DES_FICHES,
    DES_LISTES,
    FORMAT,
    LONGUEUR_NOM,
    MANIFESTE,
    MANIFESTE_EXPORT,
    MOT,
    VOIX_DEFAUT,
    CleAbsente,
    FournisseurAzure,
    FournisseurSimule,
    Licence,
    ParcoursInconnu,
    TexteAudio,
    chemins_exportes,
    controles,
    exporter,
    fournisseur_azure,
    generer,
    lire_manifeste,
    nom_fichier,
    perimetre,
    perimetre_listes,
)
from zilin_data.cli import app as cli

CARACTERES = [TexteAudio("人", CARACTERE), TexteAudio("大", CARACTERE)]
MOTS = [TexteAudio("天天", MOT)]


def _listes(tmp_path: Path, nom: str = "seuil-255", caracteres: str = "人大天") -> Path:
    dossier = tmp_path / "listes"
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{nom}.txt").write_text("\n".join(caracteres) + "\n", encoding="utf-8")
    return dossier


# --------------------------------------------------------------------------- idempotence


def test_deux_passages_ne_synthetisent_quune_fois(tmp_path: Path) -> None:
    """Un texte déjà synthétisé n'est pas redemandé au fournisseur."""
    fournisseur = FournisseurSimule()
    premier = generer(CARACTERES, fournisseur, dossier=tmp_path)
    assert premier.crees == ["人", "大"] and premier.deja == []

    second = generer(CARACTERES, fournisseur, dossier=tmp_path)
    assert second.crees == [] and second.deja == ["人", "大"]
    assert [t for t, _ in fournisseur.appels] == ["人", "大"]


def test_un_fichier_deja_synthetise_nest_pas_reecrit(tmp_path: Path) -> None:
    fournisseur = FournisseurSimule()
    generer(CARACTERES, fournisseur, dossier=tmp_path)
    fichiers = {f.name: f.read_bytes() for f in tmp_path.glob(f"*.{FORMAT}")}
    generer(CARACTERES, fournisseur, dossier=tmp_path)
    assert {f.name: f.read_bytes() for f in tmp_path.glob(f"*.{FORMAT}")} == fichiers


def test_changer_de_voix_refait_un_fichier(tmp_path: Path) -> None:
    """Une autre voix est un autre audio : nouveau nom, nouvel appel, ancien gardé."""
    generer(CARACTERES, FournisseurSimule(), dossier=tmp_path)
    autre = FournisseurSimule(voix="zh-CN-YunxiNeural")
    rapport = generer(CARACTERES, autre, dossier=tmp_path)
    assert rapport.crees == ["人", "大"]
    assert len(list(tmp_path.glob(f"*.{FORMAT}"))) == 4
    assert lire_manifeste(tmp_path).entrees["人"].voix == "zh-CN-YunxiNeural"


def test_un_fichier_efface_est_resynthetise(tmp_path: Path) -> None:
    fournisseur = FournisseurSimule()
    generer(CARACTERES, fournisseur, dossier=tmp_path)
    (tmp_path / lire_manifeste(tmp_path).entrees["人"].fichier).unlink()
    assert generer(CARACTERES, fournisseur, dossier=tmp_path).crees == ["人"]


# --------------------------------------------------------------------------- manifeste


def test_le_manifeste_trace_texte_fichier_voix_fournisseur_date_empreinte(tmp_path: Path) -> None:
    fournisseur = FournisseurSimule()
    generer([*CARACTERES, *MOTS], fournisseur, dossier=tmp_path)
    manifeste = lire_manifeste(tmp_path)

    entree = manifeste.entrees["天天"]
    assert entree.genre == MOT
    assert entree.fichier == nom_fichier("天天", VOIX_DEFAUT, fournisseur.nom, FORMAT)
    assert entree.voix == VOIX_DEFAUT and entree.fournisseur == fournisseur.nom
    assert entree.date.endswith("Z") and entree.date.startswith("20")
    assert entree.empreinte == module.empreinte((tmp_path / entree.fichier).read_bytes())
    assert entree.octets == (tmp_path / entree.fichier).stat().st_size
    assert manifeste.chemins()["人"] == manifeste.entrees["人"].fichier


def test_le_manifeste_est_relu_tel_quel(tmp_path: Path) -> None:
    generer(CARACTERES, FournisseurSimule(), dossier=tmp_path)
    document = json.loads((tmp_path / MANIFESTE).read_text(encoding="utf-8"))
    assert document["format"] == FORMAT and document["debit"]
    assert [e["texte"] for e in document["entrees"]] == sorted(["人", "大"])
    assert lire_manifeste(tmp_path).entrees.keys() == {"人", "大"}


def test_sans_manifeste_le_manifeste_est_vide(tmp_path: Path) -> None:
    assert lire_manifeste(tmp_path).entrees == {}


def test_un_echec_nempeche_pas_les_autres(tmp_path: Path) -> None:
    class Bancal(FournisseurSimule):
        def synthetiser(self, texte: str, voix: str) -> bytes:
            if texte == "人":
                raise RuntimeError("503")
            return super().synthetiser(texte, voix)

    rapport = generer(CARACTERES, Bancal(), dossier=tmp_path)
    assert rapport.crees == ["大"] and [t for t, _ in rapport.echecs] == ["人"]
    assert not rapport.complet
    assert lire_manifeste(tmp_path).entrees.keys() == {"大"}


# --------------------------------------------------------------------------- refus sans clé


def test_sans_cle_le_fournisseur_refuse_de_partir(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(module.CLE_ENV, raising=False)
    with pytest.raises(CleAbsente):
        fournisseur_azure()


def test_sans_cle_rien_nest_ecrit(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv(module.CLE_ENV, raising=False)
    monkeypatch.setattr(module, "AUDIO_WORK", tmp_path / "audio")
    resultat = CliRunner().invoke(cli, ["audio", "generer"])
    assert resultat.exit_code == 2
    assert not (tmp_path / "audio").exists()


def test_avec_cle_le_fournisseur_nappelle_rien_a_la_construction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """La clé vient de l'environnement, et la construction ne touche pas au réseau."""
    monkeypatch.setenv(module.CLE_ENV, "clé-de-test")
    monkeypatch.setenv(module.REGION_ENV, "francecentral")
    fournisseur = FournisseurAzure()
    assert fournisseur.url.startswith("https://francecentral.")
    assert fournisseur.licence.verifie is False
    assert fournisseur.licence.redistribution == module.A_VERIFIER


def test_le_ssml_echappe_le_texte(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(module.CLE_ENV, "clé-de-test")
    ssml = FournisseurAzure().ssml("人 & <人>", VOIX_DEFAUT)
    assert "&amp;" in ssml and "&lt;人&gt;" in ssml
    assert ssml.count("<voice") == 1


# --------------------------------------------------------------------------- périmètre


def test_le_perimetre_des_listes_prend_les_caracteres_de_la_liste(tmp_path: Path) -> None:
    textes = perimetre_listes("lire", 255, listes=_listes(tmp_path), chercher_corpus=False)
    assert [t.texte for t in textes] == ["人", "大", "天"]
    assert {t.genre for t in textes} == {CARACTERE}
    assert {t.origine for t in textes} == {DES_LISTES}


def test_le_perimetre_des_listes_ajoute_les_mots_candidats(tmp_path: Path) -> None:
    class CorpusDeTest:
        def __contains__(self, c: object) -> bool:
            return c == "天"

        def candidats(self, c: str) -> list[object]:
            return [type("M", (), {"hanzi": "天天"})(), type("M", (), {"hanzi": "天空"})()]

    textes = perimetre_listes("lire", 255, listes=_listes(tmp_path), corpus=CorpusDeTest())
    # 天空 est écarté : 空 n'est pas dans la liste, donc pas encore lisible.
    assert [t.texte for t in textes] == ["人", "大", "天", "天天"]
    assert textes[-1].genre == MOT


def test_le_perimetre_hsk_lit_sa_propre_liste(tmp_path: Path) -> None:
    dossier = _listes(tmp_path, nom="hsk-1", caracteres="口门")
    assert [t.texte for t in perimetre_listes("hsk", listes=dossier, corpus=None)] == ["口", "门"]


def test_un_parcours_inconnu_est_refuse() -> None:
    with pytest.raises(ParcoursInconnu):
        perimetre("chanter")


def test_les_fiches_relues_passent_avant_les_listes(tmp_path: Path) -> None:
    from zilin_data.fiches import RELU, Fiche, Generation, Mot, Phrase, ecrire_fiche

    def fiche(c: str, statut: str) -> Fiche:
        return Fiche(
            c=c,
            parcours="lire",
            jour=1,
            pinyin=("x",),
            composants=(c,),
            structure=c,
            origine_fr="Un. Deux. Trois.",
            origine_en="One. Two. Three.",
            etiquette="atteste",
            roles={c: "forme"},
            mots=[Mot(hanzi=f"{c}{c}", pinyin="x x", fr="a", en="b")],
            phrase=Phrase(zh=c, pinyin="x", fr="a", en="b"),
            generation=Generation("m", "messages", "2026-01-01T00:00:00Z", "sha256:x", 1),
            statut=statut,
        )

    fiches = tmp_path / "fiches"
    ecrire_fiche(fiche("人", RELU), fiches)
    ecrire_fiche(fiche("大", "a_relire"), fiches)

    textes = perimetre("lire", 255, fiches_dossier=fiches, listes=_listes(tmp_path))
    assert [(t.texte, t.genre) for t in textes] == [("人", CARACTERE), ("人人", MOT)]
    assert {t.origine for t in textes} == {DES_FICHES}


def test_le_perimetre_na_pas_de_doublon(tmp_path: Path) -> None:
    """Un mot candidat des deux caractères qu'il contient n'est synthétisé qu'une fois."""

    class CorpusDeTest:
        def __contains__(self, c: object) -> bool:
            return True

        def candidats(self, c: str) -> list[object]:
            return [type("M", (), {"hanzi": "大人"})()]

    textes = perimetre_listes("lire", 255, listes=_listes(tmp_path), corpus=CorpusDeTest())
    assert [t.texte for t in textes] == ["人", "大", "天", "大人"]


# --------------------------------------------------------------------------- nom de fichier


def test_le_nom_de_fichier_est_une_empreinte_stable() -> None:
    nom = nom_fichier("天天", VOIX_DEFAUT, "azure-speech")
    assert nom == nom_fichier("天天", VOIX_DEFAUT, "azure-speech")
    tige, _, extension = nom.partition(".")
    assert extension == FORMAT
    assert len(tige) == LONGUEUR_NOM
    assert all(c in "0123456789abcdef" for c in tige)


def test_le_nom_de_fichier_depend_du_texte_de_la_voix_et_du_fournisseur() -> None:
    base = nom_fichier("人", VOIX_DEFAUT, "azure-speech")
    assert base != nom_fichier("大", VOIX_DEFAUT, "azure-speech")
    assert base != nom_fichier("人", "zh-CN-YunxiNeural", "azure-speech")
    assert base != nom_fichier("人", VOIX_DEFAUT, "autre")


# --------------------------------------------------------------------------- export


def test_lexport_copie_le_perimetre_et_ecrit_les_chemins(tmp_path: Path) -> None:
    travail, public = tmp_path / "work", tmp_path / "public"
    generer([*CARACTERES, *MOTS], FournisseurSimule(), dossier=travail)

    rapport = exporter("0.1.0", [*CARACTERES, *MOTS], Licence("simule"), dossier=travail, export=public)
    assert rapport["copies"] == 3 and rapport["manquants"] == []

    dest = public / "0.1.0" / "audio"
    document = json.loads((dest / MANIFESTE_EXPORT).read_text(encoding="utf-8"))
    assert document["license"] and document["source_url"] is not None and document["modified"]
    chemin = document["chemins"]["天天"]
    assert chemin.startswith("data/0.1.0/audio/") and chemin.endswith(f".{FORMAT}")
    assert (dest / Path(chemin).name).exists()
    assert chemins_exportes("0.1.0", public)["人"] == document["chemins"]["人"]


def test_lexport_nembarque_que_le_perimetre(tmp_path: Path) -> None:
    travail, public = tmp_path / "work", tmp_path / "public"
    generer([*CARACTERES, *MOTS], FournisseurSimule(), dossier=travail)
    exporter("0.1.0", CARACTERES, Licence("simule"), dossier=travail, export=public)
    dest = public / "0.1.0" / "audio"
    assert len(list(dest.glob(f"*.{FORMAT}"))) == 2
    assert "天天" not in chemins_exportes("0.1.0", public)


def test_un_texte_sans_audio_est_simplement_absent_de_lexport(tmp_path: Path) -> None:
    travail, public = tmp_path / "work", tmp_path / "public"
    generer(CARACTERES, FournisseurSimule(), dossier=travail)
    rapport = exporter("0.1.0", [*CARACTERES, *MOTS], Licence("simule"), dossier=travail, export=public)
    assert rapport["manquants"] == ["天天"]
    assert "天天" not in chemins_exportes("0.1.0", public)


# --------------------------------------------------------------------------- contrôle


def test_le_controle_signale_les_textes_sans_audio(tmp_path: Path) -> None:
    generer(CARACTERES, FournisseurSimule(), dossier=tmp_path)
    (controle,) = controles(textes=[*CARACTERES, *MOTS], dossier=tmp_path)
    assert controle.nom == "audio : textes sans audio"
    assert controle.ok is False
    assert "天天" in controle.detail
    assert controle.bloquant is False


def test_le_controle_passe_quand_tout_parle(tmp_path: Path) -> None:
    generer([*CARACTERES, *MOTS], FournisseurSimule(), dossier=tmp_path)
    (controle,) = controles(textes=[*CARACTERES, *MOTS], dossier=tmp_path)
    assert controle.ok is True


def test_le_controle_sans_perimetre_ne_signale_rien(tmp_path: Path) -> None:
    (controle,) = controles(textes=[], dossier=tmp_path)
    assert controle.ok is True and "aucun périmètre" in controle.detail
