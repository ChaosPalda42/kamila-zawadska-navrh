/* DOM vrstva jednotlivých stránek: košík s objednávkou, kontaktní formulář,
   přepínání měsíců v kalendáři.

   Načítá se PŘED web.js, které tyhle funkce na konci zavolá. Rozhodování
   (co je platné, co z košíku vypadne, jak vypadá mřížka měsíce) dělají
   moduly pod kontrakty; tady se jen čte a píše DOM. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var doc = document;
  function v(volba, koren) { return (koren || doc).querySelector(volba); }
  function vse(volba, koren) { return Array.prototype.slice.call((koren || doc).querySelectorAll(volba)); }
  var jazyk = doc.documentElement.lang === "en" ? "en" : "cs";

  function jsonZe(volba, nahrada) {
    var znacka = v(volba);
    if (!znacka) return nahrada;
    try { return JSON.parse(znacka.textContent); } catch (chyba) { return nahrada; }
  }

  function chyby() { return jsonZe("script[data-chyby]", {}); }
  function dilaZeStranky() {
    var out = [];
    vse('[data-eshop-dila] script[type="application/json"]').forEach(function (z) {
      try { out = out.concat(JSON.parse(z.textContent)); } catch (chyba) { /* nic */ }
    });
    return out;
  }

  /** Chyby z kontraktu (pole klíčů) nasadí k polím formuláře. */
  function ukazChyby(form, klice) {
    var slovnik = chyby();
    vse("[data-pole]", form).forEach(function (pole) {
      var klic = pole.getAttribute("data-pole");
      var hlaska = v("[data-chyba]", pole);
      var ma = klice.indexOf(klic) >= 0;
      if (ma) pole.setAttribute("data-chyba", "1"); else pole.removeAttribute("data-chyba");
      if (hlaska) {
        hlaska.textContent = ma ? (slovnik[klic] || klic) : "";
        hlaska.hidden = !ma;
      }
    });
    var prvni = v("[data-chyba] input, [data-chyba] select, [data-chyba] textarea", form);
    if (prvni) prvni.focus();
  }

  function hodnoty(form) {
    var out = {};
    vse("input, select, textarea", form).forEach(function (prvek) {
      if (!prvek.name) return;
      if (prvek.type === "checkbox") out[prvek.name] = prvek.checked;
      else if (prvek.type === "radio") { if (prvek.checked) out[prvek.name] = prvek.value; }
      else out[prvek.name] = prvek.value;
    });
    return out;
  }

  /* ---------- košík ---------- */

  window.KZkosikStranka = function () {
    var obal = v("[data-kosik]");
    if (!obal || !KZ.kosik) return;
    var web = window.KZweb;
    var prazdny = v("[data-prazdny]");
    var radky = v("[data-radky]");
    var dila = dilaZeStranky();
    var objednavka = v("[data-objednavka]");
    var zpusoby = jsonZe("script[data-doprava]", []);

    function stav() { return web.nactiKosik(); }

    function prekresli() {
      // Košík se pokaždé pročistí proti aktuálnímu seznamu děl: co se mezitím
      // prodalo nebo zamluvilo, vypadne — a člověk se to dozví, ne že mu
      // jen tiše zmizí řádek.
      var probrano = KZ.kosik.prober(stav(), dila);
      web.ulozKosik(probrano.kosik);
      var kosik = probrano.kosik;
      var zmena = v("[data-zmena]");
      if (zmena) {
        zmena.textContent = probrano.odebrane.length ? web.s("zmena") : "";
        zmena.hidden = !probrano.odebrane.length;
      }

      var rek = KZ.objednavka.rekapitulace(kosik, dila, zpusoby, jazyk);
      radky.innerHTML = "";
      rek.polozky.forEach(function (p) {
        var tr = doc.createElement("tr");
        var td1 = doc.createElement("td");
        td1.innerHTML = '<span class="nazev"></span><br><span class="mini"></span>';
        v(".nazev", td1).textContent = p.nazev;
        v(".mini", td1).textContent = p.rozmer || "";
        var td2 = doc.createElement("td");
        td2.innerHTML = '<span class="cena"></span> <button class="odebrat" type="button"></button>';
        v(".cena", td2).textContent = web.korun(p.cena);
        var tlacitko = v("button", td2);
        tlacitko.textContent = web.s("odebrat");
        tlacitko.addEventListener("click", function () {
          web.ulozKosik(KZ.kosik.uber(stav(), p.slug));
          prekresli();
          web.oznacKosik();
        });
        tr.appendChild(td1); tr.appendChild(td2);
        radky.appendChild(tr);
      });

      var soucet = KZ.kosik.soucet(kosik, zpusoby);
      v("[data-doprava-cena]").textContent = kosik.doprava ? web.korun(soucet.doprava) : "—";
      v("[data-celkem]").textContent = web.korun(soucet.celkem);
      obal.hidden = soucet.pocet === 0;
      if (prazdny) prazdny.hidden = soucet.pocet !== 0;
      if (objednavka) objednavka.hidden = soucet.pocet === 0;
      vse('input[name="doprava"]').forEach(function (r) { r.checked = r.value === kosik.doprava; });
      prepniAdresu(kosik.doprava);
    }

    /* Adresu chce jen dopravce. U osobního převzetí by se políčka na ulici
       a PSČ jen pletla — kontrakt C-005 je tam taky nevaliduje. */
    function prepniAdresu(doprava) {
      var adresa = v("[data-adresa]");
      if (adresa) adresa.hidden = doprava !== "dobirka";
    }

    vse('input[name="doprava"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        web.ulozKosik(KZ.kosik.nastavDopravu(stav(), radio.value));
        prekresli();
      });
    });

    var form = v("[data-form-objednavka]");
    if (form) {
      form.addEventListener("submit", function (udalost) {
        udalost.preventDefault();
        var data = KZ.objednavka.ocisti(hodnoty(form));
        data.doprava = stav().doprava;
        var klice = KZ.objednavka.zkontroluj(data);
        if (KZ.kosik.pocet(stav()) === 0) klice = klice.concat(["kosik"]);
        ukazChyby(form, klice);
        if (klice.length) return;
        // V ukázce se nic neodesílá: potvrzení je hláška a vyprázdněný košík.
        var hotovo = v("[data-hotovo]", form);
        if (hotovo) hotovo.hidden = false;
        web.ulozKosik(KZ.kosik.prazdny());
        form.reset();
        prekresli();
        web.oznacKosik();
        hotovo.scrollIntoView({ block: "center" });
      });
    }

    prekresli();
  };

  /* ---------- kontaktní formulář ---------- */

  window.KZformulare = function () {
    var form = v("[data-form-kontakt]");
    if (!form || !KZ.formular) return;

    /* Z galerie se sem chodí přes „chci podobné na míru" — důvod i slug díla
       přijdou v adrese, ať člověk nemusí vysvětlovat, o který obraz jde. */
    var parametry = new URLSearchParams(window.location.search);
    var predvyplneno = KZ.formular.prazdny(parametry.get("duvod") || "dotaz",
      parametry.get("dilo") || parametry.get("kurz") || "");
    var duvod = v('[name="duvod"]', form);
    if (duvod) duvod.value = predvyplneno.duvod;
    var kDilu = v('[name="kDilu"]', form);
    if (kDilu) kDilu.value = predvyplneno.kDilu;
    if (predvyplneno.kDilu) {
      var zprava = v('[name="zprava"]', form);
      if (zprava && !zprava.value) zprava.value = KZ.formular.predmet(predvyplneno, jazyk) + ": ";
    }

    form.addEventListener("submit", function (udalost) {
      udalost.preventDefault();
      var data = KZ.formular.ocisti(hodnoty(form));
      var klice = KZ.formular.zkontroluj(data);
      ukazChyby(form, klice);
      if (klice.length) return;
      var hotovo = v("[data-hotovo]", form);
      if (hotovo) hotovo.hidden = false;
      form.reset();
      if (duvod) duvod.value = predvyplneno.duvod;
    });
  };

  /* ---------- kalendář ---------- */

  window.KZkalendarStranka = function () {
    var obal = v("[data-kalendar]");
    if (!obal || !KZ.kalendar) return;
    var dnes = obal.getAttribute("data-dnes");
    var rok = Number(obal.getAttribute("data-rok"));
    var mesic = Number(obal.getAttribute("data-mesic"));
    var udalosti = jsonZe("script[data-udalosti]", []);
    var mrizka = v("[data-mrizka-mesice]");
    var nazev = v("[data-nazev-mesice]");

    function prekresli() {
      var m = KZ.kalendar.mesic(rok, mesic, udalosti);
      var telo = v("tbody", mrizka);
      if (!telo) return;
      telo.innerHTML = "";
      m.tydny.forEach(function (tyden) {
        var tr = doc.createElement("tr");
        tyden.forEach(function (den) {
          var td = doc.createElement("td");
          if (!den) { td.className = "prazdny"; tr.appendChild(td); return; }
          if (den.datum === dnes) td.className = "dnesni";
          var cislo = doc.createElement("span");
          cislo.className = "den";
          cislo.textContent = String(den.den);
          td.appendChild(cislo);
          den.udalosti.forEach(function (id) {
            var u = udalosti.filter(function (x) { return x.id === id; })[0];
            if (!u) return;
            var a = doc.createElement("a");
            a.className = "akce " + u.typ;
            a.href = "#" + u.id;
            a.textContent = u.nazev;
            td.appendChild(a);
          });
          tr.appendChild(td);
        });
        telo.appendChild(tr);
      });
      if (nazev) {
        // Jméno měsíce si vezmeme od prohlížeče, ať se nemusí tahat druhý
        // seznam názvů do skriptu.
        var datum = new Date(Date.UTC(rok, mesic - 1, 1));
        nazev.textContent = new Intl.DateTimeFormat(jazyk === "en" ? "en-GB" : "cs-CZ",
          { month: "long", year: "numeric", timeZone: "UTC" }).format(datum);
      }
    }

    function posun(o) {
      var kam = KZ.kalendar.posun(rok, mesic, o);
      rok = kam.rok; mesic = kam.mesic;
      prekresli();
    }
    var zpet = v("[data-mesic-zpet]"), vpred = v("[data-mesic-vpred]"), dnesek = v("[data-mesic-dnes]");
    if (zpet) zpet.addEventListener("click", function () { posun(-1); });
    if (vpred) vpred.addEventListener("click", function () { posun(1); });
    if (dnesek) dnesek.addEventListener("click", function () {
      rok = Number(dnes.slice(0, 4)); mesic = Number(dnes.slice(5, 7)); prekresli();
    });
  };
})();
