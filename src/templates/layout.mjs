/* The page wrapper: document head, left menu, news bar, footer.

   The menu is on the left because the client asked for it at the meeting
   (transcript 05:36). On a phone it folds under a button -- a 15 rem column
   would eat half the screen there. */

import { t, pole, cesta, cestaDila, prepni, JAZYKY } from "../lib/preklad.mjs";
import { format, aktuality as vyberAktuality } from "../lib/kalendar.mjs";
import { stav as stavAkce, dnuDo, dilaAkce, poradi } from "../lib/udalost.mjs";
import { obrazek } from "./obrazky.mjs";
import { mesicJmeno } from "./mesice.mjs";

/* The build fingerprint in the addresses of the styles and scripts: after a
   deploy nobody looks at an old version out of the browser cache. */
let otisk = "";
export function nastavOtisk(value) { otisk = value ? `?v=${value}` : ""; }

/* The live site against the clickable demo. In the demo the page admits that
   the data is made up and that nothing is sent anywhere; on the live site not
   a trace of those notices may be left. `tools/kontrola_webu.py` watches it --
   it renders the whole site in live mode and measures the VISIBLE text, not
   the templates. */
let ostry = false;
export function nastavOstry(value) { ostry = !!value; }
export function ostryWeb() { return ostry; }

/** Text into HTML. The only way a foreign string reaches the page. */
export function e(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A notice only the demo has. On the live site nothing of it is left. */
export function ukazka(texty, klic, jazyk, trida = "ukazka") {
  if (ostry) return "";
  return `<p class="${trida}">${e(t(texty, klic, jazyk))}</p>`;
}

/** A price in crowns. A hard space in the thousands, so the number does not break at the end of a line. */
export function korun(castka, jazyk = "cs") {
  const number = Math.round(Number(castka) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return jazyk === "en" ? `${number} CZK` : `${number} Kč`;
}

const MENU_ITEMS = ["galerie", "eshop", "kalendar", "kurzy", "bio", "kontakt"];

function menu(aktivni, jazyk, texty, counts) {
  const lines = MENU_ITEMS.map((klic) => {
    const adresa = cesta(klic, jazyk);
    const tu = klic === aktivni ? ' aria-current="page"' : "";
    const count = counts && counts[klic] ? ` <span class="pocet">${counts[klic]}</span>` : "";
    return `<li><a href="${adresa}"${tu}>${e(t(texty, "nav." + klic, jazyk))}${count}</a></li>`;
  });
  return `<ul class="menu">${lines.join("")}</ul>`;
}

/* The news bar. Without JavaScript all three stay visible one under the
   other -- `src/ui/web.js` does the rotating and only then hides the rest. If
   the script never arrives, a visitor still sees what is coming.

   The client wanted the bar louder and the controls bigger: every item
   carries the kind of event, the date and a sentence about how many days are
   left, and the switches are full pills with a date, not eight-pixel dots. A
   click opens the detail in place (`data-akce`, `src/ui/akce.js`) -- without the
   script the link leads to the calendar as before. */

/** "In 3 days", "Tomorrow", "Happening now". On an event the numbers are the first thing the eye catches. */
function whenInWords(u, dnes, jazyk, texty) {
  const where = stavAkce(u, dnes);
  if (where === "probiha") return t(texty, "kalendar.probiha", jazyk);
  if (where === "bylo") return t(texty, "kalendar.bylo", jazyk);
  const howMany = dnuDo(u, dnes);
  if (howMany === null || howMany < 0) return t(texty, "kalendar.chysta", jazyk);
  if (howMany === 0) return t(texty, "kalendar.dnes", jazyk);
  if (howMany === 1) return t(texty, "kalendar.zitra", jazyk);
  // Czech has three forms for days; 2-4 take `dny`, five and up `dni`.
  const klic = howMany <= 4 ? "kalendar.za-dny" : "kalendar.za-dni";
  return t(texty, klic, jazyk).replace("%s", String(howMany));
}

function aktuality(udalosti, dnes, jazyk, texty) {
  const selected = vyberAktuality(udalosti, dnes, 3);
  if (!selected.length) return "";
  const lines = selected.map((u, i) => {
    const [, mesicCislo, day] = String(u.od || "").split("-");
    return `<li data-aktualita="${i}">
<a href="${cesta("kalendar", jazyk)}#${e(u.id)}" data-akce="${e(u.id)}">
<span class="datum" aria-hidden="true"><span class="den">${e(String(Number(day) || ""))}</span><span class="mesic">${e(mesicJmeno(Number(mesicCislo), jazyk))}</span></span>
<span class="chip ${e(u.typ || "")}">${e(t(texty, "kalendar.typ." + u.typ, jazyk))}</span>
<span class="nazev">${e(pole(u.nazev, jazyk))}</span>
<span class="kdy">${e(format(u, jazyk))}</span>
<span class="za ${e(stavAkce(u, dnes))}">${e(whenInWords(u, dnes, jazyk, texty))}</span>
</a></li>`;
  });
  const prepinace = selected.map((u, i) =>
    `<button type="button" data-tecka="${i}" aria-current="${i === 0 ? "true" : "false"}">
<span aria-hidden="true">${e(format(u, jazyk).split(" ")[0])}</span>
<span class="skryte">${e(pole(u.nazev, jazyk))}</span></button>`);
  /* The desk calendar: rings, a leaf with the date and, under it, a hinted
     pile of further leaves. The leaves turn over by themselves every few
     seconds (`web.js`); the day numbers below them turn one by hand. */
  return `<nav class="aktuality" aria-label="${e(t(texty, "uvod.aktualne", jazyk))}" data-aktuality>
<p class="verzalky"><span class="tep" aria-hidden="true"></span>${e(t(texty, "uvod.aktualne", jazyk))}</p>
<div class="krouzky" aria-hidden="true"><span></span><span></span><span></span></div>
<ul class="listy">${lines.join("")}</ul>
<div class="tecky" role="group" aria-label="${e(t(texty, "uvod.aktualne", jazyk))}">${prepinace.join("")}</div>
</nav>`;
}

/* The event detail. The panel sits in the page wrapper, because an event can
   be clicked from anywhere -- the news bar stands in the menu on every page.
   What the panel prints is handed over by the template as JSON: pictures of
   works have srcsets that only the build knows, and the browser should not be
   inventing them. */
function eventDetail(site, texty, jazyk, dnes) {
  const event = poradi(site.udalosti, dnes).map((id) => {
    const u = site.udalosti.find((x) => x.id === id);
    // Works hang off an album, not off an event: one album (pragovka-2026) carries
    // the exhibition and the opening. C-012 compares `dilo.album` with the event id.
    return { u, dila: dilaAkce(site.dila, { ...u, id: u.album || u.id }).slice(0, 6) };
  });
  const udalosti = event.map(({ u }) => ({
    id: u.id,
    typ: u.typ,
    typNazev: t(texty, "kalendar.typ." + u.typ, jazyk),
    nazev: pole(u.nazev, jazyk),
    od: u.od,
    do: u.do || "",
    cas: u.cas || "",
    kdy: format(u, jazyk),
    misto: pole(u.misto, jazyk),
    popis: pole(u.popis, jazyk),
    kurz: u.kurz || "",
  }));
  /* The works go into a <template>, not into the JSON beside it. Paths to
     pictures and links are rewritten by a subfolder on GitHub Pages
     (`tools/predvolba.py`), and that rewrite sees attributes in the HTML --
     not strings inside JSON. In JSON the pictures would stay at `/obrazky/...`
     and never load. */
  const sablonyDil = event.filter(({ dila }) => dila.length).map(({ u, dila }) => {
    const items = dila.map((d) => `<li><a href="${cestaDila(d.slug, jazyk)}">${
      obrazek(d.obrazek, pole(d.alt, jazyk) || pole(d.nazev, jazyk), { sloupcu: 3 })
    }<span class="nazev">${e(pole(d.nazev, jazyk))}</span></a></li>`).join("");
    return `<template data-dila-akce="${e(u.id)}"><ul class="detail-dila">${items}</ul></template>`;
  }).join("");
  const captions = [
    `data-kde="${e(t(texty, "kalendar.detail.kde", jazyk))}"`,
    `data-dila="${e(t(texty, "kalendar.detail.dila", jazyk))}"`,
    `data-dnes="${e(t(texty, "kalendar.dnes", jazyk))}"`,
    `data-zitra="${e(t(texty, "kalendar.zitra", jazyk))}"`,
    `data-stav-probiha="${e(t(texty, "kalendar.probiha", jazyk))}"`,
    `data-stav-bylo="${e(t(texty, "kalendar.bylo", jazyk))}"`,
    `data-stav-chysta="${e(t(texty, "kalendar.chysta", jazyk))}"`,
    `data-za="${e(JSON.stringify([
      t(texty, "kalendar.za-den", jazyk),
      t(texty, "kalendar.za-dny", jazyk),
      t(texty, "kalendar.za-dni", jazyk),
    ]))}"`,
  ].join(" ");
  return `<div class="detail-akce" data-detail-akce ${captions} hidden>
<div class="detail-plachta" data-detail-plachta></div>
<div class="detail-panel" role="dialog" aria-modal="true" data-detail-panel>
<div class="detail-telo" data-detail-telo></div>
<!-- Odkaz na kurzy je hotový v HTML, ne skládaný ze JSON: jen tak mu
     předvolba pro GitHub Pages doplní podsložku. Kotvu na konkrétní kurz
     přidá akce.js. -->
<p class="detail-kurz"><a class="tlacitko" data-detail-kurzy href="${cesta("kurzy", jazyk)}" hidden>${e(t(texty, "kalendar.detail.kurz", jazyk))} →</a></p>
<div class="detail-ovladani">
<button type="button" class="tlacitko lehke" data-detail-predchozi>← ${e(t(texty, "kalendar.detail.predchozi", jazyk))}</button>
<button type="button" class="tlacitko lehke" data-detail-dalsi>${e(t(texty, "kalendar.detail.dalsi", jazyk))} →</button>
</div>
<button type="button" class="detail-zavri" data-detail-zavri aria-label="${e(t(texty, "kalendar.detail.zavrit", jazyk))}">×</button>
</div>
${sablonyDil}
<script type="application/json" data-udalosti-detail>${JSON.stringify(udalosti).replace(/</g, "\\u003c")}</script>
</div>`;
}

function footer(site, texty, jazyk, adresa) {
  const year = new Date().getUTCFullYear();
  const links = [
    `<span>© ${year} ${e(site.web.jmeno)}</span>`,
    `<a href="#nahoru">${e(t(texty, "patka.nahoru", jazyk))}</a>`,
  ];
  // The admin is part of the demo, not of the public site: live it sits behind
  // a sign-in, and it has no place in the footer.
  if (!ostry) links.push(`<a href="${cesta("administrace", jazyk)}">${e(t(texty, "patka.administrace", jazyk))}</a>`);
  return `<footer class="patka">${links.join("")}</footer>`;
}

/* The language switch: two shortcuts in the top right corner of the page.
   At the meeting the client said the switch at the bottom of the side column
   spoiled the look and that top right is where she would look for it, written
   as `cz, eng`. Two letters say nothing when read out loud, so the full name
   of the language is the accessible name. Both languages are listed, the
   current one marked -- a visitor who cannot tell which page they are on
   cannot tell what the single link would do either. */
const JAZYK_JMENO = { cs: "Čeština", en: "English" };
const JAZYK_ZKRATKA = { cs: "cz", en: "eng" };

function languages(adresa, jazyk, texty) {
  const items = JAZYKY.map((j) => {
    const tu = j === jazyk ? ' aria-current="true"' : "";
    return `<a href="${prepni(adresa, j)}" hreflang="${j}" lang="${j}" aria-label="${e(JAZYK_JMENO[j])}"${tu}>${e(JAZYK_ZKRATKA[j])}</a>`;
  });
  return `<nav class="jazyky" aria-label="${e(t(texty, "patka.jazyky", jazyk))}" data-jazyky>${items.join("")}</nav>`;
}

function hreflangy(adresa) {
  return JAZYKY.map((j) => `<link rel="alternate" hreflang="${j}" href="${prepni(adresa, j)}">`).join("\n");
}

/* The browser has to know the forms' error messages too -- contracts C-005
   and C-006 return keys, not finished text, precisely so the translations
   stay in one place in `data/texty.json`. */
const ERROR_KEYS = ["jmeno", "email", "telefon", "zprava", "doprava", "ulice", "mesto", "psc", "kosik"];
function errorsForViewer(texty, jazyk) {
  const dictionary = {};
  for (const klic of ERROR_KEYS) dictionary[klic] = t(texty, "formular.chyba." + klic, jazyk);
  return `<script type="application/json" data-chyby>${JSON.stringify(dictionary).replace(/</g, "\\u003c")}</script>`;
}

/* The Instagram and Facebook marks, drawn as lines so they take the colour of
   the text around them: no brand colours, nothing to download and they hold up
   at the size of a word. Both are built out of the same rounded square, so the
   pair sits quietly side by side. The name stays next to the mark -- a mark on
   its own is a guessing game for whoever does not know it. */
const MARKS = {
  instagram: `<svg class="znacka" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2"/><circle cx="12" cy="12" r="4"/><circle class="tecka" cx="17.1" cy="6.9" r="1.05"/></svg>`,
  facebook: `<svg class="znacka" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2"/><path d="M15.7 8.2h-1.3c-1.1 0-1.8.7-1.8 1.9v10.7"/><path d="M10.4 12.7h4.8"/></svg>`,
};

/** The links to the painter's two profiles, each with its mark. */
export function odkazySite(site) {
  return `<a href="${e(site.web.instagram)}" rel="noopener">${MARKS.instagram}Instagram</a>
<a href="${e(site.web.facebook)}" rel="noopener">${MARKS.facebook}Facebook</a>`;
}

/**
 * The whole page.
 * @param {object} o
 *  - `site`, `texty`, `jazyk`, `adresa` (this page's path), `aktivni` (the menu key)
 *  - `titul`, `popis` (the meta description), `telo` (the content HTML)
 *  - `dnes` (YYYY-MM-DD), `pocty` (numbers for the menu items), `skript` (true/false)
 */
export function layout(o) {
  const { site, texty, jazyk, adresa, aktivni, titul, popis, telo, dnes } = o;
  const siteName = site.web.jmeno;
  const pageTitle = titul ? `${titul} — ${siteName}` : siteName;
  const pas = ostry ? "" : `<p class="ukazka-pas">${e(t(texty, "ukazka.hlavicka", jazyk))}</p>`;
  return `<!doctype html>
<html lang="${jazyk}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(pageTitle)}</title>
<meta name="description" content="${e(popis || "")}">
<meta property="og:title" content="${e(pageTitle)}">
<meta property="og:description" content="${e(popis || "")}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&display=swap">
<link rel="icon" href="/ikona.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styl.css${otisk}">
${hreflangy(adresa)}
</head>
<body id="nahoru"${aktivni === "domu" ? " data-domu" : ""}>
<a class="preskoc" href="#obsah">${e(t(texty, "nav.domu", jazyk))} → ${e(titul || siteName)}</a>
${pas}
<div class="stranka">
${languages(adresa, jazyk, texty)}
<header class="bok bok-sbaleno" data-bok>
<a class="logo" href="${cesta("domu", jazyk)}">
<span>${e(siteName)}</span>
<span class="role">${e(t(texty, "uvod.podtitul", jazyk))}</span>
</a>
<button class="menu-prepinac" type="button" data-menu aria-expanded="false">${e(t(texty, "nav.menu", jazyk))}</button>
${menu(aktivni, jazyk, texty, o.pocty)}
<p class="kosik-odkaz" data-kosik-odkaz hidden><a href="${cesta("kosik", jazyk)}">${e(t(texty, "nav.kosik", jazyk))} <span class="kolecko" data-pocet-kosiku hidden></span></a></p>
<div class="bok-cast">
<p class="verzalky">${e(t(texty, "kontakt.atelier", jazyk))}</p>
<p>${e(pole(site.web["ateliér"].nazev, jazyk))}<br>${e(site.web["ateliér"].adresa)}</p>
<div class="site">
${odkazySite(site)}
</div>
</div>
${aktuality(site.udalosti, dnes, jazyk, texty)}
</header>
<main class="obsah" id="obsah">
${telo}
</main>
${footer(site, texty, jazyk, adresa)}
</div>
${eventDetail(site, texty, jazyk, dnes)}
${errorsForViewer(texty, jazyk)}
<script src="/web.js${otisk}" defer></script>
${o.admin ? `<script src="/admin.js${otisk}" defer></script>` : ""}
</body>
</html>
`;
}

export { obrazek };
