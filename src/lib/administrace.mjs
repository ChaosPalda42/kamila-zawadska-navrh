// C-007 — administrace: stav v prohlížeči, změny děl, aktualit, kurzů a textů.
// Čistý ES modul bez závislostí a bez DOM. Nic neukládá sám — dostane stav a
// vrací NOVÝ stav; ukládání řeší DOM vrstva (localStorage).

const STAVY = ["v-prodeji", "zamluveno", "prodano", "neprodejne"];
const TYPY_UDALOSTI = ["vystava", "vernisaz", "atelier", "kurz"];
const JAZYKY = ["cs", "en"];
const VERZE = 1;

function hlubokaKopie(hodnota) {
  return JSON.parse(JSON.stringify(hodnota));
}

function jePrazdnyRetezec(hodnota) {
  return typeof hodnota !== "string" || hodnota.trim() === "";
}

// Text pro cs: buď { cs: "…" }, buď rovnou řetězec.
function maCsText(nazev) {
  if (typeof nazev === "string") return nazev.trim() !== "";
  if (nazev && typeof nazev === "object") return typeof nazev.cs === "string" && nazev.cs.trim() !== "";
  return false;
}

function jeDatum(hodnota) {
  if (typeof hodnota !== "string") return false;
  const soucasti = hodnota.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!soucasti) return false;
  const rok = Number(soucasti[1]);
  const mesic = Number(soucasti[2]);
  const den = Number(soucasti[3]);
  const datum = new Date(Date.UTC(rok, mesic - 1, den));
  return (
    datum.getUTCFullYear() === rok &&
    datum.getUTCMonth() === mesic - 1 &&
    datum.getUTCDate() === den
  );
}

// Pravidlo viditelnosti v e-shopu je stejné jako v C-001: příznak i stav.
function viditelneVEshopu(dilo) {
  return dilo != null && dilo.vEshopu === true && (dilo.stav === "v-prodeji" || dilo.stav === "zamluveno");
}

export function zaloz(site, texty) {
  return {
    dila: hlubokaKopie((site && site.dila) || []),
    udalosti: hlubokaKopie((site && site.udalosti) || []),
    kurzy: hlubokaKopie((site && site.kurzy) || []),
    texty: hlubokaKopie(texty || {}),
    verze: VERZE,
  };
}

function chybyDila(dilo) {
  const chyby = [];
  if (jePrazdnyRetezec(dilo && dilo.slug)) chyby.push("slug");
  if (!maCsText(dilo && dilo.nazev)) chyby.push("nazev");
  if (!STAVY.includes(dilo && dilo.stav)) chyby.push("stav");
  if (
    dilo &&
    dilo.stav === "v-prodeji" &&
    dilo.vEshopu === true &&
    !(typeof dilo.cena === "number" && Number.isFinite(dilo.cena) && dilo.cena > 0)
  ) {
    chyby.push("cena");
  }
  if (dilo && dilo.vGalerii !== true && dilo.vEshopu !== true) chyby.push("nikde");
  return chyby;
}

export function ulozDilo(stav, dilo) {
  const chyby = chybyDila(dilo);
  if (chyby.length > 0) return { stav, chyby };
  const kopie = hlubokaKopie(dilo);
  const index = stav.dila.findIndex((d) => d.slug === kopie.slug);
  const dila =
    index >= 0
      ? stav.dila.map((d, i) => (i === index ? kopie : d))
      : [kopie, ...stav.dila];
  return { stav: { ...stav, dila }, chyby: [] };
}

export function smazDilo(stav, slug) {
  if (!stav.dila.some((d) => d.slug === slug)) return stav;
  return { ...stav, dila: stav.dila.filter((d) => d.slug !== slug) };
}

export function zmenStav(stav, slug, novyStav) {
  if (!STAVY.includes(novyStav)) return stav;
  const index = stav.dila.findIndex((d) => d.slug === slug);
  if (index === -1) return stav;
  // vEshopu se nepřepisuje — prodané dílo zmizí z e-shopu pravidlem (C-001).
  const dila = stav.dila.map((d, i) => (i === index ? { ...d, stav: novyStav } : d));
  return { ...stav, dila };
}

export function prepniGalerii(stav, slug) {
  const index = stav.dila.findIndex((d) => d.slug === slug);
  if (index === -1) return stav;
  const dilo = stav.dila[index];
  const novyVgalerii = dilo.vGalerii !== true;
  // Vypnutí galerie u díla, které není v e-shopu, by vedlo na „nikde“.
  if (!novyVgalerii && dilo.vEshopu !== true) return stav;
  const dila = stav.dila.map((d, i) => (i === index ? { ...d, vGalerii: novyVgalerii } : d));
  return { ...stav, dila };
}

function chybyUdalosti(udalost) {
  const chyby = [];
  if (jePrazdnyRetezec(udalost && udalost.id)) chyby.push("id");
  if (!maCsText(udalost && udalost.nazev)) chyby.push("nazev");
  if (!TYPY_UDALOSTI.includes(udalost && udalost.typ)) chyby.push("typ");
  if (!jeDatum(udalost && udalost.od)) chyby.push("od");
  const do_ = udalost && udalost.do;
  if (do_ !== undefined && do_ !== null && do_ !== "") {
    if (!jeDatum(do_) || (jeDatum(udalost.od) && do_ < udalost.od)) chyby.push("do");
  }
  return chyby;
}

export function ulozUdalost(stav, udalost) {
  const chyby = chybyUdalosti(udalost);
  if (chyby.length > 0) return { stav, chyby };
  const kopie = hlubokaKopie(udalost);
  const index = stav.udalosti.findIndex((u) => u.id === kopie.id);
  const udalosti =
    index >= 0
      ? stav.udalosti.map((u, i) => (i === index ? kopie : u))
      : [kopie, ...stav.udalosti];
  return { stav: { ...stav, udalosti }, chyby: [] };
}

export function smazUdalost(stav, id) {
  if (!stav.udalosti.some((u) => u.id === id)) return stav;
  return { ...stav, udalosti: stav.udalosti.filter((u) => u.id !== id) };
}

function chybyKurzu(kurz) {
  const chyby = [];
  if (jePrazdnyRetezec(kurz && kurz.id)) chyby.push("id");
  if (!maCsText(kurz && kurz.nazev)) chyby.push("nazev");
  if (!(Number.isInteger(kurz && kurz.kapacita) && kurz.kapacita > 0)) chyby.push("kapacita");
  if (!(typeof kurz && typeof kurz.cena === "number" && Number.isFinite(kurz.cena) && kurz.cena >= 0)) {
    chyby.push("cena");
  }
  return chyby;
}

export function ulozKurz(stav, kurz) {
  const chyby = chybyKurzu(kurz);
  if (chyby.length > 0) return { stav, chyby };
  const kopie = hlubokaKopie(kurz);
  const index = stav.kurzy.findIndex((k) => k.id === kopie.id);
  const kurzy =
    index >= 0
      ? stav.kurzy.map((k, i) => (i === index ? kopie : k))
      : [kopie, ...stav.kurzy];
  return { stav: { ...stav, kurzy }, chyby: [] };
}

export function ulozText(stav, klic, jazyk, text) {
  if (jePrazdnyRetezec(klic) || !JAZYKY.includes(jazyk)) return stav;
  const stary = stav.texty[klic];
  const novy = { ...(stary && typeof stary === "object" ? stary : {}), [jazyk]: text };
  return { ...stav, texty: { ...stav.texty, [klic]: novy } };
}

export function pocty(stav) {
  const dila = Array.isArray(stav.dila) ? stav.dila : [];
  return {
    dila: dila.length,
    vGalerii: dila.filter((d) => d && d.vGalerii === true).length,
    vEshopu: dila.filter(viditelneVEshopu).length,
    prodano: dila.filter((d) => d && d.stav === "prodano").length,
    zamluveno: dila.filter((d) => d && d.stav === "zamluveno").length,
    udalosti: Array.isArray(stav.udalosti) ? stav.udalosti.length : 0,
    kurzy: Array.isArray(stav.kurzy) ? stav.kurzy.length : 0,
  };
}

export function naKod(stav) {
  return JSON.stringify(stav);
}

export function zKodu(text) {
  if (typeof text !== "string") return null;
  let stav;
  try {
    stav = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    stav === null ||
    typeof stav !== "object" ||
    Array.isArray(stav) ||
    stav.verze !== VERZE ||
    !Array.isArray(stav.dila) ||
    !Array.isArray(stav.udalosti) ||
    !Array.isArray(stav.kurzy) ||
    stav.texty === null ||
    typeof stav.texty !== "object" ||
    Array.isArray(stav.texty)
  ) {
    return null;
  }
  return {
    dila: hlubokaKopie(stav.dila),
    udalosti: hlubokaKopie(stav.udalosti),
    kurzy: hlubokaKopie(stav.kurzy),
    texty: hlubokaKopie(stav.texty),
    verze: VERZE,
  };
}
