/* DOM vrstva administrace.

   Rozhodování je v KZ.administrace (kontrakt C-007): stav se jen dostane
   a vrátí nový, nic se neukládá samo. Ukládání je tady a v ukázce vede do
   localStorage — na ostrém webu půjde na server.

   Hlášky o chybách vrací kontrakt jako KLÍČE, texty bere stránka
   z data/texty.json. Tak nemůže vzniknout druhé místo, kde se rozhoduje,
   co je platné dílo. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var doc = document;
  var ULOZISTE = "kz-administrace";
  function v(volba, koren) { return (koren || doc).querySelector(volba); }
  function vse(volba, koren) { return Array.prototype.slice.call((koren || doc).querySelectorAll(volba)); }
  var jazyk = doc.documentElement.lang === "en" ? "en" : "cs";

  function jsonZe(volba, nahrada) {
    var z = v(volba);
    if (!z) return nahrada;
    try { return JSON.parse(z.textContent); } catch (chyba) { return nahrada; }
  }

  var CHYBY = {
    cs: {
      slug: "Slug musí být vyplněný.", nazev: "Název musí být vyplněný.",
      stav: "Vyberte stav díla.", cena: "Dílo k prodeji potřebuje cenu.",
      nikde: "Dílo by nebylo vidět nikde — zapněte galerii nebo e-shop.",
      id: "Slug musí být vyplněný.", typ: "Vyberte typ akce.",
      od: "Zadejte datum začátku.", do: "Konec nesmí být dřív než začátek.",
      kapacita: "Kapacita musí být aspoň 1.",
    },
    en: {
      slug: "Slug is required.", nazev: "Title is required.",
      stav: "Pick a status.", cena: "A work for sale needs a price.",
      nikde: "The work would be invisible — enable gallery or shop.",
      id: "Slug is required.", typ: "Pick an event type.",
      od: "Enter the start date.", do: "The end cannot precede the start.",
      kapacita: "Capacity must be at least 1.",
    },
  };
  function hlaska(klic) { return (CHYBY[jazyk] || CHYBY.cs)[klic] || klic; }

  var site = jsonZe("script[data-site]", null);
  var texty = jsonZe("script[data-texty]", null);
  if (!site || !texty || !KZ.administrace) return;

  function nacti() {
    var ulozene = null;
    try { ulozene = KZ.administrace.zKodu(window.localStorage.getItem(ULOZISTE)); }
    catch (chyba) { ulozene = null; }
    return ulozene || KZ.administrace.zaloz(site, texty);
  }
  var stav = nacti();
  function uloz() {
    try { window.localStorage.setItem(ULOZISTE, KZ.administrace.naKod(stav)); }
    catch (chyba) { /* soukromé okno: ukázka funguje dál, jen se nepamatuje */ }
  }

  function hodnoty(form) {
    var out = {};
    vse("input, select, textarea", form).forEach(function (prvek) {
      if (!prvek.name) return;
      if (prvek.type === "checkbox") out[prvek.name] = prvek.checked;
      else out[prvek.name] = prvek.value;
    });
    return out;
  }
  function ukazChyby(form, klice) {
    vse("[data-pole]", form).forEach(function (pole) {
      var klic = pole.getAttribute("data-pole");
      // „nikde" se váže na dvojici zaškrtátek, ne na jedno políčko.
      var muj = klic === "kde" ? (klice.indexOf("nikde") >= 0) : klice.indexOf(klic) >= 0;
      var h = v("[data-chyba]", pole);
      if (muj) pole.setAttribute("data-chyba", "1"); else pole.removeAttribute("data-chyba");
      if (h) { h.textContent = muj ? hlaska(klic === "kde" ? "nikde" : klic) : ""; h.hidden = !muj; }
    });
  }

  /* ---------- záložky ---------- */

  vse("[data-zalozka]").forEach(function (tlacitko) {
    tlacitko.addEventListener("click", function () {
      var id = tlacitko.getAttribute("data-zalozka");
      vse("[data-zalozka]").forEach(function (b) {
        b.setAttribute("aria-selected", b === tlacitko ? "true" : "false");
      });
      vse("[data-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-panel") !== id;
      });
    });
  });

  /* ---------- přehled ---------- */

  function prehled() {
    var p = KZ.administrace.pocty(stav);
    var radek = jazyk === "en"
      ? p.dila + " works · " + p.vGalerii + " in gallery · " + p.vEshopu + " in shop · "
        + p.zamluveno + " reserved · " + p.prodano + " sold · " + p.udalosti + " events · " + p.kurzy + " courses"
      : p.dila + " děl · " + p.vGalerii + " v galerii · " + p.vEshopu + " v e-shopu · "
        + p.zamluveno + " zamluveno · " + p.prodano + " prodáno · " + p.udalosti + " akcí · " + p.kurzy + " kurzů";
    var kam = v("[data-pocty]");
    if (kam) kam.textContent = radek;
  }

  function radekTabulky(sloupce) {
    var tr = doc.createElement("tr");
    sloupce.forEach(function (bunka) {
      var td = doc.createElement("td");
      if (typeof bunka === "string") td.textContent = bunka;
      else if (bunka) td.appendChild(bunka);
      tr.appendChild(td);
    });
    return tr;
  }
  function tlacitko(titulek, akce) {
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "odebrat";
    b.textContent = titulek;
    b.addEventListener("click", akce);
    return b;
  }
  function textProJazyk(hodnota) {
    if (!hodnota) return "";
    if (typeof hodnota === "string") return hodnota;
    return hodnota[jazyk] || hodnota.cs || "";
  }

  /* ---------- díla ---------- */

  function seznamDel() {
    var telo = v("[data-seznam-dila]");
    if (!telo) return;
    telo.innerHTML = "";
    stav.dila.forEach(function (dilo) {
      var volba = doc.createElement("select");
      ["v-prodeji", "zamluveno", "prodano", "neprodejne"].forEach(function (s) {
        var o = doc.createElement("option");
        o.value = s;
        o.textContent = textProJazyk((texty["stav." + s] || {}));
        if (dilo.stav === s) o.selected = true;
        volba.appendChild(o);
      });
      volba.addEventListener("change", function () {
        stav = KZ.administrace.zmenStav(stav, dilo.slug, volba.value);
        uloz(); prehled(); seznamDel();
      });
      var galerie = tlacitko(dilo.vGalerii ? "✓" : "—", function () {
        var novy = KZ.administrace.prepniGalerii(stav, dilo.slug);
        // Kontrakt odmítne dílo úplně skrýt; pak se nic nestane a je
        // potřeba to říct, ne nechat tlačítko tiše nefunkční.
        if (KZ.administrace.naKod(novy) === KZ.administrace.naKod(stav)) {
          galerie.title = hlaska("nikde");
          galerie.textContent = "!";
          return;
        }
        stav = novy; uloz(); prehled(); seznamDel();
      });
      telo.appendChild(radekTabulky([
        textProJazyk(dilo.nazev) + " (" + dilo.slug + ")",
        volba,
        galerie,
        tlacitko(jazyk === "en" ? "Delete" : "Smazat", function () {
          stav = KZ.administrace.smazDilo(stav, dilo.slug);
          uloz(); prehled(); seznamDel();
        }),
      ]));
    });
  }

  var formDilo = v("[data-form-dilo]");
  if (formDilo) {
    formDilo.addEventListener("submit", function (udalost) {
      udalost.preventDefault();
      var d = hodnoty(formDilo);
      var dilo = {
        slug: (d.slug || "").trim(),
        nazev: { cs: d.nazev, en: "" },
        technika: d.technika, styl: d.styl, album: d.album,
        rok: Number(d.rok) || new Date().getUTCFullYear(),
        rozmer: d.rozmer, cena: Number(d.cena) || 0, stav: d.stav,
        vGalerii: !!d.vGalerii, vEshopu: !!d.vEshopu,
        obrazek: (d.slug || "").trim(),
        popis: { cs: "", en: "" }, alt: { cs: d.nazev, en: "" },
      };
      if (!dilo.slug && KZ.dila) dilo.slug = dilo.obrazek = KZ.dila.slug(d.nazev || "");
      var vysledek = KZ.administrace.ulozDilo(stav, dilo);
      ukazChyby(formDilo, vysledek.chyby);
      if (vysledek.chyby.length) return;
      stav = vysledek.stav;
      uloz(); prehled(); seznamDel();
      formDilo.reset();
    });
  }

  /* ---------- události ---------- */

  function seznamUdalosti() {
    var telo = v("[data-seznam-udalosti]");
    if (!telo) return;
    telo.innerHTML = "";
    stav.udalosti.forEach(function (u) {
      telo.appendChild(radekTabulky([
        textProJazyk(u.nazev) + " (" + u.id + ")",
        u.od + (u.do ? " – " + u.do : ""),
        textProJazyk(texty["kalendar.typ." + u.typ] || {}),
        tlacitko(jazyk === "en" ? "Delete" : "Smazat", function () {
          stav = KZ.administrace.smazUdalost(stav, u.id);
          uloz(); prehled(); seznamUdalosti();
        }),
      ]));
    });
  }

  var formUdalost = v("[data-form-udalost]");
  if (formUdalost) {
    formUdalost.addEventListener("submit", function (udalost) {
      udalost.preventDefault();
      var d = hodnoty(formUdalost);
      var vysledek = KZ.administrace.ulozUdalost(stav, {
        id: (d.id || "").trim(), nazev: { cs: d.nazev, en: "" }, typ: d.typ,
        od: d.od, do: d.do, cas: "", misto: { cs: "", en: "" },
        popis: { cs: "", en: "" }, aktualita: !!d.aktualita, obrazek: "",
      });
      ukazChyby(formUdalost, vysledek.chyby);
      if (vysledek.chyby.length) return;
      stav = vysledek.stav;
      uloz(); prehled(); seznamUdalosti();
      formUdalost.reset();
    });
  }

  /* ---------- kurzy ---------- */

  function seznamKurzu() {
    var telo = v("[data-seznam-kurzy]");
    if (!telo) return;
    telo.innerHTML = "";
    stav.kurzy.forEach(function (k) {
      telo.appendChild(radekTabulky([
        textProJazyk(k.nazev) + " (" + k.id + ")",
        String(k.kapacita),
        String(k.cena),
        tlacitko(jazyk === "en" ? "Delete" : "Smazat", function () {
          stav.kurzy = stav.kurzy.filter(function (x) { return x.id !== k.id; });
          uloz(); prehled(); seznamKurzu();
        }),
      ]));
    });
  }

  var formKurz = v("[data-form-kurz]");
  if (formKurz) {
    formKurz.addEventListener("submit", function (udalost) {
      udalost.preventDefault();
      var d = hodnoty(formKurz);
      var vysledek = KZ.administrace.ulozKurz(stav, {
        id: (d.id || "").trim(), nazev: { cs: d.nazev, en: "" },
        kapacita: Number(d.kapacita), cena: Number(d.cena),
        popis: { cs: "", en: "" }, delka: { cs: "", en: "" }, terminy: [],
      });
      ukazChyby(formKurz, vysledek.chyby);
      if (vysledek.chyby.length) return;
      stav = vysledek.stav;
      uloz(); prehled(); seznamKurzu();
      formKurz.reset();
    });
  }

  /* ---------- texty ---------- */

  /* Texty se mění na místě: políčko si po opuštění uloží samo. Tlačítko
     „uložit" u dvou set řádků nikdo nezmáčkne. */
  function seznamTextu() {
    var telo = v("[data-seznam-texty]");
    if (!telo) return;
    telo.innerHTML = "";
    Object.keys(stav.texty).sort().forEach(function (klic) {
      if (klic.charAt(0) === "_") return;
      var radek = doc.createElement("tr");
      var tdKlic = doc.createElement("td");
      tdKlic.innerHTML = '<span class="mini"></span>';
      v(".mini", tdKlic).textContent = klic;
      radek.appendChild(tdKlic);
      ["cs", "en"].forEach(function (j) {
        var td = doc.createElement("td");
        var pole = doc.createElement("textarea");
        pole.rows = 2;
        pole.value = (stav.texty[klic] || {})[j] || "";
        pole.setAttribute("aria-label", klic + " " + j);
        pole.addEventListener("change", function () {
          stav = KZ.administrace.ulozText(stav, klic, j, pole.value);
          uloz();
        });
        td.appendChild(pole);
        radek.appendChild(td);
      });
      telo.appendChild(radek);
    });
  }

  var reset = v("[data-reset-stav]");
  if (reset) {
    reset.addEventListener("click", function () {
      try { window.localStorage.removeItem(ULOZISTE); } catch (chyba) { /* nic */ }
      stav = KZ.administrace.zaloz(site, texty);
      prehled(); seznamDel(); seznamUdalosti(); seznamKurzu(); seznamTextu();
    });
  }

  prehled(); seznamDel(); seznamUdalosti(); seznamKurzu(); seznamTextu();
})();
