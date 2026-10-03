"""Les porteurs des caractères (`wenlu_data/porteurs.py`) : les phonèmes, la découpe, le choix
du porteur et le remplacement des fichiers, une règle par test. Aucun modèle : le moteur de test
rend un signal synthétique dont chaque jeton dure un nombre connu de trames, sans parole."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

from wenlu_data import porteurs as module
from wenlu_data.audio import (
    CARACTERE,
    EMPREINTES_EXPORT,
    MANIFESTE_EXPORT,
    MOT,
    NOM_LOCAL,
    EncodeurWav,
    FournisseurLocal,
    Licence,
    TexteAudio,
    exporter,
    generer,
    lire_manifeste,
    nom_fichier,
    perimetre_exporte,
    reprendre,
)
from wenlu_data.audio import LICENCE_KOKORO
from wenlu_data.porteurs import (
    BORD_NET_DB,
    ECHANTILLONS_PAR_DUREE,
    MARGE_APRES,
    MARGE_AVANT,
    PORTEURS,
    SILENCE_DEBUT,
    DecoupeImpossible,
    Porteur,
    Rendu,
    bornes,
    choisir_porteur,
    couper,
    lectures_exportees,
    monter,
    part_nette,
    plage_par_durees,
    plage_par_silences,
)
from wenlu_data.zhuyin import numerotee, phonemes, phonemes_mot

SR = 24_000
TRAME = ECHANTILLONS_PAR_DUREE
#: Durées du moteur de test, en trames : bords, symboles de parole, pauses.
BORD, PAROLE, PAUSE = 4, 2, 6


def rendu_de(ps: str, vocab: frozenset[str] | None = None, *, durees: bool = True) -> Rendu:
    """Un rendu synthétique : 0,5 sur les symboles de parole, 0 sur les pauses et les bords."""
    x: list[float] = [0.0] * (BORD * TRAME)
    d = [BORD]
    for c in ps:
        if vocab is not None and c not in vocab:
            continue
        n = PAUSE if c in module.PAUSES else PAROLE
        d.append(n)
        x += [0.0 if c in module.PAUSES else 0.5] * (n * TRAME)
    d.append(BORD)
    x += [0.0] * (BORD * TRAME)
    return Rendu(x, d if durees else None, vocab)


class MoteurDeTest:
    """Moteur sans modèle : `rendu_phonemes` rend `rendu_de`, `echantillons` une rampe."""

    echantillonnage = SR

    def __init__(self, durees: bool = True) -> None:
        self.durees = durees
        self.phonemes: list[str] = []
        self.textes: list[str] = []

    def rendu_phonemes(self, ps: str, voix: str, vitesse: float = 1.0) -> Rendu:
        self.phonemes.append(ps)
        return rendu_de(ps, durees=self.durees)

    def echantillons(self, texte: str, voix: str) -> list[float]:
        self.textes.append(texte)
        return [(i % 100) / 50.0 - 1.0 for i in range(1200)]


# ------------------------------------------------------------------------------ phonèmes


def test_la_lecture_de_la_fiche_est_numerotee() -> None:
    assert [numerotee(x) for x in ("mā", "nǚ", "de", "zhǒng")] == ["ma1", "nv3", "de5", "zhong3"]


def test_les_phonemes_sont_ceux_de_la_recette_des_tons() -> None:
    """Mêmes tables que `data/sources/tons/voix_kokoro.py`, relevées sur le G2P de Kokoro v1.1."""
    chemin = Path(__file__).resolve().parents[1] / "sources" / "tons" / "voix_kokoro.py"
    spec = importlib.util.spec_from_file_location("voix_kokoro_porteurs", chemin)
    assert spec and spec.loader
    recette = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(recette)
    for s in ("ma1", "shi4", "zi4", "yue4", "lv3", "qu4", "er2", "wo3", "you3", "gui4", "jiong3"):
        assert phonemes(s) == recette.phonemes(s)


def test_le_porteur_double_garde_la_seconde_repetition() -> None:
    ps, debut, fin = PORTEURS["double"].phonemes(["ma1"])
    assert ps == "ㄇㄚ1, ㄇㄚ1."
    assert ps[debut:fin] == "ㄇㄚ1" and debut == len("ㄇㄚ1, ")


def test_le_porteur_double_premier_garde_la_premiere() -> None:
    ps, debut, fin = PORTEURS["double-premier"].phonemes(["ma1"])
    assert (ps, debut, fin) == ("ㄇㄚ1, ㄇㄚ1.", 0, len("ㄇㄚ1"))


def test_la_phrase_porteuse_ecrit_les_mots_comme_le_g2p() -> None:
    """« 我说妈。 » : `我3/ㄕ我1/ㄇㄚ1.`, ce qu'écrit `misaki.zh.ZHG2P(version='1.1')`."""
    ps, debut, fin = PORTEURS["je-dis"].phonemes(["ma1"])
    assert ps == "我3/ㄕ我1/ㄇㄚ1."
    assert ps[debut:fin] == "ㄇㄚ1"


def test_un_porteur_peut_suivre_la_cible() -> None:
    ps, debut, fin = PORTEURS["je-dis-milieu"].phonemes(["ma3"])
    assert ps == "我3/ㄕ我1/ㄇㄚ3/ㄓㄜ4ㄍㄜ5/ㄗㄭ4."
    assert ps[debut:fin] == "ㄇㄚ3"


def test_le_ton_de_la_cible_est_celui_de_la_lecture() -> None:
    """Le ton est écrit, jamais choisi par Kokoro : 马 mǎ reste 3 dans tous les porteurs."""
    for porteur in PORTEURS.values():
        ps, debut, fin = porteur.phonemes(["ma3"])
        assert ps[debut:fin] == phonemes_mot(["ma3"]) == "ㄇㄚ3"


def test_une_repetition_gardee_hors_du_porteur_est_refusee() -> None:
    with pytest.raises(ValueError):
        Porteur("faux", "", fois=2, garde=2)


# ------------------------------------------------------------------------------- découpe


def test_les_durees_comptent_un_jeton_de_bord_avant_les_symboles() -> None:
    places = bornes("ㄇㄚ1", [4, 2, 3, 1, 4])
    assert places == [(4 * TRAME, 6 * TRAME), (6 * TRAME, 9 * TRAME), (9 * TRAME, 10 * TRAME)]


def test_un_symbole_hors_du_vocabulaire_na_pas_de_duree() -> None:
    vocab = frozenset("ㄇㄚ1")
    places = bornes("ㄇㄚ1/ㄇ", [4, 1, 1, 1, 1, 4], vocab)
    assert places[3] is None and places[4] == (7 * TRAME, 8 * TRAME)


def test_des_durees_qui_ne_concordent_pas_sont_refusees() -> None:
    with pytest.raises(DecoupeImpossible):
        bornes("ㄇㄚ1", [4, 2, 2, 4])


def test_la_coupe_prend_un_peu_de_la_pause_qui_precede_sans_la_repetition_davant() -> None:
    ps, debut, fin = PORTEURS["double"].phonemes(["ma1"])
    r = rendu_de(ps)
    a, _ = plage_par_durees(ps, debut, fin, r.durees or [], len(r.echantillons))
    cible = bornes(ps, r.durees or [])[debut]
    assert cible is not None
    assert a == cible[0] - int(MARGE_AVANT * SR)
    assert all(v == 0.0 for v in r.echantillons[a : cible[0]])


def test_la_coupe_prend_la_queue_de_la_voix_dans_la_pause_qui_suit() -> None:
    ps, debut, fin = PORTEURS["double"].phonemes(["ma1"])
    r = rendu_de(ps)
    _, b = plage_par_durees(ps, debut, fin, r.durees or [], len(r.echantillons))
    fin_cible = bornes(ps, r.durees or [])[fin - 1]
    assert fin_cible is not None and b == fin_cible[1] + int(MARGE_APRES * SR)


def test_la_coupe_ne_prend_rien_du_mot_porteur_colle_a_la_cible() -> None:
    """« 我说X » : la coupe commence à la frontière prédite, pas un échantillon de 说 avant."""
    ps, debut, fin = PORTEURS["je-dis"].phonemes(["ma1"])
    r = rendu_de(ps)
    a, _ = plage_par_durees(ps, debut, fin, r.durees or [], len(r.echantillons))
    cible = bornes(ps, r.durees or [])[debut]
    assert cible is not None and a == cible[0]


def test_la_coupe_ne_prend_rien_du_mot_porteur_qui_suit() -> None:
    ps, debut, fin = PORTEURS["je-dis-milieu"].phonemes(["ma1"])
    r = rendu_de(ps)
    _, b = plage_par_durees(ps, debut, fin, r.durees or [], len(r.echantillons))
    fin_cible = bornes(ps, r.durees or [])[fin - 1]
    assert fin_cible is not None and b == fin_cible[1]


def test_la_coupe_aux_silences_garde_la_repetition_voulue() -> None:
    ps, debut, fin = PORTEURS["double"].phonemes(["ma1"])
    r = rendu_de(ps)
    a, b = plage_par_silences(r.echantillons, 2, 1)
    attendu = bornes(ps, r.durees or [])
    premier, dernier = attendu[debut], attendu[fin - 1]
    assert premier is not None and dernier is not None
    assert a <= premier[0] <= dernier[1] <= b
    assert a > len(r.echantillons) // 2 - 3 * PAUSE * TRAME


def test_la_coupe_aux_silences_refuse_un_compte_de_repetitions_faux() -> None:
    r = rendu_de("ㄇㄚ1, ㄇㄚ1, ㄇㄚ1.")
    with pytest.raises(DecoupeImpossible):
        plage_par_silences(r.echantillons, 2, 1)


def test_sans_durees_un_porteur_colle_a_la_cible_ne_se_coupe_pas() -> None:
    porteur = PORTEURS["je-dis"]
    ps, debut, fin = porteur.phonemes(["ma1"])
    with pytest.raises(DecoupeImpossible):
        couper(rendu_de(ps, durees=False), porteur, ps, debut, fin)


def test_sans_durees_un_porteur_entoure_de_pauses_se_coupe_aux_silences() -> None:
    porteur = PORTEURS["double"]
    ps, debut, fin = porteur.phonemes(["ma1"])
    assert couper(rendu_de(ps, durees=False), porteur, ps, debut, fin).methode == "silences"


def test_la_coupe_commence_par_un_silence_et_un_fondu() -> None:
    x = monter([0.5] * 2400)
    silence = int(SILENCE_DEBUT * SR)
    assert all(v == 0.0 for v in x[:silence])
    assert 0 < x[silence] < 0.01
    assert x[silence + 1000] == 0.5


def test_la_coupe_finit_sur_un_fondu_sans_clic() -> None:
    x = monter([0.5] * 2400)
    assert x[-1] == 0.0 and x[-2] < 0.05


def test_une_coupe_entouree_de_pauses_est_nette() -> None:
    porteur = PORTEURS["double"]
    ps, debut, fin = porteur.phonemes(["ma1"])
    coupe = couper(rendu_de(ps), porteur, ps, debut, fin)
    assert coupe.nette and max(coupe.bords_db) <= BORD_NET_DB


def test_une_coupe_qui_tombe_dans_la_voix_nest_pas_nette() -> None:
    """« 我说X » dont le signal est continu : la coupe commence dans la voix, elle est signalée."""
    porteur = PORTEURS["je-dis"]
    ps, debut, fin = porteur.phonemes(["ma1"])
    r = rendu_de(ps)
    r.echantillons = [0.5] * len(r.echantillons)
    assert not couper(r, porteur, ps, debut, fin).nette


# ---------------------------------------------------------------------------------- choix


def groupe(en_tete: float, tons: tuple[float, float, float, float] = (90, 90, 90, 90), creux: float = 80, decoupe: float = 100) -> dict:
    return {
        "en_tete": en_tete,
        "decoupe_juste": decoupe,
        "par_ton": {str(t + 1): {"en_tete": v, "creux": creux if t == 2 else 0} for t, v in enumerate(tons)},
    }


def test_le_porteur_retenu_est_celui_qui_met_le_plus_de_tons_en_tete() -> None:
    groupes = {"app": groupe(40, (39, 2, 5, 92), 2), "double": groupe(90), "je-dis": groupe(93)}
    choix, _ = choisir_porteur(groupes, {"double": 100, "je-dis": 100})
    assert choix == "je-dis"


def test_un_porteur_sous_85_pour_cent_en_tete_nest_pas_retenu() -> None:
    choix, manques = choisir_porteur({"app": groupe(40), "double": groupe(84)}, {"double": 100})
    assert choix is None and any("en tête" in r for r in manques["double"])


def test_un_ton_laisse_pour_compte_ecarte_le_porteur() -> None:
    choix, manques = choisir_porteur({"double": groupe(90, (99, 99, 60, 99))}, {"double": 100})
    assert choix is None and any("ton 3" in r for r in manques["double"])


def test_un_ton_3_sans_vrai_creux_ecarte_le_porteur() -> None:
    choix, manques = choisir_porteur({"double": groupe(90, creux=20)}, {"double": 100})
    assert choix is None and any("creux" in r for r in manques["double"])


def test_des_coupes_qui_tombent_dans_la_voix_ecartent_le_porteur() -> None:
    choix, manques = choisir_porteur({"je-dis": groupe(95)}, {"je-dis": 70})
    assert choix is None and any("coupes nettes" in r for r in manques["je-dis"])


def test_le_porteur_doit_faire_nettement_mieux_que_les_fichiers_actuels() -> None:
    choix, manques = choisir_porteur({"app": groupe(70), "double": groupe(88)}, {"double": 100})
    assert choix is None and any("gain" in r for r in manques["double"])


def test_les_fichiers_actuels_ne_concourent_pas() -> None:
    choix, manques = choisir_porteur({"app": groupe(99)}, {})
    assert choix is None and "app" not in manques


def test_la_part_des_coupes_nettes_se_compte_par_porteur() -> None:
    entrees = [
        {"groupe": "double", "bords": [-60, -50]},
        {"groupe": "double", "bords": [-10, -50]},
        {"groupe": "app"},
    ]
    assert part_nette(entrees) == {"double": 50.0}


# ------------------------------------------------------------------- pipeline et export


def _fiches(dossier: Path, lectures: dict[str, str]) -> Path:
    version = dossier / "0.1.0"
    (version / "familles").mkdir(parents=True, exist_ok=True)
    (version / "familles" / "f.json").write_text(
        json.dumps({"fiches": [{"c": c, "pinyin": p} for c, p in lectures.items()]}, ensure_ascii=False),
        encoding="utf-8",
    )
    return version


def test_les_lectures_viennent_des_fiches_exportees(tmp_path: Path) -> None:
    version = _fiches(tmp_path, {"妈": "mā", "吗": "ma", "朋友": "péngyou"})
    assert lectures_exportees(version) == {"妈": ["ma1"], "吗": ["ma5"]}


def _local(moteur: MoteurDeTest, porteur: Porteur | None = PORTEURS["double"]) -> FournisseurLocal:
    return FournisseurLocal(moteur=moteur, encodeur=EncodeurWav(), porteur=porteur, lectures={"妈": ["ma1"]})  # type: ignore[arg-type]


def test_un_caractere_est_dit_en_phonemes_dans_le_porteur() -> None:
    moteur = MoteurDeTest()
    assert _local(moteur).synthetiser("妈", "zf_001")
    assert moteur.phonemes == ["ㄇㄚ1, ㄇㄚ1."] and moteur.textes == []


def test_un_mot_reste_dit_par_son_texte() -> None:
    moteur = MoteurDeTest()
    _local(moteur).synthetiser("妈妈", "zf_001")
    assert moteur.textes == ["妈妈"] and moteur.phonemes == []


def test_un_caractere_sans_lecture_reste_dit_par_son_texte() -> None:
    moteur = MoteurDeTest()
    _local(moteur).synthetiser("人", "zf_001")
    assert moteur.textes == ["人"]


def test_un_caractere_dit_seul_est_refait_avec_le_porteur_sous_le_meme_nom(tmp_path: Path) -> None:
    textes = [TexteAudio("妈", CARACTERE), TexteAudio("妈妈", MOT)]
    generer(textes, _local(MoteurDeTest(), porteur=None), dossier=tmp_path)
    avant = lire_manifeste(tmp_path).entrees
    moteur = MoteurDeTest()
    rapport = generer(textes, _local(moteur), dossier=tmp_path)
    apres = lire_manifeste(tmp_path).entrees
    assert rapport.crees == ["妈"] and rapport.deja == ["妈妈"]
    assert apres["妈"].fichier == avant["妈"].fichier
    assert apres["妈"].empreinte != avant["妈"].empreinte
    assert apres["妈"].porteur == "double" and apres["妈妈"].porteur == ""


def test_un_caractere_deja_dit_avec_le_porteur_nest_pas_refait(tmp_path: Path) -> None:
    textes = [TexteAudio("妈", CARACTERE)]
    generer(textes, _local(MoteurDeTest()), dossier=tmp_path)
    assert generer(textes, _local(MoteurDeTest()), dossier=tmp_path).deja == ["妈"]


def test_lexport_dit_le_porteur_et_les_empreintes(tmp_path: Path) -> None:
    travail, public = tmp_path / "work", tmp_path / "public"
    textes = [TexteAudio("妈", CARACTERE), TexteAudio("妈妈", MOT)]
    generer(textes, _local(MoteurDeTest()), dossier=travail)
    exporter("0.1.0", textes, Licence("test"), dossier=travail, export=public)
    dest = public / "0.1.0" / "audio"
    document = json.loads((dest / MANIFESTE_EXPORT).read_text(encoding="utf-8"))
    assert document["porteur"]["caracteres"]["double"]["fichiers"] == 1
    lignes = (dest / EMPREINTES_EXPORT).read_text(encoding="utf-8").splitlines()
    assert len(lignes) == 2
    for ligne in lignes:
        somme, fichier = ligne.split("  ")
        assert hashlib.sha256((dest / fichier).read_bytes()).hexdigest() == somme


def _export(public: Path, chemins: dict[str, str], voix: str = "zf_001") -> Path:
    dest = public / "0.1.0" / "audio"
    dest.mkdir(parents=True, exist_ok=True)
    for f in chemins.values():
        (dest / Path(f).name).write_bytes(b"ID3" + f.encode())
    (dest / MANIFESTE_EXPORT).write_text(json.dumps({
        "fournisseur": LICENCE_KOKORO.fournisseur, "source": f"{LICENCE_KOKORO.fournisseur}, voix {voix}",
        "modified": "2026-09-24", "chemins": chemins,
    }, ensure_ascii=False), encoding="utf-8")
    return dest


def test_le_perimetre_export_est_ce_que_lapp_embarque(tmp_path: Path) -> None:
    _export(tmp_path, {"妈": "data/0.1.0/audio/a.mp3", "妈妈": "data/0.1.0/audio/b.mp3"})
    assert perimetre_exporte("0.1.0", tmp_path) == [TexteAudio("妈", CARACTERE, "export"), TexteAudio("妈妈", MOT, "export")]


def test_reprendre_remet_les_fichiers_embarques_dans_le_travail(tmp_path: Path) -> None:
    nom = nom_fichier("妈妈", "zf_001", NOM_LOCAL, "mp3")
    _export(tmp_path / "public", {"妈妈": f"data/0.1.0/audio/{nom}"})
    assert reprendre("0.1.0", dossier=tmp_path / "work", export=tmp_path / "public") == ["妈妈"]
    entree = lire_manifeste(tmp_path / "work").entrees["妈妈"]
    assert (entree.fichier, entree.voix, entree.porteur) == (nom, "zf_001", "")
    assert (tmp_path / "work" / nom).exists()


def test_reprendre_ignore_un_fichier_dont_le_nom_nest_pas_lempreinte_du_texte(tmp_path: Path) -> None:
    _export(tmp_path / "public", {"妈妈": "data/0.1.0/audio/0123456789abcdef.mp3"})
    assert reprendre("0.1.0", dossier=tmp_path / "work", export=tmp_path / "public") == []


def test_un_fichier_repris_nest_pas_refait_sauf_un_caractere_a_porter(tmp_path: Path) -> None:
    noms = {t: nom_fichier(t, "zf_001", NOM_LOCAL, "mp3") for t in ("妈", "妈妈")}
    _export(tmp_path / "public", {t: f"data/0.1.0/audio/{n}" for t, n in noms.items()})
    reprendre("0.1.0", dossier=tmp_path / "work", export=tmp_path / "public")

    class Mp3(EncodeurWav):
        format = "mp3"

    fournisseur = FournisseurLocal(moteur=MoteurDeTest(), encodeur=Mp3(), porteur=PORTEURS["double"], lectures={"妈": ["ma1"]})  # type: ignore[arg-type]
    rapport = generer(perimetre_exporte("0.1.0", tmp_path / "public"), fournisseur, dossier=tmp_path / "work")
    assert rapport.crees == ["妈"] and rapport.deja == ["妈妈"]
    assert lire_manifeste(tmp_path / "work").entrees["妈"].fichier == noms["妈"]


def test_le_porteur_par_defaut_est_un_porteur_connu() -> None:
    from wenlu_data.audio import PORTEUR_DEFAUT

    assert PORTEUR_DEFAUT == "" or PORTEUR_DEFAUT in PORTEURS
