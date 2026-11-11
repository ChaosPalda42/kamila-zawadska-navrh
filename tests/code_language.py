"""Gate helper: our own sources are written in English (constitution rule #545).

Only comments and identifiers are checked. String literals are left alone on
purpose: they carry CSS class names, data-attribute names, JSON keys and the
Czech text a visitor reads, and none of that is code.

A file may keep the names listed in ``allowed`` — its public API, which other
files and frozen acceptance tests still call by the Czech name. Those are
renamed in one atomic step across the whole project, not file by file, so the
per-file gate has to let them through.

A property name is left alone as well: ``dilo.nazev`` and ``{ nazev: 1 }``
reach for a key of the data in data/*.json, and those keys stay Czech with the
rest of the public vocabulary (rule #547). Policing them only teaches a worker
to launder them through string literals -- ``item["vGalerii"]`` -- which is the
same name in worse code.

So is a name that stands as a key without a colon. ``{ texty }`` is the key and
the variable in one word, ``const { texty } = x`` binds by the key's name, and
``main(ostry=True)`` names a parameter the caller spells out -- and the callers
include the frozen acceptance tests. Renaming any of those renames something
the file does not own, so such a name stays Czech everywhere in that file.

Czech is spotted two ways: diacritics anywhere in a comment, and a word from
CZECH_WORDS used as (part of) an identifier or as a comment word. Identifiers
are split on underscores and camelCase boundaries and compared whole, so
``index`` never trips over ``den``.
"""
from __future__ import annotations

import ast
import io
import re
import tokenize
import unicodedata
from pathlib import Path

DIACRITICS = frozenset("áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ")

# Czech words this project uses in identifiers and comments. Only words that
# are not also English: "list", "set", "map", "data", "detail" and friends stay
# out, or the gate would flag correct English.
CZECH_WORDS = frozenset(
    """
    adres adresa adresar adresy akce akci aktualita aktuality aktualni atributy
    bez brana casti cena ceny cesky cesta cesty chyba chyby chybi cil cile
    cislo cista delka den diakritiky dila dilo dnes dnu dny dolu doprava dotaz
    druh druhy dvojice formular fotka fotky galerie hlaska hlava hlavni hledat
    hodiny hodnota hodnoty hotovo jazyk jazyky jednoduchy jmena jmeno kam
    kalendar kandidat kandidati kapacita karta karty kategorie kde kdy klic
    klice kod kolik konec kontakt kontakty kontrola kopie koren korun kosik
    kotvy kratse krok kurz kurzy kus kusky kusy mapa mesic mesice mesto minule
    miru misto mnozstvi mrizka nadpis nahled nahoru nahrada nahrani najdi nalez
    nalezy nazev nazvy nic nikdy norm normalizovany novy nula obal objednavka
    obraz obrazek obrazky obrazovku obsah obsahuje obsazene ocisti oddil oddily
    odebrat odhal odkaz odkazy odkud okno okoli omezen ostatni ostry otisk
    otevreno otevri patka platne platno plocha plynule pocet pocty podle
    pohyb pokrocile pole polozka polozky pomer popis popisek popisky poradi
    portret postup pozice prazdny predchozi prednost predpony predvolba preklad
    prekresli prekryv prepinac prepni prepocitej preved prihlasit pripoj
    pripony pripustene prodano prodeji prohlizec prolni prvek prvni radek radku
    radky ram relativni rekapitulace retezec rezim rok rozbor rozdil rozlozene
    rozmer sablona sady sbirac sekce serazene seznam sirka sirky skok skript
    skriptu skryte skryty skupiny skutecna sloupce sloupcu slovnik slovni slovo
    slugu slugy smaz smazat soubor soubory souboru soucet sousedi spatne
    spoust srazene stary stav stavy stranky styl styly telo terminy tecky
    technika techniky telefon texty tlacitka tlacitko tvar tvary tyden tydny
    typ ukaz ukazka uklid ulice ulozeno ulozene ulozit uprav upravit usporadane
    uvod varianty velikost verzalky verze veta viditelne viditelny vrstva vse
    vstup vyber vybrane vyrez vyska vysledek vystava vystavy vzdelani vzorec
    vzorek vzorky zacatek zahod zaklad zaloha zalozka zapis zapni zaskrtavatko
    zastav zavri zaznam zaznamy zdroj zitra zmena zmenena zmeneno zmensi zprava
    zpracuj zpusob zpusoby zrus zrusit znacka znacky znak znovu zpet
    """.split()
)

# A quoted name inside prose is a quotation, not Czech prose: an English
# comment may well say that ${nazev} is a key of the data.
_QUOTED = re.compile(r"``[^`]*``|`[^`]*`|\$\{[^}]*\}")

_IDENTIFIER = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")
_WORD = re.compile(r"[A-Za-zÁ-Žá-ž_$][A-Za-z0-9Á-Žá-ž_$]*")
_CAMEL_PART = re.compile(r"[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+")

# Characters after which a slash opens a regex literal rather than dividing.
_BEFORE_REGEX = frozenset("(,=:[!&|?{};+-*~%<>\n")


def _words_in(name: str) -> list[str]:
    """Split an identifier into its words: snake_case and camelCase both."""
    words: list[str] = []
    for chunk in re.split(r"[_$]+", name):
        words.extend(_CAMEL_PART.findall(chunk))
    return [w.lower() for w in words if w]


def _without_diacritics(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _python_items(text: str):
    """Yield (line, kind, text) for NAME and COMMENT tokens and punctuation.

    Punctuation is in the stream so a name can be read in context: the one
    after a dot is someone else's field, not a name this file chose. A
    docstring is prose like any comment -- rule #545 names docstrings too --
    and it is told apart by position: a string alone on its logical line, which
    is where ``tokenize`` puts a NEWLINE right after it.
    """
    all_tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    line_start = True
    for index, token in enumerate(all_tokens):
        if token.type == tokenize.NAME:
            yield token.start[0], "name", token.string
            line_start = False
        elif token.type == tokenize.COMMENT:
            yield token.start[0], "comment", token.string
        elif token.type == tokenize.OP:
            yield token.start[0], "punct", token.string
            line_start = False
        elif token.type == tokenize.STRING:
            following = next((t for t in all_tokens[index + 1:]
                              if t.type not in (tokenize.COMMENT, tokenize.NL)), None)
            if line_start and following is not None and following.type == tokenize.NEWLINE:
                yield token.start[0], "comment", token.string
            line_start = False
        elif token.type in (tokenize.NEWLINE, tokenize.NL, tokenize.INDENT,
                            tokenize.DEDENT):
            line_start = True


def _js_items(text: str):
    """Yield (line, kind, text) for identifiers and comments in JS.

    Hand-rolled, because there is no JS tokenizer here. Strings are skipped,
    but the code inside a template literal's ${...} is not: the templates are
    full of ${nazev} and those identifiers have to be seen.
    """
    pos = 0
    end = len(text)
    line = 1
    # One entry per ${...} the cursor sits inside, holding how many { that
    # interpolation has seen. A } ends the interpolation only at depth 0 --
    # otherwise it closes a block or an object literal written inside it, which
    # the templates are full of. Counting literals instead of braces made the
    # scanner read `}).join("")` as the end of the template: the code after it
    # became string, so a Czech name there was never seen and never renamed,
    # while the same name was renamed where the scanner still looked (that is
    # how `src/templates/stranky.mjs` ended up with `den is not defined`).
    inside = []
    previous = "\n"  # last significant code character, to tell regex from divide

    def skip_literal_part(start: int) -> int:
        """Walk the literal half of a template until ${ or the closing quote."""
        nonlocal line
        i = start
        while i < end:
            if text[i] == "\\":
                i += 2
                continue
            if text[i] == "`":
                return i + 1
            if text[i : i + 2] == "${":
                inside.append(0)
                return i + 2
            if text[i] == "\n":
                line += 1
            i += 1
        return i

    while pos < end:
        char = text[pos]
        pair = text[pos : pos + 2]

        if pair == "//":
            stop = text.find("\n", pos)
            stop = end if stop < 0 else stop
            yield line, "comment", text[pos:stop]
            pos = stop
            continue
        if pair == "/*":
            stop = text.find("*/", pos + 2)
            stop = end if stop < 0 else stop + 2
            chunk = text[pos:stop]
            yield line, "comment", chunk
            line += chunk.count("\n")
            pos = stop
            continue
        if char in "'\"":
            i = pos + 1
            while i < end and text[i] != char:
                i += 2 if text[i] == "\\" else 1
            line += text[pos : i + 1].count("\n")
            pos = i + 1
            previous = "'"
            continue
        if char == "`":
            pos = skip_literal_part(pos + 1)
            previous = "`"
            continue
        if char == "}" and inside and inside[-1] == 0:
            inside.pop()
            pos = skip_literal_part(pos + 1)
            previous = "`"
            continue
        if char == "/" and previous in _BEFORE_REGEX:
            # A regex literal: /.../flags, where a character class may hold a slash.
            i = pos + 1
            in_class = False
            while i < end:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "[":
                    in_class = True
                elif text[i] == "]":
                    in_class = False
                elif text[i] == "/" and not in_class:
                    break
                elif text[i] == "\n":
                    break
                i += 1
            while i + 1 < end and text[i + 1].isalpha():
                i += 1  # the flags belong to the literal, not to the code
            pos = i + 1
            previous = "/"
            continue
        if char == "\n":
            line += 1
            pos += 1
            previous = "\n"
            continue
        match = _IDENTIFIER.match(text, pos)
        if match:
            yield line, "name", match.group(0)
            pos = match.end()
            previous = "a"
            continue
        if not char.isspace():
            if inside and char in "{}":
                inside[-1] += 1 if char == "{" else -1
            yield line, "punct", char
            previous = char
        pos += 1


def code_only(items):
    """The items with the comments dropped, and where each one ended up.

    Every shape this gate recognizes -- a key, a kwarg, a parameter list -- is
    read off the neighbouring tokens, and a comment standing between them is
    not a token of the code. With comments left in, an object key written on
    the line after a comment looked like a plain name, and the conversion
    renamed a key of the data (src/ui/admin.js had `misto:` turned into
    `place:`, which the structural gate then caught).
    """
    kept, where = [], {}
    for index, item in enumerate(items):
        if item[1] == "comment":
            continue
        where[index] = len(kept)
        kept.append(item)
    return kept, where


def _is_property(items, index, keys) -> bool:
    """True when the name at `index` names a field of the data, not a variable.

    Two shapes count: right after a dot (``dilo.nazev``) and a key in an object
    literal (``{ nazev: 1 }``, ``, popis: 2``). The literal is told from a
    ternary by what stands before the name -- a ``{`` or a ``,``, not a ``?``.

    One dot reaches for a field; three spread a value, and ``...minule`` is the
    variable itself. Renaming it in one place and not the other is how a file
    passes both gates and still throws.
    """
    before = items[index - 1] if index else None
    second = items[index - 2] if index > 1 else None
    after = items[index + 1] if index + 1 < len(items) else None
    if before is not None and before[1:] == ("punct", "."):
        return second is None or second[1:] != ("punct", ".")
    if not keys or after is None or after[1:] != ("punct", ":"):
        return False
    return before is None or before[1:] in (("punct", "{"), ("punct", ","))


def _names_used_as_keys(items, keys) -> frozenset[str]:
    """Names this file does not own, because somewhere it spells them as a key.

    In JS that is the shorthand: ``{ texty }``, ``const { texty } = x`` and
    ``const { texty = [] } = x`` all mean key and variable at once, so renaming
    one of them either moves the key or loses the reference. In Python it is the
    keyword argument -- ``main(ostry=True)`` -- which names a parameter in
    someone's signature. One such use fixes the name for the whole file: the
    other occurrences are that same variable.
    """
    opens = (("punct", "{"), ("punct", ","))
    closes = (("punct", ","), ("punct", "}"), ("punct", "="))
    found = set()
    for index, (_, kind, chunk) in enumerate(items):
        if kind != "name":
            continue
        before = items[index - 1][1:] if index else None
        after = items[index + 1][1:] if index + 1 < len(items) else None
        if keys:
            if before in opens and after in closes:
                found.add(chunk)
        elif after == ("punct", "=") and before in (("punct", "("), ("punct", ",")):
            found.add(chunk)
    return frozenset(found)


def _public_parameters(items, allowed) -> frozenset[str]:
    """Parameter names of a public function, which the caller spells out.

    A public function keeps its Czech name (rule #547) and so does its
    signature: the frozen acceptance tests call ``varianty(..., zaklad="x")``
    by keyword. A parameter cannot be renamed on one side only, so the name is
    that file's own vocabulary everywhere in it, body included.
    """
    found = set()
    for index in range(len(items) - 2):
        if (items[index][1:] != ("name", "def")
                or items[index + 1][1] != "name"
                or items[index + 1][2] not in allowed
                or items[index + 2][1:] != ("punct", "(")):
            continue
        depth, step = 1, index + 3
        while step < len(items) and depth:
            kind, chunk = items[step][1], items[step][2]
            if kind == "punct":
                depth += 1 if chunk in "([{" else -1 if chunk in ")]}" else 0
            elif kind == "name" and depth == 1 and items[step - 1][2] in ("(", ",", "*", "**"):
                found.add(chunk)
            step += 1
    return frozenset(found)


def _imported_names(text: str) -> frozenset[str]:
    """Every name an import statement brings in, plus the module path it names.

    A name reached by ``from tools.fotky import varianty`` belongs to the other
    file: it stays Czech there (rule #547), so it has to stay Czech here too,
    and the module path is a file name, which the rule leaves alone as well.
    An ``as`` alias is counted with them -- it is only ever the same name under
    another spelling, and nothing is lost by leaving it.

    Without this, the gate asked the frozen acceptance tests to rename the very
    names they import, and the conversion duly broke every one of them.
    """
    found = set()
    for node in ast.walk(ast.parse(text)):
        if not isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        if isinstance(node, ast.ImportFrom) and node.module:
            found.update(node.module.split("."))
        for alias in node.names:
            found.update(alias.name.split("."))
            if alias.asname:
                found.add(alias.asname)
    return frozenset(found)


def names_to_leave(items, keys, allowed, text: str = "") -> frozenset[str]:
    """Every name in the file that is not this file's to rename.

    One place for the two shapes, because whoever does the renaming has to
    leave exactly what this gate excuses. A tool that decides it for itself
    will one day rename a name the gate let through -- and only the acceptance
    tests would notice.
    """
    found = _names_used_as_keys(items, keys)
    if not keys:
        found |= _public_parameters(items, frozenset(allowed))
        if text:
            found |= _imported_names(text)
    return found


def czech_lines(path, allowed=()) -> list[tuple[int, str]]:
    """Return (line, offending text) for every Czech comment or identifier.

    ``path`` is relative to the project root. ``allowed`` lists the names that
    may stay — the file's public API, still called in Czech from elsewhere.
    """
    root = Path(__file__).resolve().parents[1]
    source = root / path
    text = source.read_text(encoding="utf-8")
    items = list(_python_items(text) if source.suffix == ".py" else _js_items(text))
    kept = frozenset(allowed)
    keys = source.suffix != ".py"  # a name before a colon is a key in JS only
    code, where = code_only(items)
    as_keys = names_to_leave(code, keys, kept, "" if keys else text)

    found: list[tuple[int, str]] = []
    for index, (line, kind, chunk) in enumerate(items):
        if kind == "punct":
            continue
        if kind == "name":
            if chunk in kept or chunk in as_keys or _is_property(code, where[index], keys):
                continue
            if any(w in CZECH_WORDS for w in _words_in(chunk)):
                found.append((line, chunk))
            continue
        prose = _QUOTED.sub(" ", chunk)
        if any(c in DIACRITICS for c in prose):
            found.append((line, chunk.strip()))
            continue
        words = [_without_diacritics(w).lower() for w in _WORD.findall(prose)]
        if any(w in CZECH_WORDS for w in words):
            found.append((line, chunk.strip()))
    return found
