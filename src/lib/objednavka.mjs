// C-005 — Objednávka: validace údajů, pravidla dopravy, rekapitulace.
// Čistý ES modul bez závislostí a bez DOM. Vrací klíče chybových hlášek
// (texty žijí v data/texty.json pod "formular.chyba.*").

const KLCI = ["jmeno", "email", "telefon", "ulice", "mesto", "psc", "zprava", "doprava"];

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
  const chyby = [];
  if (String(d.jmeno ?? "").trim().length < 2) chyby.push("jmeno");
  if (!platnyEmail(d.email)) chyby.push("email");
  if (!platnyTelefon(d.telefon)) chyby.push("telefon");
  const doprava = d.doprava;
  const platnaDoprava = doprava === "dobirka" || doprava === "osobne";
  if (!platnaDoprava) chyby.push("doprava");
  if (doprava === "dobirka") {
    if (String(d.ulice ?? "").trim() === "") chyby.push("ulice");
    if (String(d.mesto ?? "").trim() === "") chyby.push("mesto");
    if (!platnePsc(d.psc)) chyby.push("psc");
  }
  return chyby;
}

function srovniMezery(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function ocisti(data) {
  const d = data || {};
  const vysledek = {};
  for (const klic of KLCI) {
    const hodnota = d[klic];
    const text = typeof hodnota === "string" ? hodnota : "";
    if (klic === "psc") {
      vysledek[klic] = text.replace(/\s/g, "");
    } else if (klic === "telefon") {
      vysledek[klic] = text.replace(/[\s\u00a0-]/g, "");
    } else {
      vysledek[klic] = srovniMezery(text);
    }
  }
  return vysledek;
}

function nazevProJazyk(nazev, jazyk) {
  if (nazev && typeof nazev === "object") {
    const j = jazyk === "en" ? "en" : "cs";
    if (typeof nazev[j] === "string") return nazev[j];
    if (typeof nazev.cs === "string") return nazev.cs;
  }
  return "";
}

export function rekapitulace(kosik, dila, zpusoby, jazyk) {
  const k = kosik || {};
  const dilaMap = new Map((dila || []).map((d) => [d.slug, d]));
  const zpusobyMap = new Map((zpusoby || []).map((z) => [z.id, z]));

  const polozky = [];
  let dilaSoucet = 0;
  for (const polozka of k.polozky || []) {
    const dilo = dilaMap.get(polozka.slug);
    if (!dilo) continue;
    polozky.push({
      slug: dilo.slug,
      nazev: nazevProJazyk(dilo.nazev, jazyk),
      rozmer: dilo.rozmer ?? "",
      cena: dilo.cena ?? 0,
    });
    dilaSoucet += dilo.cena ?? 0;
  }

  let doprava = null;
  const zpusob = zpusobyMap.get(k.doprava);
  if (zpusob) {
    doprava = {
      id: zpusob.id,
      nazev: nazevProJazyk(zpusob.nazev, jazyk),
      cena: zpusob.cena ?? 0,
    };
  }

  return {
    polozky,
    dila: dilaSoucet,
    doprava,
    celkem: dilaSoucet + (doprava ? doprava.cena : 0),
  };
}
