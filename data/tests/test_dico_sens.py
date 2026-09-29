"""Les sens et les phrases du dictionnaire (stories 10.6 et 10.7) : une règle par test."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data import dico_sens as d
from wenlu_data import dictionnaire
from wenlu_data.dico_page import page
from wenlu_data.mots_hsk import Forme, Mot

CARACTERES_1 = "我你好知道爱不是他很天气今的字吗们"
CARACTERES_2 = "也"
LECTURES = {
    "我": ["wǒ"], "你": ["nǐ"], "好": ["hǎo", "hào"], "知": ["zhī"], "道": ["dào"], "爱": ["ài"],
    "不": ["bù"], "是": ["shì"], "他": ["tā"], "很": ["hěn"], "天": ["tiān"], "气": ["qì"],
    "今": ["jīn"], "的": ["de", "dí", "dì"], "字": ["zì"], "吗": ["ma"], "们": ["men"], "也": ["yě"],
}


def _mot(ident: str, hanzi: str, pinyin: str, syllabes: str, categorie: str = "", pleines: str = "", niveau: str = "1") -> Mot:
    return Mot(
        id=ident,
        forme=Forme(hanzi, pinyin, tuple(syllabes.split()), tuple(pleines.split())),
        niveau=niveau,
        categorie=tuple(x for x in categorie.split("/") if x),
        officiel=hanzi,
        pinyin_officiel=pinyin,
    )


@pytest.fixture
def ref() -> d.Referentiel:
    mots = [
        _mot("L1-0001", "爱", "ài", "ai4", "V"),
        _mot("L1-0002", "知道", "zhīdao", "zhi1 dao5", "V", "zhi1 dao4"),
        _mot("L1-0003", "好", "hǎo", "hao3", "Adj"),
        _mot("L1-0004", "今天", "jīntiān", "jin1 tian1", "N"),
        _mot("L1-0005", "天气", "tiānqì", "tian1 qi4", ""),
        _mot("L2-0001", "也", "yě", "ye3", "Adv", niveau="2"),
    ]
    caracteres = {c: "1" for c in CARACTERES_1} | {c: "2" for c in CARACTERES_2}
    return d.Referentiel(
        mots=mots,
        caracteres=caracteres,
        pinyin={c: v[0] for c, v in LECTURES.items()},
        lectures=LECTURES,
        fiches_caracteres={"爱": ("aimer, amour", "data/sources/fiches/爱.json")},
        fiches_mots={},
        lus=["hsk-mots.tsv", "unihan.json"],
    )


def _place(ref: d.Referentiel, ident: str) -> d.Place:
    return d.places_par_id(ref)[ident][2]


def _redaction(ident: str, glose: str = "savoir, connaître", acceptions=(("V", "savoir, être au courant"),), exemples=(("我知道。", "Wǒ zhīdao.", "Je suis au courant."),), reprise: bool = False) -> d.Redaction:
    return d.Redaction(
        ident,
        glose,
        [d.Acception(*a) for a in acceptions],
        [d.Exemple(*e) for e in exemples],
        reprise,
    )


# ------------------------------------------------------------------------ le plan


def test_un_mot_d_un_seul_caractere_se_range_sous_le_caractere(ref: d.Referentiel) -> None:
    ids = [p.id for p in d.plan("1", ref)]
    assert "L1-0001" not in ids and "L1-0003" not in ids
    assert _place(ref, "爱").simples == ("L1-0001",)
    assert _place(ref, "爱").exemples_min == 1
    # Un caractère qui n'est pas un mot à lui seul peut n'avoir aucune phrase.
    assert _place(ref, "知").exemples_min == 0


def test_le_plan_met_le_caractere_devant_son_premier_mot(ref: d.Referentiel) -> None:
    ids = [p.id for p in d.plan("1", ref)]
    assert ids.index("知") < ids.index("道") < ids.index("L1-0002")


# ------------------------------------------------------------------- les sens


def test_glose_sans_sinogramme(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", glose="savoir (知)"), _place(ref, "L1-0002"), ref)
    assert any("sinogramme dans la glose" in e for e in ecarts)


def test_glose_de_quarante_caracteres_au_plus(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", glose="savoir, connaître, être au courant de la chose"), _place(ref, "L1-0002"), ref)
    assert any("glose de" in e for e in ecarts)


def test_glose_sans_point_final(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", glose="savoir."), _place(ref, "L1-0002"), ref)
    assert any("point final" in e for e in ecarts)


def test_une_a_trois_acceptions(ref: d.Referentiel) -> None:
    place = _place(ref, "L1-0002")
    assert any("0 acceptions" in e for e in d.valider(_redaction("L1-0002", acceptions=()), place, ref))
    quatre = [("V", "a"), ("V", "b"), ("V", "c"), ("V", "d")]
    assert any("4 acceptions" in e for e in d.valider(_redaction("L1-0002", acceptions=quatre), place, ref))


def test_categorie_de_la_liste(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", acceptions=(("N", "savoir"),)), _place(ref, "L1-0002"), ref)
    assert any("catégorie 'N' hors de la liste" in e for e in ecarts)
    # Un mot que la liste ne classe pas prend n'importe quelle catégorie de la liste.
    tianqi = _redaction("L1-0005", glose="le temps qu'il fait", acceptions=(("N", "le temps, la météo"),), exemples=(("今天天气很好。", "Jīntiān tiānqì hěn hǎo.", "Il fait beau aujourd'hui."),))
    assert d.valider(tianqi, _place(ref, "L1-0005"), ref) == []


def test_lecture_d_une_acception_connue_du_caractere(ref: d.Referentiel) -> None:
    place = _place(ref, "好")
    bonne = _redaction("好", glose="bon, bien", acceptions=(("Adj", "bon, bien"), ("V", "aimer", "hào")), exemples=(("今天天气很好。", "Jīntiān tiānqì hěn hǎo.", "Il fait beau aujourd'hui."),))
    assert d.valider(bonne, place, ref) == []
    fausse = _redaction("好", glose="bon, bien", acceptions=(("V", "aimer", "hāo"),), exemples=bonne.exemples and [("今天天气很好。", "Jīntiān tiānqì hěn hǎo.", "Il fait beau aujourd'hui.")])
    assert any("inconnue" in e for e in d.valider(fausse, place, ref))


def test_reprise_d_une_glose_relue_sans_acception(ref: d.Referentiel) -> None:
    place = _place(ref, "爱")
    exemples = (("我爱你。", "Wǒ ài nǐ.", "Je t'aime."),)
    assert d.valider(_redaction("爱", glose="aimer, amour", acceptions=(), exemples=exemples, reprise=True), place, ref) == []
    autre = d.valider(_redaction("爱", glose="adorer", acceptions=(), exemples=exemples, reprise=True), place, ref)
    assert any("la glose relue est" in e for e in autre)
    # Rien à reprendre pour 知 : aucune fiche relue.
    assert any("aucune fiche relue" in e for e in d.valider(_redaction("知", reprise=True, acceptions=(), exemples=()), _place(ref, "知"), ref))


# ----------------------------------------------------------------- les phrases


def test_une_ou_deux_phrases_par_mot(ref: d.Referentiel) -> None:
    place = _place(ref, "L1-0002")
    assert any("0 phrases" in e for e in d.valider(_redaction("L1-0002", exemples=()), place, ref))
    trois = [("我知道。", "Wǒ zhīdao.", "Je suis au courant."), ("他知道。", "Tā zhīdao.", "Il est au courant."), ("你知道吗？", "Nǐ zhīdao ma?", "Tu es au courant ?")]
    assert any("3 phrases" in e for e in d.valider(_redaction("L1-0002", exemples=trois), place, ref))


def test_caracteres_du_hsk_seulement(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我知道他来。", "Wǒ zhīdao tā lái.", "Je sais qu'il vient."),)), _place(ref, "L1-0002"), ref)
    assert any("hors du HSK 来" in e for e in ecarts)


def test_la_phrase_contient_le_mot(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我爱你。", "Wǒ ài nǐ.", "Je t'aime."),)), _place(ref, "L1-0002"), ref)
    assert any("ne contient pas 知道" in e for e in ecarts)


def test_pinyin_lu_dans_les_lectures(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我知道。", "Wǒ zhīdao le.", "Je suis au courant."),)), _place(ref, "L1-0002"), ref)
    assert any("ne se lit pas" in e for e in ecarts)


def test_pinyin_du_mot_celui_de_la_liste_ton_neutre_compris(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我知道。", "Wǒ zhīdào.", "Je suis au courant."),)), _place(ref, "L1-0002"), ref)
    assert any("la liste dit « zhīdao »" in e for e in ecarts)


def test_pinyin_ecrit_par_mot(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我知道。", "Wǒ zhī dao.", "Je suis au courant."),)), _place(ref, "L1-0002"), ref)
    assert any("écrit « zhī dao »" in e for e in ecarts)


def test_pinyin_majuscule_et_ponctuation(ref: d.Referentiel) -> None:
    place = _place(ref, "L1-0002")
    assert any("majuscule" in e for e in d.valider(_redaction("L1-0002", exemples=(("我知道。", "wǒ zhīdao.", "Je suis au courant."),)), place, ref))
    assert any("ne finit pas comme" in e for e in d.valider(_redaction("L1-0002", exemples=(("你知道吗？", "Nǐ zhīdao ma.", "Tu es au courant ?"),)), place, ref))


def test_ponctuation_chinoise_seulement(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我知道!", "Wǒ zhīdao!", "Je suis au courant !"),)), _place(ref, "L1-0002"), ref)
    assert any("signes hors" in e for e in ecarts)


def test_phrase_courte(ref: d.Referentiel) -> None:
    longue = "我知道" + "很" * 20 + "好。"
    ecarts = d.valider(_redaction("L1-0002", exemples=((longue, "Wǒ zhīdao " + "hěn " * 20 + "hǎo.", "Je sais."),)), _place(ref, "L1-0002"), ref)
    assert any("sinogrammes (au plus" in e for e in ecarts)


def test_pas_de_fuite_la_traduction_ne_redit_pas_la_glose(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("我知道。", "Wǒ zhīdao.", "Savoir."),)), _place(ref, "L1-0002"), ref)
    assert any("redit la glose" in e for e in ecarts)


def test_pas_de_fuite_la_phrase_n_est_pas_le_mot_seul(ref: d.Referentiel) -> None:
    ecarts = d.valider(_redaction("L1-0002", exemples=(("知道。", "Zhīdao.", "Je suis au courant."),)), _place(ref, "L1-0002"), ref)
    assert any("n'est que le mot" in e for e in ecarts)


def test_autres_mots_signales_sans_bloquer(ref: d.Referentiel) -> None:
    ref.lectures = {**ref.lectures, "天": ["tiān", "tiǎn"]}
    e = d.Exemple("今天我知道。", "Jīntiǎn wǒ zhīdao.", "Aujourd'hui, je suis au courant.")
    assert d.ecarts_phrase(e, _place(ref, "L1-0002"), ref) == []
    assert any("今天 écrit « Jīntiǎn »" in x for x in d.ecarts_autres_mots(e, _place(ref, "L1-0002"), ref))


# ----------------------------------------------------- import, relecture, export


def _ecrire_brouillon(tmp_path: Path, ref: d.Referentiel, contenu: dict[str, object]) -> Path:
    places = d.lots("1", ref)["01"]
    entrees = {p.id: {"glose": "", "acceptions": [], "exemples": []} for p in places}
    base = {
        "我": {"glose": "je, moi", "acceptions": [["Pron", "je, moi"]], "exemples": []},
        "你": {"glose": "tu, toi", "acceptions": [["Pron", "tu, toi"]], "exemples": []},
        "好": {"glose": "bon, bien", "acceptions": [["Adj", "bon, bien"]], "exemples": [["今天天气很好。", "Jīntiān tiānqì hěn hǎo.", "Il fait beau aujourd'hui."]]},
        "知": {"glose": "savoir", "acceptions": [["V", "savoir, connaître"]], "exemples": []},
        "道": {"glose": "chemin, voie ; dire", "acceptions": [["N", "chemin, voie"], ["V", "dire"]], "exemples": []},
        "L1-0002": {"glose": "savoir, être au courant", "acceptions": [["V", "savoir, être au courant de"]], "exemples": [["我知道。", "Wǒ zhīdao.", "Je suis au courant."]]},
        "爱": {"reprise": True, "exemples": [["我爱你。", "Wǒ ài nǐ.", "Je t'aime."]]},
    }
    for k, v in base.items():
        if k in entrees:
            entrees[k] = v
    for p in places:
        if p.id not in base:
            if p.genre == "caractere":
                entrees[p.id] = {"glose": "sens du caractère", "acceptions": [["N", "sens du caractère"]], "exemples": []}
    entrees.update(contenu)
    chemin = d.chemin_brouillon("1", "01", tmp_path / "brouillons")
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps({"niveau": "1", "lot": "01", "entrees": entrees}, ensure_ascii=False), encoding="utf-8")
    return chemin


@pytest.fixture
def ref_petite(ref: d.Referentiel) -> d.Referentiel:
    """Le niveau 1 réduit à ce qui s'écrit vite : les mots 知道 et 今天, 天气 ôté."""
    ref.mots = [m for m in ref.mots if m.id != "L1-0005"]
    ref.__post_init__()
    return ref


def _importer(tmp_path: Path, ref: d.Referentiel, contenu: dict[str, object] | None = None) -> dict[str, object]:
    places = d.lots("1", ref)["01"]
    contenu = dict(contenu or {})
    if any(p.id == "L1-0004" for p in places) and "L1-0004" not in contenu:
        contenu["L1-0004"] = {"glose": "aujourd'hui", "acceptions": [["N", "aujourd'hui, ce jour"]], "exemples": [["今天很好。", "Jīntiān hěn hǎo.", "La journée est belle."]]}
    _ecrire_brouillon(tmp_path, ref, contenu)
    chemin, _ = d.importer("1", "01", ref, brouillons=tmp_path / "brouillons", dossier=tmp_path / "dico", horloge=lambda: "2026-09-29")
    return json.loads(chemin.read_text(encoding="utf-8"))


def test_import_trace_et_statut_a_relire(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    lot = _importer(tmp_path, ref_petite)
    gen = lot["generation"]
    assert gen["api"] == d.API_SESSION and gen["modele"] == d.MODELE_MANUEL and gen["empreinte_invite"].startswith("sha256:")
    entrees = {e["id"]: e for e in lot["entrees"]}
    assert entrees["L1-0002"]["sens"]["statut"] == d.A_RELIRE
    assert entrees["L1-0002"]["exemples"][0]["statut"] == d.A_RELIRE
    # La glose reprise d'une fiche relue garde son statut et dit d'où elle vient.
    assert entrees["爱"]["sens"] == {"glose": "aimer, amour", "acceptions": [], "statut": d.RELU, "provenance": {"reprise": "data/sources/fiches/爱.json", "champ": "sens_fr"}}


def test_import_refuse_tout_le_lot_s_il_y_a_une_faute(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    with pytest.raises(d.DicoSensInvalide):
        _importer(tmp_path, ref_petite, {"知": {"glose": "savoir 知", "acceptions": [["V", "savoir"]], "exemples": []}})
    assert not (tmp_path / "dico").exists()


def test_import_garde_le_relu_inchange_et_relance_le_modifie(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    _importer(tmp_path, ref_petite)
    relecture = {"format": d.FORMAT_RELECTURE, "decisions": {"L1-0002": {"decision": "bon"}, "知": {"decision": "bon"}}}
    d.appliquer_relecture(relecture, ref_petite, dossier=tmp_path / "dico", horloge=lambda: "2026-09-30")
    lot = _importer(tmp_path, ref_petite, {"知": {"glose": "savoir, connaître", "acceptions": [["V", "savoir, connaître"]], "exemples": []}})
    entrees = {e["id"]: e for e in lot["entrees"]}
    assert entrees["L1-0002"]["sens"]["statut"] == d.RELU
    assert entrees["知"]["sens"]["statut"] == d.A_RELIRE


def test_relecture_bon_corrige_a_refaire(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    _importer(tmp_path, ref_petite)
    decisions = {
        "L1-0002": {"decision": "corrige", "note": "plus juste", "sens": {"glose": "savoir", "acceptions": [{"categorie": "V", "fr": "savoir, être au courant"}]},
                    "exemples": [{"zh": "他知道。", "pinyin": "Tā zhīdao.", "fr": "Il est au courant."}]},
        "好": {"decision": "bon"},
        "知": {"decision": "a_refaire", "note": "trop vague"},
    }
    compte = d.appliquer_relecture({"format": d.FORMAT_RELECTURE, "decisions": decisions}, ref_petite, dossier=tmp_path / "dico", horloge=lambda: "2026-09-30")
    assert compte == {"bon": 1, "corrige": 1, "a_refaire": 1}
    entrees = {e["id"]: e for e in d.lire_lot(d.chemin_lot("1", "01", tmp_path / "dico"))["entrees"]}
    zhidao = entrees["L1-0002"]
    assert zhidao["sens"]["statut"] == d.RELU and zhidao["sens"]["relecture"]["avant"]["glose"] == "savoir, être au courant"
    assert zhidao["exemples"][0]["relecture"]["avant"]["zh"] == "我知道。"
    assert entrees["好"]["sens"]["statut"] == d.RELU and entrees["好"]["exemples"][0]["statut"] == d.RELU
    assert entrees["知"]["sens"]["statut"] == d.REJETE and entrees["知"]["sens"]["relecture"]["note"] == "trop vague"
    # Réimporter le même brouillon ne défait pas la correction.
    lot = _importer(tmp_path, ref_petite)
    assert {e["id"]: e for e in lot["entrees"]}["L1-0002"]["sens"]["glose"] == "savoir"


def test_relecture_invalide_ne_change_rien(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    _importer(tmp_path, ref_petite)
    avant = d.chemin_lot("1", "01", tmp_path / "dico").read_text(encoding="utf-8")
    decisions = {"好": {"decision": "bon"}, "L1-0002": {"decision": "corrige", "sens": {"glose": "savoir (知)", "acceptions": [{"categorie": "V", "fr": "savoir"}]}}}
    with pytest.raises(d.DicoSensInvalide):
        d.appliquer_relecture({"format": d.FORMAT_RELECTURE, "decisions": decisions}, ref_petite, dossier=tmp_path / "dico")
    assert d.chemin_lot("1", "01", tmp_path / "dico").read_text(encoding="utf-8") == avant


def test_seul_le_relu_s_exporte() -> None:
    a_relire = {"statut": d.A_RELIRE, "glose": "savoir", "acceptions": [{"categorie": "V", "fr": "savoir"}]}
    relu = {"statut": d.RELU, "glose": "bon, bien", "acceptions": [{"categorie": "V", "fr": "aimer", "pinyin": "hào"}]}
    assert dictionnaire.sens_exporte(a_relire) is None
    assert dictionnaire.sens_exporte(relu) == {"statut": "relu", "glose": "bon, bien", "acceptions": [{"categorie": "V", "fr": "aimer", "pinyin": "hào"}]}
    exemples = [{"zh": "我知道。", "pinyin": "Wǒ zhīdao.", "fr": "Je sais.", "statut": d.A_RELIRE}, {"zh": "他知道。", "pinyin": "Tā zhīdao.", "fr": "Il sait.", "statut": d.RELU, "relecture": {}}]
    assert dictionnaire.exemples_exportes(exemples) == [{"zh": "他知道。", "pinyin": "Tā zhīdao.", "fr": "Il sait.", "statut": "relu"}]


def test_l_export_porte_exactement_le_relu(tmp_path: Path) -> None:
    dossier = tmp_path / "0.1.0"
    (dossier / "dico" / "mots").mkdir(parents=True)
    index = {"fichiers": {"caracteres": "dico/caracteres/{lot}.json", "mots": "dico/mots/{lot}.json"}, "caracteres": [], "mots": [["L1-0002", "知道", "zhi1 dao5", 1, 0, ""]]}
    (dossier / "dico" / "index.json").write_text(json.dumps(index), encoding="utf-8")
    (dossier / "dico" / "mots" / "0.json").write_text(json.dumps({"entrees": {"L1-0002": {"sens": None, "exemples": []}}}), encoding="utf-8")
    relu = {"L1-0002": {"statut": d.RELU, "glose": "savoir", "acceptions": []}}
    assert d.fautes_d_export(dossier, {}, {}) == []
    assert d.fautes_d_export(dossier, relu, {}) != []


def test_aucune_source_cc_cedict(tmp_path: Path, ref: d.Referentiel) -> None:
    assert d.fautes_cedict(ref, []) == []
    ref.lus.append("/data/work/ingest/mots.json")
    assert any("mots.json" in f for f in d.fautes_cedict(ref, []))
    ref.lus.pop()
    lot = tmp_path / "1" / "01.json"
    lot.parent.mkdir(parents=True)
    lot.write_text(json.dumps({"source": "d'après CC-CEDICT"}), encoding="utf-8")
    assert any("cite CC-CEDICT" in f for f in d.fautes_cedict(ref, [tmp_path]))
    lot.write_text(json.dumps({"entrees": [{"sens": {"glose": "savoir", "en": "to know"}}]}), encoding="utf-8")
    assert any("glose anglaise" in f for f in d.fautes_cedict(ref, [tmp_path]))


def test_le_referentiel_ne_lit_pas_cc_cedict() -> None:
    import inspect

    source = inspect.getsource(d.charger_referentiel) + inspect.getsource(d.charger_fiches_relues)
    for interdit in (*d.FICHIERS_INTERDITS, "kDefinition", "CEDICT"):
        assert interdit not in source


def test_garde_fou_anglais_contre_cc_cedict() -> None:
    assert d.recouvrement_cedict("to know; to be aware of", ["to know", "to be aware of"])
    assert not d.recouvrement_cedict("to have knowledge", ["to know", "to be aware of"])


def test_page_de_relecture_autonome(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    lot = _importer(tmp_path, ref_petite, {"L1-0002": {"glose": "savoir", "acceptions": [["V", "savoir </script>"]], "exemples": [["我知道。", "Wǒ zhīdao.", "Je suis au courant."]]}})
    texte = page([lot], ref_petite, date="2026-09-29")
    assert texte.startswith("<title>") and texte.index("<style>") < texte.index("</style>") < texte.index("<script")
    for balise in ("<html", "<head", "<body", "<!doctype"):
        assert balise not in texte.lower()
    assert len(texte.encode("utf-8")) < 4 * 1024 * 1024
    assert "savoir <\\/script>" in texte
    assert d.FORMAT_RELECTURE in texte


def test_controles_bloquants_sur_les_lots(tmp_path: Path, ref_petite: d.Referentiel) -> None:
    _importer(tmp_path, ref_petite)
    chemin = d.chemin_lot("1", "01", tmp_path / "dico")
    lot = json.loads(chemin.read_text(encoding="utf-8"))
    ok = {c.nom: c for c in d.controles(tmp_path / "dico", ref=ref_petite, destination=tmp_path / "export", brouillons=tmp_path / "brouillons")}
    assert all(c.ok for c in ok.values() if c.bloquant), [c for c in ok.values() if not c.ok]
    for e in lot["entrees"]:
        if e["id"] == "L1-0002":
            e["sens"]["glose"] = "savoir 知"
            e["exemples"][0]["zh"] = "我知道他来。"
    chemin.write_text(json.dumps(lot, ensure_ascii=False), encoding="utf-8")
    faux = {c.nom: c for c in d.controles(tmp_path / "dico", ref=ref_petite, destination=tmp_path / "export", brouillons=tmp_path / "brouillons")}
    assert not faux["dico sens : sans sinogramme"].ok and faux["dico sens : sans sinogramme"].bloquant
    assert not faux["dico phrases : caractères HSK"].ok
