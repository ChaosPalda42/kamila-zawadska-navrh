"""Gate helper: the translation into English only renamed things.

The conversion to English (rule #545) is allowed to touch comments, docstrings
and the names a file chose for itself. Nothing else. That claim is checkable
without reading a line of the diff: drop the comments, replace every identifier
by the order in which it first appears, and the two token streams have to come
out identical. Strings, numbers and punctuation are compared as they stand, so
a CSS class, a JSON key or a sentence the visitor reads cannot move; and the
numbering catches a rename that merges two different names into one, because
the stream then repeats a placeholder where the original had two.

Names that have to survive untouched:
  * a name right after a dot -- ``dilo.nazev`` is a key of the data,
  * a key in an object literal -- ``{ nazev: 1 }``, same reason,
  * a name standing as a key with no colon -- ``{ texty }`` and
    ``const { texty } = x`` in JS, ``print(x, file=f)`` in Python,
  * anything in ``keep``: the public API and the project's own globals.

What this does NOT prove: that the new names are good English, or that a
renamed variable keeps its meaning. The language gate measures the first and
the acceptance tests measure the second. This one measures that nothing else
happened.
"""
from __future__ import annotations

import io
import builtins
import keyword
import subprocess
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAG = "pred-prevodem"

IDENTIFIER_START = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
)
IDENTIFIER_REST = IDENTIFIER_START | frozenset("0123456789")
NUMBER_REST = frozenset("0123456789abcdefABCDEFxXoObBeE._")
BEFORE_REGEX = frozenset("(,=:[!&|?{};+-*~%<>\n")

# A keyword carries meaning, so `const` must not come back as `let`. The same
# goes for a name this project did not invent: renaming `window` or `Math`
# would break the page and no other check would notice.
PYTHON_FIXED = (frozenset(keyword.kwlist) | frozenset(keyword.softkwlist)
                | frozenset(dir(builtins)) | frozenset(["self"]))
JS_FIXED = frozenset("""
    async await break case catch class const continue debugger default delete do
    else export extends finally for function if import in instanceof let new of
    return static super switch this throw try typeof var void while with yield
    null true false undefined NaN Infinity
    Array ArrayBuffer Boolean Date Error Function Intl JSON Map Math Number
    Object Promise Proxy Reflect RegExp Set String Symbol WeakMap WeakSet
    console document window globalThis localStorage sessionStorage navigator
    location history fetch URL URLSearchParams Element HTMLElement Node
    setTimeout clearTimeout setInterval clearInterval requestAnimationFrame
    cancelAnimationFrame parseInt parseFloat isNaN isFinite encodeURIComponent
    decodeURIComponent structuredClone IntersectionObserver MutationObserver
    ResizeObserver AbortController CustomEvent Event FormData Image
    KZ process module exports require globals
""".split())
SKIPPED = (tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT,
           tokenize.ENCODING, tokenize.ENDMARKER)


def js_tokens(text):
    """Yield (kind, text, line) over JavaScript.

    Kinds are comment, string, name and other. A template literal is split: its
    text halves are strings and the code inside ``${...}`` is tokenized, which
    is what the templates need. Enough for our own sources, not a parser.
    """
    pos, end, line = 0, len(text), 1
    # One entry per ${...} the cursor is inside, holding its brace depth. A }
    # closes the interpolation only at depth 0; otherwise it closes a block
    # written inside it, and reading that as the end of the template turns the
    # code that follows into a string -- see the note in code_language.py.
    inside = []
    previous = "\n"

    def literal_part(start):
        i = start
        while i < end:
            if text[i] == "\\":
                i += 2
                continue
            if text[i] == "`":
                return i + 1, True
            if text[i : i + 2] == "${":
                return i + 2, False
            i += 1
        return i, True

    while pos < end:
        char = text[pos]
        pair = text[pos : pos + 2]
        start_line = line

        if pair == "//":
            stop = text.find("\n", pos)
            stop = end if stop < 0 else stop
            yield "comment", text[pos:stop], start_line
            pos = stop
            continue
        if pair == "/*":
            stop = text.find("*/", pos + 2)
            stop = end if stop < 0 else stop + 2
            chunk = text[pos:stop]
            line += chunk.count("\n")
            yield "comment", chunk, start_line
            pos = stop
            continue
        if char in "'\"":
            i = pos + 1
            while i < end and text[i] != char:
                i += 2 if text[i] == "\\" else 1
            chunk = text[pos : i + 1]
            line += chunk.count("\n")
            yield "string", chunk, start_line
            pos = i + 1
            previous = "'"
            continue
        if char == "`" or (char == "}" and inside and inside[-1] == 0):
            if char == "}":
                inside.pop()
            stop, closed = literal_part(pos + 1)
            if not closed:
                inside.append(0)
            chunk = text[pos:stop]
            line += chunk.count("\n")
            yield "string", chunk, start_line
            pos = stop
            previous = "`" if closed else "{"
            continue
        if char == "/" and previous in BEFORE_REGEX:
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
                i += 1
            yield "string", text[pos : i + 1], start_line
            pos = i + 1
            previous = "/"
            continue
        if char.isspace():
            if char == "\n":
                line += 1
                previous = "\n"
            pos += 1
            continue
        if char in IDENTIFIER_START:
            i = pos + 1
            while i < end and text[i] in IDENTIFIER_REST:
                i += 1
            yield "name", text[pos:i], start_line
            pos = i
            previous = "a"
            continue
        if char.isdigit() or (char == "." and pos + 1 < end and text[pos + 1].isdigit()):
            i = pos + 1
            while i < end and text[i] in NUMBER_REST:
                i += 1
            yield "other", text[pos:i], start_line
            pos = i
            previous = "0"
            continue
        if inside and char in "{}":
            inside[-1] += 1 if char == "{" else -1
        yield "other", char, start_line
        previous = char
        pos += 1


def python_tokens(text):
    """Yield (kind, text, line) over Python. A docstring counts as a comment.

    A docstring is prose, so the conversion translates it and the structure
    must not care. It is told apart by position: a string alone on its own
    logical line, which is where ``tokenize`` puts a NEWLINE right after it.
    """
    all_tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    line_start = True
    for index, token in enumerate(all_tokens):
        if token.type == tokenize.COMMENT:
            yield "comment", token.string, token.start[0]
            continue
        if token.type in SKIPPED:
            if token.type != tokenize.ENCODING:
                line_start = True
            continue
        if token.type == tokenize.STRING:
            following = next((t for t in all_tokens[index + 1:]
                              if t.type not in (tokenize.COMMENT, tokenize.NL)), None)
            docstring = line_start and following is not None and following.type == tokenize.NEWLINE
            yield ("comment" if docstring else "string"), token.string, token.start[0]
            line_start = False
            continue
        line_start = False
        kind = "name" if token.type == tokenize.NAME else "other"
        yield kind, token.string, token.start[0]


def names_used_as_keys(names, keys) -> frozenset[str]:
    """Names the file spells as a key, which the language gate leaves in Czech.

    The same shapes that gate excuses: the JS shorthand (``{ texty }``, and the
    destructuring that binds by it) and the Python keyword argument. They are
    fixed here so that a renamed name colliding with one of them still shows up
    as two names becoming one.
    """
    opens = (("other", "{"), ("other", ","))
    closes = (("other", ","), ("other", "}"), ("other", "="))
    found = set()
    for index, (kind, value) in enumerate(names):
        if kind != "name":
            continue
        before = names[index - 1] if index else None
        after = names[index + 1] if index + 1 < len(names) else None
        if keys:
            if before in opens and after in closes:
                found.add(value)
        elif after == ("other", "=") and before in (("other", "("), ("other", ",")):
            found.add(value)
    return frozenset(found)


def fixed_names(suffix):
    """The names the language owns, which a translation may not touch.

    Kept apart by language on purpose: `type` is a soft keyword in Python and
    an ordinary name in JavaScript, and `sirka: int` annotates a parameter
    where `{ sirka: 1 }` would name a key.
    """
    return PYTHON_FIXED if suffix == ".py" else JS_FIXED


def tokens(text, suffix):
    return list(python_tokens(text) if suffix == ".py" else js_tokens(text))


def structure(text, suffix, keep=()):
    """Return the comment-free stream with identifiers as placeholders.

    Each item is (token, line): the token is what gets compared and the line is
    only there so a mismatch can be pointed at in the file.
    """
    kept = frozenset(keep)
    fixed = fixed_names(suffix)
    keys = suffix != ".py"  # a name before a colon is a key in JS, an annotation in Python
    items = [t for t in tokens(text, suffix) if t[0] != "comment"]
    names = [(kind, value) for kind, value, _ in items]
    as_keys = names_used_as_keys(names, keys)
    seen: dict[str, str] = {}
    stream: list[tuple[str, int]] = []

    for index, (kind, value, line) in enumerate(items):
        if kind != "name":
            stream.append((f"{kind}:{value}", line))
            continue
        # One dot reaches for a field, three spread a value: `...minule` is the
        # variable itself and renaming it is this file's business.
        after_dot = (index and names[index - 1] == ("other", ".")
                     and (index < 2 or names[index - 2] != ("other", ".")))
        before_colon = index + 1 < len(names) and names[index + 1] == ("other", ":")
        in_literal = keys and before_colon and (index == 0 or names[index - 1] in
                                                (("other", "{"), ("other", ",")))
        if value in kept or value in fixed or value in as_keys or after_dot or in_literal:
            stream.append((f"fixed:{value}", line))
            continue
        stream.append((seen.setdefault(value, f"name:{len(seen)}"), line))
    return stream


def text_at_tag(path, tag: str = TAG) -> str | None:
    """The file as it stood before the conversion, or None without the tag.

    The tag sits on the last commit with Czech sources. A clone without tags --
    CI fetches none -- has nothing to compare against, and the caller skips.
    """
    found = subprocess.run(["git", "show", f"{tag}:{path}"], cwd=ROOT,
                           capture_output=True, text=True)
    return found.stdout if found.returncode == 0 else None


def rename_only(before: str, after: str, suffix: str, keep=()) -> str | None:
    """None when the two texts differ by renaming alone, else what gave it away."""
    old = structure(before, suffix, keep)
    new = structure(after, suffix, keep)
    for (a, line_a), (b, line_b) in zip(old, new):
        if a != b:
            return (f"struktura se rozešla: původní řádek {line_a} má {a}, "
                    f"nový řádek {line_b} má {b}")
    if len(old) != len(new):
        shorter, longer = sorted((old, new), key=len)
        token, line = longer[len(shorter)]
        where = "nový" if longer is new else "původní"
        return (f"jiný počet tokenů: {len(old)} proti {len(new)}; "
                f"{where} pokračuje na řádku {line} tokenem {token}")
    return None
