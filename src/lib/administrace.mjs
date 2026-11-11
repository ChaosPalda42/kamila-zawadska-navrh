// C-007 -- administration: the state in the browser, edits to works, news, courses and texts.
// A plain ES module with no dependencies and no DOM. It saves nothing itself -- it is handed
// a state and returns a NEW one; saving is the DOM layer's job (localStorage).

const STATES = ["v-prodeji", "zamluveno", "prodano", "neprodejne"];
const TYPY_UDALOSTI = ["vystava", "vernisaz", "atelier", "kurz"];
const LANGUAGES = ["cs", "en"];
const VERSION = 1;

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function isEmptyString(value) {
  return typeof value !== "string" || value.trim() === "";
}

// A text for cs: either `{ cs: "..." }`, or a bare string.
function maCsText(name) {
  if (typeof name === "string") return name.trim() !== "";
  if (name && typeof name === "object") return typeof name.cs === "string" && name.cs.trim() !== "";
  return false;
}

function jeDatum(value) {
  if (typeof value !== "string") return false;
  const soucasti = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!soucasti) return false;
  const year = Number(soucasti[1]);
  const month = Number(soucasti[2]);
  const day = Number(soucasti[3]);
  const datum = new Date(Date.UTC(year, month - 1, day));
  return (
    datum.getUTCFullYear() === year &&
    datum.getUTCMonth() === month - 1 &&
    datum.getUTCDate() === day
  );
}

// The shop visibility rule is the same one as in C-001: the flag and the state.
function visibleInShop(work) {
  return work != null && work.vEshopu === true && (work.stav === "v-prodeji" || work.stav === "zamluveno");
}

export function zaloz(site, texts) {
  return {
    dila: deepCopy((site && site.dila) || []),
    udalosti: deepCopy((site && site.udalosti) || []),
    kurzy: deepCopy((site && site.kurzy) || []),
    texty: deepCopy(texts || {}),
    verze: VERSION,
  };
}

function workErrors(work) {
  const chyby = [];
  if (isEmptyString(work && work.slug)) chyby.push("slug");
  if (!maCsText(work && work.nazev)) chyby.push("nazev");
  if (!STATES.includes(work && work.stav)) chyby.push("stav");
  if (
    work &&
    work.stav === "v-prodeji" &&
    work.vEshopu === true &&
    !(typeof work.cena === "number" && Number.isFinite(work.cena) && work.cena > 0)
  ) {
    chyby.push("cena");
  }
  if (work && work.vGalerii !== true && work.vEshopu !== true) chyby.push("nikde");
  return chyby;
}

export function ulozDilo(stav, work) {
  const chyby = workErrors(work);
  if (chyby.length > 0) return { stav, chyby };
  const copy = deepCopy(work);
  const index = stav.dila.findIndex((d) => d.slug === copy.slug);
  const dila =
    index >= 0
      ? stav.dila.map((d, i) => (i === index ? copy : d))
      : [copy, ...stav.dila];
  return { stav: { ...stav, dila }, chyby: [] };
}

export function smazDilo(stav, slug) {
  if (!stav.dila.some((d) => d.slug === slug)) return stav;
  return { ...stav, dila: stav.dila.filter((d) => d.slug !== slug) };
}

export function zmenStav(stav, slug, newState) {
  if (!STATES.includes(newState)) return stav;
  const index = stav.dila.findIndex((d) => d.slug === slug);
  if (index === -1) return stav;
  // `vEshopu` is not overwritten -- a sold work leaves the shop by the rule (C-001).
  const dila = stav.dila.map((d, i) => (i === index ? { ...d, stav: newState } : d));
  return { ...stav, dila };
}

export function prepniGalerii(stav, slug) {
  const index = stav.dila.findIndex((d) => d.slug === slug);
  if (index === -1) return stav;
  const work = stav.dila[index];
  const newVgalerii = work.vGalerii !== true;
  // Turning the gallery off for a work that is not in the shop would leave it nowhere.
  if (!newVgalerii && work.vEshopu !== true) return stav;
  const dila = stav.dila.map((d, i) => (i === index ? { ...d, vGalerii: newVgalerii } : d));
  return { ...stav, dila };
}

function eventErrors(udalost) {
  const chyby = [];
  if (isEmptyString(udalost && udalost.id)) chyby.push("id");
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
  const chyby = eventErrors(udalost);
  if (chyby.length > 0) return { stav, chyby };
  const copy = deepCopy(udalost);
  const index = stav.udalosti.findIndex((u) => u.id === copy.id);
  const udalosti =
    index >= 0
      ? stav.udalosti.map((u, i) => (i === index ? copy : u))
      : [copy, ...stav.udalosti];
  return { stav: { ...stav, udalosti }, chyby: [] };
}

export function smazUdalost(stav, id) {
  if (!stav.udalosti.some((u) => u.id === id)) return stav;
  return { ...stav, udalosti: stav.udalosti.filter((u) => u.id !== id) };
}

function courseErrors(course) {
  const chyby = [];
  if (isEmptyString(course && course.id)) chyby.push("id");
  if (!maCsText(course && course.nazev)) chyby.push("nazev");
  if (!(Number.isInteger(course && course.kapacita) && course.kapacita > 0)) chyby.push("kapacita");
  if (!(typeof course && typeof course.cena === "number" && Number.isFinite(course.cena) && course.cena >= 0)) {
    chyby.push("cena");
  }
  return chyby;
}

export function ulozKurz(stav, course) {
  const chyby = courseErrors(course);
  if (chyby.length > 0) return { stav, chyby };
  const copy = deepCopy(course);
  const index = stav.kurzy.findIndex((k) => k.id === copy.id);
  const kurzy =
    index >= 0
      ? stav.kurzy.map((k, i) => (i === index ? copy : k))
      : [copy, ...stav.kurzy];
  return { stav: { ...stav, kurzy }, chyby: [] };
}

export function ulozText(stav, klic, jazyk, text) {
  if (isEmptyString(klic) || !LANGUAGES.includes(jazyk)) return stav;
  const old = stav.texty[klic];
  const updated = { ...(old && typeof old === "object" ? old : {}), [jazyk]: text };
  return { ...stav, texty: { ...stav.texty, [klic]: updated } };
}

export function pocty(stav) {
  const dila = Array.isArray(stav.dila) ? stav.dila : [];
  return {
    dila: dila.length,
    vGalerii: dila.filter((d) => d && d.vGalerii === true).length,
    vEshopu: dila.filter(visibleInShop).length,
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
    stav.verze !== VERSION ||
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
    dila: deepCopy(stav.dila),
    udalosti: deepCopy(stav.udalosti),
    kurzy: deepCopy(stav.kurzy),
    texty: deepCopy(stav.texty),
    verze: VERSION,
  };
}
