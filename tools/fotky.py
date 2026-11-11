"""Photo variants and a srcset carrying the REAL width of the saved file.

Runnable as ``python -m tools.fotky <source> <target>``. Uses Pillow
(PIL), otherwise only the standard library.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

from PIL import Image

SIRKY = (480, 960, 1600)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def nazev(zaklad: str, sirka: int) -> str:
    """The variant's file name: ``<zaklad>-<sirka>.jpg``."""
    return f"{zaklad}-{sirka}.jpg"


def zmensi(obrazek: Image.Image, sirka: int) -> Image.Image:
    """A new instance scaled down to the given width, with the aspect ratio kept.

    The height is rounded to whole pixels (at least 1) and the result is RGB.
    An image narrower than ``sirka`` is not enlarged -- a copy at the original
    size comes back.
    """
    if obrazek.width <= sirka:
        return obrazek.copy().convert("RGB")
    vyska = max(1, round(obrazek.height * sirka / obrazek.width))
    return obrazek.resize((sirka, vyska), Image.LANCZOS).convert("RGB")


def varianty(zdroj, cil, zaklad: str | None = None, sirky=SIRKY) -> list[dict]:
    """Turns one image into variants in the ``cil`` directory.

    Returns a list of ``{"soubor", "sirka", "vyska"}`` with the REAL sizes of
    the saved files, sorted by width ascending. Variants that would come out of
    enlarging are not saved twice: for a width larger than the original, a file
    at the original width appears and that same real width shows up in the list
    only once (under the name with the smallest requested size).
    """
    zdroj = Path(zdroj)
    cil = Path(cil)
    if zaklad is None:
        zaklad = zdroj.stem
    cil.mkdir(parents=True, exist_ok=True)

    obrazek = Image.open(zdroj)
    obrazek.load()
    obrazek = obrazek.convert("RGB")

    saved: dict[int, dict] = {}
    for sirka in sirky:
        changed = zmensi(obrazek, sirka)
        actual = changed.width
        if actual in saved:
            continue  # the same real width -- the smaller request came first
        file_path = nazev(zaklad, sirka)
        changed.save(
            cil / file_path,
            "JPEG",
            quality=82,
            optimize=True,
            progressive=True,
        )
        saved[actual] = {
            "soubor": file_path,
            "sirka": actual,
            "vyska": changed.height,
        }
    return [saved[s] for s in sorted(saved)]


def srcset(varianty_seznam: list[dict], zaklad_cesty: str) -> str:
    """The string for the srcset attribute, with the REAL width from ``varianty_seznam``."""
    if not varianty_seznam:
        return ""
    zaklad_cesty = zaklad_cesty.rstrip("/")
    ordered = sorted(varianty_seznam, key=lambda v: v["sirka"])
    return ", ".join(
        f"{zaklad_cesty}/{v['soubor']} {v['sirka']}w" for v in ordered
    )


def sizes(sloupce: int) -> str:
    """The sizes attribute for a grid of ``sloupce`` columns in a wide window."""
    sloupce = max(1, sloupce)
    return (
        "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, "
        f"{100 // sloupce}vw"
    )


def zpracuj(adresar_zdroj, adresar_cil, sirky=SIRKY) -> dict:
    """Walks the photos in ``adresar_zdroj`` (not recursively) and makes variants.

    Returns ``{zaklad: {"varianty", "srcset", "sirka", "vyska"}}``. A file that
    Pillow cannot read never reaches the result and does not bring the run down.
    """
    adresar_zdroj = Path(adresar_zdroj)
    adresar_cil = Path(adresar_cil)
    result: dict[str, dict] = {}
    files = sorted(
        (
            s
            for s in adresar_zdroj.iterdir()
            if s.is_file() and s.suffix.lower() in ALLOWED_EXTENSIONS
        ),
        key=lambda s: s.name,
    )
    for file_path in files:
        try:
            with Image.open(file_path) as obrazek:
                obrazek.load()
                sirka, vyska = obrazek.size
            variant_list = varianty(file_path, adresar_cil, sirky=sirky)
        except Exception:
            logger.exception("soubor se nepodařilo zpracovat: %s", file_path.name)
            continue
        result[file_path.stem] = {
            "varianty": variant_list,
            "srcset": srcset(variant_list, "obrazky"),
            "sirka": sirka,
            "vyska": vyska,
        }
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="fotky",
        description="Udělá z fotek varianty (480/960/1600) a srcset se skutečnou šířkou.",
    )
    parser.add_argument("zdroj", help="adresář se zdrojovými fotkami")
    parser.add_argument("cil", help="adresář pro varianty")
    parser.add_argument("--json", action="store_true", help="vytiskne výsledek jako JSON")
    args = parser.parse_args(argv)

    zdroj = Path(args.zdroj)
    if not zdroj.is_dir():
        print(f"zdroj neexistuje: {args.zdroj}", file=sys.stderr)
        return 2

    result = zpracuj(zdroj, args.cil)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"zpracováno fotek: {len(result)}")
        for zaklad, data in result.items():
            print(
                f"  {zaklad}: {data['sirka']}x{data['vyska']} — "
                f"{len(data['varianty'])} variant"
            )
            for v in data["varianty"]:
                print(f"    {v['soubor']} ({v['sirka']}x{v['vyska']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
