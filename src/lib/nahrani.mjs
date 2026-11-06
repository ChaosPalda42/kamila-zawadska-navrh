// Fotky díla v administraci — kontrola souboru, pořadí a hlavní fotka.
// Čistý ES modul, bez závislostí a bez DOM. Nic nenahrává: dostane POPIS
// souboru a vrací NOVÝ stav. Soubor je { klic, nazev, typ, velikost, data }.

export const TYPY = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

export const MAX_BAJTU = 6291456; // 6 MB

const PRIPONY = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function jePlatnaVelikost(velikost) {
  return typeof velikost === "number" && Number.isFinite(velikost) && velikost > 0;
}

export function zkontroluj(soubor) {
  if (soubor === null || typeof soubor !== "object") return ["prazdny"];
  const chyby = [];
  if (!jePlatnaVelikost(soubor.velikost)) {
    chyby.push("prazdny");
  }
  const typ = typeof soubor.typ === "string" ? soubor.typ.toLowerCase() : "";
  if (!TYPY.includes(typ)) {
    chyby.push("typ");
  }
  if (jePlatnaVelikost(soubor.velikost) && soubor.velikost > MAX_BAJTU) {
    chyby.push("velikost");
  }
  return chyby;
}

export function pripona(typ) {
  if (typeof typ !== "string") return "";
  return PRIPONY[typ.toLowerCase()] ?? "";
}

export function navrhniNazev(slug, typ) {
  if (typeof slug !== "string" || slug.length === 0) return "";
  const p = pripona(typ);
  if (!p) return "";
  return `${slug}.${p}`;
}

export function zaloz(dilo) {
  const obrazek = dilo && typeof dilo.obrazek === "string" ? dilo.obrazek : "";
  if (!obrazek) return { hlavni: "", obrazky: [] };
  return {
    hlavni: obrazek,
    obrazky: [{ klic: obrazek, nazev: obrazek, typ: "", velikost: 0, data: "" }],
  };
}

function novyObrazek(soubor) {
  return {
    klic: soubor.klic,
    nazev: soubor.nazev,
    typ: soubor.typ,
    velikost: soubor.velikost,
    data: soubor.data,
  };
}

export function pridej(galerie, soubor) {
  const chyby = zkontroluj(soubor);
  if (chyby.length > 0) {
    return { galerie: { hlavni: galerie?.hlavni ?? "", obrazky: [...(galerie?.obrazky ?? [])] }, chyby };
  }
  const obrazky = [...(galerie?.obrazky ?? [])];
  const index = obrazky.findIndex((o) => o.klic === soubor.klic);
  if (index >= 0) {
    obrazky[index] = novyObrazek(soubor);
  } else {
    obrazky.push(novyObrazek(soubor));
  }
  const hlavni = obrazky.length > 0 && !obrazky.some((o) => o.klic === (galerie?.hlavni ?? ""))
    ? obrazky[0].klic
    : (galerie?.hlavni ?? "");
  return { galerie: { hlavni, obrazky }, chyby: [] };
}

export function odeber(galerie, klic) {
  const obrazky = (galerie?.obrazky ?? []).filter((o) => o.klic !== klic);
  const hlavni = obrazky.length > 0 ? (galerie?.hlavni === klic ? obrazky[0].klic : galerie.hlavni) : "";
  return { hlavni, obrazky };
}

export function nastavHlavni(galerie, klic) {
  const obrazky = [...(galerie?.obrazky ?? [])];
  if (!obrazky.some((o) => o.klic === klic)) {
    return { hlavni: galerie?.hlavni ?? "", obrazky };
  }
  return { hlavni: klic, obrazky };
}

export function posun(galerie, klic, o) {
  const obrazky = [...(galerie?.obrazky ?? [])];
  if (o !== -1 && o !== 1) return { hlavni: galerie?.hlavni ?? "", obrazky };
  const index = obrazky.findIndex((o2) => o2.klic === klic);
  const cil = index + o;
  if (index < 0 || cil < 0 || cil >= obrazky.length) {
    return { hlavni: galerie?.hlavni ?? "", obrazky };
  }
  [obrazky[index], obrazky[cil]] = [obrazky[cil], obrazky[index]];
  return { hlavni: galerie?.hlavni ?? "", obrazky };
}

export function lidskaVelikost(bajtu) {
  if (typeof bajtu !== "number" || !Number.isFinite(bajtu) || bajtu < 0) return "";
  if (bajtu < 1000) return `${Math.round(bajtu)} B`;
  if (bajtu < 1000000) return `${Math.round(bajtu / 1000)} kB`;
  const mb = (bajtu / 1000000).toFixed(1).replace(".", ",");
  return `${mb.endsWith(",0") ? mb.slice(0, -2) : mb} MB`;
}
