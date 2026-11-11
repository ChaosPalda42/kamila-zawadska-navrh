/* The event detail. A click on an event -- in the month's grid, in the "what
   is coming" and "what has been" lists and in the news bar -- DOES NOT LEAVE
   the page: the detail is picked up from the spot that was clicked and grows
   over the page.

   Without JavaScript all those events stay ordinary links to an anchor in the
   calendar, so a browser with no script reaches the description too.

   What an event is at a given moment is worked out by `KZ.udalost` (contract
   C-012): its state in time, how many days are left, the neighbours on the
   timeline. Here it is only drawn. */
(function () {
  "use strict";
  var KZ = window.KZ || {};
  var doc = document;
  var html = doc.documentElement;
  function v(volba, root) { return (root || doc).querySelector(volba); }
  function all(volba, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(volba)); }

  function jsonZe(volba, replacement) {
    var tag = v(volba);
    if (!tag) return replacement;
    try { return JSON.parse(tag.textContent); } catch (error) { return replacement; }
  }

  window.KZakce = function () {
    var element = v("[data-detail-akce]");
    if (!element || !KZ.udalost) return;
    var udalosti = jsonZe("script[data-udalosti-detail]", []);
    if (!udalosti.length) return;

    var panel = v("[data-detail-panel]", element);
    var body = v("[data-detail-telo]", element);
    var toCourses = v("[data-detail-kurzy]", element);
    var coursesBase = toCourses ? toCourses.getAttribute("href") : "";
    var thereAndBack = v("[data-detail-predchozi]", element);
    var tamVpred = v("[data-detail-dalsi]", element);
    var openId = null;
    var whereToReturn = null;

    function s(key) { return element.getAttribute("data-" + key) || ""; }
    function today() { return new Date().toISOString().slice(0, 10); }
    function byId(id) { return KZ.udalost.podleId(udalosti, id); }

    /* "In 3 days" has three forms in Czech and those numbers are the first
       thing the eye catches on the detail -- which is why the template sends
       all three. */
    function whenInWords(u) {
      var state = KZ.udalost.stav(u, today());
      if (state === "probiha") return s("stav-probiha");
      if (state === "bylo") return s("stav-bylo");
      var howMany = KZ.udalost.dnuDo(u, today());
      if (howMany === 0) return s("dnes");
      if (howMany === 1) return s("zitra");
      var tvary = [];
      try { tvary = JSON.parse(s("za") || "[]"); } catch (error) { tvary = []; }
      if (tvary.length !== 3 || howMany === null || howMany < 0) return s("stav-chysta");
      var form = howMany >= 2 && howMany <= 4 ? tvary[1] : tvary[2];
      return form.replace("%s", String(howMany));
    }

    function elementFrom(tag, trida, text) {
      var p = doc.createElement(tag);
      if (trida) p.className = trida;
      if (text) p.textContent = text;
      return p;
    }

    function vykresli(id) {
      var u = byId(id);
      if (!u) return;
      openId = id;
      body.innerHTML = "";

      var head = elementFrom("div", "detail-hlava");
      head.appendChild(elementFrom("span", "chip " + (u.typ || ""), u.typNazev || ""));
      head.appendChild(elementFrom("span", "detail-stav " + KZ.udalost.stav(u, today()), whenInWords(u)));
      body.appendChild(head);

      var heading = elementFrom("h2", "", u.nazev || "");
      heading.id = "detail-akce-nazev";
      body.appendChild(heading);

      body.appendChild(elementFrom("p", "detail-kdy", u.kdy + (u.cas ? ", " + u.cas : "")));
      if (u.misto) {
        var placeLine = elementFrom("p", "detail-kde");
        placeLine.appendChild(elementFrom("span", "verzalky", s("kde")));
        placeLine.appendChild(doc.createTextNode(" " + u.misto));
        body.appendChild(placeLine);
      }
      if (u.popis) body.appendChild(elementFrom("p", "", u.popis));

      // The works that hung at the event wait finished in a <template> beside
      // the detail: only the build knows the srcsets, and the paths must go through
      // the prefix for GitHub Pages, which reaches HTML attributes, not JSON strings.
      var template = v('template[data-dila-akce="' + id.replace(/"/g, '\\"') + '"]', element);
      if (template && template.content) {
        body.appendChild(elementFrom("p", "verzalky detail-nadpis", s("dila")));
        body.appendChild(template.content.cloneNode(true));
      }

      /* A course needs a link to where it can be signed up for close at hand --
         otherwise a visitor reads that the course exists and is none the
         wiser. */
      if (toCourses) {
        toCourses.hidden = u.typ !== "kurz";
        toCourses.href = coursesBase + (u.kurz ? "#" + encodeURIComponent(u.kurz) : "");
      }

      var okolo = KZ.udalost.sousedi(udalosti, today(), id);
      thereAndBack.disabled = !okolo.predchozi;
      tamVpred.disabled = !okolo.dalsi;
      thereAndBack.setAttribute("data-kam", okolo.predchozi || "");
      tamVpred.setAttribute("data-kam", okolo.dalsi || "");
      panel.setAttribute("aria-labelledby", "detail-akce-nazev");
      panel.scrollTop = 0;
    }

    /* The panel is picked up from the tile that was clicked: where that tile
       lies is worked out, the panel shrinks there for a moment and then
       travels to its place. With motion not allowed it simply appears. */
    function vyzvedni(origin) {
      if (!panel.animate || !html.classList.contains("pohyb") || !origin) return;
      var r = origin.getBoundingClientRect();
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

    function open(id, origin) {
      if (!byId(id)) return false;
      if (element.hidden) whereToReturn = doc.activeElement;
      vykresli(id);
      element.hidden = false;
      doc.body.style.overflow = "hidden";
      vyzvedni(origin);
      var close = v("[data-detail-zavri]", element);
      if (close) close.focus();
      return true;
    }

    function close() {
      if (element.hidden) return;
      element.hidden = true;
      openId = null;
      doc.body.style.overflow = "";
      if (whereToReturn && whereToReturn.focus) whereToReturn.focus();
    }

    /* The click is caught on the document, not on the individual events: the
       month's grid is redrawn when the month changes and new links would lose
       their listener. */
    doc.addEventListener("click", function (udalost) {
      if (udalost.metaKey || udalost.ctrlKey || udalost.shiftKey || udalost.button !== 0) return;
      if (udalost.target.closest("[data-detail-akce]")) return;
      var trigger = udalost.target.closest("[data-akce]");
      if (!trigger) return;
      if (open(trigger.getAttribute("data-akce"), trigger)) udalost.preventDefault();
    });

    // The "detail" button on an event in a list makes sense only with the script.
    all("[data-vic]").forEach(function (button) { button.hidden = false; });

    [thereAndBack, tamVpred].forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-kam");
        if (target) open(target, panel);
      });
    });
    all("[data-detail-zavri], [data-detail-plachta]", element).forEach(function (co) {
      co.addEventListener("click", close);
    });
    doc.addEventListener("keydown", function (udalost) {
      if (element.hidden) return;
      if (udalost.key === "Escape") { udalost.preventDefault(); close(); return; }
      if (udalost.key === "ArrowLeft" && !thereAndBack.disabled) { udalost.preventDefault(); thereAndBack.click(); }
      if (udalost.key === "ArrowRight" && !tamVpred.disabled) { udalost.preventDefault(); tamVpred.click(); }
    });

    // A link to an event's anchor (from the news bar on another page, say) opens
    // the detail at once -- otherwise one lands mid-list and cannot tell why.
    if (window.location.hash.length > 1) {
      var zHashe = decodeURIComponent(window.location.hash.slice(1));
      if (byId(zHashe)) open(zHashe, v('[data-akce="' + zHashe.replace(/"/g, '\\"') + '"]'));
    }
  };
})();
