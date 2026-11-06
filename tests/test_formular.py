"""Akceptační test C-006 — src/lib/formular.mjs (kontakt a dílo na míru)."""
from __future__ import annotations

import pytest

from tests.jsmod import run_js

ZPRAVA = "Dobrý den, zaujal mě obraz Sova, je ještě k mání?"


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("formular.mjs", body, args=args)
    return call


def test_duvody(js):
    assert js("out(m.DUVODY);") == ["dotaz", "na-miru", "kurz", "atelier"]
    assert js("out(Object.isFrozen(m.DUVODY));") is True


@pytest.mark.parametrize("vstup,ceka", [
    ("kamila@example.com", True),
    ("k.zawadska@seznam.cz", True),
    ("info@art-studio.co.uk", True),
    ("kamila@example", False),
    ("kamila @example.com", False),
    ("", False),
])
def test_email(js, vstup, ceka):
    assert js("out(m.platnyEmail(A.v));", v=vstup) is ceka, vstup


def test_plny_formular_projde(js):
    assert js("""out(m.zkontroluj({
        jmeno: "Jan Novák", email: "jan@example.com", telefon: "",
        zprava: A.z, duvod: "dotaz", kDilu: "",
    }));""", z=ZPRAVA) == []


def test_chyby_v_danem_poradi(js):
    assert js("out(m.zkontroluj({}));") == ["jmeno", "email", "zprava"]
    assert js('out(m.zkontroluj({ jmeno: "J", email: "x", zprava: "krátká" }));') == [
        "jmeno", "email", "zprava",
    ]
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", zprava: A.z, '
              'telefon: "nemam" }));', z=ZPRAVA) == ["telefon"]


def test_telefon_je_tu_nepovinny(js):
    for prazdny in ['""', '"   "', "undefined"]:
        assert js(f'out(m.zkontroluj({{ jmeno: "Jan Novák", email: "jan@example.com", '
                  f'zprava: A.z, telefon: {prazdny} }}));', z=ZPRAVA) == [], prazdny


@pytest.mark.parametrize("vstup", ["721365343", "721 365 343", "+420 721 365 343",
                                   "+420 721 365 343", "721-365-343", "00420721365343"])
def test_vyplneny_telefon_se_bere_jak_ho_lidi_pisou(js, vstup):
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", '
              'zprava: A.z, telefon: A.v }));', z=ZPRAVA, v=vstup) == [], vstup


def test_zprava_musi_mit_aspon_deset_znaku(js):
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", '
              'zprava: "123456789" }));') == ["zprava"]
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", '
              'zprava: "1234567890" }));') == []
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", '
              'zprava: "          " }));') == ["zprava"], "mezery se nepočítají"


def test_neznamy_duvod_neni_chyba(js):
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", '
              'zprava: A.z, duvod: "vymysleno" }));', z=ZPRAVA) == []


def test_ocisti(js):
    assert js("""out(m.ocisti({
        jmeno: "  Jan   Novák ", email: " jan@example.com ", telefon: "+420 721-365 343",
        zprava: "  Dvě   mezery  ", duvod: "vymysleno", kDilu: " sova ",
    }));""") == {
        "jmeno": "Jan Novák", "email": "jan@example.com", "telefon": "+420721365343",
        "zprava": "Dvě mezery", "duvod": "dotaz", "kDilu": "sova",
    }
    assert js('out(m.ocisti({ jmeno: "JAN NOVÁK" }).jmeno);') == "JAN NOVÁK", "velikost písmen zůstává"
    assert js("out(Object.keys(m.ocisti({})).sort());") == [
        "duvod", "email", "jmeno", "kDilu", "telefon", "zprava",
    ]
    assert js('out(m.ocisti({ duvod: "na-miru" }).duvod);') == "na-miru"


def test_predmet(js):
    assert js('out(m.predmet({ duvod: "dotaz", kDilu: "" }, "cs"));') == "Dotaz z webu"
    assert js('out(m.predmet({ duvod: "na-miru", kDilu: "" }, "cs"));') == "Poptávka díla na míru"
    assert js('out(m.predmet({ duvod: "kurz", kDilu: "" }, "cs"));') == "Zájem o kurz"
    assert js('out(m.predmet({ duvod: "atelier", kDilu: "" }, "cs"));') == "Návštěva ateliéru"
    assert js('out(m.predmet({ duvod: "dotaz", kDilu: "" }, "en"));') == "Website enquiry"
    assert js('out(m.predmet({ duvod: "na-miru", kDilu: "" }, "en"));') == "Commission enquiry"
    assert js('out(m.predmet({ duvod: "kurz", kDilu: "" }, "en"));') == "Course enquiry"
    assert js('out(m.predmet({ duvod: "atelier", kDilu: "" }, "en"));') == "Studio visit"
    assert js('out(m.predmet({ duvod: "na-miru", kDilu: "sova" }, "cs"));') == "Poptávka díla na míru — sova"
    assert js('out(m.predmet({ duvod: "na-miru", kDilu: "sova" }, "en"));') == "Commission enquiry — sova"
    assert js('out(m.predmet({ duvod: "vymysleno", kDilu: "" }, "cs"));') == "Dotaz z webu"
    assert js('out(m.predmet({ duvod: "dotaz", kDilu: "" }, "sk"));') == "Dotaz z webu"


def test_prazdny_predvyplni_poptavku_na_miru(js):
    assert js('out(m.prazdny("na-miru", "sova"));') == {
        "jmeno": "", "email": "", "telefon": "", "zprava": "", "duvod": "na-miru", "kDilu": "sova",
    }
    assert js("out(m.prazdny());") == {
        "jmeno": "", "email": "", "telefon": "", "zprava": "", "duvod": "dotaz", "kDilu": "",
    }
    assert js('out(m.prazdny("vymysleno", undefined).duvod);') == "dotaz"
