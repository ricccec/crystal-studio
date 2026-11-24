#!/usr/bin/env python3
"""A console script must say why it cannot work. It must never dump a stack.

Two ways a tree can be wrong, and the same invariant covers both:

  * **no tree** — run from somewhere with no `Makefile` beside a `main.asm` in
    any parent. `RepoNotFound` subclasses `RuntimeError`, so an
    `except FileNotFoundError` does not catch it.
  * **a real tree** — run inside a *valid* pret tree. The root resolves, so a
    file the tree does not have goes missing three frames later, where an
    `except` around the lookup no longer covers it.

The second case is why the exit code is asserted only for the first. A command
that supports a tree should handle it rather than refuse it, where a hack's own
command should refuse a tree that is not its hack's; both satisfy *no
traceback*, which is the invariant, and a shared exit code would force one of
the two to be wrong.

The check is strict about tracebacks and loose about wording: some scripts are
gated by argparse before they reach the lookup, and those that do reach it print
in several spellings (`<command>:`, `error:`, `Error:`). Demanding one wording
would fail on code that works. A traceback is the defect; the wording is taste.

**The script list is discovered, not written down**, and it is discovered from
*this repository's* own packaging. Every console script installed would include
the commands the other distributions ship, and this file would then report on
code its repository does not own.

    python tests/test_cli_refusals.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import tomllib
from importlib.metadata import PackageNotFoundError, distribution
from pathlib import Path
from pret_toolkit.shared import paths

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

#: Vanilla's tree, which the plugins in this repo support — so it is a tree
#: these commands should handle, not refuse. Its absence skips that half rather
#: than failing it — a game tree is a developer's checkout, not a fixture this
#: repo can ship.
STOCK_FOLDER = "pokecrystal"
STOCK_TREE = paths.find_checkout(STOCK_FOLDER)

#: The studio is a full-screen TUI: it takes the terminal rather than returning,
#: so a subprocess cannot ask it this question. Named rather than silently
#: skipped, and announced on every run, so that the day it grows a
#: non-interactive path somebody decides.
INTERACTIVE: set[str] = {"crystal-studio"}

#: Long enough that a slow import is not a failure, short enough that a CLI
#: which waits for input is.
TIMEOUT_SECONDS = 60

TRACEBACK = "Traceback (most recent call last)"

_failures = 0


def check(label: str, cond: bool, detail: str = "") -> None:
    global _failures
    ok = bool(cond)
    if not ok:
        _failures += 1
    print(f"  {'ok  ' if ok else 'FAIL'} {label}"
          f"{(': ' + detail) if detail and not ok else ''}")


def this_distribution() -> str:
    """The distribution this repository builds, read from its own pyproject."""
    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    return tomllib.loads(pyproject.read_text())["project"]["name"]


def find_console_scripts() -> list[str]:
    """The console scripts **this repository ships** — not every one installed.

    Selecting by namespace prefix was right while there was one distribution and
    wrong the moment there were four: a developer's environment holds all of
    them, so every repo's copy of this file exercised all twelve commands and
    reported on code it does not own. Read from this repo's own metadata
    instead, which is still discovery rather than a written-down list.
    """
    try:
        dist = distribution(this_distribution())
    except PackageNotFoundError:
        return []
    return sorted(e.name for e in dist.entry_points
                  if e.group == "console_scripts")


def run_in(script: str, cwd: Path) -> tuple[int, str]:
    path = Path(sys.executable).parent / script
    try:
        done = subprocess.run(
            [str(path)], cwd=cwd, stdin=subprocess.DEVNULL,
            capture_output=True, text=True, timeout=TIMEOUT_SECONDS,
            env={"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"},
        )
    except subprocess.TimeoutExpired:
        return -1, f"no answer in {TIMEOUT_SECONDS}s"
    return done.returncode, done.stdout + done.stderr


def last_line(out: str) -> str:
    lines = out.strip().splitlines()
    return lines[-1][:110] if lines else ""


def scripts_to_exercise() -> list[str]:
    """The scripts this file can hold to the promise, saying what it leaves out.

    A command excluded in silence reads exactly like one that passed: both print
    nothing, and a half that exercises none of them prints a heading and then an
    empty line. `INTERACTIVE` records why an exclusion is permanent; this says it
    where the result is read, on every run.
    """
    scripts = find_console_scripts()
    if not scripts:
        print(f"  --   skipping: {this_distribution()} declares no console "
              f"scripts, so there is nothing here to hold to this promise")
        return []
    for name in sorted(set(scripts) & INTERACTIVE):
        print(f"  --   skipping {name}: it takes the terminal rather than "
              f"returning, so a subprocess cannot ask it this")
    return [name for name in scripts if name not in INTERACTIVE]


def test_outside_any_tree(tmp: Path) -> None:
    for name in scripts_to_exercise():
        code, out = run_in(name, tmp)
        check(f"{name} does not traceback with no tree at all",
              TRACEBACK not in out, last_line(out))
        check(f"{name} fails rather than pretending it worked",
              code != 0, f"exit {code}")


def test_inside_a_real_pret_tree() -> None:
    if not (STOCK_TREE / "main.asm").exists():
        print(f"  --   skipping: {paths.explain_missing_checkout(STOCK_FOLDER)}")
        return
    for name in scripts_to_exercise():
        _, out = run_in(name, STOCK_TREE)
        check(f"{name} does not traceback inside a real pret tree",
              TRACEBACK not in out, last_line(out))


def test_the_check_can_fail(tmp: Path) -> None:
    """A check that cannot fail is not checking.

    `find_repo_root()` raises from a directory with no tree above it, which is
    the traceback this file exists to detect. If it stops producing one, the
    detector is looking for the wrong string and every check above it is
    vacuous.
    """
    def traceback_from(code: str, cwd: Path) -> str:
        return subprocess.run([sys.executable, "-c", code], cwd=cwd,
                              capture_output=True, text=True,
                              timeout=TIMEOUT_SECONDS).stderr

    err = traceback_from(
        "from pret_toolkit.shared import paths; paths.find_repo_root()", tmp)
    check("an unguarded find_repo_root() tracebacks, so the detector works",
          TRACEBACK in err and "RepoNotFound" in err, err.strip()[-110:])



if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d).resolve()
        print(f"no tree at all: {tmp}")
        test_the_check_can_fail(tmp)
        test_outside_any_tree(tmp)
        print(f"\na real pret tree: {STOCK_TREE}")
        test_inside_a_real_pret_tree()
    print(f"\n{'FAILURES: ' + str(_failures) if _failures else 'all ok'}")
    sys.exit(1 if _failures else 0)
