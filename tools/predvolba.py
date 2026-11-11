"""A path prefix: the finished site moved into a subdirectory.

Runnable as ``python -m tools.predvolba <directory> <prefix>``. Changes the
finished HTML and CSS in that directory (the output of ``node build.mjs``) in
place: an address that starts with a single "/" gets the prefix. The source
stays clean for the live domain. Standard library only.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# The attributes whose values get rewritten (srcset apart -- candidates).
# JEDNODUCHY_VZOREC:
# 1: atribut (href|...)
# 2: the whole value including the quotes
# 3: content of escaped double quotes \\" ... \\"
# 4: content of normal double quotes " ... "
# 5: content of escaped single quotes \\' ... \\'
# 6: content of normal single quotes ' ... '
SIMPLE_PATTERN = re.compile(
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
# 1: the whole value including the quotes
# 2: content of escaped double quotes \\" ... \\"
# 3: content of normal double quotes " ... "
# 4: content of escaped single quotes \\' ... \\'
# 5: content of normal single quotes ' ... '
SRCSET_PATTERN = re.compile(
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

SCHEME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")
CSS_URL_PATTERN = re.compile(r"(?i)url\(\s*(\"|')?([^\"')]+)\1?\s*\)")

# Regex pro detekci <script type="application/json">...</script>
JSON_SCRIPT_PATTERN = re.compile(
    r'(?i)<script\s+type=["\']application/json["\'][^>]*>(.*?)</script>',
    re.DOTALL
)

# A regex for the strings in JSON (escaped quotes included)
# Looks for "..." or '...' (in JSON nearly always double)
JSON_STRING_PATTERN = re.compile(r'("((?:[^"\\]|\\.)*)")')


# --- normalizing the prefix -------------------------------------------------

def uprav_predvolbu(predvolba: str) -> str:
    """Adds the leading "/", cuts the trailing "/" and squeezes repeated "/".

    An empty string, "/" and "///" all give "".
    """
    collapsed = re.sub(r"/+", "/", predvolba.strip())
    collapsed = collapsed.strip("/")
    if not collapsed:
        return ""
    return "/" + collapsed


# --- rewriting one address --------------------------------------------------

def _append(predvolba: str, value: str) -> str:
    """Rewrites the value to ``predvolba`` + the value, when the rules allow it."""
    if not predvolba or not value:
        return value
    if not value.startswith("/"):
        return value  # a relative path with no leading "/"
    if value.startswith("//"):
        return value  # an address with no scheme
    if SCHEME_PATTERN.match(value):
        return value  # https:, http:, mailto:, tel:, data: …
    if value.startswith(("#", "?")):
        return value  # an anchor / a query
    if value == predvolba or value.startswith(predvolba + "/"):
        return value  # it starts with the prefix already
    return predvolba + value


def _srcset_candidates(value: str, predvolba: str) -> tuple[str, int]:
    """Rewrites every candidate's address; the descriptor (800w, 2x) stays."""
    candidates = []
    addresses = 0
    for piece in value.split(","):
        parts = piece.split(None, 1)
        address_before = parts[0]
        address = _append(predvolba, address_before)
        if address != address_before:
            addresses += 1
        candidates.append(address + (" " + parts[1] if len(parts) > 1 else ""))
    return ", ".join(candidates), addresses


# --- HTML -------------------------------------------------------------------

def preved_html(html: str, predvolba: str) -> str:
    """Rewrites the addresses in the chosen attributes; text and other attributes not."""
    if not predvolba:
        return html
    res, _ = _convert_html_with_count(html, predvolba)
    return res


def _convert_html_with_count(html: str, predvolba: str) -> tuple[str, int]:
    """Like ``preved_html``, but it also returns how many addresses were rewritten."""
    if not predvolba:
        return html, 0
    pocet = 0

    def simple_safe(m: re.Match) -> str:
        nonlocal pocet
        attr = m.group(1)
        
        value = ""
        quote_type = "" # "e_d", "n_d", "e_s", "n_s"
        
        if m.group(3) is not None:
            value = m.group(3)
            quote_type = "e_d"
        elif m.group(4) is not None:
            value = m.group(4)
            quote_type = "n_d"
        elif m.group(5) is not None:
            value = m.group(5)
            quote_type = "e_s"
        elif m.group(6) is not None:
            value = m.group(6)
            quote_type = "n_s"
        else:
            return m.group(0)

        new_value = _append(predvolba, value)
        if new_value != value:
            pocet += 1
            if quote_type == "e_d":
                return f'{attr}=\\"{new_value}\\"'
            elif quote_type == "n_d":
                return f'{attr}="{new_value}"'
            elif quote_type == "e_s":
                return f"\\'{new_value}\\'"
            elif quote_type == "n_s":
                return f"'{new_value}'"
        
        return m.group(0)

    def srcset_safe(m: re.Match) -> str:
        nonlocal pocet
        match_str = m.group(0)
        eq_idx = match_str.find('=')
        attr = match_str[:eq_idx].strip()
        
        value = ""
        quote_type = ""
        
        if m.group(2) is not None:
            value = m.group(2)
            quote_type = "e_d"
        elif m.group(3) is not None:
            value = m.group(3)
            quote_type = "n_d"
        elif m.group(4) is not None:
            value = m.group(4)
            quote_type = "e_s"
        elif m.group(5) is not None:
            value = m.group(5)
            quote_type = "n_s"
        else:
            return m.group(0)

        new_value, kolik = _srcset_candidates(value, predvolba)
        if kolik > 0:
            pocet += kolik
            if quote_type == "e_d":
                return f'{attr}=\\"{new_value}\\"'
            elif quote_type == "n_d":
                return f'{attr}="{new_value}"'
            elif quote_type == "e_s":
                return f"\\'{new_value}\\'"
            elif quote_type == "n_s":
                return f"'{new_value}'"
        
        return m.group(0)

    def json_script_callback(m: re.Match) -> str:
        nonlocal pocet
        # The positions from the match are positions in the WHOLE document,
        # whereas what gets cut is the stretch that was found -- so its beginning
        # is subtracted from them. Without that, a block further from the start of
        # the file is chopped up, loses its </script> and spills its contents out
        start = m.start()
        script_start = m.group(0)[:m.start(1) - start]
        script_end = m.group(0)[m.end(1) - start:]
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
            value = ""
            quote_type = ""
            if ms.group(2) is not None:
                value = ms.group(2)
                quote_type = "e_d"
            elif ms.group(3) is not None:
                value = ms.group(3)
                quote_type = "n_d"
            elif ms.group(4) is not None:
                value = ms.group(4)
                quote_type = "e_s"
            elif ms.group(5) is not None:
                value = ms.group(5)
                quote_type = "n_s"
            else: return ms.group(0)

            updated, kolik = _srcset_candidates(value, predvolba)
            if kolik > 0:
                pocet += kolik
                if quote_type == "e_d": return f'{attr}=\\"{updated}\\"'
                elif quote_type == "n_d": return f'{attr}="{updated}"'
                elif quote_type == "e_s": return f"\\'{updated}\\'"
                elif quote_type == "n_s": return f"'{updated}'"
            return ms.group(0)

        def sub_attr(ms: re.Match) -> str:
            nonlocal pocet
            attr = ms.group(1)
            value = ""
            quote_type = ""
            if ms.group(3) is not None:
                value = ms.group(3)
                quote_type = "e_d"
            elif ms.group(4) is not None:
                value = ms.group(4)
                quote_type = "n_d"
            elif ms.group(5) is not None:
                value = ms.group(5)
                quote_type = "e_s"
            elif ms.group(6) is not None:
                value = ms.group(6)
                quote_type = "n_s"
            else: return ms.group(0)

            updated = _append(predvolba, value)
            if updated != value:
                pocet += 1
                if quote_type == "e_d": return f'{attr}=\\"{updated}\\"'
                elif quote_type == "n_d": return f'{attr}="{updated}"'
                elif quote_type == "e_s": return f"\\'{updated}\\'"
                elif quote_type == "n_s": return f"'{updated}'"
            return ms.group(0)

        def sub_string(ms: re.Match) -> str:
            nonlocal pocet
            full_match = ms.group(1)
            content = ms.group(2)
            updated = _append(predvolba, content)
            if updated != content:
                pocet += 1
                return f'"{updated}"'
            return full_match

        new_content = SRCSET_PATTERN.sub(sub_srcset, content)
        new_content = SIMPLE_PATTERN.sub(sub_attr, new_content)
        new_content = JSON_STRING_PATTERN.sub(sub_string, new_content)
        
        return f"{script_start}{new_content}{script_end}"

    result = SIMPLE_PATTERN.sub(simple_safe, html)
    result = SRCSET_PATTERN.sub(srcset_safe, result)
    result = JSON_SCRIPT_PATTERN.sub(json_script_callback, result)
    
    return result, pocet


# --- CSS --------------------------------------------------------------------

def preved_css(css: str, predvolba: str) -> str:
    """url(/x), url(\"/x\") and url('/x') get the prefix; the same exceptions as in HTML."""
    if not predvolba:
        return css
    res, _ = _convert_css_with_count(css, predvolba)
    return res


def _convert_css_with_count(css: str, predvolba: str) -> tuple[str, int]:
    """Like ``preved_css``, but it also returns how many addresses were rewritten."""
    if not predvolba:
        return css, 0
    pocet = 0

    def url_sub(m: re.Match) -> str:
        nonlocal pocet
        value = m.group(2)
        new_value = _append(predvolba, value)
        if new_value != value:
            pocet += 1
            return m.group(0).replace(value, new_value)
        return m.group(0)

    return CSS_URL_PATTERN.sub(url_sub, css), pocet


# --- the whole directory ----------------------------------------------------

def preved(koren, predvolba: str) -> dict:
    """Walks *.html and *.css under ``koren``, rewrites in place, returns the counts."""
    koren = Path(koren)
    file_count = 0
    addresses = 0
    files = sorted(
        list(koren.rglob("*.html")) + list(koren.rglob("*.css")),
        key=lambda p: p.relative_to(koren).as_posix(),
    )
    for file_path in files:
        file_text = file_path.read_text(encoding="utf-8")
        if file_path.suffix == ".html":
            updated, pocet = _convert_html_with_count(file_text, predvolba)
        else:
            updated, pocet = _convert_css_with_count(file_text, predvolba)
        if updated == file_text:
            continue
        file_path.write_text(updated, encoding="utf-8")
        file_count += 1
        addresses += pocet
    return {"souboru": file_count, "adres": addresses}


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
    result = preved(koren, predvolba)
    print(f"predvolba: {predvolba}, souboru: {result['souboru']}, adres: {result['adres']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
