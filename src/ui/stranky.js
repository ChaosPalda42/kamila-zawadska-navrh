/* The DOM layer of the individual pages: the basket with its order, the
   contact form, switching months in the calendar.

   It loads BEFORE `web.js`, which calls these functions at its end. The
   deciding (what is valid, what drops out of the basket, what the month's
   grid looks like) is done by the modules under contract; here the DOM is
   only read and written. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var doc = document;
  function v(volba, root) { return (root || doc).querySelector(volba); }
  function all(volba, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(volba)); }
  var language = doc.documentElement.lang === "en" ? "en" : "cs";

  function jsonZe(volba, replacement) {
    var tag = v(volba);
    if (!tag) return replacement;
    try { return JSON.parse(tag.textContent); } catch (error) { return replacement; }
  }

  function errors() { return jsonZe("script[data-chyby]", {}); }
  function worksFromPage() {
    var out = [];
    all('[data-eshop-dila] script[type="application/json"]').forEach(function (z) {
      try { out = out.concat(JSON.parse(z.textContent)); } catch (error) { /* nothing */ }
    });
    return out;
  }

  /** Puts the contract's errors (an array of keys) onto the form's fields. */
  function showErrors(form, keys) {
    var dictionary = errors();
    all("[data-pole]", form).forEach(function (field) {
      var key = field.getAttribute("data-pole");
      var notice = v("[data-chyba]", field);
      var ma = keys.indexOf(key) >= 0;
      if (ma) field.setAttribute("data-chyba", "1"); else field.removeAttribute("data-chyba");
      if (notice) {
        notice.textContent = ma ? (dictionary[key] || key) : "";
        notice.hidden = !ma;
      }
    });
    var first = v("[data-chyba] input, [data-chyba] select, [data-chyba] textarea", form);
    if (first) first.focus();
  }

  function values(form) {
    var out = {};
    all("input, select, textarea", form).forEach(function (element) {
      if (!element.name) return;
      if (element.type === "checkbox") out[element.name] = element.checked;
      else if (element.type === "radio") { if (element.checked) out[element.name] = element.value; }
      else out[element.name] = element.value;
    });
    return out;
  }

  /* ---------- the basket ---------- */

  window.KZkosikStranka = function () {
    var wrapper = v("[data-kosik]");
    if (!wrapper || !KZ.kosik) return;
    var web = window.KZweb;
    var empty = v("[data-prazdny]");
    var lines = v("[data-radky]");
    var dila = worksFromPage();
    var order = v("[data-objednavka]");
    var zpusoby = jsonZe("script[data-doprava]", []);

    function state() { return web.nactiKosik(); }

    function redraw() {
      // The basket is cleaned against the current list of works every time: what
      // has been sold or reserved meanwhile drops out -- and the visitor is told,
      // rather than having a row quietly disappear on them.
      var probrano = KZ.kosik.prober(state(), dila);
      web.ulozKosik(probrano.kosik);
      var cart = probrano.kosik;
      var change = v("[data-zmena]");
      if (change) {
        change.textContent = probrano.odebrane.length ? web.s("zmena") : "";
        change.hidden = !probrano.odebrane.length;
      }

      var rek = KZ.objednavka.rekapitulace(cart, dila, zpusoby, language);
      lines.innerHTML = "";
      rek.polozky.forEach(function (p) {
        var tr = doc.createElement("tr");
        var td1 = doc.createElement("td");
        td1.innerHTML = '<span class="nazev"></span><br><span class="mini"></span>';
        v(".nazev", td1).textContent = p.nazev;
        v(".mini", td1).textContent = p.rozmer || "";
        var td2 = doc.createElement("td");
        td2.innerHTML = '<span class="cena"></span>';
        v(".cena", td2).textContent = web.korun(p.cena);
        // Removing has a column and a button size of its own: the underlined word
        // by the price could not be hit on a phone and nobody looked for it there.
        var td3 = doc.createElement("td");
        td3.innerHTML = '<button class="odebrat" type="button"><span class="krizek" aria-hidden="true">×</span><span class="slovo"></span></button>';
        var button = v("button", td3);
        v(".slovo", button).textContent = web.s("odebrat");
        button.setAttribute("aria-label", web.s("odebrat") + ": " + p.nazev);
        button.setAttribute("title", web.s("odebrat") + ": " + p.nazev);
        button.addEventListener("click", function () {
          web.ulozKosik(KZ.kosik.uber(state(), p.slug));
          redraw();
          web.oznacKosik();
        });
        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
        lines.appendChild(tr);
      });

      var total = KZ.kosik.soucet(cart, zpusoby);
      v("[data-doprava-cena]").textContent = cart.doprava ? web.korun(total.doprava) : "—";
      v("[data-celkem]").textContent = web.korun(total.celkem);
      wrapper.hidden = total.pocet === 0;
      if (empty) empty.hidden = total.pocet !== 0;
      if (order) order.hidden = total.pocet === 0;
      all('input[name="doprava"]').forEach(function (r) { r.checked = r.value === cart.doprava; });
      switchAddress(cart.doprava);
    }

    /* The address is only wanted by the carrier. With collection in person the
       street and postcode fields would only be in the way -- contract C-005
       does not validate them there either. */
    function switchAddress(shipping) {
      var address = v("[data-adresa]");
      if (address) address.hidden = shipping !== "dobirka";
    }

    all('input[name="doprava"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        web.ulozKosik(KZ.kosik.nastavDopravu(state(), radio.value));
        redraw();
      });
    });

    var form = v("[data-form-objednavka]");
    if (form) {
      form.addEventListener("submit", function (udalost) {
        udalost.preventDefault();
        var data = KZ.objednavka.ocisti(values(form));
        data.doprava = state().doprava;
        var keys = KZ.objednavka.zkontroluj(data);
        if (KZ.kosik.pocet(state()) === 0) keys = keys.concat(["kosik"]);
        showErrors(form, keys);
        if (keys.length) return;
        // In the demo nothing is sent: the confirmation is a notice and an emptied basket.
        var done = v("[data-hotovo]", form);
        if (done) done.hidden = false;
        web.ulozKosik(KZ.kosik.prazdny());
        form.reset();
        redraw();
        web.oznacKosik();
        done.scrollIntoView({ block: "center" });
      });
    }

    redraw();
  };

  /* ---------- the contact form ---------- */

  window.KZformulare = function () {
    var form = v("[data-form-kontakt]");
    if (!form || !KZ.formular) return;

    /* From the gallery one arrives here through "I want something similar made"
       -- the reason and the work's slug come in the address, so nobody has to
       explain which painting they mean. */
    var parametry = new URLSearchParams(window.location.search);
    var predvyplneno = KZ.formular.prazdny(parametry.get("duvod") || "dotaz",
      parametry.get("dilo") || parametry.get("kurz") || "");
    var duvod = v('[name="duvod"]', form);
    if (duvod) duvod.value = predvyplneno.duvod;
    var kDilu = v('[name="kDilu"]', form);
    if (kDilu) kDilu.value = predvyplneno.kDilu;
    if (predvyplneno.kDilu) {
      var message = v('[name="zprava"]', form);
      if (message && !message.value) message.value = KZ.formular.predmet(predvyplneno, language) + ": ";
    }

    form.addEventListener("submit", function (udalost) {
      udalost.preventDefault();
      var data = KZ.formular.ocisti(values(form));
      var keys = KZ.formular.zkontroluj(data);
      showErrors(form, keys);
      if (keys.length) return;
      var done = v("[data-hotovo]", form);
      if (done) done.hidden = false;
      form.reset();
      if (duvod) duvod.value = predvyplneno.duvod;
    });
  };

  /* ---------- the calendar ---------- */

  window.KZkalendarStranka = function () {
    var wrapper = v("[data-kalendar]");
    if (!wrapper || !KZ.kalendar) return;
    var today = wrapper.getAttribute("data-dnes");
    var rok = Number(wrapper.getAttribute("data-rok"));
    var mesic = Number(wrapper.getAttribute("data-mesic"));
    var udalosti = jsonZe("script[data-udalosti]", []);
    var grid = v("[data-mrizka-mesice]");
    var name = v("[data-nazev-mesice]");

    function redraw() {
      var m = KZ.kalendar.mesic(rok, mesic, udalosti);
      var body = v("tbody", grid);
      if (!body) return;
      body.innerHTML = "";
      m.tydny.forEach(function (week) {
        var tr = doc.createElement("tr");
        week.forEach(function (day) {
          var td = doc.createElement("td");
          if (!day) { td.className = "prazdny"; tr.appendChild(td); return; }
          if (day.datum === today) td.className = "dnesni";
          var number = doc.createElement("span");
          number.className = "den";
          number.textContent = String(day.den);
          td.appendChild(number);
          day.udalosti.forEach(function (id) {
            var u = udalosti.filter(function (x) { return x.id === id; })[0];
            if (!u) return;
            var a = doc.createElement("a");
            a.className = "akce " + u.typ;
            a.href = "#" + u.id;
            a.setAttribute("data-akce", u.id);
            a.textContent = u.nazev;
            td.appendChild(a);
          });
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      if (name) {
        // The month's name is taken from the browser, so a second list of names
        // need not be dragged into the script.
        var datum = new Date(Date.UTC(rok, mesic - 1, 1));
        name.textContent = new Intl.DateTimeFormat(language === "en" ? "en-GB" : "cs-CZ",
          { month: "long", year: "numeric", timeZone: "UTC" }).format(datum);
      }
    }

    function posun(o) {
      var where = KZ.kalendar.posun(rok, mesic, o);
      rok = where.rok; mesic = where.mesic;
      redraw();
    }
    var back = v("[data-mesic-zpet]"), vpred = v("[data-mesic-vpred]"), dnesek = v("[data-mesic-dnes]");
    if (back) back.addEventListener("click", function () { posun(-1); });
    if (vpred) vpred.addEventListener("click", function () { posun(1); });
    if (dnesek) dnesek.addEventListener("click", function () {
      rok = Number(today.slice(0, 4)); mesic = Number(today.slice(5, 7)); redraw();
    });
  };
})();
