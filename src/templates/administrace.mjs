/* Administrace — ukázka, jak se obsah spravuje.

   Zápis ze schůzky: dílo se zadává JEDNOU a zaškrtátka rozhodnou, kde se
   objeví. Proto je tu u díla galerie i e-shop jako dvě zaškrtátka a stav
   jako rozbalovátko; prodané dílo z e-shopu zmizí samo pravidlem, příznak
   se nepřepisuje.

   V ukázce se všechno ukládá jen do prohlížeče (localStorage). Na ostrém
   webu tahle stránka vůbec nevznikne — sedí za přihlášením a půjde na
   server. */

import { layout, e, ukazka } from "./layout.mjs";
import { t, pole, cesta } from "../lib/preklad.mjs";
import { STAVY } from "../lib/dila.mjs";

function zalozka(id, titulek, prvni) {
  return `<button type="button" role="tab" data-zalozka="${e(id)}" aria-selected="${prvni ? "true" : "false"}">${e(titulek)}</button>`;
}

export function administraceStranka(o) {
  const { site, texty, jazyk } = o;
  const stavy = STAVY.map((s) => `<option value="${e(s)}">${e(t(texty, "stav." + s, jazyk))}</option>`).join("");
  const techniky = site.techniky.map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");
  const styly = site.styly.map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");
  const albumy = site.albumy.map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");

  const telo = `
<section>
<h1>${e(t(texty, "patka.administrace", jazyk))}</h1>
${ukazka(texty, "ukazka.administrace", jazyk)}
<p class="verzalky" data-pocty></p>
<div class="filtry" role="tablist">
<div class="filtry-rada">
${zalozka("dila", t(texty, "galerie.titul", jazyk), true)}
${zalozka("udalosti", t(texty, "kalendar.titul", jazyk), false)}
${zalozka("kurzy", t(texty, "kurzy.titul", jazyk), false)}
${zalozka("texty", t(texty, "kontakt.zprava", jazyk), false)}
</div>
</div>
</section>

<section data-panel="dila">
<h2>${e(t(texty, "galerie.titul", jazyk))}</h2>
<form class="formular" data-form-dilo novalidate>
<div class="dvojice">
${polickoText("slug", "Slug")}
${polickoCislo("rok", "Rok")}
</div>
${polickoText("nazev", t(texty, "objednavka.jmeno", jazyk))}
<div class="dvojice">
${polickoText("rozmer", "Rozměr")}
${polickoCislo("cena", t(texty, "kurzy.cena", jazyk))}
</div>
<div class="pole" data-pole="stav"><label for="a-stav">${e(t(texty, "stav.v-prodeji", jazyk))}</label>
<select id="a-stav" name="stav">${stavy}</select><span class="chyba" data-chyba hidden></span></div>
<div class="pole" data-pole="technika"><label for="a-technika">${e(t(texty, "galerie.filtr.technika", jazyk))}</label>
<select id="a-technika" name="technika"><option value=""></option>${techniky}</select></div>
<div class="pole" data-pole="styl"><label for="a-styl">${e(t(texty, "galerie.filtr.styl", jazyk))}</label>
<select id="a-styl" name="styl"><option value=""></option>${styly}</select></div>
<div class="pole" data-pole="album"><label for="a-album">${e(t(texty, "galerie.filtr.udalost", jazyk))}</label>
<select id="a-album" name="album"><option value=""></option>${albumy}</select></div>
<div class="pole" data-pole="kde">
<label><input type="checkbox" name="vGalerii" checked> ${e(t(texty, "galerie.titul", jazyk))}</label>
<label><input type="checkbox" name="vEshopu"> ${e(t(texty, "eshop.titul", jazyk))}</label>
<span class="chyba" data-chyba hidden></span>
</div>
<p><button class="tlacitko" type="submit">${e(t(texty, "kosik.dokoncit", jazyk))}</button>
<button class="tlacitko lehke" type="reset">${e(t(texty, "galerie.filtr.zrusit", jazyk))}</button></p>
</form>
<table class="ucet"><tbody data-seznam-dila></tbody></table>
</section>

<section data-panel="udalosti" hidden>
<h2>${e(t(texty, "kalendar.titul", jazyk))}</h2>
<form class="formular" data-form-udalost novalidate>
${polickoText("id", "Slug")}
${polickoText("nazev", t(texty, "objednavka.jmeno", jazyk))}
<div class="pole" data-pole="typ"><label for="a-typ">${e(t(texty, "kalendar.typ.vystava", jazyk))}</label>
<select id="a-typ" name="typ">
${["vystava", "vernisaz", "atelier", "kurz"].map((x) => `<option value="${x}">${e(t(texty, "kalendar.typ." + x, jazyk))}</option>`).join("")}
</select><span class="chyba" data-chyba hidden></span></div>
<div class="dvojice">
${polickoDatum("od", t(texty, "kalendar.pristi", jazyk))}
${polickoDatum("do", t(texty, "kalendar.minule", jazyk))}
</div>
<div class="pole" data-pole="aktualita"><label><input type="checkbox" name="aktualita"> ${e(t(texty, "uvod.aktualne", jazyk))}</label></div>
<p><button class="tlacitko" type="submit">${e(t(texty, "kosik.dokoncit", jazyk))}</button></p>
</form>
<table class="ucet"><tbody data-seznam-udalosti></tbody></table>
</section>

<section data-panel="kurzy" hidden>
<h2>${e(t(texty, "kurzy.titul", jazyk))}</h2>
<form class="formular" data-form-kurz novalidate>
${polickoText("id", "Slug")}
${polickoText("nazev", t(texty, "objednavka.jmeno", jazyk))}
<div class="dvojice">
${polickoCislo("kapacita", t(texty, "kurzy.kapacita", jazyk))}
${polickoCislo("cena", t(texty, "kurzy.cena", jazyk))}
</div>
<p><button class="tlacitko" type="submit">${e(t(texty, "kosik.dokoncit", jazyk))}</button></p>
</form>
<table class="ucet"><tbody data-seznam-kurzy></tbody></table>
</section>

<section data-panel="texty" hidden>
<h2>${e(t(texty, "kontakt.zprava", jazyk))}</h2>
<table class="ucet"><tbody data-seznam-texty></tbody></table>
</section>

<script type="application/json" data-site>${JSON.stringify(site).replace(/</g, "\\u003c")}</script>
<script type="application/json" data-texty>${JSON.stringify(texty).replace(/</g, "\\u003c")}</script>
<section>
<p><a href="${cesta("domu", jazyk)}">← ${e(t(texty, "nav.domu", jazyk))}</a>
<button class="tlacitko lehke" type="button" data-reset-stav>${e(t(texty, "galerie.filtr.zrusit", jazyk))}</button></p>
</section>
`;
  return layout({ ...o, admin: true, aktivni: "", adresa: cesta("administrace", jazyk), titul: t(texty, "patka.administrace", jazyk), popis: "", telo });
}

function polickoText(klic, titulek) {
  return `<div class="pole" data-pole="${e(klic)}"><label for="a-${e(klic)}">${e(titulek)}</label>
<input id="a-${e(klic)}" name="${e(klic)}" type="text"><span class="chyba" data-chyba hidden></span></div>`;
}
function polickoCislo(klic, titulek) {
  return `<div class="pole" data-pole="${e(klic)}"><label for="a-${e(klic)}">${e(titulek)}</label>
<input id="a-${e(klic)}" name="${e(klic)}" type="number" min="0" step="1"><span class="chyba" data-chyba hidden></span></div>`;
}
function polickoDatum(klic, titulek) {
  return `<div class="pole" data-pole="${e(klic)}"><label for="a-${e(klic)}">${e(titulek)}</label>
<input id="a-${e(klic)}" name="${e(klic)}" type="date"><span class="chyba" data-chyba hidden></span></div>`;
}
