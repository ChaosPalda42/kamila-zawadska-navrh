"""Brána nad hotovým webem: ukázkové hlášky, alt texty, odkazy, ceny, jazykové dvojice.

Spustitelné jako ``python -m tools.kontrola_webu <adresar>``. Čte hotové HTML
(výstup ``node build.mjs``) a kontroluje VIDITELNÝ text, ne šablony.
Jen standardní knihovna.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}
SKIP_TAGS = {"script", "style", "template", "noscript"}
TEXT_ATTRS = ("alt", "title", "aria-label", "placeholder")

VYCHOZI_VZORKY = [
    "ukázka", "ukazka", "demo", "smyšlen", "smyslen",
    "nikam se neodesílá", "nikam se neodesila", "jen ukázka", "jen ukazka",
]


# --- normalizace bez diakritiky --------------------------------------------

def _bez_diakritiky(text: str) -> str:
    rozlozene = unicodedata.normalize("NFD", text)
    return "".join(c for c in rozlozene if unicodedata.category(c) != "Mn")


def _normalizovany_s_mapou(text: str) -> tuple[str, list[int]]:
    """Normalizovaný text (malá písmena, bez diakritiky) a mapa indexů na původní text."""
    norm: list[str] = []
    mapa: list[int] = []
    for i, c in enumerate(text):
        n = _bez_diakritiky(c).lower()
        if not n:
            continue
        norm.extend(n)
        mapa.extend([i] * len(n))
    return "".join(norm), mapa


# --- viditelný text ---------------------------------------------------------

class _SbiracTextu(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.kusky: list[str] = []
        self._skok: int = 0

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skok += 1
            return
        if self._skok:
            return
        for jmeno, hodnota in attrs:
            if jmeno in TEXT_ATTRS and hodnota:
                self.kusky.append(hodnota)

    def handle_startendtag(self, tag, attrs):
        if self._skok or tag in SKIP_TAGS:
            return
        for jmeno, hodnota in attrs:
            if jmeno in TEXT_ATTRS and hodnota:
                self.kusky.append(hodnota)

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self._skok:
            self._skok -= 1

    def handle_data(self, data):
        if not self._skok:
            self.kusky.append(data)


def viditelny_text(html: str) -> str:
    """Viditelný text stránky: bez skriptů, stylů, šablon, noscript a komentářů.

    Rozbalí entity, srazí vícenásobné bílé znaky na jednu mezeru. Hodnoty
    atributů patří do textu jen u alt, title, aria-label a placeholder.
    """
    sbirac = _SbiracTextu()
    sbirac.feed(html)
    sbirac.close()
    text = " ".join(sbirac.kusky)
    return re.sub(r"\s+", " ", text).strip()


# --- sběr HTML souborů ------------------------------------------------------

def _html_soubory(koren) -> list[Path]:
    koren = Path(koren)
    return sorted(koren.rglob("*.html"), key=lambda p: p.relative_to(koren).as_posix())


# --- hledání vzorků ---------------------------------------------------------

def _slovni_pozice(text: str) -> list[tuple[str, int, int]]:
    """Seznam (slovo, zacatek, konec) pro každé slovo v textu (normalizované)."""
    slova = []
    for m in re.finditer(r"\S+", text):
        norm = _bez_diakritiky(m.group()).lower()
        if norm:
            slova.append((norm, m.start(), m.end()))
    return slova


def _slovo_sedi(vzorek_slovo: str, text_slovo: str) -> bool:
    """Slovo sedí, pokud je identické nebo sdílí dostatečně dlouhý kmen."""
    if vzorek_slovo == text_slovo:
        return True
    delka = 0
    for a, b in zip(vzorek_slovo, text_slovo):
        if a != b:
            break
        delka += 1
    kratse = min(len(vzorek_slovo), len(text_slovo))
    return delka >= 4 and delka * 10 >= kratse * 6


def _najdi_v_textu(text: str, vzorek: str) -> list[tuple[int, int]]:
    """Najde pozice (zacatek, konec) kde vzorek fuzzy sedí v textu."""
    norm_vzorek = _bez_diakritiky(vzorek).lower()
    if not norm_vzorek:
        return []
    # 1) Přímé podřetězcové hledání
    norm_text, mapa = _normalizovany_s_mapou(text)
    pozice = 0
    while True:
        i = norm_text.find(norm_vzorek, pozice)
        if i < 0:
            break
        zacatek = mapa[i]
        konec = mapa[i + len(norm_vzorek) - 1] + 1
        yield zacatek, konec
        pozice = i + 1
    # 2) Fuzzy: slova vzorku v pořadí jako podřetězec slov textu (mezi slovy
    #    smí být mezery), každé slovo sedí přesně nebo po kmenech.
    vzorek_slova = norm_vzorek.split()
    text_slova = _slovni_pozice(text)
    if len(vzorek_slova) == 1:
        for slovo, zacatek, konec in text_slova:
            if _slovo_sedi(vzorek_slova[0], slovo):
                yield zacatek, konec
        return
    m = len(text_slova)
    for start in range(m):
        j = 0
        for k in range(start, m):
            if _slovo_sedi(vzorek_slova[j], text_slova[k][0]):
                j += 1
                if j == len(vzorek_slova):
                    yield text_slova[start][1], text_slova[k][2]
                    break


def najdi(koren, vzorky) -> list[dict]:
    """Nálezy vzorků ve viditelném textu, bez ohledu na velikost a diakritiku."""
    koren = Path(koren)
    nalezy: list[tuple[str, int, str, str]] = []
    for soubor in _html_soubory(koren):
        relativni = soubor.relative_to(koren).as_posix()
        text = viditelny_text(soubor.read_text(encoding="utf-8"))
        # jedna pozice = jeden nález; vzorky s diakritikou mají přednost
        obsazene: set[int] = set()
        for diakriticky in (True, False):
            for vzorek in vzorky:
                ma_diakritiku = _bez_diakritiky(vzorek) != vzorek.lower()
                if diakriticky != ma_diakritiku:
                    continue
                for zacatek, konec in _najdi_v_textu(text, vzorek):
                    if zacatek in obsazene:
                        continue
                    vyrez = text[max(0, zacatek - 30):min(len(text), konec + 30)]
                    nalezy.append((relativni, zacatek, vzorek, vyrez))
                    obsazene.add(zacatek)
    nalezy.sort(key=lambda n: (n[0], n[1]))
    return [
        {"soubor": s, "vzorek": v, "vyrez": vyrez}
        for s, _p, v, vyrez in nalezy
    ]


# --- alt texty --------------------------------------------------------------

class _SbiracObrazu(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.nalezy: list[str] = []
        self._skryty: int = 0

    def handle_starttag(self, tag, attrs):
        atributy = dict(attrs)
        if atributy.get("aria-hidden", "").strip().lower() == "true":
            self._skryty += 1
        if tag == "img" and self._skryty == 0:
            alt = atributy.get("alt")
            if alt is None or not alt.strip():
                self.nalezy.append(atributy.get("src", ""))

    def handle_startendtag(self, tag, attrs):
        atributy = dict(attrs)
        if tag == "img" and self._skryty == 0:
            alt = atributy.get("alt")
            if alt is None or not alt.strip():
                self.nalezy.append(atributy.get("src", ""))

    def handle_endtag(self, tag):
        if self._skryty and tag not in VOID_TAGS:
            self._skryty -= 1


def alt_texty(koren) -> list[dict]:
    """<img> bez alt nebo s prázdným alt (kromě ozdob v aria-hidden)."""
    koren = Path(koren)
    nalezy: list[dict] = []
    for soubor in _html_soubory(koren):
        relativni = soubor.relative_to(koren).as_posix()
        sbirac = _SbiracObrazu()
        sbirac.feed(soubor.read_text(encoding="utf-8"))
        sbirac.close()
        for src in sbirac.nalezy:
            nalezy.append({"soubor": relativni, "src": src})
    return nalezy


# --- vnitřní odkazy ---------------------------------------------------------

def _je_vnitrni(href: str) -> bool:
    if href.startswith("/"):
        return True
    if "://" in href:
        return False
    if href.startswith(("#", "mailto:", "tel:")):
        return False
    return True


def _cile_odkazu(koren: Path, soubor: Path, href: str) -> Path:
    cesta = href.split("#", 1)[0].split("?", 1)[0]
    if cesta.endswith("/"):
        cesta += "index.html"
    if cesta.startswith("/"):
        return koren / cesta.lstrip("/")
    return (soubor.parent / cesta)


def odkazy(koren) -> list[dict]:
    """Vnitřní odkazy, které nevedou na existující soubor."""
    koren = Path(koren)
    nalezy: list[dict] = []
    for soubor in _html_soubory(koren):
        relativni = soubor.relative_to(koren).as_posix()
        parser = _SbiracOdkazu()
        parser.feed(soubor.read_text(encoding="utf-8"))
        parser.close()
        for href in parser.odkazy:
            if not _je_vnitrni(href):
                continue
            cil = _cile_odkazu(koren, soubor, href)
            if not cil.exists():
                nalezy.append({"soubor": relativni, "href": href})
    return nalezy


class _SbiracOdkazu(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.odkazy: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.odkazy.append(href)

    handle_startendtag = handle_starttag


# --- jazykové dvojice -------------------------------------------------------

class _SbiracHreflang(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hreflang: set[str] = set()

    def handle_starttag(self, tag, attrs):
        if tag != "link":
            return
        atributy = dict(attrs)
        if atributy.get("rel", "").strip().lower() != "alternate":
            return
        jazyk = atributy.get("hreflang", "").strip().lower()
        if jazyk:
            self.hreflang.add(jazyk)

    handle_startendtag = handle_starttag


def _protispolny_kandidat(relativni: str) -> str | None:
    """Cesta k protějšku v druhém jazyce, nebo None pro kořenové indexy."""
    if relativni.startswith("en/"):
        return relativni[3:]
    if relativni == "index.html":
        return None
    return "en/" + relativni


def jazykove_dvojice(koren) -> list[dict]:
    """Chybějící protějšek v druhém jazyce a chybějící hreflang odkazy."""
    koren = Path(koren)
    soubory = _html_soubory(koren)
    relativni_cesty = {s.relative_to(koren).as_posix() for s in soubory}
    nalezy: list[dict] = []
    for soubor in soubory:
        relativni = soubor.relative_to(koren).as_posix()
        obsah = soubor.read_text(encoding="utf-8")
        # protějšek
        kandidat = _protispolny_kandidat(relativni)
        if kandidat is not None and kandidat not in relativni_cesty:
            nalezy.append({"soubor": relativni, "chybi": "protejsek"})
        # hreflang pro oba jazyky
        sbirac = _SbiracHreflang()
        sbirac.feed(obsah)
        sbirac.close()
        if not {"cs", "en"} <= sbirac.hreflang:
            nalezy.append({"soubor": relativni, "chybi": "hreflang"})
    return nalezy


def ceny(koren) -> list[dict]:
    """Stránky e-shopu bez viditelné ceny (Kč / CZK)."""
    koren = Path(koren)
    nalezy: list[dict] = []
    for soubor in _html_soubory(koren):
        relativni = soubor.relative_to(koren).as_posix()
        if "obrazy-k-prodeji" not in relativni and "works-for-sale" not in relativni:
            continue
        text = viditelny_text(soubor.read_text(encoding="utf-8"))
        if "Kč" not in text and "CZK" not in text.upper():
            nalezy.append({"soubor": relativni, "chybi": "cena"})
    return nalezy


# --- celek ------------------------------------------------------------------

def kontrola(koren, ostry: bool, vzorky=None) -> dict:
    """Všechny kontroly dohromady."""
    koren = Path(koren)
    soubory = _html_soubory(koren)
    ukazka = najdi(koren, vzorky if vzorky is not None else VYCHOZI_VZORKY) if ostry else []
    vysledek = {
        "soubory": len(soubory),
        "ukazka": ukazka,
        "alt": alt_texty(koren),
        "odkazy": odkazy(koren),
        "dvojice": jazykove_dvojice(koren),
        "ceny": ceny(koren),
    }
    vysledek["nalezu"] = sum(
        len(vysledek[k]) for k in ("ukazka", "alt", "odkazy", "dvojice", "ceny")
    )
    return vysledek


# --- CLI --------------------------------------------------------------------

def _popis_nalezu(kategorie: str, nalez: dict) -> str:
    if kategorie == "ukazka":
        return f"  {nalez['soubor']}: vzorek {nalez['vzorek']!r} — …{nalez['vyrez']}…"
    if kategorie == "alt":
        return f"  {nalez['soubor']}: <img src={nalez['src']!r}> bez alt"
    if kategorie == "odkazy":
        return f"  {nalez['soubor']}: slepý odkaz {nalez['href']!r}"
    return f"  {nalez['soubor']}: chybí {nalez['chybi']}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="kontrola_webu",
        description="Brána nad hotovým webem: hlášky, alt texty, odkazy, ceny, dvojice.",
    )
    parser.add_argument("adresar", help="adresář s hotovým webem (výstup build.mjs)")
    parser.add_argument("--ostry", action="store_true", help="zapne kontrolu ukázkových hlášek")
    parser.add_argument("--json", action="store_true", help="vytiskne výsledek jako JSON")
    args = parser.parse_args(argv)

    koren = Path(args.adresar)
    if not koren.is_dir():
        print(f"adresář neexistuje: {args.adresar}", file=sys.stderr)
        return 2

    vysledek = kontrola(koren, ostry=args.ostry)
    if args.json:
        print(json.dumps(vysledek, ensure_ascii=False, indent=2))
    else:
        for kategorie in ("ukazka", "alt", "odkazy", "dvojice", "ceny"):
            print(f"{kategorie}: {len(vysledek[kategorie])}")
        for kategorie in ("ukazka", "alt", "odkazy", "dvojice", "ceny"):
            for nalez in vysledek[kategorie]:
                print(_popis_nalezu(kategorie, nalez))
    return 0 if vysledek["nalezu"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
