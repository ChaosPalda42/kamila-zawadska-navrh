/* The admin in the browser.

   The deciding is in the libraries (`KZ.administrace`, `KZ.nahrani`,
   `KZ.udalost`, `KZ["texty-sekce"]`) and has been through the acceptance
   tests; here there is only DOM: fill a form, read it, draw a list, save to
   localStorage.

   In the demo the admin stands behind a demonstration door and everything
   lives in one person's browser. An uploaded photo is held in the tab's
   memory alone (objectURL) -- data URLs would blow the browser's storage
   apart. On the live site both go to a server; the admin says so, so the
   client does not have it from us only.

   Nothing here breaks so far that one cannot carry on: every save goes
   through the check from C-007 and the errors are printed by the fields. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.querySelector("[data-admin]");
  if (!root) return;

  var A = KZ.administrace;
  var N = KZ.nahrani;
  var U = KZ.udalost;
  var TS = KZ["texty-sekce"];
  var D = KZ.dila;
  var P = KZ.preklad;

  var KEY = "kz-administrace";
  var language = (doc.documentElement.lang || "cs").indexOf("en") === 0 ? "en" : "cs";

  function json(volba, backup) {
    var element = doc.querySelector(volba);
    if (!element) return backup;
    try { return JSON.parse(element.textContent); } catch (e) { return backup; }
  }
  var site = json("script[data-site]", { dila: [], udalosti: [], kurzy: [] });
  var originalTexts = json("script[data-texty]", {});
  var L = json("script[data-popisky]", {});

  /* The messages for the checks from C-007 and C-013. The workshop's own
     labels do not belong in `data/texty.json` -- in the text editor they
     would only be in the way. */
  var ERRORS = {
    cs: {
      slug: "Adresa (slug) nesmí být prázdná.",
      nazev: "Název česky je povinný.",
      stav: "Vyberte stav.",
      cena: "Dílo v e-shopu k prodeji musí mít cenu větší než nula.",
      nikde: "Vyberte aspoň jedno místo: galerie, nebo e-shop.",
      id: "Adresa (slug) nesmí být prázdná.",
      typ: "Vyberte typ akce.",
      od: "Zadejte datum začátku.",
      do: "Konec nesmí být dřív než začátek.",
      kapacita: "Kapacita musí být celé číslo větší než nula.",
      prazdny: "Soubor je prázdný.",
      typSouboru: "Obrázek musí být JPEG, PNG nebo WebP.",
      velikost: "Obrázek je větší než 6 MB.",
      ulozeno: "Uloženo.",
    },
    en: {
      slug: "The address (slug) cannot be empty.",
      nazev: "A Czech title is required.",
      stav: "Pick a status.",
      cena: "A work for sale needs a price above zero.",
      nikde: "Pick at least one place: the gallery or the shop.",
      id: "The address (slug) cannot be empty.",
      typ: "Pick an event type.",
      od: "Enter the start date.",
      do: "The end cannot be before the start.",
      kapacita: "Capacity must be a whole number above zero.",
      prazdny: "The file is empty.",
      typSouboru: "The image must be JPEG, PNG or WebP.",
      velikost: "The image is larger than 6 MB.",
      ulozeno: "Saved.",
    },
  };
  function ch(klic) { return (ERRORS[language] || ERRORS.cs)[klic] || klic; }
  function p(klic) { return L[klic] || klic; }

  var SECTION_NAMES = {
    cs: { uvod: "Úvod", galerie: "Galerie", eshop: "E-shop", kalendar: "Kalendář", kurzy: "Kurzy", bio: "O mně", kontakt: "Kontakt", navigace: "Navigace", ostatni: "Ostatní" },
    en: { uvod: "Home", galerie: "Gallery", eshop: "Shop", kalendar: "Calendar", kurzy: "Courses", bio: "About", kontakt: "Contact", navigace: "Navigation", ostatni: "Other" },
  };

  var stav = nacti() || A.zaloz(site, originalTexts);
  /* Previews of the uploaded photographs. The key is the work's slug, the
     value is the gallery from C-013. It does not go to localStorage -- an
     objectURL does not outlive the tab. */
  var photos = {};
  var upravuje = { dilo: null, udalost: null, kurz: null };
  var selectedSection = "uvod";

  function nacti() {
    try {
      var text = window.localStorage.getItem(KEY);
      return text ? A.zKodu(text) : null;
    } catch (e) { return null; }
  }
  function uloz() {
    try { window.localStorage.setItem(KEY, A.naKod(stav)); } catch (e) { /* a private window */ }
  }
  function discard() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing */ }
  }

  function v(volba, scope) { return (scope || root).querySelector(volba); }
  function all(volba, scope) {
    return Array.prototype.slice.call((scope || root).querySelectorAll(volba));
  }
  function text(value) {
    var element = doc.createElement("span");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
  }
  function jazykem(value) { return P.pole(value, language); }
  function cs(value) {
    if (value == null) return "";
    return typeof value === "string" ? value : (value.cs || "");
  }
  function en(value) {
    if (value == null || typeof value === "string") return "";
    return value.en || "";
  }
  function dvojjazycne(textCs, textEn) {
    var value = { cs: textCs };
    if (textEn) value.en = textEn;
    return value;
  }
  function number(value) {
    var n = parseInt(String(value).replace(/\s/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------- the door ---------- */

  function vratnice() {
    var clona = doc.querySelector("[data-vratnice]");
    var form = doc.querySelector("[data-vratnice-form]");
    if (!clona || !form) { root.hidden = false; return; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clona.classList.add("pryc");
      root.hidden = false;
      window.setTimeout(function () {
        if (clona.parentNode) clona.parentNode.removeChild(clona);
      }, 500);
      var first = v('[data-zalozka="dila"]');
      if (first) first.focus();
    });
  }

  /* ---------- the sections ---------- */

  function sections() {
    var buttons = all("[data-zalozka]");
    buttons.forEach(function (tl) {
      tl.addEventListener("click", function () {
        var id = tl.getAttribute("data-zalozka");
        buttons.forEach(function (x) {
          x.setAttribute("aria-selected", x === tl ? "true" : "false");
        });
        all("[data-panel]").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== id;
        });
      });
    });
  }

  /* Czech has three forms for counts: 1 `obraz`, 2-4 `obrazy`, 5 `obrazu`.
     "3 `kurzu`" is exactly what one notices first in somebody else's
     admin. */
  function quantity(howMany, forms) {
    var shape = howMany === 1 ? forms[0] : (howMany >= 2 && howMany <= 4 ? forms[1] : forms[2]);
    return howMany + " " + shape;
  }

  function prehled() {
    var element = v("[data-pocty]");
    if (!element) return;
    var po = A.pocty(stav);
    var lines = language === "en"
      ? [quantity(po.dila, ["work", "works", "works"]), po.vGalerii + " in the gallery",
         po.vEshopu + " for sale", quantity(po.udalosti, ["event", "events", "events"]),
         quantity(po.kurzy, ["course", "courses", "courses"])]
      : [quantity(po.dila, ["obraz", "obrazy", "obrazů"]), po.vGalerii + " v galerii",
         po.vEshopu + " k prodeji", quantity(po.udalosti, ["akce", "akce", "akcí"]),
         quantity(po.kurzy, ["kurz", "kurzy", "kurzů"])];
    element.textContent = lines.join(" · ");
  }

  /* ---------- errors by the fields ---------- */

  function clearErrors(form) {
    all("[data-chyba]", form).forEach(function (element) {
      element.hidden = true;
      element.textContent = "";
    });
    all(".pole", form).forEach(function (element) { element.classList.remove("spatne"); });
  }
  function showErrors(form, klice, overlay) {
    clearErrors(form);
    // The address is worked out from the name, so an empty form would light up
    // two errors for one thing left blank. The one about the name is enough.
    if (klice.indexOf("nazev") >= 0) {
      klice = klice.filter(function (k) { return k !== "slug" && k !== "id"; });
    }
    klice.forEach(function (klic) {
      var destination = (overlay && overlay[klic]) || klic;
      var field = v('[data-pole="' + destination + '"]', form);
      if (!field) return;
      field.classList.add("spatne");
      var message = v("[data-chyba]", field);
      if (message) {
        message.textContent = ch(klic);
        message.hidden = false;
      }
      var detaily = field.closest("details");
      if (detaily) detaily.open = true;
    });
    if (klice.length) {
      var first = v(".pole.spatne input, .pole.spatne select, .pole.spatne textarea", form);
      if (first) first.focus();
    }
  }
  function done(form) {
    var tag = v("[data-ulozeno]", form);
    if (!tag) return;
    tag.textContent = ch("ulozeno");
    tag.hidden = false;
    window.setTimeout(function () { tag.hidden = true; }, 2200);
  }

  /* ---------- obrazy ---------- */

  var formWork = v("[data-form-dilo]");

  function galleryWorks(work) {
    if (!work) return { hlavni: "", obrazky: [] };
    if (!photos[work.slug]) photos[work.slug] = N.zaloz(work);
    return photos[work.slug];
  }

  function renderPhotos() {
    var items = v("[data-seznam-fotek]", formWork);
    if (!items) return;
    var gallery = currentGallery();
    items.innerHTML = gallery.obrazky.map(function (o) {
      var isMain = o.klic === gallery.hlavni;
      var preview = o.data
        ? '<img src="' + text(o.data) + '" alt="">'
        : '<span class="bez-nahledu" aria-hidden="true"></span>';
      return '<li' + (isMain ? ' class="hlavni"' : "") + ' data-fotka="' + text(o.klic) + '">' +
        '<span class="nahled">' + preview + "</span>" +
        '<span class="o-fotce"><strong>' + text(o.nazev) + "</strong>" +
        (o.velikost ? '<span class="napoveda">' + text(N.lidskaVelikost(o.velikost)) + "</span>" : "") +
        (isMain ? '<span class="odznak">' + text(p("hlavni")) + "</span>" : "") + "</span>" +
        '<span class="s-fotkou">' +
        (isMain ? "" : '<button type="button" data-fotka-hlavni title="' + text(p("dejHlavni")) + '">' + text(p("dejHlavni")) + "</button>") +
        '<button type="button" data-fotka-nahoru title="' + text(p("nahoru")) + '" aria-label="' + text(p("nahoru")) + '">↑</button>' +
        '<button type="button" data-fotka-dolu title="' + text(p("dolu")) + '" aria-label="' + text(p("dolu")) + '">↓</button>' +
        '<button type="button" data-fotka-smaz title="' + text(p("smazat")) + '" aria-label="' + text(p("smazat")) + '">×</button>' +
        "</span></li>";
    }).join("");
  }

  function galleryKey() { return upravuje.dilo || "#novy"; }
  function nastavGalerii(gallery) { photos[galleryKey()] = gallery; renderPhotos(); }
  function currentGallery() {
    var klic = galleryKey();
    if (!photos[klic]) photos[klic] = { hlavni: "", obrazky: [] };
    return photos[klic];
  }

  function addFiles(items) {
    var errors = [];
    Array.prototype.slice.call(items).forEach(function (file) {
      var description = {
        klic: file.name + ":" + file.size,
        nazev: file.name,
        typ: file.type,
        velikost: file.size,
        data: "",
      };
      var wrong = N.zkontroluj(description);
      if (wrong.length) {
        wrong.forEach(function (k) {
          var message = ch(k === "typ" ? "typSouboru" : k);
          if (errors.indexOf(message) === -1) errors.push(message);
        });
        return;
      }
      description.data = window.URL ? window.URL.createObjectURL(file) : "";
      var result = N.pridej(currentGallery(), description);
      photos[galleryKey()] = result.galerie;
    });
    renderPhotos();
    var message = v("[data-chyba-fotky]", formWork);
    if (message) {
      message.textContent = errors.join(" ");
      message.hidden = errors.length === 0;
    }
  }

  function photoHandler() {
    var incoming = v("[data-vstup-fotky]", formWork);
    var pustit = v("[data-pustit]", formWork);
    var items = v("[data-seznam-fotek]", formWork);
    if (incoming) {
      incoming.addEventListener("change", function () {
        addFiles(incoming.files);
        incoming.value = "";
      });
    }
    if (pustit) {
      ["dragenter", "dragover"].forEach(function (name) {
        pustit.addEventListener(name, function (e) {
          e.preventDefault();
          pustit.classList.add("nad");
        });
      });
      ["dragleave", "drop"].forEach(function (name) {
        pustit.addEventListener(name, function () { pustit.classList.remove("nad"); });
      });
      pustit.addEventListener("drop", function (e) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }
    if (items) {
      items.addEventListener("click", function (e) {
        var tl = e.target.closest("button");
        if (!tl) return;
        var li = tl.closest("[data-fotka]");
        if (!li) return;
        var klic = li.getAttribute("data-fotka");
        var g = currentGallery();
        if (tl.hasAttribute("data-fotka-hlavni")) nastavGalerii(N.nastavHlavni(g, klic));
        else if (tl.hasAttribute("data-fotka-nahoru")) nastavGalerii(N.posun(g, klic, -1));
        else if (tl.hasAttribute("data-fotka-dolu")) nastavGalerii(N.posun(g, klic, 1));
        else if (tl.hasAttribute("data-fotka-smaz")) nastavGalerii(N.odeber(g, klic));
      });
    }
  }

  function findWork(slug) {
    for (var i = 0; i < stav.dila.length; i += 1) {
      if (stav.dila[i].slug === slug) return stav.dila[i];
    }
    return null;
  }

  function fillWork(work) {
    var f = formWork.elements;
    f.nazev.value = cs(work && work.nazev);
    f.nazevEn.value = en(work && work.nazev);
    f.rok.value = work && work.rok ? work.rok : "";
    f.rozmer.value = (work && work.rozmer) || "";
    f.cena.value = work && typeof work.cena === "number" ? work.cena : "";
    f.stav.value = (work && work.stav) || "v-prodeji";
    f.technika.value = (work && work.technika) || "";
    f.motiv.value = (work && work.motiv) || "";
    f.album.value = (work && work.album) || "";
    f.kurz.value = (work && work.kurz) || "";
    f.popis.value = cs(work && work.popis);
    f.popisEn.value = en(work && work.popis);
    f.vGalerii.checked = work ? work.vGalerii === true : true;
    f.vEshopu.checked = work ? work.vEshopu === true : false;
    f.slug.value = (work && work.slug) || "";
    upravuje.dilo = work ? work.slug : null;
    if (work) galleryWorks(work); else photos["#novy"] = { hlavni: "", obrazky: [] };
    v("[data-rezim-dilo]").textContent = work
      ? p("upravujete") + ": " + jazykem(work.nazev)
      : p("novy");
    v("[data-zrus-dilo]").hidden = !work;
    clearErrors(formWork);
    renderPhotos();
  }

  function workList() {
    var destination = v("[data-seznam-dila]");
    if (!destination) return;
    if (!stav.dila.length) {
      destination.innerHTML = '<tr><td colspan="3">' + text(p("prazdno")) + "</td></tr>";
      return;
    }
    destination.innerHTML = stav.dila.map(function (d) {
      var scope = [];
      if (d.vGalerii === true) scope.push(p("vGalerii"));
      if (d.vEshopu === true) scope.push(p("vEshopu"));
      var photoCount = photos[d.slug] ? photos[d.slug].obrazky.length : (d.obrazek ? 1 : 0);
      return '<tr data-dilo="' + text(d.slug) + '">' +
        "<td><strong>" + text(jazykem(d.nazev)) + "</strong>" +
        '<span class="napoveda">' + text(d.slug) + "</span></td>" +
        "<td>" + text(P.t(stav.texty, "stav." + d.stav, language)) + '<span class="napoveda">' +
        text(scope.join(" · ")) + " · " + photoCount + "×</span></td>" +
        '<td class="akce-radku">' +
        '<button type="button" data-uprav-dilo>' + text(p("upravit")) + "</button> " +
        '<button type="button" data-smaz-dilo>' + text(p("smazat")) + "</button>" +
        "</td></tr>";
    }).join("");
  }

  function potvrzeniSmazani(line, event) {
    var target = v(".akce-radku", line);
    if (!target) return;
    target.innerHTML = '<span class="potvrzeni">' + text(p("opravduSmazat")) +
      ' <button type="button" data-ano>' + text(p("ano")) + "</button> " +
      '<button type="button" data-ne>' + text(p("ne")) + "</button></span>";
    v("[data-ano]", target).focus();
    v("[data-ano]", target).addEventListener("click", event);
    v("[data-ne]", target).addEventListener("click", function () { redraw(); });
  }

  if (formWork) {
    formWork.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formWork.elements;
      var nameCs = f.nazev.value.trim();
      var slug = f.slug.value.trim() || D.slug(nameCs);
      var gallery = currentGallery();
      var work = {
        slug: slug,
        nazev: dvojjazycne(nameCs, f.nazevEn.value.trim()),
        technika: f.technika.value,
        motiv: f.motiv.value,
        album: f.album.value,
        kurz: f.kurz.value,
        rok: number(f.rok.value),
        rozmer: f.rozmer.value.trim(),
        cena: number(f.cena.value),
        stav: f.stav.value,
        vGalerii: f.vGalerii.checked,
        vEshopu: f.vEshopu.checked,
        popis: dvojjazycne(f.popis.value.trim(), f.popisEn.value.trim()),
      };
      var old = upravuje.dilo ? findWork(upravuje.dilo) : null;
      work.obrazek = gallery.hlavni || (old ? old.obrazek : "") || "";
      work.fotky = gallery.obrazky.map(function (o) { return o.nazev; });
      if (old && old.alt) work.alt = old.alt;
      if (work.cena === null) delete work.cena;
      if (work.rok === null) delete work.rok;
      var result = A.ulozDilo(stav, work);
      if (result.chyby.length) {
        showErrors(formWork, result.chyby, { nikde: "kde" });
        return;
      }
      // The photographs are kept under the slug; after a rename we move them to the new one.
      if (upravuje.dilo && upravuje.dilo !== slug) {
        photos[slug] = gallery;
        delete photos[upravuje.dilo];
      } else if (!upravuje.dilo) {
        photos[slug] = gallery;
        delete photos["#novy"];
      }
      stav = result.stav;
      uloz();
      fillWork(null);
      redraw();
    });
    v("[data-zrus-dilo]").addEventListener("click", function () { fillWork(null); });
    var workListBody = v("[data-seznam-dila]");
    workListBody.addEventListener("click", function (e) {
      var line = e.target.closest("[data-dilo]");
      if (!line) return;
      var slug = line.getAttribute("data-dilo");
      if (e.target.closest("[data-uprav-dilo]")) {
        fillWork(findWork(slug));
        formWork.scrollIntoView({ block: "start" });
      } else if (e.target.closest("[data-smaz-dilo]")) {
        potvrzeniSmazani(line, function () {
          stav = A.smazDilo(stav, slug);
          if (upravuje.dilo === slug) fillWork(null);
          uloz();
          redraw();
        });
      }
    });
    photoHandler();
  }

  /* ---------- events in the calendar ---------- */

  var formUdalost = v("[data-form-udalost]");

  function vyplnUdalost(u) {
    var f = formUdalost.elements;
    f.nazev.value = cs(u && u.nazev);
    f.nazevEn.value = en(u && u.nazev);
    f.typ.value = (u && u.typ) || "vystava";
    f.album.value = (u && u.album) || "";
    f.od.value = (u && u.od) || "";
    f.do.value = (u && u.do) || "";
    f.cas.value = (u && u.cas) || "";
    f.misto.value = cs(u && u.misto);
    f.popis.value = cs(u && u.popis);
    f.popisEn.value = en(u && u.popis);
    f.aktualita.checked = u ? u.aktualita === true : false;
    f.id.value = (u && u.id) || "";
    upravuje.udalost = u ? u.id : null;
    v("[data-rezim-udalost]").textContent = u
      ? p("upravujete") + ": " + jazykem(u.nazev)
      : p("novaAkce");
    v("[data-zrus-udalost]").hidden = !u;
    clearErrors(formUdalost);
  }

  function eventList() {
    var destination = v("[data-seznam-udalosti]");
    if (!destination) return;
    var today = new Date().toISOString().slice(0, 10);
    var sorted = U.poradi(stav.udalosti, today);
    if (!sorted.length) {
      destination.innerHTML = '<tr><td colspan="3">' + text(p("prazdno")) + "</td></tr>";
      return;
    }
    destination.innerHTML = sorted.map(function (id) {
      var u = U.podleId(stav.udalosti, id);
      var when = u.od + (u.do ? " – " + u.do : "");
      var eventState = U.stav(u, today);
      return '<tr data-udalost="' + text(u.id) + '">' +
        "<td><strong>" + text(jazykem(u.nazev)) + "</strong>" +
        '<span class="napoveda">' + text(u.id) + "</span></td>" +
        "<td>" + text(when) + '<span class="napoveda">' +
        text(P.t(stav.texty, "kalendar.typ." + u.typ, language)) + " · " + text(p("stavAkce." + eventState)) +
        (u.aktualita === true ? " · " + text(p("aktualita")) : "") + "</span></td>" +
        '<td class="akce-radku">' +
        '<button type="button" data-uprav-udalost>' + text(p("upravit")) + "</button> " +
        '<button type="button" data-smaz-udalost>' + text(p("smazat")) + "</button>" +
        "</td></tr>";
    }).join("");
  }

  if (formUdalost) {
    formUdalost.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formUdalost.elements;
      var nameCs = f.nazev.value.trim();
      var id = f.id.value.trim() || D.slug(nameCs);
      var old = upravuje.udalost ? U.podleId(stav.udalosti, upravuje.udalost) : null;
      var placeCs = f.misto.value.trim();
      var u = {
        id: id,
        typ: f.typ.value,
        album: f.album.value,
        nazev: dvojjazycne(nameCs, f.nazevEn.value.trim()),
        od: f.od.value,
        do: f.do.value,
        cas: f.cas.value,
        // The place is entered in Czech; the English one stays until somebody rewrites it.
        misto: { cs: placeCs, en: (old && en(old.misto)) || placeCs },
        popis: dvojjazycne(f.popis.value.trim(), f.popisEn.value.trim()),
        aktualita: f.aktualita.checked,
      };
      if (old && old.obrazek) u.obrazek = old.obrazek;
      var result = A.ulozUdalost(stav, u);
      if (result.chyby.length) {
        showErrors(formUdalost, result.chyby);
        return;
      }
      stav = result.stav;
      uloz();
      vyplnUdalost(null);
      redraw();
    });
    v("[data-zrus-udalost]").addEventListener("click", function () { vyplnUdalost(null); });
    v("[data-seznam-udalosti]").addEventListener("click", function (e) {
      var line = e.target.closest("[data-udalost]");
      if (!line) return;
      var id = line.getAttribute("data-udalost");
      if (e.target.closest("[data-uprav-udalost]")) {
        vyplnUdalost(U.podleId(stav.udalosti, id));
        formUdalost.scrollIntoView({ block: "start" });
      } else if (e.target.closest("[data-smaz-udalost]")) {
        potvrzeniSmazani(line, function () {
          stav = A.smazUdalost(stav, id);
          if (upravuje.udalost === id) vyplnUdalost(null);
          uloz();
          redraw();
        });
      }
    });
  }

  /* ---------- the courses ---------- */

  var formCourse = v("[data-form-kurz]");

  function findCourse(id) {
    for (var i = 0; i < stav.kurzy.length; i += 1) {
      if (stav.kurzy[i].id === id) return stav.kurzy[i];
    }
    return null;
  }

  function fillCourse(k) {
    var f = formCourse.elements;
    f.nazev.value = cs(k && k.nazev);
    f.nazevEn.value = en(k && k.nazev);
    f.kapacita.value = k && k.kapacita ? k.kapacita : "";
    f.cena.value = k && typeof k.cena === "number" ? k.cena : "";
    f.popis.value = cs(k && k.popis);
    f.id.value = (k && k.id) || "";
    upravuje.kurz = k ? k.id : null;
    v("[data-rezim-kurz]").textContent = k
      ? p("upravujete") + ": " + jazykem(k.nazev)
      : p("novyKurz");
    v("[data-zrus-kurz]").hidden = !k;
    clearErrors(formCourse);
  }

  function courseList() {
    var destination = v("[data-seznam-kurzy]");
    if (!destination) return;
    if (!stav.kurzy.length) {
      destination.innerHTML = '<tr><td colspan="3">' + text(p("prazdno")) + "</td></tr>";
      return;
    }
    destination.innerHTML = stav.kurzy.map(function (k) {
      return '<tr data-kurz="' + text(k.id) + '">' +
        "<td><strong>" + text(jazykem(k.nazev)) + "</strong>" +
        '<span class="napoveda">' + text(k.id) + "</span></td>" +
        "<td>" + text(k.kapacita) + '<span class="napoveda">' + text(k.cena) + "</span></td>" +
        '<td class="akce-radku">' +
        '<button type="button" data-uprav-kurz>' + text(p("upravit")) + "</button> " +
        '<button type="button" data-smaz-kurz>' + text(p("smazat")) + "</button>" +
        "</td></tr>";
    }).join("");
  }

  if (formCourse) {
    formCourse.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formCourse.elements;
      var nameCs = f.nazev.value.trim();
      var old = upravuje.kurz ? findCourse(upravuje.kurz) : null;
      var course = {
        id: f.id.value.trim() || D.slug(nameCs),
        nazev: dvojjazycne(nameCs, f.nazevEn.value.trim()),
        popis: dvojjazycne(f.popis.value.trim(), old ? en(old.popis) : ""),
        kapacita: number(f.kapacita.value),
        cena: number(f.cena.value),
      };
      if (old) {
        if (old.delka) course.delka = old.delka;
        if (old.terminy) course.terminy = old.terminy;
      }
      var result = A.ulozKurz(stav, course);
      if (result.chyby.length) {
        showErrors(formCourse, result.chyby);
        return;
      }
      stav = result.stav;
      uloz();
      fillCourse(null);
      redraw();
    });
    v("[data-zrus-kurz]").addEventListener("click", function () { fillCourse(null); });
    v("[data-seznam-kurzy]").addEventListener("click", function (e) {
      var line = e.target.closest("[data-kurz]");
      if (!line) return;
      var id = line.getAttribute("data-kurz");
      if (e.target.closest("[data-uprav-kurz]")) {
        fillCourse(findCourse(id));
        formCourse.scrollIntoView({ block: "start" });
      } else if (e.target.closest("[data-smaz-kurz]")) {
        potvrzeniSmazani(line, function () {
          // Deleting a course has no step of its own in C-007; the list is a plain array.
          stav = { ...stav, kurzy: stav.kurzy.filter(function (k) { return k.id !== id; }) };
          if (upravuje.kurz === id) fillCourse(null);
          uloz();
          redraw();
        });
      }
    });
  }

  /* ---------- the site's texts ---------- */

  function visibleTexts() {
    /* The demo's notices ("this is only a demonstration") will not be on the
       live site, so the text editor does not offer them. */
    var out = {};
    Object.keys(stav.texty).forEach(function (klic) {
      if (klic.indexOf("ukazka.") === 0 || klic.indexOf("_") === 0) return;
      out[klic] = stav.texty[klic];
    });
    return out;
  }

  function textSection() {
    var destination = v("[data-sekce-textu]");
    if (!destination) return;
    var visible = visibleTexts();
    var names = SECTION_NAMES[language] || SECTION_NAMES.cs;
    destination.innerHTML = TS.sekce(visible).map(function (s) {
      return '<button type="button" role="tab" data-sekce="' + text(s.id) + '"' +
        (s.id === selectedSection ? ' aria-selected="true"' : ' aria-selected="false"') +
        (s.klice.length ? "" : " disabled") + ">" +
        text(names[s.id] || s.id) + " <span>" + s.klice.length + "</span></button>";
    }).join("");
  }

  var sectionButtons = v("[data-sekce-textu]");
  if (sectionButtons) {
    // The listener is here, not in `sekceTextu()`: that one is called on every
    // redraw and would keep adding it again.
    sectionButtons.addEventListener("click", function (e) {
      var tl = e.target.closest("[data-sekce]");
      if (!tl) return;
      selectedSection = tl.getAttribute("data-sekce");
      var search = v("[data-hledat]");
      if (search) search.value = "";
      textSection();
      textList();
    });
  }

  function keysBySelection() {
    var visible = visibleTexts();
    var search = v("[data-hledat]");
    var query = search ? search.value.trim() : "";
    if (query) return TS.hledej(visible, query);
    var nalezena = TS.sekce(visible).filter(function (s) { return s.id === selectedSection; });
    return nalezena.length ? nalezena[0].klice : [];
  }

  function textList() {
    var destination = v("[data-seznam-texty]");
    if (!destination) return;
    var klice = keysBySelection();
    var missing = TS.chybejici(visibleTexts());
    var zmenene = TS.rozdil(originalTexts, stav.texty);
    v("[data-texty-prazdno]").hidden = klice.length > 0;
    destination.innerHTML = klice.map(function (klic) {
      var value = stav.texty[klic] || {};
      var tags = "";
      if (missing.indexOf(klic) >= 0) tags += '<span class="znacka chybi">' + text(p("chybi")) + "</span>";
      if (zmenene.indexOf(klic) >= 0) tags += '<span class="znacka zmeneno">' + text(p("zmeneno")) + "</span>";
      return '<div class="text-radek" data-klic="' + text(klic) + '">' +
        '<p class="klic"><code>' + text(klic) + "</code>" + tags + "</p>" +
        '<div class="dvojice-rovnou">' +
        '<label><span>' + text(p("cesky")) + "</span><textarea data-jazyk=\"cs\" rows=\"2\">" + text(value.cs || "") + "</textarea></label>" +
        '<label><span>' + text(p("anglicky")) + "</span><textarea data-jazyk=\"en\" rows=\"2\">" + text(value.en || "") + "</textarea></label>" +
        "</div></div>";
    }).join("");
  }

  var textListBody = v("[data-seznam-texty]");
  if (textListBody) {
    textListBody.addEventListener("change", function (e) {
      var field = e.target.closest("textarea[data-jazyk]");
      if (!field) return;
      var line = field.closest("[data-klic]");
      stav = A.ulozText(stav, line.getAttribute("data-klic"), field.getAttribute("data-jazyk"), field.value);
      uloz();
      textList();
    });
    var search = v("[data-hledat]");
    if (search) {
      search.addEventListener("input", function () { textList(); });
    }
  }

  /* ---------- the contacts ---------- */

  var KEY_CONTACTS = "kz-kontakty";
  var formContacts = v("[data-form-kontakty]");
  if (formContacts) {
    /* The contacts are not part of the state from C-007 (`zKodu` throws foreign
       keys away), so they have a row of their own in the storage. */
    var ulozene = null;
    try {
      var surove = window.localStorage.getItem(KEY_CONTACTS);
      ulozene = surove ? JSON.parse(surove) : null;
    } catch (e) { ulozene = null; }
    var web = ulozene || site.web || {};
    var atelier = web["ateliér"] || {};
    formContacts.elements.email.value = web.email || "";
    formContacts.elements.telefon.value = web.telefon || "";
    formContacts.elements.instagram.value = web.instagram || "";
    formContacts.elements.facebook.value = web.facebook || "";
    formContacts.elements.atelierNazev.value = jazykem(atelier.nazev) || "";
    formContacts.elements.atelierAdresa.value = atelier.adresa || "";
    formContacts.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formContacts.elements;
      var updated = JSON.parse(JSON.stringify(web));
      updated.email = f.email.value.trim();
      updated.telefon = f.telefon.value.trim();
      updated.instagram = f.instagram.value.trim();
      updated.facebook = f.facebook.value.trim();
      updated["ateliér"] = updated["ateliér"] || {};
      updated["ateliér"].nazev = { cs: f.atelierNazev.value.trim(), en: f.atelierNazev.value.trim() };
      updated["ateliér"].adresa = f.atelierAdresa.value.trim();
      web = updated;
      try { window.localStorage.setItem(KEY_CONTACTS, JSON.stringify(updated)); } catch (e2) { /* a private window */ }
      done(formContacts);
    });
  }

  /* ---------- dohromady ---------- */

  function redraw() {
    prehled();
    workList();
    eventList();
    courseList();
    textSection();
    textList();
  }

  var reset = v("[data-reset-stav]");
  if (reset) {
    reset.addEventListener("click", function () {
      discard();
      try { window.localStorage.removeItem(KEY_CONTACTS); } catch (e2) { /* nothing */ }
      stav = A.zaloz(site, originalTexts);
      photos = {};
      if (formWork) fillWork(null);
      if (formUdalost) vyplnUdalost(null);
      if (formCourse) fillCourse(null);
      redraw();
    });
  }

  vratnice();
  sections();
  if (formWork) fillWork(null);
  if (formUdalost) vyplnUdalost(null);
  if (formCourse) fillCourse(null);
  redraw();
})();
