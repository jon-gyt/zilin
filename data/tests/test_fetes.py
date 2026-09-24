"""Les fêtes : calendrier luni-solaire, textes, export et contrôles. Aucun réseau.

Les dates de référence sont celles que le prototype et le calendrier officiel
donnent : 中秋 2026-09-25 et 2027-09-15, 春节 2026-02-17 et 2027-02-06, et celles
des jours fériés et des termes solaires publiés : 元宵 2026-03-03, 清明 2026-04-05
et 2028-04-04, 端午 2026-06-19 et 2028-05-28, 七夕 2026-08-19, 重阳 2026-10-18,
冬至 2026-12-22 et 2028-12-21.
"""
from __future__ import annotations

import json
import shutil
from datetime import timedelta
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import fetes as fetes_mod
from wenlu_data.fetes import (
    ANNEES,
    REGLES,
    calculer,
    charger_animaux,
    charger_calendrier,
    charger_textes,
    controles,
    date_de,
    fautes_calendrier,
    fautes_textes,
    rang_animal,
    tsv_calendrier,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée


# ---------------------------------------------------------------------------- dates


@pytest.mark.parametrize(
    ("fete", "annee", "attendue"),
    [
        ("zhongqiu", 2026, "2026-09-25"),
        ("chunjie", 2027, "2027-02-06"),
        ("chunjie", 2026, "2026-02-17"),
        ("zhongqiu", 2027, "2027-09-15"),
        ("yuanxiao", 2026, "2026-03-03"),
        ("yuanxiao", 2027, "2027-02-20"),
        ("qingming", 2026, "2026-04-05"),
        ("qingming", 2028, "2028-04-04"),
        ("duanwu", 2026, "2026-06-19"),
        ("duanwu", 2027, "2027-06-09"),
        ("duanwu", 2028, "2028-05-28"),
        ("qixi", 2026, "2026-08-19"),
        ("qixi", 2027, "2027-08-08"),
        ("chongyang", 2026, "2026-10-18"),
        ("chongyang", 2027, "2027-10-08"),
        ("dongzhi", 2026, "2026-12-22"),
        ("dongzhi", 2027, "2027-12-22"),
        ("dongzhi", 2028, "2028-12-21"),
    ],
)
def test_les_dates_connues_sortent_du_calendrier_lunaire(fete: str, annee: int, attendue: str) -> None:
    assert date_de(REGLES[fete], annee).isoformat() == attendue


#: Le nom que `lunar_python` donne à chaque fête dans sa propre table des fêtes
#: (`Lunar.getFestivals`) ou des termes solaires (`Lunar.getJieQi`).
NOMS_LUNAR = {
    "chunjie": "春节",
    "yuanxiao": "元宵节",
    "qingming": "清明",
    "duanwu": "端午节",
    "qixi": "七夕节",
    "zhongqiu": "中秋节",
    "chongyang": "重阳节",
    "dongzhi": "冬至",
}


def test_chaque_date_du_calendrier_est_la_fete_pour_la_table_de_la_bibliotheque() -> None:
    """Contre-vérification : relu dans l'autre sens, chaque jour du calendrier porte la fête.

    `date_de` calcule la date depuis le jour lunaire ou le terme ; ici, on part de la
    date grégorienne et on demande à la bibliothèque quelle fête ou quel terme tombe
    ce jour-là.
    """
    from lunar_python import Solar

    assert set(NOMS_LUNAR) == set(REGLES)
    for e in charger_calendrier():
        a, m, j = map(int, e.date.split("-"))
        lunaire = Solar.fromYmd(a, m, j).getLunar()
        noms = [*lunaire.getFestivals(), lunaire.getJieQi()]
        assert NOMS_LUNAR[e.fete] in noms, f"{e.fete} {e.date} : {noms}"


def test_les_fenetres_de_chaque_fete() -> None:
    """春节 va du réveillon au 14e jour, et 元宵 prend le 15e, son jour seul."""
    fenetres = {id: (r.avant, r.apres) for id, r in REGLES.items()}
    assert fenetres == {
        "chunjie": (1, 13),
        "yuanxiao": (0, 0),
        "qingming": (1, 1),
        "duanwu": (2, 1),
        "qixi": (2, 0),
        "zhongqiu": (3, 1),
        "chongyang": (1, 1),
        "dongzhi": (1, 1),
    }
    for annee in range(ANNEES[0], ANNEES[1] + 1):
        fin_chunjie = date_de(REGLES["chunjie"], annee) + timedelta(days=REGLES["chunjie"].apres)
        assert (date_de(REGLES["yuanxiao"], annee) - fin_chunjie).days == 1


def test_les_termes_solaires_sont_dans_leur_annee() -> None:
    """清明 et 冬至 tombent dans l'année grégorienne de même numéro, et l'animal suit."""
    for e in calculer(*ANNEES):
        if REGLES[e.fete].terme:
            assert e.date.startswith(str(e.annee))
    dongzhi_2026 = next(e for e in calculer(2026, 2026) if e.fete == "dongzhi")
    assert (dongzhi_2026.date, dongzhi_2026.animal) == ("2026-12-22", "马")
    assert "getNextJieQi() → 冬至" in dongzhi_2026.source


def test_le_calendrier_s_arrete_en_2035_avant_le_dragon() -> None:
    """2036 est une année du Dragon : le calendrier s'arrête avant, rien ne le dessine."""
    entrees = charger_calendrier()
    assert max(e.annee for e in entrees) == 2035
    assert "龙" not in {e.animal for e in entrees}
    assert charger_animaux()[rang_animal(2036)].hanzi == "龙"


def test_l_animal_depend_de_l_annee_lunaire() -> None:
    animaux = charger_animaux()
    assert animaux[rang_animal(2027)].hanzi == "羊"
    assert animaux[rang_animal(2027)].fr == "de la Chèvre"
    assert animaux[rang_animal(2026)].hanzi == "马"
    assert [e.animal for e in calculer(2026, 2027) if e.fete == "chunjie"] == ["马", "羊"]


def test_le_calendrier_versionne_est_celui_que_la_commande_ecrit() -> None:
    """`calendrier.tsv` n'est jamais édité à la main : le recalcul redonne les mêmes octets."""
    texte = tsv_calendrier(calculer(*ANNEES))
    assert fetes_mod.CALENDRIER.read_text(encoding="utf-8") == texte


def test_le_calendrier_couvre_2026_a_2035_sans_faute() -> None:
    entrees = charger_calendrier()
    assert {e.annee for e in entrees} >= set(range(2026, 2036))
    assert fautes_calendrier(entrees, charger_animaux()) == []


def test_une_date_retouchee_a_la_main_est_une_faute() -> None:
    entrees = charger_calendrier()
    fausse = [
        fetes_mod.Entree(**{**e.__dict__, "date": "2026-09-26"}) if e.date == "2026-09-25" else e
        for e in entrees
    ]
    fautes = fautes_calendrier(fausse, charger_animaux())
    assert any("2026-09-26" in f and "2026-09-25" in f for f in fautes)


def test_une_date_illisible_une_annee_absente_un_mauvais_animal_sont_des_fautes() -> None:
    entrees = [e for e in charger_calendrier() if e.annee != 2030]
    entrees[0] = fetes_mod.Entree(**{**entrees[0].__dict__, "date": "2026-02-30"})
    entrees[1] = fetes_mod.Entree(**{**entrees[1].__dict__, "animal": "龙"})
    fautes = " | ".join(fautes_calendrier(entrees, charger_animaux(), recalculer=False))
    assert "date illisible" in fautes
    assert "années absentes 2030" in fautes
    assert "animal 龙" in fautes


# ---------------------------------------------------------------------------- textes


def test_les_textes_versionnes_sont_complets_et_sources() -> None:
    textes = charger_textes()
    assert fautes_textes(textes, REGLES) == []
    assert all(t.source == "rédigé pour l'app" for t in textes)
    assert fetes_mod.caracteres_dessines(textes) == ["冬", "年", "月", "桥", "灯", "福", "粽", "菊", "雨"]


def test_chaque_fete_fait_decouvrir_un_caractere_bonus() -> None:
    """Un caractère par fête, dessiné dans l'anecdote, avec son sens en français."""
    par_fete = fetes_mod.textes_par_fete(charger_textes())
    bonus = {fete: (cles["anecdote_c"][0], cles["anecdote_sens"][0]) for fete, cles in par_fete.items()}
    assert {fete: c for fete, (c, _) in bonus.items()} == {
        "chunjie": "年",
        "yuanxiao": "灯",
        "qingming": "雨",
        "duanwu": "粽",
        "qixi": "桥",
        "zhongqiu": "月",
        "chongyang": "菊",
        "dongzhi": "冬",
    }
    assert all(sens for _, sens in bonus.values())
    # l'anecdote nomme son caractère : on le découvre en la lisant
    for fete, cles in par_fete.items():
        assert cles["anecdote_c"][0] in cles["anecdote_texte"][0], fete


def test_les_textes_de_fete_ne_parlent_pas_de_dragon() -> None:
    """La charte exclut le dragon : ni le mot, ni le caractère, même à 端午."""
    for t in charger_textes():
        assert "dragon" not in t.valeur.lower() and "龙" not in t.valeur, f"textes.tsv:{t.numero}"


def test_le_jeton_quand_ne_sert_qu_aux_fetes_du_soir() -> None:
    """« Ce soir » n'a de sens que pour une fête du soir : 清明, 端午, 重阳 s'en passent."""
    for t in charger_textes():
        if "{quand}" in t.valeur:
            assert t.fete in {"yuanxiao", "qixi", "zhongqiu", "dongzhi"}, f"textes.tsv:{t.numero}"


def test_un_texte_vide_ou_un_jeton_inconnu_est_une_faute() -> None:
    textes = [t for t in charger_textes() if not (t.fete == "zhongqiu" and t.cle == "anecdote_titre")]
    textes.append(fetes_mod.Texte("chunjie", "tao", "", "rédigé pour l'app", 99))
    textes.append(fetes_mod.Texte("chunjie", "tao", "Le {lapin} saute.", "rédigé pour l'app", 100))
    fautes = " | ".join(fautes_textes(textes, REGLES))
    assert "zhongqiu : sans anecdote_titre" in fautes
    assert "chunjie tao vide" in fautes
    assert "jeton inconnu {lapin}" in fautes


# ---------------------------------------------------------------------------- export


def test_l_export_ecrit_fetes_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.1.0")
    document = lire(rapport.dossier, "fetes.json")
    assert export_mod.fautes_de_licence("fetes.json", document) == []
    assert "rédigés pour l'app" in str(document["source"])
    assert lire(rapport.dossier, "index.json")["fetes"] == "fetes.json"
    chunjie = document["fetes"]["chunjie"]  # type: ignore[index]
    assert chunjie["voeu"] == {"zh": "新年快乐", "pinyin": "xīnnián kuàilè", "fr": "Bonne année {animal}"}
    assert chunjie["caractere_voeu"] == "福"
    assert chunjie["anecdote"]["c"] == "年"
    assert chunjie["anecdote"]["sens"] == "l'année"
    # le pinyin du caractère bonus vient d'Unihan ; 年 n'est pas dans le build miniature
    assert chunjie["anecdote"]["pinyin"] == ""
    assert document["fetes"]["zhongqiu"]["anecdote"]["pinyin"] == "yuè"  # type: ignore[index]
    assert set(document["fetes"]) == set(REGLES)  # type: ignore[arg-type]
    assert document["fetes"]["zhongqiu"]["caractere_voeu"] is None  # type: ignore[index]
    annee_2027 = next(
        e for e in document["calendrier"] if e["fete"] == "chunjie" and e["annee"] == 2027  # type: ignore[union-attr]
    )
    assert annee_2027["date"] == "2027-02-06"
    assert annee_2027["animal"] == {"c": "羊", "pinyin": "yáng", "fr": "de la Chèvre"}


def test_un_caractere_dessine_entre_dans_le_perimetre_avec_ses_briques(atelier: Path) -> None:  # noqa: F811
    """月 est dans le build miniature : il est exporté, et `racines` dit où lire ses traits."""
    rapport = export_mod.export("0.1.0")
    assert lire(rapport.dossier, "fetes.json")["racines"] == {"月": "月"}
    assert "月" in lire(rapport.dossier, "traits/月.json")["traits"]  # type: ignore[operator]


def test_changer_un_texte_de_fete_rend_l_export_perime(atelier: Path, tmp_path: Path, monkeypatch) -> None:  # noqa: F811
    copie = tmp_path / "textes.tsv"
    shutil.copy(fetes_mod.TEXTES, copie)
    monkeypatch.setattr(fetes_mod, "TEXTES", copie)
    export_mod.export("0.1.0")
    a_jour = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert a_jour["export : à jour"].ok
    copie.write_text(copie.read_text(encoding="utf-8").replace("Miam.", "Miam !"), encoding="utf-8")
    perime = {c.nom: c for c in export_mod.controles(export_mod.EXPORT, build=export_mod.BUILD, ingest=export_mod.INGEST)}
    assert not perime["export : à jour"].ok


# ---------------------------------------------------------------------------- check


def test_le_controle_voit_un_caractere_dessine_sans_traits(atelier: Path) -> None:  # noqa: F811
    """Le build miniature n'a ni 年 ni 福 (ni 灯, 雨…) : l'export ne peut pas les dessiner, c'est bloquant."""
    export_mod.export("0.1.0")
    resultats = {c.nom: c for c in controles(export_mod.EXPORT)}
    assert resultats["fêtes : calendrier"].ok
    assert resultats["fêtes : textes"].ok
    dessines = resultats["fêtes : caractères dessinés"]
    assert not dessines.ok and dessines.bloquant
    assert "0.1.0:年" in dessines.detail and "0.1.0:福" in dessines.detail and "0.1.0:灯" in dessines.detail
    assert "月" not in dessines.detail


def test_sans_export_le_controle_des_caracteres_ne_bloque_pas(tmp_path: Path) -> None:
    resultats = {c.nom: c for c in controles(tmp_path / "vide")}
    assert resultats["fêtes : caractères dessinés"].ok


VERSIONNE = export_mod.EXPORT / export_mod.VERSION


@pytest.mark.skipif(not (VERSIONNE / "fetes.json").exists(), reason="export versionné absent")
def test_l_export_versionne_dessine_les_caracteres_des_fetes() -> None:
    document = json.loads((VERSIONNE / "fetes.json").read_text(encoding="utf-8"))
    assert document["racines"] == {
        "冬": "夂",
        "年": "年",
        "月": "月",
        "桥": "木",
        "灯": "火",
        "福": "礻",
        "粽": "米",
        "菊": "艹",
        "雨": "雨",
    }
    bonus = {f: (t["anecdote"]["c"], t["anecdote"]["pinyin"]) for f, t in document["fetes"].items()}
    assert bonus["yuanxiao"] == ("灯", "dēng") and bonus["dongzhi"] == ("冬", "dōng")
    assert all(p for _, p in bonus.values())
    assert all(c.ok for c in controles())
