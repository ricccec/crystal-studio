# Crystal Studio – Agent Context Guide

This document is intended for AI coding agents working on the Crystal Studio codebase.
Read it before making any changes.

---

## What is Crystal Studio?

Crystal Studio is a graphical IDE for creating ROM hacks based on the
[pret/pokecrystal](https://github.com/pret/pokecrystal) disassembly.
It is built with Electron + TypeScript + React (Vite).

The UX is inspired by Visual Studio Code and GB Studio.

---

## Repository Layout

```
src/
  main/          ← Electron main process (Node.js)
    hlr/         ← HLR class definitions, HLR factory, domain model
    ipc/         ← IPC channel registrations (main ↔ renderer)
    services/    ← All business logic (parser, patcher, build, git, project…)
    utils/       ← Shared utilities for the main process
    windows/     ← BrowserWindow management
  preload/       ← Electron preload script (contextBridge)
  renderer/      ← React frontend (pure presentation layer)
  shared/        ← Code shared by main AND renderer (types, constants, parser core)
    parser/      ← Generic ASM parser engine (may become a standalone npm package)
    patcher/     ← Generic ASM patcher engine (may become a standalone npm package)
    types/       ← TypeScript type definitions and Zod schemas
    utils/       ← Pure utility functions

references/      ← Reference copies of pokecrystal-based codebases (READ-ONLY)
  pokecrystal/         ← Vanilla pret/pokecrystal (shallow clone)
  pokecrystal16/       ← pokecrystal modified to handle 16-bit indexes (shallow clone)
  polished-crystal/    ← Polished Crystal fork by Rangi42 (shallow clone)
  pokeprism/           ← Pokémon Prism (shallow clone)
```

---

## Architecture Overview

Crystal Studio follows a strict **main-process-owns-state** model:

| Layer | Responsibility |
|---|---|
| **Main process** | HLR (High-Level Representation), command stack, parser, patcher, build, git |
| **IPC** | Main exposes typed channels; renderer calls them and receives DTO responses |
| **Renderer** | Purely presentational. Receives serialized HLR + metadata as DTOs; sends user commands back |

**Never put business logic or mutable state in the renderer.**
The renderer is intentionally kept thin so the architecture could later be adapted to a web or mobile frontend.

---

## Core Concepts

### High-Level Representation (HLR)

The in-memory model of the game data. Consists of typed classes:
- `PokemonSpecies`, `PokemonBaseStats`, `Learnset`, `Evolution`
- `MapGroup`, `GameMap`, `WildEncounters`, `Trainer`, `Warp`, `MapConnection`
- `Move`, `TmHm`, `Item` (future)

The HLR is **static** (defined in code, not configurable). It always lives in the main process.
The renderer receives a **plain DTO snapshot** of the HLR over IPC.

### Parser

A **hardcoded**, fault-tolerant engine that reads ASM files and produces:
1. **Intermediate JSON** – generic entity/property bags (domain-agnostic)
2. **Parser metadata JSON** – per-property matched pattern + matched ASM line (used by the patcher)
The Crystal Studio **HLR factory** consumes the intermediate JSON and constructs typed HLR objects.

For v1 the parsing rules are **not user-configurable**. Crystal Studio ships hardcoded
parser/patcher implementations selected via a fixed **target profile**
(`pokecrystal` | `prism`). The user *selects* a profile; they do not edit it. The generic
matching engine (`AsmPattern`, chunking, branch expansion, `AsmCodeBuffer`) lives in
`src/shared/parser/` and is reused by every profile; the per-profile parse logic lives in
`src/shared/parser/targets/<profile>/`.

> **Future direction:** a user-customizable, JSON-configurable parser. The shipped profiles
> for major rom hacks would then be authored as JSON configs rather than code. v1 deliberately
> hardcodes instead — a generic config interpreter is essentially that future parser, and is
> out of scope here. See `src/shared/parser/AGENTS.md`.

### Patcher

Converts the *current HLR state* back into ASM file edits using a **state-diff strategy**:
1. Serialize the current HLR → new intermediate JSON (entity IDs preserved)
2. Diff against the original values in the parser metadata → changed / removed / added buckets
3. Apply targeted line-level operations to in-memory base file snapshots
4. Write patched files to disk atomically

Mirrors the parser's **hardcoded target profile** (symmetric design — the same profile that
teaches the parser how to read a construct teaches the patcher how to write it). Preserves all
formatting, comments, and unrecognized lines verbatim. When a new entity introduces a new ROM
section (chiefly a new map), the patcher places it in a user-chosen bank — see **ROM
Allocation & Banking** below and `src/shared/patcher/AGENTS.md`.

### Command Stack

A **single global undo/redo stack** (like VS Code). Every user action is a `Command` with
`execute()` / `undo()` methods. Command types:

| Command | What it stores |
|---|---|
| `ParseCommand` | Snapshot of base files parsed; new HLR state |
| `HlrEditCommand` | Delta to HLR (e.g. rename Pokémon, edit base stat) |
| `PatchCommand` | Pre-patch base file snapshots; post-patch file content |

Rules:
- Undo does **not** cross session boundaries (stack is reset on app start).
- Re-parsing always pushes a new `ParseCommand` (undoable), **except** when triggered by a target profile change (which is destructive and not undoable).
- Only one `PatchCommand` at a time; a new patch collapses the previous one.
- A build is a `PatchCommand` followed by `make`; `make` failure does not auto-rollback — the user undoes the patch manually (with a confirmation dialog that explains the consequence).

### Workspace & Persistence

- Project data is initially stored in the **app data folder** (user has not consented to repo pollution).
- When the user explicitly **saves the workspace** (or triggers the first patch/build), a
  `.crystal-studio/` folder is created in the repo root, the app-data backup is removed,
  and `.crystal-studio/` is added to `.gitignore`.
- **Auto-save** runs periodically and stores four artifacts:
  1. **Selected target profile id** (`pokecrystal` | `prism`, stored in the project config)
  2. **Base file snapshots** – full content of each parsed ASM file as of last parse
  3. **Parser metadata JSON** – per-file property lists with `entity_id`, `pattern`, `rawLine`, `line_num`
  4. **Intermediate JSON from current HLR** – the HLR serialized to intermediate JSON at auto-save time (this is what allows HLR state to be restored across sessions — it reflects user edits, not just the last parse)
- On startup, the HLR is reconstructed from the saved intermediate JSON (not by re-parsing).
  If any base file on disk has changed since the snapshot, the user is prompted to re-parse.
- Re-parsing is a **full rebuild** — no partial re-parsing. It replaces all base files,
  metadata, and intermediate JSON, and rebuilds the HLR from scratch. The user is warned
  that pending HLR edits will be lost. Re-parse is undoable (restores previous state).

### Build System

- Runs `make` in the workspace root.
- Supports: WSL, CygWin/native make (user-configured, see `AppSettings`).
- Build = `PatchCommand` (writes patched files to disk) + `make` side effect.
- Build output is streamed to an integrated console view (like VS Code's Terminal panel).

### Git Integration (v1 scope)

- Clone repo from URL (default: `https://github.com/pret/pokecrystal.git`).
- Auto-manage `.gitignore` (add `.crystal-studio/` and ROM output).
- Commit from UI.
- Optionally: branch management.

### ROM Allocation & Banking

A pokecrystal ROM is split into 16 KiB **banks**, and most rom hacks run on a tight free-space
budget. Placing **new** content — chiefly a new map and the ROM `SECTION`s it introduces — means
choosing a bank that has room. Crystal Studio must understand this budget.

- **Free-space model** is derived by parsing the **rgblink `.map` file** produced by a build
  (e.g. `pokeprism_nodebug.map`): per-bank `SECTION`/`EMPTY` ranges and `TOTAL EMPTY` bytes.
  This is authoritative but **requires a prior successful build** — ROM-banking features are
  unavailable until the project has been built at least once.
- **v1 = manual placement.** The renderer's **ROM View** shows banks, their sections, and free
  space. When the user adds a map, they pick the target bank; the patcher emits the new section
  into that bank.
- **Placement mechanics are profile-specific:**
  - **Prism** banks sections explicitly via a linkerscript (`contents/romx.link`: a `ROMX $xx`
    block lists the section names in bank `$xx`). Placing a section = emit the `SECTION` in the
    `.asm` **and** add its name under the chosen bank block in the linkerscript.
  - **Vanilla pokecrystal** relies on rgblink auto-banking; forcing a bank = emit a pinned
    `SECTION "…", ROMX, BANK[$xx]`.
- **Future:** an "auto-banking" allocator that picks a bank with enough free space
  automatically (bin-packing). Out of scope for v1.

---

## Subsystem Detail Docs

Each major subsystem has its own `AGENTS.md` with deeper implementation notes.
Read the relevant one before working on that subsystem.

| Subsystem | Location |
|---|---|
| HLR domain model, entity scope, rename/delete workflows | [src/main/hlr/AGENTS.md](src/main/hlr/AGENTS.md) |
| Generic ASM parser engine | [src/shared/parser/AGENTS.md](src/shared/parser/AGENTS.md) |
| Generic ASM patcher engine | [src/shared/patcher/AGENTS.md](src/shared/patcher/AGENTS.md) |
| Main-process services & command stack | [src/main/services/AGENTS.md](src/main/services/AGENTS.md) |
| IPC channel registrations | [src/main/ipc/AGENTS.md](src/main/ipc/AGENTS.md) |
| React renderer | [src/renderer/AGENTS.md](src/renderer/AGENTS.md) |

---

## Key Files to Read Before Editing

| File | Purpose |
|---|---|
| [src/shared/types/types.d.ts](src/shared/types/types.d.ts) | Core type definitions |
| [src/shared/types/settingsSchema.ts](src/shared/types/settingsSchema.ts) | Zod schemas for app + project config |
| [src/shared/default.ts](src/shared/default.ts) | Default app settings, tool aliases |
| [src/shared/constants.ts](src/shared/constants.ts) | Shared constants |
| [src/shared/ipc.ts](src/shared/ipc.ts) | IPC channel definitions |
| [src/main/services/serviceContainer.ts](src/main/services/serviceContainer.ts) | Service wiring |
| [src/main/services/projectService.ts](src/main/services/projectService.ts) | Workspace/project lifecycle |
| [src/main/services/appSettingsService.ts](src/main/services/appSettingsService.ts) | App-level settings |
| [src/main/services/makeService.ts](src/main/services/makeService.ts) | Build execution |
| [src/main/services/TaskManagerService.ts](src/main/services/TaskManagerService.ts) | Long-running task management |
| [src/shared/parser/](src/shared/parser/) | Generic ASM parser engine |

---

## Reference Codebases

The `references/` directory contains shallow clones of real pokecrystal-based repos.
Use them to understand the ASM file structure, macro names, and data layout that the
parser and patcher must handle.

| Directory | Description |
|---|---|
| `references/pokecrystal/` | Vanilla pret/pokecrystal — the canonical baseline |
| `references/polished-crystal/` | Polished Crystal by Rangi42 — a major fork, useful for testing parser fork-compatibility |
| `references/pokeprism/` | Pokémon Prism — a fan ROM hack on a pre-pret Crystal fork; substantially different macro/file layout; see its AGENTS.md |

These directories are **read-only reference material**. Do not modify them.

### Pokémon Prism AGENTS.md Files

Pokémon Prism's codebase diverges significantly from pokecrystal (different macro
names, split data files, six-region world, added abilities, different map event
format). The subsystem AGENTS.md files below document every parser-relevant
difference:

| Path | Contents |
|---|---|
| [references/pokeprism/AGENTS.md](references/pokeprism/AGENTS.md) | Root overview; full diff table vs. pokecrystal; HLR → source file mapping |
| [references/pokeprism/constants/AGENTS.md](references/pokeprism/constants/AGENTS.md) | `mapgroup` macro, `map_dimension_constants.asm`, species constants |
| [references/pokeprism/data/AGENTS.md](references/pokeprism/data/AGENTS.md) | Base stats format (with abilities), TM learnset table, per-species movesets, names, landmarks |
| [references/pokeprism/data/wild/AGENTS.md](references/pokeprism/data/wild/AGENTS.md) | `wildmap` macro, per-region encounter files, `percent` rate encoding |
| [references/pokeprism/trainers/AGENTS.md](references/pokeprism/trainers/AGENTS.md) | Per-class party files, trainer type constants, attributes format |
| [references/pokeprism/maps/AGENTS.md](references/pokeprism/maps/AGENTS.md) | `warp_def`, `person_event`, `signpost` macros; y,x argument order; block layouts |

---

## Coding Conventions

- TypeScript strict mode is enabled.
- All services are instantiated in `serviceContainer.ts` — add new services there.
- IPC channels are defined in `src/shared/ipc.ts` and registered in `src/main/ipc/`.
- Tests live in `__tests__/` subdirectories alongside the code they test (Vitest).
- The parser engine (`src/shared/parser/`) is designed to be domain-agnostic and is a candidate for extraction as a standalone npm package — keep it free of Crystal Studio–specific imports.
- The patcher mirrors the parser per target profile; the read/write logic for a profile must stay in sync (a change to how a construct is parsed must be reflected in how it is patched).

---

## What Is NOT Done Yet (as of Feb 2026)

- HLR class definitions (Pokemon, Map, etc.) — not yet created
- HLR factory (intermediate JSON → typed HLR objects) — not yet created
- Target-profile parsers (`pokecrystal`, `prism`) under `src/shared/parser/targets/` — not yet created
- Patcher implementation — not yet created
- ROM map service (rgblink `.map` parsing → bank/free-space model) — not yet created
- ROM View panel + manual bank-placement flow — not yet created
- Command stack / undo system — not yet created
- Renderer UI beyond scaffolding — not yet created
- Session persistence (`.crystal-studio/` folder logic) — not yet created
- Git commit UI — not yet created
- Validation service (HLR integrity + codebase grep validator) — not yet created
