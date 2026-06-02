# Services Subsystem – Agent Context

This directory contains all **main-process business logic** for Crystal Studio.
All services are instantiated and wired in `serviceContainer.ts`.

---

## Service Inventory

| File | Status | Purpose |
|---|---|---|
| `serviceContainer.ts` | Done | Wires all services together; dependency injection root |
| `appSettingsService.ts` | Done | Loads/saves app-level settings (tool paths, make config, emulator) |
| `projectService.ts` | Done | Loads/saves project-level settings; workspace lifecycle |
| `taskManagerService.ts` | Done | Runs external processes; tracks running tasks; killable |
| `makeService.ts` | Done | Runs `make` via taskManagerService; streams stdout/stderr |
| `gitService.ts` | Done | Clone, open repos; auto-manages `.gitignore` |
| `toolsService.ts` | Done | Detects/validates external tools (make, rgbds, cygwin, emulator…) |
| `emulatorService.ts` | Done | Launches the configured emulator with the ROM path |
| `commandStack.ts` | **NOT YET CREATED** | Global undo/redo stack |
| `parserService.ts` | **NOT YET CREATED** | Orchestrates parsing; runs the selected target profile's parser; manages base file snapshots |
| `patcherService.ts` | **NOT YET CREATED** | Converts HLR deltas into ASM patches; writes files to disk |
| `romMapService.ts` | **NOT YET CREATED** | Parses the rgblink `.map` into a bank/free-space model for the ROM View + placement |
| `hlrFactory.ts` | **NOT YET CREATED** | Maps intermediate parser JSON → typed HLR objects |
| `hlrValidationService.ts` | **NOT YET CREATED** | Validates HLR referential integrity + codebase grep validator |
| `sessionService.ts` | **NOT YET CREATED** | Manages `.crystal-studio/` folder; auto-save; session restore |

---

## TaskManagerService (Done)

Lives at `src/main/services/TaskManagerService.ts`. Handles all long-running
external process execution in Crystal Studio.

### Responsibilities
- Wraps Node.js `child_process.spawn` with lifecycle management
- Assigns each task a unique `taskId`
- Supports **streaming**: stdout/stderr lines are forwarded to the renderer in real time
  via IPC (one event per line) using the `TASK_STREAM` IPC channel — the renderer
  displays them in the Console Panel
- Maintains a registry of **active tasks** (`Map<taskId, ChildProcess>`)
- Supports **cancellation**: `kill(taskId)` sends SIGTERM to the process
- Returns a `TaskStreamPayload` per line event and a `ProcessResult` on completion

### Who Uses It
- `makeService` — runs `make` in the workspace root
- `emulatorService` — launches the configured emulator
- `gitService` will use it for `git clone` and similar long-running git operations

### Task Summary DTO
The active task list is included in the `AppStateDTO` so the renderer can show
running tasks and offer cancel buttons.

---

## Command Stack (NOT YET CREATED)

The command stack is a **single global undo/redo stack** (like VS Code). Every
user action that mutates state is a `Command` with `execute()` and `undo()`.

### Command Types

#### `ParseCommand`
Pushed when the parser runs (user-triggered or file-change-triggered).
- Stores: snapshot of every base file that was (re-)parsed (`baseFiles: Map<filePath, string>`)
- Also stores: the HLR state produced by this parse
- **Undoable**: restores the previous base file snapshots and HLR state
- **NOT undoable** if triggered by a target profile change — in that case the stack
  is wiped and a fresh non-undoable parse is performed

#### `HlrEditCommand`
Pushed for every user edit to the HLR (rename Pokémon, change base stat, etc.).
- Stores: a delta describing the change (old value, new value, entity reference)
- Undo applies the reverse delta
- Granularity: one command per GUI action (so Ctrl+Z undoes exactly one user action)
- Compound operations (e.g. "apply preset") can be grouped into a single command

#### `PatchCommand`
Pushed when the user triggers a build (patch files → run make).
- **Only one `PatchCommand` may exist on the stack at a time**; pushing a new one
  collapses/replaces the previous one
- Stores: pre-patch base file snapshots for every file that was written to disk
- Does NOT store HLR state (the HLR is unchanged by a patch — it must stay in sync
  with the patched files; if it doesn't, that indicates a patcher or parser bug)
- Undo: restores patched files to their pre-patch snapshots on disk
- `make` is a **side effect** of `PatchCommand.execute()`, NOT a separate command

### Stack Rules
- Stack is **reset on app start** (no cross-session undo)
- Re-parsing always pushes a `ParseCommand` (except a profile-change-driven re-parse)
- **Patching failure** (a file write fails mid-patch): all written files are rolled back
  automatically before the error is surfaced to the user. No `PatchCommand` is pushed.
  No user action is required — this rollback is transparent.
- **Make failure** (patch succeeded but `make` returned a non-zero exit code):
  the `PatchCommand` IS pushed (the files were written). Crystal Studio notifies the
  user but does NOT auto-rollback. The user must manually click Undo (with a
  confirmation dialog that explains the consequence of undoing a patched-but-unfixed build).
- If the user patches, make fails, edits the HLR further, and patches again:
  the second patch is computed from the most recently stored base files + all
  HLR edit commands that are more recent than those base files

### Base File Resolution at Patch Time

The patcher uses a **state-diff strategy** — it does NOT replay `HlrEditCommand`s.
To find the base file snapshot for a given file `F`:
1. Walk the command stack from top to bottom.
2. Find the most recent `ParseCommand` or `PatchCommand` that holds a snapshot of `F`.
3. Use that snapshot as the base for the patcher engine.

`HlrEditCommand`s are irrelevant to the patcher. The patcher only cares about the
current HLR state (serialized to intermediate JSON) vs the original values in the
parser metadata.

---

## Parser Service (NOT YET CREATED)

Responsibilities:
- Read the **selected target profile id** (`pokecrystal` | `prism`) from the project settings
- Run that profile's hardcoded parser (`src/shared/parser/targets/<profile>/`) over **all**
  of the files the profile reads
- Store resulting base file snapshots + metadata JSON in a new `ParseCommand`
- Pass the intermediate JSON to `hlrFactory` to build typed HLR objects
- Watch for external file changes; prompt user to re-parse if a parsed file changes on disk

**No partial re-parsing.** Every parse is a full rebuild of all of the profile's files.
The user is warned that pending HLR edits (not yet patched to disk) will be lost.
A re-parse is always undoable (the `ParseCommand` stores the previous base files,
metadata, and intermediate JSON so the previous HLR state can be fully restored).

**Exception:** a re-parse triggered by a **target profile change** is **not undoable**.
The command stack is wiped and a fresh non-undoable parse is performed.

---

## Patcher Service (NOT YET CREATED)

The patcher uses a **state-diff strategy** — it does not replay the HLR command
history. Only the current HLR state matters.

Responsibilities:
1. **Serialize HLR → new intermediate JSON** (entity_ids preserved from original parse)
2. **Compute entity diff** against the original values stored in the parser metadata:
   - `changed`: entity_id exists in both; at least one property value differs
   - `removed`: entity_id in metadata but absent from new JSON
   - `added`: entity_id in new JSON but absent from metadata
3. **Retrieve base file snapshots** from the command stack (most recent per file)
4. **Resolve ROM placement** for any added entity that introduces a new section (e.g. a new
   map): take the **user-chosen target bank** (from the ROM View) and pass it as placement
   input. v1 does not auto-pick a bank. (See `romMapService` and the patcher's Case D.)
5. **Call the generic patcher engine** (`src/shared/patcher/`) with:
   - Parser metadata (per-file property lists)
   - Base file buffers (including the linkerscript for linkerscript-banked profiles)
   - The selected target profile's write logic
   - Entity diff + placement input
6. **Write patched buffers to disk** atomically (rollback all on any write failure). For
   profiles that bank via a linkerscript (Prism's `romx.link`), the edited linkerscript is one
   of the written buffers.
7. **Create new files** required by new entities (with user confirmation dialog)
8. **Push a `PatchCommand`** onto the command stack (stores pre-patch snapshots)
9. **Trigger `make`** as a side effect

**Patcher only touches lines that the parser has recognized.**
All unrecognized lines pass through verbatim (opaque preservation), ensuring
partially-parsed files are never silently corrupted.

> For multi-file HLR entities: the HLR factory is responsible for splitting a
> single HLR entity back into per-file intermediate JSON objects (preserving
> entity_ids) before the diff is computed.

---

## ROM Map Service (NOT YET CREATED)

Builds the **bank / free-space model** that powers the renderer's ROM View and the manual
bank-placement flow.

Responsibilities:
- Locate the project's rgblink **`.map`** file (the filename varies per project, e.g.
  `pokeprism_nodebug.map`; discover it or read it from settings).
- Parse it into a structured model: per-bank list of sections (`name`, start/end, size) plus
  `EMPTY` ranges and `TOTAL EMPTY` (free) bytes, and the ROMX header totals
  (`used / free / bank count`).
- Expose this model over IPC for the ROM View, and provide free-space lookups to the
  patcher/placement flow when the user adds a map.

**Requires a prior successful build.** The `.map` is a build artifact — until the project has
been built at least once there is no free-space data, and ROM-banking features are
unavailable (the ROM View shows a "build required" state).

This service only **reads** the `.map`; it does not run builds (that is `makeService`) and it
does not write banking changes (the patcher does that, per the selected profile).

> **Future:** an auto-banking allocator that consumes this model to pick a bank
> automatically. Out of scope for v1 (placement is manual).

---

## HLR Factory (NOT YET CREATED)

Maps the generic **intermediate JSON** produced by the parser to typed HLR classes,
and provides the inverse operation for serialization back to intermediate JSON.

- Lives in `src/main/services/hlrFactory.ts` (or a subdirectory)
- **Forward (parse → HLR):**
  - Consumes intermediate JSON (entity name → array of single-file property bags)
  - Recognises that multiple JSON entity objects (from different files) may belong
    to the same HLR entity and merges them into one typed object
  - Performs type coercion (all parser values are strings; factory converts to numbers etc.)
  - Unknown entity names are logged and skipped (never crash)
- **Inverse (HLR → intermediate JSON):** used by auto-save and the patcher service
  - Serializes the current HLR back to intermediate JSON preserving `entity_id` values
  - Splits multi-file HLR entities back into the correct per-file JSON objects so
    the patcher can locate the right metadata entries for each file
- **Reconstruction on startup:**
  - Consumes the **saved intermediate JSON** (which reflects user edits, not just
    the last parse) to restore the HLR without re-reading ASM files from disk

---

## HLR Validation Service (NOT YET CREATED)

Two-phase validator, triggered after certain HLR mutations (rename, delete):

### Phase 1 – HLR Referential Integrity
- Checks that all inter-HLR references are valid (e.g. a trainer's Pokémon list
  references only known species constants)
- Runs eagerly after every relevant HLR edit command
- Flags broken references on the affected HLR entities

### Phase 2 – Codebase Grep Validator
- Triggered after destructive operations (delete/rename a named constant)
- Performs a naive `grep`-based search of the entire workspace for the old constant name
- Flags files (including **unparsed** files) that reference the deleted/renamed constant
- Results are surfaced in the UI (file tree highlights, issues panel)
- Does NOT block the build (v1); only warns
- Can optionally trigger an auto find/replace on flagged files (bypasses HLR;
  directly mutates raw ASM files on disk)
- **OPEN QUESTION — undo behaviour of auto-fix:** should the auto find/replace be:
  - **Undoable** \u2014 treated as a direct file mutation command, storing a pre-fix snapshot
    (similar to a `PatchCommand` but for arbitrary raw files), OR
  - **Irreversible** \u2014 user is warned clearly before proceeding; no undo support
  - *This has not been decided. Do not implement auto-fix until this is resolved.*

---

## Session Service (NOT YET CREATED)

Manages workspace persistence across sessions.

### Project Folder Strategy
- **Before "Save Workspace"** (or first patch/build): project data lives in the
  **app data folder** under a per-workspace subdirectory. Auto-save runs periodically here.
- **After "Save Workspace"** (or on first patch/build): data moves to `.crystal-studio/`
  inside the workspace root. The app-data backup is removed.
  `.crystal-studio/` is added to `.gitignore`.
- Once `.crystal-studio/` exists it becomes the sole auto-save target.

### What Is Persisted (Four Artifacts)

| Artifact | Why |
|---|---|
| **Selected target profile id** | `pokecrystal` \| `prism`, stored in the project config; selects which hardcoded parser/patcher runs on re-parse |
| **Base file snapshots** | Full raw content of each parsed ASM file as of last parse; used as patcher input |
| **Parser metadata JSON** | Per-file flat property lists (`entity_id`, `value`, `pattern`, `rawLine`, `line_num`); used as patcher input and for diff computation |
| **Intermediate JSON from current HLR** | HLR serialized to intermediate JSON at auto-save time; reflects user edits not yet patched to disk; this is what restores the HLR on next startup |

**NOT persisted:** the undo stack, the HLR class instances, build history.

> The intermediate JSON saved at auto-save time is **not** the same as the intermediate
> JSON produced by the last parse. The parser produces an intermediate JSON that reflects
> the repo files. Auto-save produces an intermediate JSON that reflects the current HLR
> (which may include user edits made after the last parse). The HLR factory is invoked
> to perform this HLR → intermediate JSON serialization at auto-save time.

### On Startup
1. Load project config (selected target profile id, settings) from app-data or `.crystal-studio/`.
2. Restore base file snapshots and metadata JSON from the stored copies.
3. Reconstruct the HLR using `hlrFactory` from the **saved intermediate JSON**
   (not by re-parsing — this preserves user edits made since the last parse).
4. Check if any parsed file on disk has changed since the base file snapshots were stored.
   If so, prompt the user to re-parse (re-parse is undoable; user is warned about
   losing pending HLR edits).
5. On startup, check all stored project entries: if a repo path no longer exists on
   disk, flag it and offer to delete the stale project entry.

### Stale Project Cleanup
- The app does **not** automatically delete stale project folders.
- On startup it checks all known project entries; if the associated repo path is
  missing it warns the user and offers to delete the entry.
- The user can also manually forget a project from the UI.

---

## Adding a New Service

1. Create `myService.ts` using the factory function pattern (see existing services)
2. Add it to `ServiceContainer` type in `serviceContainer.ts`
3. Instantiate it in `createServiceContainer()`
4. Expose any IPC channels in `src/main/ipc/`
