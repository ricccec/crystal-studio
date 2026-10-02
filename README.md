# crystal-studio

A terminal IDE for [pret](https://github.com/pret) Game Boy Gen-2
disassemblies, with plugins for pokecrystal and
[Polished Crystal](https://github.com/Rangi42/polishedcrystal).

Open a disassembly, browse its maps, edit headers and connections, add NPCs and
warps, run the linter over what you changed, and boot the result in an emulator —
without leaving the terminal and without hand-editing `.asm` by eye.

## Install

```bash
pip install crystal-studio
crystal-studio /path/to/pokecrystal
```

Requires Python 3.10 or newer. Pulls in `pret-toolkit`, `crystal-studio-plugin-api`,
`textual` and `rich`.

## What it knows, and what it refuses to know

The IDE contains no hack names. It talks to whatever adapter claims the tree you
opened, and branches on the *capabilities* that adapter declares — never on which
hack it is. A capability an adapter does not implement shows up as an absence: no
lint panel, no boot key, no edit form. Never a crash, and never an `if prism`.

Two adapters ship here, for pokecrystal and Polished Crystal. A third, for
Pokémon Prism, ships separately as `pokeprism-devtools`.

## Teaching it your own hack

You do not fork this. Implement the protocols in
[`crystal-studio-plugin-api`](https://github.com/ricccec/crystal-studio-plugin-api)
and register one entry point:

```toml
[project.entry-points."crystal_studio.plugins"]
mygame = "mygame.claim"
```

Install it alongside, and the studio discovers it through the same path the two
in-tree adapters use — which is the only way to know the seam works before
someone depends on it.

## The namespace

The import name is `pretkit`, a [PEP 420][pep420] namespace package shared with
`pret-toolkit` and the plugin API. Installing several of these distributions
gives you one package spanning several source trees. This one imports the toolkit
and the plugin API, and nothing sideways: `pokeprism-devtools` is a sibling, and
neither reaches the other.

[pep420]: https://peps.python.org/pep-0420/

## Tests

```bash
python scripts/run-tests.py
```

Plain scripts, not pytest: each prints `ok`/`FAIL` lines and exits non-zero.

Many read a **real disassembly** rather than a fixture, because what is being
checked is whether the reader agrees with an actual tree. Point the suite at
yours with `POKECRYSTAL_TREE` and `POLISHEDCRYSTAL_TREE`, or check them out
somewhere conventional (`~/code/<name>`, `~/src/<name>`, or one grouping
directory below either). Without a tree those checks are reported as skipped
rather than passed, and the runner counts them, so a green run cannot hide an
empty one.

## Licence

MIT. See `LICENSE`.
