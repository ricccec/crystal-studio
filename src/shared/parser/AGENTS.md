# Parser Subsystem – Agent Context

This directory contains the **generic ASM matching engine** (`asm-pattern/`,
`asmCodeBuffer`, `asmLine`, pattern branch-expansion) **plus the hardcoded per-target
parsers** that use it (`targets/<profile>/`).

The generic engine is a candidate for extraction into a standalone npm package — keep it
**completely free of Crystal Studio-specific imports**. The per-target parsers may depend on
the engine but must still avoid HLR/command-stack/file-I/O imports (they take buffers in,
return intermediate JSON + metadata out).

> **v1 scope note:** the parsing rules are **hardcoded**, not user-configurable. There is no
> JSON config, no config templates, no in-app config editor. The user selects one of the
> shipped **target profiles** (`pokecrystal` | `prism`); that's it. A user-customizable
> JSON-configurable parser is the documented *future* direction (see the end of this file) —
> a generic config interpreter is essentially that future parser and is deliberately out of
> v1 scope.

---

## Purpose

The parser reads assembly files from a pokecrystal-based codebase (using the hardcoded rules
of the selected **target profile**) and produces two outputs:

1. **Intermediate JSON** – a domain-agnostic collection of entity/property bags.
2. **Parser metadata JSON** – per-property record of the matched pattern and the
   original raw ASM line. This is consumed exclusively by the patcher.

Crystal Studio's **HLR factory** (lives in `src/main/`, not here) consumes the
intermediate JSON and builds typed HLR objects.

These two outputs are the **stable contract** between parser and patcher. The contract is
identical no matter how the parse rules are authored (hardcoded today, JSON-configured in the
future), so the patcher and the round-trip guarantee are unaffected by this v1 simplification.

---

## Architecture & File Map

```
asmLine.ts              ← AsmLine type – a single parsed line of an ASM file
asmLineOps.ts           ← Operations on AsmLine (strip comments, normalize ws…)
asmCodeBuffer.ts        ← Ordered collection of AsmLines representing a file
asmCodeBufferOps.ts     ← File-level operations (insert, delete, replace lines)

asm-pattern/
  asmPattern.ts         ← AsmPattern type + parseAsmPattern() validator
  asmPatternChunk.ts    ← Internal: splits a pattern into literal/placeholder chunks
  patternUtils.ts       ← Internal: placeholder extraction, normalization, overlap
  parser-config/        ← (legacy name) pattern-string parsing utilities, not JSON config
    pattern-parser/
      patternParser.ts  ← Expands branching patterns ([a|b]) into AsmPattern[]
      patternBranching.ts
      patternSplitter.ts

targets/                ← (planned) hardcoded per-target parsers — NOT yet created
  pokecrystal/          ← vanilla pret/pokecrystal parse logic
  prism/                ← Pokémon Prism parse logic
```

Everything above `targets/` is the **generic engine** (domain- and profile-agnostic).
Everything under `targets/` is **per-profile parse logic** that calls the engine.

---

## Pattern Syntax

Patterns are strings that match assembly lines. They use a custom syntax:

| Syntax | Meaning |
|---|---|
| `{name}` | Named placeholder – captures any sequence of allowed chars |
| `{}` | Anonymous placeholder – matches but does not capture |
| `[a\|b]` | Branch – matches either `a` or `b` (produces multiple AsmPattern objects) |
| All other chars | Literal match (whitespace/tabs are normalized and treated as equivalent) |

**Key properties enforced by the validator:**
- Named placeholders must be unique within a pattern.
- No two placeholders may be consecutive (with no non-placeholder chars in between
  that could act as a separator).
- Comments and extra whitespace in the source ASM line are ignored during matching.

**Patcher symmetry:** the same pattern used to *read* data can be used to *write*
it back. A pattern with a named placeholder `{value}` can both extract `value`
from a line and reconstruct the line given a new `value`.

The pattern strings themselves remain the workhorse of the hardcoded parsers — a per-target
parse function holds its pattern strings inline and feeds them to the engine. What is gone in
v1 is the *external descriptor format* that used to wrap these patterns in JSON.

---

## Target Profiles (Hardcoded)

Instead of a JSON config of entity descriptors, v1 ships **hardcoded per-target parsers**.
Each target profile knows, in code, which files to read, how to slice them into entities, and
which `AsmPattern` strings extract each property.

### Authoring model: imperative, not a spec interpreter

Each entity is parsed by a **small hand-written function** that uses the generic engine
directly. We deliberately do **not** build a generic descriptor interpreter (handling
arbitrary `type`/`anchor`/`header`/`footer`/glob/`mappings`) — that interpreter *is*
substantially the future configurable parser, and building it now is the overkill v1 avoids.

```ts
// illustrative — targets/pokecrystal/baseStats.ts
function parseBaseStats(file: AsmCodeBuffer): EntityRecord[] {
  // walk the buffer, match inline AsmPattern strings, emit one record per Pokémon
  // e.g. matchPattern('db {hp},{atk},{def},{spd},{spc},{spc2}', line)
  // each matched property becomes a metadata entry (entity_id, property, value,
  // pattern, rawLine, line_num) — the same contract the patcher consumes
}
```

A profile is a collection of such functions plus a manifest of the files it reads. The two
v1 profiles:

| Profile id | Codebase | Notes |
|---|---|---|
| `pokecrystal` | vanilla pret/pokecrystal | the canonical baseline |
| `prism` | Pokémon Prism | substantially diverged (different macros, split files, six regions, added abilities, different map-event format) — see `references/pokeprism/AGENTS.md` |

Two heavily divergent targets ⇒ **two parser modules** under `targets/`, sharing the engine
but with separate bespoke logic. Do not try to parametrize one parser to cover both.

### Profile selection (not editing)

- The user **selects** a target profile for the project. They cannot edit the rules.
- Selection is stored in the project config as a profile **id** (`pokecrystal` | `prism`).
- There is **no automatic fork detection** — Crystal Studio does not guess. (A default may be
  offered when opening a fresh repo, but the user confirms.)
- Changing the selected profile triggers a **non-undoable full re-parse** (the command stack
  is wiped). The user is warned before proceeding.
- The parser remains **fault-tolerant**: if the selected profile does not perfectly match the
  user's exact checkout, it parses what it can and logs warnings for the rest (see Fault
  Tolerance Rules). There is no in-app way to fix coverage gaps in v1 other than the fix
  arriving in a future profile update.

---

## Parser Outputs

### 1. Intermediate JSON

Domain-agnostic. Each entity object carries an auto-generated `entity_id`
(UUID, generated fresh on every parse — **not** required to be stable across runs).

```jsonc
{
  "PokemonBaseStats": [
    { "entity_id": "a1b2c3d4-...", "name": "BULBASAUR", "hp": "45", "atk": "49", ... },
    { "entity_id": "e5f6a7b8-...", "name": "IVYSAUR",   "hp": "60", "atk": "62", ... },
    ...
  ],
  "UnknownForms": [ ... ]
}
```

All values are strings at this stage. Type coercion happens in the HLR factory.
Unknown entity names are **logged and skipped** — they do not cause a crash.

The intermediate JSON can be fully reconstructed from the metadata JSON (see below), though the opposite is not true.
In practice the HLR factory may consume the metadata directly. The intermediate JSON
is still useful as a **human-readable snapshot**, as the input for computing
patch diffs (see patcher docs), and to rebuild the HLR at startup.

### 2. Parser Metadata JSON

Used exclusively by the patcher. **One metadata object is stored per parsed
base file.** The format is flat and property-focused: every extracted property
of every entity found in that file becomes one entry in a list.

```jsonc
// Metadata for "data/pokemon/base_stats/bulbasaur.asm"
{
  "base_file": "data/pokemon/base_stats/bulbasaur.asm",
  "properties": [
    {
      "entity_id": "a1b2c3d4-...",
      "entity_type": "PokemonBaseStats",
      "property":   "hp",
      "value":      "45",
      "pattern":    "db {hp},{},{},{},{},{}",
      "rawLine":    "  db 45,49,49,45,65,65",
      "line_num":   135
    },
    {
      "entity_id": "a1b2c3d4-...",
      "entity_type": "PokemonBaseStats",
      "property":   "atk",
      "value":      "49",
      "pattern":    "db {},{atk},{},{},{},{}",
      "rawLine":    "  db 45,49,49,45,65,65",
      "line_num":   135
    },
    ...
  ]
}
```

Key points:
- Multiple properties on the **same line** each get their own metadata entry
  (same `rawLine` and `line_num`, different `property` and `pattern`).
- `entity_id` ties metadata entries back to the entity in the intermediate JSON.
- `value` records the original parsed value, enabling the patcher to derive a
  diff between the original state and the current HLR without storing a separate
  snapshot of the intermediate JSON.
- Metadata is **not** stored in the HLR. It is held separately (in memory, and
  persisted alongside base file snapshots) and consumed by the patcher.

### Multi-File Entities

A single **HLR entity** may be assembled from multiple JSON entity objects
(from different files) by the HLR factory. For example, a `Pokemon` HLR entity
might be built from a species-constant JSON object (from `pokemon_constants.asm`)
and a base-stats JSON object (from `data/pokemon/base_stats/bulbasaur.asm`).

The HLR factory is responsible for:
- Recognising that two JSON entities (possibly with different `entity_id`s, from
  different files) belong to the same HLR entity and merging them.
- The **reverse operation**: given a single HLR entity, splitting it back into
  the correct per-file JSON objects (with the original `entity_id`s preserved)
  so the patcher can locate the right metadata entries.

This design keeps the generic engine completely unaware of Crystal Studio's domain model.

---

## Fault Tolerance Rules

- File not found → skip that file, log a warning.
- No line matches an expected pattern → skip that pattern, log a missing-property warning (if any).
- Unknown / unrecognized lines in a parsed region → leave untouched, log nothing or a debug note.
- **Never throw** due to malformed input. The parser must always return the best
  partial result it can produce.

---

## What Is NOT Here (Crystal Studio-specific)

The following live in `src/main/` and are NOT part of this package:
- HLR class definitions (`PokemonSpecies`, `GameMap`, etc.)
- HLR factory (intermediate JSON → typed HLR objects)
- Patcher implementation
- Target-profile selection / project config integration
- ROM map service (rgblink `.map` parsing → bank/free-space model)

---

## Future Direction: JSON-configurable parser

The long-term plan is to replace the hardcoded `targets/<profile>/` modules with a generic,
**JSON-configurable parser**: profiles become data (an array of entity descriptors with
file globs, table/multi-line/single-line extraction, header/footer anchors, placeholder→
property mappings) loaded at runtime, so users can author or refine profiles for arbitrary
rom hacks without a code change. The big known rom hacks would ship as JSON profiles.

When that lands, the generic engine in this directory (`asm-pattern/`, `asmCodeBuffer`, …) and
the parser↔patcher **metadata contract** stay exactly as they are — only the `targets/`
modules are superseded by the config interpreter. v1 hardcodes precisely so this engine and
contract get battle-tested first.

---

## Testing

Tests live in `__tests__/` subdirectories alongside each module.
Run with: `npx vitest run src/shared/parser`
