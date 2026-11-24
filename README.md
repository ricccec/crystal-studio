# crystal-studio

A terminal IDE for [pret](https://github.com/pret) Game Boy Gen-2
disassemblies, with plugins for pokecrystal and
[Polished Crystal](https://github.com/Rangi42/polishedcrystal).

Open a disassembly, browse its maps, edit headers and connections, add NPCs and
warps, run the linter over what you changed, and boot the result in an emulator —
without leaving the terminal and without hand-editing `.asm` by eye.

## Install

```bash
pip install git+https://github.com/ricccec/pret-toolkit \
            git+https://github.com/ricccec/crystal-studio-api \
            git+https://github.com/ricccec/crystal-studio
crystal-studio /path/to/pokecrystal
```

Not on PyPI yet. Every dependency in this family is named by URL in the
same command, which is how pip finds the ones PyPI does not have.

Requires Python 3.11 or newer. Pulls in `pret-toolkit`, `crystal-studio-api`,
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
[`crystal-studio-api`](https://github.com/ricccec/crystal-studio-api)
and register one entry point:

```toml
[project.entry-points."crystal_studio.plugins"]
mygame = "mygame.claim"
```

Install it alongside, and the studio discovers it through the same path the two
in-tree adapters use — which is the only way to know the seam works before
someone depends on it.

## The package

The import name is `crystal_studio`: the IDE at its root, and the two bundled
adapters under `crystal_studio.hacks`. It imports `pret_toolkit` and
`crystal_studio_api`, and nothing sideways: `pokeprism-devtools` is a sibling,
and neither reaches the other.

## Tests

```bash
pret-test               # the whole suite, against the pinned game trees
pret-test --worktree    # the same, against your own checkouts, edits and all
```

Plain scripts, not pytest: each prints `ok`/`FAIL` lines and exits non-zero.
`pret-test` ships with `pret-toolkit`, so it is on `$PATH` once this repo is
installed; run it from anywhere inside the repo.

Many read a **real disassembly** rather than a fixture, because what is being checked
is whether the reader agrees with an actual tree.
Each tree is pinned to the one commit the tests were written against, in
`pyproject.toml` under `[tool.pret-test.upstreams]`:

- `pokecrystal` — [pret/pokecrystal](https://github.com/pret/pokecrystal) at `31880ea`
- `polishedcrystal` — [Rangi42/polishedcrystal](https://github.com/Rangi42/polishedcrystal) at `a79dd2a`

`pret-test` checks out a clean copy of each pinned commit into
`~/.cache/pret-toolkit/` — taken from your own checkout when it has the commit, from
the URL otherwise — so neither your edits nor your branch change the result.
Your checkout is found the way every command here finds one: `$<NAME>_TREE`
(`$POKECRYSTAL_TREE`, say), or a conventional place such as `~/code/<name>`.
`pret-test --fetch` fetches them and prints where they are. The copies hold no
build output, so checks that need a ROM skip until you run `make` in one. A
skipped check is counted and reported rather than passed, and `--strict` fails
the run on one.

`--worktree` is for seeing what your own edits do. A test that fails there
because of an edit in *your* tree is a fact about your checkout: record it in
`.known-red.json`, which is git-ignored and counts only in `--worktree` runs.

## Disclaimer

Not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The
Pokémon Company. Pokémon is a trademark of Nintendo.

## Licence

MIT. See `LICENSE`.
