"""A gate over the finished site: sample wording, alt texts, links, prices, language pairs.

Runnable as ``python -m tools.kontrola_webu <directory>``. Reads the finished
HTML (the output of ``node build.mjs``) and checks the VISIBLE text, not the
templates. Standard library only.
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

DEFAULT_SAMPLES = [
    "ukázka", "ukazka", "demo", "smyšlen", "smyslen",
    "nikam se neodesílá", "nikam se neodesila", "jen ukázka", "jen ukazka",
]


# --- normalization without diacritics --------------------------------------

def _without_diacritics(text: str) -> str:
    spread = unicodedata.normalize("NFD", text)
    return "".join(c for c in spread if unicodedata.category(c) != "Mn")


def _normalized_with_map(text: str) -> tuple[str, list[int]]:
    """Normalized text (lower case, no diacritics) and a map of indexes onto the original."""
    normalize: list[str] = []
    mapa: list[int] = []
    for i, c in enumerate(text):
        n = _without_diacritics(c).lower()
        if not n:
            continue
        normalize.extend(n)
        mapa.extend([i] * len(n))
    return "".join(normalize), mapa


# --- the visible text -------------------------------------------------------

class _TextCollector(HTMLParser):
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
        for name, value in attrs:
            if name in TEXT_ATTRS and value:
                self.kusky.append(value)

    def handle_startendtag(self, tag, attrs):
        if self._skok or tag in SKIP_TAGS:
            return
        for name, value in attrs:
            if name in TEXT_ATTRS and value:
                self.kusky.append(value)

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self._skok:
            self._skok -= 1

    def handle_data(self, data):
        if not self._skok:
            self.kusky.append(data)


def viditelny_text(html: str) -> str:
    """The visible text of a page: no scripts, styles, templates, noscript or comments.

    Expands the entities and squeezes runs of whitespace into a single space.
    Attribute values belong to the text only for alt, title, aria-label and
    placeholder.
    """
    collector = _TextCollector()
    collector.feed(html)
    collector.close()
    text = " ".join(collector.kusky)
    return re.sub(r"\s+", " ", text).strip()


# --- collecting the HTML files ----------------------------------------------

def _html_files(koren) -> list[Path]:
    koren = Path(koren)
    return sorted(koren.rglob("*.html"), key=lambda p: p.relative_to(koren).as_posix())


# --- looking for the samples ------------------------------------------------

def _word_positions(text: str) -> list[tuple[str, int, int]]:
    """A list of (word, begin, end) for every word in the text (normalized)."""
    slova = []
    for m in re.finditer(r"\S+", text):
        normalize = _without_diacritics(m.group()).lower()
        if normalize:
            slova.append((normalize, m.start(), m.end()))
    return slova


def _word_matches(sample_word: str, text_word: str) -> bool:
    """A word fits when it is identical or shares a long enough stem."""
    if sample_word == text_word:
        return True
    length = 0
    for a, b in zip(sample_word, text_word):
        if a != b:
            break
        length += 1
    shorter = min(len(sample_word), len(text_word))
    return length >= 4 and length * 10 >= shorter * 6


def _find_in_text(text: str, sample: str) -> list[tuple[int, int]]:
    """The positions (begin, end) where the sample fits the text fuzzily."""
    normalize_sample = _without_diacritics(sample).lower()
    if not normalize_sample:
        return []
    # 1) A plain substring search
    normalize_text, mapa = _normalized_with_map(text)
    position = 0
    while True:
        i = normalize_text.find(normalize_sample, position)
        if i < 0:
            break
        begin = mapa[i]
        end = mapa[i + len(normalize_sample) - 1] + 1
        yield begin, end
        position = i + 1
    # 2) Fuzzy: the sample's words in order as a substring of the text's words
    #    (spaces allowed between them), each word fitting exactly or by its stem.
    sample_words = normalize_sample.split()
    text_slova = _word_positions(text)
    if len(sample_words) == 1:
        for word, begin, end in text_slova:
            if _word_matches(sample_words[0], word):
                yield begin, end
        return
    m = len(text_slova)
    for start in range(m):
        j = 0
        for k in range(start, m):
            if _word_matches(sample_words[j], text_slova[k][0]):
                j += 1
                if j == len(sample_words):
                    yield text_slova[start][1], text_slova[k][2]
                    break


def najdi(koren, vzorky) -> list[dict]:
    """Findings of the samples in the visible text, whatever the case and diacritics."""
    koren = Path(koren)
    findings: list[tuple[str, int, str, str]] = []
    for file_path in _html_files(koren):
        relative = file_path.relative_to(koren).as_posix()
        text = viditelny_text(file_path.read_text(encoding="utf-8"))
        # one position = one finding; samples with diacritics come first
        booked: set[int] = set()
        for diakriticky in (True, False):
            for sample in vzorky:
                ma_diakritiku = _without_diacritics(sample) != sample.lower()
                if diakriticky != ma_diakritiku:
                    continue
                for begin, end in _find_in_text(text, sample):
                    if begin in booked:
                        continue
                    crop = text[max(0, begin - 30):min(len(text), end + 30)]
                    findings.append((relative, begin, sample, crop))
                    booked.add(begin)
    findings.sort(key=lambda n: (n[0], n[1]))
    return [
        {"soubor": s, "vzorek": v, "vyrez": crop}
        for s, _p, v, crop in findings
    ]


# --- alt texts --------------------------------------------------------------

class _ImageCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.nalezy: list[str] = []
        self._skryty: int = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("aria-hidden", "").strip().lower() == "true":
            self._skryty += 1
        if tag == "img" and self._skryty == 0:
            alt = attributes.get("alt")
            if alt is None or not alt.strip():
                self.nalezy.append(attributes.get("src", ""))

    def handle_startendtag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "img" and self._skryty == 0:
            alt = attributes.get("alt")
            if alt is None or not alt.strip():
                self.nalezy.append(attributes.get("src", ""))

    def handle_endtag(self, tag):
        if self._skryty and tag not in VOID_TAGS:
            self._skryty -= 1


def alt_texty(koren) -> list[dict]:
    """<img> with no alt or an empty one (decorations in aria-hidden aside)."""
    koren = Path(koren)
    findings: list[dict] = []
    for file_path in _html_files(koren):
        relative = file_path.relative_to(koren).as_posix()
        collector = _ImageCollector()
        collector.feed(file_path.read_text(encoding="utf-8"))
        collector.close()
        for src in collector.nalezy:
            findings.append({"soubor": relative, "src": src})
    return findings


# --- internal links ---------------------------------------------------------

def _je_vnitrni(href: str) -> bool:
    if href.startswith("/"):
        return True
    if "://" in href:
        return False
    if href.startswith(("#", "mailto:", "tel:")):
        return False
    return True


def _link_targets(koren: Path, file_path: Path, href: str) -> Path:
    path = href.split("#", 1)[0].split("?", 1)[0]
    if path.endswith("/"):
        path += "index.html"
    if path.startswith("/"):
        return koren / path.lstrip("/")
    return (file_path.parent / path)


def odkazy(koren) -> list[dict]:
    """Internal links that do not lead to an existing file."""
    koren = Path(koren)
    findings: list[dict] = []
    for file_path in _html_files(koren):
        relative = file_path.relative_to(koren).as_posix()
        parser = _LinkCollector()
        parser.feed(file_path.read_text(encoding="utf-8"))
        parser.close()
        for href in parser.odkazy:
            if not _je_vnitrni(href):
                continue
            target = _link_targets(koren, file_path, href)
            if not target.exists():
                findings.append({"soubor": relative, "href": href})
    return findings


class _LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.odkazy: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.odkazy.append(href)

    handle_startendtag = handle_starttag


# --- language pairs ---------------------------------------------------------

class _HreflangCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hreflang: set[str] = set()

    def handle_starttag(self, tag, attrs):
        if tag != "link":
            return
        attributes = dict(attrs)
        if attributes.get("rel", "").strip().lower() != "alternate":
            return
        language = attributes.get("hreflang", "").strip().lower()
        if language:
            self.hreflang.add(language)

    handle_startendtag = handle_starttag


def _cross_origin_candidate(relative: str) -> str | None:
    """The path to the counterpart in the other language, or None for the root indexes."""
    if relative.startswith("en/"):
        return relative[3:]
    if relative == "index.html":
        return None
    return "en/" + relative


def jazykove_dvojice(koren) -> list[dict]:
    """A missing counterpart in the other language and missing hreflang links."""
    koren = Path(koren)
    files = _html_files(koren)
    relative_paths = {s.relative_to(koren).as_posix() for s in files}
    findings: list[dict] = []
    for file_path in files:
        relative = file_path.relative_to(koren).as_posix()
        content = file_path.read_text(encoding="utf-8")
        # the counterpart
        candidate = _cross_origin_candidate(relative)
        if candidate is not None and candidate not in relative_paths:
            findings.append({"soubor": relative, "chybi": "protejsek"})
        # hreflang for both languages
        collector = _HreflangCollector()
        collector.feed(content)
        collector.close()
        if not {"cs", "en"} <= collector.hreflang:
            findings.append({"soubor": relative, "chybi": "hreflang"})
    return findings


def ceny(koren) -> list[dict]:
    """Shop pages with no visible price (``Kč`` / CZK)."""
    koren = Path(koren)
    findings: list[dict] = []
    for file_path in _html_files(koren):
        relative = file_path.relative_to(koren).as_posix()
        if "obrazy-k-prodeji" not in relative and "works-for-sale" not in relative:
            continue
        text = viditelny_text(file_path.read_text(encoding="utf-8"))
        if "Kč" not in text and "CZK" not in text.upper():
            findings.append({"soubor": relative, "chybi": "cena"})
    return findings


# --- celek ------------------------------------------------------------------

def kontrola(koren, ostry: bool, vzorky=None) -> dict:
    """All the checks together."""
    koren = Path(koren)
    files = _html_files(koren)
    demo = najdi(koren, vzorky if vzorky is not None else DEFAULT_SAMPLES) if ostry else []
    result = {
        "soubory": len(files),
        "ukazka": demo,
        "alt": alt_texty(koren),
        "odkazy": odkazy(koren),
        "dvojice": jazykove_dvojice(koren),
        "ceny": ceny(koren),
    }
    result["nalezu"] = sum(
        len(result[k]) for k in ("ukazka", "alt", "odkazy", "dvojice", "ceny")
    )
    return result


# --- CLI --------------------------------------------------------------------

def _describe_finding(category: str, finding: dict) -> str:
    if category == "ukazka":
        return f"  {finding['soubor']}: vzorek {finding['vzorek']!r} — …{finding['vyrez']}…"
    if category == "alt":
        return f"  {finding['soubor']}: <img src={finding['src']!r}> bez alt"
    if category == "odkazy":
        return f"  {finding['soubor']}: slepý odkaz {finding['href']!r}"
    return f"  {finding['soubor']}: chybí {finding['chybi']}"


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

    result = kontrola(koren, ostry=args.ostry)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for category in ("ukazka", "alt", "odkazy", "dvojice", "ceny"):
            print(f"{category}: {len(result[category])}")
        for category in ("ukazka", "alt", "odkazy", "dvojice", "ceny"):
            for finding in result[category]:
                print(_describe_finding(category, finding))
    return 0 if result["nalezu"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
