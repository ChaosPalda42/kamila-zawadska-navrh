// C-001 — díla: slug, řazení, filtry, stavy, viditelnost v galerii a e-shopu.
// Čistý ES modul bez závislostí a bez DOM; data chodí parametrem.

export const STAVY = Object.freeze(["v-prodeji", "zamluveno", "prodano", "neprodejne"]);

export function slug(nazev) {
  if (typeof nazev !== "string") return "";
  return (
    nazev
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export function jeStav(stav) {
  return STAVY.includes(stav);
}

export function vGalerii(dilo) {
  return dilo != null && dilo.vGalerii === true;
}

export function vEshopu(dilo) {
  return (
    dilo != null &&
    dilo.vEshopu === true &&
    (dilo.stav === "v-prodeji" || dilo.stav === "zamluveno")
  );
}

export function lzeKoupit(dilo) {
  return vEshopu(dilo) && dilo.stav === "v-prodeji" && Number(dilo.cena) > 0;
}

export function naMiru(dilo) {
  return vGalerii(dilo) && !lzeKoupit(dilo);
}

function nazevProRazeni(dilo) {
  const nazev = dilo && dilo.nazev;
  if (typeof nazev === "string") return nazev;
  if (nazev && typeof nazev === "object" && typeof nazev.cs === "string") return nazev.cs;
  return (dilo && dilo.slug) || "";
}

export function galerie(dila) {
  return dila
    .filter(vGalerii)
    .sort(
      (a, b) =>
        (b.rok || 0) - (a.rok || 0) ||
        nazevProRazeni(a).localeCompare(nazevProRazeni(b), "cs"),
    );
}

export function eshop(dila) {
  return dila
    .filter(vEshopu)
    .sort(
      (a, b) =>
        cena(a) - cena(b) ||
        nazevProRazeni(a).localeCompare(nazevProRazeni(b), "cs"),
    );
}

export function filtr(dila, kde) {
  const klucove = ["technika", "styl", "album"];
  const aktivni = kde
    ? klucove.filter((klic) => {
        const hodnota = kde[klic];
        return hodnota !== undefined && hodnota !== null && hodnota !== "" && hodnota !== "vse";
      })
    : [];
  return dila.filter((dilo) =>
    aktivni.every((klic) => dilo[klic] === kde[klic]),
  );
}

export function podleSlugu(dila, slug) {
  return dila.find((dilo) => dilo.slug === slug) || null;
}

export function sousedi(dila, slug) {
  const nic = { predchozi: null, dalsi: null };
  if (!Array.isArray(dila) || dila.length < 2) return nic;
  const index = dila.findIndex((dilo) => dilo.slug === slug);
  if (index === -1) return nic;
  return {
    predchozi: dila[(index - 1 + dila.length) % dila.length],
    dalsi: dila[(index + 1) % dila.length],
  };
}

export function pocty(dila, klic) {
  const vysledek = { vse: dila.length };
  if (klic !== "technika" && klic !== "styl" && klic !== "album") return vysledek;
  for (const dilo of dila) {
    const hodnota = dilo[klic];
    if (hodnota === undefined || hodnota === null || hodnota === "") continue;
    vysledek[hodnota] = (vysledek[hodnota] || 0) + 1;
  }
  return vysledek;
}

export function cena(dilo) {
  const cislo = Number(dilo && dilo.cena);
  if (!Number.isFinite(cislo) || cislo < 0) return 0;
  return Math.floor(cislo);
}
