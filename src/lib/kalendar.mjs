// C-004 -- the events calendar: the month grid, events on days, upcoming/past, rotating news.
// A plain ES module, no dependencies and no DOM. The dates are "YYYY-MM-DD" strings.

const RE_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function jeCeloe( x ) {
  return Number.isInteger(x);
}

function daysInside(rok, mesic) {
  if (!jeCeloe(rok) || !jeCeloe(mesic) || rok < 1 || mesic < 1 || mesic > 12) return 0;
  return new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
}

export function dnu(rok, mesic) {
  return daysInside(rok, mesic);
}

export function denOk(datum) {
  if (typeof datum !== "string") return false;
  const m = RE_DATUM.exec(datum);
  if (!m) return false;
  const rok = Number(m[1]);
  const mesic = Number(m[2]);
  const den = Number(m[3]);
  if (mesic < 1 || mesic > 12) return false;
  return den >= 1 && den <= daysInside(rok, mesic);
}

export function denVTydnu(datum) {
  if (!denOk(datum)) return -1;
  const [rok, mesic, den] = datum.split("-").map(Number);
  const d = new Date(Date.UTC(rok, mesic - 1, den)).getUTCDay(); // 0 = Sunday
  return (d + 6) % 7; // 0 = Monday ... 6 = Sunday
}

function eventEnd(u) {
  return (u && typeof u.do === "string" && u.do !== "") ? u.do : (u ? u.od : "");
}

export function vRozsahu(udalost, datum) {
  if (!udalost || !denOk(datum)) return false;
  const od = udalost.od;
  if (!denOk(od)) return false;
  const do_ = eventEnd(udalost);
  if (do_ === od) return datum === od;
  if (!denOk(do_)) return false;
  return datum >= od && datum <= do_;
}

export function mesic(rok, mesicCislo, udalosti) {
  const daysInMonth = daysInside(rok, mesicCislo);
  const items = Array.isArray(udalosti) ? udalosti : [];
  const start = denVTydnu(`${rok}-${String(mesicCislo).padStart(2, "0")}-01`);
  const tydny = [];
  let i = 0;
  while (i < start + daysInMonth) {
    const week = [];
    for (let c = 0; c < 7; c++) {
      const den = i + c - start + 1;
      if (den >= 1 && den <= daysInMonth) {
        const datum = `${rok}-${String(mesicCislo).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
        week.push({
          datum,
          den,
          dnesni: false,
          udalosti: items.filter((u) => vRozsahu(u, datum)).map((u) => u.id),
        });
      } else {
        week.push(null);
      }
    }
    tydny.push(week);
    i += 7;
  }
  return { rok, mesic: mesicCislo, dnu: daysInMonth, tydny };
}

export function posun(rok, mesicCislo, o) {
  const celkem = (rok * 12 + (mesicCislo - 1)) + (Number.isInteger(o) ? o : 0);
  const yearOut = Math.floor(celkem / 12);
  const monthOut = (celkem % 12) + 1;
  return { rok: yearOut, mesic: monthOut };
}

function srovnejOdId(a, b) {
  if (a.od !== b.od) return a.od < b.od ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function chystaSe(udalosti, dnes) {
  const items = Array.isArray(udalosti) ? udalosti : [];
  return items
    .filter((u) => denOk(dnes) && denOk(eventEnd(u)) && eventEnd(u) >= dnes)
    .sort(srovnejOdId);
}

export function bylo(udalosti, dnes) {
  const items = Array.isArray(udalosti) ? udalosti : [];
  return items
    .filter((u) => denOk(dnes) && denOk(eventEnd(u)) && eventEnd(u) < dnes)
    .sort((a, b) => {
      if (a.od !== b.od) return a.od < b.od ? 1 : -1;
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0;
    });
}

export function aktuality(udalosti, dnes, howMany) {
  const n = Number.isInteger(howMany) && howMany > 0 ? howMany : 3;
  const chystane = chystaSe(udalosti, dnes);
  const selected = chystane.filter((u) => u.aktualita === true);
  for (const u of chystane) {
    if (selected.length >= n) break;
    if (u.aktualita !== true) selected.push(u);
  }
  return selected.slice(0, n);
}

function analysis(datum) {
  if (!denOk(datum)) return null;
  const [rok, mesic, den] = datum.split("-").map(Number);
  return { rok, mesic, den };
}

export function format(udalost, language) {
  if (!udalost) return "";
  const od = analysis(udalost.od);
  if (!od) return "";
  const do_ = analysis((typeof udalost.do === "string" && udalost.do !== "") ? udalost.do : udalost.od);
  if (!do_) return "";
  const en = language === "en";
  if (od.den === do_.den && od.mesic === do_.mesic && od.rok === do_.rok) {
    return en
      ? `${od.den} ${MONTHS_EN[od.mesic - 1]} ${od.rok}`
      : `${od.den}. ${od.mesic}. ${od.rok}`;
  }
  if (od.mesic === do_.mesic && od.rok === do_.rok) {
    return en
      ? `${od.den}–${do_.den} ${MONTHS_EN[od.mesic - 1]} ${od.rok}`
      : `${od.den}.–${do_.den}. ${od.mesic}. ${od.rok}`;
  }
  return en
    ? `${od.den} ${MONTHS_EN[od.mesic - 1]} – ${do_.den} ${MONTHS_EN[do_.mesic - 1]} ${do_.rok}`
    : `${od.den}. ${od.mesic}. – ${do_.den}. ${do_.mesic}. ${do_.rok}`;
}
