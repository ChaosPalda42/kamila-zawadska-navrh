"""Acceptance test C-009 -- `tools/kontrola_webu.py` (a gate over the finished site).

Why this gate exists: at Green Air Tech the notice "the message is not sent
anywhere" reached 15 public pages in three languages, because it sat in one
form component. Not one of the 691 gates caught it -- nobody measured the
VISIBLE text of the rendered site. Hence text is what is measured here, not
templates.
"""
from __future__ import annotations

import pathlib

import json
import subprocess
import sys
from pathlib import Path

import pytest

from tools.kontrola_webu import (
    alt_texty, ceny, jazykove_dvojice, kontrola, main, najdi, odkazy, viditelny_text,
)

ROOT = Path(__file__).resolve().parents[1]


def stranka(body: str, head: str = "") -> str:
    return f"<!doctype html><html lang=\"cs\"><head><title>T</title>{head}</head><body>{body}</body></html>"


@pytest.fixture()
def web(tmp_path):
    def postav(files: dict[str, str]) -> Path:
        for file_path, content in files.items():
            p = tmp_path / file_path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        return tmp_path
    return postav


# --- the visible text --------------------------------------------------------

def test_viditelny_text_zahodi_skripty_styly_a_komentare():
    html = stranka(
        "<p>Vidět</p><script>var ukazka = 'ukázka';</script>"
        "<style>.a { content: 'ukázka'; }</style>"
        "<!-- ukázka v komentáři --><template><p>ukázka v šabloně</p></template>"
        "<noscript>ukázka bez skriptu</noscript>"
    )
    text = viditelny_text(html)
    assert "Vidět" in text
    assert "ukázka" not in text
    assert "ukazka" not in text


def test_viditelny_text_rozbali_entity_a_srazi_mezery():
    assert viditelny_text(stranka("<p>A&nbsp;B</p>")) == "T A B"
    assert viditelny_text(stranka("<p>5&nbsp;000&nbsp;Kč</p>")) == "T 5 000 Kč"
    assert viditelny_text(stranka("<p>jedna   &amp;   dva</p>")) == "T jedna & dva"
    assert viditelny_text(stranka("<p>&lt;tag&gt;</p>")) == "T <tag>"
    assert viditelny_text(stranka("<p>&quot;a&quot; &#39;b&#39;</p>")) == "T \"a\" 'b'"


def test_viditelny_text_bere_alt_title_aria_a_placeholder():
    text = viditelny_text(stranka(
        '<img src="a.jpg" alt="Olejomalba krajiny">'
        '<a href="/x" title="Název odkazu">x</a>'
        '<button aria-label="Zavřít prohlížeč"></button>'
        '<input placeholder="Váš e-mail">'
    ))
    for ocekavane in ("Olejomalba krajiny", "Název odkazu", "Zavřít prohlížeč", "Váš e-mail"):
        assert ocekavane in text, ocekavane


def test_viditelny_text_nebere_ostatni_atributy():
    text = viditelny_text(stranka('<div class="ukázka" data-poznamka="ukázka pro klienta">x</div>'))
    assert "ukázka" not in text


# --- a demo notice on the live site ------------------------------------------

def test_najdi_chytne_hlasku_bez_ohledu_na_diakritiku_a_velikost(web):
    root_dir = web({
        "index.html": stranka("<p>Klikatelná UKÁZKA, nic se neodesílá.</p>"),
        "kontakt/index.html": stranka("<p>V ukazce se zprava nikam neodesila.</p>"),
        "cisty/index.html": stranka("<p>Obrazy k prodeji</p>"),
    })
    findings = najdi(root_dir, ["ukázka"])
    assert [n["soubor"] for n in findings] == ["index.html", "kontakt/index.html"]
    assert all("vyrez" in n and len(n["vyrez"]) <= 80 for n in findings)


def test_najdi_chytne_hlasku_schovanou_v_alt_textu(web):
    root_dir = web({"index.html": stranka('<img src="a.jpg" alt="Ukázkový obrázek, smyšlené dílo">')})
    assert len(najdi(root_dir, ["smyšlen"])) == 1


def test_najdi_vraci_poradi_podle_souboru(web):
    root_dir = web({
        "b/index.html": stranka("<p>ukázka</p>"),
        "a/index.html": stranka("<p>ukázka</p>"),
    })
    assert [n["soubor"] for n in najdi(root_dir, ["ukázka"])] == ["a/index.html", "b/index.html"]


def test_najdi_nic_nenajde_na_cistem_webu(web):
    root_dir = web({"index.html": stranka("<p>Obrazy k prodeji</p>")})
    assert najdi(root_dir, ["ukázka", "demo"]) == []


# --- alt texts ---------------------------------------------------------------

def test_alt_texty(web):
    root_dir = web({"index.html": stranka(
        '<img src="dobry.jpg" alt="Popis">'
        '<img src="bez.jpg">'
        '<img src="prazdny.jpg" alt="">'
        '<img src="mezery.jpg" alt="   ">'
        '<span aria-hidden="true"><img src="ozdoba.svg" alt=""></span>'
    )})
    findings = alt_texty(root_dir)
    assert sorted(n["src"] for n in findings) == ["bez.jpg", "mezery.jpg", "prazdny.jpg"]
    assert all(n["soubor"] == "index.html" for n in findings)


# --- internal links ----------------------------------------------------------

def test_odkazy_najdou_slepe_vnitrni_cesty(web):
    root_dir = web({
        "index.html": stranka(
            '<a href="/galerie/">ok</a>'
            '<a href="/neni/">slepý</a>'
            '<a href="/galerie/?filtr=olej#top">ok s dotazem</a>'
            '<a href="https://instagram.com/x">venku</a>'
            '<a href="mailto:a@b.cz">pošta</a>'
            '<a href="tel:+420721365343">telefon</a>'
            '<a href="#nahoru">na stránce</a>'
        ),
        "galerie/index.html": stranka("<p>Galerie</p>"),
    })
    assert [n["href"] for n in odkazy(root_dir)] == ["/neni/"]


def test_odkazy_prijmou_relativni_cestu(web):
    root_dir = web({
        "galerie/index.html": stranka('<a href="sova/">ok</a><a href="neni/">slepý</a>'),
        "galerie/sova/index.html": stranka("<p>Sova</p>"),
    })
    assert [n["href"] for n in odkazy(root_dir)] == ["neni/"]


def test_odkazy_meri_absolutni_cestu_od_korene_webu(web):
    """An absolute link from a subpage runs from the site's root, not from that page.

    The whole site links through `/galerie/` and `/en/kontakt/`. Were such a
    path put together next to the file that carries it, the gate would report
    a dead link on every subpage, and 894 false findings would hide the one
    real one.
    """
    root_dir = web({
        "administrace/index.html": stranka(
            '<a href="/galerie/">ok</a>'
            '<a href="/galerie/sova/">ok hloub</a>'
            '<a href="/neni/">slepý</a>'
        ),
        "galerie/index.html": stranka("<p>Galerie</p>"),
        "galerie/sova/index.html": stranka("<p>Sova</p>"),
        "en/galerie/index.html": stranka(
            '<a href="/en/galerie/">ok</a><a href="/en/neni/">slepý</a>'
        ),
    })
    assert sorted(n["href"] for n in odkazy(root_dir)) == ["/en/neni/", "/neni/"]


# --- language pairs ----------------------------------------------------------

HREFLANG_OBA = (
    '<link rel="alternate" hreflang="cs" href="/galerie/">'
    '<link rel="alternate" hreflang="en" href="/en/galerie/">'
)


def test_jazykove_dvojice_hlasi_chybejici_protejsek(web):
    root_dir = web({
        "galerie/index.html": stranka("<p>Galerie</p>", HREFLANG_OBA),
        "en/galerie/index.html": stranka("<p>Gallery</p>", HREFLANG_OBA),
        "kurzy/index.html": stranka("<p>Kurzy</p>", HREFLANG_OBA),
    })
    findings = jazykove_dvojice(root_dir)
    assert {"soubor": "kurzy/index.html", "chybi": "protejsek"} in findings


def test_jazykove_dvojice_hlasi_chybejici_hreflang(web):
    root_dir = web({
        "galerie/index.html": stranka("<p>Galerie</p>"),
        "en/galerie/index.html": stranka("<p>Gallery</p>", HREFLANG_OBA),
    })
    findings = jazykove_dvojice(root_dir)
    assert {"soubor": "galerie/index.html", "chybi": "hreflang"} in findings
    assert not any(n["soubor"] == "en/galerie/index.html" for n in findings)


def test_jazykove_dvojice_na_sparovanem_webu_nic(web):
    root_dir = web({
        "index.html": stranka("<p>Domů</p>", HREFLANG_OBA),
        "en/index.html": stranka("<p>Home</p>", HREFLANG_OBA),
    })
    assert jazykove_dvojice(root_dir) == []


# --- prices in the shop ------------------------------------------------------

def test_ceny(web):
    root_dir = web({
        "obrazy-k-prodeji/index.html": stranka("<p>Most 54 000 Kč</p>"),
        "en/works-for-sale/index.html": stranka("<p>Bridge 54 000 CZK</p>"),
        "galerie/index.html": stranka("<p>Bez ceny, to je v pořádku</p>"),
    })
    assert ceny(root_dir) == []
    koren2 = web({"obrazy-k-prodeji/index.html": stranka("<p>Most</p>")})
    assert ceny(koren2) == [{"soubor": "obrazy-k-prodeji/index.html", "chybi": "cena"}]


# --- celek ------------------------------------------------------------------

def test_kontrola_v_rezimu_ukazky_hlasky_neresi(web):
    root_dir = web({
        "index.html": stranka("<p>Klikatelná ukázka.</p>", HREFLANG_OBA),
        "en/index.html": stranka("<p>Clickable demo.</p>", HREFLANG_OBA),
    })
    result = kontrola(root_dir, ostry=False)
    assert result["soubory"] == 2
    assert result["ukazka"] == []
    assert result["nalezu"] == 0


def test_kontrola_v_ostrem_rezimu_hlasku_najde(web):
    root_dir = web({
        "index.html": stranka("<p>Klikatelná ukázka.</p>", HREFLANG_OBA),
        "en/index.html": stranka("<p>Home</p>", HREFLANG_OBA),
    })
    result = kontrola(root_dir, ostry=True)
    assert len(result["ukazka"]) == 1
    assert result["ukazka"][0]["soubor"] == "index.html"
    assert result["nalezu"] >= 1


def test_kontrola_scita_vsech_pet_kategorii(web):
    root_dir = web({"index.html": stranka('<img src="x.jpg"><a href="/nikam/">x</a>')})
    result = kontrola(root_dir, ostry=True)
    assert set(result) == {"soubory", "ukazka", "alt", "odkazy", "dvojice", "ceny", "nalezu"}
    assert result["nalezu"] == sum(
        len(result[k]) for k in ("ukazka", "alt", "odkazy", "dvojice", "ceny")
    )


def test_vychozi_vzorky_pokryvaji_hlasky_z_ukazky(web):
    root_dir = web({
        "a/index.html": stranka("<p>Obsah je smyšlený.</p>"),
        "b/index.html": stranka("<p>V ukázce se zpráva nikam neodesílá.</p>"),
        "c/index.html": stranka("<p>Demo administrace.</p>"),
        "d/index.html": stranka("<p>Obrazy k prodeji, originály.</p>"),
    })
    nalezene = {n["soubor"] for n in kontrola(root_dir, ostry=True)["ukazka"]}
    assert nalezene == {"a/index.html", "b/index.html", "c/index.html"}


# --- CLI --------------------------------------------------------------------

def test_main_vraci_kody(web, capsys):
    cisty = web({"index.html": stranka("<p>Obrazy</p>", HREFLANG_OBA),
                 "en/index.html": stranka("<p>Works</p>", HREFLANG_OBA)})
    assert main([str(cisty)]) == 0
    spinavy = web({"index.html": stranka('<img src="x.jpg">')})
    assert main([str(spinavy)]) == 1
    assert main([str(spinavy / "neexistuje")]) == 2


def test_main_umi_json(web, capsys):
    root_dir = web({"index.html": stranka('<img src="x.jpg">')})
    main([str(root_dir), "--json"])
    result = json.loads(capsys.readouterr().out)
    assert result["nalezu"] >= 1
    assert "soubory" in result


def test_main_jde_spustit_jako_modul(web):
    root_dir = web({"index.html": stranka("<p>Klikatelná ukázka</p>")})
    done = subprocess.run(
        [sys.executable, "-m", "tools.kontrola_webu", str(root_dir), "--ostry", "--json"],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    assert done.returncode == 1, done.stderr[:500]
    assert json.loads(done.stdout)["ukazka"], done.stdout[:500]


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "tools/kontrola_webu.py"
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

    path = "tools/kontrola_webu.py"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
