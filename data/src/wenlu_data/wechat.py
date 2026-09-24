"""Le message WeChat (story 4b.7) : sources, export, contrôles.

Un ami, toujours le même, écrit un court message en chinois ; on choisit la bonne
réponse parmi trois ou quatre répliques, toutes écrites avec l'acquis. Les dialogues
sont courts, de deux à quatre échanges, et chacun est rattaché à une famille par son
caractère clé, et à un jour de chaque parcours : celui où tous ses caractères sont
posés. Trois sources versionnées dans `data/sources/wechat/`, rédigées pour l'app et à
relire, lues par `wenlu export`, qui en tire `wechat.json` :

- `ami.tsv` : l'ami qui écrit, un nom et une ligne ;
- `dialogues.tsv` : chaque dialogue, son caractère clé et son titre ;
- `echanges.tsv` : les messages de l'ami, la bonne réplique et les mauvaises, chacune
  avec ce qui cloche (`hors-sujet`, `contresens`).

Règle de lecture : chaque caractère d'un dialogue, les mauvaises répliques comprises
(on les lit pour les écarter), est dans le périmètre exporté et posé par un parcours.
L'app ne propose un dialogue que lorsque tous ses caractères (`caracteres`) sont acquis ;
l'export les liste, et le jour du parcours où le dialogue devient possible (`jours`).

Ce qui se note : une bonne réplique note ses caractères (`notes`), une fois par
dialogue — un caractère déjà noté par une réplique précédente ne l'est pas deux fois.
Une mauvaise réplique ne note rien (décision du propriétaire pour les jeux de sens).

Chaque texte porte aussi le pinyin de chacun de ses caractères (`syllabes`), aligné
dans le pipeline sur les lectures d'Unihan et des surcharges : l'app le montre quand on
touche un caractère d'une bulle, sans rien découper elle-même.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Sequence

import typer

from .cuisine import Texte, hanzi, jour_possible, jours_par_parcours
from .fetes import lire_tsv
from .gf0014 import Controle
from .paths import BUILD, DATA, EXPORT, INGEST

DOSSIER = DATA / "sources" / "wechat"
AMI = DOSSIER / "ami.tsv"
DIALOGUES = DOSSIER / "dialogues.tsv"
ECHANGES = DOSSIER / "echanges.tsv"

#: De quarante à soixante dialogues, qui couvrent les deux parcours.
OBJECTIF_MIN = 40
OBJECTIF_MAX = 60

#: Un dialogue court : de deux à quatre échanges.
ECHANGES_MIN = 2
ECHANGES_MAX = 4

#: Trois ou quatre répliques : une bonne, deux ou trois mauvaises.
FAUX_MIN = 2
FAUX_MAX = 3

#: Ce qui cloche dans une mauvaise réplique : elle parle d'autre chose, ou lit mal le message.
ERREURS = ("hors-sujet", "contresens")

#: Les rôles d'une ligne d'échange : le message de l'ami, les répliques, le mot de la fin.
ROLES = ("ami", "juste", "faux", "fin")

#: Dès la deuxième semaine (brief §9), selon l'acquis : chaque parcours a un dialogue
#: possible avant ce jour. Le jour de parcours est celui où les caractères sont posés ;
#: ils sont acquis une à deux semaines plus tard.
PREMIER_JOUR_MAX = 30

SOURCE_EXPORT = (
    "data/sources/wechat/ : l'ami, les dialogues et les répliques rédigés pour l'app"
    " (à relire) ; mauvaises répliques écrites à la main"
)


# ---------------------------------------------------------------------------- lecture


@dataclass(frozen=True)
class Dialogue:
    id: str
    cle: str
    fr: str
    en: str
    source: str
    numero: int = 0


@dataclass(frozen=True)
class LigneEchange:
    """Une ligne de `echanges.tsv` : un message de l'ami, une réplique, ou le mot de la fin."""

    dialogue: str
    role: str
    texte: Texte
    erreur: str
    numero: int = 0


@dataclass(frozen=True)
class Echange:
    """Un message de l'ami et ses répliques : la bonne d'abord, puis les mauvaises."""

    ami: LigneEchange
    juste: LigneEchange | None
    faux: tuple[LigneEchange, ...]


@dataclass(frozen=True)
class Ami:
    texte: Texte
    source: str
    numero: int = 0


@dataclass(frozen=True)
class Wechat:
    """Les trois sources, et les fautes de forme des fichiers."""

    ami: tuple[Ami, ...]
    dialogues: tuple[Dialogue, ...]
    lignes: tuple[LigneEchange, ...]
    forme: tuple[str, ...] = field(default=())

    def lignes_de(self, dialogue: str) -> list[LigneEchange]:
        return [l for l in self.lignes if l.dialogue == dialogue]


def _texte(cellules: Mapping[str, str]) -> Texte:
    return Texte(
        zh=cellules.get("zh", ""),
        pinyin=cellules.get("pinyin", ""),
        fr=cellules.get("fr", ""),
        en=cellules.get("en", ""),
    )


def charger(dossier: Path | None = None) -> Wechat:
    """Les trois sources de `data/sources/wechat/`, dans l'ordre des fichiers."""
    d = dossier or DOSSIER
    l_ami, f_ami = lire_tsv(d / AMI.name)
    l_dia, f_dia = lire_tsv(d / DIALOGUES.name)
    l_ech, f_ech = lire_tsv(d / ECHANGES.name)
    return Wechat(
        ami=tuple(
            Ami(texte=_texte(l.cellules), source=l.cellules.get("source", ""), numero=l.numero) for l in l_ami
        ),
        dialogues=tuple(
            Dialogue(
                id=l.cellules.get("id", ""),
                cle=l.cellules.get("cle", ""),
                fr=l.cellules.get("fr", ""),
                en=l.cellules.get("en", ""),
                source=l.cellules.get("source", ""),
                numero=l.numero,
            )
            for l in l_dia
        ),
        lignes=tuple(
            LigneEchange(
                dialogue=l.cellules.get("dialogue", ""),
                role=l.cellules.get("role", ""),
                texte=_texte(l.cellules),
                erreur=l.cellules.get("erreur", ""),
                numero=l.numero,
            )
            for l in l_ech
        ),
        forme=tuple(f_ami + f_dia + f_ech),
    )


def structure(lignes: Sequence[LigneEchange]) -> tuple[list[Echange], LigneEchange | None, list[str]]:
    """Les échanges d'un dialogue, son mot de la fin, et ce qui cloche dans leur ordre.

    Un échange s'ouvre sur un message de l'ami ; ses répliques le suivent. Le mot de la
    fin, s'il y en a un, est la dernière ligne.
    """
    echanges: list[Echange] = []
    fin: LigneEchange | None = None
    fautes: list[str] = []
    ami: LigneEchange | None = None
    justes: list[LigneEchange] = []
    faux: list[LigneEchange] = []

    def fermer() -> None:
        if ami is None:
            return
        if len(justes) != 1:
            fautes.append(f"echanges.tsv:{ami.numero} : {len(justes)} bonnes répliques, attendu une")
        echanges.append(Echange(ami=ami, juste=justes[0] if justes else None, faux=tuple(faux)))

    for l in lignes:
        if fin is not None:
            fautes.append(f"echanges.tsv:{l.numero} : une ligne après le mot de la fin")
            continue
        if l.role == "ami":
            fermer()
            ami, justes, faux = l, [], []
        elif l.role in ("juste", "faux"):
            if ami is None:
                fautes.append(f"echanges.tsv:{l.numero} : une réplique avant tout message de l'ami")
                continue
            (justes if l.role == "juste" else faux).append(l)
        elif l.role == "fin":
            fermer()
            ami = None
            fin = l
        else:
            fautes.append(f"echanges.tsv:{l.numero} : rôle inconnu {l.role!r}")
    if fin is None:
        fermer()
    return echanges, fin, fautes


# ------------------------------------------------------------------ ce qui se lit, ce qui se note


def caracteres_de(lignes: Sequence[LigneEchange]) -> list[str]:
    """Les caractères qu'il faut avoir acquis pour lire un dialogue : tous, répliques comprises.

    Dans l'ordre de première apparition. Les mauvaises répliques en sont : on les lit pour
    les écarter, elles sont écrites avec l'acquis comme le reste.
    """
    return list(dict.fromkeys(c for l in lignes for c in hanzi(l.texte.zh)))


def notes(echanges: Sequence[Echange]) -> list[list[str]]:
    """Les caractères que chaque bonne réplique note : les siens, sauf ceux déjà notés avant."""
    vus: set[str] = set()
    out: list[list[str]] = []
    for e in echanges:
        propres = list(dict.fromkeys(hanzi(e.juste.texte.zh))) if e.juste else []
        out.append([c for c in propres if c not in vus])
        vus.update(propres)
    return out


def textes_chinois(wechat: Wechat) -> list[tuple[str, Texte]]:
    """Tous les textes chinois des sources, avec l'endroit d'où ils viennent."""
    out: list[tuple[str, Texte]] = [(f"ami.tsv:{a.numero}", a.texte) for a in wechat.ami]
    out += [(f"echanges.tsv:{l.numero}", l.texte) for l in wechat.lignes]
    return out


def caracteres_ecrits(wechat: Wechat) -> list[str]:
    """Tous les caractères que le jeu écrit, triés : le nom de l'ami et les dialogues."""
    return sorted({c for _, t in textes_chinois(wechat) for c in hanzi(t.zh)})


def lectures_export(ingest: Path | None = None) -> dict[str, tuple[str, ...]]:
    """Les lectures dont l'export tire le pinyin par caractère : Unihan, puis les surcharges.

    Deux sources que l'empreinte de l'export couvre déjà. Vide sans `wenlu ingest`.
    """
    from .surcharges import charger_pinyin

    ingest = ingest or INGEST
    table: dict[str, set[str]] = {}
    chemin = ingest / "unihan.json"
    if chemin.exists():
        for e in json.loads(chemin.read_text(encoding="utf-8")).get("caracteres") or ():
            lues = [str(x) for x in e.get("lectures") or ()]
            if e.get("pinyin"):
                lues.append(str(e["pinyin"]))
            table.setdefault(str(e["c"]), set()).update(lues)
    for c, lues_s in charger_pinyin().items():
        table.setdefault(c, set()).update(lues_s)
    return {c: tuple(sorted(v)) for c, v in table.items()}


def syllabes(t: Texte, lues: Mapping[str, Sequence[str]]) -> list[str]:
    """Le pinyin de chaque caractère du texte, dans l'ordre ; vide s'il ne s'aligne pas."""
    from .pinyin import aligner

    return aligner(t.zh, t.pinyin, lues) or []


# ---------------------------------------------------------------------------- export


def _texte_json(t: Texte, lues: Mapping[str, Sequence[str]]) -> dict[str, object]:
    return {**t.en_json(), "syllabes": syllabes(t, lues)}


def _repliques_json(e: Echange, lues: Mapping[str, Sequence[str]]) -> list[dict[str, object]]:
    """Les répliques d'un échange, la bonne d'abord ; l'app les mélange."""
    justes = [{**_texte_json(e.juste.texte, lues), "juste": True}] if e.juste else []
    return justes + [{**_texte_json(f.texte, lues), "juste": False, "erreur": f.erreur} for f in e.faux]


def document(
    version: str,
    *,
    parcours: Mapping[str, Mapping[str, object]],
    racines: Mapping[str, str],
    lues: Mapping[str, Sequence[str]],
    en_tete: Mapping[str, object] | None = None,
    dossier: Path | None = None,
) -> dict[str, object]:
    """Le JSON écrit dans `wechat.json`.

    `ami` : qui écrit. Chaque dialogue porte son caractère clé et sa famille, son titre,
    ses échanges — le message de l'ami, les répliques (la bonne d'abord, `juste`, puis
    les mauvaises avec leur `erreur`), les caractères que la bonne note —, le mot de la
    fin, les caractères à avoir acquis et, par parcours, le jour où il devient possible
    (`null` si le parcours n'y mène pas). Chaque texte porte le pinyin de chacun de ses
    caractères (`syllabes`). `racines` donne la famille de chaque caractère écrit, pour
    que l'app trouve ses traits.
    """
    wechat = charger(dossier)
    par_parcours = jours_par_parcours(parcours)
    dialogues: list[dict[str, object]] = []
    for d in wechat.dialogues:
        lignes = wechat.lignes_de(d.id)
        echanges, fin, _ = structure(lignes)
        caracteres = caracteres_de(lignes)
        a_noter = notes(echanges)
        dialogues.append(
            {
                "id": d.id,
                "cle": d.cle,
                "famille": racines.get(d.cle, ""),
                "fr": d.fr,
                "en": d.en,
                "echanges": [
                    {
                        "ami": _texte_json(e.ami.texte, lues),
                        "repliques": _repliques_json(e, lues),
                        "notes": n,
                    }
                    for e, n in zip(echanges, a_noter)
                ],
                "fin": _texte_json(fin.texte, lues) if fin else None,
                "caracteres": caracteres,
                "jours": {nom: jour_possible(caracteres, j) for nom, j in par_parcours.items()},
            }
        )
    ecrits = caracteres_ecrits(wechat)
    ami = wechat.ami[0].texte.en_json() if wechat.ami else {"zh": "", "pinyin": "", "fr": "", "en": ""}
    return {
        **(en_tete or {}),
        "ami": ami,
        "dialogues": dialogues,
        "racines": {c: racines[c] for c in ecrits if c in racines},
    }


# ------------------------------------------------------------------------- contrôles


def _complet(t: Texte) -> bool:
    return all((t.zh, t.pinyin, t.fr, t.en))


def fautes_sources(wechat: Wechat) -> list[str]:
    """Ce qui cloche dans les sources : champs, doublons, clés, forme des échanges, répliques."""
    fautes = list(wechat.forme)
    if len(wechat.ami) != 1:
        fautes.append(f"ami.tsv : {len(wechat.ami)} lignes, attendu une")
    for a in wechat.ami:
        if not (_complet(a.texte) and a.source):
            fautes.append(f"ami.tsv:{a.numero} : ami incomplet")
    ids = [d.id for d in wechat.dialogues]
    if not OBJECTIF_MIN <= len(ids) <= OBJECTIF_MAX:
        fautes.append(f"{len(ids)} dialogues, de {OBJECTIF_MIN} à {OBJECTIF_MAX} attendus")
    vus: set[str] = set()
    for d in wechat.dialogues:
        ou = f"dialogues.tsv:{d.numero}"
        if not d.id:
            fautes.append(f"{ou} : dialogue sans id")
        if d.id in vus:
            fautes.append(f"{ou} : {d.id} en double")
        vus.add(d.id)
        for champ, valeur in (("fr", d.fr), ("en", d.en), ("source", d.source)):
            if not valeur:
                fautes.append(f"{ou} : {d.id} sans {champ}")
        lignes = wechat.lignes_de(d.id)
        if len(hanzi(d.cle)) != 1 or d.cle != "".join(hanzi(d.cle)):
            fautes.append(f"{ou} : {d.id} a pour clé {d.cle!r}, attendu un caractère")
        elif d.cle not in caracteres_de(lignes):
            fautes.append(f"{ou} : la clé {d.cle} n'est pas écrite dans {d.id}")
        echanges, _, f_ordre = structure(lignes)
        fautes += f_ordre
        if not ECHANGES_MIN <= len(echanges) <= ECHANGES_MAX:
            fautes.append(f"{ou} : {d.id} a {len(echanges)} échanges, de {ECHANGES_MIN} à {ECHANGES_MAX}")
        for e in echanges:
            ici = f"echanges.tsv:{e.ami.numero}"
            if not FAUX_MIN <= len(e.faux) <= FAUX_MAX:
                fautes.append(f"{ici} : {len(e.faux)} mauvaises répliques, de {FAUX_MIN} à {FAUX_MAX}")
            repliques = ([e.juste] if e.juste else []) + list(e.faux)
            textes = [r.texte.zh for r in repliques]
            if len(set(textes)) != len(textes):
                fautes.append(f"{ici} : deux répliques identiques")
            sens = [r.texte.fr for r in repliques]
            if len(set(sens)) != len(sens):
                fautes.append(f"{ici} : deux répliques de même sens")
    for l in wechat.lignes:
        ici = f"echanges.tsv:{l.numero}"
        if l.dialogue not in vus:
            fautes.append(f"{ici} : dialogue inconnu {l.dialogue!r}")
        if l.role not in ROLES:
            continue
        if not _complet(l.texte):
            fautes.append(f"{ici} : texte incomplet")
        if not hanzi(l.texte.zh):
            fautes.append(f"{ici} : aucun caractère chinois")
        if l.role == "faux" and l.erreur not in ERREURS:
            fautes.append(f"{ici} : erreur {l.erreur!r}, attendu {' ou '.join(ERREURS)}")
        if l.role != "faux" and l.erreur:
            fautes.append(f"{ici} : une ligne {l.role} ne dit pas d'erreur")
    return fautes


def fautes_pinyin(wechat: Wechat, lues: Mapping[str, Sequence[str]]) -> list[str]:
    """Chaque texte chinois se lit, caractère par caractère, dans son pinyin."""
    from .pinyin import aligner

    return [
        f"{ou} : « {t.zh} » ne se lit pas « {t.pinyin} »"
        for ou, t in textes_chinois(wechat)
        if t.zh and aligner(t.zh, t.pinyin, lues) is None
    ]


def _parcours(build: Path) -> dict[str, dict[str, object]]:
    return {
        chemin.stem.removeprefix("parcours-"): json.loads(chemin.read_text(encoding="utf-8"))
        for chemin in sorted(build.glob("parcours-*.json"))
    }


def fautes_parcours(wechat: Wechat, parcours: Mapping[str, Mapping[str, object]]) -> list[str]:
    """Chaque caractère est posé par un parcours ; chaque dialogue est possible dans l'un
    d'eux ; chaque parcours ouvre un dialogue avant `PREMIER_JOUR_MAX`."""
    par_parcours = jours_par_parcours(parcours)
    if not par_parcours:
        return []
    enseignes = {c for j in par_parcours.values() for c in j}
    fautes = [f"{c} hors parcours" for c in caracteres_ecrits(wechat) if c not in enseignes]
    premiers: dict[str, int] = {}
    for d in wechat.dialogues:
        caracteres = caracteres_de(wechat.lignes_de(d.id))
        jours = {nom: jour_possible(caracteres, j) for nom, j in par_parcours.items()}
        if all(j is None for j in jours.values()):
            fautes.append(f"{d.id} : possible dans aucun parcours")
        for nom, j in jours.items():
            if j is not None:
                premiers[nom] = min(premiers.get(nom, j), j)
    for nom in sorted(par_parcours):
        premier = premiers.get(nom)
        if premier is None or premier > PREMIER_JOUR_MAX:
            fautes.append(f"parcours {nom} : premier dialogue au jour {premier}, attendu avant {PREMIER_JOUR_MAX}")
    return fautes


def fautes_export(sorties: Sequence[Mapping[str, object]], wechat: Wechat) -> list[str]:
    """L'export dit ce que les sources disent : chaque dialogue, ses caractères, ses notes, ses syllabes."""
    fautes: list[str] = []
    attendus = {d.id: d for d in wechat.dialogues}
    exportes = [str(s.get("id")) for s in sorties]
    manquants = [x for x in attendus if x not in exportes]
    if manquants:
        fautes.append(f"non exportés : {' '.join(manquants)}")
    for s in sorties:
        did = str(s.get("id"))
        if did not in attendus:
            fautes.append(f"{did} : dialogue inconnu des sources")
            continue
        if list(s.get("caracteres") or ()) != caracteres_de(wechat.lignes_de(did)):  # type: ignore[call-overload]
            fautes.append(f"{did} : caractères à acquérir incomplets")
        textes: list[Mapping[str, object]] = []
        deja: set[str] = set()
        for e in s.get("echanges") or ():  # type: ignore[union-attr]
            repliques = list(e.get("repliques") or ())
            justes = [r for r in repliques if r.get("juste") is True]
            if len(justes) != 1:
                fautes.append(f"{did} : {len(justes)} bonnes répliques dans un échange")
                continue
            ns = [str(c) for c in e.get("notes") or ()]
            if any(c not in hanzi(str(justes[0].get("zh"))) or c in deja for c in ns):
                fautes.append(f"{did} : notes {''.join(ns)} hors de la bonne réplique ou déjà notées")
            deja.update(ns)
            textes += [e.get("ami") or {}, *repliques]
        if s.get("fin"):
            textes.append(s["fin"])  # type: ignore[arg-type]
        for t in textes:
            if len(list(t.get("syllabes") or ())) != len(hanzi(str(t.get("zh") or ""))):  # type: ignore[call-overload]
                fautes.append(f"{did} : « {t.get('zh')} » sans pinyin par caractère")
    return fautes


def controles(
    destination: Path | None = None,
    *,
    build: Path | None = None,
    ingest: Path | None = None,
    dossier: Path | None = None,
) -> list[Controle]:
    """Contrôles du message WeChat, pour `wenlu check`. Tous bloquants.

    « sources » : l'ami, de 40 à 60 dialogues sourcés, une clé écrite dans chacun, de
    deux à quatre échanges, une bonne réplique et deux ou trois mauvaises par échange,
    chacune avec son erreur, jamais deux répliques pareilles. « pinyin » : chaque texte se
    lit dans son pinyin. « périmètre » : chaque caractère écrit a ses traits dans l'export.
    « parcours » : chaque caractère est posé par un parcours, chaque dialogue possible dans
    l'un d'eux, et chaque parcours en ouvre un dès ses premières semaines. « export » :
    `wechat.json` dit tous les dialogues, leurs caractères, des notes prises dans la bonne
    réplique, et le pinyin de chaque caractère.
    """
    from .cuisine import lectures
    from .export import versions_exportees
    from .fetes import traits_exportes

    build = build or BUILD
    wechat = charger(dossier)
    f_src = fautes_sources(wechat)
    lues = lectures(ingest)
    f_pin = fautes_pinyin(wechat, lues) if lues is not None else []
    f_par = fautes_parcours(wechat, _parcours(build))
    ecrits = caracteres_ecrits(wechat)

    dossiers = versions_exportees(destination or EXPORT)
    f_per: list[str] = []
    f_exp: list[str] = []
    exportes = 0
    for d in dossiers:
        presents = traits_exportes(d)
        f_per += [f"{d.name}:{c} sans traits" for c in ecrits if c not in presents]
        chemin = d / "wechat.json"
        if not chemin.exists():
            f_exp.append(f"{d.name} : wechat.json absent, lancer `wenlu export`")
            continue
        sorties = json.loads(chemin.read_text(encoding="utf-8")).get("dialogues") or []
        exportes = max(exportes, len(sorties))
        f_exp += [f"{d.name}:{f}" for f in fautes_export(sorties, wechat)]

    def detail(fautes: list[str], ok: str) -> str:
        return ok if not fautes else f"{len(fautes)} écarts — " + " ; ".join(fautes[:5])

    sans_export = "aucun export écrit : lancer `wenlu export`"
    repliques = sum(1 for l in wechat.lignes if l.role in ("juste", "faux"))
    return [
        Controle(
            "wechat : sources",
            not f_src,
            detail(
                f_src,
                f"{len(wechat.dialogues)} dialogues rédigés pour l'app (à relire, objectif {OBJECTIF_MIN} à"
                f" {OBJECTIF_MAX}), {repliques} répliques, chaque mauvaise avec son erreur",
            ),
            bloquant=True,
        ),
        Controle(
            "wechat : pinyin",
            not f_pin,
            detail(f_pin, "chaque message et chaque réplique se lit dans son pinyin")
            if lues is not None
            else "lectures absentes : lancer `wenlu ingest`",
            bloquant=True,
        ),
        Controle(
            "wechat : périmètre",
            not f_per,
            detail(f_per, f"{len(ecrits)} caractères écrits, tous dans les traits exportés")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
        Controle(
            "wechat : parcours",
            not f_par,
            detail(
                f_par,
                f"chaque caractère est posé par un parcours ; chacun ouvre un dialogue avant le jour {PREMIER_JOUR_MAX}",
            ),
            bloquant=True,
        ),
        Controle(
            "wechat : export",
            not f_exp,
            detail(f_exp, f"{exportes} dialogues exportés, caractères, notes et pinyin par caractère conformes")
            if dossiers
            else sans_export,
            bloquant=True,
        ),
    ]


# -------------------------------------------------------------------------- commande


app = typer.Typer(help="Le message WeChat : relecture des dialogues.")


@app.command("apercu")
def commande_apercu(version: str = typer.Option("0.1.0", help="Version exportée à relire.")) -> None:
    """Affiche chaque dialogue exporté : messages, bonne réplique, mauvaises et leur erreur. Exige `export`."""
    chemin = EXPORT / version / "wechat.json"
    if not chemin.exists():
        typer.echo(f"{chemin} absent : lancer `wenlu export`.", err=True)
        raise typer.Exit(code=1)
    doc = json.loads(chemin.read_text(encoding="utf-8"))
    ami = doc.get("ami") or {}
    typer.echo(f"L'ami : {ami.get('zh', '')} {ami.get('pinyin', '')}, {ami.get('fr', '')}.")
    for d in doc["dialogues"]:
        jours = " ".join(f"{nom} {jour if jour is not None else '—'}" for nom, jour in d["jours"].items())
        typer.echo(f"\n{d['id']} · {d['fr']} · clé {d['cle']} (famille {d['famille'] or '?'}) · {jours}")
        for e in d["echanges"]:
            a = e["ami"]
            typer.echo(f"  {ami.get('zh', '')} : {a['zh']}  {a['pinyin']}  « {a['fr']} »")
            for r in e["repliques"]:
                marque = "✓" if r["juste"] else f"✗ {r['erreur']}"
                typer.echo(f"    {marque} {r['zh']}  {r['pinyin']}  « {r['fr']} »")
            typer.echo(f"    note {''.join(e['notes']) or '—'}")
        if d.get("fin"):
            typer.echo(f"  {ami.get('zh', '')} : {d['fin']['zh']}  « {d['fin']['fr']} »")
    typer.echo(f"\n{len(doc['dialogues'])} dialogues.")
