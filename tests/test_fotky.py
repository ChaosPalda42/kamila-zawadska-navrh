"""Acceptance test C-010 -- `tools/fotky.py` (photo variants and srcset).

A srcset has to report the REAL width of the saved file. On the Truhlarstvi
Valcik site that was an actual bug: the srcsets reported the asked-for 1600,
not the measured width.
"""
from __future__ import annotations

import pathlib

import json
import subprocess
import sys
from pathlib import Path

import pytest
from PIL import Image

from tools.fotky import SIRKY, nazev, sizes, srcset, varianty, zmensi, zpracuj, main

ROOT = Path(__file__).resolve().parents[1]


def uloz(file_path: Path, width: int, height: int, format_="JPEG") -> Path:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (width, height), (120, 90, 60)).save(file_path, format_)
    return file_path


def test_sirky():
    assert SIRKY == (480, 960, 1600)


def test_nazev():
    assert nazev("sova", 960) == "sova-960.jpg"


def test_zmensi_drzi_pomer(tmp_path):
    image = Image.new("RGB", (2000, 1000))
    maly = zmensi(image, 480)
    assert maly.size == (480, 240)
    assert maly.mode == "RGB"


def test_zmensi_nezvetsuje(tmp_path):
    image = Image.new("RGB", (300, 200))
    assert zmensi(image, 960).size == (300, 200)


def test_zmensi_prevede_do_rgb():
    assert zmensi(Image.new("RGBA", (800, 400)), 480).mode == "RGB"
    assert zmensi(Image.new("L", (800, 400)), 480).mode == "RGB"


def test_zmensi_vyska_nikdy_nula():
    assert zmensi(Image.new("RGB", (4000, 3)), 480).size[1] >= 1


def test_varianty_hlasi_skutecnou_sirku(tmp_path):
    source = uloz(tmp_path / "zdroj" / "sova.jpg", 2000, 1000)
    result = varianty(source, tmp_path / "cil")
    assert [v["sirka"] for v in result] == [480, 960, 1600]
    for v in result:
        with Image.open(tmp_path / "cil" / v["soubor"]) as img:
            assert img.size == (v["sirka"], v["vyska"]), v["soubor"]


def test_varianty_u_male_fotky_nenafukuji_a_nezdvojuji(tmp_path):
    source = uloz(tmp_path / "zdroj" / "mala.jpg", 700, 500)
    result = varianty(source, tmp_path / "cil")
    widths = [v["sirka"] for v in result]
    assert widths == sorted(widths)
    assert len(widths) == len(set(widths)), "stejná šířka se v seznamu objeví jen jednou"
    assert max(widths) == 700, "nikdy se nezvětšuje nad originál"
    for v in result:
        with Image.open(tmp_path / "cil" / v["soubor"]) as img:
            assert img.width == v["sirka"]


def test_varianty_pouziji_jmeno_zdroje_nebo_zaklad(tmp_path):
    source = uloz(tmp_path / "zdroj" / "les-po-desti.jpg", 1200, 800)
    assert varianty(source, tmp_path / "a")[0]["soubor"].startswith("les-po-desti-")
    assert varianty(source, tmp_path / "b", zaklad="jiny")[0]["soubor"].startswith("jiny-")


def test_varianty_vytvori_adresar(tmp_path):
    source = uloz(tmp_path / "zdroj" / "x.jpg", 1000, 600)
    target = tmp_path / "hluboko" / "jeste" / "hloubeji"
    assert varianty(source, target)
    assert target.is_dir()


def test_varianty_umi_png_a_vraci_jpeg(tmp_path):
    source = uloz(tmp_path / "zdroj" / "kresba.png", 1200, 900, format_="PNG")
    result = varianty(source, tmp_path / "cil")
    assert all(v["soubor"].endswith(".jpg") for v in result)
    with Image.open(tmp_path / "cil" / result[0]["soubor"]) as img:
        assert img.format == "JPEG"


def test_srcset_bere_sirku_ze_seznamu():
    items = [
        {"soubor": "sova-480.jpg", "sirka": 480, "vyska": 240},
        {"soubor": "sova-960.jpg", "sirka": 700, "vyska": 350},
    ]
    assert srcset(items, "/obrazky") == "/obrazky/sova-480.jpg 480w, /obrazky/sova-960.jpg 700w"
    assert srcset([], "/obrazky") == ""


def test_srcset_radi_podle_sirky():
    items = [
        {"soubor": "b.jpg", "sirka": 960, "vyska": 1},
        {"soubor": "a.jpg", "sirka": 480, "vyska": 1},
    ]
    assert srcset(items, "/o") == "/o/a.jpg 480w, /o/b.jpg 960w"


def test_sizes():
    assert sizes(3) == "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
    assert sizes(2) == "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 50vw"
    assert sizes(1) == "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 100vw"
    assert sizes(0) == sizes(1)
    assert sizes(-5) == sizes(1)


def test_zpracuj_projde_adresar(tmp_path):
    source = tmp_path / "zdroj"
    uloz(source / "sova.jpg", 2000, 1000)
    uloz(source / "most.png", 1400, 900, format_="PNG")
    (source / "poznamka.txt").write_text("nic", encoding="utf-8")
    result = zpracuj(source, tmp_path / "cil")
    assert sorted(result) == ["most", "sova"]
    assert result["sova"]["sirka"] == 2000
    assert result["sova"]["vyska"] == 1000
    assert "480w" in result["sova"]["srcset"]
    assert result["sova"]["varianty"][0]["sirka"] == 480


def test_zpracuj_prezije_rozbity_soubor(tmp_path):
    source = tmp_path / "zdroj"
    uloz(source / "dobry.jpg", 1000, 500)
    (source / "rozbity.jpg").write_bytes(b"to neni obrazek")
    result = zpracuj(source, tmp_path / "cil")
    assert sorted(result) == ["dobry"]


def test_zpracuj_prazdny_adresar(tmp_path):
    (tmp_path / "zdroj").mkdir()
    assert zpracuj(tmp_path / "zdroj", tmp_path / "cil") == {}


def test_main(tmp_path, capsys):
    source = tmp_path / "zdroj"
    uloz(source / "sova.jpg", 1200, 800)
    assert main([str(source), str(tmp_path / "cil")]) == 0
    assert main([str(tmp_path / "neni"), str(tmp_path / "cil")]) == 2


def test_main_umi_json(tmp_path, capsys):
    source = tmp_path / "zdroj"
    uloz(source / "sova.jpg", 1200, 800)
    main([str(source), str(tmp_path / "cil"), "--json"])
    result = json.loads(capsys.readouterr().out)
    assert "sova" in result


def test_main_jde_spustit_jako_modul(tmp_path):
    source = tmp_path / "zdroj"
    uloz(source / "sova.jpg", 1200, 800)
    done = subprocess.run(
        [sys.executable, "-m", "tools.fotky", str(source), str(tmp_path / "cil"), "--json"],
        capture_output=True, text=True, cwd=ROOT, timeout=120,
    )
    assert done.returncode == 0, done.stderr[:500]
    assert "sova" in json.loads(done.stdout)


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "tools/fotky.py"
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

    path = "tools/fotky.py"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
