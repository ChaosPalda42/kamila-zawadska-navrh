// C-008 — Prohlížeč na celou obrazovku: index, přepínání dokola, klávesy,
// přednačtení sousedů. Čistá logika bez DOM; otevírání/zavírání dělá DOM vrstva.

function jePole(slugy) {
  return Array.isArray(slugy);
}

function zabal(index, celkem) {
  return ((index % celkem) + celkem) % celkem;
}

export function zaloz(slugy, slug) {
  if (!jePole(slugy)) {
    return { slugy: [], index: 0, otevreno: false };
  }
  const kopie = [...slugy];
  const index = kopie.indexOf(slug);
  return { slugy: kopie, index: index === -1 ? 0 : index, otevreno: false };
}

export function otevri(stav, slug) {
  if (!jePole(stav.slugy) || stav.slugy.length === 0) {
    return { ...stav, index: 0, otevreno: false };
  }
  const index = stav.slugy.indexOf(slug);
  if (index === -1) {
    return { ...stav, index: 0, otevreno: false };
  }
  return { ...stav, index, otevreno: true };
}

export function zavri(stav) {
  return { ...stav, otevreno: false };
}

export function dalsi(stav) {
  const celkem = jePole(stav.slugy) ? stav.slugy.length : 0;
  if (celkem === 0) {
    return { ...stav, index: 0 };
  }
  return { ...stav, index: zabal(stav.index + 1, celkem) };
}

export function predchozi(stav) {
  const celkem = jePole(stav.slugy) ? stav.slugy.length : 0;
  if (celkem === 0) {
    return { ...stav, index: 0 };
  }
  return { ...stav, index: zabal(stav.index - 1, celkem) };
}

export function skoc(stav, index) {
  if (!Number.isInteger(index)) {
    return { ...stav };
  }
  const celkem = jePole(stav.slugy) ? stav.slugy.length : 0;
  if (celkem === 0) {
    return { ...stav, index: 0 };
  }
  return { ...stav, index: zabal(index, celkem) };
}

export function aktualni(stav) {
  if (!jePole(stav.slugy) || stav.slugy.length === 0) {
    return null;
  }
  return stav.slugy[zabal(stav.index, stav.slugy.length)] ?? null;
}

export function okoli(stav) {
  if (!jePole(stav.slugy) || stav.slugy.length === 0) {
    return { predchozi: null, dalsi: null };
  }
  const celkem = stav.slugy.length;
  return {
    predchozi: stav.slugy[zabal(stav.index - 1, celkem)],
    dalsi: stav.slugy[zabal(stav.index + 1, celkem)],
  };
}

const DALSI = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "n"]);
const PREDCHOZI = new Set(["ArrowLeft", "ArrowUp", "PageUp", "p"]);

export function klavesa(kod) {
  if (typeof kod !== "string") {
    return "";
  }
  if (kod === "Escape") {
    return "zavri";
  }
  const malinko = kod.length === 1 ? kod.toLowerCase() : kod;
  if (DALSI.has(malinko)) {
    return "dalsi";
  }
  if (PREDCHOZI.has(malinko)) {
    return "predchozi";
  }
  return "";
}

export function pozice(stav) {
  if (!jePole(stav.slugy) || stav.slugy.length === 0) {
    return { cislo: 0, celkem: 0 };
  }
  return { cislo: zabal(stav.index, stav.slugy.length) + 1, celkem: stav.slugy.length };
}
