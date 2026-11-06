"""Akceptační test C-010 — tools/fotky.py (varianty fotek a srcset).

Srcset musí hlásit SKUTEČNOU šířku uloženého souboru. Na webu Truhlářství
Valčík to byla skutečná chyba: srcsety hlásily odhad 1600, ne naměřenou šířku.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
from PIL import Image

from tools.fotky import SIRKY, nazev, sizes, srcset, varianty, zmensi, zpracuj, main

KOREN = Path(__file__).resolve().parents[1]


def uloz(cesta: Path, sirka: int, vyska: int, format_="JPEG") -> Path:
    cesta.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (sirka, vyska), (120, 90, 60)).save(cesta, format_)
    return cesta


def test_sirky():
    assert SIRKY == (480, 960, 1600)


def test_nazev():
    assert nazev("sova", 960) == "sova-960.jpg"


def test_zmensi_drzi_pomer(tmp_path):
    obrazek = Image.new("RGB", (2000, 1000))
    maly = zmensi(obrazek, 480)
    assert maly.size == (480, 240)
    assert maly.mode == "RGB"


def test_zmensi_nezvetsuje(tmp_path):
    obrazek = Image.new("RGB", (300, 200))
    assert zmensi(obrazek, 960).size == (300, 200)


def test_zmensi_prevede_do_rgb():
    assert zmensi(Image.new("RGBA", (800, 400)), 480).mode == "RGB"
    assert zmensi(Image.new("L", (800, 400)), 480).mode == "RGB"


def test_zmensi_vyska_nikdy_nula():
    assert zmensi(Image.new("RGB", (4000, 3)), 480).size[1] >= 1


def test_varianty_hlasi_skutecnou_sirku(tmp_path):
    zdroj = uloz(tmp_path / "zdroj" / "sova.jpg", 2000, 1000)
    vysledek = varianty(zdroj, tmp_path / "cil")
    assert [v["sirka"] for v in vysledek] == [480, 960, 1600]
    for v in vysledek:
        with Image.open(tmp_path / "cil" / v["soubor"]) as img:
            assert img.size == (v["sirka"], v["vyska"]), v["soubor"]


def test_varianty_u_male_fotky_nenafukuji_a_nezdvojuji(tmp_path):
    zdroj = uloz(tmp_path / "zdroj" / "mala.jpg", 700, 500)
    vysledek = varianty(zdroj, tmp_path / "cil")
    sirky = [v["sirka"] for v in vysledek]
    assert sirky == sorted(sirky)
    assert len(sirky) == len(set(sirky)), "stejná šířka se v seznamu objeví jen jednou"
    assert max(sirky) == 700, "nikdy se nezvětšuje nad originál"
    for v in vysledek:
        with Image.open(tmp_path / "cil" / v["soubor"]) as img:
            assert img.width == v["sirka"]


def test_varianty_pouziji_jmeno_zdroje_nebo_zaklad(tmp_path):
    zdroj = uloz(tmp_path / "zdroj" / "les-po-desti.jpg", 1200, 800)
    assert varianty(zdroj, tmp_path / "a")[0]["soubor"].startswith("les-po-desti-")
    assert varianty(zdroj, tmp_path / "b", zaklad="jiny")[0]["soubor"].startswith("jiny-")


def test_varianty_vytvori_adresar(tmp_path):
    zdroj = uloz(tmp_path / "zdroj" / "x.jpg", 1000, 600)
    cil = tmp_path / "hluboko" / "jeste" / "hloubeji"
    assert varianty(zdroj, cil)
    assert cil.is_dir()


def test_varianty_umi_png_a_vraci_jpeg(tmp_path):
    zdroj = uloz(tmp_path / "zdroj" / "kresba.png", 1200, 900, format_="PNG")
    vysledek = varianty(zdroj, tmp_path / "cil")
    assert all(v["soubor"].endswith(".jpg") for v in vysledek)
    with Image.open(tmp_path / "cil" / vysledek[0]["soubor"]) as img:
        assert img.format == "JPEG"


def test_srcset_bere_sirku_ze_seznamu():
    seznam = [
        {"soubor": "sova-480.jpg", "sirka": 480, "vyska": 240},
        {"soubor": "sova-960.jpg", "sirka": 700, "vyska": 350},
    ]
    assert srcset(seznam, "/obrazky") == "/obrazky/sova-480.jpg 480w, /obrazky/sova-960.jpg 700w"
    assert srcset([], "/obrazky") == ""


def test_srcset_radi_podle_sirky():
    seznam = [
        {"soubor": "b.jpg", "sirka": 960, "vyska": 1},
        {"soubor": "a.jpg", "sirka": 480, "vyska": 1},
    ]
    assert srcset(seznam, "/o") == "/o/a.jpg 480w, /o/b.jpg 960w"


def test_sizes():
    assert sizes(3) == "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
    assert sizes(2) == "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 50vw"
    assert sizes(1) == "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 100vw"
    assert sizes(0) == sizes(1)
    assert sizes(-5) == sizes(1)


def test_zpracuj_projde_adresar(tmp_path):
    zdroj = tmp_path / "zdroj"
    uloz(zdroj / "sova.jpg", 2000, 1000)
    uloz(zdroj / "most.png", 1400, 900, format_="PNG")
    (zdroj / "poznamka.txt").write_text("nic", encoding="utf-8")
    vysledek = zpracuj(zdroj, tmp_path / "cil")
    assert sorted(vysledek) == ["most", "sova"]
    assert vysledek["sova"]["sirka"] == 2000
    assert vysledek["sova"]["vyska"] == 1000
    assert "480w" in vysledek["sova"]["srcset"]
    assert vysledek["sova"]["varianty"][0]["sirka"] == 480


def test_zpracuj_prezije_rozbity_soubor(tmp_path):
    zdroj = tmp_path / "zdroj"
    uloz(zdroj / "dobry.jpg", 1000, 500)
    (zdroj / "rozbity.jpg").write_bytes(b"to neni obrazek")
    vysledek = zpracuj(zdroj, tmp_path / "cil")
    assert sorted(vysledek) == ["dobry"]


def test_zpracuj_prazdny_adresar(tmp_path):
    (tmp_path / "zdroj").mkdir()
    assert zpracuj(tmp_path / "zdroj", tmp_path / "cil") == {}


def test_main(tmp_path, capsys):
    zdroj = tmp_path / "zdroj"
    uloz(zdroj / "sova.jpg", 1200, 800)
    assert main([str(zdroj), str(tmp_path / "cil")]) == 0
    assert main([str(tmp_path / "neni"), str(tmp_path / "cil")]) == 2


def test_main_umi_json(tmp_path, capsys):
    zdroj = tmp_path / "zdroj"
    uloz(zdroj / "sova.jpg", 1200, 800)
    main([str(zdroj), str(tmp_path / "cil"), "--json"])
    vysledek = json.loads(capsys.readouterr().out)
    assert "sova" in vysledek


def test_main_jde_spustit_jako_modul(tmp_path):
    zdroj = tmp_path / "zdroj"
    uloz(zdroj / "sova.jpg", 1200, 800)
    hotovo = subprocess.run(
        [sys.executable, "-m", "tools.fotky", str(zdroj), str(tmp_path / "cil"), "--json"],
        capture_output=True, text=True, cwd=KOREN, timeout=120,
    )
    assert hotovo.returncode == 0, hotovo.stderr[:500]
    assert "sova" in json.loads(hotovo.stdout)
