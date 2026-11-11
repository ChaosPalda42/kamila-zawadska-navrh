export const STAVY = Object.freeze(["v-prodeji", "zamluveno", "prodano", "neprodejne"]);

export function slug(name) {
  if (typeof name !== "string") return "";
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export function jeStav(status) {
  return STAVY.includes(status);
}

export function vGalerii(item) {
  return item != null && item.vGalerii === true;
}

export function vEshopu(item) {
  return (
    item != null &&
    item.vEshopu === true &&
    (item.stav === "v-prodeji" || item.stav === "zamluveno")
  );
}

export function lzeKoupit(item) {
  return vEshopu(item) && item.stav === "v-prodeji" && Number(item.cena) > 0;
}

export function naMiru(item) {
  return vGalerii(item) && !lzeKoupit(item);
}

function getNameForSorting(item) {
  const name = item && item.nazev;
  if (typeof name === "string") return name;
  if (name && typeof name === "object" && typeof name.cs === "string") return name.cs;
  return (item && item.slug) || "";
}

export function galerie(items) {
  return items
    .filter(vGalerii)
    .sort(
      (a, b) =>
        (b.rok || 0) - (a.rok || 0) ||
        getNameForSorting(a).localeCompare(getNameForSorting(b), "cs"),
    );
}

export function eshop(items) {
  return items
    .filter(vEshopu)
    .sort(
      (a, b) =>
        cena(a) - cena(b) ||
        getNameForSorting(a).localeCompare(getNameForSorting(b), "cs"),
    );
}

export function filtr(items, criteria) {
  const keys = ["technika", "styl", "album"];
  const active = criteria
    ? keys.filter((key) => {
        const value = criteria[key];
        return value !== undefined && value !== null && value !== "" && value !== "vse";
      })
    : [];
  return items.filter((item) =>
    active.every((key) => item[key] === criteria[key]),
  );
}

export function podleSlugu(items, slug) {
  return items.find((item) => item.slug === slug) || null;
}

export function sousedi(items, slug) {
  const empty = { predchozi: null, dalsi: null };
  if (!Array.isArray(items) || items.length < 2) return empty;
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) return empty;
  return {
    predchozi: items[(index - 1 + items.length) % items.length],
    dalsi: items[(index + 1) % items.length],
  };
}

export function pocty(items, key) {
  const result = { vse: items.length };
  if (key !== "technika" && key !== "styl" && key !== "album") return result;
  for (const item of items) {
    const value = item[key];
    if (value === undefined || value === null || value === "") continue;
    result[value] = (result[value] || 0) + 1;
  }
  return result;
}

export function cena(item) {
  const number = Number(item && item.cena);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}
