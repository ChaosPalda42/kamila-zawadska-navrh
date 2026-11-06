// Košík e-shopu. Každé dílo je originál — do košíku se vejde nejvýš jednou.
// Čistý ES modul, bez závislostí a bez DOM.

const DOVOLENA_DOPRAVA = new Set(["", "dobirka", "osobne"]);

function jeKosik(x) {
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

function jePlatnaCena(cena) {
  return typeof cena === "number" && Number.isFinite(cena) && cena > 0;
}

export function prazdny() {
  return { polozky: [], doprava: "" };
}

export function pridej(kosik, dilo) {
  if (!jeKosik(kosik) || dilo === null || typeof dilo !== "object") {
    return { polozky: [...kosik?.polozky ?? []], doprava: kosik?.doprava ?? "" };
  }
  if (
    !jePlatnySlug(dilo.slug) ||
    dilo.stav !== "v-prodeji" ||
    !jePlatnaCena(dilo.cena) ||
    kosik.polozky.some((p) => p.slug === dilo.slug)
  ) {
    return { polozky: [...kosik.polozky], doprava: kosik.doprava };
  }
  return {
    polozky: [...kosik.polozky, { slug: dilo.slug, cena: Math.trunc(dilo.cena) }],
    doprava: kosik.doprava,
  };
}

export function uber(kosik, slug) {
  if (!jeKosik(kosik)) return prazdny();
  return {
    polozky: kosik.polozky.filter((p) => p.slug !== slug),
    doprava: kosik.doprava,
  };
}

export function obsahuje(kosik, slug) {
  if (!jeKosik(kosik)) return false;
  return kosik.polozky.some((p) => p.slug === slug);
}

export function pocet(kosik) {
  if (!jeKosik(kosik)) return 0;
  return kosik.polozky.length;
}

export function cenaDila(kosik) {
  if (!jeKosik(kosik)) return 0;
  return kosik.polozky.reduce((soucet, p) => soucet + (jePlatnaCena(p.cena) ? p.cena : 0), 0);
}

export function cenaDopravy(kosik, zpusoby) {
  if (!jeKosik(kosik) || !kosik.doprava) return 0;
  if (!Array.isArray(zpusoby)) return 0;
  const zpusob = zpusoby.find((z) => z && z.id === kosik.doprava);
  if (!zpusob || !Number.isFinite(zpusob.cena)) return 0;
  return zpusob.cena;
}

export function soucet(kosik, zpusoby) {
  const dila = cenaDila(kosik);
  const doprava = cenaDopravy(kosik, zpusoby);
  return { dila, doprava, celkem: dila + doprava, pocet: pocet(kosik) };
}

export function nastavDopravu(kosik, id) {
  const doprava = DOVOLENA_DOPRAVA.has(id) ? id : "";
  return { polozky: [...(kosik?.polozky ?? [])], doprava };
}

export function prober(kosik, dila) {
  const seznam = Array.isArray(dila) ? dila : [];
  const polozky = [];
  const odebrane = [];
  for (const p of kosik?.polozky ?? []) {
    const dilo = seznam.find((d) => d && d.slug === p?.slug);
    if (!dilo || dilo.stav !== "v-prodeji" || !jePlatnaCena(dilo.cena)) {
      if (jePlatnySlug(p?.slug)) odebrane.push(p.slug);
      continue;
    }
    polozky.push({ slug: dilo.slug, cena: Math.trunc(dilo.cena) });
  }
  return {
    kosik: { polozky, doprava: jeKosik(kosik) ? kosik.doprava : "" },
    odebrane,
  };
}

export function naKod(kosik) {
  const k = jeKosik(kosik) ? kosik : prazdny();
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
  if (!jeKosik(data)) return prazdny();
  const polozky = [];
  for (const p of data.polozky) {
    if (p !== null && typeof p === "object" && !Array.isArray(p) && jePlatnySlug(p.slug) && jePlatnaCena(p.cena)) {
      polozky.push({ slug: p.slug, cena: Math.trunc(p.cena) });
    }
  }
  const doprava = DOVOLENA_DOPRAVA.has(data.doprava) ? data.doprava : "";
  return { polozky, doprava };
}
