"""Le message WeChat (story 4b.7) : sources, export, contrôles.

Un test par règle. Aucun réseau. Les règles : un ami, de quarante à soixante dialogues ;
chaque dialogue a sa clé, écrite dedans, et de deux à quatre échanges ; un échange, c'est
un message de l'ami, une bonne réplique et deux ou trois mauvaises, chacune avec son
erreur (hors sujet, contresens) ; le mot de la fin clôt le dialogue ; une bonne réplique
note ses caractères une fois par dialogue ; les mauvaises répliques sont à lire, donc à
acquérir ; chaque texte se lit dans son pinyin, et l'export en donne une syllabe par
caractère ; chaque caractère est posé par un parcours, et chaque parcours ouvre un
dialogue dès ses premières semaines.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import export as export_mod
from wenlu_data import wechat as wechat_mod
from wenlu_data.cli import app as cli
from wenlu_data.wechat import (
    OBJECTIF_MAX,
    OBJECTIF_MIN,
    PREMIER_JOUR_MAX,
    Wechat,
    caracteres_de,
    charger,
    controles,
    document,
    fautes_export,
    fautes_parcours,
    fautes_pinyin,
    fautes_sources,
    notes,
    structure,
    syllabes,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée

AMI = """zh\tpinyin\tfr\ten\tsource
大明\tDàmíng\tton ami\tyour friend\tx
"""
DIALOGUES = """id\tcle\tfr\ten\tsource
zao\t早\tSalut\tMorning\tx
cha\t茶\tLe thé\tTea\tx
"""
ECHANGES = """dialogue\trole\tzh\tpinyin\tfr\ten\terreur
zao\tami\t早！\tZǎo!\tSalut !\tMorning!\t
zao\tjuste\t早！\tZǎo!\tSalut !\tMorning!\t
zao\tfaux\t明天见！\tMíngtiān jiàn!\tÀ demain !\tSee you!\tcontresens
zao\tfaux\t我喝茶。\tWǒ hē chá.\tJe bois du thé.\tI drink tea.\thors-sujet
zao\tami\t明天见？\tMíngtiān jiàn?\tÀ demain ?\tTomorrow?\t
zao\tjuste\t好，明天见！\tHǎo, míngtiān jiàn!\tD'accord, à demain !\tOK, see you!\t
zao\tfaux\t早！\tZǎo!\tSalut !\tMorning!\tcontresens
zao\tfaux\t我喝茶。\tWǒ hē chá.\tJe bois du thé.\tI drink tea.\thors-sujet
zao\tfin\t好！\tHǎo!\tBien !\tGood!\t
cha\tami\t喝茶？\tHē chá?\tUn thé ?\tTea?\t
cha\tjuste\t好，喝茶！\tHǎo, hē chá!\tVolontiers !\tSure!\t
cha\tfaux\t好，吃菜！\tHǎo, chī cài!\tD'accord, des légumes !\tOK, vegetables!\tcontresens
cha\tfaux\t明天见！\tMíngtiān jiàn!\tÀ demain !\tSee you!\thors-sujet
cha\tami\t明天喝？\tMíngtiān hē?\tDemain ?\tTomorrow?\t
cha\tjuste\t好，明天喝茶。\tHǎo, míngtiān hē chá.\tD'accord, demain.\tOK, tomorrow.\t
cha\tfaux\t今天喝？\tJīntiān hē?\tAujourd'hui ?\tToday?\tcontresens
cha\tfaux\t我吃菜。\tWǒ chī cài.\tJe mange des légumes.\tI eat vegetables.\thors-sujet
"""

LECTURES = {
    "大": ["dà"], "明": ["míng"], "早": ["zǎo"], "天": ["tiān"], "见": ["jiàn"], "我": ["wǒ"],
    "喝": ["hē"], "茶": ["chá"], "好": ["hǎo"], "吃": ["chī"], "菜": ["cài"], "今": ["jīn"],
}

#: Deux parcours : `lire` pose tout sauf 菜 ; `hsk` pose tout, 早 en premier.
TOUS = ["早", "大", "明", "天", "见", "我", "喝", "茶", "好", "吃", "今", "菜"]
PARCOURS = {
    "hsk": {"jours": [{"jour": k + 1, "brique": c, "composes": []} for k, c in enumerate(TOUS)]},
    "lire": {"jours": [{"jour": k + 1, "brique": c, "composes": []} for k, c in enumerate(x for x in TOUS if x != "菜")]},
}


@pytest.fixture
def dossier(tmp_path: Path) -> Path:
    d = tmp_path / "wechat"
    d.mkdir()
    for nom, texte in (("ami.tsv", AMI), ("dialogues.tsv", DIALOGUES), ("echanges.tsv", ECHANGES)):
        (d / nom).write_text(texte, encoding="utf-8")
    return d


def petit(dossier: Path) -> Wechat:
    """Le petit monde, sans la règle du nombre de dialogues (il n'en a que deux)."""
    return charger(dossier)


def sans_compte(fautes: list[str]) -> list[str]:
    return [f for f in fautes if "dialogues, de" not in f]


# -------------------------------------------------------------------- les sources


def test_les_sources_versionnees_sont_propres() -> None:
    w = charger()
    assert fautes_sources(w) == []
    assert OBJECTIF_MIN <= len(w.dialogues) <= OBJECTIF_MAX
    assert len(w.ami) == 1


def test_le_petit_monde_est_propre_hors_du_compte(dossier: Path) -> None:
    fautes = fautes_sources(petit(dossier))
    assert fautes == [f"2 dialogues, de {OBJECTIF_MIN} à {OBJECTIF_MAX} attendus"]


def test_un_echange_a_un_message_une_bonne_replique_et_deux_ou_trois_mauvaises(dossier: Path) -> None:
    w = petit(dossier)
    echanges, fin, fautes = structure(w.lignes_de("zao"))
    assert fautes == [] and len(echanges) == 2 and fin is not None and fin.texte.zh == "好！"
    assert [f.erreur for f in echanges[0].faux] == ["contresens", "hors-sujet"]
    seul = tuple(l for l in w.lignes if not (l.dialogue == "cha" and l.texte.zh == "我吃菜。"))
    assert any("1 mauvaises répliques" in f for f in fautes_sources(replace(w, lignes=seul)))
    deux = tuple(replace(l, role="juste", erreur="") if l.texte.zh == "好，吃菜！" else l for l in w.lignes)
    assert any("2 bonnes répliques" in f for f in fautes_sources(replace(w, lignes=deux)))


def test_une_mauvaise_replique_dit_ce_qui_cloche(dossier: Path) -> None:
    w = petit(dossier)
    muet = tuple(replace(l, erreur="") if l.texte.zh == "好，吃菜！" else l for l in w.lignes)
    assert any("attendu hors-sujet ou contresens" in f for f in fautes_sources(replace(w, lignes=muet)))
    bavard = tuple(replace(l, erreur="contresens") if l.texte.zh == "好，喝茶！" else l for l in w.lignes)
    assert any("ne dit pas d'erreur" in f for f in fautes_sources(replace(w, lignes=bavard)))


def test_deux_repliques_pareilles_sont_une_faute(dossier: Path) -> None:
    w = petit(dossier)
    double = tuple(replace(l, texte=replace(l.texte, zh="好，喝茶！")) if l.texte.zh == "好，吃菜！" else l for l in w.lignes)
    assert any("deux répliques identiques" in f for f in fautes_sources(replace(w, lignes=double)))


def test_un_dialogue_a_de_deux_a_quatre_echanges(dossier: Path) -> None:
    w = petit(dossier)
    court = tuple(l for l in w.lignes if not (l.dialogue == "cha" and l.numero > w.lignes_de("cha")[3].numero))
    assert any("cha a 1 échanges" in f for f in fautes_sources(replace(w, lignes=court)))


def test_rien_ne_suit_le_mot_de_la_fin(dossier: Path) -> None:
    w = petit(dossier)
    lignes = w.lignes_de("zao")
    apres = [*lignes, replace(lignes[1], numero=99)]
    _, _, fautes = structure(apres)
    assert fautes == ["echanges.tsv:99 : une ligne après le mot de la fin"]


def test_la_cle_est_un_caractere_ecrit_dans_le_dialogue(dossier: Path) -> None:
    w = petit(dossier)
    ailleurs = replace(w, dialogues=(replace(w.dialogues[0], cle="菜"), *w.dialogues[1:]))
    assert any("la clé 菜 n'est pas écrite dans zao" in f for f in fautes_sources(ailleurs))


# ------------------------------------------------------------- ce qui se lit, ce qui se note


def test_les_mauvaises_repliques_sont_a_acquerir(dossier: Path) -> None:
    """On les lit pour les écarter : 我 et 茶 n'apparaissent que dans une mauvaise réplique de zao."""
    w = petit(dossier)
    assert caracteres_de(w.lignes_de("zao")) == ["早", "明", "天", "见", "我", "喝", "茶", "好"]


def test_une_bonne_replique_note_ses_caracteres_une_fois_par_dialogue(dossier: Path) -> None:
    w = petit(dossier)
    echanges, _, _ = structure(w.lignes_de("cha"))
    assert notes(echanges) == [["好", "喝", "茶"], ["明", "天"]]


# ---------------------------------------------------------------------- pinyin


def test_chaque_texte_se_lit_dans_son_pinyin(dossier: Path) -> None:
    w = petit(dossier)
    assert fautes_pinyin(w, LECTURES) == []
    faux = tuple(replace(l, texte=replace(l.texte, pinyin="Hē cài?")) if l.texte.zh == "喝茶？" else l for l in w.lignes)
    fautes = fautes_pinyin(replace(w, lignes=faux), LECTURES)
    assert len(fautes) == 1 and "喝茶？" in fautes[0]


def test_l_export_donne_une_syllabe_par_caractere() -> None:
    t = wechat_mod.Texte(zh="好，明天见！", pinyin="Hǎo, míngtiān jiàn!", fr="", en="")
    assert syllabes(t, LECTURES) == ["hǎo", "míng", "tiān", "jiàn"]
    assert syllabes(replace(t, pinyin="Hǎo!"), LECTURES) == []


# -------------------------------------------------------------------- parcours


def test_un_caractere_hors_parcours_est_une_faute(dossier: Path) -> None:
    w = petit(dossier)
    sans_the = {nom: {"jours": [j for j in d["jours"] if j["brique"] != "茶"]} for nom, d in PARCOURS.items()}
    fautes = fautes_parcours(w, sans_the)
    assert "茶 hors parcours" in fautes
    assert "cha : possible dans aucun parcours" in fautes


def test_chaque_parcours_ouvre_un_dialogue_des_ses_premieres_semaines(dossier: Path) -> None:
    w = petit(dossier)
    assert fautes_parcours(w, PARCOURS) == []
    tard = {
        "lire": {"jours": [{"jour": PREMIER_JOUR_MAX + k, "brique": c, "composes": []} for k, c in enumerate(TOUS)]}
    }
    assert any("premier dialogue" in f for f in fautes_parcours(w, tard))


# ---------------------------------------------------------------------- export


def test_le_document_dit_ce_qu_il_faut_acquerir_et_quand(dossier: Path) -> None:
    doc = document(
        "0.9.0",
        parcours=PARCOURS,
        racines={"早": "日", "茶": "艹"},
        lues=LECTURES,
        en_tete={"version": "0.9.0"},
        dossier=dossier,
    )
    assert doc["version"] == "0.9.0"
    assert doc["ami"] == {"zh": "大明", "pinyin": "Dàmíng", "fr": "ton ami", "en": "your friend"}
    zao, cha = doc["dialogues"]  # type: ignore[misc]
    assert zao["famille"] == "日" and cha["famille"] == "艹"
    assert cha["jours"] == {"hsk": 12, "lire": None}
    premier = cha["echanges"][0]
    assert [r["juste"] for r in premier["repliques"]] == [True, False, False]
    assert premier["repliques"][1]["erreur"] == "contresens"
    assert premier["ami"]["syllabes"] == ["hē", "chá"]
    assert premier["notes"] == ["好", "喝", "茶"]
    assert zao["fin"]["zh"] == "好！" and cha["fin"] is None
    assert doc["racines"] == {"早": "日", "茶": "艹"}


def test_l_export_se_controle_contre_les_sources(dossier: Path) -> None:
    w = petit(dossier)
    doc = document("0.9.0", parcours=PARCOURS, racines={}, lues=LECTURES, dossier=dossier)
    sorties = list(doc["dialogues"])  # type: ignore[call-overload]
    assert fautes_export(sorties, w) == []
    mauvais = json.loads(json.dumps(sorties))
    mauvais[0]["caracteres"] = ["早"]
    mauvais[0]["echanges"][1]["notes"] = ["明", "早"]
    mauvais[0]["echanges"][0]["ami"]["syllabes"] = []
    fautes = fautes_export(mauvais[:1], w)
    assert any("incomplets" in f for f in fautes)
    assert any("déjà notées" in f for f in fautes)
    assert any("sans pinyin par caractère" in f for f in fautes)
    assert any("non exportés : cha" in f for f in fautes)


def test_l_export_ecrit_wechat_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "wechat.json" in rapport.fichiers
    doc = lire(rapport.dossier, "wechat.json")
    assert export_mod.fautes_de_licence("wechat.json", doc) == []
    assert lire(rapport.dossier, "index.json")["wechat"] == "wechat.json"


def test_changer_un_dialogue_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "echanges.tsv"
    copie.write_text(wechat_mod.ECHANGES.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(wechat_mod, "ECHANGES", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(not (VERSIONNE / "wechat.json").exists(), reason="wechat.json pas encore exporté")


@versionne
def test_l_export_versionne_passe_les_controles_du_message(tmp_path: Path) -> None:
    """Sans build ni ingest (la CI n'en a pas), le pinyin et les parcours ne se lisent pas ; le reste si."""
    resultats = controles(build=tmp_path / "sans-build", ingest=tmp_path / "sans-ingest")
    assert [c.nom for c in resultats if not c.ok] == []


@versionne
def test_l_export_versionne_porte_l_exemple_du_brief() -> None:
    """你好吗？→ 我很好，你呢？ (docs/jeux.md) ; et chaque caractère a sa famille."""
    doc = json.loads((VERSIONNE / "wechat.json").read_text(encoding="utf-8"))
    assert OBJECTIF_MIN <= len(doc["dialogues"]) <= OBJECTIF_MAX
    paires = {
        (e["ami"]["zh"], r["zh"]) for d in doc["dialogues"] for e in d["echanges"] for r in e["repliques"] if r["juste"]
    }
    assert ("你好吗？", "我很好，你呢？") in paires
    for d in doc["dialogues"]:
        assert d["famille"], d["id"]
        for c in d["caracteres"]:
            assert c in doc["racines"], c


@versionne
def test_la_commande_apercu_liste_les_dialogues() -> None:
    resultat = CliRunner().invoke(cli, ["wechat", "apercu"])
    assert resultat.exit_code == 0, resultat.output
    assert "我很好，你呢？" in resultat.output and "✗ contresens" in resultat.output
