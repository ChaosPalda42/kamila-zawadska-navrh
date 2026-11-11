// C-012 -- events: the state in time, stepping through the details and the works of an event.
// A plain ES module, no dependencies and no DOM. The dates are "YYYY-MM-DD" strings
// compared as strings; counting the days goes through Date.UTC.

const RE_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInside(year, mesic) {
  if (!Number.isInteger(year) || !Number.isInteger(mesic) || year < 1 || mesic < 1 || mesic > 12) return 0;
  return new Date(Date.UTC(year, mesic, 0)).getUTCDate();
}

function dayOk(datum) {
  if (typeof datum !== "string") return false;
  const m = RE_DATUM.exec(datum);
  if (!m) return false;
  const year = Number(m[1]);
  const mesic = Number(m[2]);
  const day = Number(m[3]);
  if (mesic < 1 || mesic > 12) return false;
  return day >= 1 && day <= daysInside(year, mesic);
}

function items(udalosti) {
  return Array.isArray(udalosti) ? udalosti : [];
}

export function konec(udalost) {
  if (!udalost || !dayOk(udalost.od)) return "";
  const do_ = udalost.do;
  if (typeof do_ === "string" && do_ !== "" && dayOk(do_)) return do_;
  return udalost.od;
}

export function stav(udalost, dnes) {
  if (!udalost || !dayOk(udalost.od) || !dayOk(dnes)) return "bylo";
  const endDay = konec(udalost);
  if (dnes < udalost.od) return "chysta";
  if (dnes <= endDay) return "probiha";
  return "bylo";
}

export function dnuDo(udalost, dnes) {
  if (!udalost || !dayOk(udalost.od) || !dayOk(dnes)) return null;
  const [yearA, mesicA, dayA] = dnes.split("-").map(Number);
  const [yearB, mesicB, dayB] = udalost.od.split("-").map(Number);
  const difference = Date.UTC(yearB, mesicB - 1, dayB) - Date.UTC(yearA, mesicA - 1, dayA);
  return Math.round(difference / 86400000);
}

function platna(udalost) {
  return udalost && typeof udalost.id === "string" && udalost.id !== "" && dayOk(udalost.od);
}

export function poradi(udalosti, dnes) {
  const valid = items(udalosti).filter(platna);
  const pred = valid
    .filter((u) => stav(u, dnes) !== "bylo")
    .sort((a, b) => (a.od !== b.od ? (a.od < b.od ? -1 : 1) : a.id < b.id ? -1 : 1));
  const previous = valid
    .filter((u) => stav(u, dnes) === "bylo")
    .sort((a, b) => (a.od !== b.od ? (a.od > b.od ? -1 : 1) : a.id < b.id ? -1 : 1));
  return [...pred, ...previous].map((u) => u.id);
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
  for (const u of items(udalosti)) {
    if (u && u.id === id) return u;
  }
  return null;
}

export function dilaAkce(works, udalost) {
  if (!Array.isArray(works) || !udalost || typeof udalost.id !== "string" || udalost.id === "") return [];
  return works.filter((d) => d && d.album === udalost.id);
}

export function shrnuti(udalosti, dnes) {
  const result = { chysta: 0, probiha: 0, bylo: 0 };
  for (const u of items(udalosti)) {
    result[stav(u, dnes)] += 1;
  }
  return result;
}
