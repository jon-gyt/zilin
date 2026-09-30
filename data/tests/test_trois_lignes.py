"""Les trois lignes du pas Utiliser : lecture, périmètre, pinyin, glose, forme, couverture, export.

Un test par règle. Aucun réseau. Les règles : trois lignes par jour du chemin, écrites avec
les seuls caractères que le parcours a posés ce jour-là, dont au moins un caractère
nouveau du jour (le cinabre de l'app) ; pinyin aux tons du dictionnaire, une syllabe par
sinogramme ; chaque sinogramme glosé tel que le lecteur découpe ; chaque jour de 4 à 120
écrit sur les deux parcours ; seuls les textes relus s'exportent ; la rédaction est
traçable (« session Claude Code (sans API) ») et la relecture cite sa décision.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data import trois_lignes as tl
from wenlu_data.contes import A_RELIRE, API_SESSION, MODELE_MANUEL, RELU, Glose, Phrase
from wenlu_data.paths import BUILD

#: Un parcours miniature : les jours 4 et 5 posent leurs caractères.
PARCOURS = {
    "jours": [
        {"jour": 1, "brique": "人", "composes": []},
        {"jour": 2, "brique": "大", "composes": []},
        {"jour": 3, "brique": "天", "composes": []},
        {"jour": 4, "brique": "月", "composes": ["从"]},
        {"jour": 5, "brique": "日", "composes": ["明"]},
    ]
}

GLOSSAIRE = {
    "人": Glose("personne", "rén", "person"),
    "大": Glose("grand", "dà", "big"),
    "天": Glose("ciel", "tiān", "sky"),
    "月": Glose("lune", "yuè", "moon"),
    "从": Glose("suivre", "cóng", "to follow"),
    "日": Glose("soleil", "rì", "sun"),
    "明": Glose("clair", "míng", "bright"),
    "天天": Glose("chaque jour", "tiān tiān", "every day"),
}


def texte(jour: int = 4, *zh_py: tuple[str, str], glose: dict[str, Glose] | None = None) -> tl.Texte:
    lignes = zh_py or (("天大，月大。", "tiān dà yuè dà"), ("人从人。", "rén cóng rén"), ("天天。", "tiān tiān"))
    return tl.Texte(
        parcours="lire",
        jour=jour,
        lignes=tuple(Phrase(zh, py, "fr", "en") for zh, py in lignes),
        glose=glose or {},
    )


def test_un_texte_juste_na_aucun_ecart() -> None:
    assert tl.ecarts(texte(), PARCOURS, GLOSSAIRE) == []


def test_un_caractere_hors_de_lacquis_du_jour_est_un_ecart() -> None:
    t = texte(4, ("日大。", "rì dà"), ("人从人。", "rén cóng rén"), ("月大。", "yuè dà"))
    assert any("hors de l'acquis du jour 4 : 日" in e for e in tl.ecarts_perimetre(t, PARCOURS))


def test_le_texte_emploie_un_caractere_nouveau_du_jour() -> None:
    t = texte(5, ("天大。", "tiān dà"), ("人从人。", "rén cóng rén"), ("月大。", "yuè dà"))
    assert tl.ecarts_perimetre(t, PARCOURS) == ["aucun caractère nouveau du jour (日明)"]


def test_les_nouveaux_du_jour_sont_la_brique_puis_les_composes() -> None:
    assert tl.nouveaux_du_jour(4, PARCOURS) == ["月", "从"]
    assert tl.nouveaux_du_jour(3, PARCOURS) == ["天"]


def test_le_pinyin_a_une_syllabe_par_sinogramme() -> None:
    t = texte(4, ("天大，月大。", "tiān dà yuè"), ("人从人。", "rén cóng rén"), ("天天。", "tiān tiān"))
    assert any("3 syllabes pour 4 caractères" in e for e in tl.ecarts_pinyin(t))


def test_le_pinyin_suit_les_lectures_du_caractere() -> None:
    t = texte(4, ("天大，月大。", "tiān dà yuè dǎ"), ("人从人。", "rén cóng rén"), ("天天。", "tiān tiān"))
    lectures = {"天": ("tiān",), "大": ("dà",), "月": ("yuè",), "人": ("rén",), "从": ("cóng",)}
    assert tl.ecarts_pinyin(t, lectures) == ["ligne 1 : « 天大，月大。 » ne se lit pas « tiān dà yuè dǎ »"]


def test_chaque_sinogramme_est_glose() -> None:
    glossaire = {k: v for k, v in GLOSSAIRE.items() if k != "从"}
    assert "ligne 2 : glose absente pour 从" in tl.ecarts_glose(texte(), glossaire)


def test_la_glose_suit_le_pinyin_de_la_ligne() -> None:
    glossaire = {**GLOSSAIRE, "天天": Glose("chaque jour", "tiān tián", "every day")}
    assert "ligne 3 : 天天 glosé « tiān tián », lu « tiān tiān »" in tl.ecarts_glose(texte(), glossaire)


def test_la_glose_propre_au_texte_passe_devant_le_glossaire() -> None:
    propre = {"大": Glose("grande", "dà", "large")}
    t = texte(glose=propre)
    assert tl.glose_du_texte(t, GLOSSAIRE)["大"] == propre["大"]
    assert tl.ecarts_glose(t, GLOSSAIRE) == []


def test_une_glose_propre_jamais_touchee_est_un_ecart() -> None:
    t = texte(glose={"日": Glose("soleil", "rì", "sun")})
    assert "glose propre au texte jamais touchée : 日" in tl.ecarts_glose(t, GLOSSAIRE)


def test_le_lecteur_decoupe_par_le_mot_le_plus_long() -> None:
    assert list(tl.glose_du_texte(texte(), GLOSSAIRE)) == ["人", "从", "大", "天", "天天", "月"]


def test_un_texte_a_trois_lignes() -> None:
    t = texte(4, ("天大，月大。", "tiān dà yuè dà"), ("人从人。", "rén cóng rén"))
    assert "2 lignes pour 3" in tl.ecarts_forme(t)


def test_la_couverture_nomme_les_jours_sans_texte() -> None:
    ecrits = [texte(j) for j in range(tl.PREMIER_JOUR, 10) if j != 7]
    assert tl.couverture(ecrits, 10) == [7, 10]


def test_les_jours_de_la_premiere_session_nont_pas_de_texte() -> None:
    """Les jours 1 à 3 sont la première session, qui lit 天天 : la couverture part du jour 4."""
    assert tl.PREMIER_JOUR == 4
    assert tl.couverture([texte(j) for j in range(4, 61)], 60) == []


def _fichier(tmp_path: Path, textes: list[dict[str, object]], parcours: str = "lire") -> Path:
    document = {
        "parcours": parcours,
        "generation": {"modele": MODELE_MANUEL, "api": API_SESSION, "date": "2026-09-28"},
        "relecture": {"statut": RELU, "decision": "« Considère que les relectures c'est bon »"},
        "textes": textes,
    }
    chemin = tmp_path / f"{parcours}.json"
    chemin.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return chemin


def _brut(jour: int, statut: str = RELU) -> dict[str, object]:
    return {
        "jour": jour,
        "statut": statut,
        "lignes": [
            {"zh": "天大，月大。", "pinyin": "tiān dà yuè dà", "fr": "f", "en": "e"},
            {"zh": "人从人。", "pinyin": "rén cóng rén", "fr": "f", "en": "e"},
            {"zh": "天天。", "pinyin": "tiān tiān", "fr": "f", "en": "e"},
        ],
    }


def test_un_jour_en_double_est_refuse(tmp_path: Path) -> None:
    _fichier(tmp_path, [_brut(4), _brut(4)])
    with pytest.raises(tl.TextesInvalides, match="jours en double"):
        tl.charger_textes("lire", tmp_path)


def test_une_ligne_sans_traduction_est_refusee(tmp_path: Path) -> None:
    brut = _brut(4)
    brut["lignes"][0]["fr"] = ""  # type: ignore[index]
    _fichier(tmp_path, [brut])
    with pytest.raises(tl.TextesInvalides, match="fr manquant ou vide"):
        tl.charger_textes("lire", tmp_path)


def test_le_glossaire_refuse_un_doublon(tmp_path: Path) -> None:
    chemin = tmp_path / "glossaire.tsv"
    chemin.write_text("zh\tpinyin\tfr\ten\n人\trén\tp\tp\n人\trén\tp\tp\n", encoding="utf-8")
    with pytest.raises(tl.TextesInvalides, match="déjà glosé"):
        tl.charger_glossaire(chemin)


def test_seuls_les_textes_relus_sexportent(tmp_path: Path) -> None:
    _fichier(tmp_path, [_brut(4), _brut(5, A_RELIRE)])
    glossaire = tmp_path / "glossaire.tsv"
    glossaire.write_text(
        "zh\tpinyin\tfr\ten\n" + "".join(f"{zh}\t{g.pinyin}\t{g.fr}\t{g.en}\n" for zh, g in GLOSSAIRE.items()),
        encoding="utf-8",
    )
    doc = tl.document(en_tete={"version": "t"}, parcours={"lire": PARCOURS}, dossier=tmp_path, glossaire=glossaire)
    assert doc["premier_jour"] == 4
    assert [t["jour"] for t in doc["parcours"]["lire"]] == [4]  # type: ignore[index]
    assert doc["parcours"]["hsk"] == []  # type: ignore[index]
    exporte = doc["parcours"]["lire"][0]  # type: ignore[index]
    # Le cinabre de l'app : les caractères nouveaux du jour que le texte emploie.
    assert exporte["nouveaux"] == ["月", "从"]
    # La glose ne porte que ce que le lecteur touchera.
    assert sorted(exporte["glose"]) == ["人", "从", "大", "天", "天天", "月"]


# ------------------------------------------------------------------ les brouillons


def _atelier(tmp_path: Path) -> dict[str, Path]:
    """Un parcours construit, un fichier de textes, un glossaire et un dossier de brouillons."""
    build = tmp_path / "build"
    build.mkdir()
    (build / "parcours-lire.json").write_text(json.dumps(PARCOURS, ensure_ascii=False), encoding="utf-8")
    textes = tmp_path / "textes"
    textes.mkdir()
    _fichier(textes, [_brut(4)])
    glossaire = tmp_path / "glossaire.tsv"
    sans_ri = {zh: g for zh, g in GLOSSAIRE.items() if zh not in ("日", "明")}
    glossaire.write_text(
        "# glose\nzh\tpinyin\tfr\ten\n" + "".join(f"{zh}\t{g.pinyin}\t{g.fr}\t{g.en}\n" for zh, g in sans_ri.items()),
        encoding="utf-8",
    )
    return {"build": build, "dossier": textes, "glossaire": glossaire, "brouillons": tmp_path / "brouillons"}


def _brouillon(a: dict[str, Path], jour: int, lignes: list[tuple[str, str]], **plus: object) -> Path:
    chemin = tl.chemin_brouillon("lire", jour, a["brouillons"])
    chemin.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "parcours": "lire",
        "jour": jour,
        "lignes": [{"zh": zh, "pinyin": py, "fr": "f", "en": "e"} for zh, py in lignes],
        **plus,
    }
    chemin.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return chemin


JOUR_5 = [("日明。", "rì míng"), ("天明。", "tiān míng"), ("月明。", "yuè míng")]
GLOSSAIRE_5 = [
    {"zh": "日", "pinyin": "rì", "fr": "soleil", "en": "sun"},
    {"zh": "明", "pinyin": "míng", "fr": "clair", "en": "bright"},
]


def _importer(a: dict[str, Path]) -> tl.Import:
    return tl.importer("lire", dossier=a["dossier"], brouillons=a["brouillons"], glossaire=a["glossaire"], build=a["build"])


def test_un_brouillon_juste_se_verse_a_relire_avec_son_glossaire(tmp_path: Path) -> None:
    """Un fichier par jour : plusieurs rédacteurs en parallèle ; l'import les verse, à relire."""
    a = _atelier(tmp_path)
    _brouillon(a, 5, JOUR_5, glossaire=GLOSSAIRE_5)
    r = _importer(a)
    assert r.importes == [5] and r.refuses == {} and r.glossaire == ["日", "明"]
    textes = {t.jour: t for t in tl.charger_textes("lire", a["dossier"]).textes}
    assert textes[4].statut == RELU and textes[5].statut == A_RELIRE
    assert "日" in tl.charger_glossaire(a["glossaire"])


def test_un_brouillon_hors_de_l_acquis_est_refuse_et_rien_n_est_verse(tmp_path: Path) -> None:
    a = _atelier(tmp_path)
    森 = {"zh": "森", "pinyin": "sēn", "fr": "forêt", "en": "forest"}
    _brouillon(a, 5, [("日明。", "rì míng"), ("森明。", "sēn míng"), ("月明。", "yuè míng")], glossaire=[*GLOSSAIRE_5, 森])
    r = _importer(a)
    assert r.importes == [] and any("hors de l'acquis du jour 5 : 森" in e for e in r.refuses[5])
    assert "日" not in tl.charger_glossaire(a["glossaire"])
    assert [t.jour for t in tl.charger_textes("lire", a["dossier"]).textes] == [4]


def test_un_texte_relu_ne_se_remplace_pas(tmp_path: Path) -> None:
    a = _atelier(tmp_path)
    _brouillon(a, 4, [("天大。", "tiān dà"), ("人从人。", "rén cóng rén"), ("月大。", "yuè dà")])
    r = _importer(a)
    assert r.importes == [] and "relu ne se remplace pas" in r.refuses[4][0]


def test_une_entree_du_glossaire_deja_glosee_autrement_est_un_conflit(tmp_path: Path) -> None:
    a = _atelier(tmp_path)
    autre = [{"zh": "天", "pinyin": "tiān", "fr": "jour", "en": "day"}, *GLOSSAIRE_5]
    _brouillon(a, 5, JOUR_5, glossaire=autre)
    r = _importer(a)
    assert r.importes == [] and "天 déjà glosé autrement" in r.refuses[5][0]


def test_les_lots_a_rediger_se_partagent_la_plage_sans_se_toucher(tmp_path: Path) -> None:
    a = _atelier(tmp_path)
    parcours = {"jours": [{"jour": j, "brique": f"b{j}", "composes": []} for j in range(1, 21)]}
    (a["build"] / "parcours-lire.json").write_text(json.dumps(parcours), encoding="utf-8")
    lots = [
        tl.a_rediger("lire", de=4, a=20, lot=k, sur=3, dossier=a["dossier"], brouillons=a["brouillons"], build=a["build"])
        for k in (1, 2, 3)
    ]
    tous = [j for lot in lots for j in lot]
    assert sorted(tous) == list(range(5, 21)) and len(set(tous)) == len(tous)
    assert 4 not in tous  # déjà écrit


def test_les_lectures_d_un_polyphone_viennent_aussi_des_dictionnaires() -> None:
    """便宜 pián yi, 音乐 yīn yuè : les lectures de kTGHZ2013 et kXHC1983 sont admises."""
    lectures = tl.lectures_admises()
    if lectures is None:
        pytest.skip("aucune ingestion : `wenlu ingest`")
    t = texte(4, ("便宜。", "pián yi"), ("音乐。", "yīn yuè"), ("天天。", "tiān tiān"))
    assert [e for e in tl.ecarts_pinyin(t, lectures) if "ne se lit pas" in e] == []


# ------------------------------------------------------------------ les textes versionnés


def test_les_textes_versionnes_sont_tracables_et_relus_par_decision() -> None:
    for nom in tl.PARCOURS:
        f = tl.charger_textes(nom)
        assert f.generation["api"] == API_SESSION
        assert f.generation["modele"] == MODELE_MANUEL
        assert "Considère que les relectures c'est bon" in str(f.relecture["decision"])
        # La couverture exigée est relue ; la suite du chemin arrive à relire, par les brouillons.
        assert all(t.statut == RELU for t in f.textes if t.jour <= tl.COUVERTURE)
        assert all(t.statut in (RELU, A_RELIRE) for t in f.textes)


def test_les_textes_versionnes_couvrent_les_soixante_premiers_jours() -> None:
    for nom in tl.PARCOURS:
        assert tl.couverture(tl.charger_textes(nom).textes) == []


def test_les_textes_versionnes_ont_leur_glose_et_leur_forme() -> None:
    glossaire = tl.charger_glossaire()
    for nom in tl.PARCOURS:
        for t in tl.charger_textes(nom).textes:
            assert tl.ecarts_forme(t) == [], (nom, t.jour)
            assert tl.ecarts_glose(t, glossaire) == [], (nom, t.jour)
            assert tl.ecarts_pinyin(t) == [], (nom, t.jour)


@pytest.mark.skipif(not (BUILD / "parcours-lire.json").exists(), reason="aucun parcours construit")
def test_les_textes_versionnes_ne_lisent_que_lacquis_du_jour() -> None:
    for nom in tl.PARCOURS:
        parcours = tl.charger_parcours(nom)
        for t in tl.charger_textes(nom).textes:
            assert tl.ecarts_perimetre(t, parcours) == [], (nom, t.jour)
