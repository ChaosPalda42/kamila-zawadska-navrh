// C-004 — Kalendář akcí: mřížka měsíce, akce na dnech, chystá/bylo, rotující aktuality.
// Čistý ES modul, bez závislostí a bez DOM. Data jsou řetězce "RRRR-MM-DD".

const RE_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

const MESICE_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function jeCeloe( x ) {
  return Number.isInteger(x);
}

function dnuVnitr(rok, mesic) {
  if (!jeCeloe(rok) || !jeCeloe(mesic) || rok < 1 || mesic < 1 || mesic > 12) return 0;
  return new Date(Date.UTC(rok, mesic, 0)).getUTCDate();
}

export function dnu(rok, mesic) {
  return dnuVnitr(rok, mesic);
}

export function denOk(datum) {
  if (typeof datum !== "string") return false;
  const m = RE_DATUM.exec(datum);
  if (!m) return false;
  const rok = Number(m[1]);
  const mesic = Number(m[2]);
  const den = Number(m[3]);
  if (mesic < 1 || mesic > 12) return false;
  return den >= 1 && den <= dnuVnitr(rok, mesic);
}

export function denVTydnu(datum) {
  if (!denOk(datum)) return -1;
  const [rok, mesic, den] = datum.split("-").map(Number);
  const d = new Date(Date.UTC(rok, mesic - 1, den)).getUTCDay(); // 0 = neděle
  return (d + 6) % 7; // 0 = pondělí … 6 = neděle
}

function konecUdalosti(u) {
  return (u && typeof u.do === "string" && u.do !== "") ? u.do : (u ? u.od : "");
}

export function vRozsahu(udalost, datum) {
  if (!udalost || !denOk(datum)) return false;
  const od = udalost.od;
  if (!denOk(od)) return false;
  const do_ = konecUdalosti(udalost);
  if (do_ === od) return datum === od;
  if (!denOk(do_)) return false;
  return datum >= od && datum <= do_;
}

export function mesic(rok, mesicCislo, udalosti) {
  const dnuMesice = dnuVnitr(rok, mesicCislo);
  const seznam = Array.isArray(udalosti) ? udalosti : [];
  const start = denVTydnu(`${rok}-${String(mesicCislo).padStart(2, "0")}-01`);
  const tydny = [];
  let i = 0;
  while (i < start + dnuMesice) {
    const tyden = [];
    for (let c = 0; c < 7; c++) {
      const den = i + c - start + 1;
      if (den >= 1 && den <= dnuMesice) {
        const datum = `${rok}-${String(mesicCislo).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
        tyden.push({
          datum,
          den,
          dnesni: false,
          udalosti: seznam.filter((u) => vRozsahu(u, datum)).map((u) => u.id),
        });
      } else {
        tyden.push(null);
      }
    }
    tydny.push(tyden);
    i += 7;
  }
  return { rok, mesic: mesicCislo, dnu: dnuMesice, tydny };
}

export function posun(rok, mesicCislo, o) {
  const celkem = (rok * 12 + (mesicCislo - 1)) + (Number.isInteger(o) ? o : 0);
  const rokV = Math.floor(celkem / 12);
  const mesicV = (celkem % 12) + 1;
  return { rok: rokV, mesic: mesicV };
}

function srovnejOdId(a, b) {
  if (a.od !== b.od) return a.od < b.od ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function chystaSe(udalosti, dnes) {
  const seznam = Array.isArray(udalosti) ? udalosti : [];
  return seznam
    .filter((u) => denOk(dnes) && denOk(konecUdalosti(u)) && konecUdalosti(u) >= dnes)
    .sort(srovnejOdId);
}

export function bylo(udalosti, dnes) {
  const seznam = Array.isArray(udalosti) ? udalosti : [];
  return seznam
    .filter((u) => denOk(dnes) && denOk(konecUdalosti(u)) && konecUdalosti(u) < dnes)
    .sort((a, b) => {
      if (a.od !== b.od) return a.od < b.od ? 1 : -1;
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0;
    });
}

export function aktuality(udalosti, dnes, kolik) {
  const n = Number.isInteger(kolik) && kolik > 0 ? kolik : 3;
  const chystane = chystaSe(udalosti, dnes);
  const vybrane = chystane.filter((u) => u.aktualita === true);
  for (const u of chystane) {
    if (vybrane.length >= n) break;
    if (u.aktualita !== true) vybrane.push(u);
  }
  return vybrane.slice(0, n);
}

function rozbor(datum) {
  if (!denOk(datum)) return null;
  const [rok, mesic, den] = datum.split("-").map(Number);
  return { rok, mesic, den };
}

export function format(udalost, jazyk) {
  if (!udalost) return "";
  const od = rozbor(udalost.od);
  if (!od) return "";
  const do_ = rozbor((typeof udalost.do === "string" && udalost.do !== "") ? udalost.do : udalost.od);
  if (!do_) return "";
  const en = jazyk === "en";
  if (od.den === do_.den && od.mesic === do_.mesic && od.rok === do_.rok) {
    return en
      ? `${od.den} ${MESICE_EN[od.mesic - 1]} ${od.rok}`
      : `${od.den}. ${od.mesic}. ${od.rok}`;
  }
  if (od.mesic === do_.mesic && od.rok === do_.rok) {
    return en
      ? `${od.den}–${do_.den} ${MESICE_EN[od.mesic - 1]} ${od.rok}`
      : `${od.den}.–${do_.den}. ${od.mesic}. ${od.rok}`;
  }
  return en
    ? `${od.den} ${MESICE_EN[od.mesic - 1]} – ${do_.den} ${MESICE_EN[do_.mesic - 1]} ${do_.rok}`
    : `${od.den}. ${od.mesic}. – ${do_.den}. ${do_.mesic}. ${do_.rok}`;
}
