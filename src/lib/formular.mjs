// C-006 — Kontaktní formulář a poptávka díla na míru.
// Čistý ES modul bez závislostí a bez DOM. Vrací klíče chybových hlášek
// (texty žijí v data/texty.json pod "formular.chyba.*").

export const DUVODY = Object.freeze(["dotaz", "na-miru", "kurz", "atelier"]);

export function platnyEmail(text) {
  if (typeof text !== "string") return false;
  if (text.includes(" ") || text.includes("\t") || text.includes("\n")) return false;
  const at = text.indexOf("@");
  if (at === -1 || at !== text.lastIndexOf("@")) return false;
  const lokalni = text.slice(0, at);
  const domena = text.slice(at + 1);
  if (lokalni.length < 1) return false;
  const casti = domena.split(".");
  if (casti.length < 2) return false;
  for (const cast of casti) {
    if (cast.length === 0 || /\s/.test(cast)) return false;
  }
  const tld = casti[casti.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) return false;
  return true;
}

function platnyTelefon(text) {
  if (typeof text !== "string") return false;
  const ciste = text.replace(/[\s\u00a0\-()]/g, "");
  if (ciste === "") return false;
  return /^(?:\+420|00420|\+\d{1,3})?\d{9}$/.test(ciste);
}

function srovnejDuvod(duvod) {
  return DUVODY.includes(duvod) ? duvod : "dotaz";
}

export function zkontroluj(data) {
  const d = data || {};
  const chyby = [];
  if (String(d.jmeno ?? "").trim().length < 2) chyby.push("jmeno");
  if (!platnyEmail(d.email)) chyby.push("email");
  const telefon = String(d.telefon ?? "").trim();
  if (telefon !== "" && !platnyTelefon(d.telefon)) chyby.push("telefon");
  if (String(d.zprava ?? "").trim().length < 10) chyby.push("zprava");
  return chyby;
}

function srovniMezery(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function ocisti(data) {
  const d = data || {};
  const retezec = (hodnota) => (typeof hodnota === "string" ? hodnota : "");
  return {
    jmeno: srovniMezery(retezec(d.jmeno)),
    email: srovniMezery(retezec(d.email)),
    telefon: retezec(d.telefon).replace(/[\s\u00a0-]/g, ""),
    zprava: srovniMezery(retezec(d.zprava)),
    duvod: srovnejDuvod(d.duvod),
    kDilu: srovniMezery(retezec(d.kDilu)),
  };
}

const PREDMETY = {
  cs: {
    dotaz: "Dotaz z webu",
    "na-miru": "Poptávka díla na míru",
    kurz: "Zájem o kurz",
    atelier: "Návštěva ateliéru",
  },
  en: {
    dotaz: "Website enquiry",
    "na-miru": "Commission enquiry",
    kurz: "Course enquiry",
    atelier: "Studio visit",
  },
};

export function predmet(data, jazyk) {
  const d = data || {};
  const tabulka = PREDMETY[jazyk] || PREDMETY.cs;
  const nazev = tabulka[srovnejDuvod(d.duvod)];
  const kDilu = typeof d.kDilu === "string" ? d.kDilu.trim() : "";
  return kDilu === "" ? nazev : `${nazev} — ${kDilu}`;
}

export function prazdny(duvod, kDilu) {
  return {
    jmeno: "",
    email: "",
    telefon: "",
    zprava: "",
    duvod: srovnejDuvod(duvod),
    kDilu: typeof kDilu === "string" ? kDilu : "",
  };
}
