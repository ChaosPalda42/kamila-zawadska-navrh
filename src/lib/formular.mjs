// C-006 -- the contact form and the enquiry for a commissioned work.
// A plain ES module with no dependencies and no DOM. It returns the keys of the error
// messages (the texts live in `data/texty.json` under `formular.chyba.*`).

export const DUVODY = Object.freeze(["dotaz", "na-miru", "kurz", "atelier"]);

export function platnyEmail(text) {
  if (typeof text !== "string") return false;
  if (text.includes(" ") || text.includes("\t") || text.includes("\n")) return false;
  const at = text.indexOf("@");
  if (at === -1 || at !== text.lastIndexOf("@")) return false;
  const lokalni = text.slice(0, at);
  const domena = text.slice(at + 1);
  if (lokalni.length < 1) return false;
  const parts = domena.split(".");
  if (parts.length < 2) return false;
  for (const cast of parts) {
    if (cast.length === 0 || /\s/.test(cast)) return false;
  }
  const tld = parts[parts.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) return false;
  return true;
}

function validPhone(text) {
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
  const errors = [];
  if (String(d.jmeno ?? "").trim().length < 2) errors.push("jmeno");
  if (!platnyEmail(d.email)) errors.push("email");
  const phone = String(d.telefon ?? "").trim();
  if (phone !== "" && !validPhone(d.telefon)) errors.push("telefon");
  if (String(d.zprava ?? "").trim().length < 10) errors.push("zprava");
  return errors;
}

function srovniMezery(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function ocisti(data) {
  const d = data || {};
  const string = (value) => (typeof value === "string" ? value : "");
  return {
    jmeno: srovniMezery(string(d.jmeno)),
    email: srovniMezery(string(d.email)),
    telefon: string(d.telefon).replace(/[\s\u00a0-]/g, ""),
    zprava: srovniMezery(string(d.zprava)),
    duvod: srovnejDuvod(d.duvod),
    kDilu: srovniMezery(string(d.kDilu)),
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

export function predmet(data, language) {
  const d = data || {};
  const tabulka = PREDMETY[language] || PREDMETY.cs;
  const name = tabulka[srovnejDuvod(d.duvod)];
  const kDilu = typeof d.kDilu === "string" ? d.kDilu.trim() : "";
  return kDilu === "" ? name : `${name} — ${kDilu}`;
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
