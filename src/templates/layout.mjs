/* Obal stránky: hlava dokumentu, levé menu, lišta aktualit, patička.

   Menu je vlevo, protože si to klientka na schůzce vyžádala (přepis 05:36).
   Na mobilu se sbalí pod tlačítko — sloupec 15 rem by na telefonu sežral
   polovinu obrazovky. */

import { t, pole, cesta, cestaDila, prepni, druhyJazyk, JAZYKY } from "../lib/preklad.mjs";
import { format, aktuality as vyberAktuality } from "../lib/kalendar.mjs";
import { stav as stavAkce, dnuDo, dilaAkce, poradi } from "../lib/udalost.mjs";
import { obrazek } from "./obrazky.mjs";
import { mesicJmeno } from "./mesice.mjs";

/* Otisk sestavení v adresách stylů a skriptů: po nasazení nikdo nekouká
   na starou verzi z mezipaměti prohlížeče. */
let otisk = "";
export function nastavOtisk(hodnota) { otisk = hodnota ? `?v=${hodnota}` : ""; }

/* Ostrý web vs. klikatelná ukázka. V ukázce stránka přiznává, že data jsou
   smyšlená a že se nic neodesílá; na ostrém webu nesmí být po těch hláškách
   ani stopa. Hlídá to tools/kontrola_webu.py — vykreslí celý web v ostrém
   režimu a měří VIDITELNÝ text, ne šablony. */
let ostry = false;
export function nastavOstry(hodnota) { ostry = !!hodnota; }
export function ostryWeb() { return ostry; }

/** Text do HTML. Jediná cesta, kterou se do stránky dostane cizí řetězec. */
export function e(hodnota) {
  return String(hodnota ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Hláška, kterou má jen ukázka. Na ostrém webu z ní nezbude nic. */
export function ukazka(texty, klic, jazyk, trida = "ukazka") {
  if (ostry) return "";
  return `<p class="${trida}">${e(t(texty, klic, jazyk))}</p>`;
}

/** Cena v korunách. Pevná mezera v tisících, ať se číslo nezlomí na konci řádku. */
export function korun(castka, jazyk = "cs") {
  const cislo = Math.round(Number(castka) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return jazyk === "en" ? `${cislo} CZK` : `${cislo} Kč`;
}

const POLOZKY_MENU = ["galerie", "eshop", "kalendar", "kurzy", "bio", "kontakt"];

function menu(aktivni, jazyk, texty, pocty) {
  const radky = POLOZKY_MENU.map((klic) => {
    const adresa = cesta(klic, jazyk);
    const tu = klic === aktivni ? ' aria-current="page"' : "";
    const pocet = pocty && pocty[klic] ? ` <span class="pocet">${pocty[klic]}</span>` : "";
    return `<li><a href="${adresa}"${tu}>${e(t(texty, "nav." + klic, jazyk))}${pocet}</a></li>`;
  });
  return `<ul class="menu">${radky.join("")}</ul>`;
}

/* Lišta aktualit. Bez JavaScriptu zůstanou vidět všechny tři pod sebou —
   rotaci dělá src/ui/web.js a teprve ten zbytek skryje. Kdyby se skript
   nestáhl, člověk pořád vidí, co se chystá.

   Klientka chtěla lištu výraznější a ovládání větší: každá položka nese typ
   akce, datum i větu o tom, kolik dnů zbývá, a přepínače jsou plné pilulky
   s datem, ne tečky o osmi pixelech. Klik otevře detail na místě (data-akce,
   src/ui/akce.js) — bez skriptu vede odkaz do kalendáře jako dřív. */

/** „Za 3 dny", „Zítra", „Právě probíhá". Čísla jsou na akci to první, co padne do oka. */
function kdyVetou(u, dnes, jazyk, texty) {
  const kde = stavAkce(u, dnes);
  if (kde === "probiha") return t(texty, "kalendar.probiha", jazyk);
  if (kde === "bylo") return t(texty, "kalendar.bylo", jazyk);
  const kolik = dnuDo(u, dnes);
  if (kolik === null || kolik < 0) return t(texty, "kalendar.chysta", jazyk);
  if (kolik === 0) return t(texty, "kalendar.dnes", jazyk);
  if (kolik === 1) return t(texty, "kalendar.zitra", jazyk);
  // Čeština má u dnů tři tvary; 2–4 "dny", od pěti "dní".
  const klic = kolik <= 4 ? "kalendar.za-dny" : "kalendar.za-dni";
  return t(texty, klic, jazyk).replace("%s", String(kolik));
}

function aktuality(udalosti, dnes, jazyk, texty) {
  const vybrane = vyberAktuality(udalosti, dnes, 3);
  if (!vybrane.length) return "";
  const radky = vybrane.map((u, i) => {
    const [, mesicCislo, den] = String(u.od || "").split("-");
    return `<li data-aktualita="${i}">
<a href="${cesta("kalendar", jazyk)}#${e(u.id)}" data-akce="${e(u.id)}">
<span class="datum" aria-hidden="true"><span class="den">${e(String(Number(den) || ""))}</span><span class="mesic">${e(mesicJmeno(Number(mesicCislo), jazyk))}</span></span>
<span class="chip ${e(u.typ || "")}">${e(t(texty, "kalendar.typ." + u.typ, jazyk))}</span>
<span class="nazev">${e(pole(u.nazev, jazyk))}</span>
<span class="kdy">${e(format(u, jazyk))}</span>
<span class="za ${e(stavAkce(u, dnes))}">${e(kdyVetou(u, dnes, jazyk, texty))}</span>
</a></li>`;
  });
  const prepinace = vybrane.map((u, i) =>
    `<button type="button" data-tecka="${i}" aria-current="${i === 0 ? "true" : "false"}">
<span aria-hidden="true">${e(format(u, jazyk).split(" ")[0])}</span>
<span class="skryte">${e(pole(u.nazev, jazyk))}</span></button>`);
  /* Stolní kalendář: kroužky, list s datem a pod ním naznačená hromádka
     dalších listů. Listy se po pár vteřinách přetáčejí samy (web.js),
     čísla dní pod nimi jsou ruční přetočení. */
  return `<nav class="aktuality" aria-label="${e(t(texty, "uvod.aktualne", jazyk))}" data-aktuality>
<p class="verzalky"><span class="tep" aria-hidden="true"></span>${e(t(texty, "uvod.aktualne", jazyk))}</p>
<div class="krouzky" aria-hidden="true"><span></span><span></span><span></span></div>
<ul class="listy">${radky.join("")}</ul>
<div class="tecky" role="group" aria-label="${e(t(texty, "uvod.aktualne", jazyk))}">${prepinace.join("")}</div>
</nav>`;
}

/* Detail akce. Panel je v obalu stránky, protože na akci se dá kliknout
   odkudkoli — lišta aktualit stojí v menu na každé stránce. Co se v panelu
   vypíše, posílá šablona jako JSON: obrázky děl mají srcsety, které zná jen
   build, a prohlížeč by si je vymýšlet neměl. */
function detailAkce(site, texty, jazyk, dnes) {
  const akce = poradi(site.udalosti, dnes).map((id) => {
    const u = site.udalosti.find((x) => x.id === id);
    // Díla visí u alba, ne u akce: jedno album (pragovka-2026) nese výstavu
    // i vernisáž. C-012 porovnává dilo.album s id akce, tak mu podstrčíme album.
    return { u, dila: dilaAkce(site.dila, { ...u, id: u.album || u.id }).slice(0, 6) };
  });
  const udalosti = akce.map(({ u }) => ({
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
  /* Díla jdou do <template>, ne do toho JSON vedle. Cesty k obrázkům a
     odkazům se na GitHub Pages přepisují o podsložku (tools/predvolba.py),
     a ten přepis vidí atributy v HTML — ne řetězce uvnitř JSON. V JSON by
     obrázky zůstaly na "/obrazky/…" a nenačetly se. */
  const sablonyDil = akce.filter(({ dila }) => dila.length).map(({ u, dila }) => {
    const polozky = dila.map((d) => `<li><a href="${cestaDila(d.slug, jazyk)}">${
      obrazek(d.obrazek, pole(d.alt, jazyk) || pole(d.nazev, jazyk), { sloupcu: 3 })
    }<span class="nazev">${e(pole(d.nazev, jazyk))}</span></a></li>`).join("");
    return `<template data-dila-akce="${e(u.id)}"><ul class="detail-dila">${polozky}</ul></template>`;
  }).join("");
  const popisky = [
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
  return `<div class="detail-akce" data-detail-akce ${popisky} hidden>
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

function patka(site, texty, jazyk, adresa) {
  const rok = new Date().getUTCFullYear();
  const odkazy = [
    `<span>© ${rok} ${e(site.web.jmeno)}</span>`,
    `<a href="#nahoru">${e(t(texty, "patka.nahoru", jazyk))}</a>`,
  ];
  // Administrace je součást ukázky, ne veřejného webu: na ostrém webu
  // sedí za přihlášením a do patičky nepatří.
  if (!ostry) odkazy.push(`<a href="${cesta("administrace", jazyk)}">${e(t(texty, "patka.administrace", jazyk))}</a>`);
  return `<footer class="patka">${odkazy.join("")}</footer>`;
}

/* Přepínač jazyka je jediný odkaz na tutéž stránku v druhém jazyce —
   `patka.jazyk` je rovnou jméno toho druhého jazyka ("English" / "Čeština").
   Dvojice odkazů, z nichž jeden vede tam, kde člověk stojí, nic nepřidá. */
function jazyky(adresa, jazyk, texty) {
  const druhy = druhyJazyk(jazyk);
  return `<div class="bok-cast jazyky">
<a href="${prepni(adresa, druhy)}" hreflang="${druhy}" lang="${druhy}">${e(t(texty, "patka.jazyk", jazyk))}</a>
</div>`;
}

function hreflangy(adresa) {
  return JAZYKY.map((j) => `<link rel="alternate" hreflang="${j}" href="${prepni(adresa, j)}">`).join("\n");
}

/* Chybové hlášky formulářů musí znát i prohlížeč — kontrakty C-005 a C-006
   vracejí klíče, ne hotové texty, právě aby se překlady držely na jednom
   místě v data/texty.json. */
const KLICE_CHYB = ["jmeno", "email", "telefon", "zprava", "doprava", "ulice", "mesto", "psc", "kosik"];
function chybyProProhlizec(texty, jazyk) {
  const slovnik = {};
  for (const klic of KLICE_CHYB) slovnik[klic] = t(texty, "formular.chyba." + klic, jazyk);
  return `<script type="application/json" data-chyby>${JSON.stringify(slovnik).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Celá stránka.
 * @param {object} o
 *  - site, texty, jazyk, adresa (cesta téhle stránky), aktivni (klíč menu)
 *  - titul, popis (meta description), telo (HTML obsahu)
 *  - dnes (RRRR-MM-DD), pocty (čísla k položkám menu), skript (true/false)
 */
export function layout(o) {
  const { site, texty, jazyk, adresa, aktivni, titul, popis, telo, dnes } = o;
  const jmeno = site.web.jmeno;
  const nazev = titul ? `${titul} — ${jmeno}` : jmeno;
  const pas = ostry ? "" : `<p class="ukazka-pas">${e(t(texty, "ukazka.hlavicka", jazyk))}</p>`;
  return `<!doctype html>
<html lang="${jazyk}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(nazev)}</title>
<meta name="description" content="${e(popis || "")}">
<meta property="og:title" content="${e(nazev)}">
<meta property="og:description" content="${e(popis || "")}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500&display=swap">
<link rel="stylesheet" href="/styl.css${otisk}">
${hreflangy(adresa)}
</head>
<body id="nahoru">
<a class="preskoc" href="#obsah">${e(t(texty, "nav.domu", jazyk))} → ${e(titul || jmeno)}</a>
${pas}
<div class="stranka">
<header class="bok bok-sbaleno" data-bok>
<a class="logo" href="${cesta("domu", jazyk)}">
<span>${e(jmeno)}</span>
<span class="role">${e(t(texty, "uvod.podtitul", jazyk))}</span>
</a>
<button class="menu-prepinac" type="button" data-menu aria-expanded="false">${e(t(texty, "nav.menu", jazyk))}</button>
${menu(aktivni, jazyk, texty, o.pocty)}
<p class="kosik-odkaz" data-kosik-odkaz hidden><a href="${cesta("kosik", jazyk)}">${e(t(texty, "nav.kosik", jazyk))} <span class="kolecko" data-pocet-kosiku hidden></span></a></p>
<div class="bok-cast">
<p class="verzalky">${e(t(texty, "kontakt.atelier", jazyk))}</p>
<p>${e(pole(site.web["ateliér"].nazev, jazyk))}<br>${e(site.web["ateliér"].adresa)}</p>
<div class="site">
<a href="${e(site.web.instagram)}" rel="noopener">Instagram</a>
<a href="${e(site.web.facebook)}" rel="noopener">Facebook</a>
</div>
</div>
${jazyky(adresa, jazyk, texty)}
${aktuality(site.udalosti, dnes, jazyk, texty)}
</header>
<main class="obsah" id="obsah">
${telo}
</main>
${patka(site, texty, jazyk, adresa)}
</div>
${detailAkce(site, texty, jazyk, dnes)}
${chybyProProhlizec(texty, jazyk)}
<script src="/web.js${otisk}" defer></script>
${o.admin ? `<script src="/admin.js${otisk}" defer></script>` : ""}
</body>
</html>
`;
}

export { obrazek };
