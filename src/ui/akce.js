/* Detail akce. Klik na akci — v mřížce měsíce, v seznamech „co se chystá"
   a „co už bylo" i v liště aktualit — stránku NEOPOUŠTÍ: detail se vyzvedne
   z místa, na které se kliklo, a zvětší se přes stránku.

   Bez JavaScriptu zůstávají všechny ty akce obyčejnými odkazy na kotvu
   v kalendáři, takže se k popisu akce dostane i prohlížeč bez skriptu.

   Co je akce zač, počítá KZ.udalost (kontrakt C-012): stav v čase, kolik
   dnů zbývá, sousedi na časové ose. Tady se jen kreslí. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var doc = document;
  var html = doc.documentElement;
  function v(volba, koren) { return (koren || doc).querySelector(volba); }
  function vse(volba, koren) { return Array.prototype.slice.call((koren || doc).querySelectorAll(volba)); }

  function jsonZe(volba, nahrada) {
    var znacka = v(volba);
    if (!znacka) return nahrada;
    try { return JSON.parse(znacka.textContent); } catch (chyba) { return nahrada; }
  }

  window.KZakce = function () {
    var prvek = v("[data-detail-akce]");
    if (!prvek || !KZ.udalost) return;
    var udalosti = jsonZe("script[data-udalosti-detail]", []);
    if (!udalosti.length) return;

    var panel = v("[data-detail-panel]", prvek);
    var telo = v("[data-detail-telo]", prvek);
    var naKurzy = v("[data-detail-kurzy]", prvek);
    var kurzyZaklad = naKurzy ? naKurzy.getAttribute("href") : "";
    var tamZpet = v("[data-detail-predchozi]", prvek);
    var tamVpred = v("[data-detail-dalsi]", prvek);
    var otevreno = null;
    var kamSeVratit = null;

    function s(klic) { return prvek.getAttribute("data-" + klic) || ""; }
    function dnes() { return new Date().toISOString().slice(0, 10); }
    function podleId(id) { return KZ.udalost.podleId(udalosti, id); }

    /* „Za 3 dny" má v češtině tři tvary a ta čísla jsou to první, co na
       detailu padne do oka — proto je sem šablona posílá všechny tři. */
    function kdyVetou(u) {
      var stav = KZ.udalost.stav(u, dnes());
      if (stav === "probiha") return s("stav-probiha");
      if (stav === "bylo") return s("stav-bylo");
      var kolik = KZ.udalost.dnuDo(u, dnes());
      if (kolik === 0) return s("dnes");
      if (kolik === 1) return s("zitra");
      var tvary = [];
      try { tvary = JSON.parse(s("za") || "[]"); } catch (chyba) { tvary = []; }
      if (tvary.length !== 3 || kolik === null || kolik < 0) return s("stav-chysta");
      var tvar = kolik >= 2 && kolik <= 4 ? tvary[1] : tvary[2];
      return tvar.replace("%s", String(kolik));
    }

    function prvekZe(znacka, trida, text) {
      var p = doc.createElement(znacka);
      if (trida) p.className = trida;
      if (text) p.textContent = text;
      return p;
    }

    function vykresli(id) {
      var u = podleId(id);
      if (!u) return;
      otevreno = id;
      telo.innerHTML = "";

      var hlava = prvekZe("div", "detail-hlava");
      hlava.appendChild(prvekZe("span", "chip " + (u.typ || ""), u.typNazev || ""));
      hlava.appendChild(prvekZe("span", "detail-stav " + KZ.udalost.stav(u, dnes()), kdyVetou(u)));
      telo.appendChild(hlava);

      var nadpis = prvekZe("h2", "", u.nazev || "");
      nadpis.id = "detail-akce-nazev";
      telo.appendChild(nadpis);

      telo.appendChild(prvekZe("p", "detail-kdy", u.kdy + (u.cas ? ", " + u.cas : "")));
      if (u.misto) {
        var kde = prvekZe("p", "detail-kde");
        kde.appendChild(prvekZe("span", "verzalky", s("kde")));
        kde.appendChild(doc.createTextNode(" " + u.misto));
        telo.appendChild(kde);
      }
      if (u.popis) telo.appendChild(prvekZe("p", "", u.popis));

      // Díla, která na té akci visela, čekají hotová v <template> vedle
      // detailu: srcsety zná jen build a cesty musí projít předvolbou pro
      // GitHub Pages, což umí jen atributy v HTML, ne řetězce v JSON.
      var sablona = v('template[data-dila-akce="' + id.replace(/"/g, '\\"') + '"]', prvek);
      if (sablona && sablona.content) {
        telo.appendChild(prvekZe("p", "verzalky detail-nadpis", s("dila")));
        telo.appendChild(sablona.content.cloneNode(true));
      }

      /* U kurzu musí být po ruce odkaz, kde se na něj dá přihlásit —
         jinak si člověk přečte, že kurz je, a dál neví co. */
      if (naKurzy) {
        naKurzy.hidden = u.typ !== "kurz";
        naKurzy.href = kurzyZaklad + (u.kurz ? "#" + encodeURIComponent(u.kurz) : "");
      }

      var okolo = KZ.udalost.sousedi(udalosti, dnes(), id);
      tamZpet.disabled = !okolo.predchozi;
      tamVpred.disabled = !okolo.dalsi;
      tamZpet.setAttribute("data-kam", okolo.predchozi || "");
      tamVpred.setAttribute("data-kam", okolo.dalsi || "");
      panel.setAttribute("aria-labelledby", "detail-akce-nazev");
      panel.scrollTop = 0;
    }

    /* Panel se vyzvedne z dlaždice, na kterou se kliklo: spočítá se, kde
       ta dlaždice leží, panel se tam na chvíli zmenší a pak dojede na své
       místo. Bez povoleného pohybu se jen objeví. */
    function vyzvedni(odkud) {
      if (!panel.animate || !html.classList.contains("pohyb") || !odkud) return;
      var r = odkud.getBoundingClientRect();
      var p = panel.getBoundingClientRect();
      if (!r.width || !p.width) return;
      var sx = Math.max(0.25, Math.min(1, r.width / p.width));
      var sy = Math.max(0.25, Math.min(1, r.height / p.height));
      var dx = r.left + r.width / 2 - (p.left + p.width / 2);
      var dy = r.top + r.height / 2 - (p.top + p.height / 2);
      panel.animate([
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")", opacity: 0 },
        { transform: "none", opacity: 1 },
      ], { duration: 420, easing: "cubic-bezier(0.22, 0.7, 0.2, 1)" });
    }

    function otevri(id, odkud) {
      if (!podleId(id)) return false;
      if (prvek.hidden) kamSeVratit = doc.activeElement;
      vykresli(id);
      prvek.hidden = false;
      doc.body.style.overflow = "hidden";
      vyzvedni(odkud);
      var zavri = v("[data-detail-zavri]", prvek);
      if (zavri) zavri.focus();
      return true;
    }

    function zavri() {
      if (prvek.hidden) return;
      prvek.hidden = true;
      otevreno = null;
      doc.body.style.overflow = "";
      if (kamSeVratit && kamSeVratit.focus) kamSeVratit.focus();
    }

    /* Klik se odchytává na dokumentu, ne na jednotlivých akcích: mřížka
       měsíce se při přepnutí měsíce překresluje a nové odkazy by o svého
       posluchače přišly. */
    doc.addEventListener("click", function (udalost) {
      if (udalost.metaKey || udalost.ctrlKey || udalost.shiftKey || udalost.button !== 0) return;
      if (udalost.target.closest("[data-detail-akce]")) return;
      var spoust = udalost.target.closest("[data-akce]");
      if (!spoust) return;
      if (otevri(spoust.getAttribute("data-akce"), spoust)) udalost.preventDefault();
    });

    // Tlačítko „detail" u akce v seznamu má smysl jen se skriptem.
    vse("[data-vic]").forEach(function (tlacitko) { tlacitko.hidden = false; });

    [tamZpet, tamVpred].forEach(function (tlacitko) {
      tlacitko.addEventListener("click", function () {
        var kam = tlacitko.getAttribute("data-kam");
        if (kam) otevri(kam, panel);
      });
    });
    vse("[data-detail-zavri], [data-detail-plachta]", prvek).forEach(function (co) {
      co.addEventListener("click", zavri);
    });
    doc.addEventListener("keydown", function (udalost) {
      if (prvek.hidden) return;
      if (udalost.key === "Escape") { udalost.preventDefault(); zavri(); return; }
      if (udalost.key === "ArrowLeft" && !tamZpet.disabled) { udalost.preventDefault(); tamZpet.click(); }
      if (udalost.key === "ArrowRight" && !tamVpred.disabled) { udalost.preventDefault(); tamVpred.click(); }
    });

    // Odkaz na kotvu akce (třeba z lišty aktualit z jiné stránky) detail
    // rovnou otevře — jinak by člověk skočil doprostřed seznamu a nevěděl proč.
    if (window.location.hash.length > 1) {
      var zHashe = decodeURIComponent(window.location.hash.slice(1));
      if (podleId(zHashe)) otevri(zHashe, v('[data-akce="' + zHashe.replace(/"/g, '\\"') + '"]'));
    }
  };
})();
