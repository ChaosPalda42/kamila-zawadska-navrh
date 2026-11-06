/* Pohyb. Klientka chce víc animací, než má vzor, tak je tu vlastní vrstva.

   Jedno pravidlo drží všechno pohromadě: nic se nehýbe a nic není schované,
   dokud tenhle skript nepřidá na <html> třídu "pohyb". Bez skriptu, se
   zapnutým omezeným pohybem i při chybě v JS je tedy celý web hned vidět
   a na svém místě — animace je ozdoba, ne nosná konstrukce.

   Animuje se jen opacity a transform (to umí grafická karta) a nikdy ne
   samotná reprodukce obrazu: žádné filtry, žádné rozmazání, žádné
   obarvení. Obraz se smí jen zvětšit o dva procenta pod kurzorem. */
(function () {
  "use strict";
  var doc = document;
  var html = doc.documentElement;
  var klidne = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  function vse(volba, koren) {
    return Array.prototype.slice.call((koren || doc).querySelectorAll(volba));
  }

  /* Prvky, které se vynořují při scrollování. Značíme je odsud, aby šablony
     o animacích nemusely vědět. */
  var ODHALIT = [
    ".obsah > section",
    ".mrizka > .dlazdice",
    ".akce-seznam > li",
    ".kurz",
    ".bio > *",
    ".kontakt > *",
    ".dilo > *",
  ];

  function pripravOdhaleni() {
    if (!window.IntersectionObserver) return;
    var hlidac = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting) return;
        z.target.classList.add("videt");
        hlidac.unobserve(z.target);
      });
      // Práh je nula schválně: oddíl galerie je vyšší než okno a při
      // procentním prahu by se nikdy nevynořil.
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });

    ODHALIT.forEach(function (volba) {
      vse(volba).forEach(function (prvek, i) {
        if (prvek.classList.contains("odhal")) return;
        // Změřit se musí DŘÍV, než prvek dostane třídu "odhal": čtení
        // rozměru si vynutí přepočet stylů, a kdyby mezi tím už byl
        // průhledný, přechod by i tak proběhl.
        var naObrazovce = prvek.getBoundingClientRect().top < window.innerHeight;
        prvek.classList.add("odhal");
        // Pořadí v řadě dává kaskádu; po šesti prvcích už se nečeká,
        // ať se spodek dlouhé galerie neotvírá pomaleji než horní.
        prvek.style.setProperty("--poradi", String(Math.min(i, 5)));
        // Co je po načtení rovnou na obrazovce, je vidět hned a bez
        // přechodu: o příjezd první obrazovky se stará přechod mezi
        // stránkami, dvojí prolnutí by působilo loudavě.
        if (naObrazovce) {
          prvek.classList.add("videt");
          return;
        }
        hlidac.observe(prvek);
      });
    });
  }

  /* Fotky dojíždějí: jakmile se obrázek načte, vyjede z průhledna. Zabrání to
     tomu, aby dlaždice problikla bílým rámem. */
  function fotky() {
    vse(".ram img, .platno img, .portret img").forEach(function (obr) {
      if (obr.complete && obr.naturalWidth > 0) {
        obr.classList.add("nactena");
        return;
      }
      obr.addEventListener("load", function () { obr.classList.add("nactena"); });
      obr.addEventListener("error", function () { obr.classList.add("nactena"); });
    });
  }

  /* Tenká okrová linka nahoře ukazuje, kolik dlouhé galerie je za námi. */
  function postup() {
    var pas = doc.createElement("div");
    pas.className = "postup";
    pas.setAttribute("aria-hidden", "true");
    var cara = doc.createElement("span");
    pas.appendChild(cara);
    doc.body.appendChild(pas);

    var ceka = false;
    function prepocitej() {
      ceka = false;
      var vyska = doc.documentElement.scrollHeight - window.innerHeight;
      var kde = vyska > 120 ? Math.min(1, Math.max(0, window.scrollY / vyska)) : 0;
      cara.style.transform = "scaleX(" + kde.toFixed(4) + ")";
      pas.classList.toggle("vidno", vyska > 120);
    }
    window.addEventListener("scroll", function () {
      if (ceka) return;
      ceka = true;
      window.requestAnimationFrame(prepocitej);
    }, { passive: true });
    window.addEventListener("resize", prepocitej);
    prepocitej();
  }

  /* Dlaždice se pod kurzorem nakloní za myší. Dva stupně, nic divokého —
     obraz má zůstat obrazem. */
  function naklon() {
    if (!window.matchMedia("(hover: hover) and (min-width: 60.01rem)").matches) return;
    vse(".mrizka > .dlazdice .ram").forEach(function (ram) {
      var dlazdice = ram.closest(".dlazdice");
      if (!dlazdice) return;
      dlazdice.addEventListener("pointermove", function (e) {
        var r = ram.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        ram.style.setProperty("--naklon-x", (-y * 2.4).toFixed(2) + "deg");
        ram.style.setProperty("--naklon-y", (x * 2.4).toFixed(2) + "deg");
      });
      dlazdice.addEventListener("pointerleave", function () {
        ram.style.setProperty("--naklon-x", "0deg");
        ram.style.setProperty("--naklon-y", "0deg");
      });
    });
  }

  /* Uvítací clona. Objeví se jednou za návštěvu (ne při každém prokliku),
     překryje chvíli, kdy se dotahují fotky, a sama po sobě uklidí. Tvrdý
     časovač je tu schválně: kdyby se "load" nikdy neozval, clona zmizí i
     tak — nikdo nesmí zůstat koukat na bílo. */
  var CLONA_NEJMIN = 700;
  var CLONA_NEJDEL = 2400;

  function uzVidel() {
    try {
      if (window.sessionStorage.getItem("kz-uvitani") === "1") return true;
      window.sessionStorage.setItem("kz-uvitani", "1");
      return false;
    } catch (e) {
      // Soukromé okno nebo zakázané úložiště: clonu ukážeme, nic se neděje.
      return false;
    }
  }

  function clona() {
    if (uzVidel()) return;
    var jmeno = doc.querySelector(".logo span");
    var prvek = doc.createElement("div");
    prvek.className = "nacitani";
    prvek.setAttribute("aria-hidden", "true");
    prvek.innerHTML = '<div class="znacka"><span class="jmeno"></span><span class="tah"></span></div>';
    prvek.querySelector(".jmeno").textContent = (jmeno && jmeno.textContent) || "";
    doc.body.appendChild(prvek);

    var zacatek = Date.now();
    var uklizeno = false;
    function ukliď() {
      if (uklizeno) return;
      uklizeno = true;
      prvek.classList.add("pryc");
      window.setTimeout(function () {
        if (prvek.parentNode) prvek.parentNode.removeChild(prvek);
      }, 600);
    }
    function dojelo() {
      var uplynulo = Date.now() - zacatek;
      window.setTimeout(ukliď, Math.max(0, CLONA_NEJMIN - uplynulo));
    }
    if (doc.readyState === "complete") dojelo();
    else window.addEventListener("load", dojelo);
    window.setTimeout(ukliď, CLONA_NEJDEL);
  }

  /* Prohlížeč: při přepnutí na další dílo se obraz prolne. Měníme ho
     my tady, protože web.js jen vymění obsah plochy a o animace se nestará. */
  function prohlizec() {
    var plocha = doc.querySelector("[data-prohlizec] [data-plocha]");
    var popisek = doc.querySelector("[data-prohlizec] [data-popisek]");
    if (!plocha || !window.MutationObserver) return;
    function prolni(prvek) {
      if (!prvek) return;
      prvek.classList.remove("prolnuti");
      // Překreslení mezi tím, jinak prohlížeč animaci nespustí znovu.
      void prvek.offsetWidth;
      prvek.classList.add("prolnuti");
    }
    new MutationObserver(function () { prolni(plocha.firstElementChild); })
      .observe(plocha, { childList: true });
    if (popisek) {
      new MutationObserver(function () { prolni(popisek); })
        .observe(popisek, { childList: true, characterData: true, subtree: true });
    }
  }

  /* Claim na úvodu naskakuje po slovech. Rozdělujeme ho tady, ne v šabloně:
     v HTML má zůstat jedna celá věta, aby ji vyhledávač i čtečka přečetly
     jako větu a brána na viditelný text ji našla. */
  function slova() {
    var nadpis = doc.querySelector(".hero-text h1");
    if (!nadpis || nadpis.querySelector(".slovo")) return;
    var veta = (nadpis.textContent || "").trim();
    if (!veta) return;
    var casti = veta.split(/\s+/);
    nadpis.textContent = "";
    casti.forEach(function (slovo, i) {
      var vnejsi = doc.createElement("span");
      vnejsi.className = "slovo";
      vnejsi.style.setProperty("--poradi", String(i));
      var vnitrni = doc.createElement("span");
      vnitrni.textContent = slovo;
      vnejsi.appendChild(vnitrni);
      nadpis.appendChild(vnejsi);
      if (i < casti.length - 1) nadpis.appendChild(doc.createTextNode(" "));
    });
    nadpis.classList.add("po-slovech");
  }

  /* Vnitřní odkazy (filtry, kotvy) jedou plynule — řeší CSS, tady jen
     doplníme chování pro prohlížeče bez scroll-behavior. */
  function kotvy() {
    if ("scrollBehavior" in html.style) return;
    vse('a[href^="#"]').forEach(function (odkaz) {
      odkaz.addEventListener("click", function (e) {
        var cil = doc.getElementById(odkaz.getAttribute("href").slice(1));
        if (!cil) return;
        e.preventDefault();
        cil.scrollIntoView();
      });
    });
  }

  var prvniZapnuti = true;

  function zapni() {
    html.classList.add("pohyb");
    // Clona patří ke startu stránky. Když si člověk pohyb povolí až během
    // čtení, nebudeme mu přes text přehazovat uvítání.
    if (prvniZapnuti) clona();
    prvniZapnuti = false;
    // Kdyby se hlídač z jakéhokoli důvodu neozval, po pěti vteřinách
    // odhalíme všechno. Nic na webu nesmí zůstat schované kvůli ozdobě.
    window.setTimeout(function () {
      vse(".odhal:not(.videt)").forEach(function (p) {
        if (p.getBoundingClientRect().top < window.innerHeight * 1.5) p.classList.add("videt");
      });
    }, 5000);
    pripravOdhaleni();
    slova();
    fotky();
    prohlizec();
    postup();
    naklon();
    kotvy();
  }

  function vypni() {
    html.classList.remove("pohyb");
    vse(".odhal").forEach(function (p) { p.classList.add("videt"); });
  }

  function start() {
    if (klidne && klidne.matches) {
      // I tak doběhne fotky(): jen dosadí třídu, nic se nehýbe.
      fotky();
    } else {
      zapni();
    }
    // Když si člověk omezení pohybu zapne až během prohlížení, vypínáme.
    if (klidne && klidne.addEventListener) {
      klidne.addEventListener("change", function () {
        if (klidne.matches) vypni(); else zapni();
      });
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();

  window.KZanimace = { zapni: zapni, vypni: vypni };
})();
