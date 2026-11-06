// C-012 — Akce: stav v čase, procházení detailů a díla patřící k akci.
// Čistý ES modul, bez závislostí a bez DOM. Data jsou řetězce "RRRR-MM-DD"
// a porovnávají se řetězcově; přepočet dnů jde přes Date.UTC.

const RE_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

function dnuVnitr(rok, mesic) {
  if (!Number.isInteger(rok) || !Number.isInteger(mesic) || rok < 1 || mesic < 1 || mesic > 12) return 0;
  return new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
}

function denOk(datum) {
  if (typeof datum !== "string") return false;
  const m = RE_DATUM.exec(datum);
  if (!m) return false;
  const rok = Number(m[1]);
  const mesic = Number(m[2]);
  const den = Number(m[3]);
  if (mesic < 1 || mesic > 12) return false;
  return den >= 1 && den <= dnuVnitr(rok, mesic);
}

function seznam(udalosti) {
  return Array.isArray(udalosti) ? udalosti : [];
}

export function konec(udalost) {
  if (!udalost || !denOk(udalost.od)) return "";
  const do_ = udalost.do;
  if (typeof do_ === "string" && do_ !== "" && denOk(do_)) return do_;
  return udalost.od;
}

export function stav(udalost, dnes) {
  if (!udalost || !denOk(udalost.od) || !denOk(dnes)) return "bylo";
  const konecDen = konec(udalost);
  if (dnes < udalost.od) return "chysta";
  if (dnes <= konecDen) return "probiha";
  return "bylo";
}

export function dnuDo(udalost, dnes) {
  if (!udalost || !denOk(udalost.od) || !denOk(dnes)) return null;
  const [rokA, mesicA, denA] = dnes.split("-").map(Number);
  const [rokB, mesicB, denB] = udalost.od.split("-").map(Number);
  const rozdil = Date.UTC(rokB, mesicB - 1, denB) - Date.UTC(rokA, mesicA - 1, denA);
  return Math.round(rozdil / 86400000);
}

function platna(udalost) {
  return udalost && typeof udalost.id === "string" && udalost.id !== "" && denOk(udalost.od);
}

export function poradi(udalosti, dnes) {
  const platne = seznam(udalosti).filter(platna);
  const pred = platne
    .filter((u) => stav(u, dnes) !== "bylo")
    .sort((a, b) => (a.od !== b.od ? (a.od < b.od ? -1 : 1) : a.id < b.id ? -1 : 1));
  const minule = platne
    .filter((u) => stav(u, dnes) === "bylo")
    .sort((a, b) => (a.od !== b.od ? (a.od > b.od ? -1 : 1) : a.id < b.id ? -1 : 1));
  return [...pred, ...minule].map((u) => u.id);
}

export function sousedi(udalosti, dnes, id) {
  const rad = poradi(udalosti, dnes);
  const i = rad.indexOf(id);
  if (i === -1) return { predchozi: null, dalsi: null };
  return {
    predchozi: i > 0 ? rad[i - 1] : null,
    dalsi: i < rad.length - 1 ? rad[i + 1] : null,
  };
}

export function podleId(udalosti, id) {
  for (const u of seznam(udalosti)) {
    if (u && u.id === id) return u;
  }
  return null;
}

export function dilaAkce(dila, udalost) {
  if (!Array.isArray(dila) || !udalost || typeof udalost.id !== "string" || udalost.id === "") return [];
  return dila.filter((d) => d && d.album === udalost.id);
}

export function shrnuti(udalosti, dnes) {
  const vysledek = { chysta: 0, probiha: 0, bylo: 0 };
  for (const u of seznam(udalosti)) {
    vysledek[stav(u, dnes)] += 1;
  }
  return vysledek;
}
