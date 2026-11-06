/* Jednotlivé stránky webu. Každá funkce vrací HTML obsahu; obal (menu,
   aktuality, patička) přidá layout(). */

import { layout, e, ukazka, korun, ostryWeb, obrazek } from "./layout.mjs";
import { t, pole, cesta, cestaDila } from "../lib/preklad.mjs";
import {
  galerie as vGalerii, eshop as vEshopu, filtr, podleSlugu, sousedi, pocty,
  cena, lzeKoupit, naMiru,
} from "../lib/dila.mjs";
import { mesic as mrizkaMesice, chystaSe, bylo, format } from "../lib/kalendar.mjs";
import { DUVODY, prazdny as prazdnyFormular } from "../lib/formular.mjs";
import { nazevMesice } from "./mesice.mjs";

const DNY_CS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const DNY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function nazevDila(dilo, jazyk) { return pole(dilo.nazev, jazyk) || dilo.slug; }
function altDila(dilo, jazyk) { return pole(dilo.alt, jazyk) || nazevDila(dilo, jazyk); }

/** Odznak stavu. Dílo k prodeji odznak nepotřebuje — to je výchozí stav. */
function odznak(dilo, texty, jazyk) {
  if (dilo.stav === "v-prodeji") return "";
  return `<span class="odznak ${e(dilo.stav)}">${e(t(texty, "stav." + dilo.stav, jazyk))}</span>`;
}

/** Jedna dlaždice. `kam` je cíl odkazu, `volby.sloupcu` kvůli sizes obrázku. */
function dlazdice(dilo, o) {
  const { texty, jazyk, sloupcu = 3, prednost = false, kam } = o;
  const popis = [dilo.rok, dilo.rozmer].filter(Boolean).join(" · ");
  const cenovka = lzeKoupit(dilo) ? `<span class="cena">${korun(cena(dilo), jazyk)}</span>` : "";
  const odkaz = kam || cestaDila(dilo.slug, jazyk);
  return `<li class="dlazdice" data-slug="${e(dilo.slug)}"
data-technika="${e(dilo.technika || "")}" data-styl="${e(dilo.styl || "")}" data-album="${e(dilo.album || "")}">
<a href="${odkaz}" data-otevri="${e(dilo.slug)}">
<span class="ram">${odznak(dilo, texty, jazyk)}${obrazek(dilo.obrazek, altDila(dilo, jazyk), { sloupcu, prednost })}</span>
<span class="popis">
<span class="nazev">${e(nazevDila(dilo, jazyk))}</span>
<span class="radek">${e(popis)}${cenovka ? " · " : ""}${cenovka}</span>
</span>
</a>
</li>`;
}

/* Co o dílech potřebuje prohlížeč: ceny a stavy pro košík. Bere se to
   z vykresleného webu, ne z kopie v localStorage — ta by po prodeji lhala.
   `prober()` z C-002 pak košík pročistí proti tomuhle seznamu. */
function dataProEshop(dila, jazyk) {
  // Název jde ven jako dvojjazyčný objekt, ne jako hotový řetězec:
  // rekapitulace() z C-005 si jazyk vybírá sama a nad obyčejným řetězcem
  // vrací prázdno, takže by v košíku chyběly názvy děl.
  const zaznamy = dila.map((d) => ({
    slug: d.slug, nazev: d.nazev, rozmer: d.rozmer || "",
    cena: cena(d), stav: d.stav,
  }));
  return `<div data-eshop-dila hidden><script type="application/json">${JSON.stringify(zaznamy).replace(/</g, "\\u003c")}</script></div>`;
}

/* ---------- domovská stránka ---------- */

/* Podle přání klientky (přepis 05:25): její fotka, dvě tři díla z poslední
   tvorby, proklik do galerie a do bia. Aktuality jsou v levém sloupci. */
export function uvod(o) {
  const { site, texty, jazyk } = o;
  const nejnovejsi = vGalerii(site.dila).filter((d) => d.obrazek).slice(0, 3);
  const naProdej = vEshopu(site.dila).slice(0, 3);
  // Úvod má podle klientky nést její fotku a dvě tři aktuální díla
  // (přepis 05:25–05:46). Fotka je vpravo, text vlevo — a než dojedou
  // fotografie, drží místo zástupný obrázek.
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

/* Čeština má tři tvary: 1 dílo, 2–4 díla, 5 a víc děl. Modul překladu je
   pod kontraktem a žádné skloňování neumí, tak je tady — a stejné pravidlo
   má i src/ui/web.js, který počet přepisuje po přefiltrování. */
export function tvaryPoctu(texty, jazyk) {
  return [
    t(texty, "galerie.pocet.1", jazyk),
    t(texty, "galerie.pocet.2", jazyk),
    t(texty, "galerie.pocet.5", jazyk),
  ];
}

export function pocetDel(kolik, texty, jazyk) {
  const tvary = tvaryPoctu(texty, jazyk);
  if (kolik === 1) return tvary[0];
  if (kolik >= 2 && kolik <= 4) return tvary[1];
  return tvary[2];
}

/* ---------- galerie ---------- */

function filtrovaciRada(klic, titulek, seznam, pocetDle, texty, jazyk) {
  const polozky = seznam
    .filter((x) => pocetDle[x.id])
    .map((x) => `<button type="button" data-klic="${klic}" data-hodnota="${e(x.id)}" aria-pressed="false">${e(pole(x.nazev, jazyk))} <span class="pocet">${pocetDle[x.id]}</span></button>`);
  if (!polozky.length) return "";
  return `<div class="filtry-rada">
<span class="verzalky">${e(titulek)}</span>
<button type="button" data-klic="${klic}" data-hodnota="vse" aria-pressed="true">${e(t(texty, "galerie.filtr.vse", jazyk))}</button>
${polozky.join("")}
</div>`;
}

/* Prohlížeč na celou obrazovku: v HTML je prázdná skořápka, obsah do ní
   doplní src/ui/web.js z dat vedle mřížky. Kdyby skript nedojel, dlaždice
   vedou na vlastní stránku díla — klikání o nic nepřijde. */
function prohlizec(texty, jazyk) {
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

/** Data pro prohlížeč. `<` se escapuje, aby text neukončil <script>. */
function dataProProhlizec(dila, texty, jazyk) {
  const zaznamy = dila.map((d) => ({
    slug: d.slug,
    nazev: nazevDila(d, jazyk),
    popis: pole(d.popis, jazyk),
    radek: [d.rok, d.rozmer, t(texty, "stav." + d.stav, jazyk)].filter(Boolean).join(" · "),
    obrazek: obrazek(d.obrazek, altDila(d, jazyk), { sloupcu: 1 }),
    odkaz: lzeKoupit(d) ? { kam: cesta("eshop", jazyk) + "#" + d.slug, text: t(texty, "galerie.koupit", jazyk) }
      : naMiru(d) ? { kam: cesta("kontakt", jazyk) + "?duvod=na-miru&dilo=" + encodeURIComponent(d.slug), text: t(texty, "galerie.na-miru", jazyk) }
      : null,
  }));
  return `<script type="application/json" data-dila>${JSON.stringify(zaznamy).replace(/</g, "\\u003c")}</script>`;
}

export function galerieStranka(o) {
  const { site, texty, jazyk } = o;
  const dila = vGalerii(site.dila);
  const telo = `
<section>
<h1>${e(t(texty, "galerie.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "galerie.popis", jazyk))}</p></div>
</section>
<section>
<div class="filtry" data-filtry>
${filtrovaciRada("technika", t(texty, "galerie.filtr.technika", jazyk), site.techniky, pocty(dila, "technika"), texty, jazyk)}
${filtrovaciRada("styl", t(texty, "galerie.filtr.styl", jazyk), site.styly, pocty(dila, "styl"), texty, jazyk)}
${filtrovaciRada("album", t(texty, "galerie.filtr.udalost", jazyk), site.albumy, pocty(dila, "album"), texty, jazyk)}
<p class="vysledek" data-vysledek data-tvary="${e(JSON.stringify(tvaryPoctu(texty, jazyk)))}">${dila.length} ${e(pocetDel(dila.length, texty, jazyk))}</p>
</div>
<ul class="mrizka ctverec" data-mrizka>${dila.map((d, i) => dlazdice(d, { texty, jazyk, sloupcu: 3, prednost: i < 3 })).join("")}</ul>
<p class="vysledek" data-nic hidden>${e(t(texty, "galerie.nic", jazyk))}</p>
</section>
${dataProProhlizec(dila, texty, jazyk)}
${prohlizec(texty, jazyk)}
`;
  return layout({ ...o, aktivni: "galerie", adresa: cesta("galerie", jazyk), titul: t(texty, "galerie.titul", jazyk), popis: t(texty, "galerie.popis", jazyk), telo });
}

/* ---------- detail díla ---------- */

export function diloStranka(o) {
  const { site, texty, jazyk, dilo } = o;
  const vGal = vGalerii(site.dila);
  const sous = sousedi(vGal, dilo.slug);
  const technika = (site.techniky.find((x) => x.id === dilo.technika) || {}).nazev;
  const styl = (site.styly.find((x) => x.id === dilo.styl) || {}).nazev;
  const album = site.albumy.find((x) => x.id === dilo.album);
  const radky = [
    [t(texty, "galerie.filtr.technika", jazyk), technika ? pole(technika, jazyk) : ""],
    [t(texty, "galerie.filtr.styl", jazyk), styl ? pole(styl, jazyk) : ""],
    [t(texty, "galerie.filtr.udalost", jazyk), album ? `${pole(album.nazev, jazyk)}, ${album.rok}` : ""],
    ["", dilo.rozmer],
    [t(texty, "stav." + dilo.stav, jazyk), lzeKoupit(dilo) ? korun(cena(dilo), jazyk) : ""],
  ].filter(([, hodnota]) => hodnota);

  const akce = lzeKoupit(dilo)
    ? `<p><a class="tlacitko" href="${cesta("eshop", jazyk)}#${e(dilo.slug)}">${e(t(texty, "galerie.koupit", jazyk))}</a></p>`
    : naMiru(dilo)
      ? `<p><a class="tlacitko lehke" href="${cesta("kontakt", jazyk)}?duvod=na-miru&amp;dilo=${encodeURIComponent(dilo.slug)}">${e(t(texty, "galerie.na-miru", jazyk))}</a></p>`
      : "";

  const telo = `
<article class="dilo">
<div class="platno">${obrazek(dilo.obrazek, altDila(dilo, jazyk), { sloupcu: 1, prednost: true, pomer: 1 })}</div>
<div>
<h1>${e(nazevDila(dilo, jazyk))}</h1>
<p>${e(pole(dilo.popis, jazyk))}</p>
<dl>${radky.map(([k, v]) => `${k ? `<dt>${e(k)}</dt>` : ""}<dd>${e(v)}</dd>`).join("")}</dl>
${akce}
</div>
</article>
<nav class="sousedi">
${sous.predchozi ? `<a href="${cestaDila(sous.predchozi.slug, jazyk)}">← ${e(nazevDila(sous.predchozi, jazyk))}</a>` : "<span></span>"}
<a href="${cesta("galerie", jazyk)}">${e(t(texty, "galerie.titul", jazyk))}</a>
${sous.dalsi ? `<a href="${cestaDila(sous.dalsi.slug, jazyk)}">${e(nazevDila(sous.dalsi, jazyk))} →</a>` : "<span></span>"}
</nav>
`;
  return layout({ ...o, aktivni: "galerie", adresa: cestaDila(dilo.slug, jazyk), titul: nazevDila(dilo, jazyk), popis: pole(dilo.popis, jazyk), telo });
}

/* ---------- e-shop ---------- */

/* Zamluvené dílo v e-shopu zůstane vidět, ale koupit se nedá — proto má
   tlačítko vypnuté a vlastní hlášku, ne zmizelý řádek. */
function eshopDlazdice(dilo, texty, jazyk) {
  const koupit = lzeKoupit(dilo);
  const tlacitko = koupit
    ? `<button class="tlacitko" type="button" data-doKosiku="${e(dilo.slug)}"
data-pridat="${e(t(texty, "eshop.do-kosiku", jazyk))}" data-odebrat="${e(t(texty, "eshop.odebrat", jazyk))}">${e(t(texty, "eshop.do-kosiku", jazyk))}</button>`
    : `<button class="tlacitko" type="button" disabled>${e(t(texty, "eshop.nedostupne", jazyk))}</button>`;
  return `<li class="dlazdice" id="${e(dilo.slug)}" data-slug="${e(dilo.slug)}">
<a href="${cestaDila(dilo.slug, jazyk)}">
<span class="ram">${odznak(dilo, texty, jazyk)}${obrazek(dilo.obrazek, altDila(dilo, jazyk), { sloupcu: 2 })}</span>
</a>
<div class="popis">
<a href="${cestaDila(dilo.slug, jazyk)}" class="nazev">${e(nazevDila(dilo, jazyk))}</a>
<span class="radek">${e([dilo.rok, dilo.rozmer].filter(Boolean).join(" · "))} · <span class="cena">${korun(cena(dilo), jazyk)}</span></span>
<p>${e(pole(dilo.popis, jazyk))}</p>
${tlacitko}
</div>
</li>`;
}

export function eshopStranka(o) {
  const { site, texty, jazyk } = o;
  const dila = vEshopu(site.dila);
  const telo = `
<section>
<h1>${e(t(texty, "eshop.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "eshop.popis", jazyk))}</p></div>
</section>
<section>
${dila.length
    ? `<ul class="mrizka siroka">${dila.map((d) => eshopDlazdice(d, texty, jazyk)).join("")}</ul>`
    : `<p>${e(t(texty, "eshop.prazdno", jazyk))}</p>`}
<p><a href="${cesta("kosik", jazyk)}">${e(t(texty, "nav.kosik", jazyk))} <span data-pocet-kosiku hidden></span> →</a></p>
</section>
${dataProEshop(dila, jazyk)}
`;
  return layout({ ...o, aktivni: "eshop", adresa: cesta("eshop", jazyk), titul: t(texty, "eshop.titul", jazyk), popis: t(texty, "eshop.popis", jazyk), telo });
}

/* ---------- košík ---------- */

/* Košík žije v prohlížeči (localStorage), takže je stránka jen skořápka,
   kterou naplní src/ui/web.js. Bez skriptu je vidět hláška o prázdném
   košíku a cesta zpět do e-shopu. */
export function kosikStranka(o) {
  const { site, texty, jazyk } = o;
  const zpusoby = site.doprava.map((d) => `<li><label>
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
<ul class="doprava">${zpusoby}</ul>
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
${["jmeno", "email", "telefon"].map((k) => polePformulare(k, t(texty, "objednavka." + k, jazyk))).join("")}
<div data-adresa>
${polePformulareUlice(texty, jazyk)}
</div>
${polePformulareZprava(t(texty, "objednavka.zprava", jazyk))}
<p><button class="tlacitko" type="submit">${e(t(texty, "objednavka.odeslat", jazyk))}</button></p>
<p class="ukazka" data-hotovo hidden>${e(t(texty, "objednavka.hotovo", jazyk))}</p>
</form>
</section>
`;
  return layout({ ...o, aktivni: "eshop", adresa: cesta("kosik", jazyk), titul: t(texty, "kosik.titul", jazyk), popis: t(texty, "kosik.titul", jazyk), telo });
}

function polePformulareUlice(texty, jazyk) {
  return `${polePformulare("ulice", t(texty, "objednavka.ulice", jazyk))}
<div class="dvojice">
${polePformulare("mesto", t(texty, "objednavka.mesto", jazyk))}
${polePformulare("psc", t(texty, "objednavka.psc", jazyk))}
</div>`;
}
function polePformulareZprava(titulek) {
  return `<div class="pole" data-pole="zprava"><label for="pole-zprava">${e(titulek)}</label>
<textarea id="pole-zprava" name="zprava"></textarea><span class="chyba" data-chyba hidden></span></div>`;
}
function polePformulare(klic, titulek) {
  const typ = klic === "email" ? "email" : klic === "telefon" ? "tel" : "text";
  return `<div class="pole" data-pole="${e(klic)}"><label for="pole-${e(klic)}">${e(titulek)}</label>
<input id="pole-${e(klic)}" name="${e(klic)}" type="${typ}" autocomplete="${autoVyplnit(klic)}">
<span class="chyba" data-chyba hidden></span></div>`;
}
function autoVyplnit(klic) {
  return { jmeno: "name", email: "email", telefon: "tel", ulice: "street-address", mesto: "address-level2", psc: "postal-code" }[klic] || "off";
}
/* ---------- kalendář ---------- */

/* Mřížka měsíce. Den bez akce je prázdná buňka, ne nula — kalendář se čte
   očima a nula by v něm dělala šum. Dny mimo měsíc jsou buňky bez rámu. */
export function mrizkaHtml(rok, mesicCislo, udalosti, dnes, jazyk, texty) {
  const m = mrizkaMesice(rok, mesicCislo, udalosti);
  const dny = jazyk === "en" ? DNY_EN : DNY_CS;
  const podleId = new Map(udalosti.map((u) => [u.id, u]));
  const tydny = m.tydny.map((tyden) => `<tr>${tyden.map((den) => {
    if (!den) return '<td class="prazdny"></td>';
    const akce = den.udalosti.map((id) => {
      const u = podleId.get(id);
      if (!u) return "";
      // data-akce: klik otevře detail na místě (src/ui/akce.js). Bez skriptu
      // zůstane odkaz na položku v seznamu pod kalendářem.
      return `<a class="akce ${e(u.typ)}" href="#${e(u.id)}" data-akce="${e(u.id)}">${e(pole(u.nazev, jazyk))}</a>`;
    }).join("");
    const dnesni = den.datum === dnes ? ' class="dnesni"' : "";
    return `<td${dnesni}><span class="den">${den.den}</span>${akce}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="kalendar">
<caption class="skryte">${e(nazevMesice(rok, mesicCislo, jazyk))}</caption>
<thead><tr>${dny.map((d) => `<th scope="col">${e(d)}</th>`).join("")}</tr></thead>
<tbody>${tydny}</tbody>
</table>`;
}

function akceSeznam(udalosti, jazyk, texty) {
  if (!udalosti.length) return `<p>${e(t(texty, "kalendar.bez-akci", jazyk))}</p>`;
  /* Celá karta je klikací (data-akce) a detail se z ní vyzvedne na místě.
     Tlačítko „detail" je schované, dokud ho src/ui/akce.js neodemkne: bez
     skriptu je totiž celý popis akce vidět rovnou tady a tlačítko by
     nikam nevedlo. */
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
  const rok = Number(dnes.slice(0, 4));
  const mesicCislo = Number(dnes.slice(5, 7));
  const telo = `
<section>
<h1>${e(t(texty, "kalendar.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "kalendar.popis", jazyk))}</p></div>
</section>
<section data-kalendar data-rok="${rok}" data-mesic="${mesicCislo}" data-dnes="${e(dnes)}">
<div class="mesic">
<h2 data-nazev-mesice>${e(nazevMesice(rok, mesicCislo, jazyk))}</h2>
<div>
<button type="button" data-mesic-zpet>← ${e(t(texty, "kalendar.predchozi-mesic", jazyk))}</button>
<button type="button" data-mesic-dnes>${e(t(texty, "kalendar.dnes", jazyk))}</button>
<button type="button" data-mesic-vpred>${e(t(texty, "kalendar.dalsi-mesic", jazyk))} →</button>
</div>
</div>
<div data-mrizka-mesice>${mrizkaHtml(rok, mesicCislo, site.udalosti, dnes, jazyk, texty)}</div>
<script type="application/json" data-udalosti>${JSON.stringify(site.udalosti.map((u) => ({
    id: u.id, typ: u.typ, od: u.od, do: u.do || "", nazev: pole(u.nazev, jazyk),
  }))).replace(/</g, "\\u003c")}</script>
</section>
<section>
<h2 class="verzalky">${e(t(texty, "kalendar.pristi", jazyk))}</h2>
${akceSeznam(chystaSe(site.udalosti, dnes), jazyk, texty)}
</section>
<section>
<h2 class="verzalky">${e(t(texty, "kalendar.minule", jazyk))}</h2>
${akceSeznam(bylo(site.udalosti, dnes), jazyk, texty)}
</section>
`;
  return layout({ ...o, aktivni: "kalendar", adresa: cesta("kalendar", jazyk), titul: t(texty, "kalendar.titul", jazyk), popis: t(texty, "kalendar.popis", jazyk), telo });
}

/* ---------- kurzy ---------- */

/* Nabídka a rezervační logika se podle zápisu dopracují později, takže tady
   je rozvrh a nezávazná poptávka, ne rezervační systém. */
export function kurzyStranka(o) {
  const { site, texty, jazyk } = o;
  const kurzy = site.kurzy.map((k) => {
    const terminy = (k.terminy || []).filter(Boolean);
    return `<article class="kurz" id="${e(k.id)}">
<h2>${e(pole(k.nazev, jazyk))}</h2>
<p class="radek">
<span>${e(t(texty, "kurzy.delka", jazyk))}: ${e(pole(k.delka, jazyk))}</span>
<span>${e(t(texty, "kurzy.kapacita", jazyk))}: ${e(String(k.kapacita))}</span>
<span>${e(t(texty, "kurzy.cena", jazyk))}: <span class="cena">${korun(k.cena, jazyk)}</span></span>
</p>
<p>${e(pole(k.popis, jazyk))}</p>
<p class="verzalky">${e(t(texty, "kurzy.terminy", jazyk))}</p>
${terminy.length
      ? `<ul class="terminy">${terminy.map((d) => `<li>${e(format({ od: d }, jazyk))}</li>`).join("")}</ul>`
      : `<p>${e(t(texty, "kurzy.terminy-chybi", jazyk))}</p>`}
<p class="prihlaska"><a class="tlacitko lehke" href="${cesta("kontakt", jazyk)}?duvod=kurz&amp;kurz=${encodeURIComponent(k.id)}">${e(t(texty, "kurzy.mam-zajem", jazyk))}</a></p>
</article>`;
  }).join("");
  const telo = `
<section>
<h1>${e(t(texty, "kurzy.titul", jazyk))}</h1>
<div class="uvodka"><p>${e(t(texty, "kurzy.popis", jazyk))}</p></div>
</section>
<section>${kurzy}</section>
`;
  return layout({ ...o, aktivni: "kurzy", adresa: cesta("kurzy", jazyk), titul: t(texty, "kurzy.titul", jazyk), popis: t(texty, "kurzy.popis", jazyk), telo });
}

/* ---------- o mně ---------- */

/* Výstavy se neopisují do textu: berou se z albumů a z kalendáře, aby
   nevznikly dva seznamy, které si po roce přestanou odpovídat. */
export function bioStranka(o) {
  const { site, texty, jazyk, dnes } = o;
  const portret = site.dila.find((d) => d.slug === "portret-m") || site.dila[0];
  const vystavy = [...site.albumy]
    .sort((a, b) => (b.rok || 0) - (a.rok || 0))
    .map((a) => `<li><strong>${a.rok}</strong> — ${e(pole(a.nazev, jazyk))}${a.misto ? `, ${e(pole(a.misto, jazyk))}` : ""}</li>`)
    .join("");
  const vzdelani = (site.bio && site.bio.vzdelani || [])
    .map((r) => `<li><strong>${e(String(r.rok || ""))}</strong> — ${e(pole(r.text, jazyk))}</li>`)
    .join("");
  const telo = `
<section class="bio">
<div class="portret">${obrazek((site.bio && site.bio.portret) || portret.obrazek, pole(site.web["ateliér"].nazev, jazyk) + " — " + site.web.jmeno, { sloupcu: 1, prednost: true, pomer: 4 / 5 })}</div>
<div class="text">
<h1>${e(t(texty, "bio.titul", jazyk))}</h1>
<p>${e(t(texty, "bio.text", jazyk))}</p>
${vzdelani ? `<h2 class="verzalky">${e(t(texty, "bio.vzdelani", jazyk))}</h2><ul>${vzdelani}</ul>` : ""}
${vystavy ? `<h2 class="verzalky">${e(t(texty, "bio.vystavy", jazyk))}</h2><ul>${vystavy}</ul>` : ""}
<p><a href="${cesta("kontakt", jazyk)}">${e(t(texty, "nav.kontakt", jazyk))} →</a></p>
</div>
</section>
`;
  return layout({ ...o, aktivni: "bio", adresa: cesta("bio", jazyk), titul: t(texty, "bio.titul", jazyk), popis: t(texty, "bio.text", jazyk).slice(0, 160), telo });
}

/* ---------- kontakt ---------- */

/* Mapa je OpenStreetMap v <iframe>: bez klíče, bez účtu, bez skriptu třetí
   strany, který by si vedl o návštěvníkovi vlastní záznamy. */
function mapa(site, texty, jazyk) {
  const a = site.web["ateliér"];
  const d = 0.004;
  const box = [a.lon - d, a.lat - d / 2, a.lon + d, a.lat + d / 2].map((x) => x.toFixed(4)).join("%2C");
  const adresa = `https://www.openstreetmap.org/export/embed.html?bbox=${box}&amp;layer=mapnik&amp;marker=${a.lat}%2C${a.lon}`;
  return `<iframe class="mapa" src="${adresa}" title="${e(t(texty, "kontakt.mapa", jazyk))}" loading="lazy" referrerpolicy="no-referrer"></iframe>
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
${polePformulare("jmeno", t(texty, "kontakt.jmeno", jazyk))}
${polePformulare("email", t(texty, "kontakt.email", jazyk))}
${polePformulare("telefon", t(texty, "kontakt.telefon", jazyk))}
${polePformulareZprava(t(texty, "kontakt.zprava", jazyk))}
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
${mapa(site, texty, jazyk)}
</div>
</section>
`;
  return layout({ ...o, aktivni: "kontakt", adresa: cesta("kontakt", jazyk), titul: t(texty, "kontakt.titul", jazyk), popis: t(texty, "kontakt.popis", jazyk), telo });
}

/* ---------- 404 ---------- */

/* Čtyřistačtyřka má být k něčemu dobrá: prázdný rám na zdi, který se
   sám nakreslí a pak se nepatrně houpe, a tři odkazy, kam dál. Kresba je
   inline SVG, takže nepotřebuje žádný obrázek ani skript — animaci dělá
   CSS a při omezeném pohybu se rám prostě nehýbe. */
function ramNaZdi(popis) {
  return `<svg class="ram-na-zdi" viewBox="0 0 320 300" role="img" aria-label="${e(popis)}">
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
${ramNaZdi(t(texty, "404.obrazek-alt", jazyk))}
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
