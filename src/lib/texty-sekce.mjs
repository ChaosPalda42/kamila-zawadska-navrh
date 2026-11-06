// C-014 — texty webu rozdělené do sekcí, hledání bez diakritiky a co se změnilo.
// Čistý ES modul bez závislostí a bez DOM.

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

const JAZYKY_VYCHOZI = ["cs", "en"];

const slovnik = (texty) => (texty && typeof texty === "object" ? texty : {});

const kliceAbecedne = (klice) => [...klice].sort();

// Normalizace pro hledání: bez diakritiky a bez ohledu na velikost písmen.
const bezDiakritiky = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function sekce(texty) {
  const t = slovnik(texty);
  const skupiny = new Map(SEKCE.map((s) => [s.id, []]));
  for (const klic of Object.keys(t)) {
    let id = "ostatni";
    for (const s of SEKCE) {
      if (s.predpony.some((p) => klic.startsWith(p))) {
        id = s.id;
        break;
      }
    }
    skupiny.get(id).push(klic);
  }
  return SEKCE.map((s) => ({ id: s.id, klice: kliceAbecedne(skupiny.get(s.id)) }));
}

export function hledej(texty, dotaz, jazyky = JAZYKY_VYCHOZI) {
  const t = slovnik(texty);
  const klice = Object.keys(t);
  const dotazNorm = bezDiakritiky(dotaz ?? "");
  if (dotazNorm.trim() === "") {
    return kliceAbecedne(klice);
  }
  const jazykyPouzit = Array.isArray(jazyky) ? jazyky : JAZYKY_VYCHOZI;
  const sedi = (klic) => {
    if (bezDiakritiky(klic).includes(dotazNorm)) {
      return true;
    }
    const hodnota = t[klic];
    return jazykyPouzit.some((j) => {
      const text = hodnota && typeof hodnota === "object" ? hodnota[j] : null;
      return typeof text === "string" && bezDiakritiky(text).includes(dotazNorm);
    });
  };
  return kliceAbecedne(klice.filter(sedi));
}

export function rozdil(puvodni, upravene) {
  const a = slovnik(puvodni);
  const b = slovnik(upravene);
  const klice = new Set([...Object.keys(a), ...Object.keys(b)]);
  const seLisi = (klic) => {
    const va = a[klic];
    const vb = b[klic];
    if (!(klic in a) || !(klic in b)) {
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
  return kliceAbecedne([...klice].filter(seLisi));
}

export function chybejici(texty, jazyky = JAZYKY_VYCHOZI) {
  const t = slovnik(texty);
  const jazykyPouzit = Array.isArray(jazyky) ? jazyky : JAZYKY_VYCHOZI;
  const isMissing = (klic) => {
    const hodnota = t[klic];
    return jazykyPouzit.some((j) => {
      const text = hodnota && typeof hodnota === "object" ? hodnota[j] : null;
      return typeof text !== "string" || text.trim() === "";
    });
  };
  return kliceAbecedne(Object.keys(t).filter(isMissing));
}
