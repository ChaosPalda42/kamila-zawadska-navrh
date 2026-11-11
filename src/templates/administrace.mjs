/* The admin -- a demonstration of how the content is kept.

   From the meeting notes: a work is entered ONCE and the checkboxes decide
   where it shows up. That is why gallery and shop are two checkboxes on a
   work and the state is a dropdown; a sold work leaves the shop by that rule
   on its own, and the flag is never overwritten.

   The admin is split into sections (paintings, calendar, courses, texts,
   contacts) and stands behind a door: on the live site nobody gets here
   without signing in. In the demo the door is a demonstration too, and the
   page is not built at all under `OSTRY=1` -- an admin has no place in a public
   site.

   The admin's own labels live here, not in `data/texty.json`: they are the
   workshop's words, not the site's, and in the text editor they would only be
   in the way.

   In the demo everything is kept in the browser (localStorage) and an
   uploaded photo lives until the tab closes. On the live site both will go to
   a server. */

import { layout, e, ukazka } from "./layout.mjs";
import { t, pole, cesta } from "../lib/preklad.mjs";
import { STAVY } from "../lib/dila.mjs";

const CAPTIONS = {
  cs: {
    vratnice: "Administrace je na ostrém webu schovaná za přihlášením. V ukázce stačí kliknout — nic se nikam neodesílá.",
    jmeno: "Přihlašovací jméno", heslo: "Heslo", prihlasit: "Přihlásit se",
    oddily: "Oddíly administrace",
    obrazy: "Obrazy", kalendar: "Kalendář a akce", kurzy: "Kurzy",
    texty: "Texty webu", kontakty: "Kontakty",
    novy: "Nový obraz", novaAkce: "Nová akce", novyKurz: "Nový kurz",
    upravujete: "Upravujete",
    ulozit: "Uložit", zrusit: "Zrušit úpravy", smazat: "Smazat", upravit: "Upravit",
    nazevCs: "Název česky", nazevEn: "Název anglicky",
    popisCs: "Popis česky", popisEn: "Popis anglicky",
    rok: "Rok", rozmer: "Rozměr (např. 60 × 40 cm)", cena: "Cena v korunách",
    stav: "Stav", technika: "Technika", motiv: "Motiv", album: "Patří k akci",
    kurz: "Patří ke kurzu",
    kde: "Kde se obraz objeví", vGalerii: "V galerii", vEshopu: "V e-shopu k prodeji",
    fotky: "Fotky obrazu",
    pretahni: "Přetáhněte sem fotky, nebo je vyberte z počítače",
    vybrat: "Vybrat fotky", hlavni: "Hlavní", dejHlavni: "Nastavit jako hlavní",
    nahoru: "Posunout dřív", dolu: "Posunout později",
    fotkyUkazka: "V ukázce fotky zůstávají jen do zavření karty — na ostrém webu se nahrají na server.",
    pokrocile: "Pokročilé — adresa na webu",
    slug: "Slug (adresa)",
    slugProc: "Slug je ta část adresy, která dílo pojmenuje: /dilo/rano-nad-vltavou/. Vyplní se sám z názvu a měnit ho je potřeba jen výjimečně — po změně vede starý odkaz do prázdna.",
    typ: "Typ akce", od: "Od (začátek)", do: "Do (konec)",
    doProc: "Nechte prázdné, pokud akce trvá jeden den.",
    cas: "Čas (např. 18:00)", misto: "Kde se to koná",
    aktualita: "Ukázat v liště „Právě teď“",
    kapacita: "Kapacita (kolik lidí)",
    hledat: "Hledat v textech", hledatPopis: "Hledejte česky i anglicky, diakritika nevadí.",
    klic: "Klíč", cesky: "Česky", anglicky: "Anglicky",
    chybi: "chybí překlad", zmeneno: "neuloženo",
    bezVysledku: "Nic takového tu není.",
    kontaktyPopis: "Kontakty jsou v ukázce zástupné. Tady je klientka přepíše na svoje.",
    email: "E-mail", telefon: "Telefon", instagram: "Instagram", facebook: "Facebook",
    atelierNazev: "Ateliér — název", atelierAdresa: "Ateliér — adresa",
    opravduSmazat: "Opravdu smazat?", ano: "Ano, smazat", ne: "Nechat",
    prazdno: "Zatím tu nic není.",
    "stavAkce.chysta": "chystá se", "stavAkce.probiha": "právě probíhá", "stavAkce.bylo": "už bylo",
    vratitVse: "Vrátit ukázková data",
  },
  en: {
    vratnice: "On the live site the admin sits behind a login. In the demo one click is enough — nothing is sent anywhere.",
    jmeno: "User name", heslo: "Password", prihlasit: "Sign in",
    oddily: "Admin sections",
    obrazy: "Works", kalendar: "Calendar and events", kurzy: "Courses",
    texty: "Website texts", kontakty: "Contacts",
    novy: "New work", novaAkce: "New event", novyKurz: "New course",
    upravujete: "Editing",
    ulozit: "Save", zrusit: "Cancel", smazat: "Delete", upravit: "Edit",
    nazevCs: "Title in Czech", nazevEn: "Title in English",
    popisCs: "Description in Czech", popisEn: "Description in English",
    rok: "Year", rozmer: "Size (e.g. 60 × 40 cm)", cena: "Price in CZK",
    stav: "Status", technika: "Technique", motiv: "Motif", album: "Belongs to event",
    kurz: "Belongs to a course",
    kde: "Where the work appears", vGalerii: "In the gallery", vEshopu: "For sale in the shop",
    fotky: "Photos of the work",
    pretahni: "Drop photos here, or pick them from your computer",
    vybrat: "Choose photos", hlavni: "Main", dejHlavni: "Make it the main photo",
    nahoru: "Move earlier", dolu: "Move later",
    fotkyUkazka: "In the demo photos last until the tab closes — on the live site they are uploaded to the server.",
    pokrocile: "Advanced — address on the web",
    slug: "Slug (address)",
    slugProc: "The slug is the part of the address that names the work: /en/work/morning-over-the-vltava/. It is filled in from the title and rarely needs changing — an old link breaks once it changes.",
    typ: "Event type", od: "From", do: "To",
    doProc: "Leave empty for a one-day event.",
    cas: "Time (e.g. 18:00)", misto: "Where it takes place",
    aktualita: "Show in the “Right now” bar",
    kapacita: "Capacity (how many people)",
    hledat: "Search the texts", hledatPopis: "Search in Czech or English, accents do not matter.",
    klic: "Key", cesky: "Czech", anglicky: "English",
    chybi: "translation missing", zmeneno: "unsaved",
    bezVysledku: "Nothing like that here.",
    kontaktyPopis: "Contact details are placeholders in the demo. This is where they get replaced.",
    email: "E-mail", telefon: "Phone", instagram: "Instagram", facebook: "Facebook",
    atelierNazev: "Studio — name", atelierAdresa: "Studio — address",
    opravduSmazat: "Really delete?", ano: "Yes, delete", ne: "Keep",
    prazdno: "Nothing here yet.",
    "stavAkce.chysta": "upcoming", "stavAkce.probiha": "happening now", "stavAkce.bylo": "past",
    vratitVse: "Restore demo data",
  },
};

function p(jazyk, key) { return (CAPTIONS[jazyk] || CAPTIONS.cs)[key] || key; }

function policko(key, titulek, typ = "text", volby = {}) {
  const attributes = [`id="a-${e(key)}"`, `name="${e(key)}"`, `type="${e(typ)}"`];
  if (typ === "number") attributes.push('min="0"', 'step="1"');
  if (volby.placeholder) attributes.push(`placeholder="${e(volby.placeholder)}"`);
  const napoveda = volby.napoveda
    ? `<span class="napoveda" id="n-${e(key)}">${e(volby.napoveda)}</span>` : "";
  if (napoveda) attributes.push(`aria-describedby="n-${e(key)}"`);
  return `<div class="pole" data-pole="${e(key)}"><label for="a-${e(key)}">${e(titulek)}</label>
<input ${attributes.join(" ")}>${napoveda}<span class="chyba" data-chyba hidden></span></div>`;
}

function textField(key, titulek) {
  return `<div class="pole" data-pole="${e(key)}"><label for="a-${e(key)}">${e(titulek)}</label>
<textarea id="a-${e(key)}" name="${e(key)}" rows="3"></textarea><span class="chyba" data-chyba hidden></span></div>`;
}

function selection(key, titulek, moznosti) {
  return `<div class="pole" data-pole="${e(key)}"><label for="a-${e(key)}">${e(titulek)}</label>
<select id="a-${e(key)}" name="${e(key)}">${moznosti}</select><span class="chyba" data-chyba hidden></span></div>`;
}

function checkbox(key, titulek, zaskrtnuto = false) {
  return `<label class="volba"><input type="checkbox" name="${e(key)}"${zaskrtnuto ? " checked" : ""}> <span>${e(titulek)}</span></label>`;
}

function section(id, titulek, first) {
  return `<button type="button" role="tab" data-zalozka="${e(id)}" aria-selected="${first ? "true" : "false"}">${e(titulek)}</button>`;
}

export function administraceStranka(o) {
  const { site, texty, jazyk } = o;
  const L = (key) => p(jazyk, key);
  const states = STAVY.map((s) => `<option value="${e(s)}">${e(t(texty, "stav." + s, jazyk))}</option>`).join("");
  const techniques = site.techniky.map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");
  const motives = site.motivy.map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");
  const albumy = site.albumy.map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");
  const courseOptions = (site.kurzy || []).map((x) => `<option value="${e(x.id)}">${e(pole(x.nazev, jazyk))}</option>`).join("");
  const typy = ["vystava", "vernisaz", "atelier", "kurz"]
    .map((x) => `<option value="${x}">${e(t(texty, "kalendar.typ." + x, jazyk))}</option>`).join("");

  const vratnice = `
<div class="vratnice" data-vratnice>
<form class="vratnice-panel formular" data-vratnice-form novalidate>
<p class="verzalky">${e(t(texty, "patka.administrace", jazyk))}</p>
<p>${e(L("vratnice"))}</p>
${policko("prihlaseni-jmeno", L("jmeno"))}
${policko("prihlaseni-heslo", L("heslo"), "password")}
<p><button class="tlacitko" type="submit">${e(L("prihlasit"))}</button></p>
</form>
</div>`;

  const obrazy = `
<section data-panel="dila">
<h2>${e(L("obrazy"))}</h2>
<form class="formular sirsi" data-form-dilo novalidate>
<p class="formular-hlava"><span data-rezim-dilo>${e(L("novy"))}</span>
<button class="tlacitko lehke" type="button" data-zrus-dilo hidden>${e(L("zrusit"))}</button></p>
<div class="dvojice-rovnou">
${policko("nazev", L("nazevCs"))}
${policko("nazevEn", L("nazevEn"))}
</div>

<fieldset class="fotky" data-fotky>
<legend>${e(L("fotky"))}</legend>
<div class="pustit" data-pustit>
<p>${e(L("pretahni"))}</p>
<p><label class="tlacitko lehke" for="a-fotky">${e(L("vybrat"))}</label>
<input id="a-fotky" class="skryte" type="file" accept="image/jpeg,image/png,image/webp" multiple data-vstup-fotky></p>
</div>
<ul class="fotky-seznam" data-seznam-fotek></ul>
<p class="chyba" data-chyba-fotky hidden></p>
<p class="napoveda">${e(L("fotkyUkazka"))}</p>
</fieldset>

<div class="dvojice-rovnou">
${policko("rok", L("rok"), "number")}
${policko("rozmer", L("rozmer"))}
</div>
<div class="dvojice-rovnou">
${selection("stav", L("stav"), states)}
${policko("cena", L("cena"), "number")}
</div>
<div class="dvojice-rovnou">
${selection("technika", L("technika"), `<option value=""></option>${techniques}`)}
${selection("motiv", L("motiv"), `<option value=""></option>${motives}`)}
</div>
<div class="dvojice-rovnou">
${selection("album", L("album"), `<option value=""></option>${albumy}`)}
${selection("kurz", L("kurz"), `<option value=""></option>${courseOptions}`)}
</div>
<div class="dvojice-rovnou">
${textField("popis", L("popisCs"))}
${textField("popisEn", L("popisEn"))}
</div>
<div class="pole" data-pole="kde"><span class="popisek">${e(L("kde"))}</span>
<div class="volby">
${checkbox("vGalerii", L("vGalerii"), true)}
${checkbox("vEshopu", L("vEshopu"))}
</div>
<span class="chyba" data-chyba hidden></span></div>
<details class="pokrocile">
<summary>${e(L("pokrocile"))}</summary>
${policko("slug", L("slug"), "text", { napoveda: L("slugProc") })}
</details>
<p><button class="tlacitko" type="submit">${e(L("ulozit"))}</button></p>
</form>
<table class="ucet seznam"><tbody data-seznam-dila></tbody></table>
</section>`;

  const calendar = `
<section data-panel="udalosti" hidden>
<h2>${e(L("kalendar"))}</h2>
<form class="formular sirsi" data-form-udalost novalidate>
<p class="formular-hlava"><span data-rezim-udalost>${e(L("novaAkce"))}</span>
<button class="tlacitko lehke" type="button" data-zrus-udalost hidden>${e(L("zrusit"))}</button></p>
<div class="dvojice-rovnou">
${policko("nazev", L("nazevCs"))}
${policko("nazevEn", L("nazevEn"))}
</div>
<div class="dvojice-rovnou">
${selection("typ", L("typ"), typy)}
${selection("album", L("albumAkce"), `<option value=""></option>${albumy}`)}
</div>
<div class="dvojice-rovnou">
${policko("od", L("od"), "date")}
${policko("do", L("do"), "date", { napoveda: L("doProc") })}
</div>
<div class="dvojice-rovnou">
${policko("cas", L("cas"), "time")}
${policko("misto", L("misto"))}
</div>
<div class="dvojice-rovnou">
${textField("popis", L("popisCs"))}
${textField("popisEn", L("popisEn"))}
</div>
<div class="pole" data-pole="aktualita"><div class="volby">${checkbox("aktualita", L("aktualita"))}</div></div>
<details class="pokrocile">
<summary>${e(L("pokrocile"))}</summary>
${policko("id", L("slug"), "text", { napoveda: L("slugProc") })}
</details>
<p><button class="tlacitko" type="submit">${e(L("ulozit"))}</button></p>
</form>
<table class="ucet seznam"><tbody data-seznam-udalosti></tbody></table>
</section>`;

  const courses = `
<section data-panel="kurzy" hidden>
<h2>${e(L("kurzy"))}</h2>
<form class="formular sirsi" data-form-kurz novalidate>
<p class="formular-hlava"><span data-rezim-kurz>${e(L("novyKurz"))}</span>
<button class="tlacitko lehke" type="button" data-zrus-kurz hidden>${e(L("zrusit"))}</button></p>
<div class="dvojice-rovnou">
${policko("nazev", L("nazevCs"))}
${policko("nazevEn", L("nazevEn"))}
</div>
<div class="dvojice-rovnou">
${policko("kapacita", L("kapacita"), "number")}
${policko("cena", L("cena"), "number")}
</div>
${textField("popis", L("popisCs"))}
<details class="pokrocile">
<summary>${e(L("pokrocile"))}</summary>
${policko("id", L("slug"), "text", { napoveda: L("slugProc") })}
</details>
<p><button class="tlacitko" type="submit">${e(L("ulozit"))}</button></p>
</form>
<table class="ucet seznam"><tbody data-seznam-kurzy></tbody></table>
</section>`;

  const textsPanel = `
<section data-panel="texty" hidden>
<h2>${e(L("texty"))}</h2>
<div class="pole hledani">
<label for="a-hledat">${e(L("hledat"))}</label>
<input id="a-hledat" type="search" data-hledat aria-describedby="n-hledat">
<span class="napoveda" id="n-hledat">${e(L("hledatPopis"))}</span>
</div>
<div class="filtry" role="tablist" data-sekce-textu></div>
<div data-seznam-texty></div>
<p data-texty-prazdno hidden>${e(L("bezVysledku"))}</p>
</section>`;

  const contacts = `
<section data-panel="kontakty" hidden>
<h2>${e(L("kontakty"))}</h2>
<p>${e(L("kontaktyPopis"))}</p>
<form class="formular sirsi" data-form-kontakty novalidate>
<div class="dvojice-rovnou">
${policko("email", L("email"), "email")}
${policko("telefon", L("telefon"), "tel")}
</div>
<div class="dvojice-rovnou">
${policko("instagram", L("instagram"), "url")}
${policko("facebook", L("facebook"), "url")}
</div>
<div class="dvojice-rovnou">
${policko("atelierNazev", L("atelierNazev"))}
${policko("atelierAdresa", L("atelierAdresa"))}
</div>
<p><button class="tlacitko" type="submit">${e(L("ulozit"))}</button>
<span class="ulozeno" data-ulozeno hidden></span></p>
</form>
</section>`;

  const telo = `
${vratnice}
<div class="admin" data-admin hidden>
<section>
<h1>${e(t(texty, "patka.administrace", jazyk))}</h1>
${ukazka(texty, "ukazka.administrace", jazyk)}
<p class="verzalky" data-pocty></p>
</section>
<div class="admin-telo">
<nav class="admin-menu" role="tablist" aria-label="${e(L("oddily"))}">
${section("dila", L("obrazy"), true)}
${section("udalosti", L("kalendar"), false)}
${section("kurzy", L("kurzy"), false)}
${section("texty", L("texty"), false)}
${section("kontakty", L("kontakty"), false)}
</nav>
<div class="admin-panely">
${obrazy}
${calendar}
${courses}
${textsPanel}
${contacts}
</div>
</div>
<section>
<p><a href="${cesta("domu", jazyk)}">← ${e(t(texty, "nav.domu", jazyk))}</a>
<button class="tlacitko lehke" type="button" data-reset-stav>${e(L("vratitVse"))}</button></p>
</section>
</div>
<script type="application/json" data-site>${JSON.stringify(site).replace(/</g, "\\u003c")}</script>
<script type="application/json" data-texty>${JSON.stringify(texty).replace(/</g, "\\u003c")}</script>
<script type="application/json" data-popisky>${JSON.stringify(CAPTIONS[jazyk] || CAPTIONS.cs).replace(/</g, "\\u003c")}</script>
`;
  return layout({ ...o, admin: true, aktivni: "", adresa: cesta("administrace", jazyk), titul: t(texty, "patka.administrace", jazyk), popis: "", telo });
}
