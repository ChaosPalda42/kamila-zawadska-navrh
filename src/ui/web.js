/* DOM vrstva veřejného webu: menu na mobilu, lišta aktualit, filtry galerie,
   prohlížeč na celou obrazovku, košík a formuláře.

   Všechna rozhodování jsou v modulech pod kontrakty (KZ.dila, KZ.kosik,
   KZ.prohlizec, KZ.objednavka, KZ.formular, KZ.kalendar) — tady se jen čte
   a píše DOM. Co se dá udělat bez skriptu, bez skriptu funguje: dlaždice
   vedou na vlastní stránku díla, aktuality jsou vidět všechny. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var ULOZISTE = "kz-kosik";
  var doc = document;

  function v(volba, koren) { return (koren || doc).querySelector(volba); }
  function vse(volba, koren) { return Array.prototype.slice.call((koren || doc).querySelectorAll(volba)); }
  function text(prvek, hodnota) { if (prvek) prvek.textContent = hodnota; }

  var jazyk = doc.documentElement.lang === "en" ? "en" : "cs";
  var SLOVNIK = {
    kc: { cs: "Kč", en: "CZK" },
    pozice: { cs: "z", en: "of" },
    odebrat: { cs: "Odebrat", en: "Remove" },
    zmena: { cs: "Z košíku vypadlo, co už není k prodeji.", en: "Items no longer for sale were removed from the cart." },
  };
  function s(klic) { return (SLOVNIK[klic] || {})[jazyk] || ""; }

  function korun(castka) {
    var cislo = String(Math.round(Number(castka) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return cislo + " " + s("kc");
  }

  /* ---------- menu na mobilu ---------- */

  function menu() {
    var prepinac = v("[data-menu]");
    var bok = v("[data-bok]");
    if (!prepinac || !bok) return;
    // Na širokém okně je menu vždy rozbalené; tlačítko je schované stylem.
    if (window.matchMedia("(min-width: 60.01rem)").matches) bok.classList.remove("bok-sbaleno");
    prepinac.addEventListener("click", function () {
      var sbaleno = bok.classList.toggle("bok-sbaleno");
      prepinac.setAttribute("aria-expanded", sbaleno ? "false" : "true");
    });
  }

  /* ---------- lišta aktualit ---------- */

  /* Rotuje 2–3 nejnovější akce. Bez skriptu jsou vidět všechny pod sebou,
     takže tohle je ozdoba, ne nosná funkce — proto se tiše vzdá, když
     uživatel požádal o omezený pohyb. */
  function aktuality() {
    var lista = v("[data-aktuality]");
    if (!lista) return;
    var polozky = vse("[data-aktualita]", lista);
    var tecky = vse("[data-tecka]", lista);
    if (polozky.length < 2) return;
    var kde = 0;
    function ukaz(i) {
      kde = (i + polozky.length) % polozky.length;
      polozky.forEach(function (p, j) { p.hidden = j !== kde; });
      tecky.forEach(function (t, j) { t.setAttribute("aria-current", j === kde ? "true" : "false"); });
    }
    tecky.forEach(function (t, j) {
      t.addEventListener("click", function () { ukaz(j); zastav(); });
    });
    ukaz(0);
    var hodiny = null;
    function zastav() { if (hodiny) { clearInterval(hodiny); hodiny = null; } }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hodiny = setInterval(function () { ukaz(kde + 1); }, 6000);
      lista.addEventListener("mouseenter", zastav);
      lista.addEventListener("focusin", zastav);
    }
  }

  /* ---------- filtry galerie ---------- */

  function filtry() {
    var panel = v("[data-filtry]");
    var mrizka = v("[data-mrizka]");
    if (!panel || !mrizka) return;
    var vybrano = { technika: "vse", styl: "vse", album: "vse" };
    var vysledek = v("[data-vysledek]", panel);
    var nic = v("[data-nic]");
    // Tvary počtu ("dílo / díla / děl") přišly ze šablony; bez nich bychom
    // po přefiltrování psali "4 děl".
    var tvary = [];
    try { tvary = JSON.parse((vysledek && vysledek.getAttribute("data-tvary")) || "[]"); } catch (e) { tvary = []; }
    var pocetSlovo = vysledek ? vysledek.textContent.replace(/^\d+\s*/, "") : "";
    function slovoPoctu(kolik) {
      if (tvary.length !== 3) return pocetSlovo;
      if (kolik === 1) return tvary[0];
      if (kolik >= 2 && kolik <= 4) return tvary[1];
      return tvary[2];
    }

    function sedi(dlazdice) {
      return Object.keys(vybrano).every(function (klic) {
        return vybrano[klic] === "vse" || dlazdice.getAttribute("data-" + klic) === vybrano[klic];
      });
    }
    function prekresli() {
      var videno = 0;
      vse("[data-slug]", mrizka).forEach(function (d) {
        var ano = sedi(d);
        d.hidden = !ano;
        if (ano) videno++;
      });
      text(vysledek, videno + " " + slovoPoctu(videno));
      if (nic) nic.hidden = videno !== 0;
      // Prohlížeč musí přepínat jen po tom, co je vidět — jinak by se
      // z filtru vyskočilo na dílo, které člověk odfiltroval.
      nastavProhlizec(vse("[data-slug]", mrizka).filter(function (d) { return !d.hidden; })
        .map(function (d) { return d.getAttribute("data-slug"); }));
    }
    vse("button[data-klic]", panel).forEach(function (tlacitko) {
      tlacitko.addEventListener("click", function () {
        var klic = tlacitko.getAttribute("data-klic");
        var hodnota = tlacitko.getAttribute("data-hodnota");
        vybrano[klic] = vybrano[klic] === hodnota ? "vse" : hodnota;
        vse('button[data-klic="' + klic + '"]', panel).forEach(function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-hodnota") === vybrano[klic] ? "true" : "false");
        });
        prekresli();
      });
    });
    prekresli();
  }

  /* ---------- prohlížeč na celou obrazovku ---------- */

  var prohlizecStav = null;
  var prohlizecData = {};
  var prohlizecPrvek = null;

  function nactiData() {
    var znacka = v("script[data-dila]");
    if (!znacka) return;
    try {
      JSON.parse(znacka.textContent).forEach(function (z) { prohlizecData[z.slug] = z; });
    } catch (chyba) { prohlizecData = {}; }
  }

  function nastavProhlizec(slugy) {
    if (!KZ.prohlizec || !prohlizecPrvek) return;
    var otevreno = prohlizecStav && prohlizecStav.otevreno;
    var kde = otevreno ? KZ.prohlizec.aktualni(prohlizecStav) : null;
    prohlizecStav = KZ.prohlizec.zaloz(slugy, kde);
    if (otevreno && kde && slugy.indexOf(kde) >= 0) {
      prohlizecStav = KZ.prohlizec.otevri(prohlizecStav, kde);
      vykresliProhlizec();
    } else if (otevreno) {
      zavriProhlizec();
    }
  }

  function vykresliProhlizec() {
    var slug = KZ.prohlizec.aktualni(prohlizecStav);
    var zaznam = prohlizecData[slug];
    if (!zaznam) return;
    v("[data-plocha]", prohlizecPrvek).innerHTML = zaznam.obrazek;
    var poz = KZ.prohlizec.pozice(prohlizecStav);
    text(v("[data-pozice]", prohlizecPrvek), poz.cislo + " " + s("pozice") + " " + poz.celkem);
    var popisek = v("[data-popisek]", prohlizecPrvek);
    popisek.innerHTML = "";
    var h = doc.createElement("p");
    h.innerHTML = "<strong></strong><br><span></span>";
    v("strong", h).textContent = zaznam.nazev;
    v("span", h).textContent = zaznam.radek;
    popisek.appendChild(h);
    if (zaznam.popis) {
      var p = doc.createElement("p");
      p.textContent = zaznam.popis;
      popisek.appendChild(p);
    }
    if (zaznam.odkaz) {
      var a = doc.createElement("a");
      a.href = zaznam.odkaz.kam;
      a.textContent = zaznam.odkaz.text;
      popisek.appendChild(a);
    }
    // Soused dopředu i dozadu se přednačte, ať přepnutí neblikne.
    var okoli = KZ.prohlizec.okoli(prohlizecStav);
    [okoli.predchozi, okoli.dalsi].forEach(function (soused) {
      var z = prohlizecData[soused];
      if (!z) return;
      var shoda = /src="([^"]+)"/.exec(z.obrazek);
      if (shoda) { var im = new Image(); im.src = shoda[1]; }
    });
  }

  var kamSeVratit = null;

  function otevriProhlizec(slug) {
    if (!KZ.prohlizec || !prohlizecPrvek || !prohlizecData[slug]) return false;
    prohlizecStav = KZ.prohlizec.otevri(prohlizecStav, slug);
    if (!prohlizecStav.otevreno) return false;
    kamSeVratit = doc.activeElement;
    prohlizecPrvek.hidden = false;
    doc.body.style.overflow = "hidden";
    vykresliProhlizec();
    v("[data-zavri]", prohlizecPrvek).focus();
    return true;
  }

  function zavriProhlizec() {
    if (!prohlizecPrvek) return;
    prohlizecStav = KZ.prohlizec.zavri(prohlizecStav);
    prohlizecPrvek.hidden = true;
    doc.body.style.overflow = "";
    if (kamSeVratit && kamSeVratit.focus) kamSeVratit.focus();
  }

  function prohlizec() {
    prohlizecPrvek = v("[data-prohlizec]");
    if (!prohlizecPrvek || !KZ.prohlizec) return;
    nactiData();
    nastavProhlizec(vse("[data-mrizka] [data-slug]").map(function (d) { return d.getAttribute("data-slug"); }));

    vse("[data-otevri]").forEach(function (odkaz) {
      odkaz.addEventListener("click", function (udalost) {
        // Levé kliknutí bez modifikátoru otevře prohlížeč; Ctrl/Cmd-klik
        // a prostřední tlačítko nechá prohlížeči jeho vlastní nové okno.
        if (udalost.metaKey || udalost.ctrlKey || udalost.shiftKey || udalost.button !== 0) return;
        if (otevriProhlizec(odkaz.getAttribute("data-otevri"))) udalost.preventDefault();
      });
    });

    function krok(co) {
      if (co === "dalsi") prohlizecStav = KZ.prohlizec.dalsi(prohlizecStav);
      else if (co === "predchozi") prohlizecStav = KZ.prohlizec.predchozi(prohlizecStav);
      else if (co === "zavri") { zavriProhlizec(); return; }
      else return;
      vykresliProhlizec();
    }
    v("[data-dalsi]", prohlizecPrvek).addEventListener("click", function () { krok("dalsi"); });
    v("[data-predchozi]", prohlizecPrvek).addEventListener("click", function () { krok("predchozi"); });
    v("[data-zavri]", prohlizecPrvek).addEventListener("click", zavriProhlizec);
    prohlizecPrvek.addEventListener("click", function (udalost) {
      if (udalost.target === prohlizecPrvek) zavriProhlizec();
    });
    doc.addEventListener("keydown", function (udalost) {
      if (prohlizecPrvek.hidden) return;
      var co = KZ.prohlizec.klavesa(udalost.key);
      if (co) { udalost.preventDefault(); krok(co); }
    });
  }

  /* ---------- košík ---------- */

  function nactiKosik() {
    if (!KZ.kosik) return null;
    try { return KZ.kosik.zKodu(window.localStorage.getItem(ULOZISTE)); }
    catch (chyba) { return KZ.kosik.prazdny(); }
  }
  function ulozKosik(kosik) {
    try { window.localStorage.setItem(ULOZISTE, KZ.kosik.naKod(kosik)); } catch (chyba) { /* soukromé okno */ }
  }

  function dilaZeStranky() {
    // E-shop i košík potřebují znát aktuální ceny a stavy. Bere se to
    // z dlaždic, které web vykreslil, ne z kopie v localStorage — ta by po
    // prodeji díla lhala.
    var out = [];
    vse("[data-eshop-dila] script[type=\"application/json\"]").forEach(function (z) {
      try { out = out.concat(JSON.parse(z.textContent)); } catch (chyba) { /* nic */ }
    });
    return out;
  }

  /* Jedno tlačítko přidá i vrátí. Dřív se po přidání vyplo a dílo šlo
     z košíku dostat jen tím malým „Odebrat" na stránce košíku — kdo ho
     nenašel, měl dílo v košíku natrvalo. */
  function doKosiku() {
    var tlacitka = vse("[data-doKosiku]");
    if (!tlacitka.length || !KZ.kosik) return;
    var dila = dilaZeStranky();
    tlacitka.forEach(function (tlacitko) {
      tlacitko.addEventListener("click", function () {
        var slug = tlacitko.getAttribute("data-doKosiku");
        var dilo = dila.filter(function (d) { return d.slug === slug; })[0];
        if (!dilo) return;
        var kosik = nactiKosik();
        ulozKosik(KZ.kosik.obsahuje(kosik, slug)
          ? KZ.kosik.uber(kosik, slug)
          : KZ.kosik.pridej(kosik, dilo));
        oznacKosik();
      });
    });
    oznacKosik();
  }

  function popisTlacitka(tlacitko, vKosiku) {
    var popis = tlacitko.getAttribute(vKosiku ? "data-odebrat" : "data-pridat");
    if (popis) tlacitko.textContent = popis;
    tlacitko.classList.toggle("lehke", vKosiku);
  }

  function oznacKosik() {
    if (!KZ.kosik) return;
    var kosik = nactiKosik();
    var pocet = KZ.kosik.pocet(kosik);
    vse("[data-pocet-kosiku]").forEach(function (p) {
      var stare = p.textContent;
      p.textContent = pocet ? String(pocet) : "";
      p.hidden = !pocet;
      // Číslo po změně poskočí; třídu zase sundáme, ať jde spustit znovu.
      if (pocet && stare !== p.textContent) {
        p.classList.remove("poskoc");
        void p.offsetWidth;
        p.classList.add("poskoc");
      }
    });
    // Odkaz na košík v bočním sloupci dává smysl jen s něčím v košíku.
    vse("[data-kosik-odkaz]").forEach(function (o) { o.hidden = !pocet; });
    vse("[data-doKosiku]").forEach(function (tlacitko) {
      popisTlacitka(tlacitko, KZ.kosik.obsahuje(kosik, tlacitko.getAttribute("data-doKosiku")));
    });
  }

  window.KZweb = { korun: korun, nactiKosik: nactiKosik, ulozKosik: ulozKosik, oznacKosik: oznacKosik, s: s, v: v, vse: vse };

  function start() {
    menu();
    aktuality();
    filtry();
    prohlizec();
    doKosiku();
    // Odkaz na košík je v bočním sloupci na všech stránkách, ne jen tam,
    // kde jsou tlačítka "do košíku" — proto se značí zvlášť.
    oznacKosik();
    if (window.KZkosikStranka) window.KZkosikStranka();
    if (window.KZformulare) window.KZformulare();
    if (window.KZkalendarStranka) window.KZkalendarStranka();
    if (window.KZakce) window.KZakce();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();
})();
