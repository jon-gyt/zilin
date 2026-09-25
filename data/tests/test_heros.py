"""Le personnage (story 4.5) : sources, contrôles, export.

Un test par règle. Aucun réseau. Les règles : douze rangs, le premier à 0 point, des
seuils strictement croissants, des âges qui ne reviennent jamais en arrière ; trois
bêtes (`tu`, `xiongmao`, `shi`), trois idées de nom chacune ; les phrases de Tao, avec
leurs seuls jetons ; aucun dragon ; chaque titre et chaque nom de bête se lit dans son
pinyin ; les titres des rangs se dessinent depuis leurs traits, donc entrent dans le
périmètre ; `heros.json` dit ce que disent les sources, et l'index le nomme.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from wenlu_data import export as export_mod
from wenlu_data import heros as heros_mod
from wenlu_data.heros import (
    AGES,
    BETES_ATTENDUES,
    JETONS_TAO,
    NOMBRE_RANGS,
    caracteres_dessines,
    charger,
    controles,
    document,
    fautes_export,
    fautes_pinyin,
    fautes_sources,
)

from test_export import atelier, lire  # noqa: F401 — fixture partagée

#: Les seuils du propriétaire, du bébé 启蒙 à l'adulte 状元.
SEUILS = [0, 10, 25, 50, 80, 120, 180, 260, 360, 500, 700, 1000]


def test_les_sources_versionnees_sont_propres() -> None:
    h = charger()
    assert fautes_sources(h) == []
    assert len(h.rangs) == NOMBRE_RANGS
    assert [r.points() for r in h.rangs] == SEUILS
    assert [r.hz for r in h.rangs][0] == "启蒙" and h.rangs[-1].hz == "状元"
    assert tuple(b.id for b in h.betes) == BETES_ATTENDUES


def test_chaque_source_est_tracee_redigee_pour_l_app() -> None:
    h = charger()
    sources = {r.source for r in h.rangs} | {b.source for b in h.betes} | {t.source for t in h.tao}
    assert sources == {"rédigé pour l'app"}
    for chemin in (heros_mod.RANGS, heros_mod.BETES, heros_mod.TAO):
        assert "rédigé pour l'app" in chemin.read_text(encoding="utf-8").split("\n", 5)[2]


# -------------------------------------------------------------------------- les rangs


def test_il_faut_douze_rangs() -> None:
    h = charger()
    assert any("11 rangs" in f for f in fautes_sources(replace(h, rangs=h.rangs[:-1])))


def test_les_seuils_croissent_depuis_zero() -> None:
    h = charger()
    egal = replace(h.rangs[3], seuil=h.rangs[2].seuil)
    assert any("les seuils croissent" in f for f in fautes_sources(replace(h, rangs=(*h.rangs[:3], egal, *h.rangs[4:]))))
    depart = replace(h.rangs[0], seuil="5")
    assert any("attendu 0" in f for f in fautes_sources(replace(h, rangs=(depart, *h.rangs[1:]))))
    lettre = replace(h.rangs[1], seuil="dix")
    assert any("attendu un entier" in f for f in fautes_sources(replace(h, rangs=(h.rangs[0], lettre, *h.rangs[2:]))))


def test_l_age_ne_revient_jamais_en_arriere() -> None:
    h = charger()
    assert [r.age for r in h.rangs][0] == AGES[0] and h.rangs[-1].age == AGES[-1]
    retour = replace(h.rangs[6], age="enfant")
    fautes = fautes_sources(replace(h, rangs=(*h.rangs[:6], retour, *h.rangs[7:])))
    assert any("ne revient pas en arrière" in f for f in fautes)
    inconnu = replace(h.rangs[6], age="vieillard")
    assert any("âge 'vieillard'" in f for f in fautes_sources(replace(h, rangs=(*h.rangs[:6], inconnu, *h.rangs[7:]))))


# -------------------------------------------------------------------------- les bêtes


def test_trois_betes_que_l_app_sait_dessiner() -> None:
    h = charger()
    assert any("attendu tu xiongmao shi" in f for f in fautes_sources(replace(h, betes=h.betes[:2])))
    autre = replace(h.betes[2], id="qilin")
    assert any("attendu tu xiongmao shi" in f for f in fautes_sources(replace(h, betes=(*h.betes[:2], autre))))


def test_trois_idees_de_nom_distinctes() -> None:
    h = charger()
    deux = replace(h.betes[0], noms=h.betes[0].noms[:2])
    assert any("2 idées de nom" in f for f in fautes_sources(replace(h, betes=(deux, *h.betes[1:]))))
    double = replace(h.betes[0], noms=("Yuè", "Yuè", "Pompon"))
    assert any("même idée" in f for f in fautes_sources(replace(h, betes=(double, *h.betes[1:]))))
    long = replace(h.betes[0], noms=("Yuè", "Pomponpomponpompon", "Lune"))
    assert any("dépasse 16" in f for f in fautes_sources(replace(h, betes=(long, *h.betes[1:]))))


def test_jamais_de_dragon() -> None:
    h = charger()
    dragon = replace(h.betes[2], fr="le dragon dansé")
    assert any("pas de dragon" in f for f in fautes_sources(replace(h, betes=(*h.betes[:2], dragon))))
    long = replace(h.rangs[0], role="la queue du 龙")
    assert any("pas de dragon" in f for f in fautes_sources(replace(h, rangs=(long, *h.rangs[1:]))))


# ------------------------------------------------------------------------------- Tao


def test_tao_dit_chacune_de_ses_phrases() -> None:
    h = charger()
    assert {t.cle for t in h.tao} == set(JETONS_TAO)
    sans = replace(h, tao=tuple(t for t in h.tao if t.cle != "fangbang"))
    assert any("0 lignes pour fangbang" in f for f in fautes_sources(sans))


def test_une_phrase_ne_porte_que_ses_jetons() -> None:
    h = charger()
    faux = tuple(replace(t, fr=t.fr + " {minutes}") if t.cle == "essayer" else t for t in h.tao)
    assert any("jeton inconnu : minutes" in f for f in fautes_sources(replace(h, tao=faux)))


# ---------------------------------------------------------------------------- pinyin


def test_chaque_titre_se_lit_dans_son_pinyin() -> None:
    h = charger()
    lues = {"启": ["qǐ"], "蒙": ["méng", "měng"], "玉": ["yù"], "兔": ["tù"]}
    petit = replace(h, rangs=h.rangs[:1], betes=h.betes[:1])
    assert fautes_pinyin(petit, lues) == []
    faux = replace(petit, rangs=(replace(h.rangs[0], pinyin="qǐmèng"),))
    assert fautes_pinyin(faux, lues) == ["rangs.tsv:" + str(h.rangs[0].numero) + " : « 启蒙 » ne se lit pas « qǐmèng »"]


# ----------------------------------------------------------------------------- export


def test_les_titres_se_dessinent_depuis_leurs_traits() -> None:
    dessines = caracteres_dessines(charger())
    assert "状" in dessines and "元" in dessines and "启" in dessines
    assert dessines == sorted(set(dessines))


def test_le_document_dit_les_rangs_les_betes_et_tao() -> None:
    doc = document("0.9.0", racines={"启": "口"}, en_tete={"version": "0.9.0"})
    assert doc["version"] == "0.9.0"
    rangs = doc["rangs"]
    assert [r["seuil"] for r in rangs] == SEUILS  # type: ignore[index, union-attr]
    assert rangs[4] == {  # type: ignore[index]
        "hz": "秀才",
        "pinyin": "xiùcai",
        "fr": "talent éclos",
        "role": "reçu à l'examen du district",
        "age": "ado",
        "seuil": 80,
    }
    assert [b["id"] for b in doc["betes"]] == list(BETES_ATTENDUES)  # type: ignore[union-attr, index]
    assert doc["betes"][1]["noms"] == ["Bao", "宝宝", "Bambou"]  # type: ignore[index]
    assert set(doc["tao"]) == set(JETONS_TAO)  # type: ignore[arg-type]
    assert doc["racines"] == {"启": "口"}


def test_l_export_se_controle_contre_les_sources() -> None:
    h = charger()
    racines = {c: c for c in caracteres_dessines(h)}
    doc = document("0.9.0", racines=racines)
    assert fautes_export(doc, h) == []
    mauvais = json.loads(json.dumps(doc))
    mauvais["rangs"][3]["seuil"] = 5
    mauvais["betes"] = mauvais["betes"][:2]
    del mauvais["tao"]["sommet"]
    del mauvais["racines"]["状"]
    fautes = fautes_export(mauvais, h)
    assert any("rangs exportés" in f for f in fautes)
    assert any("non croissants" in f for f in fautes)
    assert any("bêtes exportées" in f for f in fautes)
    assert any("Tao exportées" in f for f in fautes)
    assert any("sans racine : 状" in f for f in fautes)


def test_l_export_ecrit_heros_json_avec_son_en_tete(atelier: Path) -> None:  # noqa: F811
    rapport = export_mod.export("0.2.0")
    assert "heros.json" in rapport.fichiers
    doc = lire(rapport.dossier, "heros.json")
    assert export_mod.fautes_de_licence("heros.json", doc) == []
    assert doc["source"] == heros_mod.SOURCE_EXPORT
    assert lire(rapport.dossier, "index.json")["heros"] == "heros.json"


def test_changer_un_rang_rend_l_export_perime(
    atelier: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch  # noqa: F811
) -> None:
    export_mod.export("0.2.0")
    copie = tmp_path / "rangs.tsv"
    copie.write_text(heros_mod.RANGS.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    monkeypatch.setattr(heros_mod, "RANGS", copie)
    a_jour = next(c for c in export_mod.controles() if c.nom == "export : à jour")
    assert not a_jour.ok


# ------------------------------------------------------------------ export versionné


VERSIONNE = export_mod.EXPORT / export_mod.VERSION
versionne = pytest.mark.skipif(not (VERSIONNE / "heros.json").exists(), reason="heros.json pas encore exporté")


@versionne
def test_l_export_versionne_passe_les_controles_du_personnage(tmp_path: Path) -> None:
    """Sans ingest (la CI n'en a pas), le pinyin ne se lit pas ; le reste si."""
    resultats = controles(ingest=tmp_path / "sans-ingest")
    assert [c.nom for c in resultats if not c.ok] == []


@versionne
def test_l_export_versionne_porte_les_douze_rangs_et_leurs_traits() -> None:
    doc = json.loads((VERSIONNE / "heros.json").read_text(encoding="utf-8"))
    assert [r["seuil"] for r in doc["rangs"]] == SEUILS
    for r in doc["rangs"]:
        for c in r["hz"]:
            assert c in doc["racines"], c
            assert (VERSIONNE / "traits" / f"{export_mod.nom_fichier(doc['racines'][c])}.json").exists(), c
