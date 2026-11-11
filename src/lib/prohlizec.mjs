// C-008 -- the full screen viewer: the index, stepping around in a loop, the keys,
// preloading the neighbours. Pure logic with no DOM; opening and closing is the DOM layer's.

function isArray(slugs) {
  return Array.isArray(slugs);
}

function zabal(index, celkem) {
  return ((index % celkem) + celkem) % celkem;
}

export function zaloz(slugs, slug) {
  if (!isArray(slugs)) {
    return { slugy: [], index: 0, otevreno: false };
  }
  const copy = [...slugs];
  const index = copy.indexOf(slug);
  return { slugy: copy, index: index === -1 ? 0 : index, otevreno: false };
}

export function otevri(state, slug) {
  if (!isArray(state.slugy) || state.slugy.length === 0) {
    return { ...state, index: 0, otevreno: false };
  }
  const index = state.slugy.indexOf(slug);
  if (index === -1) {
    return { ...state, index: 0, otevreno: false };
  }
  return { ...state, index, otevreno: true };
}

export function zavri(state) {
  return { ...state, otevreno: false };
}

export function dalsi(state) {
  const celkem = isArray(state.slugy) ? state.slugy.length : 0;
  if (celkem === 0) {
    return { ...state, index: 0 };
  }
  return { ...state, index: zabal(state.index + 1, celkem) };
}

export function predchozi(state) {
  const celkem = isArray(state.slugy) ? state.slugy.length : 0;
  if (celkem === 0) {
    return { ...state, index: 0 };
  }
  return { ...state, index: zabal(state.index - 1, celkem) };
}

export function skoc(state, index) {
  if (!Number.isInteger(index)) {
    return { ...state };
  }
  const celkem = isArray(state.slugy) ? state.slugy.length : 0;
  if (celkem === 0) {
    return { ...state, index: 0 };
  }
  return { ...state, index: zabal(index, celkem) };
}

export function aktualni(state) {
  if (!isArray(state.slugy) || state.slugy.length === 0) {
    return null;
  }
  return state.slugy[zabal(state.index, state.slugy.length)] ?? null;
}

export function okoli(state) {
  if (!isArray(state.slugy) || state.slugy.length === 0) {
    return { predchozi: null, dalsi: null };
  }
  const celkem = state.slugy.length;
  return {
    predchozi: state.slugy[zabal(state.index - 1, celkem)],
    dalsi: state.slugy[zabal(state.index + 1, celkem)],
  };
}

const DALSI = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "n"]);
const PREVIOUS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "p"]);

export function klavesa(code) {
  if (typeof code !== "string") {
    return "";
  }
  if (code === "Escape") {
    return "zavri";
  }
  const malinko = code.length === 1 ? code.toLowerCase() : code;
  if (DALSI.has(malinko)) {
    return "dalsi";
  }
  if (PREVIOUS.has(malinko)) {
    return "predchozi";
  }
  return "";
}

export function pozice(state) {
  if (!isArray(state.slugy) || state.slugy.length === 0) {
    return { cislo: 0, celkem: 0 };
  }
  return { cislo: zabal(state.index, state.slugy.length) + 1, celkem: state.slugy.length };
}
