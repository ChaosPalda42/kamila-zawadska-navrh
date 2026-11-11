"""The structural gate checks itself: it has to catch what it promises.

What it promises is narrow. A translation into English may rename and may
rewrite comments and docstrings. Everything else -- strings, numbers,
punctuation, the order of statements, keywords, names the project did not
invent, keys of the data -- has to come out of the token stream unchanged.
"""
from __future__ import annotations

import subprocess

from tests.struktura import ROOT, js_tokens, rename_only, structure, text_at_tag

JS = ".mjs"
PY = ".py"


# --- what a translation may do ---------------------------------------------

def test_local_rename_passes():
    before = "let vysledek = f(1);\nreturn vysledek + 1;\n"
    after = "let result = f(1);\nreturn result + 1;\n"
    assert rename_only(before, after, JS) is None


def test_comments_may_be_rewritten():
    before = "// tady se počítá šířka\nlet a = 1;\n"
    after = "/* the width is worked out here */\nlet a = 1;\n"
    assert rename_only(before, after, JS) is None


def test_python_docstring_may_be_translated():
    before = 'def f():\n    """Vrátí nulu."""\n    return 0\n'
    after = 'def f():\n    """Return zero."""\n    return 0\n'
    assert rename_only(before, after, PY) is None


# --- what it has to catch --------------------------------------------------

def test_changed_string_is_caught():
    assert rename_only('let a = "den";\n', 'let a = "day";\n', JS)


def test_changed_number_is_caught():
    assert rename_only("if (x > 2024) f();\n", "if (x > 2025) f();\n", JS)


def test_changed_operator_is_caught():
    assert rename_only("if (x > 1) f();\n", "if (x >= 1) f();\n", JS)


def test_dropped_parentheses_are_caught():
    """Reformatting is not renaming: a diff has to stay readable name by name."""
    assert rename_only("return (\n  a && b\n);\n", "return a && b;\n", JS)


def test_data_key_through_a_string_is_caught():
    """A worker that cannot rename `dilo.nazev` must not launder it instead."""
    assert rename_only("x = d.nazev;\n", 'x = d["nazev"];\n', JS)


def test_spread_variable_may_be_renamed():
    assert rename_only("f([...minule]);\n", "f([...previous]);\n", JS) is None


def test_renamed_data_key_is_caught():
    assert rename_only("x = d.nazev;\n", "x = d.name;\n", JS)


def test_renamed_object_key_is_caught():
    assert rename_only("o = { nazev: 1 };\n", "o = { name: 1 };\n", JS)


def test_shorthand_key_may_not_be_renamed():
    """`{ texty }` is the key and the variable at once, so it is nobody's to rename."""
    assert rename_only("const o = { texty };\n", "const o = { texts };\n", JS)


def test_python_keyword_argument_may_not_be_renamed():
    assert rename_only("f(x, ostry=True)\n", "f(x, live=True)\n", PY)


def test_a_rename_onto_a_keyword_argument_is_caught():
    """`soubor` cannot become `file` where `file=` already names a parameter."""
    assert rename_only("print(soubor, file=out)\n", "print(file, file=out)\n", PY)


def test_renamed_keyword_is_caught():
    assert rename_only("const a = 1;\n", "let a = 1;\n", JS)


def test_renamed_global_is_caught():
    assert rename_only("window.KZweb = 1;\n", "okno.KZweb = 1;\n", JS)


def test_renamed_python_keyword_is_caught():
    assert rename_only("if a and b:\n    pass\n", "if a or b:\n    pass\n", PY)


def test_two_names_merged_into_one_is_caught():
    """A rename has to stay a one to one swap, or the code stops working."""
    assert rename_only("let a = 1, b = 2;\nf(a, b);\n", "let x = 1, x = 2;\nf(x, x);\n", JS)


def test_kept_name_may_not_be_renamed():
    assert rename_only("export function dila(x) { return x; }\n",
                       "export function works(x) { return x; }\n", JS, keep=("dila",))


def test_added_statement_is_caught():
    assert rename_only("f(1);\n", "f(1);\ng(2);\n", JS)


# --- the stream itself ------------------------------------------------------

def test_template_interpolation_is_code_and_the_text_is_not():
    stream = [token for token, _ in structure('const h = `<p>${nazev}</p>`;\n', JS)]
    assert "name:1" in stream  # the interpolated name became a placeholder
    assert any(t.startswith("string:`<p>${") for t in stream)


def test_lines_are_reported():
    message = rename_only("let a = 1;\n\n\nlet b = 2;\n", "let a = 1;\n\n\nlet b = 3;\n", JS)
    assert "řádek 4" in message


def test_every_source_matches_itself():
    """Over the real sources, not a snippet: the lexers have to survive them."""
    listed = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True)
    files = [f for f in listed.stdout.split() if f.endswith((".mjs", ".js", ".py"))]
    assert len(files) > 20
    for name in files:
        text = (ROOT / name).read_text(encoding="utf-8")
        if not text.strip():
            continue
        suffix = PY if name.endswith(".py") else JS
        assert rename_only(text, text, suffix) is None, name


def test_text_at_tag_is_quiet_about_a_tag_that_is_not_there():
    assert text_at_tag("build.mjs", tag="takova-znacka-neexistuje") is None


def test_gate_itself_is_in_english():
    from tests.code_language import czech_lines

    for name in ("tests/struktura.py", "tests/test_struktura.py"):
        assert czech_lines(name) == [], name


def test_a_block_inside_an_interpolation_does_not_swallow_the_code():
    """A `}` that closes a block is not the end of the template's `${...}`.

    Taken as the end, the code up to the next backtick is read as text: the
    name declared there never reaches the stream, so a file broken by a half
    finished rename still looked like renaming alone.
    """
    text = (
        "const g = `<tr>${row.map((c) => {\n"
        "  const i = c.list.map((id) => {\n"
        "    return `<b>${id}</b>`;\n"
        '  }).join("");\n'
        "  const label = c.y;\n"
        "  return `<td>${label}${i}</td>`;\n"
        '}).join("")}</tr>`;\n'
    )
    names = [value for kind, value, _ in js_tokens(text) if kind == "name"]
    assert names.count("label") == 2  # the declaration and the use
