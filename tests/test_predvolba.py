"""Acceptance test C-011 -- `tools/predvolba.py` (the site moved into a subfolder).

Why it exists: the demo hangs at https://chaospalda42.github.io/<repo>/, but
the site links from the root (`/galerie/`, `/styl.css`). The source is to stay
clean for the live domain, so it is the finished output that gets moved. What
may be rewritten is spelled out: an address in an attribute. Not the page's
text and not foreign attributes.
"""
from __future__ import annotations

import pathlib

import subprocess
import sys
from pathlib import Path

import pytest

from tools.predvolba import main, preved, preved_css, preved_html, uprav_predvolbu

ROOT = Path(__file__).resolve().parents[1]


# --- normalizing the prefix --------------------------------------------------

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
    result = preved_html(html, "/ukazka")
    assert 'href="/ukazka/galerie/"' in result
    assert 'href="/ukazka/styl.css?v=1"' in result
    assert 'src="/ukazka/web.js"' in result
    assert 'action="/ukazka/kosik/"' in result
    assert 'formaction="/ukazka/kosik/#dole"' in result
    assert 'poster="/ukazka/obrazky/sova.webp"' in result
    assert 'data-kosik-cesta="/ukazka/kosik/"' in result


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
    result = preved_html(html, "/ukazka")
    assert 'srcset="/ukazka/obrazky/a-400.webp 400w, /ukazka/obrazky/a-800.webp 800w"' in result
    assert 'src="/ukazka/obrazky/a.webp"' in result


def test_html_jednoduche_uvozovky_a_velka_pismena():
    html = "<a HREF='/galerie/'>G</a><IMG SRC='/obrazky/a.webp' alt='A'>"
    result = preved_html(html, "/ukazka")
    assert "/ukazka/galerie/" in result
    assert "/ukazka/obrazky/a.webp" in result


def test_html_druhy_beh_nic_nezmeni():
    html = '<a href="/galerie/">G</a><a href="/ukazka">sama předvolba</a>'
    jednou = preved_html(html, "/ukazka")
    assert preved_html(jednou, "/ukazka") == jednou


def test_html_prazdna_predvolba_nic_nedela():
    html = '<a href="/galerie/">G</a>'
    assert preved_html(html, "") == html


# --- HTML hidden inside JSON -------------------------------------------------

JSON_SCRIPT = (
    '<script type="application/json" data-dila>'
    '[{"slug":"a",'
    '"obrazek":"<img src=\\"/obrazky/a-960.jpg\\" '
    'srcset=\\"/obrazky/a-480.jpg 480w, /obrazky/a-960.jpg 960w\\" alt=\\"A\\">",'
    '"odkaz":{"kam":"/galerie/a/","text":"Detail"}}]'
    "</script>"
)


def test_json_skript_prepise_atributy_s_escapovanymi_uvozovkami():
    """The gallery's viewer is handed finished HTML inside JSON, where the
    quotes are written as \\" -- without this the paths stay at the root and
    end at a 404 under a subfolder."""
    result = preved_html(JSON_SCRIPT, "/ukazka")
    assert 'src=\\"/ukazka/obrazky/a-960.jpg\\"' in result
    assert 'srcset=\\"/ukazka/obrazky/a-480.jpg 480w, /ukazka/obrazky/a-960.jpg 960w\\"' in result
    assert 'alt=\\"A\\"' in result


def test_json_skript_prepise_adresu_v_hodnote():
    result = preved_html(JSON_SCRIPT, "/ukazka")
    assert '"kam":"/ukazka/galerie/a/"' in result


def test_json_skript_neprepise_co_nema():
    html = (
        '<script type="application/json" data-neco>'
        '[{"popis":"venku","web":"https://x.cz/a","kotva":"#dole",'
        '"relativni":"obrazky/a.jpg","bez-schematu":"//cdn.x.cz/a.js",'
        '"posta":"mailto:a@b.cz"}]'
        "</script>"
    )
    assert preved_html(html, "/ukazka") == html


def test_mimo_json_skript_se_retezce_nemeni():
    """A plain <script> is code, not data: the strings inside it are left alone."""
    html = '<script>var x = {"kam":"/galerie/a/"};</script>'
    assert preved_html(html, "/ukazka") == html


def test_json_skript_druhy_beh_nic_nezmeni():
    jednou = preved_html(JSON_SCRIPT, "/ukazka")
    assert preved_html(jednou, "/ukazka") == jednou


def test_json_skript_se_pocita_do_adres(web):
    root_dir = web({"galerie/index.html": JSON_SCRIPT})
    assert preved(root_dir, "/ukazka") == {"souboru": 1, "adres": 4}


JSON_SCRIPT_ADDRESS = (
    '<script type="application/json" data-dila>'
    '[{"slug":"a",'
    '"poptavka":"/kontakt/?duvod=na-miru&dilo=a",'
    '"vystava":"/obrazy-k-prodeji/#a",'
    '"obrazek":"<a href=\\"/galerie/a/?od=lupa\\">A</a>"}]'
    "</script>"
)


def test_json_skript_prepise_adresu_s_dotazem_a_kotvou():
    """Every work in the viewer carries a link "ask for one to order"
    (`/kontakt/?duvod=...`) and a link to the sales page
    (`/obrazy-k-prodeji/#slug`). The address ends in neither a slash nor a
    suffix -- the query and the anchor belong to it and have to survive the
    rewrite."""
    result = preved_html(JSON_SCRIPT_ADDRESS, "/ukazka")
    assert '"poptavka":"/ukazka/kontakt/?duvod=na-miru&dilo=a"' in result
    assert '"vystava":"/ukazka/obrazy-k-prodeji/#a"' in result
    assert 'href=\\"/ukazka/galerie/a/?od=lupa\\"' in result


def test_json_skript_s_dotazem_druhy_beh_nic_nezmeni():
    jednou = preved_html(JSON_SCRIPT_ADDRESS, "/ukazka")
    assert preved_html(jednou, "/ukazka") == jednou


def test_json_skript_s_dotazem_se_pocita_do_adres(web):
    root_dir = web({"galerie/index.html": JSON_SCRIPT_ADDRESS})
    assert preved(root_dir, "/ukazka") == {"souboru": 1, "adres": 3}


def test_json_skript_mimo_zacatek_dokumentu():
    """A JSON script never stands at the start of the file -- a whole page sits
    above it. When the block is cut by the position in the whole document
    instead of the position inside the stretch that was found, the tag is cut
    to pieces and its content spills onto the page as text. Hence the whole
    result is checked here, not only the rewritten address."""
    pred = "<!doctype html><html><body><p>Galerie</p>"
    script = '<script type="application/json" data-dila>[{"kam":"/galerie/a/"}]</script>'
    za = "</body></html>"
    cekam = pred + script.replace('"/galerie/a/"', '"/ukazka/galerie/a/"') + za
    assert preved_html(pred + script + za, "/ukazka") == cekam


def test_json_skript_dva_bloky_na_strance():
    """The gallery page has several of those blocks (works, events). The second
    in the row must not fall apart just because it lies further from the start
    of the file."""
    blok = '<script type="application/json" data-%s>[{"kam":"/galerie/%s/"}]</script>'
    html = "<p>x</p>" + (blok % ("dila", "a")) + "<p>y</p>" + (blok % ("akce", "b"))
    result = preved_html(html, "/ukazka")
    assert result.count("</script>") == 2
    assert '"/ukazka/galerie/a/"' in result
    assert '"/ukazka/galerie/b/"' in result
    assert "<p>y</p>" in result


# --- CSS --------------------------------------------------------------------

def test_css_url_vsechny_zapisy():
    css = "a{background:url(/obrazky/a.webp)}b{background:url('/obrazky/b.webp')}c{background:url(\"/obrazky/c.webp\")}"
    result = preved_css(css, "/ukazka")
    assert "url(/ukazka/obrazky/a.webp)" in result
    assert "/ukazka/obrazky/b.webp" in result
    assert "/ukazka/obrazky/c.webp" in result


def test_css_neprepise_cizi_adresy():
    css = "a{background:url(https://x.cz/a.webp)}b{background:url(//cdn/x.webp)}c{background:url(obrazky/d.webp)}"
    assert preved_css(css, "/ukazka") == css


# --- the whole directory -----------------------------------------------------

@pytest.fixture()
def web(tmp_path):
    def postav(files: dict[str, str]) -> Path:
        for file_path, content in files.items():
            p = tmp_path / file_path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        return tmp_path
    return postav


def test_preved_projde_vnorene_slozky_a_pocita(web):
    root_dir = web({
        "index.html": '<a href="/galerie/">G</a><a href="/kontakt/">K</a>',
        "en/galerie/index.html": '<a href="/en/galerie/">G</a>',
        "styl.css": "a{background:url(/obrazky/a.webp)}",
        "robots.txt": "User-agent: *\nDisallow: /\n",
    })
    result = preved(root_dir, "/ukazka")
    assert result == {"souboru": 3, "adres": 4}
    assert '<a href="/ukazka/galerie/">' in (root_dir / "index.html").read_text(encoding="utf-8")
    assert "/ukazka/en/galerie/" in (root_dir / "en/galerie/index.html").read_text(encoding="utf-8")
    assert "url(/ukazka/obrazky/a.webp)" in (root_dir / "styl.css").read_text(encoding="utf-8")
    assert (root_dir / "robots.txt").read_text(encoding="utf-8") == "User-agent: *\nDisallow: /\n"


def test_preved_druhy_beh_vrati_nuly(web):
    root_dir = web({"index.html": '<a href="/galerie/">G</a>'})
    preved(root_dir, "/ukazka")
    assert preved(root_dir, "/ukazka") == {"souboru": 0, "adres": 0}


# --- running it from the command line ----------------------------------------

def test_main_vytiskne_radek(web, capsys):
    root_dir = web({"index.html": '<a href="/galerie/">G</a>'})
    assert main([str(root_dir), "ukazka"]) == 0
    vypsano = capsys.readouterr().out.strip()
    assert vypsano == "predvolba: /ukazka, souboru: 1, adres: 1"


def test_main_chybejici_adresar(tmp_path, capsys):
    assert main([str(tmp_path / "neni"), "ukazka"]) == 2
    assert capsys.readouterr().err.strip() != ""


def test_modul_jde_spustit(web):
    root_dir = web({"index.html": '<a href="/galerie/">G</a>'})
    done = subprocess.run(
        [sys.executable, "-m", "tools.predvolba", str(root_dir), "ukazka"],
        cwd=ROOT, capture_output=True, text=True,
    )
    assert done.returncode == 0, done.stderr
    assert "predvolba: /ukazka" in done.stdout


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "tools/predvolba.py"
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

    path = "tools/predvolba.py"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
