/* Sestavení webu: data + šablony -> out/. Spouští se `node build.mjs`.
   Žádné závislosti, jen Node.

   OSTRY=1 vykreslí web tak, jak má jít na doménu: bez hlášek o ukázce
   a bez administrace. V tom režimu ho měří tools/kontrola_webu.py. */
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

const KOREN = path.dirname(fileURLToPath(import.meta.url));
const VEN = path.join(KOREN, "out");
const ZAKLAD = "https://kamilazawadska.com";

/* Moduly z src/lib se sesypou do jednoho klasického skriptu pod globální
   KZ.<modul>. Prohlížeč tak nemusí stahovat deset souborů a stránka nepotřebuje
   type="module" — kód pod kontrakty je přitom pořád jeden zdroj pravdy. */
function nazvyExportu(zdroj) {
  const jmena = new Set();
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(zdroj))) jmena.add(m[1]);
  return [...jmena];
}

async function svazekKnihoven() {
  const dir = path.join(KOREN, "src", "lib");
  const soubory = (await readdir(dir)).filter((f) => f.endsWith(".mjs")).sort();
  const kusy = [];
  for (const soubor of soubory) {
    const zdroj = await readFile(path.join(dir, soubor), "utf8");
    const jmena = nazvyExportu(zdroj);
    const telo = zdroj
      .replace(/^\s*import\s[^;]*;\s*$/gm, "")
      .replace(/^\s*export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\s)/gm, "");
    kusy.push(`KZ.${soubor.replace(/\.mjs$/, "")} = (function () {\n${telo}\nreturn { ${jmena.join(", ")} };\n})();`);
  }
  return `(function (global) {\n"use strict";\nvar KZ = global.KZ = global.KZ || {};\n${kusy.join("\n")}\n})(typeof window !== "undefined" ? window : globalThis);\n`;
}

async function zapis(relativni, obsah) {
  const kam = path.join(VEN, relativni);
  await mkdir(path.dirname(kam), { recursive: true });
  await writeFile(kam, obsah);
}

/** Z cesty webu ("/galerie/") udělá soubor v out/ ("galerie/index.html"). */
function soubor(adresa) {
  const cista = adresa.replace(/^\/+/, "").replace(/\/+$/, "");
  return cista ? `${cista}/index.html` : "index.html";
}

async function manifestObrazku() {
  try {
    return JSON.parse(await readFile(path.join(KOREN, "src", "obrazky", "manifest.json"), "utf8"));
  } catch (chyba) {
    // Fotky od klientky ještě nejsou. Šablony místo nich nakreslí zástupnou
    // plochu, takže se po webu dá klikat i bez jediného obrázku.
    return {};
  }
}

async function zkopirujObrazky() {
  const odkud = path.join(KOREN, "src", "obrazky");
  let polozky;
  try { polozky = await readdir(odkud, { withFileTypes: true }); } catch (chyba) { return 0; }
  let pocet = 0;
  await mkdir(path.join(VEN, "obrazky"), { recursive: true });
  for (const p of polozky) {
    if (!p.isFile() || p.name === "manifest.json") continue;
    await copyFile(path.join(odkud, p.name), path.join(VEN, "obrazky", p.name));
    pocet++;
  }
  return pocet;
}

function sitemap(adresy) {
  const dnes = new Date().toISOString().slice(0, 10);
  const polozky = adresy.map((a) => `<url><loc>${ZAKLAD}${a}</loc><lastmod>${dnes}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${polozky.join("\n")}
</urlset>
`;
}

async function main() {
  const ostry = process.env.OSTRY === "1";
  nastavOstry(ostry);

  const site = JSON.parse(await readFile(path.join(KOREN, "data", "site.json"), "utf8"));
  const texty = JSON.parse(await readFile(path.join(KOREN, "data", "texty.json"), "utf8"));
  nastavObrazky(await manifestObrazku());

  const dnes = process.env.KZ_DNES || new Date().toISOString().slice(0, 10);

  const css = await readFile(path.join(KOREN, "src", "assets", "style.css"), "utf8");
  const svazek = await svazekKnihoven();
  const stranky = await readFile(path.join(KOREN, "src", "ui", "stranky.js"), "utf8");
  const web = await readFile(path.join(KOREN, "src", "ui", "web.js"), "utf8");
  const animace = await readFile(path.join(KOREN, "src", "ui", "animace.js"), "utf8");
  const admin = await readFile(path.join(KOREN, "src", "ui", "admin.js"), "utf8");
  const skript = `${svazek}\n${stranky}\n${web}\n${animace}`;
  nastavOtisk(createHash("sha256").update(css + skript).digest("hex").slice(0, 8));

  await rm(VEN, { recursive: true, force: true });
  await mkdir(VEN, { recursive: true });
  await zapis("styl.css", css);
  await zapis("web.js", skript);
  if (!ostry) await zapis("admin.js", admin);

  const adresy = [];
  let pocetStranek = 0;
  for (const jazyk of JAZYKY) {
    const spolecne = { site, texty, jazyk, dnes };
    const sady = [
      [cesta("domu", jazyk), uvod(spolecne)],
      [cesta("galerie", jazyk), galerieStranka(spolecne)],
      [cesta("eshop", jazyk), eshopStranka(spolecne)],
      [cesta("kosik", jazyk), kosikStranka(spolecne)],
      [cesta("kalendar", jazyk), kalendarStranka(spolecne)],
      [cesta("kurzy", jazyk), kurzyStranka(spolecne)],
      [cesta("bio", jazyk), bioStranka(spolecne)],
      [cesta("kontakt", jazyk), kontaktStranka(spolecne)],
    ];
    // Administrace je součást ukázky: na ostrý web vůbec nevznikne.
    if (!ostry) sady.push([cesta("administrace", jazyk), administraceStranka(spolecne)]);
    // Detail dostane každé dílo, které je někde vidět — i to, které je jen
    // v e-shopu. Jinak z e-shopu vede odkaz do prázdna: zaškrtávátka
    // „v galerii" a „v e-shopu" jsou v administraci na sobě nezávislá.
    const kDetailu = [...vGalerii(site.dila)];
    for (const dilo of vEshopu(site.dila)) {
      if (!kDetailu.some((d) => d.slug === dilo.slug)) kDetailu.push(dilo);
    }
    for (const dilo of kDetailu) {
      sady.push([cestaDila(dilo.slug, jazyk), diloStranka({ ...spolecne, dilo })]);
    }
    for (const [adresa, html] of sady) {
      await zapis(soubor(adresa), html);
      adresy.push(adresa);
      pocetStranek++;
    }
    await zapis(jazyk === "cs" ? "404.html" : "en/404.html", chyba404(spolecne));
  }

  await zapis("sitemap.xml", sitemap(adresy.filter((a) => !a.includes("administrace"))));
  await zapis("robots.txt", `User-agent: *\n${ostry ? "Allow: /" : "Disallow: /"}\nSitemap: ${ZAKLAD}/sitemap.xml\n`);

  const obrazku = await zkopirujObrazky();
  console.log(`out/: ${pocetStranek} stránek, ${obrazku} obrázků, režim ${ostryWeb() ? "OSTRÝ" : "ukázka"}`);
}

main().catch((chyba) => {
  console.error(chyba);
  process.exit(1);
});
