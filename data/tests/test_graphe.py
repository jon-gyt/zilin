"""Graphe de dépendances et ordre d'apprentissage : un test par règle. Aucun réseau.

Le graphe des tests est en dur et minuscule, pour que la règle testée se lise
sans ouvrir les 9 574 caractères du dictionnaire. Il imite la sortie de la
story 1.2 : une entrée de `decompositions.json` par caractère, `composants`
réduits au caractère lui-même quand c'est un composant de la norme.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from wenlu_data.export import VERSION
from wenlu_data.paths import EXPORT
from wenlu_data.graphe import (
    BRIQUE,
    CARACTERE,
    DEPART,
    MUETTE,
    PARCOURS,
    CycleDetecte,
    DepartImpossible,
    Graphe,
    Jour,
    OrdreInvalide,
    Parcours,
    construire,
    controles,
    build,
    cycles,
    charger_ordre,
    document_graphe,
    ecrire_ordre,
    figer,
    lire_ordre,
    ordre_topologique,
    parcours,
    parcours_fige,
    rangs_frequence,
)


def entree(c: str, *composants: str, reconcilie: bool = True) -> dict[str, object]:
    """Une entrée de `decompositions.json`. Sans composant, le caractère est une feuille."""
    return {
        "c": c,
        "composants": list(composants) or [c],
        "structure": "".join(composants) or c,
        "reconcilie": reconcilie,
        "inconnus": [] if reconcilie else ["？"],
        "cycle": [],
    }


# 木 日 月 十 口 亻 手 sont des composants de la norme : des briques.
# ⺊ n'est pas un caractère du dictionnaire : une brique muette.
CARACTERES: list[dict[str, object]] = [
    entree("木"),
    entree("日"),
    entree("月"),
    entree("十"),
    entree("口"),
    entree("亻"),
    entree("手"),
    entree("林", "木", "木"),
    entree("森", "木", "木", "木"),
    entree("休", "亻", "木"),
    entree("明", "日", "月"),
    entree("古", "十", "口"),
    entree("困", "口", "木"),
    entree("看", reconcilie=False),
    entree("卡", "⺊", "十"),
]


def graphe() -> Graphe:
    return construire(CARACTERES)


# ---------------------------------------------------------------------------- graphe


def test_brique_est_une_feuille() -> None:
    """Un composant de la norme présent au dictionnaire est une brique sans prérequis."""
    g = graphe()
    assert g["木"].genre == BRIQUE
    assert g["木"].prerequis == ()
    assert g["木"].fiche


def test_caractere_depend_de_ses_composants_canoniques() -> None:
    """休 dépend de 亻 et 木, dans l'ordre d'écriture ; l'arête va du composant au caractère."""
    g = graphe()
    assert g["休"].genre == CARACTERE
    assert g["休"].prerequis == ("亻", "木")
    assert ("亻", "休") in g.aretes and ("木", "休") in g.aretes


def test_composant_repete_ne_compte_qu_une_arete() -> None:
    """森 est trois fois 木 : une seule dépendance, donc une seule arête."""
    g = graphe()
    assert g["森"].prerequis == ("木",)
    assert [a for a in g.aretes if a[1] == "森"] == [("木", "森")]


def test_feuille_hors_dictionnaire_est_une_brique_muette() -> None:
    """⺊ n'a pas de fiche : feuille muette, jamais enseignée."""
    g = graphe()
    assert g["⺊"].genre == MUETTE
    assert not g["⺊"].fiche
    assert g.par_genre(MUETTE) == ("⺊",)


def test_caractere_non_reconcilie_reste_un_caractere() -> None:
    """看 n'est pas réconcilié : ce n'est pas une brique, même s'il en a l'air."""
    g = graphe()
    assert g["看"].genre == CARACTERE
    assert not g["看"].reconcilie


# ------------------------------------------------------------------------------ tri


def test_tri_topologique_pose_la_brique_avant_ce_qui_la_contient() -> None:
    """Règle produit : une brique avant tout ce qui la contient."""
    g = graphe()
    ordre = ordre_topologique(g)
    rang = {c: i for i, c in enumerate(ordre)}
    assert len(ordre) == len(g)
    for prerequis, dependant in g.aretes:
        assert rang[prerequis] < rang[dependant]


def test_aucun_cycle_sur_une_decomposition_saine() -> None:
    """La décomposition canonique est un arbre fini : aucun cycle attendu."""
    assert cycles(graphe()) == []


def test_cycle_detecte() -> None:
    """Deux caractères qui se contiennent l'un l'autre : cycle listé, tri impossible."""
    g = construire([entree("甲", "乙"), entree("乙", "甲")])
    boucles = cycles(g)
    assert boucles and set(boucles[0]) == {"甲", "乙"}
    with pytest.raises(CycleDetecte):
        ordre_topologique(g)


# -------------------------------------------------------------------------- familles


def test_racine_est_la_premiere_brique_dans_l_ordre_d_ecriture() -> None:
    """Critère documenté : la racine de 休 est 亻, sa première brique."""
    g = graphe()
    assert g.racine("休") == "亻"
    assert g.racine("明") == "日"
    assert g.racine("木") == "木"


def test_famille_est_une_racine_et_tout_ce_qu_elle_engendre() -> None:
    """La famille de 木 réunit 林 et 森 ; 休 revient à 亻, sa première brique."""
    familles = {f.racine: f for f in graphe().familles()}
    assert familles["木"].membres == ("林", "森")
    assert familles["亻"].membres == ("休",)
    assert familles["木"].genre == BRIQUE
    assert "休" not in familles["木"].membres


def test_chaque_noeud_appartient_a_une_seule_famille() -> None:
    g = graphe()
    membres = [c for f in g.familles() for c in f.membres] + [f.racine for f in g.familles()]
    assert sorted(membres) == sorted(g.noeuds)


# -------------------------------------------------------------------------- parcours


def test_priorite_aux_caracteres_de_la_liste_cible() -> None:
    """古 attend 十 et 口 ; 口 est dans la liste, il passe d'abord."""
    p = parcours(graphe(), ["口", "古"])
    assert p.jours[0].brique == "口"
    assert p.jours[1].brique == "十"


def test_puis_priorite_a_la_frequence() -> None:
    """休 attend 亻 et 木, aucun dans la liste : 木, dont dépendent 4 caractères, passe d'abord."""
    g = graphe()
    assert len(g.dependants["木"]) > len(g.dependants["亻"])
    p = parcours(g, ["休"])
    assert [j.brique for j in p.jours] == ["木", "亻"]
    assert p.jours[1].composes == ("休",)


def test_un_jour_une_brique_puis_un_ou_deux_composes() -> None:
    """Une seule brique nouvelle par session de 10 minutes, un ou deux composés."""
    g = graphe()
    p = parcours(g, ["林", "森", "休", "明", "古", "困"])
    acquis: set[str] = set(p.muettes)
    for jour in p.jours:
        assert len(jour.composes) <= 2
        if jour.brique is not None:
            assert g[jour.brique].genre == BRIQUE
            acquis.add(jour.brique)
        for compose in jour.composes:
            assert g[compose].genre != BRIQUE
            assert set(g[compose].prerequis) <= acquis
            acquis.add(compose)
    assert {"林", "森", "休", "明", "古", "困"} <= set(p.caracteres)


def test_aucun_caractere_de_la_liste_n_est_oublie() -> None:
    cible = ["林", "森", "休", "明", "古", "困", "看", "卡"]
    p = parcours(graphe(), cible)
    assert set(cible) <= set(p.caracteres)


def test_non_reconcilies_en_fin_de_parcours_avec_marqueur() -> None:
    """看 n'est pas réconcilié : il ferme le parcours, marqué, jamais oublié."""
    p = parcours(graphe(), ["看", "林"])
    assert p.non_reconcilies == ("看",)
    assert p.jours[-1].non_reconcilie and p.jours[-1].composes == ("看",)
    assert not any(j.non_reconcilie for j in p.jours[:-1])
    assert "看" in p.caracteres


def test_brique_muette_ne_prend_pas_de_jour_et_est_signalee() -> None:
    """⺊ n'a pas de fiche : acquis d'entrée, signalé, jamais brique du jour."""
    p = parcours(graphe(), ["卡"])
    assert p.muettes == ("⺊",)
    assert [j.brique for j in p.jours] == ["十"]
    assert p.jours[0].composes == ("卡",)


def test_le_depart_ouvre_le_parcours_un_jour_par_caractere() -> None:
    """La première session d'abord : un caractère par jour, dans l'ordre, sans composé.

    Sans départ, 日 ouvre le parcours et 明 vient avec 月 au jour 2. Avec le départ
    亻 puis 月, ces deux-là prennent les deux premiers jours, seuls ; 明 et 休, qui
    en dépendent, n'arrivent qu'ensuite, chacun avec sa dernière brique.
    """
    g = graphe()
    cible = ["林", "明", "休", "日", "月"]
    assert parcours(g, cible).jours[0].brique == "日"

    p = parcours(g, cible, depart=("亻", "月"))
    assert p.depart == ("亻", "月")
    assert [(j.brique, j.composes) for j in p.jours[:2]] == [("亻", ()), ("月", ())]
    assert [j.jour for j in p.jours] == list(range(1, len(p.jours) + 1))
    # Une brique nouvelle par jour, ensuite comme avant ; rien n'est posé deux fois.
    assert all(j.brique is None or g[j.brique].genre == BRIQUE for j in p.jours)
    assert len(p.caracteres) == len(set(p.caracteres))
    assert p.jours[2].brique == "日" and "明" in p.jours[2].composes
    assert set(cible) <= set(p.caracteres)


def test_le_depart_respecte_les_dependances() -> None:
    """Un caractère du départ doit être lisible à son tour, et à apprendre."""
    g = graphe()
    with pytest.raises(DepartImpossible, match="il manque 日 月"):
        parcours(g, ["明"], depart=("明",))
    with pytest.raises(DepartImpossible, match="pas à apprendre"):
        parcours(g, ["林"], depart=("日",))
    p = parcours(g, ["明"], depart=("日", "月", "明"))
    assert [j.caracteres for j in p.jours] == [("日",), ("月",), ("明",)]


def test_chaque_parcours_commence_par_la_premiere_session() -> None:
    """Le départ de « lire » comme de « hsk » est ce que l'app enseigne à la première session."""
    assert DEPART["lire"] == ("人", "大", "天")
    assert DEPART["hsk"] == ("人", "大", "天")
    assert set(DEPART) == set(PARCOURS)


@pytest.mark.parametrize("nom", ["lire", "hsk"])
def test_l_export_versionne_commence_par_la_premiere_session(nom: str) -> None:
    """Jours 1 à 3 de l'index exporté : 人, 大, 天, seuls. Le jour 4 reprend l'ordre du graphe."""
    index = EXPORT / VERSION / "index.json"
    if not index.exists():
        pytest.skip("aucun export versionné")
    jours = json.loads(index.read_text(encoding="utf-8"))["parcours"][nom]["jours"]
    assert [(j["jour"], j["brique"], j["composes"]) for j in jours[:3]] == [
        (1, "人", []),
        (2, "大", []),
        (3, "天", []),
    ]
    assert jours[3]["brique"] not in ("人", "大", "天")
    vus = [c for j in jours for c in ([j["brique"]] if j["brique"] else []) + j["composes"]]
    assert len(vus) == len(set(vus))


def test_rang_de_frequence_ingere_prend_le_pas() -> None:
    """Make Me a Hanzi n'en fournit pas ; s'il en arrive un, il gouverne l'ordre."""
    assert rangs_frequence([{"c": "木"}, {"c": "亻"}]) == {}
    rangs = {"亻": 1, "木": 2}
    p = parcours(graphe(), ["休"], rangs=rangs)
    assert [j.brique for j in p.jours] == ["亻", "木"]


# ----------------------------------------------------------------- build et contrôles


def _preparer(tmp_path: Path, caracteres: list[dict[str, object]], cible: list[str]) -> tuple[Path, Path]:
    build_dir = tmp_path / "build"
    ingest_dir = tmp_path / "ingest"
    build_dir.mkdir()
    ingest_dir.mkdir()
    (build_dir / "decompositions.json").write_text(
        json.dumps({"caracteres": caracteres}, ensure_ascii=False), encoding="utf-8"
    )
    (ingest_dir / "listes.json").write_text(
        json.dumps({"seuil-255": cible, "hsk-1": cible}, ensure_ascii=False), encoding="utf-8"
    )
    return build_dir, ingest_dir


def test_build_ecrit_graphe_et_parcours(tmp_path: Path) -> None:
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["林", "古", "看"])
    rapport = build(sortie=build_dir, ingest=ingest_dir, depart={})

    graphe_json = json.loads((build_dir / "graphe.json").read_text(encoding="utf-8"))
    assert graphe_json["compte"]["noeuds"] == rapport["noeuds"]
    assert graphe_json["cycles"] == []
    assert ["木", "林"] in graphe_json["aretes"]

    for nom in ("lire", "hsk"):
        p = json.loads((build_dir / f"parcours-{nom}.json").read_text(encoding="utf-8"))
        assert p["cible"] == ["林", "古", "看"]
        assert p["non_reconcilies"] == ["看"]
        assert p["jours"][-1]["non_reconcilie"]


def test_controle_cycles_bloquant(tmp_path: Path) -> None:
    build_dir, ingest_dir = _preparer(tmp_path, [entree("甲", "乙"), entree("乙", "甲")], ["甲"])
    graphe_avec_cycle = document_graphe(construire([entree("甲", "乙"), entree("乙", "甲")]), [("甲", "乙", "甲")])
    (build_dir / "graphe.json").write_text(
        json.dumps(graphe_avec_cycle, ensure_ascii=False), encoding="utf-8"
    )
    controle = next(c for c in controles(sortie=build_dir) if c.nom == "cycles du graphe")
    assert not controle.ok and controle.bloquant


def test_controle_caractere_de_liste_absent_du_parcours_bloquant(tmp_path: Path) -> None:
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["林", "古"])
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    chemin = build_dir / "parcours-lire.json"
    document = json.loads(chemin.read_text(encoding="utf-8"))
    document["jours"] = [j for j in document["jours"] if "古" not in j["composes"]]
    chemin.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")

    controle = next(
        c for c in controles(sortie=build_dir) if c.nom == "caractères de liste absents du parcours"
    )
    assert not controle.ok and controle.bloquant and "古" in controle.detail


def test_controle_briques_muettes_signale_sans_bloquer(tmp_path: Path) -> None:
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["卡"])
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    controle = next(c for c in controles(sortie=build_dir) if c.nom == "briques muettes")
    assert not controle.ok and not controle.bloquant and "⺊" in controle.detail


def test_controles_passent_sur_un_graphe_sain(tmp_path: Path) -> None:
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["林", "古"])
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    figer(sortie=build_dir)
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    assert all(c.ok for c in controles(sortie=build_dir))


# ----------------------------------------------------------------------- ordre figé


def test_ordre_fige_s_ecrit_et_se_relit_a_l_identique() -> None:
    """Le fichier d'ordre rend les mêmes jours que ceux qu'on y a écrits."""
    p = parcours(graphe(), ["林", "古", "看"], depart=())
    assert tuple(lire_ordre(ecrire_ordre(p).splitlines())) == p.jours


def test_build_suit_l_ordre_fige_et_non_le_calcul(tmp_path: Path) -> None:
    """Règle : une fois figé, l'ordre ne se recalcule plus ; le build le lit tel quel."""
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["林", "古"])
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    figer(sortie=build_dir)
    # Un ordre valide, mais pas celui que le calcul choisirait : 十 et 古 d'abord.
    jours = [Jour(1, "十"), Jour(2, "口", ("古",)), Jour(3, "木", ("林",))]
    (tmp_path / "sans-ordres" / "ordre-lire.tsv").write_text(
        ecrire_ordre(Parcours(nom="lire", liste="seuil-255", jours=tuple(jours))),
        encoding="utf-8",
    )
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    lu = json.loads((build_dir / "parcours-lire.json").read_text(encoding="utf-8"))
    assert [j["brique"] for j in lu["jours"]] == ["十", "口", "木"]
    assert lu["ordre"].startswith("figé")
    assert charger_ordre("lire") == jours


def test_ordre_fige_refuse_un_compose_avant_ses_briques() -> None:
    """Règle : un caractère n'entre que si toutes ses briques sont posées."""
    jours = [Jour(1, "十", ("古",)), Jour(2, "口"), Jour(3, "木", ("林",))]
    with pytest.raises(OrdreInvalide, match="古 posé avant 口"):
        parcours_fige(graphe(), ["林", "古"], jours)


def test_ordre_fige_refuse_un_caractere_oublie_ou_qui_n_est_plus_a_apprendre() -> None:
    """Une décomposition changée se voit : le build refuse au lieu de déplacer un jour."""
    oublie = [Jour(1, "木", ("林",))]
    with pytest.raises(OrdreInvalide, match="jamais posés : 古"):
        parcours_fige(graphe(), ["林", "古"], oublie)
    en_trop = [Jour(1, "木", ("林",)), Jour(2, "月")]
    with pytest.raises(OrdreInvalide, match="月 n'est plus à apprendre"):
        parcours_fige(graphe(), ["林"], en_trop)


def test_ordre_fige_refuse_deux_briques_le_meme_jour_ou_une_brique_en_compose() -> None:
    """Règle produit : une seule brique nouvelle par session."""
    jours = [Jour(1, "木", ("十",)), Jour(2, "口", ("古", "林"))]
    with pytest.raises(OrdreInvalide, match="十 est une brique"):
        parcours_fige(graphe(), ["林", "古"], jours)


def test_controle_signale_un_parcours_non_fige(tmp_path: Path) -> None:
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["林", "古"])
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    fige = next(c for c in controles(sortie=build_dir) if c.nom == "parcours figés")
    assert not fige.ok and fige.bloquant


def test_les_ordres_figes_du_depot_tiennent_contre_l_export() -> None:
    """Les parcours d'`index.json` sont ceux des fichiers figés, jour pour jour."""
    index = EXPORT / VERSION / "index.json"
    if not index.exists():
        pytest.skip("export absent")
    from wenlu_data.graphe import ORDRES_REELS

    document = json.loads(index.read_text(encoding="utf-8"))
    for nom in PARCOURS:
        fige = charger_ordre(nom, ORDRES_REELS)
        assert fige is not None, nom
        exporte = [
            Jour(j["jour"], j["brique"], tuple(j["composes"]), j["non_reconcilie"])
            for j in document["parcours"][nom]["jours"]
        ]
        assert exporte == fige, nom


def test_build_ecrit_les_briques_muettes_dans_ecarts(tmp_path: Path) -> None:
    """`ecarts.md` dit quelles feuilles sont muettes et qui en dépend."""
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["卡"])
    (build_dir / "ecarts.md").write_text("# Écarts\n\ntête\n", encoding="utf-8")
    build(sortie=build_dir, ingest=ingest_dir, depart={})

    ecarts = (build_dir / "ecarts.md").read_text(encoding="utf-8")
    assert "tête" in ecarts, "la section s'ajoute au rapport de gf0014, elle ne le remplace pas"
    assert "## Briques muettes" in ecarts
    assert "| `⺊` | U+2E8A | 卡 |" in ecarts

    build(sortie=build_dir, ingest=ingest_dir, depart={})
    assert (build_dir / "ecarts.md").read_text(encoding="utf-8").count("## Briques muettes") == 1


def test_les_feuilles_muettes_sortent_triees(tmp_path: Path) -> None:
    """`graphe.json` doit être le même à contenu égal, quel que soit le grain de hachage.

    Les feuilles muettes sont ajoutées après coup à partir d'un ensemble : sans
    tri, leur ordre suit le hachage du processus et le fichier bouge sans raison.
    """
    caracteres = [entree("卡", "⺊", "卜"), entree("旦", "日", "⺀"), entree("卜"), entree("日")]
    document = document_graphe(construire(caracteres), [])
    ordre = [n["c"] for n in document["noeuds"]]  # type: ignore[index, union-attr]
    muettes = ordre[-2:]
    assert set(muettes) == {"⺀", "⺊"}
    assert muettes == sorted(muettes), "les muettes ferment la liste, dans l'ordre des formes"

    # Et le fichier écrit ne bouge pas d'un passage à l'autre.
    build_dir, ingest_dir = _preparer(tmp_path, caracteres, ["卡"])
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    premier = (build_dir / "graphe.json").read_text(encoding="utf-8")
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    assert (build_dir / "graphe.json").read_text(encoding="utf-8") == premier


# ------------------------------------------------------------------ étapes et suite


def test_les_deux_chemins_suivent_le_hsk_jusqu_au_bout() -> None:
    """Décision du propriétaire du 30 septembre 2026 : après le seuil 255 ou le HSK 1, le
    HSK 3.0 niveau par niveau jusqu'au HSK 7-9 ; la première liste est le chemin gratuit."""
    from wenlu_data.graphe import ETAPES, LISTES_HSK

    assert LISTES_HSK == ("hsk-1", "hsk-2", "hsk-3", "hsk-4", "hsk-5", "hsk-6", "hsk-7-9")
    assert ETAPES["lire"] == ("seuil-255", *LISTES_HSK)
    assert ETAPES["hsk"] == LISTES_HSK
    assert PARCOURS == {"lire": "seuil-255", "hsk": "hsk-1"}


def test_une_etape_se_termine_avant_la_suivante() -> None:
    """林 est de la première liste, 明 de la seconde : 林 d'abord, même si 明 est prêt plus tôt."""
    p = parcours(graphe(), (), etapes=[("a", ["林"]), ("b", ["明"])])
    jour_de = {c: j.jour for j in p.jours for c in j.caracteres}
    assert jour_de["林"] < jour_de["日"] < jour_de["明"]
    assert [(e.liste, e.fin) for e in p.etapes] == [("a", jour_de["林"]), ("b", jour_de["明"])]
    assert p.gratuit == jour_de["林"]


def test_une_liste_n_apporte_que_ce_qui_n_est_pas_encore_pose() -> None:
    """Le HSK 1 sur le chemin Lire : ce que le seuil a déjà posé n'y revient pas."""
    p = parcours(graphe(), (), etapes=[("seuil", ["林", "古"]), ("hsk", ["古", "明"])])
    poses = [c for j in p.jours for c in j.caracteres]
    assert poses.count("古") == 1 and "明" in poses


def test_chaque_etape_se_ferme_par_ses_non_reconcilies() -> None:
    """看 est de la première liste : il la ferme, avant la suite, au lieu d'attendre le bout."""
    p = parcours(graphe(), (), etapes=[("a", ["林", "看"]), ("b", ["明"])])
    fermes = [j for j in p.jours if j.non_reconcilie]
    assert [j.composes for j in fermes] == [("看",)]
    assert fermes[0].jour == p.etapes[0].fin + 1
    assert p.jours[-1].composes == ("明",)


def test_prolonger_garde_les_jours_figes_jour_pour_jour() -> None:
    """Un ordre prolongé commence par l'ordre figé, jours de fermeture compris, à l'identique."""
    g = graphe()
    fige = parcours(g, ["林", "看"]).jours
    etapes = [("a", ["林", "看"]), ("b", ["明", "古"])]
    p = parcours(g, (), etapes=etapes, prefixe=fige)
    assert p.jours[: len(fige)] == fige
    assert {"明", "古"} <= set(p.caracteres)
    assert parcours_fige(g, (), p.jours, etapes=etapes).jours == p.jours


def test_ordre_fige_refuse_une_etape_commencee_avant_la_fin_de_la_precedente() -> None:
    """明 (seconde liste) avant 林 (première) : l'étape redescend, l'ordre est refusé."""
    jours = [Jour(1, "日"), Jour(2, "月", ("明",)), Jour(3, "木", ("林",))]
    with pytest.raises(OrdreInvalide, match="revient après"):
        parcours_fige(graphe(), (), jours, etapes=[("a", ["林"]), ("b", ["明"])])


def test_un_composant_d_une_liste_plus_loin_peut_venir_plus_tot() -> None:
    """林 (seconde liste) est un composant de 檪 (première) : posé avant lui, il reste permis."""
    graphe_ = construire([*CARACTERES, entree("檪", "林", "木")])
    jours = [Jour(1, "木", ("林", "檪"))]
    p = parcours_fige(graphe_, (), jours, etapes=[("a", ["檪"]), ("b", ["林"])])
    assert p.etapes[0].fin == 1 and p.etapes[1].fin == 1


def test_le_document_du_parcours_dit_ses_etapes_et_le_bout_du_gratuit(tmp_path: Path) -> None:
    """`parcours-<nom>.json` : `cible` reste la liste du chemin gratuit ; `etapes` et `gratuit`."""
    build_dir, ingest_dir = _preparer(tmp_path, CARACTERES, ["林", "古"])
    (ingest_dir / "listes.json").write_text(
        json.dumps({"seuil-255": ["林"], "hsk-1": ["林", "古"], "hsk-2": ["明"]}, ensure_ascii=False),
        encoding="utf-8",
    )
    build(sortie=build_dir, ingest=ingest_dir, depart={})
    lire = json.loads((build_dir / "parcours-lire.json").read_text(encoding="utf-8"))
    assert lire["cible"] == ["林"]
    assert [e["liste"] for e in lire["etapes"]] == ["seuil-255", "hsk-1", "hsk-2"]
    assert lire["gratuit"] == lire["etapes"][0]["fin"]
    hsk = json.loads((build_dir / "parcours-hsk.json").read_text(encoding="utf-8"))
    assert [e["liste"] for e in hsk["etapes"]] == ["hsk-1", "hsk-2"]
    absents = next(c for c in controles(sortie=build_dir) if c.nom == "caractères de liste absents du parcours")
    assert absents.ok
