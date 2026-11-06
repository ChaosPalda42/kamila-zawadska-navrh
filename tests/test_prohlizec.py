"""Akceptační test C-008 — src/lib/prohlizec.mjs (celá obrazovka)."""
from __future__ import annotations

import pytest

from tests.jsmod import run_js

SLUGY = ["most", "sova", "horizont-i", "velka-vlna"]


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("prohlizec.mjs", body, args={"s": SLUGY, **args})
    return call


def test_zaloz(js):
    assert js('out(m.zaloz(A.s, "horizont-i"));') == {
        "slugy": SLUGY, "index": 2, "otevreno": False,
    }
    assert js('out(m.zaloz(A.s, "neni").index);') == 0
    assert js("out(m.zaloz([], \"x\"));") == {"slugy": [], "index": 0, "otevreno": False}
    assert js('out(m.zaloz(undefined, "x"));') == {"slugy": [], "index": 0, "otevreno": False}
    assert js('out(m.zaloz("most", "most"));') == {"slugy": [], "index": 0, "otevreno": False}
    assert js("""
        const stav = m.zaloz(A.s, "most");
        stav.slugy.push("x");
        out(A.s.length);
    """) == 4, "pole se kopíruje"


def test_otevri_a_zavri(js):
    assert js('out(m.otevri(m.zaloz(A.s, "most"), "sova"));') == {
        "slugy": SLUGY, "index": 1, "otevreno": True,
    }
    assert js('out(m.otevri(m.zaloz(A.s, "most"), "neni").otevreno);') is False
    assert js('out(m.otevri(m.zaloz([], ""), "x").otevreno);') is False
    assert js('out(m.zavri(m.otevri(m.zaloz(A.s, "most"), "sova")));') == {
        "slugy": SLUGY, "index": 1, "otevreno": False,
    }


def test_dalsi_a_predchozi_dokola(js):
    assert js('out(m.dalsi(m.zaloz(A.s, "most")).index);') == 1
    assert js('out(m.dalsi(m.zaloz(A.s, "velka-vlna")).index);') == 0, "dokola na začátek"
    assert js('out(m.predchozi(m.zaloz(A.s, "most")).index);') == 3, "dokola na konec"
    assert js('out(m.predchozi(m.zaloz(A.s, "sova")).index);') == 0
    assert js('out(m.dalsi(m.otevri(m.zaloz(A.s, "most"), "most")).otevreno);') is True
    assert js('out(m.dalsi(m.zaloz([], "")).index);') == 0
    assert js('out(m.predchozi(m.zaloz([], "")).index);') == 0
    assert js("""
        const stav = m.zaloz(A.s, "most");
        m.dalsi(stav);
        out(stav.index);
    """) == 0, "vstupní stav se nemění"


def test_skoc(js):
    assert js('out(m.skoc(m.zaloz(A.s, "most"), 2).index);') == 2
    assert js('out(m.skoc(m.zaloz(A.s, "most"), 4).index);') == 0, "dokola"
    assert js('out(m.skoc(m.zaloz(A.s, "most"), 9).index);') == 1
    assert js('out(m.skoc(m.zaloz(A.s, "most"), -1).index);') == 3, "negativní taky dokola"
    assert js('out(m.skoc(m.zaloz(A.s, "most"), -5).index);') == 3
    assert js('out(m.skoc(m.zaloz(A.s, "sova"), 1.5).index);') == 1, "neceločíselný vstup nic nemění"
    assert js('out(m.skoc(m.zaloz(A.s, "sova"), "2").index);') == 1
    assert js('out(m.skoc(m.zaloz([], ""), 3).index);') == 0


def test_aktualni_a_okoli(js):
    assert js('out(m.aktualni(m.zaloz(A.s, "horizont-i")));') == "horizont-i"
    assert js('out(m.aktualni(m.zaloz([], "")));') is None
    assert js('out(m.okoli(m.zaloz(A.s, "sova")));') == {"predchozi": "most", "dalsi": "horizont-i"}
    assert js('out(m.okoli(m.zaloz(A.s, "most")));') == {"predchozi": "velka-vlna", "dalsi": "sova"}
    assert js('out(m.okoli(m.zaloz(["jen-jeden"], "jen-jeden")));') == {
        "predchozi": "jen-jeden", "dalsi": "jen-jeden",
    }
    assert js('out(m.okoli(m.zaloz([], "")));') == {"predchozi": None, "dalsi": None}


@pytest.mark.parametrize("kod,ceka", [
    ("ArrowRight", "dalsi"), ("ArrowDown", "dalsi"), ("PageDown", "dalsi"),
    (" ", "dalsi"), ("n", "dalsi"), ("N", "dalsi"),
    ("ArrowLeft", "predchozi"), ("ArrowUp", "predchozi"), ("PageUp", "predchozi"),
    ("p", "predchozi"), ("P", "predchozi"),
    ("Escape", "zavri"),
    ("Enter", ""), ("Tab", ""), ("a", ""), ("", ""), ("escape", ""),
])
def test_klavesa(js, kod, ceka):
    assert js("out(m.klavesa(A.k));", k=kod) == ceka, kod


def test_klavesa_na_jinych_typech(js):
    assert js("out(m.klavesa(undefined));") == ""
    assert js("out(m.klavesa(39));") == ""


def test_pozice(js):
    assert js('out(m.pozice(m.zaloz(A.s, "horizont-i")));') == {"cislo": 3, "celkem": 4}
    assert js('out(m.pozice(m.zaloz(A.s, "most")));') == {"cislo": 1, "celkem": 4}
    assert js('out(m.pozice(m.zaloz([], "")));') == {"cislo": 0, "celkem": 0}
