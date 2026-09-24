"""Le client Claude partagé par les fiches et les contes : un test par règle.

Aucun réseau, aucune clé : un SDK simulé capte les corps de requête. Les
empreintes en dur ont été relevées sur le code d'avant l'extraction de
`claude.py` (fiches et contes portaient chacun leur copie du client) : elles
disent qu'aucune invite, aucun schéma et aucun paramètre d'appel n'a bougé.
Si l'une change, c'est que la requête envoyée à l'API a changé — à faire
exprès, et à dire dans le commit.
"""
from __future__ import annotations

import hashlib
import json
from types import SimpleNamespace

import pytest
import typer

from wenlu_data import claude, contes, fiches


class _Lots:
    def __init__(self) -> None:
        self.envoyees: list[dict] = []

    def create(self, requests):
        self.envoyees = [dict(r) | {"params": dict(r["params"])} for r in requests]
        return SimpleNamespace(id="msgbatch_simule")


class _Messages:
    def __init__(self) -> None:
        self.batches = _Lots()
        self.corps: list[dict] = []

    def create(self, **params):
        self.corps.append(params)
        bloc = SimpleNamespace(type="text", text="{}")
        return SimpleNamespace(content=[bloc], stop_reason="end_turn")


class _Sdk:
    def __init__(self) -> None:
        self.messages = _Messages()


def _empreinte(corps: object) -> str:
    brut = json.dumps(corps, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(brut.encode("utf-8")).hexdigest()


def _contexte_fiche() -> fiches.Contexte:
    return fiches.Contexte(
        c="休",
        parcours="lire",
        jour=4,
        pinyin=("xiū",),
        structure="⿰亻木",
        reconcilie=True,
        genre="compose",
        famille="亻",
        elements=(
            fiches.Element("亻", "单人旁", "sens"),
            fiches.Element("木", "木", None),
        ),
        type_etymologie="ideographic",
        indice_en="a person leaning against a tree",
        acquis=tuple("人木日月休"),
        candidats=(fiches.MotCandidat("休息", "xiū xi"),),
    )


CONTE = contes.Conte(
    id="shou-zhu-dai-tu",
    titre_zh="守株待兔",
    titre_fr="Attendre le lièvre près de la souche",
    ouvrage="Han Feizi",
    resume_fr="Un paysan attend qu'un autre lièvre se brise la nuque contre la souche.",
)


def _corps(module, invites: list) -> tuple[list[dict], list[dict]]:
    """Corps unitaires et corps de lot pour ces invites, par le client du module."""
    sdk = _Sdk()
    client = module.ClientAnthropic(sdk, modele=module.MODELE)
    for demande in invites:
        client.generer(demande)
    client.soumettre([module.RequeteLot(f"id-{i}", d) for i, d in enumerate(invites)])
    return sdk.messages.corps, sdk.messages.batches.envoyees


#: Relevées avant l'extraction de `claude.py` (commit parent). Celle des contes a été
#: relevée de nouveau quand l'invite a demandé le pinyin du titre, la traduction
#: anglaise et la glose par mot (rédaction des contes sans API) ; celle des fiches, quand
#: la consigne des mots est passée à « au plus deux », sans mot rare imposé.
EMPREINTES = {
    "fiches": "dd198c929cf2b62c2cd9e370fea540ee6be0d4a668fb9f66729998550cfe99a5",
    "contes": "0597d5221a2d6665510e9f0e8c7c63bc3e56c5fae00554b7fd99151ea05256af",
}


def test_les_requetes_des_fiches_n_ont_pas_change() -> None:
    contexte = _contexte_fiche()
    invites = [fiches.invite(contexte), fiches.invite(contexte, refus=["phrase hors acquis : 林"])]
    unitaires, lot = _corps(fiches, invites)
    assert [e["params"] for e in lot] == unitaires
    assert _empreinte({"unitaires": unitaires, "lot": lot}) == EMPREINTES["fiches"]


def test_les_requetes_des_contes_n_ont_pas_change() -> None:
    autorises = list("一人口大小山水日月木田上下")
    invites = [
        contes.invite(CONTE, 255, autorises),
        contes.invite(CONTE, 255, autorises, intrus=["兔", "株"]),
    ]
    unitaires, lot = _corps(contes, invites)
    assert [e["params"] for e in lot] == unitaires
    assert _empreinte({"unitaires": unitaires, "lot": lot}) == EMPREINTES["contes"]


def test_fiches_et_contes_partagent_le_meme_client() -> None:
    """Un seul client, deux schémas : les noms publics restent importables des deux modules."""
    for nom in ("Invite", "RequeteLot", "ResultatLot", "CleAbsente", "ReponseInvalide", "MODELE"):
        assert getattr(fiches, nom) is getattr(claude, nom) is getattr(contes, nom)
    assert issubclass(fiches.ClientAnthropic, claude.ClientAnthropic)
    assert issubclass(contes.ClientAnthropic, claude.ClientAnthropic)
    assert fiches.ClientAnthropic.SCHEMA is fiches.SCHEMA
    assert contes.ClientAnthropic.SCHEMA is contes.SCHEMA


def test_sans_cle_la_cli_sort_en_code_2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    for module in (fiches, contes):
        with pytest.raises(typer.Exit) as sortie:
            module._client(module.MODELE)
        assert sortie.value.exit_code == 2
