"""Acceptance test C-003 -- `src/lib/preklad.mjs` (the two languages)."""
from __future__ import annotations

import pathlib

import pytest

from tests.jsmod import run_js

DICTIONARY = {
    "nav.galerie": {"cs": "Galerie", "en": "Gallery"},
    "bez.en": {"cs": "Jen česky"},
    "prazdne.en": {"cs": "Jen česky", "en": ""},
    "retezec": "Stejně v obou",
}


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("preklad.mjs", body, args={"s": DICTIONARY, **args})
    return call


def test_jazyky(js):
    assert js("out(m.JAZYKY);") == ["cs", "en"]
    assert js("out(Object.isFrozen(m.JAZYKY));") is True
    assert js('out(m.jazykOk("cs"));') is True
    assert js('out(m.jazykOk("sk"));') is False
    assert js("out(m.jazykOk(undefined));") is False


def test_t_pada_na_cestinu_a_pak_na_klic(js):
    assert js('out(m.t(A.s, "nav.galerie", "en"));') == "Gallery"
    assert js('out(m.t(A.s, "nav.galerie", "cs"));') == "Galerie"
    assert js('out(m.t(A.s, "bez.en", "en"));') == "Jen česky"
    assert js('out(m.t(A.s, "prazdne.en", "en"));') == "Jen česky"
    assert js('out(m.t(A.s, "retezec", "en"));') == "Stejně v obou"
    assert js('out(m.t(A.s, "chybi.uplne", "en"));') == "chybi.uplne", "ať je vidět, co chybí"
    assert js('out(m.t({}, "x", "cs"));') == "x"


def test_pole(js):
    assert js('out(m.pole({ cs: "Olej", en: "Oil" }, "en"));') == "Oil"
    assert js('out(m.pole({ cs: "Olej" }, "en"));') == "Olej"
    assert js('out(m.pole("Pyrografie", "en"));') == "Pyrografie"
    assert js('out(m.pole(null, "cs"));') == ""
    assert js('out(m.pole(undefined, "cs"));') == ""


def test_cesta(js):
    assert js('out(m.cesta("domu", "cs"));') == "/"
    assert js('out(m.cesta("domu", "en"));') == "/en/"
    assert js('out(m.cesta("galerie", "cs"));') == "/galerie/"
    assert js('out(m.cesta("galerie", "en"));') == "/en/galerie/"
    assert js('out(m.cesta("eshop", "cs"));') == "/obrazy-k-prodeji/"
    assert js('out(m.cesta("eshop", "en"));') == "/en/obrazy-k-prodeji/"
    assert js('out(m.cesta("kosik", "cs"));') == "/kosik/"
    assert js('out(m.cesta("kalendar", "cs"));') == "/kalendar/"
    assert js('out(m.cesta("kurzy", "cs"));') == "/kurzy/"
    assert js('out(m.cesta("bio", "cs"));') == "/o-mne/"
    assert js('out(m.cesta("kontakt", "cs"));') == "/kontakt/"
    assert js('out(m.cesta("administrace", "cs"));') == "/administrace/"
    assert js('out(m.cesta("neznamy", "cs"));') == "/"
    assert js('out(m.cesta("neznamy", "en"));') == "/en/"


def test_cesta_dila(js):
    assert js('out(m.cestaDila("sova", "cs"));') == "/galerie/sova/"
    assert js('out(m.cestaDila("sova", "en"));') == "/en/galerie/sova/"
    assert js('out(m.cestaDila("", "cs"));') == "/galerie/"
    assert js('out(m.cestaDila("", "en"));') == "/en/galerie/"


def test_druhy_jazyk(js):
    assert js('out(m.druhyJazyk("cs"));') == "en"
    assert js('out(m.druhyJazyk("en"));') == "cs"
    assert js('out(m.druhyJazyk("sk"));') == "en"


def test_prepni(js):
    assert js('out(m.prepni("/galerie/sova/", "en"));') == "/en/galerie/sova/"
    assert js('out(m.prepni("/en/galerie/sova/", "cs"));') == "/galerie/sova/"
    assert js('out(m.prepni("/en/kosik/", "cs"));') == "/kosik/"
    assert js('out(m.prepni("/en/", "cs"));') == "/"
    assert js('out(m.prepni("/", "en"));') == "/en/"
    assert js('out(m.prepni("/en", "cs"));') == "/"
    assert js('out(m.prepni("", "cs"));') == "/"
    assert js('out(m.prepni("", "en"));') == "/en/"
    assert js('out(m.prepni("/kontakt", "cs"));') == "/kontakt/", "vždy s lomítkem na konci"
    assert js('out(m.prepni("/en/galerie/sova/", "en"));') == "/en/galerie/sova/", "nic se nemění"


def test_jazyk_z_cesty(js):
    assert js('out(m.jazykZCesty("/en/galerie/"));') == "en"
    assert js('out(m.jazykZCesty("/en"));') == "en"
    assert js('out(m.jazykZCesty("/en/"));') == "en"
    assert js('out(m.jazykZCesty("/galerie/"));') == "cs"
    assert js('out(m.jazykZCesty("/"));') == "cs"
    assert js('out(m.jazykZCesty("/english/"));') == "cs", "/en musí být celý úsek cesty"


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "src/lib/preklad.mjs"
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

    path = "src/lib/preklad.mjs"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
