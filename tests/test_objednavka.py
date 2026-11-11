"""Acceptance test C-005 -- `src/lib/objednavka.mjs` (the order, delivery).

The phone numbers, e-mail addresses and postcodes are written the way people
really put them into forms -- with spaces, a dialling code, a dash and a
non-breaking space from copying. Tidied-up forms are deliberately absent:
C-116 in the CRM was green over ten clean vectors and had two holes on real
input.
"""
from __future__ import annotations

import pathlib

import pytest

from tests.jsmod import run_js

WORKS = [
    {"slug": "most", "nazev": {"cs": "Most", "en": "Bridge"}, "rozmer": "140 × 90 cm", "cena": 54000, "stav": "v-prodeji"},
    {"slug": "sova", "nazev": {"cs": "Sova", "en": "Owl"}, "rozmer": "40 × 30 cm", "cena": 8900, "stav": "v-prodeji"},
]
SHIPPING = [
    {"id": "dobirka", "nazev": {"cs": "Dopravce na dobírku", "en": "Courier"}, "cena": 390},
    {"id": "osobne", "nazev": {"cs": "Osobní převzetí", "en": "Pick up"}, "cena": 0},
]
PLNE = {
    "jmeno": "Kamila Zawadská", "email": "kamila@example.com", "telefon": "+420 721 365 343",
    "ulice": "Kolbenova 923/34a", "mesto": "Praha 9", "psc": "190 00",
    "zprava": "", "doprava": "dobirka",
}


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("objednavka.mjs", body, args={"d": WORKS, "z": SHIPPING, "p": PLNE, **args})
    return call


@pytest.mark.parametrize("vstup", [
    "kamila@example.com",
    "k.zawadska@seznam.cz",
    "ahoj@kamilazawadska.com",
    "info@art-studio.co.uk",
    "a@b.cz",
    "krestni.prijmeni+web@gmail.com",
])
def test_email_prijme_co_lidi_opravdu_pisou(js, vstup):
    assert js("out(m.platnyEmail(A.v));", v=vstup) is True, vstup


@pytest.mark.parametrize("vstup", [
    "kamila@example",            # no second-level domain
    "kamila(at)example.com",
    "@example.com",
    "kamila@@example.com",
    "kamila @example.com",
    "kamila@example .com",
    "kamila@example.c",          # a one-character TLD
    "kamila@example.123",        # a TLD of digits
    "",
    "   ",
])
def test_email_odmitne_co_odmitnout_ma(js, vstup):
    assert js("out(m.platnyEmail(A.v));", v=vstup) is False, vstup


def test_email_nereaguje_na_jine_typy(js):
    assert js("out(m.platnyEmail(undefined));") is False
    assert js("out(m.platnyEmail(null));") is False
    assert js("out(m.platnyEmail(12345));") is False


@pytest.mark.parametrize("vstup", [
    "721365343",
    "721 365 343",
    "+420721365343",
    "+420 721 365 343",
    "+420 721 365 343",   # non-breaking spaces from copying off a web page
    "00420721365343",
    "721-365-343",
    "(+420) 721 365 343",
])
def test_telefon_prijme_skutecne_zapisy(js, vstup):
    assert js("out(m.platnyTelefon(A.v));", v=vstup) is True, vstup


@pytest.mark.parametrize("vstup", [
    "72136534",         # eight digits
    "7213653430",       # ten digits with no dialling code
    "721 365 34a",
    "nemam",
    "",
    "+420",
])
def test_telefon_odmitne_co_dopravce_nevytoci(js, vstup):
    assert js("out(m.platnyTelefon(A.v));", v=vstup) is False, vstup


@pytest.mark.parametrize("vstup,ceka", [
    ("19000", True), ("190 00", True), ("190  00", True), ("  19000  ", True),
    ("1900", False), ("190000", False), ("190-00", False), ("19O00", False), ("", False),
])
def test_psc(js, vstup, ceka):
    assert js("out(m.platnePsc(A.v));", v=vstup) is ceka, vstup


def test_plne_vyplnena_objednavka_projde(js):
    assert js("out(m.zkontroluj(A.p));") == []


def test_chyby_v_danem_poradi(js):
    assert js("out(m.zkontroluj({}));") == ["jmeno", "email", "telefon", "doprava"]
    assert js('out(m.zkontroluj({ doprava: "dobirka" }));') == ["jmeno", "email", "telefon", "ulice", "mesto", "psc"]
    assert js('out(m.zkontroluj({ ...A.p, jmeno: "K" }));') == ["jmeno"]
    assert js('out(m.zkontroluj({ ...A.p, jmeno: "  " }));') == ["jmeno"]
    assert js('out(m.zkontroluj({ ...A.p, email: "spatne" }));') == ["email"]
    assert js('out(m.zkontroluj({ ...A.p, psc: "190" }));') == ["psc"]


def test_telefon_je_u_objednavky_povinny(js):
    assert js('out(m.zkontroluj({ ...A.p, telefon: "" }));') == ["telefon"]


def test_u_osobniho_prevzeti_se_adresa_nevyzaduje(js):
    assert js('out(m.zkontroluj({ jmeno: "Jan Novák", email: "jan@example.com", '
              'telefon: "721365343", doprava: "osobne" }));') == []
    assert js('out(m.zkontroluj({ ...A.p, doprava: "osobne", ulice: "", mesto: "", psc: "" }));') == []


def test_neznama_doprava_je_chyba(js):
    assert js('out(m.zkontroluj({ ...A.p, doprava: "dron" }));') == ["doprava"]
    assert js('out(m.zkontroluj({ ...A.p, doprava: "" }));') == ["doprava"]


def test_ocisti_srovna_mezery_ale_neprepisuje_jmena(js):
    assert js("""out(m.ocisti({
        jmeno: "  Kamila   Zawadská ", email: " kamila@example.com ",
        telefon: "+420 721-365 343", ulice: "  Kolbenova   923/34a ",
        mesto: " Praha 9 ", psc: " 190 00 ", zprava: "  Dvě   mezery  ", doprava: "dobirka",
    }));""") == {
        "jmeno": "Kamila Zawadská", "email": "kamila@example.com", "telefon": "+420721365343",
        "ulice": "Kolbenova 923/34a", "mesto": "Praha 9", "psc": "19000",
        "zprava": "Dvě mezery", "doprava": "dobirka",
    }


def test_ocisti_nemeni_velikost_pismen(js):
    assert js('out(m.ocisti({ jmeno: "KAMILA ZAWADSKÁ", mesto: "PRAHA 9", '
              'ulice: "U Mlýna" }).jmeno);') == "KAMILA ZAWADSKÁ"
    assert js('out(m.ocisti({ mesto: "PRAHA 9" }).mesto);') == "PRAHA 9"


def test_ocisti_doplni_chybejici_klice(js):
    assert js("out(Object.keys(m.ocisti({})).sort());") == [
        "doprava", "email", "jmeno", "mesto", "psc", "telefon", "ulice", "zprava",
    ]
    assert js("out(m.ocisti({}).jmeno);") == ""


def test_rekapitulace(js):
    assert js("""
        const k = { polozky: [{ slug: "most", cena: 54000 }, { slug: "sova", cena: 8900 }],
                    doprava: "dobirka" };
        out(m.rekapitulace(k, A.d, A.z, "cs"));
    """) == {
        "polozky": [
            {"slug": "most", "nazev": "Most", "rozmer": "140 × 90 cm", "cena": 54000},
            {"slug": "sova", "nazev": "Sova", "rozmer": "40 × 30 cm", "cena": 8900},
        ],
        "dila": 62900,
        "doprava": {"id": "dobirka", "nazev": "Dopravce na dobírku", "cena": 390},
        "celkem": 63290,
    }


def test_rekapitulace_anglicky(js):
    assert js("""
        const k = { polozky: [{ slug: "sova", cena: 8900 }], doprava: "osobne" };
        const r = m.rekapitulace(k, A.d, A.z, "en");
        out([r.polozky[0].nazev, r.doprava.nazev, r.celkem]);
    """) == ["Owl", "Pick up", 8900]


def test_rekapitulace_bez_dopravy_a_s_neznamym_dilem(js):
    assert js("""
        const k = { polozky: [{ slug: "sova", cena: 8900 }, { slug: "zmizelo", cena: 1 }],
                    doprava: "" };
        const r = m.rekapitulace(k, A.d, A.z, "cs");
        out([r.polozky.length, r.doprava, r.celkem]);
    """) == [1, None, 8900]


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "src/lib/objednavka.mjs"
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

    path = "src/lib/objednavka.mjs"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
