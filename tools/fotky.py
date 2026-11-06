"""Varianty fotek a srcset se SKUTEČNou šířkou uloženého souboru.

Spustitelné jako ``python -m tools.fotky <zdroj> <cil>``. Používá Pillow
(PIL), jinak jen standardní knihovnu.
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

PRIPUSTENE_PRIPONY = {".jpg", ".jpeg", ".png", ".webp"}


def nazev(zaklad: str, sirka: int) -> str:
    """Jméno souboru varianty: ``<zaklad>-<sirka>.jpg``."""
    return f"{zaklad}-{sirka}.jpg"


def zmensi(obrazek: Image.Image, sirka: int) -> Image.Image:
    """Nová instance zmenšená na danou šířku se zachovaným poměrem stran.

    Výška je zaokrouhlená na celé pixely (nejméně 1) a výsledek je v RGB.
    Obrázek užší než ``sirka`` se nezvětšuje — vrátí se kopie v původní
    velikosti.
    """
    if obrazek.width <= sirka:
        return obrazek.copy().convert("RGB")
    vyska = max(1, round(obrazek.height * sirka / obrazek.width))
    return obrazek.resize((sirka, vyska), Image.LANCZOS).convert("RGB")


def varianty(zdroj, cil, zaklad: str | None = None, sirky=SIRKY) -> list[dict]:
    """Z jednoho obrázku udělá varianty do adresáře ``cil``.

    Vrací seznam ``{"soubor", "sirka", "vyska"}`` se SKUTEČNými rozměry
    uložených souborů, seřazený podle šířky vzestupně. Varianty, které by
    vznikly zvětšováním, se neukládají dvakrát: pro šířku větší než
    originál vznikne soubor v šířce originálu a stejná skutečná šířka se
    v seznamu objeví jen jednou (pod názvem s nejmenším požadovaným
    rozměrem).
    """
    zdroj = Path(zdroj)
    cil = Path(cil)
    if zaklad is None:
        zaklad = zdroj.stem
    cil.mkdir(parents=True, exist_ok=True)

    obrazek = Image.open(zdroj)
    obrazek.load()
    obrazek = obrazek.convert("RGB")

    ulozeno: dict[int, dict] = {}
    for sirka in sirky:
        zmenena = zmensi(obrazek, sirka)
        skutecna = zmenena.width
        if skutecna in ulozeno:
            continue  # stejná skutečná šířka — nejdřív přišel menší požadavek
        soubor = nazev(zaklad, sirka)
        zmenena.save(
            cil / soubor,
            "JPEG",
            quality=82,
            optimize=True,
            progressive=True,
        )
        ulozeno[skutecna] = {
            "soubor": soubor,
            "sirka": skutecna,
            "vyska": zmenena.height,
        }
    return [ulozeno[s] for s in sorted(ulozeno)]


def srcset(varianty_seznam: list[dict], zaklad_cesty: str) -> str:
    """Řetězec do atributu srcset se SKUTEČNou šířkou z ``varianty_seznam``."""
    if not varianty_seznam:
        return ""
    zaklad_cesty = zaklad_cesty.rstrip("/")
    usporadane = sorted(varianty_seznam, key=lambda v: v["sirka"])
    return ", ".join(
        f"{zaklad_cesty}/{v['soubor']} {v['sirka']}w" for v in usporadane
    )


def sizes(sloupce: int) -> str:
    """Atribut sizes pro mřížku o ``sloupce`` sloupcích na širokém okně."""
    sloupce = max(1, sloupce)
    return (
        "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, "
        f"{100 // sloupce}vw"
    )


def zpracuj(adresar_zdroj, adresar_cil, sirky=SIRKY) -> dict:
    """Projde fotky v ``adresar_zdroj`` (ne rekurzivně) a udělá varianty.

    Vrací ``{zaklad: {"varianty", "srcset", "sirka", "vyska"}}``. Soubor,
    který Pillow nepřečte, se do výsledku nedostane a neshodí běh.
    """
    adresar_zdroj = Path(adresar_zdroj)
    adresar_cil = Path(adresar_cil)
    vysledek: dict[str, dict] = {}
    soubory = sorted(
        (
            s
            for s in adresar_zdroj.iterdir()
            if s.is_file() and s.suffix.lower() in PRIPUSTENE_PRIPONY
        ),
        key=lambda s: s.name,
    )
    for soubor in soubory:
        try:
            with Image.open(soubor) as obrazek:
                obrazek.load()
                sirka, vyska = obrazek.size
            seznam = varianty(soubor, adresar_cil, sirky=sirky)
        except Exception:
            logger.exception("soubor se nepodařilo zpracovat: %s", soubor.name)
            continue
        vysledek[soubor.stem] = {
            "varianty": seznam,
            "srcset": srcset(seznam, "obrazky"),
            "sirka": sirka,
            "vyska": vyska,
        }
    return vysledek


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

    vysledek = zpracuj(zdroj, args.cil)
    if args.json:
        print(json.dumps(vysledek, ensure_ascii=False, indent=2))
    else:
        print(f"zpracováno fotek: {len(vysledek)}")
        for zaklad, data in vysledek.items():
            print(
                f"  {zaklad}: {data['sirka']}x{data['vyska']} — "
                f"{len(data['varianty'])} variant"
            )
            for v in data["varianty"]:
                print(f"    {v['soubor']} ({v['sirka']}x{v['vyska']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
