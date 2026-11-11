/* Building the site: data + templates -> out/. Run it with `node build.mjs`.
   No dependencies, Node alone.

   `OSTRY=1` renders the site as it is to go to the domain: no demo notices and
   no admin. In that mode `tools/kontrola_webu.py` measures it. */
import { readFile, writeFile, readdir, mkdir, rm, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { nastavOstry, nastavOtisk, ostryWeb } from "./src/templates/layout.mjs";
import { nastavObrazky } from "./src/templates/obrazky.mjs";
import {
  uvod, galerieStranka, diloStranka, eshopStranka, kosikStranka,
  kalendarStranka, kurzyStranka, bioStranka, kontaktStranka, chyba404,
} from "./src/templates/stranky.mjs";
import { administraceStranka } from "./src/templates/administrace.mjs";
import { galerie as vGalerii, eshop as vEshopu } from "./src/lib/dila.mjs";
import { cesta, cestaDila, JAZYKY } from "./src/lib/preklad.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VEN = path.join(ROOT, "out");
const BASE = "https://kamilazawadska.com";

/* The modules in `src/lib` are poured into one classic script under the
   global KZ.<module>. The browser then fetches one file instead of ten and the
   page needs no type="module" -- while the code under contract stays a single
   source of truth. */
function exportNames(source) {
  const names = new Set();
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(source))) names.add(m[1]);
  return [...names];
}

async function svazekKnihoven() {
  const dir = path.join(ROOT, "src", "lib");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".mjs")).sort();
  const pieces = [];
  for (const file of files) {
    const source = await readFile(path.join(dir, file), "utf8");
    const names = exportNames(source);
    const body = source
      .replace(/^\s*import\s[^;]*;\s*$/gm, "")
      .replace(/^\s*export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\s)/gm, "");
    // Brackets, not a dot: a file name may hold a dash (`texty-sekce`).
    pieces.push(`KZ[${JSON.stringify(file.replace(/\.mjs$/, ""))}] = (function () {\n${body}\nreturn { ${names.join(", ")} };\n})();`);
  }
  return `(function (global) {\n"use strict";\nvar KZ = global.KZ = global.KZ || {};\n${pieces.join("\n")}\n})(typeof window !== "undefined" ? window : globalThis);\n`;
}

async function entry(relative, content) {
  const where = path.join(VEN, relative);
  await mkdir(path.dirname(where), { recursive: true });
  await writeFile(where, content);
}

/** Turns a site path (`/galerie/`) into a file in out/ (`galerie/index.html`). */
function file(address) {
  const clean = address.replace(/^\/+/, "").replace(/\/+$/, "");
  return clean ? `${clean}/index.html` : "index.html";
}

async function manifestObrazku() {
  try {
    return JSON.parse(await readFile(path.join(ROOT, "src", "obrazky", "manifest.json"), "utf8"));
  } catch (error) {
    // The photographs from the client are not here yet. The templates draw a
    // stand-in surface instead, so the site can be clicked through with no image.
    return {};
  }
}

async function copyImages() {
  const origin = path.join(ROOT, "src", "obrazky");
  let polozky;
  try { polozky = await readdir(origin, { withFileTypes: true }); } catch (error) { return 0; }
  let count = 0;
  await mkdir(path.join(VEN, "obrazky"), { recursive: true });
  for (const p of polozky) {
    if (!p.isFile() || p.name === "manifest.json") continue;
    await copyFile(path.join(origin, p.name), path.join(VEN, "obrazky", p.name));
    count++;
  }
  return count;
}

function sitemap(addresses) {
  const dnes = new Date().toISOString().slice(0, 10);
  const polozky = addresses.map((a) => `<url><loc>${BASE}${a}</loc><lastmod>${dnes}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${polozky.join("\n")}
</urlset>
`;
}

async function main() {
  const live = process.env.OSTRY === "1";
  nastavOstry(live);

  const site = JSON.parse(await readFile(path.join(ROOT, "data", "site.json"), "utf8"));
  const texty = JSON.parse(await readFile(path.join(ROOT, "data", "texty.json"), "utf8"));
  nastavObrazky(await manifestObrazku());

  const dnes = process.env.KZ_DNES || new Date().toISOString().slice(0, 10);

  const css = await readFile(path.join(ROOT, "src", "assets", "style.css"), "utf8");
  const svazek = await svazekKnihoven();
  const pages = await readFile(path.join(ROOT, "src", "ui", "stranky.js"), "utf8");
  const web = await readFile(path.join(ROOT, "src", "ui", "web.js"), "utf8");
  const animace = await readFile(path.join(ROOT, "src", "ui", "animace.js"), "utf8");
  const event = await readFile(path.join(ROOT, "src", "ui", "akce.js"), "utf8");
  const admin = await readFile(path.join(ROOT, "src", "ui", "admin.js"), "utf8");
  const script = `${svazek}\n${pages}\n${event}\n${web}\n${animace}`;
  nastavOtisk(createHash("sha256").update(css + script).digest("hex").slice(0, 8));

  await rm(VEN, { recursive: true, force: true });
  await mkdir(VEN, { recursive: true });
  await entry("styl.css", css);
  await entry("web.js", script);
  if (!live) await entry("admin.js", admin);

  const addresses = [];
  let pageCount = 0;
  for (const jazyk of JAZYKY) {
    const spolecne = { site, texty, jazyk, dnes };
    const sets = [
      [cesta("domu", jazyk), uvod(spolecne)],
      [cesta("galerie", jazyk), galerieStranka(spolecne)],
      [cesta("eshop", jazyk), eshopStranka(spolecne)],
      [cesta("kosik", jazyk), kosikStranka(spolecne)],
      [cesta("kalendar", jazyk), kalendarStranka(spolecne)],
      [cesta("kurzy", jazyk), kurzyStranka(spolecne)],
      [cesta("bio", jazyk), bioStranka(spolecne)],
      [cesta("kontakt", jazyk), kontaktStranka(spolecne)],
    ];
    // The admin is part of the demo: on the live site it is never built.
    if (!live) sets.push([cesta("administrace", jazyk), administraceStranka(spolecne)]);
    // A detail page goes to every work that is visible anywhere -- including one
    // that is only in the shop. Otherwise the shop links into nothing: in the
    // admin, "in the gallery" and "in the shop" are independent of each other.
    const kDetailu = [...vGalerii(site.dila)];
    for (const dilo of vEshopu(site.dila)) {
      if (!kDetailu.some((d) => d.slug === dilo.slug)) kDetailu.push(dilo);
    }
    for (const dilo of kDetailu) {
      sets.push([cestaDila(dilo.slug, jazyk), diloStranka({ ...spolecne, dilo })]);
    }
    for (const [address, html] of sets) {
      await entry(file(address), html);
      addresses.push(address);
      pageCount++;
    }
    await entry(jazyk === "cs" ? "404.html" : "en/404.html", chyba404(spolecne));
  }

  await entry("sitemap.xml", sitemap(addresses.filter((a) => !a.includes("administrace"))));
  await entry("robots.txt", `User-agent: *\n${live ? "Allow: /" : "Disallow: /"}\nSitemap: ${BASE}/sitemap.xml\n`);

  const obrazku = await copyImages();
  console.log(`out/: ${pageCount} stránek, ${obrazku} obrázků, režim ${ostryWeb() ? "OSTRÝ" : "ukázka"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
