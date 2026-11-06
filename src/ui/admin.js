/* Administrace v prohlížeči.

   Rozhodování je v knihovnách (KZ.administrace, KZ.nahrani, KZ.udalost,
   KZ["texty-sekce"]) a prošlo akceptačními testy; tady je jen DOM: vyplnit
   formulář, přečíst ho, vykreslit seznam, uložit do localStorage.

   V ukázce stojí administrace za ukázkovou vrátnicí a všechno žije v
   prohlížeči jednoho člověka. Nahrané fotky se drží jen v paměti karty
   (objectURL) — data URL by úložiště prohlížeče rozfoukaly. Na ostrém webu
   jde obojí na server; v administraci je to napsané, ať klientka neví jen
   od nás.

   Nic se tu nerozbije do té míry, aby se nedalo pokračovat: každé uložení
   projde kontrolou z C-007 a chyby se vypisují k políčkům. */
(function () {
  "use strict";
  var doc = document;
  var koren = doc.querySelector("[data-admin]");
  if (!koren) return;

  var A = KZ.administrace;
  var N = KZ.nahrani;
  var U = KZ.udalost;
  var TS = KZ["texty-sekce"];
  var D = KZ.dila;
  var P = KZ.preklad;

  var KLIC = "kz-administrace";
  var jazyk = (doc.documentElement.lang || "cs").indexOf("en") === 0 ? "en" : "cs";

  function json(volba, zaloha) {
    var prvek = doc.querySelector(volba);
    if (!prvek) return zaloha;
    try { return JSON.parse(prvek.textContent); } catch (e) { return zaloha; }
  }
  var site = json("script[data-site]", { dila: [], udalosti: [], kurzy: [] });
  var puvodniTexty = json("script[data-texty]", {});
  var L = json("script[data-popisky]", {});

  /* Hlášky ke kontrolám z C-007 a C-013. Popisky dílny nepatří do
     data/texty.json — v editoru textů by jen překážely. */
  var CHYBY = {
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
  function ch(klic) { return (CHYBY[jazyk] || CHYBY.cs)[klic] || klic; }
  function p(klic) { return L[klic] || klic; }

  var SEKCE_NAZVY = {
    cs: { uvod: "Úvod", galerie: "Galerie", eshop: "E-shop", kalendar: "Kalendář", kurzy: "Kurzy", bio: "O mně", kontakt: "Kontakt", navigace: "Navigace", ostatni: "Ostatní" },
    en: { uvod: "Home", galerie: "Gallery", eshop: "Shop", kalendar: "Calendar", kurzy: "Courses", bio: "About", kontakt: "Contact", navigace: "Navigation", ostatni: "Other" },
  };

  var stav = nacti() || A.zaloz(site, puvodniTexty);
  /* Náhledy nahraných fotek. Klíč je slug díla, hodnota je galerie z
     C-013. Do localStorage nejde — objectURL po zavření karty nežije. */
  var fotky = {};
  var upravuje = { dilo: null, udalost: null, kurz: null };
  var vybranaSekce = "uvod";

  function nacti() {
    try {
      var text = window.localStorage.getItem(KLIC);
      return text ? A.zKodu(text) : null;
    } catch (e) { return null; }
  }
  function uloz() {
    try { window.localStorage.setItem(KLIC, A.naKod(stav)); } catch (e) { /* soukromé okno */ }
  }
  function zahod() {
    try { window.localStorage.removeItem(KLIC); } catch (e) { /* nic */ }
  }

  function v(volba, kde) { return (kde || koren).querySelector(volba); }
  function vse(volba, kde) {
    return Array.prototype.slice.call((kde || koren).querySelectorAll(volba));
  }
  function text(hodnota) {
    var prvek = doc.createElement("span");
    prvek.textContent = hodnota == null ? "" : String(hodnota);
    return prvek.innerHTML;
  }
  function jazykem(hodnota) { return P.pole(hodnota, jazyk); }
  function cs(hodnota) {
    if (hodnota == null) return "";
    return typeof hodnota === "string" ? hodnota : (hodnota.cs || "");
  }
  function en(hodnota) {
    if (hodnota == null || typeof hodnota === "string") return "";
    return hodnota.en || "";
  }
  function dvojjazycne(textCs, textEn) {
    var hodnota = { cs: textCs };
    if (textEn) hodnota.en = textEn;
    return hodnota;
  }
  function cislo(hodnota) {
    var n = parseInt(String(hodnota).replace(/\s/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------- vrátnice ---------- */

  function vratnice() {
    var clona = doc.querySelector("[data-vratnice]");
    var form = doc.querySelector("[data-vratnice-form]");
    if (!clona || !form) { koren.hidden = false; return; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clona.classList.add("pryc");
      koren.hidden = false;
      window.setTimeout(function () {
        if (clona.parentNode) clona.parentNode.removeChild(clona);
      }, 500);
      var prvni = v('[data-zalozka="dila"]');
      if (prvni) prvni.focus();
    });
  }

  /* ---------- oddíly ---------- */

  function oddily() {
    var tlacitka = vse("[data-zalozka]");
    tlacitka.forEach(function (tl) {
      tl.addEventListener("click", function () {
        var id = tl.getAttribute("data-zalozka");
        tlacitka.forEach(function (x) {
          x.setAttribute("aria-selected", x === tl ? "true" : "false");
        });
        vse("[data-panel]").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== id;
        });
      });
    });
  }

  /* Čeština má u počtů tři tvary: 1 obraz, 2–4 obrazy, 5 obrazů. „3 kurzů"
     je přesně to, čeho si člověk na cizí administraci všimne první. */
  function mnozstvi(kolik, tvary) {
    var tvar = kolik === 1 ? tvary[0] : (kolik >= 2 && kolik <= 4 ? tvary[1] : tvary[2]);
    return kolik + " " + tvar;
  }

  function prehled() {
    var prvek = v("[data-pocty]");
    if (!prvek) return;
    var po = A.pocty(stav);
    var radky = jazyk === "en"
      ? [mnozstvi(po.dila, ["work", "works", "works"]), po.vGalerii + " in the gallery",
         po.vEshopu + " for sale", mnozstvi(po.udalosti, ["event", "events", "events"]),
         mnozstvi(po.kurzy, ["course", "courses", "courses"])]
      : [mnozstvi(po.dila, ["obraz", "obrazy", "obrazů"]), po.vGalerii + " v galerii",
         po.vEshopu + " k prodeji", mnozstvi(po.udalosti, ["akce", "akce", "akcí"]),
         mnozstvi(po.kurzy, ["kurz", "kurzy", "kurzů"])];
    prvek.textContent = radky.join(" · ");
  }

  /* ---------- chyby u políček ---------- */

  function vycistiChyby(form) {
    vse("[data-chyba]", form).forEach(function (prvek) {
      prvek.hidden = true;
      prvek.textContent = "";
    });
    vse(".pole", form).forEach(function (prvek) { prvek.classList.remove("spatne"); });
  }
  function ukazChyby(form, klice, prekryv) {
    vycistiChyby(form);
    // Adresa se dopočítá z názvu, takže u prázdného formuláře by svítily dvě
    // chyby za jednu nevyplněnou věc. Stačí ta o názvu.
    if (klice.indexOf("nazev") >= 0) {
      klice = klice.filter(function (k) { return k !== "slug" && k !== "id"; });
    }
    klice.forEach(function (klic) {
      var kam = (prekryv && prekryv[klic]) || klic;
      var pole = v('[data-pole="' + kam + '"]', form);
      if (!pole) return;
      pole.classList.add("spatne");
      var hlaska = v("[data-chyba]", pole);
      if (hlaska) {
        hlaska.textContent = ch(klic);
        hlaska.hidden = false;
      }
      var detaily = pole.closest("details");
      if (detaily) detaily.open = true;
    });
    if (klice.length) {
      var prvni = v(".pole.spatne input, .pole.spatne select, .pole.spatne textarea", form);
      if (prvni) prvni.focus();
    }
  }
  function hotovo(form) {
    var znacka = v("[data-ulozeno]", form);
    if (!znacka) return;
    znacka.textContent = ch("ulozeno");
    znacka.hidden = false;
    window.setTimeout(function () { znacka.hidden = true; }, 2200);
  }

  /* ---------- obrazy ---------- */

  var formDilo = v("[data-form-dilo]");

  function galerieDila(dilo) {
    if (!dilo) return { hlavni: "", obrazky: [] };
    if (!fotky[dilo.slug]) fotky[dilo.slug] = N.zaloz(dilo);
    return fotky[dilo.slug];
  }

  function vykresliFotky() {
    var seznam = v("[data-seznam-fotek]", formDilo);
    if (!seznam) return;
    var galerie = aktualniGalerie();
    seznam.innerHTML = galerie.obrazky.map(function (o) {
      var jeHlavni = o.klic === galerie.hlavni;
      var nahled = o.data
        ? '<img src="' + text(o.data) + '" alt="">'
        : '<span class="bez-nahledu" aria-hidden="true"></span>';
      return '<li' + (jeHlavni ? ' class="hlavni"' : "") + ' data-fotka="' + text(o.klic) + '">' +
        '<span class="nahled">' + nahled + "</span>" +
        '<span class="o-fotce"><strong>' + text(o.nazev) + "</strong>" +
        (o.velikost ? '<span class="napoveda">' + text(N.lidskaVelikost(o.velikost)) + "</span>" : "") +
        (jeHlavni ? '<span class="odznak">' + text(p("hlavni")) + "</span>" : "") + "</span>" +
        '<span class="s-fotkou">' +
        (jeHlavni ? "" : '<button type="button" data-fotka-hlavni title="' + text(p("dejHlavni")) + '">' + text(p("dejHlavni")) + "</button>") +
        '<button type="button" data-fotka-nahoru title="' + text(p("nahoru")) + '" aria-label="' + text(p("nahoru")) + '">↑</button>' +
        '<button type="button" data-fotka-dolu title="' + text(p("dolu")) + '" aria-label="' + text(p("dolu")) + '">↓</button>' +
        '<button type="button" data-fotka-smaz title="' + text(p("smazat")) + '" aria-label="' + text(p("smazat")) + '">×</button>' +
        "</span></li>";
    }).join("");
  }

  function klicGalerie() { return upravuje.dilo || "#novy"; }
  function nastavGalerii(galerie) { fotky[klicGalerie()] = galerie; vykresliFotky(); }
  function aktualniGalerie() {
    var klic = klicGalerie();
    if (!fotky[klic]) fotky[klic] = { hlavni: "", obrazky: [] };
    return fotky[klic];
  }

  function pridejSoubory(seznam) {
    var chyby = [];
    Array.prototype.slice.call(seznam).forEach(function (soubor) {
      var popis = {
        klic: soubor.name + ":" + soubor.size,
        nazev: soubor.name,
        typ: soubor.type,
        velikost: soubor.size,
        data: "",
      };
      var spatne = N.zkontroluj(popis);
      if (spatne.length) {
        spatne.forEach(function (k) {
          var hlaska = ch(k === "typ" ? "typSouboru" : k);
          if (chyby.indexOf(hlaska) === -1) chyby.push(hlaska);
        });
        return;
      }
      popis.data = window.URL ? window.URL.createObjectURL(soubor) : "";
      var vysledek = N.pridej(aktualniGalerie(), popis);
      fotky[klicGalerie()] = vysledek.galerie;
    });
    vykresliFotky();
    var hlaska = v("[data-chyba-fotky]", formDilo);
    if (hlaska) {
      hlaska.textContent = chyby.join(" ");
      hlaska.hidden = chyby.length === 0;
    }
  }

  function fotkyObsluha() {
    var vstup = v("[data-vstup-fotky]", formDilo);
    var pustit = v("[data-pustit]", formDilo);
    var seznam = v("[data-seznam-fotek]", formDilo);
    if (vstup) {
      vstup.addEventListener("change", function () {
        pridejSoubory(vstup.files);
        vstup.value = "";
      });
    }
    if (pustit) {
      ["dragenter", "dragover"].forEach(function (jmeno) {
        pustit.addEventListener(jmeno, function (e) {
          e.preventDefault();
          pustit.classList.add("nad");
        });
      });
      ["dragleave", "drop"].forEach(function (jmeno) {
        pustit.addEventListener(jmeno, function () { pustit.classList.remove("nad"); });
      });
      pustit.addEventListener("drop", function (e) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files) pridejSoubory(e.dataTransfer.files);
      });
    }
    if (seznam) {
      seznam.addEventListener("click", function (e) {
        var tl = e.target.closest("button");
        if (!tl) return;
        var li = tl.closest("[data-fotka]");
        if (!li) return;
        var klic = li.getAttribute("data-fotka");
        var g = aktualniGalerie();
        if (tl.hasAttribute("data-fotka-hlavni")) nastavGalerii(N.nastavHlavni(g, klic));
        else if (tl.hasAttribute("data-fotka-nahoru")) nastavGalerii(N.posun(g, klic, -1));
        else if (tl.hasAttribute("data-fotka-dolu")) nastavGalerii(N.posun(g, klic, 1));
        else if (tl.hasAttribute("data-fotka-smaz")) nastavGalerii(N.odeber(g, klic));
      });
    }
  }

  function hledejDilo(slug) {
    for (var i = 0; i < stav.dila.length; i += 1) {
      if (stav.dila[i].slug === slug) return stav.dila[i];
    }
    return null;
  }

  function vyplnDilo(dilo) {
    var f = formDilo.elements;
    f.nazev.value = cs(dilo && dilo.nazev);
    f.nazevEn.value = en(dilo && dilo.nazev);
    f.rok.value = dilo && dilo.rok ? dilo.rok : "";
    f.rozmer.value = (dilo && dilo.rozmer) || "";
    f.cena.value = dilo && typeof dilo.cena === "number" ? dilo.cena : "";
    f.stav.value = (dilo && dilo.stav) || "v-prodeji";
    f.technika.value = (dilo && dilo.technika) || "";
    f.styl.value = (dilo && dilo.styl) || "";
    f.album.value = (dilo && dilo.album) || "";
    f.popis.value = cs(dilo && dilo.popis);
    f.popisEn.value = en(dilo && dilo.popis);
    f.vGalerii.checked = dilo ? dilo.vGalerii === true : true;
    f.vEshopu.checked = dilo ? dilo.vEshopu === true : false;
    f.slug.value = (dilo && dilo.slug) || "";
    upravuje.dilo = dilo ? dilo.slug : null;
    if (dilo) galerieDila(dilo); else fotky["#novy"] = { hlavni: "", obrazky: [] };
    v("[data-rezim-dilo]").textContent = dilo
      ? p("upravujete") + ": " + jazykem(dilo.nazev)
      : p("novy");
    v("[data-zrus-dilo]").hidden = !dilo;
    vycistiChyby(formDilo);
    vykresliFotky();
  }

  function seznamDel() {
    var kam = v("[data-seznam-dila]");
    if (!kam) return;
    if (!stav.dila.length) {
      kam.innerHTML = '<tr><td colspan="3">' + text(p("prazdno")) + "</td></tr>";
      return;
    }
    kam.innerHTML = stav.dila.map(function (d) {
      var kde = [];
      if (d.vGalerii === true) kde.push(p("vGalerii"));
      if (d.vEshopu === true) kde.push(p("vEshopu"));
      var pocetFotek = fotky[d.slug] ? fotky[d.slug].obrazky.length : (d.obrazek ? 1 : 0);
      return '<tr data-dilo="' + text(d.slug) + '">' +
        "<td><strong>" + text(jazykem(d.nazev)) + "</strong>" +
        '<span class="napoveda">' + text(d.slug) + "</span></td>" +
        "<td>" + text(P.t(stav.texty, "stav." + d.stav, jazyk)) + '<span class="napoveda">' +
        text(kde.join(" · ")) + " · " + pocetFotek + "×</span></td>" +
        '<td class="akce-radku">' +
        '<button type="button" data-uprav-dilo>' + text(p("upravit")) + "</button> " +
        '<button type="button" data-smaz-dilo>' + text(p("smazat")) + "</button>" +
        "</td></tr>";
    }).join("");
  }

  function potvrzeniSmazani(radek, akce) {
    var cil = v(".akce-radku", radek);
    if (!cil) return;
    cil.innerHTML = '<span class="potvrzeni">' + text(p("opravduSmazat")) +
      ' <button type="button" data-ano>' + text(p("ano")) + "</button> " +
      '<button type="button" data-ne>' + text(p("ne")) + "</button></span>";
    v("[data-ano]", cil).focus();
    v("[data-ano]", cil).addEventListener("click", akce);
    v("[data-ne]", cil).addEventListener("click", function () { prekresli(); });
  }

  if (formDilo) {
    formDilo.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formDilo.elements;
      var nazevCs = f.nazev.value.trim();
      var slug = f.slug.value.trim() || D.slug(nazevCs);
      var galerie = aktualniGalerie();
      var dilo = {
        slug: slug,
        nazev: dvojjazycne(nazevCs, f.nazevEn.value.trim()),
        technika: f.technika.value,
        styl: f.styl.value,
        album: f.album.value,
        rok: cislo(f.rok.value),
        rozmer: f.rozmer.value.trim(),
        cena: cislo(f.cena.value),
        stav: f.stav.value,
        vGalerii: f.vGalerii.checked,
        vEshopu: f.vEshopu.checked,
        popis: dvojjazycne(f.popis.value.trim(), f.popisEn.value.trim()),
      };
      var stary = upravuje.dilo ? hledejDilo(upravuje.dilo) : null;
      dilo.obrazek = galerie.hlavni || (stary ? stary.obrazek : "") || "";
      dilo.fotky = galerie.obrazky.map(function (o) { return o.nazev; });
      if (stary && stary.alt) dilo.alt = stary.alt;
      if (dilo.cena === null) delete dilo.cena;
      if (dilo.rok === null) delete dilo.rok;
      var vysledek = A.ulozDilo(stav, dilo);
      if (vysledek.chyby.length) {
        ukazChyby(formDilo, vysledek.chyby, { nikde: "kde" });
        return;
      }
      // Fotky se vedou pod slugem; po přejmenování je přesuneme k novému.
      if (upravuje.dilo && upravuje.dilo !== slug) {
        fotky[slug] = galerie;
        delete fotky[upravuje.dilo];
      } else if (!upravuje.dilo) {
        fotky[slug] = galerie;
        delete fotky["#novy"];
      }
      stav = vysledek.stav;
      uloz();
      vyplnDilo(null);
      prekresli();
    });
    v("[data-zrus-dilo]").addEventListener("click", function () { vyplnDilo(null); });
    var seznamDilTelo = v("[data-seznam-dila]");
    seznamDilTelo.addEventListener("click", function (e) {
      var radek = e.target.closest("[data-dilo]");
      if (!radek) return;
      var slug = radek.getAttribute("data-dilo");
      if (e.target.closest("[data-uprav-dilo]")) {
        vyplnDilo(hledejDilo(slug));
        formDilo.scrollIntoView({ block: "start" });
      } else if (e.target.closest("[data-smaz-dilo]")) {
        potvrzeniSmazani(radek, function () {
          stav = A.smazDilo(stav, slug);
          if (upravuje.dilo === slug) vyplnDilo(null);
          uloz();
          prekresli();
        });
      }
    });
    fotkyObsluha();
  }

  /* ---------- akce v kalendáři ---------- */

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
    vycistiChyby(formUdalost);
  }

  function seznamUdalosti() {
    var kam = v("[data-seznam-udalosti]");
    if (!kam) return;
    var dnes = new Date().toISOString().slice(0, 10);
    var serazene = U.poradi(stav.udalosti, dnes);
    if (!serazene.length) {
      kam.innerHTML = '<tr><td colspan="3">' + text(p("prazdno")) + "</td></tr>";
      return;
    }
    kam.innerHTML = serazene.map(function (id) {
      var u = U.podleId(stav.udalosti, id);
      var kdy = u.od + (u.do ? " – " + u.do : "");
      var stavAkce = U.stav(u, dnes);
      return '<tr data-udalost="' + text(u.id) + '">' +
        "<td><strong>" + text(jazykem(u.nazev)) + "</strong>" +
        '<span class="napoveda">' + text(u.id) + "</span></td>" +
        "<td>" + text(kdy) + '<span class="napoveda">' +
        text(P.t(stav.texty, "kalendar.typ." + u.typ, jazyk)) + " · " + text(p("stavAkce." + stavAkce)) +
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
      var nazevCs = f.nazev.value.trim();
      var id = f.id.value.trim() || D.slug(nazevCs);
      var stary = upravuje.udalost ? U.podleId(stav.udalosti, upravuje.udalost) : null;
      var mistoCs = f.misto.value.trim();
      var u = {
        id: id,
        typ: f.typ.value,
        album: f.album.value,
        nazev: dvojjazycne(nazevCs, f.nazevEn.value.trim()),
        od: f.od.value,
        do: f.do.value,
        cas: f.cas.value,
        // Místo se zadává česky; anglické zůstane, dokud ho někdo nepřepíše.
        misto: { cs: mistoCs, en: (stary && en(stary.misto)) || mistoCs },
        popis: dvojjazycne(f.popis.value.trim(), f.popisEn.value.trim()),
        aktualita: f.aktualita.checked,
      };
      if (stary && stary.obrazek) u.obrazek = stary.obrazek;
      var vysledek = A.ulozUdalost(stav, u);
      if (vysledek.chyby.length) {
        ukazChyby(formUdalost, vysledek.chyby);
        return;
      }
      stav = vysledek.stav;
      uloz();
      vyplnUdalost(null);
      prekresli();
    });
    v("[data-zrus-udalost]").addEventListener("click", function () { vyplnUdalost(null); });
    v("[data-seznam-udalosti]").addEventListener("click", function (e) {
      var radek = e.target.closest("[data-udalost]");
      if (!radek) return;
      var id = radek.getAttribute("data-udalost");
      if (e.target.closest("[data-uprav-udalost]")) {
        vyplnUdalost(U.podleId(stav.udalosti, id));
        formUdalost.scrollIntoView({ block: "start" });
      } else if (e.target.closest("[data-smaz-udalost]")) {
        potvrzeniSmazani(radek, function () {
          stav = A.smazUdalost(stav, id);
          if (upravuje.udalost === id) vyplnUdalost(null);
          uloz();
          prekresli();
        });
      }
    });
  }

  /* ---------- kurzy ---------- */

  var formKurz = v("[data-form-kurz]");

  function hledejKurz(id) {
    for (var i = 0; i < stav.kurzy.length; i += 1) {
      if (stav.kurzy[i].id === id) return stav.kurzy[i];
    }
    return null;
  }

  function vyplnKurz(k) {
    var f = formKurz.elements;
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
    vycistiChyby(formKurz);
  }

  function seznamKurzu() {
    var kam = v("[data-seznam-kurzy]");
    if (!kam) return;
    if (!stav.kurzy.length) {
      kam.innerHTML = '<tr><td colspan="3">' + text(p("prazdno")) + "</td></tr>";
      return;
    }
    kam.innerHTML = stav.kurzy.map(function (k) {
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

  if (formKurz) {
    formKurz.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formKurz.elements;
      var nazevCs = f.nazev.value.trim();
      var stary = upravuje.kurz ? hledejKurz(upravuje.kurz) : null;
      var kurz = {
        id: f.id.value.trim() || D.slug(nazevCs),
        nazev: dvojjazycne(nazevCs, f.nazevEn.value.trim()),
        popis: dvojjazycne(f.popis.value.trim(), stary ? en(stary.popis) : ""),
        kapacita: cislo(f.kapacita.value),
        cena: cislo(f.cena.value),
      };
      if (stary) {
        if (stary.delka) kurz.delka = stary.delka;
        if (stary.terminy) kurz.terminy = stary.terminy;
      }
      var vysledek = A.ulozKurz(stav, kurz);
      if (vysledek.chyby.length) {
        ukazChyby(formKurz, vysledek.chyby);
        return;
      }
      stav = vysledek.stav;
      uloz();
      vyplnKurz(null);
      prekresli();
    });
    v("[data-zrus-kurz]").addEventListener("click", function () { vyplnKurz(null); });
    v("[data-seznam-kurzy]").addEventListener("click", function (e) {
      var radek = e.target.closest("[data-kurz]");
      if (!radek) return;
      var id = radek.getAttribute("data-kurz");
      if (e.target.closest("[data-uprav-kurz]")) {
        vyplnKurz(hledejKurz(id));
        formKurz.scrollIntoView({ block: "start" });
      } else if (e.target.closest("[data-smaz-kurz]")) {
        potvrzeniSmazani(radek, function () {
          // Mazání kurzu nemá v C-007 vlastní přechod; seznam je prosté pole.
          stav = { ...stav, kurzy: stav.kurzy.filter(function (k) { return k.id !== id; }) };
          if (upravuje.kurz === id) vyplnKurz(null);
          uloz();
          prekresli();
        });
      }
    });
  }

  /* ---------- texty webu ---------- */

  function viditelneTexty() {
    /* Hlášky ukázky ("tohle je jen ukázka") na ostrém webu nebudou, tak se
       v editoru textů nenabízejí. */
    var out = {};
    Object.keys(stav.texty).forEach(function (klic) {
      if (klic.indexOf("ukazka.") === 0 || klic.indexOf("_") === 0) return;
      out[klic] = stav.texty[klic];
    });
    return out;
  }

  function sekceTextu() {
    var kam = v("[data-sekce-textu]");
    if (!kam) return;
    var viditelne = viditelneTexty();
    var nazvy = SEKCE_NAZVY[jazyk] || SEKCE_NAZVY.cs;
    kam.innerHTML = TS.sekce(viditelne).map(function (s) {
      return '<button type="button" role="tab" data-sekce="' + text(s.id) + '"' +
        (s.id === vybranaSekce ? ' aria-selected="true"' : ' aria-selected="false"') +
        (s.klice.length ? "" : " disabled") + ">" +
        text(nazvy[s.id] || s.id) + " <span>" + s.klice.length + "</span></button>";
    }).join("");
  }

  var sekceTlacitka = v("[data-sekce-textu]");
  if (sekceTlacitka) {
    // Posluchač je tady, ne v sekceTextu(): ta se volá při každém překreslení
    // a přidávala by ho znovu.
    sekceTlacitka.addEventListener("click", function (e) {
      var tl = e.target.closest("[data-sekce]");
      if (!tl) return;
      vybranaSekce = tl.getAttribute("data-sekce");
      var hledat = v("[data-hledat]");
      if (hledat) hledat.value = "";
      sekceTextu();
      seznamTextu();
    });
  }

  function klicePodleVyberu() {
    var viditelne = viditelneTexty();
    var hledat = v("[data-hledat]");
    var dotaz = hledat ? hledat.value.trim() : "";
    if (dotaz) return TS.hledej(viditelne, dotaz);
    var nalezena = TS.sekce(viditelne).filter(function (s) { return s.id === vybranaSekce; });
    return nalezena.length ? nalezena[0].klice : [];
  }

  function seznamTextu() {
    var kam = v("[data-seznam-texty]");
    if (!kam) return;
    var klice = klicePodleVyberu();
    var chybi = TS.chybejici(viditelneTexty());
    var zmenene = TS.rozdil(puvodniTexty, stav.texty);
    v("[data-texty-prazdno]").hidden = klice.length > 0;
    kam.innerHTML = klice.map(function (klic) {
      var hodnota = stav.texty[klic] || {};
      var znacky = "";
      if (chybi.indexOf(klic) >= 0) znacky += '<span class="znacka chybi">' + text(p("chybi")) + "</span>";
      if (zmenene.indexOf(klic) >= 0) znacky += '<span class="znacka zmeneno">' + text(p("zmeneno")) + "</span>";
      return '<div class="text-radek" data-klic="' + text(klic) + '">' +
        '<p class="klic"><code>' + text(klic) + "</code>" + znacky + "</p>" +
        '<div class="dvojice-rovnou">' +
        '<label><span>' + text(p("cesky")) + "</span><textarea data-jazyk=\"cs\" rows=\"2\">" + text(hodnota.cs || "") + "</textarea></label>" +
        '<label><span>' + text(p("anglicky")) + "</span><textarea data-jazyk=\"en\" rows=\"2\">" + text(hodnota.en || "") + "</textarea></label>" +
        "</div></div>";
    }).join("");
  }

  var seznamTextuTelo = v("[data-seznam-texty]");
  if (seznamTextuTelo) {
    seznamTextuTelo.addEventListener("change", function (e) {
      var pole = e.target.closest("textarea[data-jazyk]");
      if (!pole) return;
      var radek = pole.closest("[data-klic]");
      stav = A.ulozText(stav, radek.getAttribute("data-klic"), pole.getAttribute("data-jazyk"), pole.value);
      uloz();
      seznamTextu();
    });
    var hledat = v("[data-hledat]");
    if (hledat) {
      hledat.addEventListener("input", function () { seznamTextu(); });
    }
  }

  /* ---------- kontakty ---------- */

  var KLIC_KONTAKTY = "kz-kontakty";
  var formKontakty = v("[data-form-kontakty]");
  if (formKontakty) {
    /* Kontakty nejsou součástí stavu z C-007 (zKodu cizí klíče zahodí), tak
       mají vlastní řádek v úložišti. */
    var ulozene = null;
    try {
      var surove = window.localStorage.getItem(KLIC_KONTAKTY);
      ulozene = surove ? JSON.parse(surove) : null;
    } catch (e) { ulozene = null; }
    var web = ulozene || site.web || {};
    var atelier = web["ateliér"] || {};
    formKontakty.elements.email.value = web.email || "";
    formKontakty.elements.telefon.value = web.telefon || "";
    formKontakty.elements.instagram.value = web.instagram || "";
    formKontakty.elements.facebook.value = web.facebook || "";
    formKontakty.elements.atelierNazev.value = jazykem(atelier.nazev) || "";
    formKontakty.elements.atelierAdresa.value = atelier.adresa || "";
    formKontakty.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = formKontakty.elements;
      var novy = JSON.parse(JSON.stringify(web));
      novy.email = f.email.value.trim();
      novy.telefon = f.telefon.value.trim();
      novy.instagram = f.instagram.value.trim();
      novy.facebook = f.facebook.value.trim();
      novy["ateliér"] = novy["ateliér"] || {};
      novy["ateliér"].nazev = { cs: f.atelierNazev.value.trim(), en: f.atelierNazev.value.trim() };
      novy["ateliér"].adresa = f.atelierAdresa.value.trim();
      web = novy;
      try { window.localStorage.setItem(KLIC_KONTAKTY, JSON.stringify(novy)); } catch (e2) { /* soukromé okno */ }
      hotovo(formKontakty);
    });
  }

  /* ---------- dohromady ---------- */

  function prekresli() {
    prehled();
    seznamDel();
    seznamUdalosti();
    seznamKurzu();
    sekceTextu();
    seznamTextu();
  }

  var reset = v("[data-reset-stav]");
  if (reset) {
    reset.addEventListener("click", function () {
      zahod();
      try { window.localStorage.removeItem(KLIC_KONTAKTY); } catch (e2) { /* nic */ }
      stav = A.zaloz(site, puvodniTexty);
      fotky = {};
      if (formDilo) vyplnDilo(null);
      if (formUdalost) vyplnUdalost(null);
      if (formKurz) vyplnKurz(null);
      prekresli();
    });
  }

  vratnice();
  oddily();
  if (formDilo) vyplnDilo(null);
  if (formUdalost) vyplnUdalost(null);
  if (formKurz) vyplnKurz(null);
  prekresli();
})();
