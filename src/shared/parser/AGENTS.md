# Parser Subsystem – Agent Context

This directory contains the **generic ASM parser engine**.
It is a candidate for extraction into a standalone npm package.
Keep it **completely free of Crystal Studio-specific imports**.

---

## Purpose

The parser reads assembly files from a pokecrystal-based codebase (guided by a
JSON config) and produces two outputs:

1. **Intermediate JSON** – a domain-agnostic collection of entity/property bags.
2. **Parser metadata JSON** – per-property record of the matched pattern and the
   original raw ASM line. This is consumed exclusively by the patcher.

Crystal Studio's **HLR factory** (lives in `src/main/`, not here) consumes the
intermediate JSON and builds typed HLR objects.

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
  parser-config/
    pattern-parser/
      patternParser.ts  ← Expands branching patterns ([a|b]) into AsmPattern[]
      patternBranching.ts
      patternSplitter.ts
```

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

---

## Parser Configuration Format

The parser is driven by a JSON config supplied by the project. A config is an
array of **entity descriptors**. Each descriptor tells the parser:
- What entity type this produces (must match a known HLR entity name)
- Which files to read (path or glob)
- How to extract entities from those files

### Config Schema (conceptual)

```jsonc
[
  {
	"entity": "PokemonBase",
	"files": [
	  {
		"file_name": "constants/pokemon_constants.asm",  // glob / regex
		"type": "table",  // one entity per ROW between header and footer
		"header": "const_def 1",  // regex
		"footer": "DEF NUM_POKEMON EQU const_value - 1",  // regex
		"regex": "const {pkmn_id}\t;{pkmn_num}", // eg. const IVYSAUR    ; 02
	  },
	  {
        "file_name": "data/pokemon/base_stats.asm",
        "type": "table",
		"header": "\ttable_width BASE_DATA_SIZE",
		"footer": "\tassert_table_length NUM_POKEMON",
        "regex": ["INCLUDE \"data/pokemon/base_stats/{name}.asm\""], // an array means OR
      }
	],
	"required": ["name"] // If missing, parser throws error 
  },
  {
    "entity": "PokemonBaseStats",
    "files": [
	  {
		"file_name": "data/pokemon/base_stats/{name}.asm",  // when the filename depends on a property the patcher is allowed to rename/create/delete the file
		"type": "multi_line",   // one entity per sequence of matching lines)
		"anchor": "start_of_file", // start_of_file | none | end_of_file 
		"regex": [
			"db {pkmn_id} ; {pkmn_num}"
			"db {hp},{atk},{def},{spd},{spc}",
			";   hp  atk  def  spd  sat  sdf",
			"", // We need at least an empty line before the next match
			"db {type1_id}, {type2_id}",
			"db {catch_rate}",
			"db {base_exp}",
			{ "regex": "db {} ; gender ratio", "ignore_comment": "false" }, // Comments w/o placeholders are ignored by  default by the parser
			"INCBIN \"gfx/pokemon/{name}/front.dimensions\"", // Multiple appearences of {name} -> warn the user
		],
		"mappings": {
			// If placeholder name != property name, remap here
			"spd": "speed",
			"spc": "special"
		}
      },
	  {
		"file_name": "data/pokemon/base_stats/{name}.asm",
		"type": "table",
		"anchor": "end_of_file",
		"header": { "regex": "\t; tm/hm leanset", "ignore_comment": "false" },
		"footer": { "regex": "\t; end", "ignore_comment": "false"},
		"regex": "tmhm {{tm_hm}}", // {{name}} means a list of comma separated values (0 or more)
	  }
	],
	"required": ["name"],
  },
  {
    "entity": "UnknownForms",
    "files": [
      {
        "file_name": "constants/pokemon_constants.asm",
        "type": "single_line",   // one entity per matching line (default)
		"regex": "const UNOWN_{form}",
      }
    ]
  }
]
```

### Supported `type` values

| type | Description |
|---|---|
| `single_line` | Matches every line in the file that matches `regex`; each match = one entity |
| `table` | Matches a block between `header` and `footer`; each `row` match = one entity |
| `multi_line` | (Planned) For macros spanning multiple lines |

### `mappings` field

Optional. Maps placeholder names (as they appear in the pattern) to property names
on the HLR entity. If a placeholder name already matches the property name exactly,
no mapping entry is needed.

### `file_name` Field — Glob & Regex Syntax

The `file_name` field supports:

| Syntax | Meaning |
|---|---|
| `*` | Matches any sequence of characters within a path segment (not `/`) |
| `{}` (curly braces without content) | Matches any path segment (one level only) |
| `{name}` (curly braces w/ content) | Matches any path segment and capture |
| `[a\|b\|c]` | Matches one of the listed segments |
| Any other string | Must match literally (case-sensitive on Linux, case-insensitive on Windows) |

Linux-compatible regex syntax is also accepted for the glob string if a more precise
match is needed. Users can hand-edit the config to use regex patterns when the
standard glob syntax is insufficient.

Examples:
- `data/pokemon/base_stats/*.asm` — all `.asm` files in that directory
- `constants/[pokemon_constants|move_constants].asm` — one of two specific files
- `maps/{}.asm` — all `.asm` files one level inside `maps/`

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

This design keeps the generic parser/patcher package completely unaware of
Crystal Studio’s domain model.

---

## Parser Configuration Lifecycle

The parser config is a JSON document that is **embedded directly in the project
config file** (not referenced by path). This means:
- Each project carries its own self-contained parser config.
- The shipped template configs are never modified by user actions.

### Shipped Configs (Templates)
- Live in the **app data folder** under a dedicated `parser-configs/` subdirectory.
- Ship with Crystal Studio for known codebases: vanilla pokecrystal, Polished Crystal, Pokemon Prism, etc.
- The app reads this folder at runtime and allows the user to select a config template.
- When the user opens a new pret repo folder, the app automatically attempt to parse the codebase using the default parser config

### Loading a Template
- The user selects a new shipped config.
- This copies the template config into the project config (embedded).
- It triggers a **non-undoable full re-parse** of the workspace (the command stack
  is wiped). The user is warned about this before proceeding.

### Editing a Config
- The user edits the embedded config in the project config file.
- Any change triggers a **non-undoable full re-parse** (same as loading a template).
- The original shipped template is unaffected.

### Exporting a Config
- The user can export the current embedded config to the `parser-configs/` folder
  to create a new reusable template.
- This does NOT trigger a re-parse.

---

## Fork Compatibility & User Workflow

Crystal Studio ships with pre-built parser config templates for known pokecrystal
forks (vanilla pokecrystal, Polished Crystal, etc.). Because the assembly data layout
diverges between forks — macros renamed, table structures changed, extra columns added
— **no single config works for all forks**.

### User Responsibility

- The user selects the parser config template that best matches their codebase.
- **No automatic fork detection** is attempted. Crystal Studio does not guess.
- If the selected template does not fully match the user's fork, the parser will still
  run — it is fault-tolerant and will parse what it can, skipping lines it does not
  recognise. This is by design (fault-tolerant rules, see below).

### Iterative Config Refinement

Because the parser is fault-tolerant, partial configs are valid. The user workflow is:

1. Open the project and select the closest matching template.
2. Parse the workspace.
3. Review the Issues Panel for unresolved parser warnings (lines skipped, entities
   not fully populated).
4. Edit the embedded config in the project settings to add new patterns or adjust
   existing ones.
5. Re-parse (non-undoable when config changes; user is warned).
6. Repeat until the Issues Panel is clear (or the user accepts the remaining issues).

This iterative process means that users can gradually improve coverage of their
fork-specific codebase without needing a perfect config from day one.

### Exporting Improved Configs

Once a user has a working config for their specific fork, they can export it back
to the templates folder, making it available as a reusable starting point for other
projects on the same fork. See the Parser Config Lifecycle section for details.

---

## Fault Tolerance Rules

- File not found → skip that file descriptor, log a warning.
- No line matches expected pattern → skip that pattern, log a missing property warning (if any).
- Unknown entity name in config → skip, log an error.
- **Never throw** due to malformed input. The parser must always return the best
  partial result it can produce.

---

## What Is NOT Here (Crystal Studio-specific)

The following live in `src/main/` and are NOT part of this package:
- HLR class definitions (`PokemonSpecies`, `GameMap`, etc.)
- HLR factory (intermediate JSON → typed HLR objects)
- Patcher implementation
- Parser config loading / project config integration

---

## Testing

Tests live in `__tests__/` subdirectories alongside each module.
Run with: `npx vitest run src/shared/parser`
