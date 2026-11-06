"""Akceptační test C-013 — src/lib/nahrani.mjs (fotky díla v administraci)."""
from __future__ import annotations

import pytest

from tests.jsmod import run_js

FOTKA = {"klic": "f1", "nazev": "IMG_2031.jpg", "typ": "image/jpeg", "velikost": 820_000, "data": "x"}
DRUHA = {"klic": "f2", "nazev": "detail.png", "typ": "image/png", "velikost": 310_000, "data": "y"}
TRETI = {"klic": "f3", "nazev": "ram.webp", "typ": "image/webp", "velikost": 90_000, "data": "z"}


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("nahrani.mjs", body, args={"a": FOTKA, "b": DRUHA, "c": TRETI, **args})
    return call


# --- kontrola souboru -------------------------------------------------------

def test_dobra_fotka_nema_chyby(js):
    assert js("out(m.zkontroluj(A.a));") == []
    assert js("out(m.zkontroluj(A.b));") == []
    assert js("out(m.zkontroluj(A.c));") == []


def test_typy_a_limit_jsou_zverejnene(js):
    assert js("out(m.TYPY);") == ["image/jpeg", "image/png", "image/webp"]
    assert js("out(m.MAX_BAJTU);") == 6_291_456
    assert js("out(Object.isFrozen(m.TYPY));") is True


def test_chybi_soubor_nebo_velikost(js):
    assert js("out(m.zkontroluj(null));") == ["prazdny"]
    assert js('out(m.zkontroluj({ typ: "image/png", velikost: 0 }));') == ["prazdny"]
    assert js('out(m.zkontroluj({ typ: "image/png", velikost: "hodně" }));') == ["prazdny"]


def test_cizi_typ_a_velky_soubor(js):
    assert js('out(m.zkontroluj({ typ: "application/pdf", velikost: 1000 }));') == ["typ"]
    assert js('out(m.zkontroluj({ typ: "image/png", velikost: 9000000 }));') == ["velikost"]
    assert js('out(m.zkontroluj({ typ: "application/pdf", velikost: 9000000 }));') == ["typ", "velikost"]


def test_typ_se_cte_bez_ohledu_na_velikost_pismen(js):
    assert js('out(m.zkontroluj({ typ: "IMAGE/JPEG", velikost: 1000 }));') == []


def test_na_hranici_limitu_jeste_projde(js):
    assert js("out(m.zkontroluj({ typ: 'image/png', velikost: m.MAX_BAJTU }));") == []
    assert js("out(m.zkontroluj({ typ: 'image/png', velikost: m.MAX_BAJTU + 1 }));") == ["velikost"]


# --- jméno souboru ----------------------------------------------------------

def test_pripona_podle_typu(js):
    assert js('out([m.pripona("image/jpeg"), m.pripona("image/png"), m.pripona("image/webp")]);') == ["jpg", "png", "webp"]
    assert js('out(m.pripona("image/gif"));') == ""


def test_navrhni_nazev(js):
    assert js('out(m.navrhniNazev("rano-nad-vltavou", "image/jpeg"));') == "rano-nad-vltavou.jpg"
    assert js('out(m.navrhniNazev("", "image/jpeg"));') == ""
    assert js('out(m.navrhniNazev("sova", "application/pdf"));') == ""


# --- galerie fotek ----------------------------------------------------------

def test_zaloz_z_dila_s_fotkou(js):
    g = js('out(m.zaloz({ slug: "sova", obrazek: "sova" }));')
    assert g["hlavni"] == "sova"
    assert [o["klic"] for o in g["obrazky"]] == ["sova"]
    assert g["obrazky"][0]["nazev"] == "sova"


def test_zaloz_z_dila_bez_fotky(js):
    assert js('out(m.zaloz({ slug: "sova" }));') == {"hlavni": "", "obrazky": []}
    assert js("out(m.zaloz(null));") == {"hlavni": "", "obrazky": []}


def test_prvni_fotka_se_stane_hlavni(js):
    v = js("out(m.pridej(m.zaloz(null), A.a));")
    assert v["chyby"] == []
    assert v["galerie"]["hlavni"] == "f1"


def test_dalsi_fotka_jde_na_konec_a_hlavni_se_nemeni(js):
    v = js("""
      let g = m.zaloz(null);
      g = m.pridej(g, A.a).galerie;
      g = m.pridej(g, A.b).galerie;
      out(m.pridej(g, A.c).galerie);
    """)
    assert [o["klic"] for o in v["obrazky"]] == ["f1", "f2", "f3"]
    assert v["hlavni"] == "f1"


def test_stejny_klic_nahradi_fotku_na_jejim_miste(js):
    v = js("""
      let g = m.pridej(m.pridej(m.zaloz(null), A.a).galerie, A.b).galerie;
      out(m.pridej(g, { ...A.a, nazev: "znovu.jpg" }).galerie);
    """)
    assert [o["klic"] for o in v["obrazky"]] == ["f1", "f2"]
    assert v["obrazky"][0]["nazev"] == "znovu.jpg"


def test_vadna_fotka_galerii_nezmeni(js):
    v = js('out(m.pridej(m.pridej(m.zaloz(null), A.a).galerie, { klic: "x", typ: "application/pdf", velikost: 10 }));')
    assert v["chyby"] == ["typ"]
    assert [o["klic"] for o in v["galerie"]["obrazky"]] == ["f1"]


def test_odebrani_hlavni_fotky_povysi_prvni_zbylou(js):
    v = js("""
      let g = m.pridej(m.pridej(m.zaloz(null), A.a).galerie, A.b).galerie;
      out(m.odeber(g, "f1"));
    """)
    assert [o["klic"] for o in v["obrazky"]] == ["f2"]
    assert v["hlavni"] == "f2"


def test_prazdna_galerie_nema_hlavni(js):
    assert js('out(m.odeber(m.pridej(m.zaloz(null), A.a).galerie, "f1"));') == {"hlavni": "", "obrazky": []}


def test_odebrani_neznameho_klice_nic_nedela(js):
    v = js('out(m.odeber(m.pridej(m.zaloz(null), A.a).galerie, "nic"));')
    assert [o["klic"] for o in v["obrazky"]] == ["f1"]


def test_nastav_hlavni(js):
    v = js("""
      let g = m.pridej(m.pridej(m.zaloz(null), A.a).galerie, A.b).galerie;
      out([m.nastavHlavni(g, "f2").hlavni, m.nastavHlavni(g, "nic").hlavni]);
    """)
    assert v == ["f2", "f1"]


def test_posun_meni_poradi_ale_ne_hlavni(js):
    v = js("""
      let g = m.pridej(m.pridej(m.pridej(m.zaloz(null), A.a).galerie, A.b).galerie, A.c).galerie;
      const dolu = m.posun(g, "f1", 1);
      out([dolu.obrazky.map((o) => o.klic), dolu.hlavni, m.posun(dolu, "f1", -1).obrazky.map((o) => o.klic)]);
    """)
    assert v == [["f2", "f1", "f3"], "f1", ["f1", "f2", "f3"]]


def test_posun_za_okraj_a_nesmyslny_krok(js):
    v = js("""
      let g = m.pridej(m.pridej(m.zaloz(null), A.a).galerie, A.b).galerie;
      out([
        m.posun(g, "f1", -1).obrazky.map((o) => o.klic),
        m.posun(g, "f2", 1).obrazky.map((o) => o.klic),
        m.posun(g, "f1", 2).obrazky.map((o) => o.klic),
        m.posun(g, "nic", 1).obrazky.map((o) => o.klic),
      ]);
    """)
    assert v == [["f1", "f2"], ["f1", "f2"], ["f1", "f2"], ["f1", "f2"]]


def test_puvodni_galerie_se_nemeni(js):
    v = js("""
      const g = m.pridej(m.zaloz(null), A.a).galerie;
      m.odeber(g, "f1"); m.pridej(g, A.b); m.posun(g, "f1", 1);
      out(g.obrazky.length);
    """)
    assert v == 1


# --- velikost pro lidi ------------------------------------------------------

def test_lidska_velikost(js):
    assert js("out(m.lidskaVelikost(812));") == "812 B"
    assert js("out(m.lidskaVelikost(0));") == "0 B"
    assert js("out(m.lidskaVelikost(812345));") == "812 kB"
    assert js("out(m.lidskaVelikost(2400000));") == "2,4 MB"
    assert js("out(m.lidskaVelikost(3000000));") == "3 MB"
    assert js("out(m.lidskaVelikost(-5));") == ""
    assert js('out(m.lidskaVelikost("velká"));') == ""
