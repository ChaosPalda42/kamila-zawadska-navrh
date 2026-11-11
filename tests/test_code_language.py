"""The language gate checks itself first: a gate nobody tested is a liability.

What matters is that it looks at comments and identifiers and never at string
literals — CSS class names, data-attribute names, JSON keys and the Czech text
a visitor reads all live in strings and must not trip it.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from tests.code_language import _js_items, _words_in, czech_lines

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    "name,words",
    [
        ("preved_html", ["preved", "html"]),
        ("novyObrazek", ["novy", "obrazek"]),
        ("JSON_SKRIPT_VZOREC", ["json", "skript", "vzorec"]),
        ("index", ["index"]),
        ("$el", ["el"]),
        ("innerHTML", ["inner", "html"]),
    ],
)
def test_words_in(name, words):
    assert _words_in(name) == words


def _write(tmp_path, name, text):
    (tmp_path / name).write_text(text, encoding="utf-8")
    return tmp_path / name


# --- what the gate must catch ----------------------------------------------

def test_python_czech_identifier(tmp_path):
    code = "def preved(x):\n    return x\n"
    source = _write(tmp_path, "a.py", code)
    assert czech_lines(source) == [(1, "preved")]


def test_python_czech_comment_with_diacritics(tmp_path):
    source = _write(tmp_path, "a.py", "x = 1  # tady se počítá šířka\n")
    assert czech_lines(source) == [(1, "# tady se počítá šířka")]


def test_python_czech_comment_without_diacritics(tmp_path):
    source = _write(tmp_path, "a.py", "x = 1  # tady je soubor\n")
    assert czech_lines(source) == [(1, "# tady je soubor")]


def test_js_czech_identifier(tmp_path):
    source = _write(tmp_path, "a.mjs", "export function dila(x) { return x; }\n")
    assert czech_lines(source) == [(1, "dila")]


def test_js_identifier_inside_template_interpolation(tmp_path):
    """The templates are full of ${nazev}; the gate has to reach inside."""
    source = _write(tmp_path, "a.mjs", "const h = `<p>${nazev}</p>`;\n")
    assert czech_lines(source) == [(1, "nazev")]


def test_js_block_comment_counts_lines(tmp_path):
    source = _write(tmp_path, "a.mjs", "/* ok\n   ok */\nlet soubor = 1;\n")
    assert czech_lines(source) == [(3, "soubor")]


def test_czech_docstring_is_caught(tmp_path):
    """Rule #545 names docstrings, so the Python stream has to see them."""
    source = _write(tmp_path, "ds.py", 'def f():\n    """Vrátí nulu."""\n    return 0\n')
    assert czech_lines(source) == [(2, '"""Vrátí nulu."""')]


def test_module_docstring_is_caught(tmp_path):
    source = _write(tmp_path, "md.py", '"""Tady je soubor."""\nx = 1\n')
    assert czech_lines(source) == [(1, '"""Tady je soubor."""')]


# --- what the gate must leave alone ----------------------------------------

def test_a_string_that_is_not_a_docstring_is_left_alone(tmp_path):
    code = 'x = "Zamluveno"\ny = ["nazev"]\nz = f("popis")\n'
    source = _write(tmp_path, "ns.py", code)
    assert czech_lines(source) == []


def test_a_quoted_name_in_english_prose_is_a_quotation(tmp_path):
    code = (
        'def f():\n'
        '    """The key `nazev` holds the title; ${popis} is the caption."""\n'
        '    return 1\n'
    )
    source = _write(tmp_path, "qt.py", code)
    assert czech_lines(source) == []

def test_property_name_is_not_this_file_to_rename(tmp_path):
    """`dilo.nazev` reaches for a key of the data; only `dilo` is ours."""
    source = _write(tmp_path, "a.mjs", "const x = dilo.nazev;\n")
    assert czech_lines(source) == [(1, "dilo")]


def test_spread_is_not_a_property(tmp_path):
    """`...minule` spreads a variable; only `dilo.nazev` reaches for a field."""
    source = _write(tmp_path, "sp.mjs", "const a = [...minule, ...dilo.nazev];\n")
    assert czech_lines(source) == [(1, "minule"), (1, "dilo")]


def test_object_key_is_left_alone(tmp_path):
    code = "const o = {\n  nazev: 1,\n  popis: 2,\n};\n"
    source = _write(tmp_path, "b.mjs", code)
    assert czech_lines(source) == []


def test_name_before_a_colon_in_a_ternary_is_still_checked(tmp_path):
    """A colon alone does not make a key -- an object literal opens with { or ,."""
    source = _write(tmp_path, "c.mjs", "const x = a ? nazev : 2;\n")
    assert czech_lines(source) == [(1, "nazev")]


def test_python_attribute_is_left_alone(tmp_path):
    source = _write(tmp_path, "d.py", "x = token.nazev\ny = obj.preved_html(1)\n")
    assert czech_lines(source) == []


def test_python_annotated_parameter_is_still_checked(tmp_path):
    """A colon in Python annotates, it does not name a key."""
    source = _write(tmp_path, "e.py", "def f(nazev: str):\n    return 1\n")
    assert czech_lines(source) == [(1, "nazev")]


def test_shorthand_key_is_left_alone(tmp_path):
    """`{ texty }` is the key and the variable at once; neither may move."""
    code = "const o = { texty };\nreturn texty.length;\n"
    source = _write(tmp_path, "sh.mjs", code)
    assert czech_lines(source) == []


def test_destructuring_binds_by_the_key(tmp_path):
    code = "const { texty, jazyk = 'cs' } = vstup;\nreturn texty[jazyk];\n"
    source = _write(tmp_path, "de.mjs", code)
    assert czech_lines(source) == [(1, "vstup")]


def test_a_block_is_not_an_object(tmp_path):
    """Only a key shape excuses a name; a plain local stays this file's own."""
    code = "let texty = 1;\nif (x) { texty += 2; }\n"
    source = _write(tmp_path, "bl.mjs", code)
    assert czech_lines(source) == [(1, "texty"), (2, "texty")]


def test_python_keyword_argument_is_left_alone(tmp_path):
    """The frozen tests call these by keyword, so the parameter keeps its name."""
    code = "def main(ostry=False):\n    return ostry\n"
    source = _write(tmp_path, "kw.py", code)
    assert czech_lines(source) == []


def test_python_comparison_is_not_a_keyword_argument(tmp_path):
    code = "def f(x):\n    return f(x == 1) and ostry\n"
    source = _write(tmp_path, "cmp.py", code)
    assert czech_lines(source) == [(2, "ostry")]


def test_parameter_of_a_public_function_is_left_alone(tmp_path):
    """The frozen tests call `varianty(..., zaklad="x")`, so the signature stays."""
    code = (
        "def varianty(zdroj, zaklad=None):\n"
        "    return [zdroj, zaklad]\n"
        "def uklid(zaklad, vyska):\n"
        "    return zaklad\n"
    )
    source = _write(tmp_path, "pp.py", code)
    assert czech_lines(source, allowed=("varianty",)) == [(3, "uklid"), (3, "vyska")]


def test_strings_are_left_alone(tmp_path):
    """CSS class names, data-attribute names and JSON keys live in strings."""
    code = (
        'const a = "aktuality";\n'
        "const b = 'data-dila';\n"
        'const c = `<div class="krouzky">zamluveno</div>`;\n'
        'const d = { "nazev": 1 };\n'
    )
    source = _write(tmp_path, "a.mjs", code)
    assert czech_lines(source) == []


def test_python_strings_are_left_alone(tmp_path):
    code = 'KEYS = ["nazev", "popis"]\nTEXT = "Zamluveno"\n'
    source = _write(tmp_path, "a.py", code)
    assert czech_lines(source) == []


def test_allowed_names_stay(tmp_path):
    code = "export function dila(x) { return filtruj(x); }\n"
    source = _write(tmp_path, "a.mjs", code)
    assert czech_lines(source, allowed=("dila", "filtruj")) == []


def test_regex_literal_is_not_a_string_run(tmp_path):
    """A slash in a regex must not swallow the rest of the file."""
    code = "const parts = veta.split(/\\s+/);\nlet soubor = 1;\n"
    source = _write(tmp_path, "a.mjs", code)
    assert czech_lines(source) == [(1, "veta"), (2, "soubor")]


def test_division_is_not_a_regex(tmp_path):
    code = "const ratio = width / height;\nlet soubor = 1;\n"
    source = _write(tmp_path, "a.mjs", code)
    assert czech_lines(source) == [(2, "soubor")]


def test_english_file_is_clean(tmp_path):
    code = (
        "/* Work out the ratio and hand it back. */\n"
        "export function ratio(width, height) {\n"
        "  const value = width / height;\n"
        "  return Number.isFinite(value) ? value : 0;\n"
        "}\n"
    )
    source = _write(tmp_path, "a.mjs", code)
    assert czech_lines(source) == []


def test_js_items_reports_comments_and_names(tmp_path):
    code = "// note\nconst x = 1;\n"
    source = _write(tmp_path, "a.mjs", code)
    items = list(_js_items(source.read_text(encoding="utf-8")))
    assert (1, "comment", "// note") in items
    assert (2, "name", "const") in items


# --- the gate itself ------------------------------------------------------

def test_gate_itself_is_in_english():
    assert czech_lines("tests/code_language.py") == []


def test_a_comment_does_not_hide_an_object_key(tmp_path):
    """A comment is not a token: the key below it is still a key.

    Straight from src/ui/admin.js, where `misto:` sat on the line after a
    comment and the conversion renamed a key of the data.
    """
    code = "const o = {\n  cas: 1,\n  // poznámka\n  misto: 2,\n};\n"
    source = _write(tmp_path, "ck.mjs", code)
    assert czech_lines(source) == [(3, "// poznámka")]


def test_a_block_inside_an_interpolation_is_not_the_end_of_it(tmp_path):
    """From `src/templates/stranky.mjs`: a `}` that closes a block, not the text.

    Read as the end of the template, the code after it becomes string: the gate
    saw no names there, so the conversion left them in Czech while renaming the
    same name where it did look, and the file stopped working.
    """
    code = (
        "const grid = `<tr>${row.map((cell) => {\n"
        "  const inner = cell.list.map((id) => {\n"
        "    return `<b>${id}</b>`;\n"
        '  }).join("");\n'
        "  const soubor = cell.y;\n"
        "  return `<td>${soubor}${inner}</td>`;\n"
        '}).join("")}</tr>`;\n'
    )
    source = _write(tmp_path, "tp.mjs", code)
    assert czech_lines(source) == [(5, "soubor"), (6, "soubor")]


def test_an_imported_name_is_not_this_file_to_rename(tmp_path):
    """`from tools.fotky import varianty` names the other file's public API.

    The frozen acceptance tests are full of these, and a rename here alone
    leaves nothing to import.
    """
    code = (
        "from tools.fotky import varianty, zmensi as mensi\n"
        "import tools.predvolba\n"
        "def f(zdroj):\n"
        "    return varianty(zdroj), mensi(zdroj), tools.predvolba\n"
    )
    source = _write(tmp_path, "im.py", code)
    assert czech_lines(source) == [(3, "zdroj"), (4, "zdroj"), (4, "zdroj")]


def test_regex_flags_are_part_of_the_literal(tmp_path):
    """`/x/gu` is one literal: `gu` is not a name the file chose.

    The structural gate reads the flags as part of the regex, and a stream that
    disagrees with it cannot be checked against it.
    """
    source = _write(tmp_path, "fl.mjs", "const r = text.replace(/x/gu, '');\n")
    items = list(_js_items(source.read_text(encoding="utf-8")))
    assert [c for _, k, c in items if k == "name"] == ["const", "r", "text", "replace"]
