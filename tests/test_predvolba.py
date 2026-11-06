"""Akceptační test C-011 — tools/predvolba.py (web přesazený do podadresáře).

Proč to existuje: ukázka visí na https://chaospalda42.github.io/<repo>/, ale
web odkazuje od korene ('/galerie/', '/styl.css'). Zdroj má zůstat čistý pro
ostrou doménu, takže se přesazuje až hotový výstup. Co se smí přepsat, je
vyjmenované: adresa v atributu. Text stránky ani cizí atributy ne.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from tools.predvolba import main, preved, preved_css, preved_html, uprav_predvolbu

KOREN = Path(__file__).resolve().parents[1]


# --- normalizace předvolby --------------------------------------------------

@pytest.mark.parametrize(
    "zadano,ceka",
    [
        ("ukazka", "/ukazka"),
        ("/ukazka", "/ukazka"),
        ("/ukazka/", "/ukazka"),
        ("ukazka///", "/ukazka"),
        ("/a/b/", "/a/b"),
        ("", ""),
        ("/", ""),
        ("///", ""),
    ],
)
def test_uprav_predvolbu(zadano, ceka):
    assert uprav_predvolbu(zadano) == ceka


# --- HTML -------------------------------------------------------------------

def test_html_prepise_adresy_v_atributech():
    html = (
        '<a href="/galerie/">G</a>'
        '<link rel="stylesheet" href="/styl.css?v=1">'
        '<script src="/web.js"></script>'
        '<form action="/kosik/"><button formaction="/kosik/#dole">Do košíku</button></form>'
        '<video poster="/obrazky/sova.webp"></video>'
        '<button data-kosik-cesta="/kosik/">Košík</button>'
    )
    vysledek = preved_html(html, "/ukazka")
    assert 'href="/ukazka/galerie/"' in vysledek
    assert 'href="/ukazka/styl.css?v=1"' in vysledek
    assert 'src="/ukazka/web.js"' in vysledek
    assert 'action="/ukazka/kosik/"' in vysledek
    assert 'formaction="/ukazka/kosik/#dole"' in vysledek
    assert 'poster="/ukazka/obrazky/sova.webp"' in vysledek
    assert 'data-kosik-cesta="/ukazka/kosik/"' in vysledek


def test_html_neprepise_co_nema():
    html = (
        '<a href="https://instagram.com/x">venku</a>'
        '<a href="//cdn.example.com/f.js">bez schematu</a>'
        '<a href="mailto:a@b.cz">pošta</a>'
        '<a href="tel:+420721365343">telefon</a>'
        '<a href="#nahoru">na stránce</a>'
        '<a href="?filtr=olej">dotaz</a>'
        '<a href="sova/">relativní</a>'
        '<img src="data:image/svg+xml,%3Csvg%3E">'
        '<p>Odkaz "/galerie/" v textu zůstane.</p>'
        '<div data-nazev="/galerie/">cizí atribut</div>'
    )
    assert preved_html(html, "/ukazka") == html


def test_html_srcset_vsichni_kandidati():
    html = '<img srcset="/obrazky/a-400.webp 400w, /obrazky/a-800.webp 800w" src="/obrazky/a.webp" alt="A">'
    vysledek = preved_html(html, "/ukazka")
    assert 'srcset="/ukazka/obrazky/a-400.webp 400w, /ukazka/obrazky/a-800.webp 800w"' in vysledek
    assert 'src="/ukazka/obrazky/a.webp"' in vysledek


def test_html_jednoduche_uvozovky_a_velka_pismena():
    html = "<a HREF='/galerie/'>G</a><IMG SRC='/obrazky/a.webp' alt='A'>"
    vysledek = preved_html(html, "/ukazka")
    assert "/ukazka/galerie/" in vysledek
    assert "/ukazka/obrazky/a.webp" in vysledek


def test_html_druhy_beh_nic_nezmeni():
    html = '<a href="/galerie/">G</a><a href="/ukazka">sama předvolba</a>'
    jednou = preved_html(html, "/ukazka")
    assert preved_html(jednou, "/ukazka") == jednou


def test_html_prazdna_predvolba_nic_nedela():
    html = '<a href="/galerie/">G</a>'
    assert preved_html(html, "") == html


# --- CSS --------------------------------------------------------------------

def test_css_url_vsechny_zapisy():
    css = "a{background:url(/obrazky/a.webp)}b{background:url('/obrazky/b.webp')}c{background:url(\"/obrazky/c.webp\")}"
    vysledek = preved_css(css, "/ukazka")
    assert "url(/ukazka/obrazky/a.webp)" in vysledek
    assert "/ukazka/obrazky/b.webp" in vysledek
    assert "/ukazka/obrazky/c.webp" in vysledek


def test_css_neprepise_cizi_adresy():
    css = "a{background:url(https://x.cz/a.webp)}b{background:url(//cdn/x.webp)}c{background:url(obrazky/d.webp)}"
    assert preved_css(css, "/ukazka") == css


# --- celý adresář -----------------------------------------------------------

@pytest.fixture()
def web(tmp_path):
    def postav(soubory: dict[str, str]) -> Path:
        for cesta, obsah in soubory.items():
            p = tmp_path / cesta
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(obsah, encoding="utf-8")
        return tmp_path
    return postav


def test_preved_projde_vnorene_slozky_a_pocita(web):
    koren = web({
        "index.html": '<a href="/galerie/">G</a><a href="/kontakt/">K</a>',
        "en/galerie/index.html": '<a href="/en/galerie/">G</a>',
        "styl.css": "a{background:url(/obrazky/a.webp)}",
        "robots.txt": "User-agent: *\nDisallow: /\n",
    })
    vysledek = preved(koren, "/ukazka")
    assert vysledek == {"souboru": 3, "adres": 4}
    assert '<a href="/ukazka/galerie/">' in (koren / "index.html").read_text(encoding="utf-8")
    assert "/ukazka/en/galerie/" in (koren / "en/galerie/index.html").read_text(encoding="utf-8")
    assert "url(/ukazka/obrazky/a.webp)" in (koren / "styl.css").read_text(encoding="utf-8")
    assert (koren / "robots.txt").read_text(encoding="utf-8") == "User-agent: *\nDisallow: /\n"


def test_preved_druhy_beh_vrati_nuly(web):
    koren = web({"index.html": '<a href="/galerie/">G</a>'})
    preved(koren, "/ukazka")
    assert preved(koren, "/ukazka") == {"souboru": 0, "adres": 0}


# --- spuštění z příkazové řádky --------------------------------------------

def test_main_vytiskne_radek(web, capsys):
    koren = web({"index.html": '<a href="/galerie/">G</a>'})
    assert main([str(koren), "ukazka"]) == 0
    vypsano = capsys.readouterr().out.strip()
    assert vypsano == "predvolba: /ukazka, souboru: 1, adres: 1"


def test_main_chybejici_adresar(tmp_path, capsys):
    assert main([str(tmp_path / "neni"), "ukazka"]) == 2
    assert capsys.readouterr().err.strip() != ""


def test_modul_jde_spustit(web):
    koren = web({"index.html": '<a href="/galerie/">G</a>'})
    hotovo = subprocess.run(
        [sys.executable, "-m", "tools.predvolba", str(koren), "ukazka"],
        cwd=KOREN, capture_output=True, text=True,
    )
    assert hotovo.returncode == 0, hotovo.stderr
    assert "predvolba: /ukazka" in hotovo.stdout
