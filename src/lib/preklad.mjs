// C-003 -- two languages: the dictionary, the fallback language and the /en/ paths.
// A plain ES module with no dependencies and no DOM.

export const JAZYKY = Object.freeze(["cs", "en"]);

export function jazykOk(language) {
  return language === "cs" || language === "en";
}

export function t(dictionary, klic, language) {
  const item = dictionary ? dictionary[klic] : undefined;
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const value = item[language];
    if (typeof value === "string" && value !== "") return value;
    const cs = item["cs"];
    if (typeof cs === "string" && cs !== "") return cs;
  }
  return klic;
}

export function pole(value, language) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const valueLanguage = value[language];
    if (typeof valueLanguage === "string" && valueLanguage !== "") return valueLanguage;
    const cs = value["cs"];
    if (typeof cs === "string" && cs !== "") return cs;
  }
  return "";
}

const PATHS = {
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

function sPrefixem(cesta, language) {
  if (language !== "en") return cesta;
  if (cesta === "/") return "/en/";
  return "/en" + cesta;
}

export function cesta(klic, language) {
  return sPrefixem(PATHS[klic] ?? "/", language);
}

export function cestaDila(slug, language) {
  if (!slug) return cesta("galerie", language);
  return sPrefixem("/galerie/" + slug + "/", language);
}

export function druhyJazyk(language) {
  return language === "cs" ? "en" : language === "en" ? "cs" : "en";
}

export function prepni(cesta, language) {
  let c = typeof cesta === "string" ? cesta : "";
  if (c === "/en" || c.startsWith("/en/")) c = c.slice(3);
  if (c === "") c = "/";
  if (!c.startsWith("/")) c = "/" + c;
  if (c.length > 1 && !c.endsWith("/")) c += "/";
  return sPrefixem(c, language);
}

export function jazykZCesty(cesta) {
  const c = typeof cesta === "string" ? cesta : "";
  return c === "/en" || c.startsWith("/en/") ? "en" : "cs";
}
