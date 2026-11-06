"""Akceptační test C-007 — src/lib/administrace.mjs (správa obsahu)."""
from __future__ import annotations

import pytest

from tests.jsmod import run_js

SITE = {
    "dila": [
        {"slug": "most", "nazev": {"cs": "Most"}, "stav": "v-prodeji", "cena": 54000,
         "vGalerii": True, "vEshopu": True},
        {"slug": "sova", "nazev": {"cs": "Sova"}, "stav": "prodano", "cena": 8900,
         "vGalerii": True, "vEshopu": True},
        {"slug": "studie", "nazev": {"cs": "Studie"}, "stav": "v-prodeji", "cena": 4800,
         "vGalerii": False, "vEshopu": True},
        {"slug": "portret", "nazev": {"cs": "Portrét"}, "stav": "neprodejne", "cena": 0,
         "vGalerii": True, "vEshopu": False},
    ],
    "udalosti": [
        {"id": "vystava", "typ": "vystava", "nazev": {"cs": "Výstava"}, "od": "2026-11-14", "do": "2026-12-07"},
    ],
    "kurzy": [
        {"id": "pyro", "nazev": {"cs": "Pyrografie"}, "kapacita": 6, "cena": 2400},
    ],
}
TEXTY = {"nav.galerie": {"cs": "Galerie", "en": "Gallery"}}


@pytest.fixture()
def js():
    def call(body, **args):
        return run_js("administrace.mjs", body, args={"s": SITE, "t": TEXTY, **args})
    return call


def test_zaloz_kopiruje_a_nesdili_odkazy(js):
    assert js("out(m.zaloz(A.s, A.t).verze);") == 1
    assert js("out(m.zaloz(A.s, A.t).dila.length);") == 4
    assert js("out(m.zaloz(A.s, A.t).udalosti.length);") == 1
    assert js("out(m.zaloz(A.s, A.t).kurzy.length);") == 1
    assert js('out(m.zaloz(A.s, A.t).texty["nav.galerie"].en);') == "Gallery"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        stav.dila[0].nazev.cs = "ROZBITO";
        out(A.s.dila[0].nazev.cs);
    """) == "Most", "změna ve stavu nesmí prosáknout do site.json"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(stav.dila !== A.s.dila && stav.dila[0] !== A.s.dila[0]);
    """) is True


def test_uloz_dilo_prepise_existujici(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        const r = m.ulozDilo(stav, { slug: "most", nazev: { cs: "Most přes řeku" },
            stav: "v-prodeji", cena: 60000, vGalerii: true, vEshopu: true });
        out([r.chyby, r.stav.dila.length, r.stav.dila[0].nazev.cs, r.stav.dila[0].cena]);
    """) == [[], 4, "Most přes řeku", 60000]


def test_nove_dilo_jde_na_zacatek(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        const r = m.ulozDilo(stav, { slug: "nove", nazev: { cs: "Nové" },
            stav: "v-prodeji", cena: 100, vGalerii: true, vEshopu: true });
        out(r.stav.dila.map(d => d.slug));
    """) == ["nove", "most", "sova", "studie", "portret"]


def test_uloz_dilo_pri_chybe_stav_nemeni(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        const r = m.ulozDilo(stav, { slug: "", nazev: { cs: "X" }, stav: "v-prodeji",
            cena: 1, vGalerii: true, vEshopu: true });
        out([r.chyby, r.stav.dila.length]);
    """) == [["slug"], 4]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, {}).chyby);
    """) == ["slug", "nazev", "stav", "nikde"]


def test_dilo_k_prodeji_bez_ceny_je_chyba(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, { slug: "x", nazev: { cs: "X" }, stav: "v-prodeji",
            cena: 0, vGalerii: true, vEshopu: true }).chyby);
    """) == ["cena"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, { slug: "x", nazev: { cs: "X" }, stav: "neprodejne",
            cena: 0, vGalerii: true, vEshopu: false }).chyby);
    """) == [], "neprodejné dílo cenu mít nemusí"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, { slug: "x", nazev: { cs: "X" }, stav: "v-prodeji",
            cena: 0, vGalerii: true, vEshopu: false }).chyby);
    """) == [], "co není v e-shopu, nemusí mít cenu"


def test_dilo_ktere_by_nebylo_videt_nikde(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, { slug: "x", nazev: { cs: "X" }, stav: "v-prodeji",
            cena: 10, vGalerii: false, vEshopu: false }).chyby);
    """) == ["nikde"]


def test_nazev_jako_retezec_staci(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, { slug: "x", nazev: "Rovnou řetězec", stav: "neprodejne",
            cena: 0, vGalerii: true, vEshopu: false }).chyby);
    """) == []
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozDilo(stav, { slug: "x", nazev: { en: "Only English" }, stav: "neprodejne",
            cena: 0, vGalerii: true, vEshopu: false }).chyby);
    """) == ["nazev"]


def test_smaz_dilo(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.smazDilo(stav, "sova").dila.map(d => d.slug));
    """) == ["most", "studie", "portret"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.smazDilo(stav, "neni").dila.length);
    """) == 4


def test_zmen_stav_nesaha_na_priznak_eshopu(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        const novy = m.zmenStav(stav, "most", "prodano");
        const d = novy.dila.find(x => x.slug === "most");
        out([d.stav, d.vEshopu]);
    """) == ["prodano", True], "prodané dílo zmizí z e-shopu pravidlem, ne přepsáním dat"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.zmenStav(stav, "most", "rezervovano").dila[0].stav);
    """) == "v-prodeji", "neplatný stav nic nemění"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.zmenStav(stav, "neni", "prodano").dila.length);
    """) == 4


def test_prepni_galerii(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.prepniGalerii(stav, "studie").dila.find(d => d.slug === "studie").vGalerii);
    """) is True
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.prepniGalerii(stav, "most").dila.find(d => d.slug === "most").vGalerii);
    """) is False, "most je i v e-shopu, takže z galerie smí zmizet"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.prepniGalerii(stav, "portret").dila.find(d => d.slug === "portret").vGalerii);
    """) is True, "portrét není v e-shopu; vypnutím galerie by zmizel nikam"


def test_uloz_udalost(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        const r = m.ulozUdalost(stav, { id: "nova", typ: "atelier", nazev: { cs: "Ateliér" },
            od: "2026-12-01", do: "" });
        out([r.chyby, r.stav.udalosti.map(u => u.id)]);
    """) == [[], ["nova", "vystava"]]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozUdalost(stav, {}).chyby);
    """) == ["id", "nazev", "typ", "od"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozUdalost(stav, { id: "x", nazev: { cs: "X" }, typ: "piknik",
            od: "2026-12-01" }).chyby);
    """) == ["typ"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozUdalost(stav, { id: "x", nazev: { cs: "X" }, typ: "kurz",
            od: "2026-02-30" }).chyby);
    """) == ["od"]


def test_konec_pred_zacatkem_je_chyba(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozUdalost(stav, { id: "x", nazev: { cs: "X" }, typ: "kurz",
            od: "2026-12-01", do: "2026-11-01" }).chyby);
    """) == ["do"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozUdalost(stav, { id: "x", nazev: { cs: "X" }, typ: "kurz",
            od: "2026-12-01", do: "2026-12-01" }).chyby);
    """) == [], "stejný den je v pořádku"


def test_smaz_udalost_a_uloz_kurz(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.smazUdalost(stav, "vystava").udalosti.length);
    """) == 0
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        const r = m.ulozKurz(stav, { id: "olej", nazev: { cs: "Olej" }, kapacita: 5, cena: 4200 });
        out([r.chyby, r.stav.kurzy.map(k => k.id)]);
    """) == [[], ["olej", "pyro"]]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozKurz(stav, { id: "x", nazev: { cs: "X" }, kapacita: 0, cena: 0 }).chyby);
    """) == ["kapacita"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozKurz(stav, { id: "x", nazev: { cs: "X" }, kapacita: 2.5, cena: -1 }).chyby);
    """) == ["kapacita", "cena"]
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozKurz(stav, { id: "x", nazev: { cs: "X" }, kapacita: 2, cena: 0 }).chyby);
    """) == [], "kurz zdarma je v pořádku"


def test_uloz_text(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozText(stav, "nav.galerie", "en", "Works").texty["nav.galerie"]);
    """) == {"cs": "Galerie", "en": "Works"}
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozText(stav, "novy.klic", "cs", "Nový").texty["novy.klic"]);
    """) == {"cs": "Nový"}
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozText(stav, "nav.galerie", "sk", "Galéria").texty["nav.galerie"].cs);
    """) == "Galerie", "jiný jazyk než cs/en se ignoruje"
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.ulozText(stav, "", "cs", "X").texty["nav.galerie"].cs);
    """) == "Galerie"


def test_pocty_pouzivaji_pravidlo_eshopu_ne_priznak(js):
    assert js("out(m.pocty(m.zaloz(A.s, A.t)));") == {
        "dila": 4, "vGalerii": 3, "vEshopu": 2, "prodano": 1, "zamluveno": 0,
        "udalosti": 1, "kurzy": 1,
    }


def test_na_kod_a_zpatky(js):
    assert js("""
        const stav = m.zaloz(A.s, A.t);
        out(m.zKodu(m.naKod(stav)).dila.length);
    """) == 4


def test_z_kodu_se_nezlomi_a_u_jine_verze_vrati_null(js):
    for vstup in ['null', '""', '"nic"', '"12"', '"[]"', '"{}"', 'undefined']:
        assert js(f"out(m.zKodu({vstup}));") is None, vstup
    assert js('out(m.zKodu(JSON.stringify({ dila: [], udalosti: [], kurzy: [], '
              'texty: {}, verze: 99 })));') is None
    assert js('out(m.zKodu(JSON.stringify({ dila: [], udalosti: [], verze: 1 })));') is None
    assert js('out(m.zKodu(JSON.stringify({ dila: [], udalosti: [], kurzy: [], '
              'texty: {}, verze: 1 })).verze);') == 1
