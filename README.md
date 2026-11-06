# Ukázka webu — Kamila Zawadská

Klikatelná ukázka webu a e-shopu pro malířku Kamilu Zawadskou. Nejde o hotový
web, ale o návrh k prohlédnutí a připomínkám.

**Živě:** https://chaospalda42.github.io/kamila-zawadska-navrh/

Dvojjazyčně (čeština / angličtina), galerie jako retrospektiva s filtry
a prohlížečem na celou obrazovku, e-shop propojený s galerií, kalendář
akcí, kurzy, kontaktní formulář a mockup správy webu.

## Co je v ukázce zástupné

- fotky děl i ateliéru jsou vygenerované, ne skutečná díla,
- názvy děl, ceny, texty, termíny akcí a kontakty jsou vymyšlené,
- košík nic neodesílá a formulář nikam neposílá zprávu,
- správa webu je jen ukázka obrazovek, ne funkční administrace.

Ukázkový režim to píše i na webu, v pásu nad obsahem.

## Jak se to staví

```
uv sync                                   # závislosti pro testy a brány
node build.mjs                            # web do out/, režim ukázky
OSTRY=1 node build.mjs                    # režim ostrého webu
uv run pytest -q                          # akceptační testy
uv run python -m tools.kontrola_webu out  # brána nad hotovým webem
```

Hotový web je statický: HTML, jedno CSS, jeden skript. Žádný framework,
žádný build krok navíc.
