"""Acceptance test C-004 -- `src/lib/kalendar.mjs` (calendar and news)."""
from __future__ import annotations

import pathlib

import pytest

from tests.jsmod import run_js

UDALOSTI = [
    {"id": "vystava", "typ": "vystava", "od": "2026-11-14", "do": "2026-12-07", "aktualita": True},
    {"id": "vernisaz", "typ": "vernisaz", "od": "2026-11-13", "do": "2026-11-13", "aktualita": True},
    {"id": "atelier-21", "typ": "atelier", "od": "2026-11-21", "do": "", "aktualita": True},
    {"id": "atelier-05", "typ": "atelier", "od": "2026-12-05", "aktualita": False},
    {"id": "kurz", "typ": "kurz", "od": "2026-12-12", "do": "2026-12-12", "aktualita": False},
    {"id": "loni", "typ": "vystava", "od": "2025-09-06", "do": "2025-10-19", "aktualita": False},
]


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("kalendar.mjs", body, args={"u": UDALOSTI, **args})
    return call


def test_den_ok(js):
    assert js('out(m.denOk("2026-11-06"));') is True
    assert js('out(m.denOk("2024-02-29"));') is True, "přestupný rok"
    assert js('out(m.denOk("2026-02-29"));') is False
    assert js('out(m.denOk("2026-02-30"));') is False
    assert js('out(m.denOk("2026-13-01"));') is False
    assert js('out(m.denOk("2026-11-31"));') is False
    assert js('out(m.denOk("2026-2-3"));') is False, "musí být nulami doplněné"
    assert js('out(m.denOk("2026-11-06T10:00"));') is False
    assert js('out(m.denOk(""));') is False
    assert js("out(m.denOk(20261106));") is False


def test_dnu(js):
    assert js("out(m.dnu(2026, 11));") == 30
    assert js("out(m.dnu(2026, 2));") == 28
    assert js("out(m.dnu(2024, 2));") == 29
    assert js("out(m.dnu(2000, 2));") == 29
    assert js("out(m.dnu(1900, 2));") == 28
    assert js("out(m.dnu(2026, 13));") == 0
    assert js("out(m.dnu(2026, 0));") == 0


def test_den_v_tydnu_zacina_pondelkem(js):
    assert js('out(m.denVTydnu("2026-11-02"));') == 0, "2. 11. 2026 je pondělí"
    assert js('out(m.denVTydnu("2026-11-08"));') == 6, "nedělní konec týdne"
    assert js('out(m.denVTydnu("2026-11-06"));') == 4, "pátek"
    assert js('out(m.denVTydnu("blbost"));') == -1


def test_mesic_ma_cele_tydny(js):
    assert js("out(m.mesic(2026, 11, A.u).dnu);") == 30
    assert js("out(m.mesic(2026, 11, A.u).tydny.every(t => t.length === 7));") is True
    assert js("out(m.mesic(2026, 11, A.u).tydny[0][0]);") is None, "1. 11. 2026 padne na nedělí, takže týden začíná šesti prázdnými dny"
    assert js("out(m.mesic(2026, 11, A.u).tydny[0][6].datum);") == "2026-11-01"
    assert js("out(m.mesic(2026, 11, A.u).tydny.flat().filter(Boolean).length);") == 30
    assert js("out(m.mesic(2026, 11, undefined).tydny.flat().filter(Boolean).length);") == 30


def test_mesic_rozdeli_akce_na_dny(js):
    assert js('out(m.mesic(2026, 11, A.u).tydny.flat().find(d => d && d.datum === "2026-11-13").udalosti);') == ["vernisaz"]
    assert js('out(m.mesic(2026, 11, A.u).tydny.flat().find(d => d && d.datum === "2026-11-21").udalosti);') == ["vystava", "atelier-21"]
    assert js('out(m.mesic(2026, 11, A.u).tydny.flat().find(d => d && d.datum === "2026-11-01").udalosti);') == []
    assert js('out(m.mesic(2026, 12, A.u).tydny.flat().find(d => d && d.datum === "2026-12-07").udalosti);') == ["vystava"]
    assert js('out(m.mesic(2026, 12, A.u).tydny.flat().find(d => d && d.datum === "2026-12-08").udalosti);') == []


def test_posun(js):
    assert js("out(m.posun(2026, 11, 1));") == {"rok": 2026, "mesic": 12}
    assert js("out(m.posun(2026, 12, 1));") == {"rok": 2027, "mesic": 1}
    assert js("out(m.posun(2026, 1, -1));") == {"rok": 2025, "mesic": 12}
    assert js("out(m.posun(2026, 11, 14));") == {"rok": 2028, "mesic": 1}
    assert js("out(m.posun(2026, 11, -14));") == {"rok": 2025, "mesic": 9}
    assert js("out(m.posun(2026, 11, 0));") == {"rok": 2026, "mesic": 11}


def test_v_rozsahu(js):
    assert js('out(m.vRozsahu(A.u[0], "2026-11-14"));') is True, "první den"
    assert js('out(m.vRozsahu(A.u[0], "2026-12-07"));') is True, "poslední den"
    assert js('out(m.vRozsahu(A.u[0], "2026-11-13"));') is False
    assert js('out(m.vRozsahu(A.u[0], "2026-12-08"));') is False
    assert js('out(m.vRozsahu(A.u[2], "2026-11-21"));') is True, "bez `do` platí jen den `od`"
    assert js('out(m.vRozsahu(A.u[2], "2026-11-22"));') is False
    assert js('out(m.vRozsahu(A.u[3], "2026-12-05"));') is True, "`do` úplně chybí"
    assert js('out(m.vRozsahu(A.u[0], "blbost"));') is False


def test_chysta_se_a_bylo(js):
    assert js('out(m.chystaSe(A.u, "2026-11-06").map(x => x.id));') == [
        "vernisaz", "vystava", "atelier-21", "atelier-05", "kurz",
    ]
    assert js('out(m.bylo(A.u, "2026-11-06").map(x => x.id));') == ["loni"]
    assert js('out(m.chystaSe(A.u, "2026-11-21").map(x => x.id));') == [
        "vystava", "atelier-21", "atelier-05", "kurz",
    ], "akce, která dnes právě běží, se počítá jako chystaná"
    assert js('out(m.bylo(A.u, "2026-12-31").map(x => x.id));') == [
        "kurz", "atelier-05", "atelier-21", "vystava", "vernisaz", "loni",
    ]
    assert js("""
        const pred = JSON.stringify(A.u);
        m.chystaSe(A.u, "2026-11-06"); m.bylo(A.u, "2026-11-06");
        out(JSON.stringify(A.u) === pred);
    """) is True


def test_aktuality_berou_nejdriv_oznacene(js):
    assert js('out(m.aktuality(A.u, "2026-11-06", 3).map(x => x.id));') == [
        "vernisaz", "vystava", "atelier-21",
    ]
    assert js('out(m.aktuality(A.u, "2026-11-06", 2).map(x => x.id));') == ["vernisaz", "vystava"]
    assert js('out(m.aktuality(A.u, "2026-11-06").length);') == 3, "výchozí jsou tři"
    assert js('out(m.aktuality(A.u, "2026-11-06", 0).length);') == 3
    assert js('out(m.aktuality(A.u, "2026-11-06", "tri").length);') == 3


def test_aktuality_doplni_z_chystanych_ale_nikdy_z_minulych(js):
    assert js('out(m.aktuality(A.u, "2026-11-22", 3).map(x => x.id));') == [
        "vystava", "atelier-05", "kurz",
    ], "označené už dvě vypadly, lišta se doplní dalšími chystanými"
    assert js('out(m.aktuality(A.u, "2026-12-31", 3));') == [], "nic se nechystá, radši prázdno než minulost"


def test_format_cs(js):
    assert js('out(m.format(A.u[1], "cs"));') == "13. 11. 2026"
    assert js('out(m.format(A.u[2], "cs"));') == "21. 11. 2026", "bez `do`"
    assert js('out(m.format({ od: "2026-11-14", do: "2026-11-19" }, "cs"));') == "14.–19. 11. 2026"
    assert js('out(m.format(A.u[0], "cs"));') == "14. 11. – 7. 12. 2026"
    assert js('out(m.format({ od: "blbost" }, "cs"));') == ""


def test_format_en(js):
    assert js('out(m.format(A.u[1], "en"));') == "13 November 2026"
    assert js('out(m.format({ od: "2026-11-14", do: "2026-11-19" }, "en"));') == "14–19 November 2026"
    assert js('out(m.format(A.u[0], "en"));') == "14 November – 7 December 2026"
    assert js('out(m.format({ od: "2025-09-06", do: "2025-10-19" }, "en"));') == "6 September – 19 October 2025"


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "src/lib/kalendar.mjs"
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

    path = "src/lib/kalendar.mjs"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
