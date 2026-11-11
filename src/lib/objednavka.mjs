// C-005 -- the order: checking the details, the delivery rules, the summary.
// A plain ES module with no dependencies and no DOM. It returns the keys of the error
// messages (the texts live in `data/texty.json` under `formular.chyba.*`).

const KLCI = ["jmeno", "email", "telefon", "ulice", "mesto", "psc", "zprava", "doprava"];

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

export function platnyTelefon(text) {
  if (typeof text !== "string") return false;
  const ciste = text.replace(/[\s\u00a0\-()]/g, "");
  if (ciste === "") return false;
  return /^(?:\+420|00420|\+\d{1,3})?\d{9}$/.test(ciste);
}

export function platnePsc(text) {
  if (typeof text !== "string") return false;
  return /^\d{5}$/.test(text.replace(/\s/g, ""));
}

export function zkontroluj(data) {
  const d = data || {};
  const errors = [];
  if (String(d.jmeno ?? "").trim().length < 2) errors.push("jmeno");
  if (!platnyEmail(d.email)) errors.push("email");
  if (!platnyTelefon(d.telefon)) errors.push("telefon");
  const doprava = d.doprava;
  const validShipping = doprava === "dobirka" || doprava === "osobne";
  if (!validShipping) errors.push("doprava");
  if (doprava === "dobirka") {
    if (String(d.ulice ?? "").trim() === "") errors.push("ulice");
    if (String(d.mesto ?? "").trim() === "") errors.push("mesto");
    if (!platnePsc(d.psc)) errors.push("psc");
  }
  return errors;
}

function srovniMezery(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function ocisti(data) {
  const d = data || {};
  const result = {};
  for (const key of KLCI) {
    const value = d[key];
    const text = typeof value === "string" ? value : "";
    if (key === "psc") {
      result[key] = text.replace(/\s/g, "");
    } else if (key === "telefon") {
      result[key] = text.replace(/[\s\u00a0-]/g, "");
    } else {
      result[key] = srovniMezery(text);
    }
  }
  return result;
}

function nameForLanguage(name, language) {
  if (name && typeof name === "object") {
    const j = language === "en" ? "en" : "cs";
    if (typeof name[j] === "string") return name[j];
    if (typeof name.cs === "string") return name.cs;
  }
  return "";
}

export function rekapitulace(cart, dila, zpusoby, language) {
  const k = cart || {};
  const worksMap = new Map((dila || []).map((d) => [d.slug, d]));
  const methodsMap = new Map((zpusoby || []).map((z) => [z.id, z]));

  const polozky = [];
  let worksTotal = 0;
  for (const item of k.polozky || []) {
    const work = worksMap.get(item.slug);
    if (!work) continue;
    polozky.push({
      slug: work.slug,
      nazev: nameForLanguage(work.nazev, language),
      rozmer: work.rozmer ?? "",
      cena: work.cena ?? 0,
    });
    worksTotal += work.cena ?? 0;
  }

  let doprava = null;
  const method = methodsMap.get(k.doprava);
  if (method) {
    doprava = {
      id: method.id,
      nazev: nameForLanguage(method.nazev, language),
      cena: method.cena ?? 0,
    };
  }

  return {
    polozky,
    dila: worksTotal,
    doprava,
    celkem: worksTotal + (doprava ? doprava.cena : 0),
  };
}
