"""Předvolha cesty: hotový web přesazený do podadresáře.

Spustitelné jako ``python -m tools.predvolba <adresar> <predvolba>``. Mění
hotové HTML a CSS v daném adresáři (výstup ``node build.mjs``) na místě:
adresa, která začíná jedním "/" , dostane předvolhu. Zdroj zůstává čistý pro
ostrou doménu. Jen standardní knihovna.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Atributy, jejichž hodnoty se přepisují (srcset zvlášť — kandidáti).
# JEDNODUCHY_VZOREC:
# 1: atribut (href|...)
# 2: celá hodnota s uvozovkami
# 3: content of escaped double quotes \\" ... \\"
# 4: content of normal double quotes " ... "
# 5: content of escaped single quotes \\' ... \\'
# 6: content of normal single quotes ' ... '
JEDNODUCHY_VZOREC = re.compile(
    r"(?i)(?<![\w-])(href|src|action|poster|formaction|data-kosik-cesta)"
    r"\s*=\s*("
    r"\\\"([^\\\"]*(?:\\\\\"[^\\\"]*)*)\\\""
    r"|"
    r"\"([^\\\"]*)\""
    r"|"
    r"\\'([^\\\']*(?:\\\\\'[^\\\']*)*)\\'"
    r"|"
    r"\'([^\']*)\'"
    r")"
)

# SRCSET_VZOREC:
# 1: celá hodnota s uvozovkami
# 2: content of escaped double quotes \\" ... \\"
# 3: content of normal double quotes " ... "
# 4: content of escaped single quotes \\' ... \\'
# 5: content of normal single quotes ' ... '
SRCSET_VZOREC = re.compile(
    r"(?i)(?<![\w-])srcset\s*=\s*("
    r"\\\"([^\\\"]*(?:\\\\\"[^\\\"]*)*)\\\""
    r"|"
    r"\"([^\\\"]*)\""
    r"|"
    r"\\'([^\\\']*(?:\\\\\'[^\\\']*)*)\\'"
    r"|"
    r"\'([^\']*)\'"
    r")"
)

SCHEMA_VZOREC = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
CSS_URL_VZOREC = re.compile(r"(?i)url\(\s*(\"|')?([^\"')]+)\1?\s*\)")

# Regex pro detekci <script type="application/json">...</script>
JSON_SKRIPT_VZOREC = re.compile(
    r'(?i)<script\s+type=["\']application/json["\'][^>]*>(.*?)</script>',
    re.DOTALL
)

# Regex pro řetězce v JSONu (včetně escapovaných uvozovek)
# Hledá "..." nebo '...' (v JSONu téměř vždy dvojité)
JSON_STRING_VZOREC = re.compile(r'("((?:[^"\\]|\\.)*)")')


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
        adresa_original = casti[0]
        adresa = _pripoj(predvolba, adresa_original)
        if adresa != adresa_original:
            adres += 1
        kandidati.append(adresa + (" " + casti[1] if len(casti) > 1 else ""))
    return ", ".join(kandidati), adres


# --- HTML -------------------------------------------------------------------

def preved_html(html: str, predvolba: str) -> str:
    """Přepíše adresy v vyjemených atributech; text a cizí atributy ne."""
    if not predvolba:
        return html
    res, _ = _preved_html_s_poctem(html, predvolba)
    return res


def _preved_html_s_poctem(html: str, predvolba: str) -> tuple[str, int]:
    """Jako preved_html, ale vrátí i počet přepsaných adres."""
    if not predvolba:
        return html, 0
    pocet = 0

    def jednoduchy_safe(m: re.Match) -> str:
        nonlocal pocet
        attr = m.group(1)
        
        hodnota = ""
        quote_type = "" # "e_d", "n_d", "e_s", "n_s"
        
        if m.group(3) is not None:
            hodnota = m.group(3)
            quote_type = "e_d"
        elif m.group(4) is not None:
            hodnota = m.group(4)
            quote_type = "n_d"
        elif m.group(5) is not None:
            hodnota = m.group(5)
            quote_type = "e_s"
        elif m.group(6) is not None:
            hodnota = m.group(6)
            quote_type = "n_s"
        else:
            return m.group(0)

        novy_hodnota = _pripoj(predvolba, hodnota)
        if novy_hodnota != hodnota:
            pocet += 1
            if quote_type == "e_d":
                return f'{attr}=\\"{novy_hodnota}\\"'
            elif quote_type == "n_d":
                return f'{attr}="{novy_hodnota}"'
            elif quote_type == "e_s":
                return f"\\'{novy_hodnota}\\'"
            elif quote_type == "n_s":
                return f"'{novy_hodnota}'"
        
        return m.group(0)

    def srcset_safe(m: re.Match) -> str:
        nonlocal pocet
        match_str = m.group(0)
        eq_idx = match_str.find('=')
        attr = match_str[:eq_idx].strip()
        
        hodnota = ""
        quote_type = ""
        
        if m.group(2) is not None:
            hodnota = m.group(2)
            quote_type = "e_d"
        elif m.group(3) is not None:
            hodnota = m.group(3)
            quote_type = "n_d"
        elif m.group(4) is not None:
            hodnota = m.group(4)
            quote_type = "e_s"
        elif m.group(5) is not None:
            hodnota = m.group(5)
            quote_type = "n_s"
        else:
            return m.group(0)

        novy_hodnota, kolik = _srcset_kandidati(hodnota, predvolba)
        if kolik > 0:
            pocet += kolik
            if quote_type == "e_d":
                return f'{attr}=\\"{novy_hodnota}\\"'
            elif quote_type == "n_d":
                return f'{attr}="{novy_hodnota}"'
            elif quote_type == "e_s":
                return f"\\'{novy_hodnota}\\'"
            elif quote_type == "n_s":
                return f"'{novy_hodnota}'"
        
        return m.group(0)

    def json_skript_callback(m: re.Match) -> str:
        nonlocal pocet
        # Pozice ze zápasu jsou pozice v CELÉM dokumentu, kdežto krájí se
        # nalezený úsek — proto se od nich odečítá jeho začátek. Bez toho
        # se blok dál od začátku souboru rozsekne, ztratí </script> a jeho
        # obsah se vysype na stránku jako text.
        zacatek = m.start()
        script_start = m.group(0)[:m.start(1) - zacatek]
        script_end = m.group(0)[m.end(1) - zacatek:]
        content = m.group(1)
        
        # Process content of JSON script
        # 1. srcset
        # 2. attributes
        # 3. plain strings
        
        def sub_srcset(ms: re.Match) -> str:
            nonlocal pocet
            match_str = ms.group(0)
            eq_idx = match_str.find('=')
            attr = match_str[:eq_idx].strip()
            hodnota = ""
            quote_type = ""
            if ms.group(2) is not None:
                hodnota = ms.group(2)
                quote_type = "e_d"
            elif ms.group(3) is not None:
                hodnota = ms.group(3)
                quote_type = "n_d"
            elif ms.group(4) is not None:
                hodnota = ms.group(4)
                quote_type = "e_s"
            elif ms.group(5) is not None:
                hodnota = ms.group(5)
                quote_type = "n_s"
            else: return ms.group(0)

            novy, kolik = _srcset_kandidati(hodnota, predvolba)
            if kolik > 0:
                pocet += kolik
                if quote_type == "e_d": return f'{attr}=\\"{novy}\\"'
                elif quote_type == "n_d": return f'{attr}="{novy}"'
                elif quote_type == "e_s": return f"\\'{novy}\\'"
                elif quote_type == "n_s": return f"'{novy}'"
            return ms.group(0)

        def sub_attr(ms: re.Match) -> str:
            nonlocal pocet
            attr = ms.group(1)
            hodnota = ""
            quote_type = ""
            if ms.group(3) is not None:
                hodnota = ms.group(3)
                quote_type = "e_d"
            elif ms.group(4) is not None:
                hodnota = ms.group(4)
                quote_type = "n_d"
            elif ms.group(5) is not None:
                hodnota = ms.group(5)
                quote_type = "e_s"
            elif ms.group(6) is not None:
                hodnota = ms.group(6)
                quote_type = "n_s"
            else: return ms.group(0)

            novy = _pripoj(predvolba, hodnota)
            if novy != hodnota:
                pocet += 1
                if quote_type == "e_d": return f'{attr}=\\"{novy}\\"'
                elif quote_type == "n_d": return f'{attr}="{novy}"'
                elif quote_type == "e_s": return f"\\'{novy}\\'"
                elif quote_type == "n_s": return f"'{novy}'"
            return ms.group(0)

        def sub_string(ms: re.Match) -> str:
            nonlocal pocet
            full_match = ms.group(1)
            content = ms.group(2)
            novy = _pripoj(predvolba, content)
            if novy != content:
                pocet += 1
                return f'"{novy}"'
            return full_match

        new_content = SRCSET_VZOREC.sub(sub_srcset, content)
        new_content = JEDNODUCHY_VZOREC.sub(sub_attr, new_content)
        new_content = JSON_STRING_VZOREC.sub(sub_string, new_content)
        
        return f"{script_start}{new_content}{script_end}"

    vysledek = JEDNODUCHY_VZOREC.sub(jednoduchy_safe, html)
    vysledek = SRCSET_VZOREC.sub(srcset_safe, vysledek)
    vysledek = JSON_SKRIPT_VZOREC.sub(json_skript_callback, vysledek)
    
    return vysledek, pocet


# --- CSS --------------------------------------------------------------------

def preved_css(css: str, predvolba: str) -> str:
    """url(/x), url(\"/x\") a url('/x') dostanou předvolhu; výjimky jako v HTML."""
    if not predvolba:
        return css
    res, _ = _preved_css_s_poctem(css, predvolba)
    return res


def _preved_css_s_poctem(css: str, predvolba: str) -> tuple[str, int]:
    """Jako preved_css, ale vrátí i počet přepsaných adres."""
    if not predvolba:
        return css, 0
    pocet = 0

    def url_sub(m: re.Match) -> str:
        nonlocal pocet
        hodnota = m.group(2)
        novy_hodnota = _pripoj(predvolba, hodnota)
        if novy_hodnota != hodnota:
            pocet += 1
            return m.group(0).replace(hodnota, novy_hodnota)
        return m.group(0)

    return CSS_URL_VZOREC.sub(url_sub, css), pocet


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
