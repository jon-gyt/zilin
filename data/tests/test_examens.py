"""Les examens 科举 et les 月课 : liste, séries, périmètre, pinyin, glose, questions, export.

Un test par règle. Aucun réseau. Les règles (brief §8, « Les examens 科举 ») : trente-sept
examens aux paliers de caractères lus, six à titre et trente et un 月课, jamais plus de 55
caractères de l'un au suivant ; dix questions à titre, cinq au 月课 (« 10 et 5 », 29
septembre 2026), reçu à quatre sur cinq ; deux séries par examen et par chemin, sans texte commun ; chaque série écrite avec
les seuls caractères posés au jour du palier, et, au 月课, chaque question porte un
caractère du tronçon ; pinyin aux tons du dictionnaire ; chaque sinogramme glosé ; seules
les séries relues s'exportent ; la rédaction est traçable.
"""
from __future__ import annotations

import dataclasses
import json
from pathlib import Path

import pytest

from wenlu_data import examens as ex
from wenlu_data.contes import API_SESSION, MODELE_MANUEL, Glose, Phrase
from wenlu_data.heros import charger as charger_heros

#: Un chemin miniature : chaque jour pose une brique, parfois un composé.
PARCOURS = {
    "jours": [
        {"jour": 1, "brique": "人", "composes": []},
        {"jour": 2, "brique": "大", "composes": ["天"]},
        {"jour": 3, "brique": "月", "composes": ["明"]},
        {"jour": 4, "brique": "日", "composes": ["门"]},
        {"jour": 5, "brique": "口", "composes": ["见"]},
    ]
}

GLOSSAIRE = {
    "人": Glose("personne", "rén", "person"),
    "大": Glose("grand", "dà", "big"),
    "天": Glose("ciel", "tiān", "sky"),
    "月": Glose("lune", "yuè", "moon"),
    "明": Glose("clair", "míng", "bright"),
    "日": Glose("soleil", "rì", "sun"),
    "门": Glose("porte", "mén", "door"),
    "口": Glose("bouche", "kǒu", "mouth"),
    "见": Glose("voir", "jiàn", "to see"),
    "明天": Glose("demain", "míng tiān", "tomorrow"),
    "门口": Glose("devant la porte", "mén kǒu", "doorway"),
}

TITRE = ex.Examen("xianshi", "titre", "县试", "xiànshì", "fr", "en", 4, "", 10)
YUEKE = ex.Examen("yueke-8", "yueke", "月课", "yuèkè", "fr", "en", 8, "", 5)


def comprendre(rang: int = 1, porte: tuple[str, ...] = ("门", "口"), support: str = "s1") -> ex.Question:
    return ex.Question(
        rang=rang,
        type="comprendre",
        consigne=("Où ?", "Where?"),
        choix=(("devant la porte", "at the door"), ("en haut", "up"), ("dehors", "out"), ("dedans", "in")),
        reponse=0,
        porte=porte,
        support=support,
    )


def serie(questions: tuple[ex.Question, ...] | None = None, lignes: tuple[tuple[str, str], ...] | None = None) -> ex.Serie:
    lignes = lignes or (("明天，门口见！", "míng tiān mén kǒu jiàn"),)
    support = ex.Support("s1", "message", ("ctx", "ctx"), tuple(Phrase(zh, py, "fr", "en") for zh, py in lignes))
    return ex.Serie("xianshi", "lire", "A", "relu", (support,), questions or (comprendre(),))


def complete(sorte: str = "titre") -> ex.Serie:
    """Une série juste : le nombre de questions, la revue, trois types de mise en situation."""
    revue = [
        ex.Question(
            rang=0,
            type="sens",
            consigne=("?", "?"),
            choix=(("porte", "door"), ("bouche", "mouth"), ("soleil", "sun"), ("lune", "moon")),
            reponse=0,
            porte=("门",),
            objet=Phrase("门", "mén", "porte", "door"),
        )
    ] * ex.REVUE[sorte][0]
    situation = [
        comprendre(),
        ex.Question(0, "reperer", ("?", "?"), ("门口", "明天", "见", "人"), 0, ("门", "口"), "s1"),
        ex.Question(
            0,
            "vrai_faux",
            ("?", "?"),
            (),
            False,
            ("明",),
            "s1",
            affirmation=Phrase("今天见。", "jīn tiān jiàn", "fr", "en"),
        ),
    ]
    reste = ex.QUESTIONS[sorte] - len(revue) - len(situation)
    qs = revue + situation + [dataclasses.replace(comprendre(), choix=comprendre().choix[::-1], reponse=3)] * reste
    lignes = (("明天，门口见！", "míng tiān mén kǒu jiàn"), ("人大。", "rén dà"))
    return serie(tuple(dataclasses.replace(q, rang=i) for i, q in enumerate(qs, start=1)), lignes)


# --------------------------------------------------------------------------- la liste


def test_recu_a_quatre_reponses_sur_cinq() -> None:
    assert (ex.reussite(5), ex.reussite(10), ex.reussite(15)) == (4, 8, 12)


def test_la_liste_versionnee_suit_le_brief() -> None:
    examens, fautes = ex.charger_liste()
    nominations, f_nom = ex.charger_nominations()
    rangs = [r.hz for r in charger_heros().rangs]
    assert fautes == f_nom == []
    assert ex.fautes_liste(examens, nominations, rangs) == []
    assert len(examens) == 37 and sum(e.sorte == "yueke" for e in examens) == 31
    assert [e.palier for e in examens if e.sorte == "titre"] == [50, 100, 200, 255, 505, 805]
    assert [e.titre for e in examens if e.titre] == ["童生", "秀才", "举人", "贡士", "进士"]


def test_jamais_plus_de_55_caracteres_d_un_examen_au_suivant() -> None:
    examens, _ = ex.charger_liste()
    sans_150 = [e for e in examens if e.palier != 150]
    assert any("écart de plus de 55" in f for f in ex.fautes_liste(sans_150, []))


def test_un_yueke_ne_donne_aucun_titre() -> None:
    examens, _ = ex.charger_liste()
    faux = [dataclasses.replace(e, titre="童生") if e.id == "yueke-75" else e for e in examens]
    assert any("aucun titre" in f for f in ex.fautes_liste(faux, []))


def test_dix_questions_a_titre_et_cinq_au_yueke() -> None:
    examens, _ = ex.charger_liste()
    assert {e.sorte: e.questions for e in examens} == {"titre": 10, "yueke": 5}
    faux = [dataclasses.replace(e, questions=15) if e.id == "xianshi" else e for e in examens]
    assert any("15 questions, attendu 10" in f for f in ex.fautes_liste(faux, []))
    faux = [dataclasses.replace(e, questions=10) if e.id == "yueke-75" else e for e in examens]
    assert any("10 questions, attendu 5" in f for f in ex.fautes_liste(faux, []))


def test_titres_et_nominations_dans_l_ordre_des_rangs() -> None:
    examens, _ = ex.charger_liste()
    nominations, _ = ex.charger_nominations()
    rangs = [r.hz for r in charger_heros().rangs]
    inverses = list(reversed(nominations))
    assert any("ordre des rangs" in f for f in ex.fautes_liste(examens, inverses, rangs))


def test_les_phrases_de_l_ecran_n_ont_que_leurs_jetons() -> None:
    textes, fautes = ex.charger_textes()
    assert fautes == [] and ex.fautes_textes(textes) == []
    assert any("jeton inconnu" in f for f in ex.fautes_textes({**textes, "attente": "Dans {jours} jours."}))


def test_les_noms_d_examen_se_dessinent() -> None:
    examens, _ = ex.charger_liste()
    assert ex.caracteres_dessines(examens) == sorted("县试府院乡会殿月课")


# --------------------------------------------------------------------------- l'acquis


def test_le_palier_tombe_au_jour_ou_entre_le_ne_caractere() -> None:
    assert ex.jour_du_palier(4, PARCOURS) == 3
    assert ex.acquis_du_palier(4, PARCOURS) == ["人", "大", "天", "月", "明"]
    assert ex.jour_du_palier(99, PARCOURS) is None


def test_le_troncon_est_ce_qui_entre_depuis_l_examen_precedent() -> None:
    assert ex.troncon(YUEKE, [TITRE, YUEKE], PARCOURS) == ["日", "门", "口", "见"]


def test_un_caractere_hors_de_l_acquis_du_palier_est_un_ecart() -> None:
    autorises = ex.acquis_du_palier(4, PARCOURS)
    assert ex.ecarts_perimetre(serie(), autorises) == ["hors de l'acquis du palier : 门 口 见"]


def test_au_yueke_chaque_question_porte_un_caractere_du_troncon() -> None:
    autorises = ex.acquis_du_palier(8, PARCOURS)
    t = ex.troncon(YUEKE, [TITRE, YUEKE], PARCOURS)
    assert ex.ecarts_perimetre(serie(), autorises, t) == []
    s = serie((comprendre(porte=("明",)),))
    assert any("sans caractère du tronçon" in e for e in ex.ecarts_perimetre(s, autorises, t))


# --------------------------------------------------------------------------- pinyin, glose


def test_le_pinyin_a_une_syllabe_par_sinogramme() -> None:
    s = serie(lignes=(("明天，门口见！", "míng tiān mén kǒu"),))
    assert any("4 syllabes pour 5 caractères" in e for e in ex.ecarts_pinyin(s))


def test_le_pinyin_suit_les_lectures_du_caractere() -> None:
    lectures = {"明": ("míng",), "天": ("tiān",), "门": ("mén",), "口": ("kǒu",), "见": ("jiàn",)}
    assert ex.ecarts_pinyin(serie(), lectures) == []
    s = serie(lignes=(("明天，门口见！", "míng tiān mén kǒu jiǎn"),))
    assert any("ne se lit pas" in e for e in ex.ecarts_pinyin(s, lectures))


def test_chaque_sinogramme_est_glose() -> None:
    assert ex.ecarts_glose(serie(), GLOSSAIRE) == []
    sans = {k: v for k, v in GLOSSAIRE.items() if k != "见"}
    assert any("glose absente pour 见" in e for e in ex.ecarts_glose(serie(), sans))


def test_la_glose_suit_le_pinyin_du_texte() -> None:
    faux = {**GLOSSAIRE, "门口": Glose("devant la porte", "mén kou", "doorway")}
    assert any("门口 glosé" in e for e in ex.ecarts_glose(serie(), faux))


# --------------------------------------------------------------------------- les questions


def test_une_serie_juste_n_a_aucun_ecart_de_question() -> None:
    assert ex.ecarts_questions(complete(), TITRE, glossaire=GLOSSAIRE) == []
    assert ex.ecarts_questions(complete("yueke"), YUEKE, glossaire=GLOSSAIRE) == []


def test_le_nombre_de_questions_est_celui_de_l_examen() -> None:
    assert any("1 questions pour 10" in e for e in ex.ecarts_questions(serie(), TITRE))


def test_trois_questions_de_revue_a_titre_une_ou_deux_au_yueke() -> None:
    assert any("questions de revue, attendu 3" in e for e in ex.ecarts_questions(serie(), TITRE))
    assert any("questions de revue, attendu 1 à 2" in e for e in ex.ecarts_questions(serie(), YUEKE))


def test_au_moins_trois_types_de_mise_en_situation() -> None:
    assert any("types de mise en situation" in e for e in ex.ecarts_questions(serie(), TITRE))


def test_quatre_choix_et_la_reponse_parmi_eux() -> None:
    q = dataclasses.replace(comprendre(), choix=comprendre().choix[:3])
    assert any("3 choix pour 4" in e for e in ex.ecarts_questions(serie((q,)), TITRE))
    q = dataclasses.replace(comprendre(), reponse=7)
    assert any("n'est pas un des choix" in e for e in ex.ecarts_questions(serie((q,)), TITRE))


def test_la_bonne_reponse_n_est_pas_toujours_a_la_meme_place() -> None:
    assert any("toujours à la même place" in e for e in ex.ecarts_questions(serie((comprendre(),) * 4), TITRE))
    melangees = tuple(dataclasses.replace(comprendre(), reponse=i % 4) for i in range(4))
    assert not any("même place" in e for e in ex.ecarts_questions(serie(melangees), TITRE))


def test_reperer_propose_des_mots_du_support() -> None:
    q = ex.Question(1, "reperer", ("?", "?"), ("门口", "明天", "见", "人"), 0, ("门",), "s1")
    ecarts = ex.ecarts_questions(serie((q,)), TITRE, glossaire=GLOSSAIRE)
    assert any("pas des mots du support : 人" in e for e in ecarts)


def test_le_ton_ne_propose_aucune_autre_lecture_du_caractere() -> None:
    q = ex.Question(
        1, "ton", ("?", "?"), ("hāo", "háo", "hǎo", "hào"), 2, ("好",), objet=Phrase("好", "hǎo", "bien", "good")
    )
    ecarts = ex.ecarts_questions(serie((q,)), TITRE, lectures={"好": ("hǎo", "hào")})
    assert any("autre lecture de 好 : hào" in e for e in ecarts)


def test_le_trou_n_a_pas_de_leurre_qui_refait_le_mot() -> None:
    q = ex.Question(
        1, "trou", ("?", "?"), ("天", "天", "人", "口"), 0, ("天",), objet=Phrase("明天", "míng tiān", "demain", "tomorrow"), trou=1
    )
    assert any("choix en double" in e for e in ex.ecarts_questions(serie((q,)), TITRE))


def test_les_caracteres_portes_sont_dans_la_question() -> None:
    assert any("absents de la question : 人" in e for e in ex.ecarts_questions(serie((comprendre(porte=("人",)),)), TITRE))


def test_une_replique_repond_a_un_message() -> None:
    choix = tuple(Phrase(z, "x", "fr", "en") for z in ("好", "大", "人", "天"))
    q = ex.Question(1, "replique", ("?", "?"), choix, 0, ("见",), "s1")
    s = serie((q,))
    s = dataclasses.replace(s, supports=(dataclasses.replace(s.supports[0], genre="enseigne"),))
    assert any("une réplique répond" in e for e in ex.ecarts_questions(s, TITRE))


def test_les_series_a_et_b_n_ont_aucun_texte_commun() -> None:
    a, b = serie(), dataclasses.replace(serie(), serie="B")
    assert ex.ecarts_deux_series(a, b) == ["textes communs aux séries A et B : 明天，门口见！"]


# --------------------------------------------------------------------------- les sources


def test_les_series_versionnees_se_lisent_et_tiennent_leurs_regles() -> None:
    examens, _ = ex.charger_liste()
    lexique = ex.charger_glossaire()
    par_id = {e.id: e for e in examens}
    ecrits = ex.fichiers_ecrits()
    assert {(p.parent.name, p.stem) for p in ecrits} >= {
        ("lire", "xianshi"),
        ("lire", "yueke-75"),
        ("hsk", "xianshi"),
        ("hsk", "yueke-75"),
    }
    for chemin in ecrits:
        f = ex.charger_series(chemin.parent.name, chemin.stem)
        assert f is not None and [s.serie for s in f.series] == ["A", "B"]
        assert f.generation["modele"] == MODELE_MANUEL and f.generation["api"] == API_SESSION
        assert f.relecture.get("decision")
        for s in f.series:
            assert ex.ecarts_questions(s, par_id[f.examen], glossaire=lexique) == [], (chemin, s.serie)
            assert ex.ecarts_glose(s, lexique) == [], (chemin, s.serie)
            assert ex.ecarts_pinyin(s) == [], (chemin, s.serie)
        assert ex.ecarts_deux_series(*f.series) == []


def test_un_format_inconnu_est_refuse() -> None:
    with pytest.raises(ex.ExamensInvalides, match="clé inconnue"):
        ex.fichier_depuis_json({"examen": "xianshi", "parcours": "lire", "generation": {}, "relecture": {}, "series": [], "x": 1}, "lire", "xianshi")


def _dossier(tmp: Path, statut: str = "relu", generation: dict[str, str] | None = None) -> Path:
    d = tmp / "examens"
    (d / "lire").mkdir(parents=True)
    for nom in ("examens.tsv", "nominations.tsv", "textes.tsv", "glossaire.tsv"):
        (d / nom).write_text((ex.DOSSIER / nom).read_text(encoding="utf-8"), encoding="utf-8")
    source = json.loads((ex.DOSSIER / "lire" / "xianshi.json").read_text(encoding="utf-8"))
    if generation is not None:
        source["generation"] = generation
    source["series"][1]["statut"] = statut
    (d / "lire" / "xianshi.json").write_text(json.dumps(source, ensure_ascii=False), encoding="utf-8")
    return d


def test_seules_les_series_relues_s_exportent(tmp_path: Path) -> None:
    from wenlu_data.lettres import charger_parcours
    from wenlu_data.paths import BUILD

    if not (BUILD / "parcours-lire.json").exists():
        pytest.skip("parcours non construit : `wenlu build`")
    d = _dossier(tmp_path, statut="a_relire")
    doc = ex.document(en_tete={}, parcours={"lire": charger_parcours("lire")}, racines={}, dossier=d)
    ligne = next(x for x in doc["parcours"]["lire"] if x["examen"] == "xianshi")  # type: ignore[index]
    assert list(ligne["series"]) == ["A"] and ligne["jour"] == 25
    assert [e["reussite"] for e in doc["examens"][:2]] == [8, 4]  # type: ignore[index]


def test_la_redaction_est_tracable(tmp_path: Path) -> None:
    d = _dossier(tmp_path, generation={"modele": "claude", "api": "Messages API"})
    sources = next(c for c in ex.controles(dossier=d, build=tmp_path, destination=tmp_path / "vide") if c.nom == "examens : sources")
    assert not sources.ok and "generation" in sources.detail
