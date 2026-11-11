/* Pictures of the works.

   Until the photographs arrive, a stand-in surface is drawn in their place:
   quiet bands of colour derived from the work's slug. It is plain at a glance
   that it is not a photograph, and the page still holds its layout and can be
   clicked through.

   Once the photographs come, `tools/fotky.py` makes the 480/960/1600 px
   variants and writes a manifest; this module then sets an <img> with a
   srcset. The width in the srcset is the REAL measured width of the saved
   file, not the one asked for -- claiming 1600 for a smaller photograph was an
   actual bug on the Truhlarstvi Valcik site. */

let manifest = {};
export function nastavObrazky(data) { manifest = data && typeof data === "object" ? data : {}; }

function unik(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* The slug becomes a number, so the same stand-in surface looks the same at
   every build. Randomness would mean a site that changes by itself. */
function seed(text) {
  let h = 2166136261;
  for (const character of String(text)) {
    h ^= character.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function zastupna(slug, alt, ratio) {
  const s = seed(slug);
  const tón = s % 360;
  const barvy = [
    `hsl(${tón} 18% 88%)`,
    `hsl(${(tón + 24) % 360} 24% 74%)`,
    `hsl(${(tón + 200) % 360} 16% 58%)`,
    `hsl(${(tón + 12) % 360} 22% 40%)`,
  ];
  const width = 800;
  const height = Math.round(width / ratio);
  // Three horizontal bands, in ratios that vary by the slug: not a landscape,
  // not a portrait, just a surface that does not shout.
  const a = 0.3 + ((s >> 3) % 20) / 100;
  const b = a + 0.2 + ((s >> 7) % 25) / 100;
  const id = `zast-${slug.replace(/[^a-z0-9]+/gi, "")}`;
  return `<svg class="zastupna" viewBox="0 0 ${width} ${height}" role="img" aria-label="${unik(alt)}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.2" y2="1">
<stop offset="0" stop-color="${barvy[0]}"/><stop offset="${a.toFixed(2)}" stop-color="${barvy[1]}"/>
<stop offset="${b.toFixed(2)}" stop-color="${barvy[2]}"/><stop offset="1" stop-color="${barvy[3]}"/>
</linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#${id})"/>
<circle cx="${(s % 600) + 100}" cy="${((s >> 5) % Math.max(1, height - 200)) + 100}" r="${60 + (s % 70)}" fill="#ffffff" fill-opacity="0.16"/>
</svg>`;
}

/**
 * A picture of a work or of an event.
 * @param {string} `jmeno`  the base of the file name (`dilo.obrazek`)
 * @param {string} `alt`    the alternative text -- always required, never empty
 * @param {object} `volby`  `{ sloupcu, pomer, trida, prednost }`
 */
export function obrazek(name, alt, volby = {}) {
  const ratio = volby.pomer || 4 / 5;
  const record = manifest[name];
  if (!record || !record.varianty || !record.varianty.length) {
    return zastupna(name || "bez-jmena", alt, ratio);
  }
  const variants = [...record.varianty].sort((x, y) => x.sirka - y.sirka);
  const nejvetsi = variants[variants.length - 1];
  const srcset = variants.map((v) => `/obrazky/${v.soubor} ${v.sirka}w`).join(", ");
  const columns = Math.max(1, Number(volby.sloupcu) || 1);
  const sizes = columns > 1
    ? `(max-width: 700px) 100vw, (max-width: 1100px) 50vw, ${Math.round(100 / columns)}vw`
    : "(max-width: 700px) 100vw, 60vw";
  const lazy = volby.prednost ? ' loading="eager" fetchpriority="high"' : ' loading="lazy" decoding="async"';
  return `<img src="/obrazky/${nejvetsi.soubor}" srcset="${srcset}" sizes="${sizes}"
width="${nejvetsi.sirka}" height="${nejvetsi.vyska}" alt="${unik(alt)}"${lazy}>`;
}
