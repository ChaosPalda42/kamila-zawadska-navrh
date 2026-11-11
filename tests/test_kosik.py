"""Acceptance test C-002 -- `src/lib/kosik.mjs` (the basket, delivery)."""
from __future__ import annotations

import pathlib

import pytest

from tests.jsmod import run_js

WORKS = [
    {"slug": "most", "cena": 54000, "stav": "v-prodeji"},
    {"slug": "sova", "cena": 8900, "stav": "v-prodeji"},
    {"slug": "horizont-i", "cena": 36000, "stav": "zamluveno"},
    {"slug": "dve-ruce", "cena": 28000, "stav": "prodano"},
]
SHIPPING = [{"id": "dobirka", "cena": 390}, {"id": "osobne", "cena": 0}]


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("kosik.mjs", body, args={"d": WORKS, "z": SHIPPING, **args})
    return call


def test_prazdny(js):
    assert js("out(m.prazdny());") == {"polozky": [], "doprava": ""}
    assert js("out(m.pocet(m.prazdny()));") == 0
    assert js("out(m.cenaDila(m.prazdny()));") == 0


def test_pridej_a_original_jen_jednou(js):
    assert js("out(m.pridej(m.prazdny(), A.d[0]).polozky);") == [{"slug": "most", "cena": 54000}]
    assert js("""
        let k = m.pridej(m.prazdny(), A.d[0]);
        k = m.pridej(k, A.d[0]);
        out(m.pocet(k));
    """) == 1, "originál se do košíku vejde jen jednou"
    assert js("""
        let k = m.pridej(m.prazdny(), A.d[0]);
        k = m.pridej(k, A.d[1]);
        out(k.polozky.map(x => x.slug));
    """) == ["most", "sova"]


def test_pridej_odmita_co_se_koupit_neda(js):
    assert js("out(m.pocet(m.pridej(m.prazdny(), A.d[2])));") == 0, "zamluveno"
    assert js("out(m.pocet(m.pridej(m.prazdny(), A.d[3])));") == 0, "prodáno"
    assert js("out(m.pocet(m.pridej(m.prazdny(), undefined)));") == 0
    assert js('out(m.pocet(m.pridej(m.prazdny(), { slug: "", cena: 5, stav: "v-prodeji" })));') == 0
    assert js('out(m.pocet(m.pridej(m.prazdny(), { slug: "x", cena: 0, stav: "v-prodeji" })));') == 0


def test_pridej_nemeni_vstup(js):
    assert js("""
        const k = m.prazdny();
        const pred = JSON.stringify(k);
        m.pridej(k, A.d[0]);
        out(JSON.stringify(k) === pred);
    """) is True


def test_uber_a_obsahuje(js):
    assert js("""
        let k = m.pridej(m.pridej(m.prazdny(), A.d[0]), A.d[1]);
        k = m.uber(k, "most");
        out(k.polozky.map(x => x.slug));
    """) == ["sova"]
    assert js("""
        let k = m.pridej(m.prazdny(), A.d[0]);
        out(m.pocet(m.uber(k, "neni")));
    """) == 1
    assert js('out(m.obsahuje(m.pridej(m.prazdny(), A.d[0]), "most"));') is True
    assert js('out(m.obsahuje(m.prazdny(), "most"));') is False


def test_doprava(js):
    assert js('out(m.nastavDopravu(m.prazdny(), "dobirka").doprava);') == "dobirka"
    assert js('out(m.nastavDopravu(m.prazdny(), "osobne").doprava);') == "osobne"
    assert js('out(m.nastavDopravu(m.prazdny(), "dron").doprava);') == ""
    assert js("out(m.nastavDopravu(m.prazdny(), undefined).doprava);") == ""
    assert js('out(m.cenaDopravy(m.nastavDopravu(m.prazdny(), "dobirka"), A.z));') == 390
    assert js('out(m.cenaDopravy(m.nastavDopravu(m.prazdny(), "osobne"), A.z));') == 0
    assert js("out(m.cenaDopravy(m.prazdny(), A.z));") == 0


def test_soucet(js):
    assert js("""
        let k = m.pridej(m.pridej(m.prazdny(), A.d[0]), A.d[1]);
        k = m.nastavDopravu(k, "dobirka");
        out(m.soucet(k, A.z));
    """) == {"dila": 62900, "doprava": 390, "celkem": 63290, "pocet": 2}
    assert js("out(m.soucet(m.prazdny(), A.z));") == {
        "dila": 0, "doprava": 0, "celkem": 0, "pocet": 0,
    }


def test_prober_vyhodi_to_co_se_mezitim_prodalo(js):
    # three works lie in the basket; two of them have changed meanwhile
    assert js("""
        const k = { polozky: [
            { slug: "most", cena: 54000 },
            { slug: "horizont-i", cena: 36000 },
            { slug: "zmizelo", cena: 100 },
        ], doprava: "dobirka" };
        out(m.prober(k, A.d));
    """) == {
        "kosik": {"polozky": [{"slug": "most", "cena": 54000}], "doprava": "dobirka"},
        "odebrane": ["horizont-i", "zmizelo"],
    }


def test_prober_prepise_cenu_na_aktualni(js):
    assert js("""
        const k = { polozky: [{ slug: "sova", cena: 1 }], doprava: "" };
        out(m.prober(k, A.d).kosik.polozky[0].cena);
    """) == 8900


def test_prober_nemeni_vstup(js):
    assert js("""
        const k = { polozky: [{ slug: "most", cena: 1 }], doprava: "" };
        const pred = JSON.stringify(k);
        m.prober(k, A.d);
        out(JSON.stringify(k) === pred);
    """) is True


def test_na_kod_a_zpatky(js):
    assert js("""
        let k = m.pridej(m.prazdny(), A.d[0]);
        k = m.nastavDopravu(k, "osobne");
        out(m.zKodu(m.naKod(k)));
    """) == {"polozky": [{"slug": "most", "cena": 54000}], "doprava": "osobne"}


def test_z_kodu_se_nezlomi_na_smeti(js):
    for incoming in ['null', '""', '"[]"', '"{}"', '"12"', '"nic"', '"{\\"polozky\\":5}"', 'undefined']:
        assert js(f"out(m.zKodu({incoming}));") == {"polozky": [], "doprava": ""}, incoming
    assert js('out(m.zKodu(JSON.stringify({ polozky: [{ slug: "", cena: 5 }, { slug: "x" }, '
              '{ slug: "ok", cena: 10 }], doprava: "dobirka" })));') == {
        "polozky": [{"slug": "ok", "cena": 10}], "doprava": "dobirka",
    }


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "src/lib/kosik.mjs"
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

    path = "src/lib/kosik.mjs"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
