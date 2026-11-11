// C-014 -- the site texts split into sections, searching without diacritics and what changed.
// A plain ES module with no dependencies and no DOM.

const ZAMRAZENY = (obj) => Object.freeze(obj);

export const SEKCE = ZAMRAZENY([
  { id: "uvod", predpony: ["uvod."] },
  { id: "galerie", predpony: ["galerie.", "stav."] },
  { id: "eshop", predpony: ["eshop.", "kosik.", "objednavka."] },
  { id: "kalendar", predpony: ["kalendar."] },
  { id: "kurzy", predpony: ["kurzy."] },
  { id: "bio", predpony: ["bio."] },
  { id: "kontakt", predpony: ["kontakt.", "formular."] },
  { id: "navigace", predpony: ["nav.", "patka."] },
  { id: "ostatni", predpony: [] },
].map(ZAMRAZENY));

const LANGUAGES_DEFAULT = ["cs", "en"];

const dictionary = (texts) => (texts && typeof texts === "object" ? texts : {});

const keysAlphabetical = (keys) => [...keys].sort();

// Normalization for searching: without diacritics and regardless of letter case.
const withoutDiacritics = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function sekce(texts) {
  const t = dictionary(texts);
  const groups = new Map(SEKCE.map((s) => [s.id, []]));
  for (const key of Object.keys(t)) {
    let id = "ostatni";
    for (const s of SEKCE) {
      if (s.predpony.some((p) => key.startsWith(p))) {
        id = s.id;
        break;
      }
    }
    groups.get(id).push(key);
  }
  return SEKCE.map((s) => ({ id: s.id, klice: keysAlphabetical(groups.get(s.id)) }));
}

export function hledej(texts, dotaz, jazyky = LANGUAGES_DEFAULT) {
  const t = dictionary(texts);
  const keys = Object.keys(t);
  const queryNormalize = withoutDiacritics(dotaz ?? "");
  if (queryNormalize.trim() === "") {
    return keysAlphabetical(keys);
  }
  const languagesUsed = Array.isArray(jazyky) ? jazyky : LANGUAGES_DEFAULT;
  const sedi = (key) => {
    if (withoutDiacritics(key).includes(queryNormalize)) {
      return true;
    }
    const value = t[key];
    return languagesUsed.some((j) => {
      const text = value && typeof value === "object" ? value[j] : null;
      return typeof text === "string" && withoutDiacritics(text).includes(queryNormalize);
    });
  };
  return keysAlphabetical(keys.filter(sedi));
}

export function rozdil(puvodni, upravene) {
  const a = dictionary(puvodni);
  const b = dictionary(upravene);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const seLisi = (key) => {
    const va = a[key];
    const vb = b[key];
    if (!(key in a) || !(key in b)) {
      return true;
    }
    const jazyky = new Set([
      ...Object.keys(va && typeof va === "object" ? va : {}),
      ...Object.keys(vb && typeof vb === "object" ? vb : {}),
    ]);
    for (const j of jazyky) {
      if (String(va[j] ?? "") !== String(vb[j] ?? "")) {
        return true;
      }
    }
    return false;
  };
  return keysAlphabetical([...keys].filter(seLisi));
}

export function chybejici(texts, jazyky = LANGUAGES_DEFAULT) {
  const t = dictionary(texts);
  const languagesUsed = Array.isArray(jazyky) ? jazyky : LANGUAGES_DEFAULT;
  const isMissing = (key) => {
    const value = t[key];
    return languagesUsed.some((j) => {
      const text = value && typeof value === "object" ? value[j] : null;
      return typeof text !== "string" || text.trim() === "";
    });
  };
  return keysAlphabetical(Object.keys(t).filter(isMissing));
}
