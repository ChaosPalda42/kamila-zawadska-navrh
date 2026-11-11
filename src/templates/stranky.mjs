/* The site's individual pages. Every function returns the content HTML; the
   wrapper (menu, news, footer) is added by `layout()`. */

import { layout, e, ukazka, korun, ostryWeb, obrazek } from "./layout.mjs";
import { t, pole, cesta, cestaDila } from "../lib/preklad.mjs";
import {
  galerie as vGalerii, eshop as vEshopu, filtr, podleSlugu, sousedi, pocty,
  cena, lzeKoupit, naMiru,
} from "../lib/dila.mjs";
import { mesic as mrizkaMesice, chystaSe, bylo, format } from "../lib/kalendar.mjs";
import { DUVODY, prazdny as prazdnyFormular } from "../lib/formular.mjs";
import { nazevMesice } from "./mesice.mjs";

const DAYS_CS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function workName(dilo, jazyk) { return pole(dilo.nazev, jazyk) || dilo.slug; }
function altWorks(dilo, jazyk) { return pole(dilo.alt, jazyk) || workName(dilo, jazyk); }

/** The state badge. A work for sale needs none -- that is the default state. */
function odznak(dilo, texty, jazyk) {
  if (dilo.stav === "v-prodeji") return "";
  return `<span class="odznak ${e(dilo.stav)}">${e(t(texty, "stav." + dilo.stav, jazyk))}</span>`;
}

/** One tile. `kam` is the link's target, `volby.sloupcu` is there for the picture's sizes. */
function dlazdice(dilo, o) {
  const { texty, jazyk, sloupcu = 3, prednost = false, kam } = o;
  const description = [dilo.rok, dilo.rozmer].filter(Boolean).join(" · ");
  const cenovka = lzeKoupit(dilo) ? `<span class="cena">${korun(cena(dilo), jazyk)}</span>` : "";
  const link = kam || cestaDila(dilo.slug, jazyk);
  return `<li class="dlazdice" data-slug="${e(dilo.slug)}"
data-technika="${e(dilo.technika || "")}" data-styl="${e(dilo.styl || "")}" data-album="${e(dilo.album || "")}">
<a href="${link}" data-otevri="${e(dilo.slug)}">
<span class="ram">${odznak(dilo, texty, jazyk)}${obrazek(dilo.obrazek, altWorks(dilo, jazyk), { sloupcu, prednost })}</span>
<span class="popis">
<span class="nazev">${e(workName(dilo, jazyk))}</span>
<span class="radek">${e(description)}${cenovka ? " · " : ""}${cenovka}</span>
</span>
</a>
</li>`;
}

/* What the browser needs to know about the works: prices and states, for the
   basket. It is taken from the rendered site, not from the copy in
   localStorage -- that one would lie once something is sold. `prober()` from
   C-002 then cleans the basket against this list. */
function dataProEshop(works, jazyk) {
  // The name goes out as a two-language object, not as a finished string:
  // `rekapitulace()` from C-005 picks the language itself and returns nothing
  // over a plain string, so the basket would be missing the works' names.
  const records = works.map((d) => ({
    slug: d.slug, nazev: d.nazev, rozmer: d.rozmer || "",
    cena: cena(d), stav: d.stav,
  }));
  return `<div data-eshop-dila hidden><script type="application/json">${JSON.stringify(records).replace(/</g, "\\u003c")}</script></div>`;
}

/* ---------- the home page ---------- */

/* As the client asked (transcript 05:25): her photograph, two or three works
   from the recent output, a way through to the gallery and to the biography.
   The news sits in the left column. */
export function uvod(o) {
  const { site, texty, jazyk } = o;
  const nejnovejsi = vGalerii(site.dila).filter((d) => d.obrazek).slice(0, 3);
  const naProdej = vEshopu(site.dila).slice(0, 3);
  // The client wants the opening to carry her photograph and two or three
  // current works (transcript 05:25-05:46). The photograph is on the right,
  // the text on the left -- and a stand-in holds the place until they arrive.
  const foto = (site.uvod && site.uvod.foto) || (site.bio && site.bio.portret) || "atelier";
  const telo = `
<section class="hero">
<div class="hero-text">
<h1>${e(t(texty, "uvod.claim", jazyk))}</h1>
<p>${e(t(texty, "bio.text", jazyk).split(". ").slice(0, 2).join(". "))}.</p>
<p><a class="tlacitko lehke" href="${cesta("bio", jazyk)}">${e(t(texty, "nav.bio", jazyk))}</a></p>
</div>
<figure class="hero-obraz">
<span class="ram">${obrazek(foto, t(texty, "uvod.foto-alt", jazyk), { sloupcu: 2, prednost: true })}</span>
</figure>
</section>
<section>
<h2 class="verzalky">${e(t(texty, "uvod.aktualni-tvorba", jazyk))}</h2>
<ul class="mrizka">${nejnovejsi.map((d, i) => dlazdice(d, { texty, jazyk, sloupcu: 3, prednost: i === 0 })).join("")}</ul>
<p><a href="${cesta("galerie", jazyk)}">${e(t(texty, "uvod.do-galerie", jazyk))} →</a></p>
</section>
${naProdej.length ? `<section>
<h2 class="verzalky">${e(t(texty, "uvod.do-eshopu", jazyk))}</h2>
<ul class="mrizka">${naProdej.map((d) => dlazdice(d, { texty, jazyk, sloupcu: 3, kam: cesta("eshop", jazyk) + "#" + d.slug })).join("")}</ul>
<p><a href="${cesta("eshop", jazyk)}">${e(t(texty, "nav.eshop", jazyk))} →</a></p>
</section>` : ""}
`;
  return layout({ ...o, aktivni: "domu", adresa: cesta("domu", jazyk), titul: "", popis: t(texty, "uvod.podtitul", jazyk), telo });
}

/* Czech has three forms: 1 `dilo`, 2-4 `dila`, 5 and up `del`. The
   translation module is under contract and knows no inflection, so the rule
   lives here -- and `src/ui/web.js`, which rewrites the count after
   filtering, carries the same one. */
export function tvaryPoctu(texty, jazyk) {
  return [
    t(texty, "galerie.pocet.1", jazyk),
    t(texty, "galerie.pocet.2", jazyk),
    t(texty, "galerie.pocet.5", jazyk),
  ];
}

export function pocetDel(howMany, texty, jazyk) {
  const forms = tvaryPoctu(texty, jazyk);
  if (howMany === 1) return forms[0];
  if (howMany >= 2 && howMany <= 4) return forms[1];
  return forms[2];
}

/* ---------- the gallery ---------- */

function filtrovaciRada(klic, titulek, seznam, pocetDle, texty, jazyk) {
  const items = seznam
    .filter((x) => pocetDle[x.id])
    .map((x) => `<button type="button" data-klic="${klic}" data-hodnota="${e(x.id)}" aria-pressed="false">${e(pole(x.nazev, jazyk))} <span class="pocet">${pocetDle[x.id]}</span></button>`);
  if (!items.length) return "";
  return `<div class="filtry-rada">
<span class="verzalky">${e(titulek)}</span>
<button type="button" data-klic="${klic}" data-hodnota="vse" aria-pressed="true">${e(t(texty, "galerie.filtr.vse", jazyk))}</button>
${items.join("")}
</div>`;
}

/* The full-screen viewer: the HTML holds an empty shell and `src/ui/web.js`
   fills it from the data beside the grid. If the script never arrives, the
   tiles lead to the work's own page -- clicking loses nothing. */
function viewer(texty, jazyk) {
  return `<div class="prohlizec" data-prohlizec hidden role="dialog" aria-modal="true" aria-label="${e(t(texty, "galerie.titul", jazyk))}">
<div class="hlava">
<p class="pozice" data-pozice></p>
<button type="button" data-zavri>${e(t(texty, "galerie.zavrit", jazyk))}</button>
</div>
<div class="telo" data-plocha></div>
<div class="pata">
<div class="popisek" data-popisek></div>
<div class="ovladani">
<button type="button" data-predchozi>← ${e(t(texty, "galerie.predchozi", jazyk))}</button>
<button type="button" data-dalsi>${e(t(texty, "galerie.dalsi-dilo", jazyk))} →</button>
</div>
</div>
</div>`;
}

/** Data for the viewer. `<` is escaped, so the text cannot end the <script>. */
function dataForViewer(works, texty, jazyk) {
  const records = works.map((d) => ({
    slug: d.slug,
    nazev: workName(d, jazyk),
    popis: pole(d.popis, jazyk),
    radek: [d.rok, d.rozmer, t(texty, "stav." + d.stav, jazyk)].filter(Boolean).join(" · "),
    obrazek: obrazek(d.obrazek, altWorks(d, jazyk), { sloupcu: 1 }),
    odkaz: lzeKoupit(d) ? { kam: cesta("eshop", jazyk) + "#" + d.slug, text: t(texty, "galerie.koupit", jazyk) }
      : naMiru(d) ? { kam: cesta("kontakt", jazyk) + "?duvod=na-miru&dilo=" + encodeURIComponent(d.slug), text: t(texty, "galerie.na-miru", jazyk) }
      : null,
  }));
  return `<script type="application/json" data-dila>${JSON.stringify(records).replace(/</g, "\\u003c")}</script>`;
}

export function galerieStranka(o) {
  const { site, texty, jazyk } = o;
  const works = vGalerii(site.dila);
  const telo = `
<section>
<h1>${e(t(texty, "galerie.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "galerie.popis", jazyk))}</p></div>
</section>
<section>
<div class="filtry" data-filtry>
${filtrovaciRada("technika", t(texty, "galerie.filtr.technika", jazyk), site.techniky, pocty(works, "technika"), texty, jazyk)}
${filtrovaciRada("styl", t(texty, "galerie.filtr.styl", jazyk), site.styly, pocty(works, "styl"), texty, jazyk)}
${filtrovaciRada("album", t(texty, "galerie.filtr.udalost", jazyk), site.albumy, pocty(works, "album"), texty, jazyk)}
<p class="vysledek" data-vysledek data-tvary="${e(JSON.stringify(tvaryPoctu(texty, jazyk)))}">${works.length} ${e(pocetDel(works.length, texty, jazyk))}</p>
</div>
<ul class="mrizka ctverec" data-mrizka>${works.map((d, i) => dlazdice(d, { texty, jazyk, sloupcu: 3, prednost: i < 3 })).join("")}</ul>
<p class="vysledek" data-nic hidden>${e(t(texty, "galerie.nic", jazyk))}</p>
</section>
${dataForViewer(works, texty, jazyk)}
${viewer(texty, jazyk)}
`;
  return layout({ ...o, aktivni: "galerie", adresa: cesta("galerie", jazyk), titul: t(texty, "galerie.titul", jazyk), popis: t(texty, "galerie.popis", jazyk), telo });
}

/* ---------- the work's detail ---------- */

export function diloStranka(o) {
  const { site, texty, jazyk, dilo } = o;
  const vGal = vGalerii(site.dila);
  const sous = sousedi(vGal, dilo.slug);
  const technique = (site.techniky.find((x) => x.id === dilo.technika) || {}).nazev;
  const style = (site.styly.find((x) => x.id === dilo.styl) || {}).nazev;
  const album = site.albumy.find((x) => x.id === dilo.album);
  const lines = [
    [t(texty, "galerie.filtr.technika", jazyk), technique ? pole(technique, jazyk) : ""],
    [t(texty, "galerie.filtr.styl", jazyk), style ? pole(style, jazyk) : ""],
    [t(texty, "galerie.filtr.udalost", jazyk), album ? `${pole(album.nazev, jazyk)}, ${album.rok}` : ""],
    ["", dilo.rozmer],
    [t(texty, "stav." + dilo.stav, jazyk), lzeKoupit(dilo) ? korun(cena(dilo), jazyk) : ""],
  ].filter(([, value]) => value);

  const event = lzeKoupit(dilo)
    ? `<p><a class="tlacitko" href="${cesta("eshop", jazyk)}#${e(dilo.slug)}">${e(t(texty, "galerie.koupit", jazyk))}</a></p>`
    : naMiru(dilo)
      ? `<p><a class="tlacitko lehke" href="${cesta("kontakt", jazyk)}?duvod=na-miru&amp;dilo=${encodeURIComponent(dilo.slug)}">${e(t(texty, "galerie.na-miru", jazyk))}</a></p>`
      : "";

  const telo = `
<article class="dilo">
<div class="platno">${obrazek(dilo.obrazek, altWorks(dilo, jazyk), { sloupcu: 1, prednost: true, pomer: 1 })}</div>
<div>
<h1>${e(workName(dilo, jazyk))}</h1>
<p>${e(pole(dilo.popis, jazyk))}</p>
<dl>${lines.map(([k, v]) => `${k ? `<dt>${e(k)}</dt>` : ""}<dd>${e(v)}</dd>`).join("")}</dl>
${event}
</div>
</article>
<nav class="sousedi">
${sous.predchozi ? `<a href="${cestaDila(sous.predchozi.slug, jazyk)}">← ${e(workName(sous.predchozi, jazyk))}</a>` : "<span></span>"}
<a href="${cesta("galerie", jazyk)}">${e(t(texty, "galerie.titul", jazyk))}</a>
${sous.dalsi ? `<a href="${cestaDila(sous.dalsi.slug, jazyk)}">${e(workName(sous.dalsi, jazyk))} →</a>` : "<span></span>"}
</nav>
`;
  return layout({ ...o, aktivni: "galerie", adresa: cestaDila(dilo.slug, jazyk), titul: workName(dilo, jazyk), popis: pole(dilo.popis, jazyk), telo });
}

/* ---------- e-shop ---------- */

/* A reserved work stays visible in the shop but cannot be bought -- hence a
   disabled button and a notice of its own, not a row that vanished. */
function eshopDlazdice(dilo, texty, jazyk) {
  const koupit = lzeKoupit(dilo);
  const button = koupit
    ? `<button class="tlacitko" type="button" data-doKosiku="${e(dilo.slug)}"
data-pridat="${e(t(texty, "eshop.do-kosiku", jazyk))}" data-odebrat="${e(t(texty, "eshop.odebrat", jazyk))}">${e(t(texty, "eshop.do-kosiku", jazyk))}</button>`
    : `<button class="tlacitko" type="button" disabled>${e(t(texty, "eshop.nedostupne", jazyk))}</button>`;
  return `<li class="dlazdice" id="${e(dilo.slug)}" data-slug="${e(dilo.slug)}">
<a href="${cestaDila(dilo.slug, jazyk)}">
<span class="ram">${odznak(dilo, texty, jazyk)}${obrazek(dilo.obrazek, altWorks(dilo, jazyk), { sloupcu: 2 })}</span>
</a>
<div class="popis">
<a href="${cestaDila(dilo.slug, jazyk)}" class="nazev">${e(workName(dilo, jazyk))}</a>
<span class="radek">${e([dilo.rok, dilo.rozmer].filter(Boolean).join(" · "))} · <span class="cena">${korun(cena(dilo), jazyk)}</span></span>
<p>${e(pole(dilo.popis, jazyk))}</p>
${button}
</div>
</li>`;
}

export function eshopStranka(o) {
  const { site, texty, jazyk } = o;
  const works = vEshopu(site.dila);
  const telo = `
<section>
<h1>${e(t(texty, "eshop.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "eshop.popis", jazyk))}</p></div>
</section>
<section>
${works.length
    ? `<ul class="mrizka siroka">${works.map((d) => eshopDlazdice(d, texty, jazyk)).join("")}</ul>`
    : `<p>${e(t(texty, "eshop.prazdno", jazyk))}</p>`}
<p><a href="${cesta("kosik", jazyk)}">${e(t(texty, "nav.kosik", jazyk))} <span data-pocet-kosiku hidden></span> →</a></p>
</section>
${dataProEshop(works, jazyk)}
`;
  return layout({ ...o, aktivni: "eshop", adresa: cesta("eshop", jazyk), titul: t(texty, "eshop.titul", jazyk), popis: t(texty, "eshop.popis", jazyk), telo });
}

/* ---------- the basket ---------- */

/* The basket lives in the browser (localStorage), so the page is only a
   shell that `src/ui/web.js` fills. Without the script what shows is the
   notice about an empty basket and the way back to the shop. */
export function kosikStranka(o) {
  const { site, texty, jazyk } = o;
  const methods = site.doprava.map((d) => `<li><label>
<input type="radio" name="doprava" value="${e(d.id)}">
<span><span class="nazev">${e(pole(d.nazev, jazyk))}</span><br><span class="popis">${e(pole(d.popis, jazyk))}</span></span>
<span class="cena">${d.cena ? korun(d.cena, jazyk) : korun(0, jazyk)}</span>
</label></li>`).join("");
  const telo = `
<section>
<h1>${e(t(texty, "kosik.titul", jazyk))}</h1>
<div data-kosik hidden>
<table class="ucet kosik">
<thead><tr><th>${e(t(texty, "kosik.dila", jazyk))}</th><th></th><th></th></tr></thead>
<tbody data-radky></tbody>
<tfoot>
<tr><td>${e(t(texty, "kosik.doprava", jazyk))}</td><td data-doprava-cena></td><td></td></tr>
<tr><td>${e(t(texty, "kosik.celkem", jazyk))}</td><td data-celkem></td><td></td></tr>
</tfoot>
</table>
<ul class="doprava">${methods}</ul>
<script type="application/json" data-doprava>${JSON.stringify(site.doprava.map((d) => ({
    id: d.id, nazev: pole(d.nazev, jazyk), cena: d.cena,
  }))).replace(/</g, "\\u003c")}</script>
<p><a class="tlacitko" href="${cesta("kosik", jazyk)}#objednavka" data-dokoncit>${e(t(texty, "kosik.dokoncit", jazyk))}</a></p>
</div>
<p data-prazdny>${e(t(texty, "kosik.prazdny", jazyk))}</p>
<p><a href="${cesta("eshop", jazyk)}">← ${e(t(texty, "kosik.zpet", jazyk))}</a></p>
<p class="ukazka" data-zmena hidden></p>
</section>
${dataProEshop(vEshopu(site.dila), jazyk)}
<section id="objednavka" data-objednavka hidden>
<h2>${e(t(texty, "objednavka.titul", jazyk))}</h2>
${ukazka(texty, "ukazka.formular", jazyk)}
<form class="formular" data-form-objednavka novalidate>
${["jmeno", "email", "telefon"].map((k) => formFields(k, t(texty, "objednavka." + k, jazyk))).join("")}
<div data-adresa>
${formFieldsStreet(texty, jazyk)}
</div>
${formFieldsMessage(t(texty, "objednavka.zprava", jazyk))}
<p><button class="tlacitko" type="submit">${e(t(texty, "objednavka.odeslat", jazyk))}</button></p>
<p class="ukazka" data-hotovo hidden>${e(t(texty, "objednavka.hotovo", jazyk))}</p>
</form>
</section>
`;
  return layout({ ...o, aktivni: "eshop", adresa: cesta("kosik", jazyk), titul: t(texty, "kosik.titul", jazyk), popis: t(texty, "kosik.titul", jazyk), telo });
}

function formFieldsStreet(texty, jazyk) {
  return `${formFields("ulice", t(texty, "objednavka.ulice", jazyk))}
<div class="dvojice">
${formFields("mesto", t(texty, "objednavka.mesto", jazyk))}
${formFields("psc", t(texty, "objednavka.psc", jazyk))}
</div>`;
}
function formFieldsMessage(titulek) {
  return `<div class="pole" data-pole="zprava"><label for="pole-zprava">${e(titulek)}</label>
<textarea id="pole-zprava" name="zprava"></textarea><span class="chyba" data-chyba hidden></span></div>`;
}
function formFields(klic, titulek) {
  const type = klic === "email" ? "email" : klic === "telefon" ? "tel" : "text";
  return `<div class="pole" data-pole="${e(klic)}"><label for="pole-${e(klic)}">${e(titulek)}</label>
<input id="pole-${e(klic)}" name="${e(klic)}" type="${type}" autocomplete="${autoVyplnit(klic)}">
<span class="chyba" data-chyba hidden></span></div>`;
}
function autoVyplnit(klic) {
  return { jmeno: "name", email: "email", telefon: "tel", ulice: "street-address", mesto: "address-level2", psc: "postal-code" }[klic] || "off";
}
/* ---------- the calendar ---------- */

/* The month's grid. A day with no event is an empty cell, not a zero -- a
   calendar is read with the eyes and a zero would be noise in it. Days
   outside the month are cells without a frame. */
export function mrizkaHtml(year, mesicCislo, udalosti, dnes, jazyk, texty) {
  const m = mrizkaMesice(year, mesicCislo, udalosti);
  const days = jazyk === "en" ? DAYS_EN : DAYS_CS;
  const byId = new Map(udalosti.map((u) => [u.id, u]));
  const weeks = m.tydny.map((week) => `<tr>${week.map((day) => {
    if (!day) return '<td class="prazdny"></td>';
    const event = day.udalosti.map((id) => {
      const u = byId.get(id);
      if (!u) return "";
      // `data-akce`: a click opens the detail in place (`src/ui/akce.js`). Without
      // the script the link to the item in the list below the calendar remains.
      return `<a class="akce ${e(u.typ)}" href="#${e(u.id)}" data-akce="${e(u.id)}">${e(pole(u.nazev, jazyk))}</a>`;
    }).join("");
    const dnesni = day.datum === dnes ? ' class="dnesni"' : "";
    return `<td${dnesni}><span class="den">${day.den}</span>${event}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="kalendar">
<caption class="skryte">${e(nazevMesice(year, mesicCislo, jazyk))}</caption>
<thead><tr>${days.map((d) => `<th scope="col">${e(d)}</th>`).join("")}</tr></thead>
<tbody>${weeks}</tbody>
</table>`;
}

function eventList(udalosti, jazyk, texty) {
  if (!udalosti.length) return `<p>${e(t(texty, "kalendar.bez-akci", jazyk))}</p>`;
  /* The whole card is clickable (`data-akce`) and the detail is picked up from
     it in place. The "detail" button stays hidden until `src/ui/akce.js`
     unlocks it: without the script the event's whole description is visible
     right here and the button would lead nowhere. */
  return `<ul class="akce-seznam">${udalosti.map((u) => `<li id="${e(u.id)}" data-akce="${e(u.id)}">
<span class="kdy">${e(format(u, jazyk))}${u.cas ? `, ${e(u.cas)}` : ""}<br>${e(t(texty, "kalendar.typ." + u.typ, jazyk))}</span>
<div>
<h3>${e(pole(u.nazev, jazyk))}</h3>
${u.misto ? `<p class="kde">${e(pole(u.misto, jazyk))}</p>` : ""}
<p>${e(pole(u.popis, jazyk))}</p>
<button type="button" class="vic" data-vic data-akce="${e(u.id)}" hidden>${e(t(texty, "kalendar.detail.vic", jazyk))} →</button>
</div>
</li>`).join("")}</ul>`;
}

export function kalendarStranka(o) {
  const { site, texty, jazyk, dnes } = o;
  const year = Number(dnes.slice(0, 4));
  const mesicCislo = Number(dnes.slice(5, 7));
  const telo = `
<section>
<h1>${e(t(texty, "kalendar.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "kalendar.popis", jazyk))}</p></div>
</section>
<section data-kalendar data-rok="${year}" data-mesic="${mesicCislo}" data-dnes="${e(dnes)}">
<div class="mesic">
<h2 data-nazev-mesice>${e(nazevMesice(year, mesicCislo, jazyk))}</h2>
<div>
<button type="button" data-mesic-zpet>← ${e(t(texty, "kalendar.predchozi-mesic", jazyk))}</button>
<button type="button" data-mesic-dnes>${e(t(texty, "kalendar.dnes", jazyk))}</button>
<button type="button" data-mesic-vpred>${e(t(texty, "kalendar.dalsi-mesic", jazyk))} →</button>
</div>
</div>
<div data-mrizka-mesice>${mrizkaHtml(year, mesicCislo, site.udalosti, dnes, jazyk, texty)}</div>
<script type="application/json" data-udalosti>${JSON.stringify(site.udalosti.map((u) => ({
    id: u.id, typ: u.typ, od: u.od, do: u.do || "", nazev: pole(u.nazev, jazyk),
  }))).replace(/</g, "\\u003c")}</script>
</section>
<section>
<h2 class="verzalky">${e(t(texty, "kalendar.pristi", jazyk))}</h2>
${eventList(chystaSe(site.udalosti, dnes), jazyk, texty)}
</section>
<section>
<h2 class="verzalky">${e(t(texty, "kalendar.minule", jazyk))}</h2>
${eventList(bylo(site.udalosti, dnes), jazyk, texty)}
</section>
`;
  return layout({ ...o, aktivni: "kalendar", adresa: cesta("kalendar", jazyk), titul: t(texty, "kalendar.titul", jazyk), popis: t(texty, "kalendar.popis", jazyk), telo });
}

/* ---------- the courses ---------- */

/* The offer and the booking logic are to be worked out later, the notes say,
   so what is here is a timetable and a non-binding enquiry, not a booking
   system. */
export function kurzyStranka(o) {
  const { site, texty, jazyk } = o;
  const courses = site.kurzy.map((k) => {
    const dates = (k.terminy || []).filter(Boolean);
    return `<article class="kurz" id="${e(k.id)}">
<h2>${e(pole(k.nazev, jazyk))}</h2>
<p class="radek">
<span>${e(t(texty, "kurzy.delka", jazyk))}: ${e(pole(k.delka, jazyk))}</span>
<span>${e(t(texty, "kurzy.kapacita", jazyk))}: ${e(String(k.kapacita))}</span>
<span>${e(t(texty, "kurzy.cena", jazyk))}: <span class="cena">${korun(k.cena, jazyk)}</span></span>
</p>
<p>${e(pole(k.popis, jazyk))}</p>
<p class="verzalky">${e(t(texty, "kurzy.terminy", jazyk))}</p>
${dates.length
      ? `<ul class="terminy">${dates.map((d) => `<li>${e(format({ od: d }, jazyk))}</li>`).join("")}</ul>`
      : `<p>${e(t(texty, "kurzy.terminy-chybi", jazyk))}</p>`}
<p class="prihlaska"><a class="tlacitko lehke" href="${cesta("kontakt", jazyk)}?duvod=kurz&amp;kurz=${encodeURIComponent(k.id)}">${e(t(texty, "kurzy.mam-zajem", jazyk))}</a></p>
</article>`;
  }).join("");
  const telo = `
<section>
<h1>${e(t(texty, "kurzy.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "kurzy.popis", jazyk))}</p></div>
</section>
<section>${courses}</section>
`;
  return layout({ ...o, aktivni: "kurzy", adresa: cesta("kurzy", jazyk), titul: t(texty, "kurzy.titul", jazyk), popis: t(texty, "kurzy.popis", jazyk), telo });
}

/* ---------- about me ---------- */

/* The exhibitions are not copied into the text: they are taken from the
   albums and from the calendar, so that two lists cannot come apart after a
   year. */
export function bioStranka(o) {
  const { site, texty, jazyk, dnes } = o;
  const portrait = site.dila.find((d) => d.slug === "portret-m") || site.dila[0];
  const exhibitions = [...site.albumy]
    .sort((a, b) => (b.rok || 0) - (a.rok || 0))
    .map((a) => `<li><strong>${a.rok}</strong> — ${e(pole(a.nazev, jazyk))}${a.misto ? `, ${e(pole(a.misto, jazyk))}` : ""}</li>`)
    .join("");
  const education = (site.bio && site.bio.vzdelani || [])
    .map((r) => `<li><strong>${e(String(r.rok || ""))}</strong> — ${e(pole(r.text, jazyk))}</li>`)
    .join("");
  const telo = `
<section class="bio">
<div class="portret">${obrazek((site.bio && site.bio.portret) || portrait.obrazek, t(texty, "bio.portret-alt", jazyk), { sloupcu: 1, prednost: true, pomer: 4 / 5 })}</div>
<div class="text">
<h1>${e(t(texty, "bio.titul", jazyk))}</h1>
<p>${e(t(texty, "bio.text", jazyk))}</p>
${education ? `<h2 class="verzalky">${e(t(texty, "bio.vzdelani", jazyk))}</h2><ul>${education}</ul>` : ""}
${exhibitions ? `<h2 class="verzalky">${e(t(texty, "bio.vystavy", jazyk))}</h2><ul>${exhibitions}</ul>` : ""}
<p><a href="${cesta("kontakt", jazyk)}">${e(t(texty, "nav.kontakt", jazyk))} →</a></p>
</div>
</section>
`;
  return layout({ ...o, aktivni: "bio", adresa: cesta("bio", jazyk), titul: t(texty, "bio.titul", jazyk), popis: t(texty, "bio.text", jazyk).slice(0, 160), telo });
}

/* ---------- contact ---------- */

/* The map is OpenStreetMap in an <iframe>: no key, no account, no
   third-party script keeping records of its own about a visitor. */
function map(site, texty, jazyk) {
  const a = site.web["ateliér"];
  const d = 0.004;
  const box = [a.lon - d, a.lat - d / 2, a.lon + d, a.lat + d / 2].map((x) => x.toFixed(4)).join("%2C");
  const address = `https://www.openstreetmap.org/export/embed.html?bbox=${box}&amp;layer=mapnik&amp;marker=${a.lat}%2C${a.lon}`;
  return `<iframe class="mapa" src="${address}" title="${e(t(texty, "kontakt.mapa", jazyk))}" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p><a href="https://www.openstreetmap.org/?mlat=${a.lat}&amp;mlon=${a.lon}#map=${a.zoom}/${a.lat}/${a.lon}" rel="noopener">${e(t(texty, "kontakt.mapa", jazyk))} →</a></p>`;
}

export function kontaktStranka(o) {
  const { site, texty, jazyk } = o;
  const duvody = DUVODY.map((d) => {
    const klic = { "dotaz": "kontakt.popis", "na-miru": "galerie.na-miru", "kurz": "kurzy.mam-zajem", "atelier": "kalendar.typ.atelier" }[d];
    const titulek = d === "dotaz" ? t(texty, "kontakt.titul", jazyk) : t(texty, klic, jazyk);
    return `<option value="${e(d)}">${e(titulek)}</option>`;
  }).join("");
  const telo = `
<section class="kontakt">
<div>
<h1>${e(t(texty, "kontakt.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "kontakt.popis", jazyk))}</p></div>
${ukazka(texty, "ukazka.formular", jazyk)}
<form class="formular" data-form-kontakt novalidate>
<div class="pole" data-pole="duvod">
<label for="pole-duvod">${e(t(texty, "kontakt.zprava", jazyk))}</label>
<select id="pole-duvod" name="duvod">${duvody}</select>
</div>
<input type="hidden" name="kDilu" value="">
${formFields("jmeno", t(texty, "kontakt.jmeno", jazyk))}
${formFields("email", t(texty, "kontakt.email", jazyk))}
${formFields("telefon", t(texty, "kontakt.telefon", jazyk))}
${formFieldsMessage(t(texty, "kontakt.zprava", jazyk))}
<p><button class="tlacitko" type="submit">${e(t(texty, "kontakt.odeslat", jazyk))}</button></p>
<p class="ukazka" data-hotovo hidden>${e(t(texty, "kontakt.hotovo", jazyk))}</p>
</form>
</div>
<div>
<h2 class="verzalky">${e(t(texty, "kontakt.atelier", jazyk))}</h2>
<p>${e(pole(site.web["ateliér"].nazev, jazyk))}<br>${e(site.web["ateliér"].adresa)}</p>
<p>${e(t(texty, "kontakt.navsteva", jazyk))}</p>
<p>
<span class="verzalky">${e(t(texty, "kontakt.email", jazyk))}</span><br>
<a href="mailto:${e(site.web.email)}">${e(site.web.email)}</a><br>
<span class="verzalky">${e(t(texty, "kontakt.telefon", jazyk))}</span><br>
<a href="tel:${e(site.web.telefon.replace(/\s/g, ""))}">${e(site.web.telefon)}</a>
</p>
<p class="site">
<a href="${e(site.web.instagram)}" rel="noopener">Instagram</a>
<a href="${e(site.web.facebook)}" rel="noopener">Facebook</a>
</p>
${map(site, texty, jazyk)}
</div>
</section>
`;
  return layout({ ...o, aktivni: "kontakt", adresa: cesta("kontakt", jazyk), titul: t(texty, "kontakt.titul", jazyk), popis: t(texty, "kontakt.popis", jazyk), telo });
}

/* ---------- 404 ---------- */

/* A 404 should be good for something: an empty frame on the wall that draws
   itself and then sways a little, and three links onwards. The drawing is
   inline SVG, so it needs no image and no script -- CSS does the animation,
   and under reduced motion the frame simply holds still. */
function frameOnWall(description) {
  return `<svg class="ram-na-zdi" viewBox="0 0 320 300" role="img" aria-label="${e(description)}">
<g class="hrebik"><circle cx="160" cy="26" r="3.2" /></g>
<g class="zaves"><path d="M160 29 L118 72 M160 29 L202 72" /></g>
<g class="obraz">
<rect class="ramecek" x="104" y="70" width="112" height="146" rx="1" />
<rect class="ram-platno" x="116" y="82" width="88" height="122" rx="1" />
<path class="tah" d="M126 176 C 142 150, 150 158, 162 134 C 172 114, 184 120, 194 100" />
</g>
<g class="podlaha"><path d="M40 258 H280" /></g>
</svg>`;
}

export function chyba404(o) {
  const { texty, jazyk } = o;
  const telo = `
<section class="ctyristactyrka">
${frameOnWall(t(texty, "404.obrazek-alt", jazyk))}
<div class="ctyristactyrka-text">
<p class="cislo verzalky">404</p>
<h1>${e(t(texty, "404.titul", jazyk))}</h1>
<p>${e(t(texty, "404.text", jazyk))}</p>
<p class="kam">
<a class="tlacitko lehke" href="${cesta("galerie", jazyk)}">${e(t(texty, "nav.galerie", jazyk))}</a>
<a href="${cesta("domu", jazyk)}">${e(t(texty, "nav.domu", jazyk))}</a>
<a href="${cesta("kontakt", jazyk)}">${e(t(texty, "nav.kontakt", jazyk))}</a>
</p>
</div>
</section>
`;
  return layout({ ...o, aktivni: "", adresa: cesta("domu", jazyk), titul: t(texty, "404.titul", jazyk), popis: "", telo });
}
