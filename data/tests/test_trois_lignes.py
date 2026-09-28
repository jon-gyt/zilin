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


# ------------------------------------------------------------------ les textes versionnés


def test_les_textes_versionnes_sont_tracables_et_relus_par_decision() -> None:
    for nom in tl.PARCOURS:
        f = tl.charger_textes(nom)
        assert f.generation["api"] == API_SESSION
        assert f.generation["modele"] == MODELE_MANUEL
        assert "Considère que les relectures c'est bon" in str(f.relecture["decision"])
        assert all(t.statut == RELU for t in f.textes)


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
