"""Akceptační test C-014 — src/lib/texty-sekce.mjs (texty webu v administraci)."""
from __future__ import annotations

import pytest

from tests.jsmod import run_js

TEXTY = {
    "uvod.claim": {"cs": "Maluju to, co se nedá vyfotit.", "en": "I paint what cannot be photographed."},
    "uvod.aktualne": {"cs": "Právě teď", "en": "Right now"},
    "galerie.titul": {"cs": "Galerie", "en": "Gallery"},
    "stav.prodano": {"cs": "Prodáno", "en": "Sold"},
    "eshop.do-kosiku": {"cs": "Do košíku", "en": "Add to cart"},
    "kosik.dokoncit": {"cs": "Dokončit", "en": "Finish"},
    "objednavka.jmeno": {"cs": "Jméno", "en": "Name"},
    "kalendar.titul": {"cs": "Výstavy a akce", "en": "Exhibitions and events"},
    "kurzy.cena": {"cs": "Cena", "en": "Price"},
    "bio.text": {"cs": "Maluji od dětství.", "en": "I have painted since childhood."},
    "kontakt.zprava": {"cs": "Zpráva", "en": "Message"},
    "formular.odeslat": {"cs": "Odeslat", "en": "Send"},
    "nav.domu": {"cs": "Domů", "en": "Home"},
    "patka.nahoru": {"cs": "Nahoru", "en": "Top"},
    "ukazka.hlavicka": {"cs": "Klikatelná ukázka", "en": "Clickable demo"},
    "sirotek": {"cs": "Sám sobě", "en": "On its own"},
    "kurzy.bez-anglictiny": {"cs": "Zatím jen česky", "en": "  "},
}


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("texty-sekce.mjs", body, args={"t": TEXTY, **args})
    return call


def sekce(vysledek, kdo):
    return next(s for s in vysledek if s["id"] == kdo)["klice"]


# --- sekce ------------------------------------------------------------------

def test_sekce_jsou_vsechny_a_v_pevnem_poradi(js):
    v = js("out(m.sekce(A.t).map((s) => s.id));")
    assert v == ["uvod", "galerie", "eshop", "kalendar", "kurzy", "bio", "kontakt", "navigace", "ostatni"]


def test_sekce_jsou_zverejnene_i_jako_konstanta(js):
    assert js("out(m.SEKCE.map((s) => s.id));") == js("out(m.sekce({}).map((s) => s.id));")
    assert js("out(Object.isFrozen(m.SEKCE));") is True


def test_klice_padnou_do_spravne_sekce(js):
    v = js("out(m.sekce(A.t));")
    assert sekce(v, "uvod") == ["uvod.aktualne", "uvod.claim"]
    assert sekce(v, "galerie") == ["galerie.titul", "stav.prodano"]
    assert sekce(v, "eshop") == ["eshop.do-kosiku", "kosik.dokoncit", "objednavka.jmeno"]
    assert sekce(v, "kontakt") == ["formular.odeslat", "kontakt.zprava"]
    assert sekce(v, "navigace") == ["nav.domu", "patka.nahoru"]


def test_co_nesedi_nikam_padne_do_ostatnich(js):
    v = js("out(m.sekce(A.t));")
    assert sekce(v, "ostatni") == ["sirotek", "ukazka.hlavicka"]


def test_prazdna_sekce_zustane_v_seznamu(js):
    v = js('out(m.sekce({ "nav.domu": { cs: "Domů" } }));')
    assert sekce(v, "bio") == []
    assert sekce(v, "navigace") == ["nav.domu"]


def test_prazdny_slovnik_nezlomi(js):
    assert js("out(m.sekce({}).every((s) => s.klice.length === 0));") is True
    assert js("out(m.sekce(null).length);") == 9


# --- hledání ----------------------------------------------------------------

def test_hleda_v_klici(js):
    assert js('out(m.hledej(A.t, "kosik"));') == ["eshop.do-kosiku", "kosik.dokoncit"]


def test_hleda_v_textu_bez_diakritiky(js):
    assert js('out(m.hledej(A.t, "vystavy"));') == ["kalendar.titul"]
    assert js('out(m.hledej(A.t, "VÝSTAVY"));') == ["kalendar.titul"]
    assert js('out(m.hledej(A.t, "prodano"));') == ["stav.prodano"]


def test_hleda_i_v_anglictine(js):
    assert js('out(m.hledej(A.t, "cart"));') == ["eshop.do-kosiku"]


def test_jazyky_jdou_omezit(js):
    assert js('out(m.hledej(A.t, "cart", ["cs"]));') == []
    assert js('out(m.hledej(A.t, "kosiku", ["cs"]));') == ["eshop.do-kosiku"]


def test_prazdny_dotaz_vrati_vsechno_abecedne(js):
    vsechno = sorted(TEXTY)
    assert js('out(m.hledej(A.t, ""));') == vsechno
    assert js('out(m.hledej(A.t, "   "));') == vsechno


def test_vysledek_hledani_je_abecedne(js):
    v = js('out(m.hledej(A.t, "a"));')
    assert v == sorted(v)


# --- co se změnilo ----------------------------------------------------------

def test_rozdil_najde_zmenu_pridani_i_odebrani(js):
    v = js("""
      const u = { ...A.t };
      u["galerie.titul"] = { cs: "Obrazy", en: "Gallery" };
      u["novy.klic"] = { cs: "Nový", en: "New" };
      delete u["nav.domu"];
      out(m.rozdil(A.t, u));
    """)
    assert v == ["galerie.titul", "nav.domu", "novy.klic"]


def test_rozdil_vidi_i_zmenu_jen_v_jednom_jazyce(js):
    v = js("""
      const u = { ...A.t, "bio.text": { cs: "Maluji od dětství.", en: "Changed." } };
      out(m.rozdil(A.t, u));
    """)
    assert v == ["bio.text"]


def test_beze_zmeny_je_rozdil_prazdny(js):
    assert js("out(m.rozdil(A.t, { ...A.t }));") == []
    assert js("out(m.rozdil(null, null));") == []


# --- chybějící překlady -----------------------------------------------------

def test_chybejici_najde_prazdny_i_nepritomny_jazyk(js):
    v = js("""
      const u = { ...A.t, "nav.domu": { cs: "Domů" } };
      out(m.chybejici(u));
    """)
    assert v == ["kurzy.bez-anglictiny", "nav.domu"]


def test_chybejici_bere_jen_zadane_jazyky(js):
    v = js("""
      const u = { ...A.t, "nav.domu": { cs: "Domů" } };
      out(m.chybejici(u, ["cs"]));
    """)
    assert v == []


def test_chybejici_na_cistem_slovniku_je_prazdne(js):
    assert js('out(m.chybejici({ "nav.domu": { cs: "Domů", en: "Home" } }));') == []
