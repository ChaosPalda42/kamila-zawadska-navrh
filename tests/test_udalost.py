"""Akceptační test C-012 — src/lib/udalost.mjs (akce v čase a jejich detail)."""
from __future__ import annotations

import pytest

from tests.jsmod import run_js

DNES = "2026-11-06"

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

DILA = [
    {"slug": "most", "album": "pragovka"},
    {"slug": "sova", "album": "chvalsky"},
    {"slug": "horizont", "album": "pragovka"},
    {"slug": "studie", "album": ""},
]


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("udalost.mjs", body, args={"u": UDALOSTI, "d": DILA, "dnes": DNES, **args})
    return call


# --- konec a stav -----------------------------------------------------------

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
    akce = {"od": "2026-11-01", "do": "2026-11-10"}
    assert js("out(m.stav(A.a, '2026-11-01'));", a=akce) == "probiha"
    assert js("out(m.stav(A.a, '2026-11-10'));", a=akce) == "probiha"
    assert js("out(m.stav(A.a, '2026-10-31'));", a=akce) == "chysta"
    assert js("out(m.stav(A.a, '2026-11-11'));", a=akce) == "bylo"


def test_akce_bez_data_nikdy_nestoji_mezi_chystanymi(js):
    assert js("out(m.stav(A.u[5], A.dnes));") == "bylo"


# --- dnuDo ------------------------------------------------------------------

def test_dnu_do_pocita_dopredu_i_dozadu(js):
    assert js("out(m.dnuDo(A.u[0], A.dnes));") == 8
    assert js("out(m.dnuDo(A.u[2], A.dnes));") == 0
    assert js("out(m.dnuDo(A.u[3], A.dnes));") == -249


def test_dnu_do_preskoci_prechod_na_letni_cas(js):
    # 29. 3. 2026 se v Evropě posouvají hodiny; dnů mezi daty to nemění.
    assert js("out(m.dnuDo({ od: '2026-03-30' }, '2026-03-28'));") == 2


def test_dnu_do_neplatneho_data_je_null(js):
    assert js("out(m.dnuDo({ od: 'zítra' }, A.dnes));") is None
    assert js("out(m.dnuDo(A.u[0], 'nikdy'));") is None
    assert js("out(m.dnuDo(null, A.dnes));") is None


# --- pořadí a sousedi -------------------------------------------------------

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


# --- hledání a propojení s díly ---------------------------------------------

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
