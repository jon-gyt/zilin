"""Contes par niveau : un test par règle. Aucun accès réseau, aucune clé d'API.

Le client Claude est simulé ; les textes chinois des fixtures sont des suites de
caractères sans récit, jamais des contes : un conte ne s'écrit pas à la main dans
le dépôt, il sort du pipeline.
"""
from __future__ import annotations

import ast
import json
import re
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import contes
from wenlu_data.cli import app as cli
from wenlu_data.ingest import est_sinogramme
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


def test_catalogue_treize_contes_avec_leur_source() -> None:
    """Onze fables et deux récits longs, identifiants uniques, titres FR et EN, ouvrage
    d'origine et résumé."""
    catalogue = charger_catalogue()
    assert len(catalogue) == 13
    assert len({c.id for c in catalogue}) == 13
    assert sum(1 for c in catalogue if not c.long) == 11
    for conte in catalogue:
        assert conte.id == conte.id.lower() and " " not in conte.id
        assert conte.titre_zh and conte.titre_fr and conte.titre_en
        assert "《" in conte.ouvrage and "》" in conte.ouvrage
        assert conte.resume_fr.endswith(".")


def test_catalogue_refuse_un_doublon() -> None:
    """Deux fois le même identifiant, c'est deux fichiers de sortie pour un conte."""
    lignes = [
        "\t".join(contes.COLONNES),
        "a\t山\tshān\tTitre\tTitle\t《测试》\t255,505\t山\t1\tRésumé.",
        "a\t水\tshuǐ\tAutre\tOther\t《测试》\t255,505\t水\t1\tRésumé.",
    ]
    with pytest.raises(CatalogueInvalide, match="doublon"):
        parse_catalogue(lignes)


def test_catalogue_veut_une_syllabe_par_caractere_du_vrai_titre() -> None:
    """Le vrai titre (愚公移山) se montre avec son pinyin : une syllabe par caractère."""
    lignes = ["\t".join(contes.COLONNES), "a\t山水\tshān\tTitre\tTitle\t《测试》\t255,505\t山\t1\tRésumé."]
    with pytest.raises(CatalogueInvalide, match="syllabe"):
        parse_catalogue(lignes)


def test_le_catalogue_donne_le_vrai_titre_et_son_pinyin() -> None:
    conte = contes.conte_par_id("yu-gong-yi-shan")
    assert (conte.titre_zh, conte.titre_pinyin) == ("愚公移山", "yú gōng yí shān")


def test_catalogue_refuse_un_entete_inattendu() -> None:
    with pytest.raises(CatalogueInvalide, match="en-tête"):
        parse_catalogue(["id\ttitre", "a\t山"])


# --------------------------------------------------------------------------- niveaux prévus

#: Les huit fables animalières : la liste 255 n'a aucun nom d'animal.
ANIMALIERS = {
    "shou-zhu-dai-tu": "兔",
    "sai-weng-shi-ma": "马",
    "hua-she-tian-zu": "蛇",
    "jing-di-zhi-wa": "蛙",
    "hu-jia-hu-wei": "虎",
    "mang-ren-mo-xiang": "象",
    "ye-gong-hao-long": "龙",
    "wang-yang-bu-lao": "羊",
}


def ligne_catalogue(identifiant: str = "a", niveaux: str = "255,505", chapitres: str = "1", cles: str = "山") -> str:
    return f"{identifiant}\t山\tshān\tTitre\tTitle\t《测试》\t{niveaux}\t{cles}\t{chapitres}\tRésumé."


def test_chaque_conte_prevoit_ses_niveaux_de_deux_paliers_en_deux() -> None:
    """Un récit simple à deux niveaux, un récit riche à trois, montant de deux paliers en
    deux ; au haut de l'échelle (HSK 7-9), moins. Pris parmi 255 et les niveaux HSK."""
    for conte in charger_catalogue():
        assert len(conte.niveaux) in (1, 2, 3), conte.id
        assert set(conte.niveaux) <= {255, *contes.HSK}, conte.id
        attendus = {contes.niveaux_attendus(conte.niveaux[0], n) for n in (2, 3)}
        assert conte.niveaux in attendus, conte.id


def test_les_contes_suivent_le_hsk_sauf_les_trois_relus_a_255() -> None:
    """Décision du propriétaire : les niveaux sont HSK ; les trois contes relus gardent 255
    pour premier niveau, et leurs suivants sont HSK."""
    a_255 = {c.id for c in charger_catalogue() if 255 in c.niveaux}
    assert a_255 == {"yu-gong-yi-shan", "ba-miao-zhu-zhang", "nan-yuan-bei-zhe"}
    for conte in charger_catalogue():
        assert all(contes.est_hsk(n) for n in conte.niveaux if n != 255), conte.id
        assert conte.niveaux.index(255) == 0 if 255 in conte.niveaux else True


def test_le_plus_bas_niveau_est_le_premier_palier_qui_a_les_caracteres_cles() -> None:
    """Relevé dans les vraies listes : chaque caractère clé est dans chaque niveau prévu, et
    le niveau HSK juste au-dessous du plus bas ne les a pas tous."""
    for conte in charger_catalogue():
        assert conte.cles, conte.id
        for n in conte.niveaux:
            assert set(conte.cles) <= set(charger_seuil(n)), (conte.id, n)
        bas = conte.niveaux[0]
        if contes.est_hsk(bas) and bas != "hsk1":
            dessous = contes.HSK[contes.HSK.index(bas) - 1]  # type: ignore[arg-type]
            assert not set(conte.cles) <= set(charger_seuil(dessous)), conte.id
    assert controles_du_depot()["contes : critère des niveaux"].ok


def controles_du_depot() -> dict[str, contes.Controle]:
    return {c.nom: c for c in controles()}


def test_les_fables_animalieres_disent_leur_animal_et_ne_descendent_pas_a_255() -> None:
    """Aucun nom d'animal dans la liste 255 : ces huit fables commencent plus haut, à un
    niveau HSK qui a leur animal."""
    liste = set(charger_seuil(255))
    par_id = {c.id: c for c in charger_catalogue()}
    for identifiant, animal in ANIMALIERS.items():
        assert animal not in liste
        assert 255 not in par_id[identifiant].niveaux, identifiant
        assert animal in par_id[identifiant].cles, identifiant


def test_le_renard_n_est_dans_aucune_liste() -> None:
    """狐假虎威 : 狐 manque jusqu'à HSK 7-9 ; seul le tigre décide du niveau, le renard se dit
    autrement ou se nomme en mot expliqué, 狐狸 (noté en tête du catalogue)."""
    assert "狐" not in set(charger_seuil("hsk7-9"))
    renard = contes.conte_par_id("hu-jia-hu-wei")
    assert renard.cles == "虎" and renard.expliquables == "狐狸"


def test_les_caracteres_cles_sont_des_sinogrammes_sans_doublon() -> None:
    with pytest.raises(CatalogueInvalide, match="cles"):
        parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(cles="山山")])
    with pytest.raises(CatalogueInvalide, match="cles"):
        parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(cles="shan")])


def test_les_personnages_cles_se_declarent_apres_une_barre_oblique() -> None:
    """`羊圈补/狼` : les caractères clés, puis ce que le récit peut nommer en mot expliqué."""
    (conte,) = parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(cles="山/鸟")])
    assert conte.cles == "山" and conte.expliquables == "鸟" and conte.declares == "山鸟"
    for fautive in ("山/", "山/山", "山/niao", "山/鸟/鸟"):
        with pytest.raises(CatalogueInvalide, match="barre oblique"):
            parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(cles=fautive)])


def test_un_personnage_cle_ne_compte_pas_dans_le_critere(tmp_path: Path) -> None:
    """Le loup de 亡羊补牢 est à HSK 7-9 : déclaré après la barre, il ne remonte pas le récit."""
    ecrire_hsk(tmp_path, {"1": "人大", "2": "天", "3": "山", "4": "水", "5": "火", "6": "木", "7-9": "狼"})
    loup = Conte(
        id="loup", titre_zh="山", titre_fr="T", ouvrage="《测试》", resume_fr="R.",
        niveaux=("hsk3", "hsk5"), cles="山", expliquables="狼",
    )
    assert contes.ecarts_au_critere(loup, tmp_path) == []


def test_le_premier_lot_declare_ses_personnages_cles() -> None:
    """Décision du propriétaire : le loup, les pousses et Monsieur Ye se nomment."""
    par_id = {c.id: c for c in charger_catalogue()}
    assert par_id["wang-yang-bu-lao"].expliquables == "狼"
    assert par_id["ba-miao-zhu-zhang"].expliquables == "苗"
    assert par_id["ye-gong-hao-long"].expliquables == "叶"


def test_les_fables_animalieres_declarent_leurs_personnages_et_objets_cles() -> None:
    """Deuxième passe : le vieil homme de la frontière, les aveugles et la trompe, la souche.
    Le geste 添 et la cruche 壶 de 画蛇添足 ne sont pas clés : rien après la barre."""
    par_id = {c.id: c for c in charger_catalogue()}
    assert par_id["sai-weng-shi-ma"].expliquables == "塞翁"
    assert par_id["mang-ren-mo-xiang"].expliquables == "盲鼻"
    assert par_id["shou-zhu-dai-tu"].expliquables == "桩"
    assert par_id["hua-she-tian-zu"].expliquables == ""


def test_le_critere_releve_un_niveau_mal_place(tmp_path: Path) -> None:
    """Clé absente d'un niveau, plus bas niveau trop haut, paliers sautés : trois écarts,
    jamais bloquants."""
    ecrire_hsk(tmp_path, {"1": "人大", "2": "天", "3": "山", "4": "水", "5": "火", "6": "木", "7-9": "日"})
    trop_haut = Conte(id="haut", titre_zh="山", titre_fr="T", ouvrage="《测试》", resume_fr="R.", niveaux=("hsk3", "hsk5"), cles="天")
    absente = Conte(id="absente", titre_zh="山", titre_fr="T", ouvrage="《测试》", resume_fr="R.", niveaux=("hsk3", "hsk5"), cles="山鸟")
    sautes = Conte(id="sautes", titre_zh="山", titre_fr="T", ouvrage="《测试》", resume_fr="R.", niveaux=("hsk3", "hsk4"), cles="山")
    juste = Conte(id="juste", titre_zh="山", titre_fr="T", ouvrage="《测试》", resume_fr="R.", niveaux=("hsk3", "hsk5"), cles="山")
    assert contes.ecarts_au_critere(trop_haut, tmp_path) == ["haut : caractères clés tous au niveau hsk2, plus bas que hsk3"]
    assert contes.ecarts_au_critere(absente, tmp_path) == ["absente : 鸟 hors du niveau hsk3", "absente : 鸟 hors du niveau hsk5"]
    assert contes.ecarts_au_critere(sautes, tmp_path) == [
        "sautes : niveaux hsk3, hsk4, attendu hsk3, hsk5 ou hsk3, hsk5, hsk7-9"
    ]
    assert contes.ecarts_au_critere(juste, tmp_path) == []
    controle = contes.controle_critere([juste, sautes], tmp_path)
    assert not controle.ok and not controle.bloquant


def test_les_contes_ecrits_a_255_le_prevoient() -> None:
    """Les trois contes relus sont écrits au seuil 255 : leur plan commence là."""
    par_id = {c.id: c for c in charger_catalogue()}
    for chemin in contes.versions_ecrites():
        version = contes.lire_version(chemin)
        assert version.seuil in par_id[version.conte].niveaux, version.cle


@pytest.mark.parametrize(
    ("niveaux", "motif"),
    [
        ("255", "deux niveaux"),
        ("255,405,505,805", "deux niveaux"),
        ("505,255", "croissants"),
        ("255,255", "croissants"),
        ("255,300", "hors des seuils"),
        ("255;505", "virgules"),
    ],
)
def test_catalogue_refuse_des_niveaux_mal_dits(niveaux: str, motif: str) -> None:
    with pytest.raises(CatalogueInvalide, match=motif):
        parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(niveaux=niveaux)])


# --------------------------------------------------------------------------- récits longs


CHAPITRES_TEST = [
    "\t".join(contes.COLONNES_CHAPITRES),
    "long\t1\tUn\tOne\tLe premier.",
    "long\t2\tDeux\tTwo\tLe second.",
]


def test_un_recit_long_a_ses_chapitres_prevus() -> None:
    lignes = ["\t".join(contes.COLONNES), ligne_catalogue("long", "405,805,1555", "2")]
    (conte,) = parse_catalogue(lignes, contes.parse_chapitres(CHAPITRES_TEST))
    assert conte.long and conte.chapitres == 2
    assert [c.titre_fr for c in conte.plan] == ["Un", "Deux"]


def test_un_recit_long_sans_tous_ses_chapitres_est_refuse() -> None:
    lignes = ["\t".join(contes.COLONNES), ligne_catalogue("long", "405,805,1555", "3")]
    with pytest.raises(CatalogueInvalide, match="prévoit 3 chapitres"):
        parse_catalogue(lignes, contes.parse_chapitres(CHAPITRES_TEST))


def test_une_fable_n_a_pas_de_chapitres_et_un_chapitre_a_son_conte() -> None:
    fable = ["\t".join(contes.COLONNES), ligne_catalogue("long")]
    with pytest.raises(CatalogueInvalide, match="fable"):
        parse_catalogue(fable, contes.parse_chapitres(CHAPITRES_TEST))
    autre = ["\t".join(contes.COLONNES), ligne_catalogue("autre")]
    with pytest.raises(CatalogueInvalide, match="hors catalogue"):
        parse_catalogue(autre, contes.parse_chapitres(CHAPITRES_TEST))


def test_les_chapitres_se_suivent_sans_trou() -> None:
    with pytest.raises(CatalogueInvalide, match="attendu 2"):
        contes.parse_chapitres([CHAPITRES_TEST[0], CHAPITRES_TEST[1], "long\t3\tTrois\tThree\tLe troisième."])


def test_le_catalogue_prevoit_deux_recits_longs_sans_texte_chinois() -> None:
    """Deux récits longs du domaine public, HSK 4 et plus, un titre et un résumé par
    chapitre ; chaque version écrite en a autant de chapitres."""
    longs = [c for c in charger_catalogue() if c.long]
    assert [c.id for c in longs] == ["mu-lan-cong-jun", "mei-hou-wang"]
    ecrites = [contes.lire_version(chemin) for chemin in contes.versions_ecrites()]
    for conte in longs:
        assert contes.rang(conte.niveaux[0]) >= contes.rang("hsk4")
        assert len(conte.plan) == conte.chapitres >= 2
        for chapitre in conte.plan:
            assert chapitre.titre_fr and chapitre.titre_en and chapitre.resume_fr.endswith(".")
            assert not any(est_sinogramme(c) for c in chapitre.titre_fr + chapitre.resume_fr)
        for version in (v for v in ecrites if v.conte == conte.id):
            assert not version.courte and len(version.chapitres) == conte.chapitres, version.cle


def test_la_generation_par_l_api_ne_prend_que_les_fables_du_seuil() -> None:
    """Un récit long se rédige par brouillon ; un conte ne s'écrit qu'aux niveaux prévus."""
    retenus = {c.id for c in contes.contes_du_seuil(charger_catalogue(), 255)}
    assert retenus == {"yu-gong-yi-shan", "ba-miao-zhu-zhang", "nan-yuan-bei-zhe"}
    assert "mu-lan-cong-jun" not in {c.id for c in contes.contes_du_seuil(charger_catalogue(), "hsk4")}


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


# --------------------------------------------------------------------------- niveaux HSK


def ecrire_hsk(dossier: Path, niveaux: dict[str, str]) -> None:
    """Des listes HSK factices : `{"1": "人大", "2": "天"}` → hsk-1.txt, hsk-2.txt."""
    dossier.mkdir(parents=True, exist_ok=True)
    for niveau, caracteres in niveaux.items():
        (dossier / f"hsk-{niveau}.txt").write_text("\n".join(caracteres) + "\n", encoding="utf-8")


def test_un_niveau_hsk_se_lit_en_cumul(tmp_path: Path) -> None:
    """HSK 3 = les caractères des niveaux 1, 2 et 3, dans l'ordre des listes."""
    ecrire_hsk(tmp_path, {"1": "人大", "2": "天", "3": "山水", "4": "火"})
    assert charger_seuil("hsk3", tmp_path) == ["人", "大", "天", "山", "水"]
    assert charger_seuil("HSK1", tmp_path) == ["人", "大"]


def test_un_niveau_hsk_sans_une_de_ses_listes_est_refuse(tmp_path: Path) -> None:
    ecrire_hsk(tmp_path, {"1": "人大", "3": "山水"})
    with pytest.raises(SeuilSansListe, match="hsk-2.txt"):
        charger_seuil("hsk3", tmp_path)


def test_les_niveaux_hsk_du_depot_se_lisent_en_cumul() -> None:
    """300 caractères par niveau de 1 à 6, 1 200 de plus pour 7-9 ; le seuil 255 tient
    tout entier dans HSK 3 : c'est pourquoi il se place au palier de HSK 1."""
    assert [len(charger_seuil(n)) for n in contes.HSK] == [300, 600, 900, 1200, 1500, 1800, 3000]
    assert [contes.rang(n) for n in contes.HSK] == [300, 600, 900, 1200, 1500, 1800, 3000]
    assert set(charger_seuil(255)) <= set(charger_seuil("hsk3"))


@pytest.mark.parametrize("valeur", ["hsk0", "hsk10", "hsk7", "300", "", True])
def test_un_niveau_inconnu_est_refuse(valeur: object) -> None:
    with pytest.raises(SeuilInconnu):
        contes.lire_niveau(valeur)


def test_un_niveau_se_lit_seuil_ou_hsk() -> None:
    assert contes.lire_niveau("255") == 255 and contes.lire_niveau(255) == 255
    assert contes.lire_niveau(" HSK7-9 ") == "hsk7-9"
    assert contes.libelle(255) == "seuil 255" and contes.libelle("hsk3") == "HSK 3"
    assert contes.au_niveau("hsk7-9") == "au niveau HSK 7-9"
    assert sorted(["hsk2", 255, "hsk1", 1555], key=contes.rang) == [255, "hsk1", "hsk2", 1555]


def test_le_catalogue_accepte_les_niveaux_hsk() -> None:
    lignes = ["\t".join(contes.COLONNES), ligne_catalogue(niveaux="255,hsk3,hsk5")]
    (conte,) = parse_catalogue(lignes)
    assert conte.niveaux == (255, "hsk3", "hsk5")


def test_un_seul_niveau_n_est_permis_qu_au_dernier_palier() -> None:
    """L'échelle s'arrête à HSK 7-9 : un récit qui y commence n'a pas de niveau au-dessus."""
    (conte,) = parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(niveaux="hsk7-9")])
    assert conte.niveaux == ("hsk7-9",)
    with pytest.raises(CatalogueInvalide, match="deux niveaux"):
        parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(niveaux="hsk6")])
    with pytest.raises(CatalogueInvalide, match="croissants"):
        parse_catalogue(["\t".join(contes.COLONNES), ligne_catalogue(niveaux="hsk3,255")])


@pytest.mark.parametrize(
    ("plus_bas", "nombre", "attendus"),
    [
        (255, 2, (255, "hsk3")),
        (255, 3, (255, "hsk3", "hsk5")),
        ("hsk3", 2, ("hsk3", "hsk5")),
        ("hsk4", 3, ("hsk4", "hsk6", "hsk7-9")),
        ("hsk5", 2, ("hsk5", "hsk7-9")),
        ("hsk5", 3, ("hsk5", "hsk6", "hsk7-9")),
        ("hsk6", 3, ("hsk6", "hsk7-9")),
        ("hsk7-9", 2, ("hsk7-9",)),
    ],
)
def test_les_niveaux_attendus_montent_de_deux_paliers(plus_bas: object, nombre: int, attendus: tuple) -> None:
    """Le critère du catalogue : le plus bas, puis deux paliers plus haut chaque fois,
    sans dépasser HSK 7-9 ; au haut de l'échelle, les paliers restants comblent."""
    assert contes.niveaux_attendus(plus_bas, nombre) == attendus  # type: ignore[arg-type]


def test_une_version_hsk_ne_prend_que_le_cumul_de_son_niveau(tmp_path: Path) -> None:
    """Un caractère du niveau 3 dans une version HSK 2 est un intrus ; ceux des niveaux 1
    et 2 passent."""
    ecrire_hsk(tmp_path, {"1": "山水日月", "2": "人大天", "3": "鸟鱼"})
    version = lire_reponse(CONFORME, conte=CONTE, seuil="hsk2", generation=generation_de_test())
    assert valider(version, charger_seuil("hsk2", tmp_path)).conforme
    fautive = lire_reponse(INTRUS, conte=CONTE, seuil="hsk2", generation=generation_de_test())
    assert "鸟" in valider(fautive, charger_seuil("hsk2", tmp_path)).intrus
    assert "鸟" not in valider(fautive, charger_seuil("hsk3", tmp_path)).intrus


def test_une_version_hsk_s_ecrit_sous_son_niveau(tmp_path: Path) -> None:
    """`hsk3/<id>.json`, `"seuil": "hsk3"` ; relue telle quelle, rangée après le seuil 255."""
    haute = lire_reponse(CONFORME, conte=CONTE, seuil="hsk3", generation=generation_de_test())
    basse = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    chemin = ecrire_version(haute, tmp_path)
    ecrire_version(basse, tmp_path)
    assert chemin == tmp_path / "hsk3" / "conte-de-test.json"
    assert json.loads(chemin.read_text(encoding="utf-8"))["seuil"] == "hsk3"
    assert [contes.lire_version(c).seuil for c in contes.versions_ecrites(tmp_path)] == [255, "hsk3"]
    assert haute.cle == "hsk3/conte-de-test"


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


# --------------------------------------------------------------------------- chapitres


def phrase_de_test(zh: str) -> contes.Phrase:
    return contes.Phrase(zh=zh, pinyin=" ".join("pīn" for c in zh if est_sinogramme(c)), fr="Phrase.", en="Sentence.")


def version_longue(chapitres: list[contes.Chapitre], seuil: int = 405) -> contes.Version:
    """Une version en chapitres ; `pīn` partout, une glose par caractère."""
    texte = "山水" + "".join(c.titre + "".join(p.zh for p in c.phrases) for c in chapitres)
    return contes.Version(
        conte="long",
        seuil=seuil,
        titre="山水",
        titre_pinyin="pīn pīn",
        titre_fr="Long",
        titre_en="Long",
        ouvrage="《测试》",
        resume_fr="Résumé.",
        phrases=[],
        chapitres=chapitres,
        glose={c: contes.Glose(fr="sens", pinyin="pīn", en="meaning") for c in dict.fromkeys(texte) if est_sinogramme(c)},
        generation=generation_de_test(),
    )


def chapitre_de_test(titre: str, n: int = 12) -> contes.Chapitre:
    """Un chapitre de `n` phrases de dix sinogrammes : 120, dans la cible du seuil 405."""
    return contes.Chapitre(
        phrases=[phrase_de_test("人大天口日月山水火木。") for _ in range(n)],
        titre=titre,
        titre_pinyin=" ".join("pīn" for _ in titre),
        titre_fr="Titre",
        titre_en="Title",
    )


CONTE_LONG = Conte(
    id="long", titre_zh="山水", titre_fr="Long", ouvrage="《测试》", resume_fr="Résumé.",
    titre_en="Long", titre_pinyin="shān shuǐ", niveaux=(405, 805), chapitres=2,
)


def test_une_version_courte_reste_une_suite_de_phrases() -> None:
    """Une fable est un seul chapitre sans titre : elle s'écrit et s'exporte comme avant."""
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    assert version.courte and len(version.chapitres) == 1
    assert version.chapitres[0].phrases == version.phrases
    document = version.en_json()
    assert "phrases" in document and "chapitres" not in document


def test_les_trois_contes_relus_se_relisent_sans_etre_reecrits() -> None:
    """Rétrocompatibilité : chaque version écrite se relit et se réécrit octet pour octet,
    sans chapitres, et son export ne change pas. Seules les versions relues s'exportent :
    une version à relire n'a pas d'export à comparer."""
    from wenlu_data import export as export_mod

    longs = {c.id for c in charger_catalogue() if c.long}
    for chemin in contes.versions_ecrites():
        version = contes.lire_version(chemin)
        assert version.courte == (version.conte not in longs), version.cle
        texte = json.dumps(version.en_json(), ensure_ascii=False, indent=1)
        assert texte == chemin.read_text(encoding="utf-8"), version.cle
        publie = export_mod.EXPORT / export_mod.VERSION / "contes" / f"{version.conte}.json"
        if publie.exists() and version.statut == contes.RELU:
            ecrit = json.loads(publie.read_text(encoding="utf-8"))["versions"][str(version.seuil)]
            assert export_mod.document_conte(version.conte, [version], "0.1.0")["versions"][str(version.seuil)] == ecrit


def test_une_version_longue_s_ecrit_par_chapitres_et_se_relit() -> None:
    version = version_longue([chapitre_de_test("日月"), chapitre_de_test("火木")])
    assert not version.courte
    assert len(version.phrases) == 24, "les phrases sont la suite des chapitres"
    assert "日月" in version.texte and "火木" in version.texte
    document = version.en_json()
    assert "phrases" not in document
    assert [c["titre"] for c in document["chapitres"]] == ["日月", "火木"]  # type: ignore[index]
    relue = contes.version_depuis_json(json.loads(json.dumps(document)))
    assert relue.chapitres == version.chapitres and relue.phrases == version.phrases


def test_une_version_longue_conforme_passe_sans_ecart() -> None:
    version = version_longue([chapitre_de_test("日月"), chapitre_de_test("火木")])
    rapport = valider(version, LISTE, CONTE_LONG)
    assert rapport.conforme and rapport.ecarts == [], rapport.ecarts


def test_un_titre_de_chapitre_hors_liste_est_un_rejet() -> None:
    version = version_longue([chapitre_de_test("日鸟"), chapitre_de_test("火木")])
    assert valider(version, LISTE).intrus == ["鸟"]


def test_la_longueur_vaut_pour_chaque_chapitre() -> None:
    version = version_longue([chapitre_de_test("日月"), chapitre_de_test("火木", n=2)])
    ecarts = valider(version, LISTE).ecarts
    assert ecarts == ["chapitre 2 : longueur 20 hors de la cible 100–180"]


def test_un_chapitre_sans_titre_ni_traduction_est_un_ecart() -> None:
    sans = contes.Chapitre(phrases=chapitre_de_test("x").phrases)
    version = version_longue([chapitre_de_test("日月"), sans])
    ecarts = valider(version, LISTE).ecarts
    assert "chapitres sans titre chinois : 2" in ecarts
    assert any(e.startswith("chapitres sans titre français ou anglais") for e in ecarts)


def test_le_catalogue_dit_les_niveaux_et_les_chapitres_prevus() -> None:
    """Un seuil que le récit ne prévoit pas, un chapitre de moins : des écarts, pas un rejet."""
    version = version_longue([chapitre_de_test("日月")], seuil=505)
    rapport = valider(version, LISTE, CONTE_LONG)
    assert rapport.conforme
    assert "niveau 505 non prévu au catalogue (niveaux prévus : 405, 805)" in rapport.ecarts
    assert "1 chapitre(s) pour 2 prévu(s) au catalogue" in rapport.ecarts


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

    hors_liste, relecture, *_ = controles(tmp_path, listes)
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


# --------------------------------------------------------------------------- check : niveaux prévus


def test_un_niveau_prevu_non_ecrit_est_signale_jamais_bloquant(tmp_path: Path) -> None:
    """Liste présente et aucune version : « à écrire » ; liste absente : « attend sa liste ».
    Un écart, jamais un blocage."""
    listes = tmp_path / "listes"
    ecrire_liste(listes, 255, LISTE)
    ecrire_liste(listes, 405, LISTE)
    conte = Conte(
        id="conte-de-test", titre_zh="山水", titre_fr="T", ouvrage="《测试》", resume_fr="R.",
        niveaux=(255, 405, 805),
    )
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    niveaux = contes.etat_des_niveaux([conte], [version], listes)
    assert [(n.seuil, n.etat) for n in niveaux] == [
        (255, contes.ECRIT), (405, contes.A_ECRIRE), (805, contes.SANS_LISTE)
    ]
    controle = contes.controle_niveaux([conte], [version], listes)
    assert controle.nom == "contes : niveaux prévus"
    assert not controle.ok and not controle.bloquant
    assert "1 écrits, 1 à écrire, 1 attendent leur liste (805)" in controle.detail
    assert "à écrire : 405/conte-de-test" in controle.detail


def test_le_check_ne_bloque_pas_sur_les_niveaux_du_depot() -> None:
    """Toutes les listes HSK sont versionnées : ce qui reste est à écrire ; `wenlu check` le
    dit, et passe."""
    resultats = {c.nom: c for c in controles()}
    niveaux = resultats["contes : niveaux prévus"]
    assert not niveaux.bloquant
    ecrits = {(p.parent.name, p.stem) for p in contes.versions_ecrites()}
    assert (
        f"30 niveaux prévus pour 13 contes, dont 2 longs : {len(ecrits)} écrits, {30 - len(ecrits)} à écrire, "
        "0 attendent leur liste"
    ) in niveaux.detail
    assert resultats["contes : catalogue"].ok and resultats["contes : catalogue"].bloquant


def test_un_catalogue_illisible_bloque_le_check(tmp_path: Path) -> None:
    catalogue = tmp_path / "catalogue.tsv"
    catalogue.write_text("\t".join(contes.COLONNES) + "\n" + ligne_catalogue(niveaux="255") + "\n", encoding="utf-8")
    resultats = {c.nom: c for c in controles(tmp_path, tmp_path, catalogue)}
    assert not resultats["contes : catalogue"].ok and resultats["contes : catalogue"].bloquant
    assert "contes : niveaux prévus" not in resultats


def test_une_version_hors_plan_est_signalee(tmp_path: Path) -> None:
    listes = tmp_path / "listes"
    ecrire_liste(listes, 255, LISTE)
    conte = Conte(id="conte-de-test", titre_zh="山水", titre_fr="T", ouvrage="《测试》", resume_fr="R.", niveaux=(405, 805))
    version = lire_reponse(CONFORME, conte=CONTE, seuil=255, generation=generation_de_test())
    controle = contes.controle_niveaux([conte], [version], listes)
    assert "255/conte-de-test : niveau 255 non prévu au catalogue" in controle.detail
    assert not controle.bloquant


def test_le_plan_dit_l_etat_de_chaque_niveau() -> None:
    resultat = CliRunner().invoke(cli, ["contes", "plan"])
    assert resultat.exit_code == 0
    etat = r"(à écrire|écrit \((a_relire|relu|rejete)\))"
    lignes = [
        rf"愚公移山 yu-gong-yi-shan : 255 écrit \(relu\) · hsk3 {etat} · hsk5 {etat}",
        rf"木兰从军 mu-lan-cong-jun, 4 chapitres : hsk4 {etat} · hsk6 {etat} · hsk7-9 {etat}",
        rf"井底之蛙 jing-di-zhi-wa : hsk7-9 {etat}",
    ]
    for ligne in lignes:
        assert re.search(rf"^{ligne}$", resultat.output, re.MULTILINE), ligne


def test_un_recit_long_ne_part_pas_a_l_api(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Il se rédige par brouillon, chapitre par chapitre : la commande le dit, n'écrit rien."""
    monkeypatch.setattr(contes, "CONTES_WORK", tmp_path)
    monkeypatch.setattr(contes, "_client", lambda modele: ClientSimule([]))
    resultat = CliRunner().invoke(cli, ["contes", "generer", "--seuil", "255", "--conte", "mu-lan-cong-jun"])
    assert resultat.exit_code == 1
    assert "récit long" in resultat.output
    assert list(tmp_path.iterdir()) == []
