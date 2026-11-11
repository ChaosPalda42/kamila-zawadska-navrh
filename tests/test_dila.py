"""Acceptance test C-001 -- `src/lib/dila.mjs` (works, states, visibility)."""
from __future__ import annotations

import pathlib

import pytest

from tests.jsmod import run_js

WORKS = [
    {"slug": "a-prodej", "nazev": {"cs": "Alfa"}, "technika": "olej", "styl": "krajina",
     "album": "x", "rok": 2026, "cena": 1000, "stav": "v-prodeji", "vGalerii": True, "vEshopu": True},
    {"slug": "b-zamluveno", "nazev": {"cs": "Beta"}, "technika": "olej", "styl": "zatisi",
     "album": "x", "rok": 2026, "cena": 500, "stav": "zamluveno", "vGalerii": True, "vEshopu": True},
    {"slug": "c-prodano", "nazev": {"cs": "Cé"}, "technika": "akryl", "styl": "krajina",
     "album": "y", "rok": 2024, "cena": 700, "stav": "prodano", "vGalerii": True, "vEshopu": True},
    {"slug": "d-neprodejne", "nazev": {"cs": "Dé"}, "technika": "kresba", "styl": "portret",
     "album": "y", "rok": 2024, "cena": 0, "stav": "neprodejne", "vGalerii": True, "vEshopu": False},
    {"slug": "e-jen-eshop", "nazev": {"cs": "Éf"}, "technika": "kresba", "styl": "",
     "album": "", "rok": 2026, "cena": 300, "stav": "v-prodeji", "vGalerii": False, "vEshopu": True},
]


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("dila.mjs", body, args={"d": WORKS, **args})
    return call


def test_stavy_jsou_prave_ctyri(js):
    assert js("out(m.STAVY);") == ["v-prodeji", "zamluveno", "prodano", "neprodejne"]
    assert js("out(Object.isFrozen(m.STAVY));") is True
    assert js('out(m.jeStav("v-prodeji"));') is True
    assert js('out(m.jeStav("rezervovano"));') is False
    assert js("out(m.jeStav(undefined));") is False


def test_slug(js):
    assert js('out(m.slug("Ráno nad Vltavou"));') == "rano-nad-vltavou"
    assert js('out(m.slug("Horizont I"));') == "horizont-i"
    assert js('out(m.slug("  Les po dešti  "));') == "les-po-desti"
    assert js('out(m.slug("Zátiší & hrnky"));') == "zatisi-hrnky"
    assert js('out(m.slug("Studie — draperie"));') == "studie-draperie"
    assert js('out(m.slug("ŽLUŤOUČKÝ kůň"));') == "zlutoucky-kun"
    assert js("out(m.slug(2026));") == ""
    assert js('out(m.slug(""));') == ""


def test_v_galerii_jen_pri_tvrdem_true(js):
    assert js("out(m.vGalerii(A.d[0]));") is True
    assert js("out(m.vGalerii(A.d[4]));") is False
    assert js("out(m.vGalerii({}));") is False
    assert js('out(m.vGalerii({ vGalerii: "ano" }));') is False
    assert js("out(m.vGalerii({ vGalerii: 1 }));") is False


def test_prodane_a_neprodejne_nikdy_nejsou_v_eshopu(js):
    assert js("out(A.d.filter(m.vEshopu).map(x => x.slug));") == ["a-prodej", "b-zamluveno", "e-jen-eshop"]
    assert js('out(m.vEshopu({ vEshopu: true, stav: "prodano" }));') is False
    assert js('out(m.vEshopu({ vEshopu: true, stav: "neprodejne" }));') is False
    assert js('out(m.vEshopu({ vEshopu: false, stav: "v-prodeji" }));') is False


def test_zamluvene_je_videt_ale_nekoupi_se(js):
    assert js("out(A.d.filter(m.lzeKoupit).map(x => x.slug));") == ["a-prodej", "e-jen-eshop"]
    assert js("out(m.lzeKoupit(A.d[1]));") is False, "zamluveno se koupit nedá"
    assert js('out(m.lzeKoupit({ vEshopu: true, stav: "v-prodeji", cena: 0 }));') is False
    assert js('out(m.lzeKoupit({ vEshopu: true, stav: "v-prodeji", cena: "1000" }));') is True


def test_na_miru_nabidneme_u_vseho_co_se_neda_koupit(js):
    assert js("out(A.d.filter(m.naMiru).map(x => x.slug));") == [
        "b-zamluveno", "c-prodano", "d-neprodejne",
    ]
    assert js("out(m.naMiru(A.d[0]));") is False, "co se dá koupit, na míru nenabízíme"
    assert js("out(m.naMiru(A.d[4]));") is False, "co není v galerii, nemá kde nabízet"


def test_galerie_radi_od_nejnovejsiho(js):
    assert js("out(m.galerie(A.d).map(x => x.slug));") == [
        "a-prodej", "b-zamluveno", "c-prodano", "d-neprodejne",
    ]
    assert js("""
        const pred = JSON.stringify(A.d);
        m.galerie(A.d);
        out(JSON.stringify(A.d) === pred);
    """) is True
    assert js('out(m.galerie([{slug:"s",nazev:{cs:"Šeřík"},rok:2026,vGalerii:true},'
              '{slug:"r",nazev:{cs:"Rez"},rok:2026,vGalerii:true}]).map(x => x.slug));') == ["r", "s"]
    assert js('out(m.galerie([{slug:"bez-nazvu",rok:2026,vGalerii:true}]).length);') == 1


def test_eshop_radi_podle_ceny(js):
    assert js("out(m.eshop(A.d).map(x => x.slug));") == ["e-jen-eshop", "b-zamluveno", "a-prodej"]
    assert js("""
        const pred = JSON.stringify(A.d);
        m.eshop(A.d);
        out(JSON.stringify(A.d) === pred);
    """) is True


def test_filtr(js):
    assert js('out(m.filtr(A.d, { technika: "olej" }).map(x => x.slug));') == ["a-prodej", "b-zamluveno"]
    assert js('out(m.filtr(A.d, { technika: "olej", styl: "zatisi" }).map(x => x.slug));') == ["b-zamluveno"]
    assert js('out(m.filtr(A.d, { album: "y" }).map(x => x.slug));') == ["c-prodano", "d-neprodejne"]
    assert js('out(m.filtr(A.d, { technika: "vse" }).length);') == 5
    assert js('out(m.filtr(A.d, { technika: "" }).length);') == 5
    assert js("out(m.filtr(A.d, {}).length);") == 5
    assert js("out(m.filtr(A.d, undefined).length);") == 5
    assert js('out(m.filtr(A.d, { technika: "neni" }));') == []
    assert js("""
        const vysledek = m.filtr(A.d, {});
        out(vysledek !== A.d);
    """) is True


def test_podle_slugu_a_sousedi(js):
    assert js('out(m.podleSlugu(A.d, "c-prodano").nazev.cs);') == "Cé"
    assert js('out(m.podleSlugu(A.d, "neni"));') is None
    assert js('out(m.sousedi(A.d, "b-zamluveno").predchozi.slug);') == "a-prodej"
    assert js('out(m.sousedi(A.d, "b-zamluveno").dalsi.slug);') == "c-prodano"
    assert js('out(m.sousedi(A.d, "a-prodej").predchozi.slug);') == "e-jen-eshop", "dokola"
    assert js('out(m.sousedi(A.d, "e-jen-eshop").dalsi.slug);') == "a-prodej", "dokola"
    assert js('out(m.sousedi(A.d, "neni"));') == {"predchozi": None, "dalsi": None}
    assert js('out(m.sousedi([A.d[0]], "a-prodej"));') == {"predchozi": None, "dalsi": None}


def test_pocty(js):
    assert js('out(m.pocty(A.d, "technika"));') == {"vse": 5, "olej": 2, "akryl": 1, "kresba": 2}
    assert js('out(m.pocty(A.d, "styl"));') == {"vse": 5, "krajina": 2, "zatisi": 1, "portret": 1}
    assert js('out(m.pocty(A.d, "album"));') == {"vse": 5, "x": 2, "y": 2}
    assert js('out(m.pocty(A.d, "neznamy"));') == {"vse": 5}
    assert js('out(m.pocty([], "technika"));') == {"vse": 0}


def test_cena(js):
    assert js("out(m.cena({ cena: 42000 }));") == 42000
    assert js('out(m.cena({ cena: "42000" }));') == 42000
    assert js("out(m.cena({}));") == 0
    assert js("out(m.cena({ cena: -5 }));") == 0
    assert js('out(m.cena({ cena: "nic" }));') == 0
    assert js("out(m.cena({ cena: 1999.6 }));") == 1999


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "src/lib/dila.mjs"
    assert czech_lines(path, allowed=PUBLIC_API[path]) == []


def test_conversion_only_renamed():
    """The translation renamed things and did nothing else.

    Measured against the file as it stood before the conversion, at the tag
    `pred-prevodem`. Strings, numbers, punctuation, keywords and the order of
    statements all have to survive; reaching a key of the data through a
    string instead of a dot counts as a change, and so does dropping a pair
    of parentheses. Reformatting is not translating.
    """
    from tests.public_api import PUBLIC_API
    from tests.struktura import rename_only, text_at_tag

    path = "src/lib/dila.mjs"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
