"""Acceptance test C-012 -- `src/lib/udalost.mjs` (events in time and their detail)."""
from __future__ import annotations

import pathlib

import pytest

from tests.jsmod import run_js

TODAY = "2026-11-06"

UDALOSTI = [
    {"id": "pragovka", "typ": "vystava", "nazev": {"cs": "Pragovka"},
     "od": "2026-11-14", "do": "2026-12-07", "misto": {"cs": "Praha 9"}},
    {"id": "vernisaz", "typ": "vernisaz", "nazev": {"cs": "Vernisáž"},
     "od": "2026-11-14", "cas": "18:00"},
    {"id": "atelier", "typ": "atelier", "nazev": {"cs": "Otevřený ateliér"},
     "od": "2026-11-06", "do": "2026-11-06"},
    {"id": "kurz-jaro", "typ": "kurz", "nazev": {"cs": "Jarní kurz"}, "od": "2026-03-02"},
    {"id": "chvalsky", "typ": "vystava", "nazev": {"cs": "Chvalský zámek"},
     "od": "2025-09-01", "do": "2025-10-12"},
    {"id": "bez-data", "typ": "kurz", "nazev": {"cs": "Rozepsaná akce"}, "od": ""},
]

WORKS = [
    {"slug": "most", "album": "pragovka"},
    {"slug": "sova", "album": "chvalsky"},
    {"slug": "horizont", "album": "pragovka"},
    {"slug": "studie", "album": ""},
]


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("udalost.mjs", body, args={"u": UDALOSTI, "d": WORKS, "dnes": TODAY, **args})
    return call


# --- the end and the state ---------------------------------------------------

def test_konec_bere_do_a_u_jednodenni_akce_od(js):
    assert js("out(m.konec(A.u[0]));") == "2026-12-07"
    assert js("out(m.konec(A.u[1]));") == "2026-11-14"


def test_konec_neplatneho_data_padne_zpet_na_od(js):
    assert js('out(m.konec({ od: "2026-11-14", do: "2026-02-30" }));') == "2026-11-14"
    assert js('out(m.konec({ od: "", do: "2026-12-01" }));') == ""
    assert js("out(m.konec(null));") == ""


def test_stav_rozlisi_chysta_probiha_bylo(js):
    assert js("out(m.stav(A.u[0], A.dnes));") == "chysta"
    assert js("out(m.stav(A.u[2], A.dnes));") == "probiha"
    assert js("out(m.stav(A.u[4], A.dnes));") == "bylo"


def test_probiha_i_prvni_a_posledni_den(js):
    event = {"od": "2026-11-01", "do": "2026-11-10"}
    assert js("out(m.stav(A.a, '2026-11-01'));", a=event) == "probiha"
    assert js("out(m.stav(A.a, '2026-11-10'));", a=event) == "probiha"
    assert js("out(m.stav(A.a, '2026-10-31'));", a=event) == "chysta"
    assert js("out(m.stav(A.a, '2026-11-11'));", a=event) == "bylo"


def test_akce_bez_data_nikdy_nestoji_mezi_chystanymi(js):
    assert js("out(m.stav(A.u[5], A.dnes));") == "bylo"


# --- dnuDo ------------------------------------------------------------------

def test_dnu_do_pocita_dopredu_i_dozadu(js):
    assert js("out(m.dnuDo(A.u[0], A.dnes));") == 8
    assert js("out(m.dnuDo(A.u[2], A.dnes));") == 0
    assert js("out(m.dnuDo(A.u[3], A.dnes));") == -249


def test_dnu_do_preskoci_prechod_na_letni_cas(js):
    # on 29 March 2026 the clocks move in Europe; the days between dates do not change
    assert js("out(m.dnuDo({ od: '2026-03-30' }, '2026-03-28'));") == 2


def test_dnu_do_neplatneho_data_je_null(js):
    assert js("out(m.dnuDo({ od: 'zítra' }, A.dnes));") is None
    assert js("out(m.dnuDo(A.u[0], 'nikdy'));") is None
    assert js("out(m.dnuDo(null, A.dnes));") is None


# --- the order and the neighbours --------------------------------------------

def test_poradi_je_od_nejblizsi_akce_do_minulosti(js):
    assert js("out(m.poradi(A.u, A.dnes));") == [
        "atelier", "pragovka", "vernisaz", "kurz-jaro", "chvalsky",
    ]


def test_poradi_vynecha_akci_bez_data(js):
    assert "bez-data" not in js("out(m.poradi(A.u, A.dnes));")
    assert js("out(m.poradi([{ typ: 'kurz', od: '2026-12-01' }], A.dnes));") == []


def test_sousedi_se_nevraci_dokola(js):
    assert js("out(m.sousedi(A.u, A.dnes, 'atelier'));") == {"predchozi": None, "dalsi": "pragovka"}
    assert js("out(m.sousedi(A.u, A.dnes, 'chvalsky'));") == {"predchozi": "kurz-jaro", "dalsi": None}
    assert js("out(m.sousedi(A.u, A.dnes, 'vernisaz'));") == {"predchozi": "pragovka", "dalsi": "kurz-jaro"}


def test_sousedi_neznamou_akci_prezije(js):
    assert js("out(m.sousedi(A.u, A.dnes, 'nic'));") == {"predchozi": None, "dalsi": None}


# --- searching and the tie to the works --------------------------------------

def test_podle_id(js):
    assert js("out(m.podleId(A.u, 'sova'));") is None
    assert js("out(m.podleId(A.u, 'atelier').typ);") == "atelier"
    assert js("out(m.podleId(null, 'atelier'));") is None


def test_dila_akce_drzi_poradi_vstupu(js):
    assert js("out(m.dilaAkce(A.d, A.u[0]).map((x) => x.slug));") == ["most", "horizont"]
    assert js("out(m.dilaAkce(A.d, A.u[1]));") == []
    assert js("out(m.dilaAkce(A.d, { id: '' }));") == []
    assert js("out(m.dilaAkce(null, A.u[0]));") == []


def test_shrnuti_secte_stavy(js):
    assert js("out(m.shrnuti(A.u, A.dnes));") == {"chysta": 2, "probiha": 1, "bylo": 3}


def test_vstupy_se_nemeni(js):
    assert js("m.poradi(A.u, A.dnes); m.dilaAkce(A.d, A.u[0]); out(A.u.length + A.d.length);") == 10


# --- language gate (constitution rule #545) ---------------------------------

def test_source_is_in_english():
    """Comments and identifiers in English (rule #545). The public API stays
    Czech on purpose (rule #547): the project speaks Czech outwards -- file
    names, module keys, exported names -- and English inside."""
    from tests.code_language import czech_lines
    from tests.public_api import PUBLIC_API

    path = "src/lib/udalost.mjs"
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

    path = "src/lib/udalost.mjs"
    before = text_at_tag(path)
    if before is None:
        pytest.skip("značka pred-prevodem tu není, není proti čemu srovnávat")
    root = pathlib.Path(__file__).resolve().parents[1]
    after = (root / path).read_text(encoding="utf-8")
    assert rename_only(before, after, pathlib.Path(path).suffix,
                       keep=PUBLIC_API[path]) is None
