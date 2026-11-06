"""Předvolba cesty: hotový web přesazený do podadresáře.

Spustitelné jako ``python -m tools.predvolba <adresar> <predvolba>``. Mění
hotové HTML a CSS v daném adresáři (výstup ``node build.mjs``) na místě:
adresa, která začíná jedním "/", dostane předvolbu. Zdroj zůstává čistý pro
ostrou doménu. Jen standardní knihovna.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Atributy, jejichž hodnoty se přepisují (srcset zvlášť — kandidáti).
JEDNODUCHY_VZOREC = re.compile(
    r"(?i)(?<![\w-])(href|src|action|poster|formaction|data-kosik-cesta)"
    r"\s*=\s*(\"([^\"]*)\"|'([^']*)')"
)
SRCSET_VZOREC = re.compile(
    r"(?i)(?<![\w-])srcset\s*=\s*(\"([^\"]*)\"|'([^']*)')"
)
SCHEMA_VZOREC = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
CSS_URL_VZOREC = re.compile(r"(?i)url\(\s*(\"|')?([^\"')]+)\1?\s*\)")


# --- normalizace předvolby --------------------------------------------------

def uprav_predvolbu(predvolba: str) -> str:
    """Doplní vedoucí "/", odřízne koncová "/", srazí opakovaná "/".

    Prázdný řetězec, "/" i "///" dají "".
    """
    srazene = re.sub(r"/+", "/", predvolba.strip())
    srazene = srazene.strip("/")
    if not srazene:
        return ""
    return "/" + srazene


# --- přepis jednotlivých adres ----------------------------------------------

def _pripoj(predvolba: str, hodnota: str) -> str:
    """Přepíše hodnotu na predvolba + hodnota, pokud to pravidla dovolí."""
    if not predvolba or not hodnota:
        return hodnota
    if not hodnota.startswith("/"):
        return hodnota  # relativní cesta bez vedoucího "/"
    if hodnota.startswith("//"):
        return hodnota  # adresa bez schématu
    if SCHEMA_VZOREC.match(hodnota):
        return hodnota  # https:, http:, mailto:, tel:, data: …
    if hodnota.startswith(("#", "?")):
        return hodnota  # kotva / dotaz
    if hodnota == predvolba or hodnota.startswith(predvolba + "/"):
        return hodnota  # už předvolbou začíná
    return predvolba + hodnota


def _srcset_kandidati(hodnota: str, predvolba: str) -> tuple[str, int]:
    """Přepíše adresu každého kandidáta; deskriptor (800w, 2x) zůstane."""
    kandidati = []
    adres = 0
    for kus in hodnota.split(","):
        casti = kus.split(None, 1)
        adresa = _pripoj(predvolba, casti[0])
        if adresa != casti[0]:
            adres += 1
        kandidati.append(adresa + (" " + casti[1] if len(casti) > 1 else ""))
    return ", ".join(kandidati), adres


def _hodnota_z_matchu(m: re.Match, dvojite: int, jednoduche: int) -> str:
    """Vnitřní hodnota uvozovky: dvojité uvozovky v group dvojite, jinak jednoduche."""
    return m.group(dvojite) if m.group(dvojite) is not None else m.group(jednoduche)


# --- HTML -------------------------------------------------------------------

def preved_html(html: str, predvolba: str) -> str:
    """Přepíše adresy v vyjmenovaných atributech; text a cizí atributy ne."""
    if not predvolba:
        return html

    def jednoduchy(m: re.Match) -> str:
        hodnota = _hodnota_z_matchu(m, 3, 4)
        return m.group(0).replace(hodnota, _pripoj(predvolba, hodnota))

    vysledek = JEDNODUCHY_VZOREC.sub(jednoduchy, html)

    def srcset(m: re.Match) -> str:
        hodnota = _hodnota_z_matchu(m, 2, 3)
        novy, _ = _srcset_kandidati(hodnota, predvolba)
        return m.group(0).replace(hodnota, novy)

    vysledek = SRCSET_VZOREC.sub(srcset, vysledek)
    return vysledek


# --- CSS --------------------------------------------------------------------

def preved_css(css: str, predvolba: str) -> str:
    """url(/x), url("/x") a url('/x') dostanou předvolbu; výjimky jako v HTML."""
    if not predvolba:
        return css

    def url(m: re.Match) -> str:
        hodnota = m.group(2)
        return m.group(0).replace(hodnota, _pripoj(predvolba, hodnota))

    return CSS_URL_VZOREC.sub(url, css)


# --- celý adresář -----------------------------------------------------------

def preved(koren, predvolba: str) -> dict:
    """Projde *.html a *.css pod korenem, přepíše na místě, vrátí počty."""
    koren = Path(koren)
    souboru = 0
    adres = 0
    soubory = sorted(
        list(koren.rglob("*.html")) + list(koren.rglob("*.css")),
        key=lambda p: p.relative_to(koren).as_posix(),
    )
    for soubor in soubory:
        obsah = soubor.read_text(encoding="utf-8")
        if soubor.suffix == ".html":
            novy, pocet = _preved_html_s_poctem(obsah, predvolba)
        else:
            novy, pocet = _preved_css_s_poctem(obsah, predvolba)
        if novy == obsah:
            continue
        soubor.write_text(novy, encoding="utf-8")
        souboru += 1
        adres += pocet
    return {"souboru": souboru, "adres": adres}


def _preved_html_s_poctem(html: str, predvolba: str) -> tuple[str, int]:
    """Jako preved_html, ale vrátí i počet přepsaných adres."""
    if not predvolba:
        return html, 0
    pocet = 0

    def jednoduchy(m: re.Match) -> str:
        nonlocal pocet
        hodnota = _hodnota_z_matchu(m, 3, 4)
        novy = _pripoj(predvolba, hodnota)
        if novy != hodnota:
            pocet += 1
        return m.group(0).replace(hodnota, novy)

    vysledek = JEDNODUCHY_VZOREC.sub(jednoduchy, html)

    def srcset(m: re.Match) -> str:
        nonlocal pocet
        hodnota = _hodnota_z_matchu(m, 2, 3)
        novy, kolik = _srcset_kandidati(hodnota, predvolba)
        pocet += kolik
        return m.group(0).replace(hodnota, novy)

    vysledek = SRCSET_VZOREC.sub(srcset, vysledek)
    return vysledek, pocet


def _preved_css_s_poctem(css: str, predvolba: str) -> tuple[str, int]:
    """Jako preved_css, ale vrátí i počet přepsaných adres."""
    if not predvolba:
        return css, 0
    pocet = 0

    def url(m: re.Match) -> str:
        nonlocal pocet
        hodnota = m.group(2)
        novy = _pripoj(predvolba, hodnota)
        if novy != hodnota:
            pocet += 1
        return m.group(0).replace(hodnota, novy)

    return CSS_URL_VZOREC.sub(url, css), pocet


# --- CLI --------------------------------------------------------------------

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="predvolba",
        description="Přesadí hotový web (výstup build.mjs) do podadresáře.",
    )
    parser.add_argument("adresar", help="adresář s hotovým webem")
    parser.add_argument("predvolba", help="podadresář, např. /ukazka")
    args = parser.parse_args(argv)

    koren = Path(args.adresar)
    if not koren.is_dir():
        print(f"adresář neexistuje: {args.adresar}", file=sys.stderr)
        return 2

    predvolba = uprav_predvolbu(args.predvolba)
    vysledek = preved(koren, predvolba)
    print(f"predvolba: {predvolba}, souboru: {vysledek['souboru']}, adres: {vysledek['adres']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
