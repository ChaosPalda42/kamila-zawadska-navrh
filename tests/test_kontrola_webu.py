"""Akceptační test C-009 — tools/kontrola_webu.py (brána nad hotovým webem).

Proč tahle brána existuje: u Green Air Tech se hláška „zpráva se nikam
neodesílá" dostala na 15 veřejných stránek ve třech jazycích, protože seděla
v jedné komponentě formuláře. Žádná z 691 bran to nechytila — nikdo neměřil
VIDITELNÝ text vykresleného webu. Proto se tu měří text, ne šablony.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from tools.kontrola_webu import (
    alt_texty, ceny, jazykove_dvojice, kontrola, main, najdi, odkazy, viditelny_text,
)

KOREN = Path(__file__).resolve().parents[1]


def stranka(telo: str, hlava: str = "") -> str:
    return f"<!doctype html><html lang=\"cs\"><head><title>T</title>{hlava}</head><body>{telo}</body></html>"


@pytest.fixture()
def web(tmp_path):
    def postav(soubory: dict[str, str]) -> Path:
        for cesta, obsah in soubory.items():
            p = tmp_path / cesta
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(obsah, encoding="utf-8")
        return tmp_path
    return postav


# --- viditelný text ---------------------------------------------------------

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


# --- hláška o ukázce v ostrém webu -----------------------------------------

def test_najdi_chytne_hlasku_bez_ohledu_na_diakritiku_a_velikost(web):
    koren = web({
        "index.html": stranka("<p>Klikatelná UKÁZKA, nic se neodesílá.</p>"),
        "kontakt/index.html": stranka("<p>V ukazce se zprava nikam neodesila.</p>"),
        "cisty/index.html": stranka("<p>Obrazy k prodeji</p>"),
    })
    nalezy = najdi(koren, ["ukázka"])
    assert [n["soubor"] for n in nalezy] == ["index.html", "kontakt/index.html"]
    assert all("vyrez" in n and len(n["vyrez"]) <= 80 for n in nalezy)


def test_najdi_chytne_hlasku_schovanou_v_alt_textu(web):
    koren = web({"index.html": stranka('<img src="a.jpg" alt="Ukázkový obrázek, smyšlené dílo">')})
    assert len(najdi(koren, ["smyšlen"])) == 1


def test_najdi_vraci_poradi_podle_souboru(web):
    koren = web({
        "b/index.html": stranka("<p>ukázka</p>"),
        "a/index.html": stranka("<p>ukázka</p>"),
    })
    assert [n["soubor"] for n in najdi(koren, ["ukázka"])] == ["a/index.html", "b/index.html"]


def test_najdi_nic_nenajde_na_cistem_webu(web):
    koren = web({"index.html": stranka("<p>Obrazy k prodeji</p>")})
    assert najdi(koren, ["ukázka", "demo"]) == []


# --- alt texty --------------------------------------------------------------

def test_alt_texty(web):
    koren = web({"index.html": stranka(
        '<img src="dobry.jpg" alt="Popis">'
        '<img src="bez.jpg">'
        '<img src="prazdny.jpg" alt="">'
        '<img src="mezery.jpg" alt="   ">'
        '<span aria-hidden="true"><img src="ozdoba.svg" alt=""></span>'
    )})
    nalezy = alt_texty(koren)
    assert sorted(n["src"] for n in nalezy) == ["bez.jpg", "mezery.jpg", "prazdny.jpg"]
    assert all(n["soubor"] == "index.html" for n in nalezy)


# --- vnitřní odkazy ---------------------------------------------------------

def test_odkazy_najdou_slepe_vnitrni_cesty(web):
    koren = web({
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
    assert [n["href"] for n in odkazy(koren)] == ["/neni/"]


def test_odkazy_prijmou_relativni_cestu(web):
    koren = web({
        "galerie/index.html": stranka('<a href="sova/">ok</a><a href="neni/">slepý</a>'),
        "galerie/sova/index.html": stranka("<p>Sova</p>"),
    })
    assert [n["href"] for n in odkazy(koren)] == ["neni/"]


def test_odkazy_meri_absolutni_cestu_od_korene_webu(web):
    """Absolutní odkaz z podstránky vede od korene webu, ne od té podstránky.

    Celý web odkazuje přes '/galerie/' a '/en/kontakt/'. Kdyby se taková
    cesta skládala vedle souboru, který ji nese, brána by na každé
    podstránce nahlásila slepý odkaz, a 894 falešných nálezů by schovalo
    ten jeden skutečný.
    """
    koren = web({
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
    assert sorted(n["href"] for n in odkazy(koren)) == ["/en/neni/", "/neni/"]


# --- jazykové dvojice -------------------------------------------------------

HREFLANG_OBA = (
    '<link rel="alternate" hreflang="cs" href="/galerie/">'
    '<link rel="alternate" hreflang="en" href="/en/galerie/">'
)


def test_jazykove_dvojice_hlasi_chybejici_protejsek(web):
    koren = web({
        "galerie/index.html": stranka("<p>Galerie</p>", HREFLANG_OBA),
        "en/galerie/index.html": stranka("<p>Gallery</p>", HREFLANG_OBA),
        "kurzy/index.html": stranka("<p>Kurzy</p>", HREFLANG_OBA),
    })
    nalezy = jazykove_dvojice(koren)
    assert {"soubor": "kurzy/index.html", "chybi": "protejsek"} in nalezy


def test_jazykove_dvojice_hlasi_chybejici_hreflang(web):
    koren = web({
        "galerie/index.html": stranka("<p>Galerie</p>"),
        "en/galerie/index.html": stranka("<p>Gallery</p>", HREFLANG_OBA),
    })
    nalezy = jazykove_dvojice(koren)
    assert {"soubor": "galerie/index.html", "chybi": "hreflang"} in nalezy
    assert not any(n["soubor"] == "en/galerie/index.html" for n in nalezy)


def test_jazykove_dvojice_na_sparovanem_webu_nic(web):
    koren = web({
        "index.html": stranka("<p>Domů</p>", HREFLANG_OBA),
        "en/index.html": stranka("<p>Home</p>", HREFLANG_OBA),
    })
    assert jazykove_dvojice(koren) == []


# --- ceny v e-shopu ---------------------------------------------------------

def test_ceny(web):
    koren = web({
        "obrazy-k-prodeji/index.html": stranka("<p>Most 54 000 Kč</p>"),
        "en/works-for-sale/index.html": stranka("<p>Bridge 54 000 CZK</p>"),
        "galerie/index.html": stranka("<p>Bez ceny, to je v pořádku</p>"),
    })
    assert ceny(koren) == []
    koren2 = web({"obrazy-k-prodeji/index.html": stranka("<p>Most</p>")})
    assert ceny(koren2) == [{"soubor": "obrazy-k-prodeji/index.html", "chybi": "cena"}]


# --- celek ------------------------------------------------------------------

def test_kontrola_v_rezimu_ukazky_hlasky_neresi(web):
    koren = web({
        "index.html": stranka("<p>Klikatelná ukázka.</p>", HREFLANG_OBA),
        "en/index.html": stranka("<p>Clickable demo.</p>", HREFLANG_OBA),
    })
    vysledek = kontrola(koren, ostry=False)
    assert vysledek["soubory"] == 2
    assert vysledek["ukazka"] == []
    assert vysledek["nalezu"] == 0


def test_kontrola_v_ostrem_rezimu_hlasku_najde(web):
    koren = web({
        "index.html": stranka("<p>Klikatelná ukázka.</p>", HREFLANG_OBA),
        "en/index.html": stranka("<p>Home</p>", HREFLANG_OBA),
    })
    vysledek = kontrola(koren, ostry=True)
    assert len(vysledek["ukazka"]) == 1
    assert vysledek["ukazka"][0]["soubor"] == "index.html"
    assert vysledek["nalezu"] >= 1


def test_kontrola_scita_vsech_pet_kategorii(web):
    koren = web({"index.html": stranka('<img src="x.jpg"><a href="/nikam/">x</a>')})
    vysledek = kontrola(koren, ostry=True)
    assert set(vysledek) == {"soubory", "ukazka", "alt", "odkazy", "dvojice", "ceny", "nalezu"}
    assert vysledek["nalezu"] == sum(
        len(vysledek[k]) for k in ("ukazka", "alt", "odkazy", "dvojice", "ceny")
    )


def test_vychozi_vzorky_pokryvaji_hlasky_z_ukazky(web):
    koren = web({
        "a/index.html": stranka("<p>Obsah je smyšlený.</p>"),
        "b/index.html": stranka("<p>V ukázce se zpráva nikam neodesílá.</p>"),
        "c/index.html": stranka("<p>Demo administrace.</p>"),
        "d/index.html": stranka("<p>Obrazy k prodeji, originály.</p>"),
    })
    nalezene = {n["soubor"] for n in kontrola(koren, ostry=True)["ukazka"]}
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
    koren = web({"index.html": stranka('<img src="x.jpg">')})
    main([str(koren), "--json"])
    vysledek = json.loads(capsys.readouterr().out)
    assert vysledek["nalezu"] >= 1
    assert "soubory" in vysledek


def test_main_jde_spustit_jako_modul(web):
    koren = web({"index.html": stranka("<p>Klikatelná ukázka</p>")})
    hotovo = subprocess.run(
        [sys.executable, "-m", "tools.kontrola_webu", str(koren), "--ostry", "--json"],
        capture_output=True, text=True, cwd=KOREN, timeout=60,
    )
    assert hotovo.returncode == 1, hotovo.stderr[:500]
    assert json.loads(hotovo.stdout)["ukazka"], hotovo.stdout[:500]
