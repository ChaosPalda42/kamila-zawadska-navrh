// C-003 — Dvojjazyčnost: slovník, záložní jazyk a cesty /en/.
// Čistý ES modul bez závislostí a bez DOM.

export const JAZYKY = Object.freeze(["cs", "en"]);

export function jazykOk(jazyk) {
  return jazyk === "cs" || jazyk === "en";
}

export function t(slovnik, klic, jazyk) {
  const polozka = slovnik ? slovnik[klic] : undefined;
  if (typeof polozka === "string") return polozka;
  if (polozka && typeof polozka === "object") {
    const hodnota = polozka[jazyk];
    if (typeof hodnota === "string" && hodnota !== "") return hodnota;
    const cs = polozka["cs"];
    if (typeof cs === "string" && cs !== "") return cs;
  }
  return klic;
}

export function pole(hodnota, jazyk) {
  if (typeof hodnota === "string") return hodnota;
  if (hodnota && typeof hodnota === "object") {
    const hodnotaJazyk = hodnota[jazyk];
    if (typeof hodnotaJazyk === "string" && hodnotaJazyk !== "") return hodnotaJazyk;
    const cs = hodnota["cs"];
    if (typeof cs === "string" && cs !== "") return cs;
  }
  return "";
}

const CESTY = {
  domu: "/",
  galerie: "/galerie/",
  eshop: "/obrazy-k-prodeji/",
  kosik: "/kosik/",
  kalendar: "/kalendar/",
  kurzy: "/kurzy/",
  bio: "/o-mne/",
  kontakt: "/kontakt/",
  administrace: "/administrace/",
};

function sPrefixem(cesta, jazyk) {
  if (jazyk !== "en") return cesta;
  if (cesta === "/") return "/en/";
  return "/en" + cesta;
}

export function cesta(klic, jazyk) {
  return sPrefixem(CESTY[klic] ?? "/", jazyk);
}

export function cestaDila(slug, jazyk) {
  if (!slug) return cesta("galerie", jazyk);
  return sPrefixem("/galerie/" + slug + "/", jazyk);
}

export function druhyJazyk(jazyk) {
  return jazyk === "cs" ? "en" : jazyk === "en" ? "cs" : "en";
}

export function prepni(cesta, jazyk) {
  let c = typeof cesta === "string" ? cesta : "";
  if (c === "/en" || c.startsWith("/en/")) c = c.slice(3);
  if (c === "") c = "/";
  if (!c.startsWith("/")) c = "/" + c;
  if (c.length > 1 && !c.endsWith("/")) c += "/";
  return sPrefixem(c, jazyk);
}

export function jazykZCesty(cesta) {
  const c = typeof cesta === "string" ? cesta : "";
  return c === "/en" || c.startsWith("/en/") ? "en" : "cs";
}
