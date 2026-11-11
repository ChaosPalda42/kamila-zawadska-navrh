// Photos of a work in the administration -- checking the file, the ordering and the main photo.
// A plain ES module, no dependencies and no DOM. It uploads nothing: it is handed a
// DESCRIPTION of a file and returns a NEW state. A file is `{ klic, nazev, typ, velikost, data }`.

export const TYPY = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

export const MAX_BAJTU = 6291456; // 6 MB

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isValidSize(size) {
  return typeof size === "number" && Number.isFinite(size) && size > 0;
}

export function zkontroluj(file) {
  if (file === null || typeof file !== "object") return ["prazdny"];
  const chyby = [];
  if (!isValidSize(file.velikost)) {
    chyby.push("prazdny");
  }
  const type = typeof file.typ === "string" ? file.typ.toLowerCase() : "";
  if (!TYPY.includes(type)) {
    chyby.push("typ");
  }
  if (isValidSize(file.velikost) && file.velikost > MAX_BAJTU) {
    chyby.push("velikost");
  }
  return chyby;
}

export function pripona(type) {
  if (typeof type !== "string") return "";
  return EXTENSIONS[type.toLowerCase()] ?? "";
}

export function navrhniNazev(slug, type) {
  if (typeof slug !== "string" || slug.length === 0) return "";
  const p = pripona(type);
  if (!p) return "";
  return `${slug}.${p}`;
}

export function zaloz(work) {
  const image = work && typeof work.obrazek === "string" ? work.obrazek : "";
  if (!image) return { hlavni: "", obrazky: [] };
  return {
    hlavni: image,
    obrazky: [{ klic: image, nazev: image, typ: "", velikost: 0, data: "" }],
  };
}

function newImage(file) {
  return {
    klic: file.klic,
    nazev: file.nazev,
    typ: file.typ,
    velikost: file.velikost,
    data: file.data,
  };
}

export function pridej(gallery, file) {
  const chyby = zkontroluj(file);
  if (chyby.length > 0) {
    return { galerie: { hlavni: gallery?.hlavni ?? "", obrazky: [...(gallery?.obrazky ?? [])] }, chyby };
  }
  const obrazky = [...(gallery?.obrazky ?? [])];
  const index = obrazky.findIndex((o) => o.klic === file.klic);
  if (index >= 0) {
    obrazky[index] = newImage(file);
  } else {
    obrazky.push(newImage(file));
  }
  const hlavni = obrazky.length > 0 && !obrazky.some((o) => o.klic === (gallery?.hlavni ?? ""))
    ? obrazky[0].klic
    : (gallery?.hlavni ?? "");
  return { galerie: { hlavni, obrazky }, chyby: [] };
}

export function odeber(gallery, klic) {
  const obrazky = (gallery?.obrazky ?? []).filter((o) => o.klic !== klic);
  const hlavni = obrazky.length > 0 ? (gallery?.hlavni === klic ? obrazky[0].klic : gallery.hlavni) : "";
  return { hlavni, obrazky };
}

export function nastavHlavni(gallery, klic) {
  const obrazky = [...(gallery?.obrazky ?? [])];
  if (!obrazky.some((o) => o.klic === klic)) {
    return { hlavni: gallery?.hlavni ?? "", obrazky };
  }
  return { hlavni: klic, obrazky };
}

export function posun(gallery, klic, o) {
  const obrazky = [...(gallery?.obrazky ?? [])];
  if (o !== -1 && o !== 1) return { hlavni: gallery?.hlavni ?? "", obrazky };
  const index = obrazky.findIndex((o2) => o2.klic === klic);
  const target = index + o;
  if (index < 0 || target < 0 || target >= obrazky.length) {
    return { hlavni: gallery?.hlavni ?? "", obrazky };
  }
  [obrazky[index], obrazky[target]] = [obrazky[target], obrazky[index]];
  return { hlavni: gallery?.hlavni ?? "", obrazky };
}

export function lidskaVelikost(bajtu) {
  if (typeof bajtu !== "number" || !Number.isFinite(bajtu) || bajtu < 0) return "";
  if (bajtu < 1000) return `${Math.round(bajtu)} B`;
  if (bajtu < 1000000) return `${Math.round(bajtu / 1000)} kB`;
  const mb = (bajtu / 1000000).toFixed(1).replace(".", ",");
  return `${mb.endsWith(",0") ? mb.slice(0, -2) : mb} MB`;
}
