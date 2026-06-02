# HLR – High-Level Representation

This directory will contain the **HLR class definitions** and the **HLR factory**
for Crystal Studio.

The HLR is the canonical in-memory model of game data. It is the single source of
truth that the renderer presents and the user edits. All assembly file changes flow
through it.

---

## What the HLR Is (and Is Not)

- **Static**: defined in code, not configurable. The parser config may vary per fork,
  but the HLR classes are fixed in the Crystal Studio codebase.
- **Domain-typed**: strings from the parser are coerced to proper types here.
- **Main-process only**: HLR class instances never cross to the renderer. A plain
  DTO snapshot is sent over IPC instead.
- **Not an ASM representation**: the HLR knows nothing about assembly syntax, file
  paths, or line numbers. That knowledge lives in the parser metadata.

---

## Entity Scope

### v1.0 (Initial Release)

| Domain | Entities | Operations |
|---|---|---|
| **Pokémon** | `PokemonSpecies` (species list + constants), `PokemonBaseStats` | CRUD species list; edit base stats |
| **Maps** | `MapGroup`, `GameMap`, `MapWarp`, `MapConnection`, `WildEncounters`, `Trainer` | CRUD map groups and maps; edit properties, warps, connections, wild encounters, trainers |
| **Moves** | `Move` | CRUD moves |
| **TM/HM** | `TmHm` | CRUD TM/HM assignments |

### Future (Post-v1)

| Domain | Entities | Notes |
|---|---|---|
| **Pokémon** | `Learnset`, `Evolution` | Planned |
| **Items** | `Item` | Planned |
| **Map Events** | `MapEvent` | Planned |

---

## Pokémon Domain — Detailed Notes

### ASM Structure (vanilla pokecrystal)

The Pokémon domain is spread across multiple assembly files:

```
constants/pokemon_constants.asm   ← named species constants (BULBASAUR = 01, etc.)
data/pokemon/base_stats/          ← one .asm file per Pokémon with base stats
  bulbasaur.asm
  ivysaur.asm
  ...
```

A species constant looks like:
```asm
const_def BULBASAUR  ; 01
const_def IVYSAUR    ; 02
```

A base stats file starts with the species constant and is followed by data rows:
```asm
db BULBASAUR  ; species
db 45,49,49,45,65,65  ; hp, atk, def, spe, spc (base stats)
db GRASS, POISON      ; types
...
```

These are referenced throughout the codebase by constant name, not by number.
When a species is renamed or deleted, every reference site must be updated.

### Adding a Pokémon

1. Add a new `PokemonSpecies` entity to the HLR.
2. Add a new `PokemonBaseStats` entity to the HLR.
3. At patch time, the patcher:
   - Appends a new constant to `pokemon_constants.asm`
   - Creates a new file in `data/pokemon/base_stats/[name].asm`
   - The user is shown a confirmation dialog before the new file is created.

### Renaming a Pokémon

1. User renames the species in the HLR.
2. The **HLR validation service** automatically cascades the rename to all
   referencing HLR entities (trainers, wild encounters, etc.) without prompting.
3. The **codebase grep validator** scans unparsed files for the old constant name.
4. The UI surfaces any hits in the Issues Panel and File Tree.
5. The user may trigger an auto find/replace across flagged files (see Open Questions).
6. At patch time, the patcher updates the constant name in all parsed files that
   reference it.

### Deleting a Pokémon

1. User deletes the species from the HLR.
2. The **HLR validation service** flags every HLR entity that still references
   the deleted species constant (trainers, wild encounters, evolutions, learnsets…).
3. The **codebase grep validator** scans unparsed files for the deleted constant name.
4. The UI surfaces all issues. In v1, the build is **not disabled** — only warnings
   are shown. (Future: consider blocking build until issues are resolved.)
5. The user resolves issues manually or via auto-fix.
6. At patch time, the patcher removes the species constant and all associated data
   rows from every parsed file.

---

## Referential Integrity Model

HLR entities reference each other by **named constant** (string), not by object
reference or numeric index. This mirrors how they are referenced in the ASM source.

Example cross-references:
- A `Trainer` slot holds a Pokémon species name (string constant)
- A `WildEncounters` slot holds a Pokémon species name
- A `PokemonBaseStats` entry holds two type name constants

The **HLR validation service** is responsible for checking that all constant
references resolve to known entities. It runs eagerly after relevant mutations
(rename, delete) — not after every edit.

---

## HLR Factory

Lives at `src/main/hlr/hlrFactory.ts` (not yet created).

Responsibilities:
- **Forward:** intermediate JSON → typed HLR objects
  - Recognises multi-file entities: merges JSON objects from different files into
    one HLR entity (e.g. `PokemonSpecies` from `pokemon_constants.asm` merged with
    `PokemonBaseStats` from `data/pokemon/base_stats/bulbasaur.asm`)
  - Coerces string values to typed properties (numbers, enums, etc.)
  - Unknown entity names: log and skip
- **Inverse:** HLR → intermediate JSON (used by auto-save and patcher service)
  - Serializes current HLR back to intermediate JSON preserving `entity_id` values
  - Splits multi-file HLR entities back into per-file JSON objects
- **Session restore:** consumes the **saved intermediate JSON** (reflecting user
  edits, not just last parse) to reconstruct HLR on startup without re-reading disk

---

## Open Questions

### Auto-fix for Unparsed Files: Undo System?

When the codebase grep validator finds hits in unparsed files and the user triggers
an auto find/replace, this operation directly mutates raw ASM files on disk
(bypassing the HLR entirely).

**Decision needed:** should this mutation be:
- **Undoable** — treated as a direct file mutation command, storing a pre-fix
  snapshot (similar to a `PatchCommand` but for arbitrary files)
- **Irreversible** — user is warned clearly before proceeding; no undo support

*This question was identified during architecture review and has not yet been decided.*
