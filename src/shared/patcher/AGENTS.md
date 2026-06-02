# Patcher Subsystem – Agent Context

This directory contains the **generic ASM patcher engine**.
It is a candidate for extraction into a standalone npm package alongside the parser.
Keep it **completely free of Crystal Studio-specific imports**.

---

## Purpose

The patcher is the **inverse of the parser**. Where the parser reads ASM files
and produces an intermediate JSON representation, the patcher takes the *current
state* of that representation and writes it back into the original ASM files —
preserving all formatting, comments, and lines that were not touched.

```
Parser:   ASM files  ──(config)──►  Intermediate JSON + Parser Metadata
Patcher:  Entity diff ──(config + Parser Metadata + base files)──►  Patched ASM files
```

The parser and patcher share the **same config format**. A config entry that
teaches the parser how to *read* a macro also teaches the patcher how to *write*
it back.

---

## Relationship to the Parser

The parser produces two outputs (see `src/shared/parser/AGENTS.md`):

1. **Intermediate JSON** – domain-agnostic entity/property bags with `entity_id` →
   consumed by HLR factory; also used to compute the patch diff
2. **Parser metadata JSON** – one object per parsed base file; flat list of
   per-property records containing `entity_id`, `entity_type`, `property`,
   `value` (original), `pattern`, `rawLine`, `line_num`

The patcher uses **both** outputs. It does not re-read ASM files from disk.

---

## Patching Strategy: State Diff

**The patcher does not replay the HLR command history.**
Only the *current state* of the HLR matters. The history of edits that produced
that state is irrelevant — replaying it would be inefficient and incorrect
(e.g. a property changed twice would be patched twice, wasting work).

### Step 1 – Generate the new Intermediate JSON from the HLR

The Crystal Studio patcher service (in `src/main/`) asks the HLR to serialize
itself into a new intermediate JSON. `entity_id` values are preserved from the
original parse, so entities can be matched across old and new snapshots.

```jsonc
// New intermediate JSON (current HLR state)
{
  "PokemonBaseStats": [
    { "entity_id": "a1b2c3d4-...", "name": "BULBASAUR", "hp": "60", ... },  // hp was 45
    // IVYSAUR removed by user ← entity_id "e5f6a7b8-..." no longer present
    { "entity_id": "NEW-uuid-...",  "name": "NEWMON",   "hp": "50", ... },  // new entity
    ...
  ]
}
```

### Step 2 – Compute the Entity Diff

Diff the new intermediate JSON against the **original values** stored in the
metadata JSON (the `value` field on each metadata property entry).

The diff produces three buckets:

| Bucket | Condition |
|---|---|
| **Changed** | `entity_id` exists in both old and new; at least one property value differs |
| **Removed** | `entity_id` present in metadata but absent from new intermediate JSON |
| **Added** | `entity_id` present in new intermediate JSON but absent from metadata |

> **Multi-file HLR entities:** The intermediate JSON does not contain multi-file
> entities — each JSON entity object comes from exactly one file. When a single
> HLR entity is backed by multiple files, the **HLR factory** is responsible for
> splitting it back into the correct per-file JSON objects (preserving original
> `entity_id` values) before the diff is computed. The patcher engine only ever
> operates on single-file entity objects.

### Step 3 – Invoke the Patcher Engine

The generic patcher engine (this package) receives:
1. The **parser metadata** (per-file property lists with `entity_id`, `pattern`,
   `rawLine`, `line_num`)
2. The **base file snapshots** (most recent version of each parsed file, retrieved
   from the command stack by the patcher service)
3. The **parser/patcher config** (for generating new lines)
4. The **entity diff** (changed / removed / added buckets)

For each affected file it applies low-level operations to an in-memory copy of
the base file, then returns the patched buffer.

---

## Patcher Operation Model

### Case A – Changed Property

*A property that already existed has a new value.*

1. Look up the metadata entry for `(entity_id, property)` → get `pattern`, `rawLine`, `line_num`.
2. Re-match `rawLine` using `pattern` to locate the placeholder region for this
   property within the line.
3. Substitute the new value into that region.
4. Replace line `line_num` in the `AsmCodeBuffer` with the reconstructed line.

**Formatting preservation:** only the captured placeholder region changes.
All surrounding whitespace, tabs, and inline comments are kept verbatim.

### Case B – Removed Entity (or Removed Property)

*An entity has been deleted from the HLR.*

1. Collect all metadata entries with the removed `entity_id` across all files.
2. For each entry, delete line `line_num` from the corresponding `AsmCodeBuffer`.

For `table`-type config entries the header/footer lines of the table are **not**
automatically deleted — the config must specify whether they belong to a
particular entity or are shared structure.

### Case C – New Property on an Existing Entity

*A property was added to an entity that already exists on disk.*

1. Use the config to locate the correct file and position anchor for this
   entity type / property.
2. Generate the new ASM line from the config template and the new value.
3. Insert the line at the resolved position.

### Case D – New Entity

*An entity has been added to the HLR that does not exist on disk yet.*

1. Use the config to determine:
   - Which file the entity belongs to (file name pattern from config)
   - Where to insert within that file (insertion anchor — e.g. before a
     `table` footer, or at the end of a `single_line` block)
2. Generate all required ASM lines from config templates and entity property values.
3. If the target file does **not exist** on disk:
   - Generate the complete file content from the config template.
   - Mark the file for creation (the patcher service handles the actual `fs.writeFile`).
   - The user may be shown a confirmation dialog before the new file is written.
4. If the target file exists, insert the generated lines at the anchor position.

---

## Line-Level Operations

All operations are performed on `AsmCodeBuffer` objects
(see `src/shared/parser/asmCodeBuffer.ts` and `asmCodeBufferOps.ts`):

| Operation | Use case |
|---|---|
| **Replace argument** | Change a value in an existing line (Case A) |
| **Delete line(s)** | Remove an entity or row (Case B) |
| **Insert line(s)** | Add a new entity, row, or property (Cases C, D) |
| **Move lines** | Reorder entities within a file |

**Opaque line preservation:** the patcher only touches lines the parser has
matched. All other lines pass through verbatim, ensuring partially-parsed files
are never silently corrupted.

## Patch Grouping & Application

Patches are grouped **per file** and applied atomically:

1. For each file that needs modification, retrieve the most recent base file
   snapshot (see `src/main/services/AGENTS.md` for the resolution algorithm).
2. Apply all low-level patch operations to an **in-memory copy** (`AsmCodeBuffer`).
3. Validate the in-memory result (sanity checks).
4. Write all patched buffers to disk. If any write fails, **all writes are rolled
   back** before returning an error.
5. Create any new files required by Case D additions (with user confirmation if
   configured).
6. The patcher service stores pre-patch snapshots in a new `PatchCommand` on
   the command stack, then triggers `make` as a side effect.

---
## Config Symmetry

The patcher reads the same JSON config that drives the parser. A config entry
describes both how to *read* and how to *write* a given assembly construct.

Config authors must ensure:
- Patterns unambiguously identify the region to replace.
- Insertion anchor fields are present for every entity type that can be added
  (e.g. `insert_before: "footer"` for table types).
- New-entity file templates are provided for entity types that may require a
  new file to be created on disk.
- Formatting for generated lines is explicit in the config (the patcher does
  not infer formatting from adjacent lines).

---

## Planned File Layout

```
src/shared/patcher/
  AGENTS.md                 ← this file
  asmPatcher.ts             ← core patcher engine (apply patch ops to AsmCodeBuffer)
  entityDiff.ts             ← diff(oldIntermediateJSON, newIntermediateJSON) → EntityDiff
  patchOperation.ts         ← PatchOperation type definitions
  patcherConfig.ts          ← config type definitions (shared with parser)
  __tests__/
    asmPatcher.test.ts
    entityDiff.test.ts
```

Shared config and metadata types (used by both parser and patcher) may be
extracted to `src/shared/parser/` or a dedicated `src/shared/asm-config/` module
to avoid duplication. TBD when implementation begins.

---

## npm Package Boundary

The generic patcher engine (this directory) must remain:
- Free of Crystal Studio-specific imports
- Free of HLR class references
- Unaware of the command stack and file I/O

It accepts:
- **Parser metadata** (per-file flat property lists with `entity_id`, `pattern`, `rawLine`, `line_num`)
- **Base file buffers** (`AsmCodeBuffer` per file, provided by the patcher service)
- **Parser/patcher config** (for generating new lines and resolving insertion anchors)
- **Entity diff** (`{ changed, removed, added }` buckets computed from old vs new intermediate JSON)

It returns:
- A map of `filePath → AsmCodeBuffer` (patched in-memory buffers)
- A list of new files to create (`filePath → content`) for Case D additions
- A list of `PatchOperation` records describing every low-level change made

Crystal Studio's **patcher service** (`src/main/services/patcherService.ts`, not
yet created) is responsible for:
- Serializing the current HLR to a new intermediate JSON
- Computing the entity diff
- Retrieving base file snapshots from the command stack
- Calling this engine
- Writing the patched buffers and new files to disk
- Pushing a `PatchCommand` onto the command stack
- Triggering `make` as a side effect

---

## Round-Trip Fidelity Guarantee

A correct patch+parse cycle must be a **no-op on the HLR**:

```
HLR_before_patch  →  patch()  →  files on disk
files on disk     →  parse()  →  HLR_after_parse

assert(HLR_before_patch === HLR_after_parse)
```

If this assertion fails, there is a bug in either the parser or the patcher.
Crystal Studio may optionally run this verification after each build to detect
config errors early.
