/* The DOM layer of the public site: the menu on a phone, the news bar, the
   gallery filters, the full-screen viewer, the basket and the forms.

   All the deciding is in the modules under contract (`KZ.dila`, `KZ.kosik`,
   `KZ.prohlizec`, `KZ.objednavka`, `KZ.formular`, `KZ.kalendar`) -- here the
   DOM is only read and written. What can be done without the script works
   without it: the tiles lead to the work's own page and all the news is
   visible. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var ULOZISTE = "kz-kosik";
  var doc = document;

  function v(volba, root) { return (root || doc).querySelector(volba); }
  function all(volba, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(volba)); }
  function text(element, value) { if (element) element.textContent = value; }

  var language = doc.documentElement.lang === "en" ? "en" : "cs";
  var DICTIONARY = {
    kc: { cs: "Kč", en: "CZK" },
    pozice: { cs: "z", en: "of" },
    odebrat: { cs: "Odebrat", en: "Remove" },
    zmena: { cs: "Z košíku vypadlo, co už není k prodeji.", en: "Items no longer for sale were removed from the cart." },
  };
  function s(key) { return (DICTIONARY[key] || {})[language] || ""; }

  function crowns(castka) {
    var number = String(Math.round(Number(castka) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return number + " " + s("kc");
  }

  /* ---------- the language ---------- */

  /* The client asked at the meeting for the English version to come up by
     itself when the visitor's browser is not set to Czech. It happens at most
     once, only on the home page and only when the visitor arrived straight
     from outside: whoever clicks `cz` keeps Czech for good, and a switch in
     the middle of browsing would throw somebody out of the page they were
     reading. Without local storage nothing is switched at all -- a switch
     that cannot be remembered would repeat itself on every visit. */
  var JAZYK = "kz-jazyk";

  function rememberLanguage(value) {
    try { localStorage.setItem(JAZYK, value); } catch (e) { /* private window */ }
  }

  function chosenLanguage() {
    try { return localStorage.getItem(JAZYK); } catch (e) { return null; }
  }

  function languageSwitch() {
    var panel = v("[data-jazyky]");
    if (!panel) return;
    all("a", panel).forEach(function (link) {
      link.addEventListener("click", function () { rememberLanguage(link.getAttribute("hreflang")); });
    });
    if (chosenLanguage() || !doc.body.hasAttribute("data-domu") || doc.referrer) return;
    var asked = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    // Slovak counts as Czech here: the Czech page is the closer one of the two.
    var wanted = /^(cs|sk)\b/i.test(asked) ? "cs" : "en";
    if (wanted === language) return;
    var target = v('a[hreflang="' + wanted + '"]', panel);
    if (!target) return;
    rememberLanguage(wanted);
    location.replace(target.href);
  }

  /* ---------- menu na mobilu ---------- */

  function menu() {
    var toggle = v("[data-menu]");
    var bok = v("[data-bok]");
    if (!toggle || !bok) return;
    // On a wide window the menu is always open; the button is hidden by style.
    if (window.matchMedia("(min-width: 60.01rem)").matches) bok.classList.remove("bok-sbaleno");
    toggle.addEventListener("click", function () {
      var sbaleno = bok.classList.toggle("bok-sbaleno");
      toggle.setAttribute("aria-expanded", sbaleno ? "false" : "true");
    });
  }

  /* ---------- the news bar ---------- */

  /* It rotates the 2-3 newest events. Without the script they are all visible
     one under the other, so this is an ornament, not a load-bearing function
     -- which is why it gives up quietly when the visitor has asked for
     reduced motion. */
  function news() {
    var lista = v("[data-aktuality]");
    if (!lista) return;
    var items = all("[data-aktualita]", lista);
    var dots = all("[data-tecka]", lista);
    if (items.length < 2) return;
    var where = 0;

    /* The old leaf does not leave at a stroke: it lifts over the top edge and
       only fades on the way. For that while it hangs over the pile for good
       (absolutely), so that the new leaf can lie quietly underneath and the
       bar does not jump. */
    function odlistuj(list) {
      if (!list || list === items[where]) return;
      if (!doc.documentElement.classList.contains("pohyb")) return;
      list.hidden = false;
      list.setAttribute("data-odchazi", "");
      function cleanup() {
        list.removeEventListener("animationend", cleanup);
        list.removeAttribute("data-odchazi");
        list.hidden = list !== items[where];
      }
      list.addEventListener("animationend", cleanup);
      // Should the animation never report back (another browser tab, an interruption),
      // the leaf clears up after itself anyway -- it must not stay over the pile.
      window.setTimeout(cleanup, 1600);
    }

    function show(i, smooth) {
      var previous = where;
      where = (i + items.length) % items.length;
      items.forEach(function (p, j) { p.hidden = j !== where; });
      if (smooth && previous !== where) odlistuj(items[previous]);
      dots.forEach(function (t, j) { t.setAttribute("aria-current", j === where ? "true" : "false"); });
    }
    dots.forEach(function (t, j) {
      t.addEventListener("click", function () { show(j, true); stop(); });
    });
    show(0, false);
    var hodiny = null;
    function stop() { if (hodiny) { clearInterval(hodiny); hodiny = null; } }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hodiny = setInterval(function () { show(where + 1, true); }, 6000);
      lista.addEventListener("mouseenter", stop);
      lista.addEventListener("focusin", stop);
    }
  }

  /* ---------- the gallery filters ---------- */

  function filtry() {
    var panel = v("[data-filtry]");
    var grid = v("[data-mrizka]");
    if (!panel || !grid) return;
    var vybrano = { technika: "vse", styl: "vse", album: "vse" };
    var result = v("[data-vysledek]", panel);
    var nothing = v("[data-nic]");
    // The count's forms ("`dilo` / `dila` / `del`") came from the template;
    // without them we would write "4 `del`" after filtering.
    var tvary = [];
    try { tvary = JSON.parse((result && result.getAttribute("data-tvary")) || "[]"); } catch (e) { tvary = []; }
    var countWord = result ? result.textContent.replace(/^\d+\s*/, "") : "";
    function wordForCount(howMany) {
      if (tvary.length !== 3) return countWord;
      if (howMany === 1) return tvary[0];
      if (howMany >= 2 && howMany <= 4) return tvary[1];
      return tvary[2];
    }

    function sedi(dlazdice) {
      return Object.keys(vybrano).every(function (key) {
        return vybrano[key] === "vse" || dlazdice.getAttribute("data-" + key) === vybrano[key];
      });
    }
    function redraw() {
      var videno = 0;
      all("[data-slug]", grid).forEach(function (d) {
        var ano = sedi(d);
        d.hidden = !ano;
        if (ano) videno++;
      });
      text(result, videno + " " + wordForCount(videno));
      if (nothing) nothing.hidden = videno !== 0;
      // The viewer may only switch through what is visible -- otherwise a filter
      // would jump out to a work the visitor had filtered away.
      setViewer(all("[data-slug]", grid).filter(function (d) { return !d.hidden; })
        .map(function (d) { return d.getAttribute("data-slug"); }));
    }
    all("button[data-klic]", panel).forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.getAttribute("data-klic");
        var value = button.getAttribute("data-hodnota");
        vybrano[key] = vybrano[key] === value ? "vse" : value;
        all('button[data-klic="' + key + '"]', panel).forEach(function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-hodnota") === vybrano[key] ? "true" : "false");
        });
        redraw();
      });
    });
    redraw();
  }

  /* ---------- the full-screen viewer ---------- */

  var prohlizecStav = null;
  var prohlizecData = {};
  var prohlizecPrvek = null;

  function nactiData() {
    var tag = v("script[data-dila]");
    if (!tag) return;
    try {
      JSON.parse(tag.textContent).forEach(function (z) { prohlizecData[z.slug] = z; });
    } catch (error) { prohlizecData = {}; }
  }

  function setViewer(slugs) {
    if (!KZ.prohlizec || !prohlizecPrvek) return;
    var open = prohlizecStav && prohlizecStav.otevreno;
    var where = open ? KZ.prohlizec.aktualni(prohlizecStav) : null;
    prohlizecStav = KZ.prohlizec.zaloz(slugs, where);
    if (open && where && slugs.indexOf(where) >= 0) {
      prohlizecStav = KZ.prohlizec.otevri(prohlizecStav, where);
      renderViewer();
    } else if (open) {
      closeViewer();
    }
  }

  function renderViewer() {
    var slug = KZ.prohlizec.aktualni(prohlizecStav);
    var record = prohlizecData[slug];
    if (!record) return;
    v("[data-plocha]", prohlizecPrvek).innerHTML = record.obrazek;
    var poz = KZ.prohlizec.pozice(prohlizecStav);
    text(v("[data-pozice]", prohlizecPrvek), poz.cislo + " " + s("pozice") + " " + poz.celkem);
    var caption = v("[data-popisek]", prohlizecPrvek);
    caption.innerHTML = "";
    var h = doc.createElement("p");
    h.innerHTML = "<strong></strong><br><span></span>";
    v("strong", h).textContent = record.nazev;
    v("span", h).textContent = record.radek;
    caption.appendChild(h);
    if (record.popis) {
      var p = doc.createElement("p");
      p.textContent = record.popis;
      caption.appendChild(p);
    }
    if (record.odkaz) {
      var a = doc.createElement("a");
      a.href = record.odkaz.kam;
      a.textContent = record.odkaz.text;
      caption.appendChild(a);
    }
    // The neighbour forwards and back is prefetched, so a switch does not blink.
    var around = KZ.prohlizec.okoli(prohlizecStav);
    [around.predchozi, around.dalsi].forEach(function (soused) {
      var z = prohlizecData[soused];
      if (!z) return;
      var shoda = /src="([^"]+)"/.exec(z.obrazek);
      if (shoda) { var im = new Image(); im.src = shoda[1]; }
    });
  }

  var whereToReturn = null;

  function openViewer(slug) {
    if (!KZ.prohlizec || !prohlizecPrvek || !prohlizecData[slug]) return false;
    prohlizecStav = KZ.prohlizec.otevri(prohlizecStav, slug);
    if (!prohlizecStav.otevreno) return false;
    whereToReturn = doc.activeElement;
    prohlizecPrvek.hidden = false;
    doc.body.style.overflow = "hidden";
    renderViewer();
    v("[data-zavri]", prohlizecPrvek).focus();
    return true;
  }

  function closeViewer() {
    if (!prohlizecPrvek) return;
    prohlizecStav = KZ.prohlizec.zavri(prohlizecStav);
    prohlizecPrvek.hidden = true;
    doc.body.style.overflow = "";
    if (whereToReturn && whereToReturn.focus) whereToReturn.focus();
  }

  function viewer() {
    prohlizecPrvek = v("[data-prohlizec]");
    if (!prohlizecPrvek || !KZ.prohlizec) return;
    nactiData();
    setViewer(all("[data-mrizka] [data-slug]").map(function (d) { return d.getAttribute("data-slug"); }));

    all("[data-otevri]").forEach(function (link) {
      link.addEventListener("click", function (udalost) {
        // A left click with no modifier opens the viewer; Ctrl/Cmd-click and the
        // middle button leave the browser its own new window.
        if (udalost.metaKey || udalost.ctrlKey || udalost.shiftKey || udalost.button !== 0) return;
        if (openViewer(link.getAttribute("data-otevri"))) udalost.preventDefault();
      });
    });

    function step(co) {
      if (co === "dalsi") prohlizecStav = KZ.prohlizec.dalsi(prohlizecStav);
      else if (co === "predchozi") prohlizecStav = KZ.prohlizec.predchozi(prohlizecStav);
      else if (co === "zavri") { closeViewer(); return; }
      else return;
      renderViewer();
    }
    v("[data-dalsi]", prohlizecPrvek).addEventListener("click", function () { step("dalsi"); });
    v("[data-predchozi]", prohlizecPrvek).addEventListener("click", function () { step("predchozi"); });
    v("[data-zavri]", prohlizecPrvek).addEventListener("click", closeViewer);
    prohlizecPrvek.addEventListener("click", function (udalost) {
      if (udalost.target === prohlizecPrvek) closeViewer();
    });
    doc.addEventListener("keydown", function (udalost) {
      if (prohlizecPrvek.hidden) return;
      var co = KZ.prohlizec.klavesa(udalost.key);
      if (co) { udalost.preventDefault(); step(co); }
    });
  }

  /* ---------- the basket ---------- */

  function loadCart() {
    if (!KZ.kosik) return null;
    try { return KZ.kosik.zKodu(window.localStorage.getItem(ULOZISTE)); }
    catch (error) { return KZ.kosik.prazdny(); }
  }
  function saveCart(cart) {
    try { window.localStorage.setItem(ULOZISTE, KZ.kosik.naKod(cart)); } catch (error) { /* a private window */ }
  }

  function worksFromPage() {
    // The shop and the basket both need the current prices and states. They are
    // taken from the tiles the site rendered, not from the copy in localStorage
    // -- that one would lie once a work is sold.
    var out = [];
    all("[data-eshop-dila] script[type=\"application/json\"]").forEach(function (z) {
      try { out = out.concat(JSON.parse(z.textContent)); } catch (error) { /* nothing */ }
    });
    return out;
  }

  /* One button both adds and takes back. It used to switch off after adding
     and a work could only be got out of the basket by that small "Remove" on
     the basket page -- whoever did not find it had the work in the basket for
     good. */
  function doKosiku() {
    var buttons = all("[data-doKosiku]");
    if (!buttons.length || !KZ.kosik) return;
    var works = worksFromPage();
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var slug = button.getAttribute("data-doKosiku");
        var work = works.filter(function (d) { return d.slug === slug; })[0];
        if (!work) return;
        var cart = loadCart();
        saveCart(KZ.kosik.obsahuje(cart, slug)
          ? KZ.kosik.uber(cart, slug)
          : KZ.kosik.pridej(cart, work));
        markCart();
      });
    });
    markCart();
  }

  function buttonDescription(button, vKosiku) {
    var description = button.getAttribute(vKosiku ? "data-odebrat" : "data-pridat");
    if (description) button.textContent = description;
    button.classList.toggle("lehke", vKosiku);
  }

  function markCart() {
    if (!KZ.kosik) return;
    var cart = loadCart();
    var count = KZ.kosik.pocet(cart);
    all("[data-pocet-kosiku]").forEach(function (p) {
      var stare = p.textContent;
      p.textContent = count ? String(count) : "";
      p.hidden = !count;
      // The number hops after a change; we take the class off again so it can run anew.
      if (count && stare !== p.textContent) {
        p.classList.remove("poskoc");
        void p.offsetWidth;
        p.classList.add("poskoc");
      }
    });
    // The link to the basket in the side column makes sense only with something in it.
    all("[data-kosik-odkaz]").forEach(function (o) { o.hidden = !count; });
    all("[data-doKosiku]").forEach(function (button) {
      buttonDescription(button, KZ.kosik.obsahuje(cart, button.getAttribute("data-doKosiku")));
    });
  }

  window.KZweb = { korun: crowns, nactiKosik: loadCart, ulozKosik: saveCart, oznacKosik: markCart, s: s, v: v, vse: all };

  function start() {
    languageSwitch();
    menu();
    news();
    filtry();
    viewer();
    doKosiku();
    // The link to the basket is in the side column on every page, not only where
    // the "into the basket" buttons are -- which is why it is marked separately.
    markCart();
    if (window.KZkosikStranka) window.KZkosikStranka();
    if (window.KZformulare) window.KZformulare();
    if (window.KZkalendarStranka) window.KZkalendarStranka();
    if (window.KZakce) window.KZakce();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();
})();
