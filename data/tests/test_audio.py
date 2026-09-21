"""Audio pré-généré : un test par règle. Aucun réseau, aucune clé, aucun audio réel.

Le fournisseur est simulé : ce qu'il rend est une suite d'octets déterministe, pas de
la parole. Aucun fichier audio réel n'entre dans le dépôt, et aucun n'est inventé.
"""
from __future__ import annotations

import json
import struct
import sys
import wave
from pathlib import Path

import pytest
from typer.testing import CliRunner

from zilin_data import audio as module
from zilin_data.audio import (
    CARACTERE,
    DES_FICHES,
    DES_LISTES,
    ECHANTILLONNAGE,
    FORMAT,
    FORMAT_REPLI,
    LONGUEUR_NOM,
    MANIFESTE,
    MANIFESTE_EXPORT,
    MOT,
    NOM_LOCAL,
    VOIX_DEFAUT,
    VOIX_LOCALE_DEFAUT,
    CleAbsente,
    EncodeurFfmpeg,
    EncodeurWav,
    FournisseurAzure,
    FournisseurInconnu,
    FournisseurLocal,
    FournisseurSimule,
    Licence,
    MoteurKokoro,
    PaquetAbsent,
    ParcoursInconnu,
    TexteAudio,
    chemins_exportes,
    controles,
    encodeur_defaut,
    exporter,
    fabriquer,
    fournisseur_azure,
    fournisseur_local,
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
    """Azure n'est plus le défaut : il faut le nommer pour qu'il réclame sa clé."""
    monkeypatch.delenv(module.CLE_ENV, raising=False)
    monkeypatch.setattr(module, "AUDIO_WORK", tmp_path / "audio")
    resultat = CliRunner().invoke(cli, ["audio", "generer", "--fournisseur", "azure"])
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


# --------------------------------------------------------------------------- voix locale


class MoteurDeTest:
    """Moteur injecté : des échantillons déterministes, aucun modèle, aucun poids.

    Il rend une rampe, pas de la parole — comme `FournisseurSimule`, il ne prétend
    pas le contraire. Il sert à contrôler le format du fichier, le manifeste et la
    licence sans télécharger 300 Mo de poids ni installer torch.
    """

    echantillonnage = ECHANTILLONNAGE

    def __init__(self, duree: float = 0.05) -> None:
        self.duree = duree
        self.appels: list[tuple[str, str]] = []

    @property
    def nombre(self) -> int:
        return int(self.echantillonnage * self.duree)

    def echantillons(self, texte: str, voix: str) -> list[float]:
        self.appels.append((texte, voix))
        return [(i % 100) / 50.0 - 1.0 for i in range(self.nombre)]


def _local(moteur: MoteurDeTest | None = None, **kw: object) -> FournisseurLocal:
    """Fournisseur local de test : moteur injecté, WAV, jamais ffmpeg ni Kokoro."""
    return FournisseurLocal(moteur=moteur or MoteurDeTest(), encodeur=EncodeurWav(), **kw)  # type: ignore[arg-type]


def _sans_paquet(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(module, "paquet_local_present", lambda: False)


def _avec_paquet(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(module, "paquet_local_present", lambda: True)


def test_le_fournisseur_local_est_selectionnable(monkeypatch: pytest.MonkeyPatch) -> None:
    """`fabriquer` rend la voix locale, et c'est elle le défaut."""
    _avec_paquet(monkeypatch)
    assert isinstance(fabriquer("local"), FournisseurLocal)
    assert isinstance(fabriquer(), FournisseurLocal)
    assert fabriquer("local").voix == VOIX_LOCALE_DEFAUT
    assert fabriquer("local", "zm_010").voix == "zm_010"


def test_le_fournisseur_azure_reste_selectionnable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(module.CLE_ENV, "clé-de-test")
    fournisseur = fabriquer("azure")
    assert isinstance(fournisseur, FournisseurAzure) and fournisseur.voix == VOIX_DEFAUT


def test_le_moteur_simule_nest_pas_accessible_depuis_la_cli(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Ce qui sort du pipeline est une voix réelle ou rien."""
    with pytest.raises(FournisseurInconnu):
        fabriquer("simule")

    monkeypatch.setattr(module, "AUDIO_WORK", tmp_path / "audio")
    resultat = CliRunner().invoke(cli, ["audio", "generer", "--fournisseur", "simule"])
    assert resultat.exit_code == 1
    assert not (tmp_path / "audio").exists()


def test_sans_le_paquet_le_fournisseur_local_refuse_de_partir(monkeypatch: pytest.MonkeyPatch) -> None:
    _sans_paquet(monkeypatch)
    with pytest.raises(PaquetAbsent) as erreur:
        fournisseur_local()
    assert module.PAQUET_LOCAL in str(erreur.value)
    assert "uv sync --extra audio" in str(erreur.value)


def test_sans_le_paquet_la_cli_sort_en_deux_et_necrit_rien(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _sans_paquet(monkeypatch)
    monkeypatch.setattr(module, "AUDIO_WORK", tmp_path / "audio")
    resultat = CliRunner().invoke(cli, ["audio", "generer", "--fournisseur", "local"])
    assert resultat.exit_code == 2
    assert module.PAQUET_LOCAL in resultat.output
    assert not (tmp_path / "audio").exists()


def test_le_chargement_du_modele_est_paresseux(monkeypatch: pytest.MonkeyPatch) -> None:
    """Construire le fournisseur n'importe rien : ni kokoro, ni torch."""
    _sans_paquet(monkeypatch)
    monkeypatch.delitem(sys.modules, "kokoro", raising=False)

    fournisseur = _local()
    assert fournisseur.nom == NOM_LOCAL
    assert "kokoro" not in sys.modules

    assert fournisseur.synthetiser("人", fournisseur.voix)
    assert "kokoro" not in sys.modules


def test_le_moteur_kokoro_nimporte_quau_premier_texte(monkeypatch: pytest.MonkeyPatch) -> None:
    """Le moteur réel se construit sans le paquet ; c'est `pipeline()` qui exige."""
    monkeypatch.setitem(sys.modules, "kokoro", None)  # l'import lèvera ImportError

    moteur = MoteurKokoro()
    assert moteur.modele == module.MODELE_LOCAL and moteur.langue == module.LANGUE_LOCALE
    with pytest.raises(PaquetAbsent):
        moteur.pipeline()


def test_le_moteur_injecte_produit_un_fichier_au_bon_format(tmp_path: Path) -> None:
    """Mono, 24 kHz, 16 bits : ce que le WAV de repli doit porter, en-tête comprise."""
    moteur = MoteurDeTest()
    fournisseur = _local(moteur)
    assert fournisseur.format == FORMAT_REPLI

    rapport = generer(CARACTERES, fournisseur, dossier=tmp_path)
    assert rapport.crees == ["人", "大"]
    assert [t for t, _ in moteur.appels] == ["人", "大"]

    fichier = tmp_path / lire_manifeste(tmp_path).entrees["人"].fichier
    assert fichier.suffix == f".{FORMAT_REPLI}"
    with wave.open(str(fichier), "rb") as lu:
        assert lu.getnchannels() == module.CANAUX
        assert lu.getsampwidth() == 2
        assert lu.getframerate() == ECHANTILLONNAGE
        assert lu.getnframes() == moteur.nombre


def test_le_manifeste_porte_le_fournisseur_et_la_voix_locaux(tmp_path: Path) -> None:
    generer(MOTS, _local(), dossier=tmp_path, )
    entree = lire_manifeste(tmp_path).entrees["天天"]
    assert entree.fournisseur == NOM_LOCAL
    assert entree.voix == VOIX_LOCALE_DEFAUT
    assert entree.format == FORMAT_REPLI
    assert entree.fichier == nom_fichier("天天", VOIX_LOCALE_DEFAUT, NOM_LOCAL, FORMAT_REPLI)


def test_la_cli_locale_ecrit_le_manifeste_du_bon_fournisseur(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Le chemin complet : `--fournisseur local --voix …`, sans paquet ni poids."""
    _avec_paquet(monkeypatch)
    monkeypatch.setattr(module, "AUDIO_WORK", tmp_path)
    monkeypatch.setattr(module, "perimetre", lambda *a, **k: list(CARACTERES))
    monkeypatch.setattr(module, "fabriquer", lambda nom, voix: _local(voix=voix or "zm_010"))

    resultat = CliRunner().invoke(cli, ["audio", "generer", "--fournisseur", "local", "--voix", "zf_003"])
    assert resultat.exit_code == 0, resultat.output
    assert f"Fournisseur {NOM_LOCAL}, voix zf_003" in resultat.output

    entrees = lire_manifeste(tmp_path).entrees
    assert {e.fournisseur for e in entrees.values()} == {NOM_LOCAL}
    assert {e.voix for e in entrees.values()} == {"zf_003"}


def test_la_licence_locale_est_declaree_et_verifiee() -> None:
    """Lue sur une source primaire : le dépôt de l'auteur, le 21 septembre 2026."""
    licence = _local().licence
    assert licence.verifie is True
    assert licence.url.startswith("https://raw.githubusercontent.com/hexgrad/kokoro/")
    assert licence.date_lecture == "2026-09-21"
    assert module.A_VERIFIER not in licence.usage_commercial
    assert module.A_VERIFIER not in licence.redevance_par_ecoute
    assert "Apache" in licence.usage_commercial
    assert licence.en_json()["verifie"] is True


def test_la_licence_locale_ne_declenche_pas_lavertissement(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """L'avertissement « à vérifier » est pour Azure, pas pour la voix locale."""
    _avec_paquet(monkeypatch)
    monkeypatch.setattr(module, "AUDIO_WORK", tmp_path)
    monkeypatch.setattr(module, "perimetre", lambda *a, **k: list(CARACTERES))
    monkeypatch.setattr(module, "fabriquer", lambda nom, voix: _local())

    resultat = CliRunner().invoke(cli, ["audio", "generer"])
    assert resultat.exit_code == 0, resultat.output
    assert module.A_VERIFIER not in resultat.output


# --------------------------------------------------------------------------- encodage


def test_sans_ffmpeg_lencodeur_est_le_repli_wav(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(module.shutil, "which", lambda _: None)
    encodeur = encodeur_defaut()
    assert isinstance(encodeur, EncodeurWav) and encodeur.format == FORMAT_REPLI


def test_avec_ffmpeg_lencodeur_vise_le_mp3(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(module.shutil, "which", lambda _: "/usr/bin/ffmpeg")
    encodeur = encodeur_defaut()
    assert isinstance(encodeur, EncodeurFfmpeg) and encodeur.format == FORMAT


def test_la_commande_ffmpeg_demande_mono_24_khz_48_kbit() -> None:
    """Le format du brief, mot pour mot, et le même que celui demandé à Azure."""
    commande = EncodeurFfmpeg("/usr/bin/ffmpeg").commande(ECHANTILLONNAGE)
    assert commande[0] == "/usr/bin/ffmpeg"
    assert commande[commande.index("-b:a") + 1] == "48k"
    assert commande[-3:] == ["-f", "mp3", "pipe:1"]
    apres = commande[commande.index("-i") :]
    assert apres[apres.index("-ac") + 1] == "1"
    assert apres[apres.index("-ar") + 1] == str(ECHANTILLONNAGE)


class _EncodeurFactice:
    """Un encodeur qui annonce le MP3 sans ffmpeg : sert au seul test de nommage."""

    format = FORMAT

    def encoder(self, echantillons: object, echantillonnage: int) -> bytes:
        return b"ID3" + bytes(64)


def test_le_repli_ne_se_confond_pas_avec_le_mp3(tmp_path: Path) -> None:
    """Le format entre dans le nom : repasser avec ffmpeg refait sans écraser."""
    assert nom_fichier("人", VOIX_LOCALE_DEFAUT, NOM_LOCAL, FORMAT_REPLI) != nom_fichier(
        "人", VOIX_LOCALE_DEFAUT, NOM_LOCAL, FORMAT
    )
    generer(CARACTERES, _local(), dossier=tmp_path)
    rapport = generer(
        CARACTERES,
        FournisseurLocal(moteur=MoteurDeTest(), encodeur=_EncodeurFactice()),
        dossier=tmp_path,
    )
    assert rapport.crees == ["人", "大"]
    assert len(list(tmp_path.glob(f"*.{FORMAT_REPLI}"))) == 2
    assert len(list(tmp_path.glob(f"*.{FORMAT}"))) == 2


def test_un_moteur_muet_est_un_echec_pas_un_fichier_vide(tmp_path: Path) -> None:
    class Muet(MoteurDeTest):
        def echantillons(self, texte: str, voix: str) -> list[float]:
            return []

    rapport = generer(CARACTERES, _local(Muet()), dossier=tmp_path)
    assert rapport.crees == [] and len(rapport.echecs) == 2
    assert list(tmp_path.glob(f"*.{FORMAT_REPLI}")) == []


def test_les_echantillons_hors_bornes_sont_ecretes() -> None:
    """Un dépassement ne doit pas s'entendre comme un claquement."""
    assert struct.unpack("<3h", module._pcm16([2.0, -2.0, 0.0])) == (32767, -32768, 0)


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
    assert [t.texte for t in perimetre_listes("hsk", listes=dossier, corpus=None, chercher_corpus=False)] == ["口", "门"]


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
