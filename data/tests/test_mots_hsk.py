"""Liste des mots du HSK 3.0 (story D.1) : un test par règle."""
from __future__ import annotations

from pathlib import Path

import pytest

from wenlu_data import mots_hsk
from wenlu_data.mots_hsk import (
    COLONNES_LUES,
    Forme,
    Mot,
    construire,
    controles,
    deplier,
    ecarts_de_comptes,
    ecarts_de_concordance,
    lire_elkmovie,
    lire_ivankra,
    numeroter,
    parse,
)

ENTETE = "ID,Simplified,Traditional,Pinyin,POS,Level,WebNo,WebPinyin,OCR,Variants,CEDICT"

LECTURES = {
    "爱": ["ài"],
    "好": ["hǎo", "hào"],
    "知": ["zhī"],
    "道": ["dào"],
    "后": ["hòu"],
    "面": ["miàn"],
    "这": ["zhè"],
    "里": ["lǐ"],
    "第": ["dì"],
    "二": ["èr"],
    "有": ["yǒu"],
    "一": ["yī"],
    "些": ["xiē"],
    "爸": ["bà"],
    "零": ["líng"],
    "谁": ["shéi", "shuí"],
    "女": ["nǚ"],
    "闺": ["guī"],
    "点": ["diǎn"],
    "儿": ["ér"],
}


def _csv(*lignes: str) -> str:
    return "\n".join([ENTETE, *lignes]) + "\n"


def _mot(ligne: str) -> Mot:
    mots, _ = construire(lire_ivankra(_csv(ligne)), LECTURES)
    return mots[0]


def test_la_colonne_cedict_n_est_jamais_lue() -> None:
    """Ni `CEDICT` ni `Variants` (qui la recopie) ne passent le lecteur."""
    texte = _csv('L1-0002,爱好,愛好,àihào,V/N,1,21,àihào,爱好,"[{""CEDICT"": ""SENTINELLE""}]",SENTINELLE[ai4]')
    lignes = lire_ivankra(texte)
    assert set(lignes[0]) == set(COLONNES_LUES)
    assert "CEDICT" not in COLONNES_LUES and "Variants" not in COLONNES_LUES
    mots, _ = construire(lignes, LECTURES)
    assert "SENTINELLE" not in mots_hsk.ligne_tsv(mots[0])


def test_niveau_categorie_et_syllabes_numerotees() -> None:
    m = _mot("L1-0002,爱好,愛好,àihào,V/N,1,21,àihào,爱好,,x")
    assert (m.niveau, m.categorie) == ("1", ("V", "N"))
    assert m.forme.syllabes == ("ai4", "hao4")


def test_le_point_median_passe_au_ton_neutre_et_garde_la_lecture_pleine() -> None:
    """知道 zhī·dào : la syllabe pointée s'écrit au ton neutre, sa lecture pleine reste."""
    m = _mot("L1-0400,知道,知道,zhīdào,V,1,1,zhī·dào,知道,,x")
    assert m.forme.pinyin == "zhīdao"
    assert m.forme.syllabes == ("zhi1", "dao5")
    assert m.forme.pleines == ("zhi1", "dao4")


def test_les_mots_de_position_suivent_la_decision_du_26_septembre() -> None:
    """后面 : la liste dit hòumiàn, le dépôt hòumian ; 这里 zhè·lǐ → zhèli."""
    m = _mot("L1-0130,后面,後面,hòumiàn,N,1,1,hòumiàn,后面,,x")
    assert m.forme.pinyin == "hòumian"
    assert m.forme.pleines == ("hou4", "mian4")
    m = _mot("L1-0460,这里,這裡,zhèlǐ,Pron,1,1,zhè·lǐ,这里,,x")
    assert m.forme.pinyin == "zhèli"


def test_pas_de_sandhi() -> None:
    """一 yī et 不 bù partout : la colonne Pinyin, pas le pinyin du site (yíxià)."""
    m = _mot("L2-0686,有（一）点儿,有（一）點兒,yǒu(yī)diǎnr,,2,1,yǒu(yì)diǎnr,有（一）点儿,,x")
    assert m.variantes[0].pinyin == "yǒuyīdiǎnr"
    assert m.variantes[0].syllabes == ("you3", "yi1", "dian3", "r5")


def test_graphies_exemples_et_elements_facultatifs() -> None:
    assert deplier("爸爸|爸", "bàba|bà") == ([("爸爸", "bàba"), ("爸", "bà")], None)
    assert deplier("第（第二）", "dì (dì-èr)") == ([("第", "dì")], ("第二", "dì-èr"))
    assert deplier("有（一）些", "yǒu(yī)xiē") == ([("有些", "yǒuxiē"), ("有一些", "yǒuyīxiē")], None)
    assert deplier("…极了", "…jí le") == ([("极了", "jí le")], None)
    assert deplier("称1", "chēng") == ([("称", "chēng")], None)
    assert deplier("谁", "shéi/shuí") == ([("谁", "shéi"), ("谁", "shuí")], None)


def test_zero_et_ton_neutre_du_u_trema() -> None:
    m = _mot("L1-0216,零|〇,零|〇,líng|líng,Num,1,1,líng|líng,零｜〇,,x")
    assert m.variantes[0].syllabes == ("ling2",)
    assert _mot("L7-1502,闺女,閨女,guīnü,N,7-9,1,guīnü,闺女,,x").forme.syllabes == ("gui1", "nv5")
    assert numeroter("lǜ") == "lv4"


def test_la_liste_se_relit_a_l_identique(tmp_path: Path) -> None:
    mots, rapport = construire(
        lire_ivankra(
            _csv(
                "L1-0004,爸爸|爸,爸爸|爸,bàba|bà,N,1,83,bàba|bà,爸爸｜爸,,x",
                "L1-0075,第（第二）,第（第二）,dì (dì-èr),Prefix,1,1,dì (dì-èr),第（第二）,,x",
                "L1-0400,知道,知道,zhīdào,V,1,1,zhī·dào,知道,,x",
            )
        ),
        LECTURES,
    )
    chemin = mots_hsk.ecrire(mots, mots_hsk.en_tete(empreinte_ivankra="a", empreinte_elkmovie=None, releve="2026-09-29", rapport=rapport), tmp_path / "m.tsv")
    assert parse(chemin.read_text(encoding="utf-8")) == mots


def test_les_comptes_par_niveau() -> None:
    f = Forme("爱", "ài", ("ai4",))
    mots = [Mot(id=f"L1-{i}", forme=f, niveau="1", categorie=()) for i in range(500)]
    assert any("HSK 2" in e for e in ecarts_de_comptes(mots))
    assert not any("HSK 1 " in e for e in ecarts_de_comptes(mots))


def test_la_concordance_avec_l_ocr() -> None:
    ocr = lire_elkmovie("# HSK 3.0 word list\n\n一级词汇表\n1 爱\n2 爸爸｜爸\n")
    f = Forme("爱", "ài", ("ai4",))
    mots = [Mot("L1-0001", f, "1", (), officiel="爱"), Mot("L1-0002", f, "1", (), officiel="爸爸|爸")]
    assert ecarts_de_concordance(mots, ocr)[-1] == "HSK 1 n° 2 : 爸爸|爸 ≠ 爸爸｜爸"


def test_la_liste_versionnee_passe_ses_controles() -> None:
    """La vraie liste : comptes, sans CC-CEDICT, caractères dans les 3 000, pinyin tranché."""
    if not mots_hsk.LISTE.exists():
        pytest.skip("liste absente")
    resultats = {c.nom: c for c in controles()}
    for nom in ("mots HSK : comptes", "mots HSK : sans CC-CEDICT", "mots HSK : caractères", "mots HSK : pinyin"):
        assert resultats[nom].ok, resultats[nom].detail


def test_un_caractere_hors_des_3000_est_bloquant(tmp_path: Path) -> None:
    listes = tmp_path / "listes"
    listes.mkdir()
    (listes / "hsk-1.txt").write_text("爱\n", encoding="utf-8")
    mots = [Mot("L1-0001", Forme("爱好", "àihào", ("ai4", "hao4")), "1", ("V",), officiel="爱好")]
    chemin = mots_hsk.ecrire(mots, [], tmp_path / "m.tsv")
    resultats = {c.nom: c for c in controles(chemin, listes=listes, sources=tmp_path, ingest=tmp_path)}
    assert not resultats["mots HSK : caractères"].ok and resultats["mots HSK : caractères"].bloquant
    assert "好" in resultats["mots HSK : caractères"].detail
