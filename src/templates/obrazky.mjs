/* Obrázky děl.

   Dokud nemáme fotky od klientky, kreslí se na jejich místo zástupná plocha:
   tiché barevné pruhy odvozené ze slugu díla. Je na první pohled vidět, že to
   není fotka, a přesto stránka drží rozvržení a dá se po ní klikat.

   Jakmile fotky přijdou, `tools/fotky.py` vyrobí varianty 480/960/1600 px
   a zapíše manifest; tenhle modul pak sází <img> se srcsetem. Šířka v srcsetu
   je SKUTEČNÁ naměřená šířka uloženého souboru, ne požadovaná — odhad 1600
   u menší fotky byl skutečná chyba na webu Truhlářství Valčík. */

let manifest = {};
export function nastavObrazky(data) { manifest = data && typeof data === "object" ? data : {}; }

function unik(hodnota) {
  return String(hodnota ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Ze slugu uděláme číslo, aby tatáž zástupná plocha vypadala při každém
   sestavení stejně. Náhoda by znamenala, že se web mění sám od sebe. */
function seed(text) {
  let h = 2166136261;
  for (const znak of String(text)) {
    h ^= znak.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function zastupna(slug, alt, pomer) {
  const s = seed(slug);
  const tón = s % 360;
  const barvy = [
    `hsl(${tón} 18% 88%)`,
    `hsl(${(tón + 24) % 360} 24% 74%)`,
    `hsl(${(tón + 200) % 360} 16% 58%)`,
    `hsl(${(tón + 12) % 360} 22% 40%)`,
  ];
  const sirka = 800;
  const vyska = Math.round(sirka / pomer);
  // Tři vodorovné pásy v poměrech, které se liší podle slugu: ne krajina,
  // ne portrét, jen plocha, která nebije do očí.
  const a = 0.3 + ((s >> 3) % 20) / 100;
  const b = a + 0.2 + ((s >> 7) % 25) / 100;
  const id = `zast-${slug.replace(/[^a-z0-9]+/gi, "")}`;
  return `<svg class="zastupna" viewBox="0 0 ${sirka} ${vyska}" role="img" aria-label="${unik(alt)}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.2" y2="1">
<stop offset="0" stop-color="${barvy[0]}"/><stop offset="${a.toFixed(2)}" stop-color="${barvy[1]}"/>
<stop offset="${b.toFixed(2)}" stop-color="${barvy[2]}"/><stop offset="1" stop-color="${barvy[3]}"/>
</linearGradient></defs>
<rect width="${sirka}" height="${vyska}" fill="url(#${id})"/>
<circle cx="${(s % 600) + 100}" cy="${((s >> 5) % Math.max(1, vyska - 200)) + 100}" r="${60 + (s % 70)}" fill="#ffffff" fill-opacity="0.16"/>
</svg>`;
}

/**
 * Obrázek díla nebo akce.
 * @param {string} jmeno  základ jména souboru (dilo.obrazek)
 * @param {string} alt    alternativní text — vždy povinný, nikdy prázdný
 * @param {object} volby  { sloupcu, pomer, trida, prednost }
 */
export function obrazek(jmeno, alt, volby = {}) {
  const pomer = volby.pomer || 4 / 5;
  const zaznam = manifest[jmeno];
  if (!zaznam || !zaznam.varianty || !zaznam.varianty.length) {
    return zastupna(jmeno || "bez-jmena", alt, pomer);
  }
  const varianty = [...zaznam.varianty].sort((x, y) => x.sirka - y.sirka);
  const nejvetsi = varianty[varianty.length - 1];
  const srcset = varianty.map((v) => `/obrazky/${v.soubor} ${v.sirka}w`).join(", ");
  const sloupcu = Math.max(1, Number(volby.sloupcu) || 1);
  const sizes = sloupcu > 1
    ? `(max-width: 700px) 100vw, (max-width: 1100px) 50vw, ${Math.round(100 / sloupcu)}vw`
    : "(max-width: 700px) 100vw, 60vw";
  const lazy = volby.prednost ? ' loading="eager" fetchpriority="high"' : ' loading="lazy" decoding="async"';
  return `<img src="/obrazky/${nejvetsi.soubor}" srcset="${srcset}" sizes="${sizes}"
width="${nejvetsi.sirka}" height="${nejvetsi.vyska}" alt="${unik(alt)}"${lazy}>`;
}
