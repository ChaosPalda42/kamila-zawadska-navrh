"""Spouštění ESM modulů z src/lib v Node a předávání výsledků přes JSON."""
from __future__ import annotations

import json
import subprocess
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "<<<JSON>>>"


def run_js(module: str, body: str, *, args: dict | None = None) -> object:
    """Naimportuje `src/lib/<module>` jako `m`, vykoná `body` a vrátí hodnotu
    předanou poslednímu volání `out(...)`. `args` je dostupné jako `A`."""
    mod_path = (ROOT / "src" / "lib" / module).as_posix()
    script = textwrap.dedent(
        """
        import * as m from %(mod)s;
        const A = %(args)s;
        let __v = null;
        const out = (v) => { __v = v; };
        %(body)s
        process.stdout.write(%(marker)s + JSON.stringify(__v === undefined ? null : __v));
        """
    ) % {
        "mod": json.dumps(mod_path),
        "args": json.dumps(args or {}),
        "body": body,
        "marker": json.dumps(MARKER),
    }
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    if proc.returncode != 0:
        raise AssertionError("node selhal:\n" + proc.stderr.strip()[:2000])
    at = proc.stdout.rfind(MARKER)
    assert at >= 0, f"modul nevrátil hodnotu přes out(); stdout={proc.stdout[:500]!r}"
    return json.loads(proc.stdout[at + len(MARKER) :])
