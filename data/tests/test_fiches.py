"""Fiches FR et EN : un test par règle. Aucun accès réseau, aucune clé d'API.

Le client Claude est simulé ; les textes des fixtures sont des suites de mots sans
contenu, jamais des fiches : une fiche ne s'écrit pas à la main dans le dépôt, elle
sort du pipeline.
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from wenlu_data import fiches
from wenlu_data.cli import app as cli
from wenlu_data.fiches import (
    A_RELIRE,
    ESSAIS_MAX,
    MARQUE_INDICE,
    REJETE,
    RELU,
    CaractereHorsParcours,
    CleAbsente,
    Corpus,
    MotCandidat,
    ParcoursInconnu,
    RequeteLot,
    ResultatLot,
    compter_phrases,
    controles,
    ecrire_fiche,
    fiches_ecrites,
    generer_fiche,
    invite,
    lire_fiche,
    lire_reponse,
    lots_en_cours,
    recuperer_lot,
    relire,
    soumettre_lot,
    valider,
)
from wenlu_data.gf0014 import charger_table

# --------------------------------------------------------------------------- corpus de test

#: Un parcours minuscule : une brique par jour, puis ses composés.
JOURS = [
    {"jour": 1, "brique": "人", "composes": [], "non_reconcilie": False},
    {"jour": 2, "brique": "口", "composes": [], "non_reconcilie": False},
    {"jour": 3, "brique": "门", "composes": ["问"], "non_reconcilie": False},
    {"jour": 4, "brique": "主", "composes": [], "non_reconcilie": False},
    {"jour": 5, "brique": "亻", "composes": ["住"], "non_reconcilie": False},
    {"jour": 6, "brique": "鸟", "composes": [], "non_reconcilie": False},
]

DECOMPOSITIONS = {
    "人": {"c": "人", "composants": ["人"], "structure": "人", "reconcilie": True},
    "口": {"c": "口", "composants": ["口"], "structure": "口", "reconcilie": True},
    "门": {"c": "门", "composants": ["门"], "structure": "门", "reconcilie": True},
    "问": {"c": "问", "composants": ["门", "口"], "structure": "⿵门口", "reconcilie": True},
    "主": {"c": "主", "composants": ["主"], "structure": "主", "reconcilie": True},
    "亻": {"c": "亻", "composants": ["亻"], "structure": "亻", "reconcilie": True},
    "住": {"c": "住", "composants": ["亻", "主"], "structure": "⿰亻主", "reconcilie": True},
    "鸟": {"c": "鸟", "composants": ["鸟"], "structure": "鸟", "reconcilie": True},
}

NOEUDS = {
    c: {"c": c, "genre": "brique" if c in "人口门主亻鸟" else "caractere", "racine": "门" if c == "问" else ("亻" if c == "住" else c)}
    for c in DECOMPOSITIONS
}

#: `hint` est l'étymologie anglaise de Make Me a Hanzi : information, pas texte à reprendre.
INDICE_EN = "A person who hosts; the second part also provides the pronunciation"

CARACTERES = {
    "人": {"c": "人", "pinyin": ["rén"], "definition_en": "man, person", "etymologie": None},
    "口": {"c": "口", "pinyin": ["kǒu"], "definition_en": "mouth", "etymologie": None},
    "门": {"c": "门", "pinyin": ["mén"], "definition_en": "door, gate", "etymologie": None},
    "问": {
        "c": "问",
        "pinyin": ["wèn"],
        "definition_en": "to ask about, to inquire",
        "etymologie": {"type": "pictophonetic", "hint": "mouth", "phonetic": "门", "semantic": "口"},
    },
    "主": {"c": "主", "pinyin": ["zhǔ"], "definition_en": "to own; host", "etymologie": None},
    "亻": {"c": "亻", "pinyin": ["rén"], "definition_en": "person radical", "etymologie": None},
    "住": {
        "c": "住",
        "pinyin": ["zhù"],
        "definition_en": "to reside, to live at, to dwell",
        "etymologie": {"type": "ideographic", "hint": INDICE_EN, "phonetic": None, "semantic": None},
    },
    "鸟": {"c": "鸟", "pinyin": ["niǎo"], "definition_en": "bird", "etymologie": None},
}

MOTS = [
    MotCandidat("住口", "zhu4 kou3"),
    MotCandidat("问住", "wen4 zhu4"),
    MotCandidat("主人", "zhu3 ren2"),
    MotCandidat("人口", "ren2 kou3"),
    MotCandidat("鸟人", "niao3 ren2"),
    MotCandidat("住家", "zhu4 jia1"),
    MotCandidat("人主", "Ren2 zhu3"),  # pinyin capitalisé : nom propre, écarté
    MotCandidat("主人口", "zhu3 ren2 kou3"),  # trois caractères, écarté
]


@pytest.fixture(scope="module")
def table():
    return charger_table()


@pytest.fixture
def corpus(table) -> Corpus:
    return Corpus(
        parcours="lire",
        jours=JOURS,
        decompositions=DECOMPOSITIONS,
        noeuds=NOEUDS,
        caracteres=CARACTERES,
        mots=MOTS,
        table=table,
    )


def horloge() -> str:
    return "2026-09-21T10:00:00Z"


def reponse(
    *,
    origine_fr: str = "Une première. Une deuxième. Une troisième.",
    origine_en: str = "One first. One second. One third.",
    etiquette: str = "mnemotechnique",
    roles: dict[str, str] | None = None,
    mots: list[str] | None = None,
    phrase: str = "主人住口。",
    sens_fr: str = "habiter, vivre",
    sens_en: str = "to live, to stay",
) -> str:
    """Une réponse du modèle, telle que `output_config.format` la contraint."""
    return json.dumps(
        {
            "sens_fr": sens_fr,
            "sens_en": sens_en,
            "origine_fr": origine_fr,
            "origine_en": origine_en,
            "etiquette": etiquette,
            "memo_fr": None,
            "memo_en": None,
            "roles": [{"c": c, "role": r} for c, r in (roles or {"亻": "sens", "主": "son"}).items()],
            "mots": [
                {"hanzi": m, "pinyin": "pīn yīn", "fr": "Traduction.", "en": "Translation."}
                for m in (mots if mots is not None else ["住口", "问住"])
            ],
            "phrase": {"zh": phrase, "pinyin": "pīn yīn", "fr": "Une phrase.", "en": "A sentence."},
        },
        ensure_ascii=False,
    )


CONFORME = reponse()
HORS_ACQUIS = reponse(phrase="鸟人住口。")


class ClientSimule:
    """Client injectable : rend des réponses préparées et retient les invites reçues."""

    def __init__(self, reponses: list[str], modele: str = "modele-de-test") -> None:
        self.modele = modele
        self.reponses = list(reponses)
        self.invites: list[fiches.Invite] = []
        self.lots: dict[str, list[RequeteLot]] = {}
        self.statut = "ended"
        self._compteur = 0

    def generer(self, demande: fiches.Invite) -> str:
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


def generation_de_test(essais: int = 1) -> fiches.Generation:
    return fiches.Generation(
        modele="modele-de-test",
        api=fiches.API_UNITAIRE,
        date=horloge(),
        empreinte_invite="sha256:" + "0" * 64,
        essais=essais,
    )


# --------------------------------------------------------------------------- contexte


def test_contexte_donne_la_decomposition_canonique_et_le_nom_des_composants(corpus) -> None:
    """GF 0014-2009 fait foi : la décomposition et le nom normalisé de chaque composant."""
    contexte = corpus.contexte("住")
    assert contexte.structure == "⿰亻主"
    assert contexte.formes == ("亻", "主")
    assert [e.nom for e in contexte.elements] == ["单立人", "主"]
    assert contexte.pinyin == ("zhù",)
    assert contexte.famille == "亻"


def test_contexte_porte_le_role_probable_dun_pictophonetique(corpus) -> None:
    """`phonetic` et `semantic` sont des faits de source : ils donnent le rôle probable."""
    elements = {e.forme: e.role_probable for e in corpus.contexte("问").elements}
    assert elements == {"门": "son", "口": "sens"}


def test_contexte_sans_etymologie_ne_suppose_aucun_role(corpus) -> None:
    assert all(e.role_probable is None for e in corpus.contexte("住").elements)


def test_acquis_sarrete_au_jour_du_caractere(corpus) -> None:
    """Le caractère du jour est acquis ; rien de ce qui vient après ne l'est."""
    assert corpus.acquis("问") == ("人", "口", "门", "问")
    assert corpus.acquis("住") == ("人", "口", "门", "问", "主", "亻", "住")
    assert "鸟" not in corpus.acquis("住")


def test_mots_candidats_filtres_sur_les_caracteres_vus(corpus) -> None:
    """Un mot n'est candidat que s'il contient le caractère et que tout y est déjà vu."""
    candidats = {m.hanzi for m in corpus.candidats("住")}
    assert candidats == {"住口", "问住"}
    assert "住家" not in candidats  # 家 n'est pas encore posé
    assert "鸟人" not in candidats  # 鸟 vient plus tard
    assert "主人" not in candidats  # ne contient pas 住


def test_mots_candidats_ecartent_les_noms_propres_et_les_mots_longs(corpus) -> None:
    """Le pinyin capitalisé de CC-CEDICT signale un nom propre ; une fiche porte des mots de deux caractères.

    Le tri se fait sur le pinyin et sur la longueur, jamais sur la définition anglaise.
    """
    candidats = {m.hanzi for m in corpus.candidats("主")}
    assert candidats == {"主人"}
    assert "人主" not in candidats
    assert "主人口" not in candidats


def test_caractere_hors_parcours_refuse(corpus) -> None:
    with pytest.raises(CaractereHorsParcours):
        corpus.contexte("龍")


def test_parcours_inconnu_refuse(table) -> None:
    with pytest.raises(ParcoursInconnu):
        Corpus("chinois", JOURS, DECOMPOSITIONS, NOEUDS, CARACTERES, MOTS, table)


# --------------------------------------------------------------------------- invite


def test_invite_porte_les_faits_de_la_fiche(corpus) -> None:
    demande = invite(corpus.contexte("住"))
    assert "住" in demande.utilisateur
    assert "zhù" in demande.utilisateur
    assert "⿰亻主" in demande.utilisateur
    assert "单立人" in demande.utilisateur
    assert "住口 (zhu4 kou3)" in demande.utilisateur
    assert "人口门问主亻住" in demande.utilisateur
    assert demande.empreinte.startswith("sha256:")


def test_invite_demande_trois_phrases_et_letiquette(corpus) -> None:
    demande = invite(corpus.contexte("住"))
    assert "EXACTEMENT 3 phrases" in demande.systeme
    assert "`atteste`" in demande.systeme and "`mnemotechnique`" in demande.systeme
    assert "Shuowen jiezi" in demande.systeme
    assert "dans le doute, `mnemotechnique`" in demande.systeme


def test_invite_ne_montre_aucune_definition_anglaise_de_cedict(corpus) -> None:
    """Règle de licence (`docs/sources-licences.md` §4.2) : jamais de glose CC-CEDICT.

    Des mots candidats, l'invite ne donne que le mot et son pinyin. Le module ne lit
    même pas la colonne des définitions : elle n'a pas de nom dans ce code.
    """
    demande = invite(corpus.contexte("住"))
    for entree in CARACTERES.values():
        assert entree["definition_en"] not in demande.utilisateur
    assert "définition" not in demande.utilisateur

    source = Path(fiches.__file__).read_text(encoding="utf-8")
    code = source.split('"""', 2)[2]
    assert "definitions_en" not in code
    importe = {
        alias.name
        for noeud in ast.walk(ast.parse(source))
        if isinstance(noeud, ast.ImportFrom) and noeud.module == "ingest"
        for alias in noeud.names
    }
    assert importe == {"charger_liste", "est_sinogramme"}


def test_invite_marque_lindice_detymologie_anglais(corpus) -> None:
    """L'étymologie EN de Make Me a Hanzi est une piste à vérifier, pas un texte à reprendre.

    Elle ne figure dans l'invite que sur la ligne qui la marque comme telle, et la
    consigne système interdit de la traduire ou de la recopier.
    """
    demande = invite(corpus.contexte("住"))
    lignes = [l for l in demande.utilisateur.splitlines() if INDICE_EN in l]
    assert len(lignes) == 1
    assert lignes[0].startswith(MARQUE_INDICE)
    assert "à ne ni traduire ni recopier" in lignes[0]
    assert "pas des textes à reprendre" in demande.systeme


def test_invite_signale_les_refus_de_lessai_precedent(corpus) -> None:
    """La relance nomme ce qui a été refusé, et change l'empreinte de l'invite."""
    contexte = corpus.contexte("住")
    premiere = invite(contexte)
    seconde = invite(contexte, refus=["phrase hors de l'acquis : 鸟"])
    assert "phrase hors de l'acquis : 鸟" in seconde.utilisateur
    assert "refusé" in seconde.utilisateur
    assert seconde.empreinte != premiere.empreinte


# --------------------------------------------------------------------------- validation


@pytest.mark.parametrize(
    "texte, attendu",
    [
        ("Une. Deux. Trois.", 3),
        ("Une. Deux.", 2),
        ("Une. Deux. Trois. Quatre.", 4),
        ("Une. Deux. Trois sans point", 3),
        ("Une ! Deux ? Trois…", 3),
        ("", 0),
    ],
)
def test_compter_phrases_compte_les_points_finaux(texte: str, attendu: int) -> None:
    assert compter_phrases(texte) == attendu


def test_validation_accepte_une_fiche_dans_le_cadre(corpus) -> None:
    contexte = corpus.contexte("住")
    fiche = lire_reponse(CONFORME, contexte=contexte, generation=generation_de_test())
    rapport = valider(fiche, contexte)
    assert rapport.conforme
    assert rapport.refus == []


def test_validation_refuse_une_origine_qui_na_pas_trois_phrases(corpus) -> None:
    contexte = corpus.contexte("住")
    fiche = lire_reponse(
        reponse(origine_fr="Une seule phrase.", origine_en="One. Two. Three. Four."),
        contexte=contexte,
        generation=generation_de_test(),
    )
    rapport = valider(fiche, contexte)
    assert not rapport.conforme
    assert "origine_fr fait 1 phrase(s) au lieu de 3" in rapport.refus
    assert "origine_en fait 4 phrase(s) au lieu de 3" in rapport.refus


def test_validation_refuse_un_sens_trop_long_ou_fini_par_un_point(corpus) -> None:
    """Le sens est une glose lue sous le pinyin : 40 caractères au plus, sans point final."""
    contexte = corpus.contexte("住")
    fiche = lire_reponse(
        reponse(sens_fr="a" * (fiches.SENS_MAX + 1), sens_en="to live."),
        contexte=contexte,
        generation=generation_de_test(),
    )
    rapport = valider(fiche, contexte)
    assert not rapport.conforme
    assert f"sens_fr fait {fiches.SENS_MAX + 1} caractères, {fiches.SENS_MAX} au plus" in rapport.refus
    assert "sens_en finit par un point" in rapport.refus


def test_validation_accepte_un_sens_de_quarante_caracteres(corpus) -> None:
    contexte = corpus.contexte("住")
    fiche = lire_reponse(
        reponse(sens_fr="a" * fiches.SENS_MAX), contexte=contexte, generation=generation_de_test()
    )
    assert valider(fiche, contexte).conforme


def test_validation_signale_un_sens_absent_sans_rejeter(corpus) -> None:
    """Une fiche à relire peut attendre son sens : c'est un écart, pas un rejet."""
    contexte = corpus.contexte("住")
    fiche = lire_reponse(reponse(sens_fr="", sens_en=""), contexte=contexte, generation=generation_de_test())
    rapport = valider(fiche, contexte)
    assert rapport.conforme
    assert "sens absent : sens_fr, sens_en" in rapport.ecarts


def test_validation_refuse_une_etiquette_hors_des_deux(corpus) -> None:
    """`atteste` ou `mnemotechnique`, jamais l'un pour l'autre, jamais un troisième mot."""
    contexte = corpus.contexte("住")
    fiche = lire_reponse(CONFORME, contexte=contexte, generation=generation_de_test())
    fiche.etiquette = "probable"
    assert any("étiquette" in motif for motif in valider(fiche, contexte).refus)


def test_validation_refuse_un_mot_hors_des_candidats(corpus) -> None:
    contexte = corpus.contexte("住")
    fiche = lire_reponse(
        reponse(mots=["住口", "住家"]), contexte=contexte, generation=generation_de_test()
    )
    rapport = valider(fiche, contexte)
    assert not rapport.conforme
    assert rapport.mots_hors_candidats == ["住家"]


def test_validation_donne_la_liste_exacte_des_intrus_de_la_phrase(corpus) -> None:
    """Un caractère non acquis suffit : rejet, et on dit lesquels, dans l'ordre."""
    contexte = corpus.contexte("住")
    fiche = lire_reponse(HORS_ACQUIS, contexte=contexte, generation=generation_de_test())
    rapport = valider(fiche, contexte)
    assert not rapport.conforme
    assert rapport.intrus == ["鸟"]
    assert "phrase hors de l'acquis : 鸟" in rapport.refus


def test_validation_laisse_passer_la_ponctuation_chinoise(corpus) -> None:
    assert fiches.caracteres_hors_acquis("主人住口，人口。", corpus.acquis("住")) == []


def test_validation_signale_un_role_manquant_sans_rejeter(corpus) -> None:
    """Le rôle absent est un écart de relecture, pas un caractère interdit."""
    contexte = corpus.contexte("住")
    fiche = lire_reponse(
        reponse(roles={"亻": "sens"}), contexte=contexte, generation=generation_de_test()
    )
    rapport = valider(fiche, contexte)
    assert rapport.conforme
    assert any("rôle absent pour 主" in e for e in rapport.ecarts)


def test_validation_signale_le_manque_de_mots_candidats(corpus) -> None:
    """Au jour 3, aucun mot de deux caractères n'est encore lisible avec 问."""
    contexte = corpus.contexte("问")
    assert contexte.candidats == ()
    fiche = lire_reponse(
        reponse(mots=[], roles={"门": "son", "口": "sens"}, phrase="人口。"),
        contexte=contexte,
        generation=generation_de_test(),
    )
    rapport = valider(fiche, contexte)
    assert rapport.conforme
    assert any("mot candidat lisible" in e for e in rapport.ecarts)


def test_validation_accepte_moins_de_mots_que_de_candidats(corpus) -> None:
    """Un candidat rare ne s'impose jamais : un mot, ou aucun, est un écart, pas un rejet."""
    contexte = corpus.contexte("住")
    assert len(contexte.candidats) == 2
    for mots in (["住口"], []):
        fiche = lire_reponse(reponse(mots=mots), contexte=contexte, generation=generation_de_test())
        rapport = valider(fiche, contexte)
        assert rapport.conforme, rapport.refus
        assert f"{len(mots)} mot(s) au lieu de 2, pour 2 candidats lisibles au jour 5" in rapport.ecarts


def test_validation_refuse_plus_de_deux_mots(corpus) -> None:
    contexte = corpus.contexte("住")
    fiche = lire_reponse(
        reponse(mots=["住口", "问住", "住口"]), contexte=contexte, generation=generation_de_test()
    )
    rapport = valider(fiche, contexte)
    assert "3 mots au lieu de 2 au plus" in rapport.refus


def test_mots_exclus_jamais_candidats(table) -> None:
    """Argot, mahjong, mots rares, fragments : `mots-exclus.tsv` les retire des candidats."""
    exclu = Corpus(
        parcours="lire",
        jours=JOURS,
        decompositions=DECOMPOSITIONS,
        noeuds=NOEUDS,
        caracteres=CARACTERES,
        mots=MOTS,
        table=table,
        exclus={"问住"},
    )
    assert {m.hanzi for m in exclu.candidats("住")} == {"住口"}
    # Une fiche qui garde le mot exclu est refusée : il n'est plus candidat.
    contexte = exclu.contexte("住")
    fiche = lire_reponse(CONFORME, contexte=contexte, generation=generation_de_test())
    assert valider(fiche, contexte).mots_hors_candidats == ["问住"]


def test_le_depart_se_lit_avec_toute_la_premiere_session(table) -> None:
    """人, 大, 天 sont posés ensemble par la première session : chacun a les trois acquis."""
    jours = [
        {"jour": 1, "brique": "人", "composes": []},
        {"jour": 2, "brique": "口", "composes": []},
        {"jour": 3, "brique": "门", "composes": ["问"]},
    ]
    depart = Corpus(
        parcours="lire",
        jours=jours,
        decompositions=DECOMPOSITIONS,
        noeuds=NOEUDS,
        caracteres=CARACTERES,
        mots=MOTS,
        table=table,
        depart=("人", "口"),
    )
    assert depart.acquis("人") == depart.acquis("口") == ("人", "口")
    assert depart.jour("人") == 1
    assert depart.acquis("问") == ("人", "口", "门", "问")


def test_charger_corpus_applique_les_surcharges(tmp_path: Path, monkeypatch) -> None:
    """Le pinyin de la surcharge remplace celui de Make Me a Hanzi ; les mots exclus sortent."""
    from wenlu_data import surcharges

    build = tmp_path / "build"
    ingest = tmp_path / "ingest"
    build.mkdir()
    ingest.mkdir()
    (build / "parcours-lire.json").write_text(
        json.dumps({"jours": JOURS, "depart": ["人"]}, ensure_ascii=False), encoding="utf-8"
    )
    (build / "decompositions.json").write_text(
        json.dumps({"caracteres": list(DECOMPOSITIONS.values())}, ensure_ascii=False), encoding="utf-8"
    )
    (build / "graphe.json").write_text(
        json.dumps({"noeuds": list(NOEUDS.values())}, ensure_ascii=False), encoding="utf-8"
    )
    (ingest / "caracteres.json").write_text(
        json.dumps(list(CARACTERES.values()), ensure_ascii=False), encoding="utf-8"
    )
    (ingest / "mots.json").write_text(
        json.dumps([{"simplifie": m.hanzi, "pinyin": m.pinyin} for m in MOTS], ensure_ascii=False),
        encoding="utf-8",
    )
    lectures = tmp_path / "pinyin.tsv"
    lectures.write_text("住\tzhù zhǔ\tlecture de test\n", encoding="utf-8")
    exclus = tmp_path / "exclus.tsv"
    exclus.write_text("问住\tmot de test\n", encoding="utf-8")
    monkeypatch.setattr(surcharges, "PINYIN", lectures)
    monkeypatch.setattr(surcharges, "MOTS_EXCLUS", exclus)

    corpus = fiches.charger_corpus(build=build, ingest=ingest)
    assert corpus.contexte("住").pinyin == ("zhù", "zhǔ")
    assert {m.hanzi for m in corpus.candidats("住")} == {"住口"}
    assert corpus.depart == ("人",)


# --------------------------------------------------------------------------- génération


def test_relance_sur_refus_avec_client_simule(corpus) -> None:
    """Premier essai hors acquis, relance avec le motif signalé, second essai accepté."""
    client = ClientSimule([HORS_ACQUIS, CONFORME])
    fiche, rapport = generer_fiche(corpus.contexte("住"), client, horloge=horloge)
    assert rapport.conforme
    assert fiche.statut == A_RELIRE
    assert fiche.generation.essais == 2
    assert len(client.invites) == 2
    assert "鸟" in client.invites[1].utilisateur


def test_trois_essais_au_plus_puis_rejet(corpus) -> None:
    """Au-delà de trois essais on s'arrête : la fiche est marquée rejetée."""
    client = ClientSimule([HORS_ACQUIS] * (ESSAIS_MAX + 1))
    fiche, rapport = generer_fiche(corpus.contexte("住"), client, horloge=horloge)
    assert not rapport.conforme
    assert fiche.statut == REJETE
    assert fiche.generation.essais == ESSAIS_MAX
    assert len(client.invites) == ESSAIS_MAX
    assert fiche.generation.refus == ["phrase hors de l'acquis : 鸟"]


def test_tracabilite_complete_dans_le_fichier_ecrit(corpus, tmp_path: Path) -> None:
    """Caractère, modèle, API, date, empreinte, essais, statut : tout est écrit."""
    client = ClientSimule([HORS_ACQUIS, CONFORME])
    fiche, _ = generer_fiche(corpus.contexte("住"), client, horloge=horloge)
    chemin = ecrire_fiche(fiche, tmp_path)
    assert chemin == tmp_path / "住.json"

    document = json.loads(chemin.read_text(encoding="utf-8"))
    assert document["c"] == "住"
    assert document["parcours"] == "lire"
    assert document["jour"] == 5
    assert document["composants"] == ["亻", "主"]
    assert document["etiquette"] == "mnemotechnique"
    assert document["roles"] == {"亻": "sens", "主": "son"}
    assert [m["hanzi"] for m in document["mots"]] == ["住口", "问住"]
    assert document["statut"] == A_RELIRE
    generation = document["generation"]
    assert generation["modele"] == "modele-de-test"
    assert generation["api"] == "messages"
    assert generation["date"] == horloge()
    assert generation["empreinte_invite"] == client.invites[1].empreinte
    assert generation["essais"] == 2
    assert generation["refus"] == []
    assert lire_fiche(chemin).en_json() == document


# --------------------------------------------------------------------------- relecture


def test_relecture_marque_la_fiche_et_rien_dautre(corpus, tmp_path: Path) -> None:
    """La relecture est humaine : elle change le statut, pas le texte."""
    client = ClientSimule([CONFORME])
    fiche, _ = generer_fiche(corpus.contexte("住"), client, horloge=horloge)
    ecrire_fiche(fiche, tmp_path)

    relue = relire("住", RELU, tmp_path)
    assert relue.statut == RELU
    assert relue.origine_fr == fiche.origine_fr
    assert lire_fiche(tmp_path / "住.json").statut == RELU


def test_relecture_refuse_une_fiche_sans_sens(corpus, tmp_path: Path) -> None:
    """Une fiche relue porte son sens : on ne la marque pas relue sans lui."""
    client = ClientSimule([reponse(sens_en="")])
    ecrire_fiche(generer_fiche(corpus.contexte("住"), client, horloge=horloge)[0], tmp_path)
    with pytest.raises(ValueError, match="sens_en vide"):
        relire("住", RELU, tmp_path)
    assert lire_fiche(tmp_path / "住.json").statut == A_RELIRE
    assert relire("住", REJETE, tmp_path).statut == REJETE, "rejeter reste possible"


def test_relecture_refuse_un_statut_inconnu(corpus, tmp_path: Path) -> None:
    client = ClientSimule([CONFORME])
    ecrire_fiche(generer_fiche(corpus.contexte("住"), client, horloge=horloge)[0], tmp_path)
    with pytest.raises(ValueError, match="statut"):
        relire("住", "presque", tmp_path)


def test_relecture_dune_fiche_absente_refuse(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        relire("住", RELU, tmp_path)


def test_commande_relire_marque_le_statut(corpus, monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(fiches, "FICHES_WORK", tmp_path)
    client = ClientSimule([CONFORME])
    ecrire_fiche(generer_fiche(corpus.contexte("住"), client, horloge=horloge)[0], tmp_path)

    resultat = CliRunner().invoke(cli, ["fiches", "relire", "--c", "住", "--statut", "relu"])
    assert resultat.exit_code == 0
    assert lire_fiche(tmp_path / "住.json").statut == RELU


# --------------------------------------------------------------------------- lots


def test_lot_soumis_puis_recupere(corpus, tmp_path: Path) -> None:
    """Un seul envoi pour plusieurs fiches, puis récupération et écriture."""
    client = ClientSimule([CONFORME, reponse(mots=[], roles={"门": "son", "口": "sens"}, phrase="人口。")])
    contextes = [corpus.contexte("住"), corpus.contexte("问")]
    lot = soumettre_lot(contextes, client, dossier=tmp_path, horloge=horloge)

    assert lot["statut"] == "en_cours"
    assert [r["custom_id"] for r in lot["requetes"]] == ["lire-住-1", "lire-问-1"]
    fichiers = lots_en_cours(tmp_path)
    assert [f.name for f in fichiers] == [f"{lot['lot']}.json"]

    journal = recuperer_lot(fichiers[0], client, corpus, dossier=tmp_path, horloge=horloge)
    assert len(journal) == 2
    assert {f.name for f in fiches_ecrites(tmp_path)} == {"住.json", "问.json"}
    assert json.loads(fichiers[0].read_text(encoding="utf-8"))["statut"] == "recupere"
    assert lots_en_cours(tmp_path) == []


def test_lot_relance_les_rejets_avec_leur_motif(corpus, tmp_path: Path) -> None:
    """Une fiche refusée repart dans un nouveau lot, avec son motif signalé."""
    client = ClientSimule([HORS_ACQUIS])
    lot = soumettre_lot([corpus.contexte("住")], client, dossier=tmp_path, horloge=horloge)
    journal = recuperer_lot(lots_en_cours(tmp_path)[0], client, corpus, dossier=tmp_path, horloge=horloge)

    assert any("鸟" in ligne for ligne in journal)
    document = json.loads((tmp_path / "住.json").read_text(encoding="utf-8"))
    assert document["statut"] == REJETE
    assert document["generation"]["refus"] == ["phrase hors de l'acquis : 鸟"]

    relance = lots_en_cours(tmp_path)
    assert len(relance) == 1
    suivant = json.loads(relance[0].read_text(encoding="utf-8"))
    assert suivant["lot"] != lot["lot"]
    assert suivant["requetes"][0]["essai"] == 2
    assert "鸟" in client.invites[-1].utilisateur


def test_lot_non_termine_ne_recupere_rien(corpus, tmp_path: Path) -> None:
    client = ClientSimule([])
    soumettre_lot([corpus.contexte("住")], client, dossier=tmp_path, horloge=horloge)
    client.statut = "in_progress"
    journal = recuperer_lot(lots_en_cours(tmp_path)[0], client, corpus, dossier=tmp_path)
    assert "in_progress" in journal[0]
    assert fiches_ecrites(tmp_path) == []
    assert len(lots_en_cours(tmp_path)) == 1


# --------------------------------------------------------------------------- check


def test_controle_check_detecte_une_fiche_invalide(corpus, tmp_path: Path) -> None:
    """`wenlu check` relit les fiches écrites : une fiche hors cadre est bloquante."""
    fiche = lire_reponse(HORS_ACQUIS, contexte=corpus.contexte("住"), generation=generation_de_test())
    ecrire_fiche(fiche, tmp_path)

    controle = controles(tmp_path, corpus, tmp_path)[0]
    assert controle.nom == "fiches : validation"
    assert not controle.ok and controle.bloquant
    assert "鸟" in controle.detail


def test_controle_check_accepte_une_fiche_conforme(corpus, tmp_path: Path) -> None:
    fiche = lire_reponse(CONFORME, contexte=corpus.contexte("住"), generation=generation_de_test())
    ecrire_fiche(fiche, tmp_path)
    validation, _, sens = controles(tmp_path, corpus, tmp_path)
    assert validation.ok and sens.ok


def test_controle_check_signale_le_seuil_255_non_relu(corpus, tmp_path: Path) -> None:
    """La relecture du seuil 255 est obligatoire avant export : elle est signalée, pas bloquante."""
    fiche = lire_reponse(CONFORME, contexte=corpus.contexte("住"), generation=generation_de_test())
    ecrire_fiche(fiche, tmp_path)

    _, relecture, _ = controles(tmp_path, corpus)  # listes réelles : 住 est au seuil 255
    assert not relecture.ok and not relecture.bloquant
    assert "1 fiches sur 1 du seuil 255 restent à relire" in relecture.detail
    assert "254 caractères du seuil sans fiche" in relecture.detail

    relire("住", RELU, tmp_path)
    assert "0 fiches sur 1" in controles(tmp_path, corpus)[1].detail


def test_controle_check_avoue_ne_pas_avoir_lu_la_liste_du_seuil(corpus, tmp_path: Path) -> None:
    """Liste du seuil absente : le contrôle est en écart, pas vert sur un ensemble vide."""
    fiche = lire_reponse(CONFORME, contexte=corpus.contexte("住"), generation=generation_de_test())
    ecrire_fiche(fiche, tmp_path)

    _, relecture, _ = controles(tmp_path, corpus, tmp_path / "sans-listes")
    assert not relecture.ok and not relecture.bloquant
    assert "relecture non contrôlée" in relecture.detail


def _fiche_ecrite(corpus, dossier: Path, *, statut: str, **champs: str) -> None:
    fiche = lire_reponse(reponse(**champs), contexte=corpus.contexte("住"), generation=generation_de_test())
    fiche.statut = statut
    ecrire_fiche(fiche, dossier)


def test_controle_check_bloque_une_fiche_relue_sans_sens(corpus, tmp_path: Path) -> None:
    """Relue sans sens : « fiches : sens » est en échec, et bloquant."""
    _fiche_ecrite(corpus, tmp_path, statut=RELU, sens_fr="", sens_en="")
    validation, _, sens = controles(tmp_path, corpus, tmp_path)
    assert validation.ok, "le sens absent n'est pas une faute de validation"
    assert sens.nom == "fiches : sens"
    assert not sens.ok and sens.bloquant
    assert "1 fiches relues sans sens — 住 (sens_fr, sens_en)" in sens.detail


def test_controle_check_tolere_une_fiche_a_relire_sans_sens(corpus, tmp_path: Path) -> None:
    _fiche_ecrite(corpus, tmp_path, statut=A_RELIRE, sens_fr="", sens_en="")
    assert controles(tmp_path, corpus, tmp_path)[2].ok


def test_controle_check_bloque_un_sens_trop_long(corpus, tmp_path: Path) -> None:
    """Le format du sens est vérifié sans corpus : il ne dépend pas du contexte."""
    _fiche_ecrite(corpus, tmp_path, statut=A_RELIRE, sens_fr="habiter, vivre, demeurer, séjourner, rester là")
    _, _, sens = controles(tmp_path, None, tmp_path)
    assert not sens.ok and sens.bloquant
    assert "sens_fr fait 46 caractères, 40 au plus" in sens.detail


def test_controle_check_bloque_un_sens_fini_par_un_point(corpus, tmp_path: Path) -> None:
    _fiche_ecrite(corpus, tmp_path, statut=RELU, sens_fr="habiter.")
    sens = controles(tmp_path, corpus, tmp_path)[2]
    assert not sens.ok and "sens_fr finit par un point" in sens.detail
    assert not controles(tmp_path, corpus, tmp_path)[0].ok, "une fiche générée ainsi est refusée"


def test_le_sens_suit_le_pinyin_dans_le_fichier_ecrit(corpus, tmp_path: Path) -> None:
    _fiche_ecrite(corpus, tmp_path, statut=A_RELIRE)
    document = json.loads((tmp_path / "住.json").read_text(encoding="utf-8"))
    cles = list(document)
    assert cles[cles.index("pinyin") + 1 : cles.index("pinyin") + 3] == ["sens_fr", "sens_en"]
    assert (document["sens_fr"], document["sens_en"]) == ("habiter, vivre", "to live, to stay")


def test_une_fiche_sans_sens_se_relit_avec_un_sens_vide(corpus, tmp_path: Path) -> None:
    """Le chargeur tolère une fiche d'avant le sens : `wenlu check` dit ce qui manque."""
    _fiche_ecrite(corpus, tmp_path, statut=RELU)
    chemin = tmp_path / "住.json"
    document = json.loads(chemin.read_text(encoding="utf-8"))
    del document["sens_fr"], document["sens_en"]
    chemin.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    fiche = lire_fiche(chemin)
    assert (fiche.sens_fr, fiche.sens_en) == ("", "")


def test_l_invite_demande_le_sens(corpus) -> None:
    """La génération et la rédaction sans API demandent le sens : schéma, consigne, squelette."""
    assert {"sens_fr", "sens_en"} <= set(fiches.SCHEMA["required"])  # type: ignore[arg-type]
    for consigne in (fiches.SYSTEME, fiches.CONTRAINTES):
        assert "sens_fr et sens_en" in consigne
        assert f"{fiches.SENS_MAX} caractères au plus" in consigne
        assert "sans point final" in consigne
    squelette = fiches.squelette(corpus.contexte("住"))
    assert list(squelette)[:3] == ["c", "sens_fr", "sens_en"]


def test_controle_check_sans_fiche_ne_bloque_pas(tmp_path: Path) -> None:
    """Le contrôle lit les fichiers s'ils existent, et se tait sinon."""
    assert controles(tmp_path, None, tmp_path)[0].ok


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
                type("L", (), {"custom_id": "lire-住-1", "result": succes})(),
                type("L", (), {"custom_id": "lire-问-1", "result": echec})(),
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


def test_le_client_sdk_envoie_la_meme_invite_en_unitaire_et_en_lot(corpus) -> None:
    """Messages API et Message Batches partagent le même corps de requête."""
    sdk = SdkSimule()
    client = fiches.ClientAnthropic(sdk, modele=fiches.MODELE)
    demande = invite(corpus.contexte("住"))

    assert client.generer(demande) == CONFORME
    unitaire = sdk.messages.params
    assert unitaire is not None
    assert unitaire["model"] == fiches.MODELE
    assert unitaire["system"] == demande.systeme
    assert unitaire["output_config"]["format"]["type"] == "json_schema"

    assert client.soumettre([RequeteLot("lire-住-1", demande)]) == "msgbatch_sdk"
    envoyee = sdk.messages.batches.envoyees[0]
    assert envoyee["custom_id"] == "lire-住-1"
    assert dict(envoyee["params"]) == unitaire


def test_le_client_sdk_rend_les_resultats_dun_lot() -> None:
    client = fiches.ClientAnthropic(SdkSimule(), modele=fiches.MODELE)
    assert client.statut_lot("msgbatch_sdk") == "ended"
    obtenus = list(client.resultats("msgbatch_sdk"))
    assert obtenus[0] == ResultatLot("lire-住-1", texte=CONFORME)
    assert obtenus[1] == ResultatLot("lire-问-1", erreur="errored")


def test_le_client_sdk_refuse_une_reponse_refusee(corpus) -> None:
    client = fiches.ClientAnthropic(SdkSimule("refusal"), modele=fiches.MODELE)
    with pytest.raises(fiches.ReponseInvalide, match="refus"):
        client.generer(invite(corpus.contexte("住")))


# --------------------------------------------------------------------------- clé d'API


def test_sans_cle_le_client_refuse_de_partir(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(CleAbsente, match="ANTHROPIC_API_KEY"):
        fiches.client_anthropic()


def test_sans_cle_la_commande_sort_en_2_sans_rien_ecrire(
    corpus, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Pas de clé : on le dit, on sort en 2, et aucun fichier n'est écrit."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(fiches, "FICHES_WORK", tmp_path)
    monkeypatch.setattr(fiches, "charger_corpus", lambda *a, **k: corpus)

    resultat = CliRunner().invoke(cli, ["fiches", "generer", "--parcours", "lire", "--jusqua", "2"])
    assert resultat.exit_code == 2
    assert "ANTHROPIC_API_KEY" in resultat.output
    assert list(tmp_path.iterdir()) == []


def test_corpus_absent_sort_en_1(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Sans `wenlu build`, la commande le dit et ne génère rien."""
    monkeypatch.setattr(fiches, "FICHES_WORK", tmp_path)
    monkeypatch.setattr(fiches, "BUILD", tmp_path / "build")
    monkeypatch.setattr(fiches, "INGEST", tmp_path / "ingest")

    resultat = CliRunner().invoke(cli, ["fiches", "generer", "--parcours", "lire"])
    assert resultat.exit_code == 1
    assert "wenlu" in resultat.output
    assert list(tmp_path.iterdir()) == []
