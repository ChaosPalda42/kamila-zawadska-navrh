// The shop basket. Every work is one of a kind -- it fits in the basket at most once.
// A plain ES module, no dependencies and no DOM.

const ALLOWED_SHIPPING = new Set(["", "dobirka", "osobne"]);

function isCart(x) {
  return (
    x !== null &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    Array.isArray(x.polozky) &&
    typeof x.doprava === "string"
  );
}

function jePlatnySlug(slug) {
  return typeof slug === "string" && slug.length > 0;
}

function isValidPrice(price) {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

export function prazdny() {
  return { polozky: [], doprava: "" };
}

export function pridej(cart, work) {
  if (!isCart(cart) || work === null || typeof work !== "object") {
    return { polozky: [...cart?.polozky ?? []], doprava: cart?.doprava ?? "" };
  }
  if (
    !jePlatnySlug(work.slug) ||
    work.stav !== "v-prodeji" ||
    !isValidPrice(work.cena) ||
    cart.polozky.some((p) => p.slug === work.slug)
  ) {
    return { polozky: [...cart.polozky], doprava: cart.doprava };
  }
  return {
    polozky: [...cart.polozky, { slug: work.slug, cena: Math.trunc(work.cena) }],
    doprava: cart.doprava,
  };
}

export function uber(cart, slug) {
  if (!isCart(cart)) return prazdny();
  return {
    polozky: cart.polozky.filter((p) => p.slug !== slug),
    doprava: cart.doprava,
  };
}

export function obsahuje(cart, slug) {
  if (!isCart(cart)) return false;
  return cart.polozky.some((p) => p.slug === slug);
}

export function pocet(cart) {
  if (!isCart(cart)) return 0;
  return cart.polozky.length;
}

export function cenaDila(cart) {
  if (!isCart(cart)) return 0;
  return cart.polozky.reduce((soucet, p) => soucet + (isValidPrice(p.cena) ? p.cena : 0), 0);
}

export function cenaDopravy(cart, methods) {
  if (!isCart(cart) || !cart.doprava) return 0;
  if (!Array.isArray(methods)) return 0;
  const method = methods.find((z) => z && z.id === cart.doprava);
  if (!method || !Number.isFinite(method.cena)) return 0;
  return method.cena;
}

export function soucet(cart, methods) {
  const dila = cenaDila(cart);
  const doprava = cenaDopravy(cart, methods);
  return { dila, doprava, celkem: dila + doprava, pocet: pocet(cart) };
}

export function nastavDopravu(cart, id) {
  const doprava = ALLOWED_SHIPPING.has(id) ? id : "";
  return { polozky: [...(cart?.polozky ?? [])], doprava };
}

export function prober(cart, dila) {
  const items = Array.isArray(dila) ? dila : [];
  const polozky = [];
  const odebrane = [];
  for (const p of cart?.polozky ?? []) {
    const work = items.find((d) => d && d.slug === p?.slug);
    if (!work || work.stav !== "v-prodeji" || !isValidPrice(work.cena)) {
      if (jePlatnySlug(p?.slug)) odebrane.push(p.slug);
      continue;
    }
    polozky.push({ slug: work.slug, cena: Math.trunc(work.cena) });
  }
  return {
    kosik: { polozky, doprava: isCart(cart) ? cart.doprava : "" },
    odebrane,
  };
}

export function naKod(cart) {
  const k = isCart(cart) ? cart : prazdny();
  return JSON.stringify({ polozky: k.polozky, doprava: k.doprava });
}

export function zKodu(text) {
  if (typeof text !== "string") return prazdny();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return prazdny();
  }
  if (!isCart(data)) return prazdny();
  const polozky = [];
  for (const p of data.polozky) {
    if (p !== null && typeof p === "object" && !Array.isArray(p) && jePlatnySlug(p.slug) && isValidPrice(p.cena)) {
      polozky.push({ slug: p.slug, cena: Math.trunc(p.cena) });
    }
  }
  const doprava = ALLOWED_SHIPPING.has(data.doprava) ? data.doprava : "";
  return { polozky, doprava };
}
