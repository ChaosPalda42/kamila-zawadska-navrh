/* Motion. The client wants more animation than the model has, so there is a
   layer of our own for it.

   One rule holds it all together: nothing moves and nothing is hidden until
   this script adds the class `pohyb` to <html>. With no script, with reduced
   motion turned on, and after an error in the JS, the whole site is therefore
   visible at once and in its place -- the animation is an ornament, not a
   load-bearing wall.

   Only opacity and transform are animated (the graphics card can do those)
   and never the reproduction of a painting itself: no filters, no blur, no
   tinting. A painting may only grow by two per cent under the cursor. */
(function () {
  "use strict";
  var doc = document;
  var html = doc.documentElement;
  var klidne = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  function all(volba, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(volba));
  }

  /* The elements that surface while scrolling. They are marked from here, so
     the templates need know nothing about animation. */
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
    var hlidac = new IntersectionObserver(function (records) {
      records.forEach(function (z) {
        if (!z.isIntersecting) return;
        z.target.classList.add("videt");
        hlidac.unobserve(z.target);
      });
      // The threshold is zero on purpose: the gallery section is taller than the
      // window, and with a threshold in per cent it would never surface.
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });

    ODHALIT.forEach(function (volba) {
      all(volba).forEach(function (element, i) {
        if (element.classList.contains("odhal")) return;
        // It has to be measured BEFORE the element gets the class `odhal`:
        // reading a dimension forces the styles to be recomputed, and were it
        // already transparent by then, the transition would run all the same.
        var naObrazovce = element.getBoundingClientRect().top < window.innerHeight;
        element.classList.add("odhal");
        // The position in the row gives the cascade; after six elements nothing
        // waits any more, so the bottom of a long gallery does not open slower
        element.style.setProperty("--poradi", String(Math.min(i, 5)));
        // What is on the screen right after loading is visible at once and with no
        // transition: the arrival of the first screen is handled by the transition
        // between pages, and a double fade would look sluggish.
        if (naObrazovce) {
          element.classList.add("videt");
          return;
        }
        hlidac.observe(element);
      });
    });
  }

  /* The photographs arrive one by one: as soon as an image has loaded, it
     comes out of transparent. That keeps a tile from flashing a white
     frame. */
  function photos() {
    all(".ram img, .platno img, .portret img").forEach(function (obr) {
      if (obr.complete && obr.naturalWidth > 0) {
        obr.classList.add("nactena");
        return;
      }
      obr.addEventListener("load", function () { obr.classList.add("nactena"); });
      obr.addEventListener("error", function () { obr.classList.add("nactena"); });
    });
  }

  /* The thin ochre line at the top shows how much of a long gallery is behind us. */
  function progress() {
    var pas = doc.createElement("div");
    pas.className = "postup";
    pas.setAttribute("aria-hidden", "true");
    var cara = doc.createElement("span");
    pas.appendChild(cara);
    doc.body.appendChild(pas);

    var ceka = false;
    function recalculate() {
      ceka = false;
      var height = doc.documentElement.scrollHeight - window.innerHeight;
      var where = height > 120 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
      cara.style.transform = "scaleX(" + where.toFixed(4) + ")";
      pas.classList.toggle("vidno", height > 120);
    }
    window.addEventListener("scroll", function () {
      if (ceka) return;
      ceka = true;
      window.requestAnimationFrame(recalculate);
    }, { passive: true });
    window.addEventListener("resize", recalculate);
    recalculate();
  }

  /* A tile tips after the mouse under the cursor. Two degrees, nothing wild --
     a painting is to stay a painting. */
  function naklon() {
    if (!window.matchMedia("(hover: hover) and (min-width: 60.01rem)").matches) return;
    all(".mrizka > .dlazdice .ram").forEach(function (frame) {
      var dlazdice = frame.closest(".dlazdice");
      if (!dlazdice) return;
      dlazdice.addEventListener("pointermove", function (e) {
        var r = frame.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        frame.style.setProperty("--naklon-x", (-y * 2.4).toFixed(2) + "deg");
        frame.style.setProperty("--naklon-y", (x * 2.4).toFixed(2) + "deg");
      });
      dlazdice.addEventListener("pointerleave", function () {
        frame.style.setProperty("--naklon-x", "0deg");
        frame.style.setProperty("--naklon-y", "0deg");
      });
    });
  }

  /* The welcome curtain. It appears once a visit (not on every click through),
     covers the moment while the photographs are being fetched, and clears up
     after itself. The hard timer is here on purpose: were "load" never to
     fire, the curtain goes anyway -- nobody may be left looking at white. */
  var CLONA_NEJMIN = 700;
  var CLONA_NEJDEL = 2400;

  function uzVidel() {
    try {
      if (window.sessionStorage.getItem("kz-uvitani") === "1") return true;
      window.sessionStorage.setItem("kz-uvitani", "1");
      return false;
    } catch (e) {
      // A private window or storage turned off: we show the curtain, no harm done.
      return false;
    }
  }

  function clona() {
    if (uzVidel()) return;
    var name = doc.querySelector(".logo span");
    var element = doc.createElement("div");
    element.className = "nacitani";
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = '<div class="znacka"><span class="jmeno"></span><span class="tah"></span></div>';
    element.querySelector(".jmeno").textContent = (name && name.textContent) || "";
    doc.body.appendChild(element);

    var beginning = Date.now();
    var uklizeno = false;
    function ukliď() {
      if (uklizeno) return;
      uklizeno = true;
      element.classList.add("pryc");
      window.setTimeout(function () {
        if (element.parentNode) element.parentNode.removeChild(element);
      }, 600);
    }
    function dojelo() {
      var uplynulo = Date.now() - beginning;
      window.setTimeout(ukliď, Math.max(0, CLONA_NEJMIN - uplynulo));
    }
    if (doc.readyState === "complete") dojelo();
    else window.addEventListener("load", dojelo);
    window.setTimeout(ukliď, CLONA_NEJDEL);
  }

  /* The viewer: switching to the next work fades the picture. We change it
     here, because `web.js` only swaps the surface's content and leaves the
     animation alone. */
  function viewer() {
    var area = doc.querySelector("[data-prohlizec] [data-plocha]");
    var caption = doc.querySelector("[data-prohlizec] [data-popisek]");
    if (!area || !window.MutationObserver) return;
    function fade(element) {
      if (!element) return;
      element.classList.remove("prolnuti");
      // A redraw in between, or the browser will not start the animation again.
      void element.offsetWidth;
      element.classList.add("prolnuti");
    }
    new MutationObserver(function () { fade(area.firstElementChild); })
      .observe(area, { childList: true });
    if (caption) {
      new MutationObserver(function () { fade(caption); })
        .observe(caption, { childList: true, characterData: true, subtree: true });
    }
  }

  /* The claim on the opening comes in word by word. We split it here, not in
     the template: the HTML is to keep one whole sentence, so that a search
     engine and a screen reader read it as a sentence and the gate over the
     visible text finds it. */
  function slova() {
    var heading = doc.querySelector(".hero-text h1");
    if (!heading || heading.querySelector(".slovo")) return;
    var sentence = (heading.textContent || "").trim();
    if (!sentence) return;
    var parts = sentence.split(/\s+/);
    heading.textContent = "";
    parts.forEach(function (word, i) {
      var vnejsi = doc.createElement("span");
      vnejsi.className = "slovo";
      vnejsi.style.setProperty("--poradi", String(i));
      var vnitrni = doc.createElement("span");
      vnitrni.textContent = word;
      vnejsi.appendChild(vnitrni);
      heading.appendChild(vnejsi);
      if (i < parts.length - 1) heading.appendChild(doc.createTextNode(" "));
    });
    heading.classList.add("po-slovech");
  }

  /* Internal links (filters, anchors) travel smoothly -- CSS does that, and
     here we only add the behaviour for browsers without scroll-behavior. */
  function anchors() {
    if ("scrollBehavior" in html.style) return;
    all('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var target = doc.getElementById(link.getAttribute("href").slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView();
      });
    });
  }

  var firstEnable = true;

  function enable() {
    html.classList.add("pohyb");
    // The curtain belongs to the page's start. If motion is allowed only while
    // someone is already reading, we will not throw a welcome over their text.
    if (firstEnable) clona();
    firstEnable = false;
    // Should the observer stay silent for any reason, after five seconds we
    // reveal everything. Nothing on the site may stay hidden for an ornament.
    window.setTimeout(function () {
      all(".odhal:not(.videt)").forEach(function (p) {
        if (p.getBoundingClientRect().top < window.innerHeight * 1.5) p.classList.add("videt");
      });
    }, 5000);
    pripravOdhaleni();
    slova();
    photos();
    viewer();
    progress();
    naklon();
    anchors();
  }

  function vypni() {
    html.classList.remove("pohyb");
    all(".odhal").forEach(function (p) { p.classList.add("videt"); });
  }

  function start() {
    if (klidne && klidne.matches) {
      // `fotky()` runs even so: it only sets a class, nothing moves.
      photos();
    } else {
      enable();
    }
    // When someone turns reduced motion on mid-visit, we switch off.
    if (klidne && klidne.addEventListener) {
      klidne.addEventListener("change", function () {
        if (klidne.matches) vypni(); else enable();
      });
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();

  window.KZanimace = { zapni: enable, vypni: vypni };
})();
