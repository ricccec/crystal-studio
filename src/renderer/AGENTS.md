# Renderer Subsystem – Agent Context

This directory contains the **React frontend** of Crystal Studio (Vite + React + TypeScript).

---

## Golden Rule

**The renderer is purely presentational. It owns no business logic and no mutable
application state.**

- No HLR classes live here.
- No file I/O, no ASM parsing, no patching logic.
- No imports from `src/main/`.
- The renderer receives a **DTO snapshot** from the main process and renders it.
- Every user action that changes state is sent back to the main process as an IPC
  command; the main process responds with an updated DTO.

This separation is intentional: it keeps the architecture compatible with a future
web or mobile frontend that cannot run an Electron main process.

---

## Communication Pattern

```
User action in UI
      │
      ▼
React component calls window.crystalStudio.invoke(channel, payload)
      │  (via contextBridge in preload)
      ▼
Main process handler → ServiceContainer → mutates HLR / command stack
      │
      ▼
Returns DTO response → React state update → re-render
```

---

## Preload API

The preload script (`src/preload/preload.ts`) exposes a typed API on
`window.crystalStudio` (or similar namespace). The renderer should only call
methods on this object — never call `ipcRenderer` directly.

The shape of this API will expand as IPC channels are added.

---

## UX Model (VS Code-inspired)

Crystal Studio's UI is inspired by VS Code and GB Studio. Target layout:

```
┌─────────────────────────────────────────────────────────┐
│  Title bar / menu bar                                    │
├──────────┬──────────────────────────────┬───────────────┤
│ Activity │                              │  Properties   │
│  Bar     │    Main Editor Area          │  Panel        │
│          │  (entity editor, map view,   │               │
│ Explorer │   Pokémon list, etc.)        │               │
│ Issues   │                              │               │
│ Git      │                              │               │
├──────────┴──────────────────────────────┴───────────────┤
│  Integrated Console / Task Output / Issues Panel         │
└─────────────────────────────────────────────────────────┘
```

Key UI areas (planned, not all implemented yet):
- **Explorer / File Tree** – shows workspace files; files that produced parser issues or
  codebase grep hits are highlighted with an indicator badge (colour-coded by issue type)
- **Entity Editors** – tab-based editors for Pokémon, Maps, Moves, TMs, etc.
- **Properties Panel** – context-sensitive properties for selected entity
- **Issues Panel** – see detailed spec below
- **Console Panel** – streams stdout/stderr from running tasks (make, git clone, etc.)
- **Task Manager View** – lists running/completed tasks; allows cancellation

---

## Issues Panel — Detailed Spec

The Issues Panel is the central surface for surfacing parser warnings, HLR validation
errors, and codebase grep hits (from rename/delete workflows).

### Issue Sources

| Source | When raised |
|---|---|
| **Parser warning** | An ASM line matched nothing in the config for an expected entity |
| **Parser error** | A configured file was missing, or a required block was malformed |
| **HLR validation** | An HLR entity holds a reference to an unknown constant (e.g., deleted Pokémon) |
| **Codebase grep** | An unparsed file references an old constant (after rename/delete) |

### UI Behaviour

- **Entity-level highlighting:** In the entity list views (Pokémon list, map list, etc.),
  entities that have at least one unresolved issue are visually flagged (e.g. warning icon).
- **File Tree highlighting:** Files that contain parser issues or grep hits have a
  highlight badge. Hovering shows a count tooltip.
- **Issues Panel entries:** Each issue entry shows:
  - Severity (error / warning / info)
  - Source (parser / HLR validation / codebase grep)
  - Entity name (if applicable)
  - File path + line number (if applicable)
  - The raw ASM line (if applicable)
- **Expandable entity rows:** In the Issues Panel, issues can be grouped by entity.
  Expanding an entity row shows all files it was parsed from, each with their individual issues.
- **Inline resolution:** Where possible, issues surface an action (e.g.
  "Auto fix: replace old constant in this file"). Clicking it triggers the relevant service call.

---

## Polished Map Integration

Crystal Studio integrates with [Polished Map](https://github.com/Rangi42/polished-map),
an external map/tileset editor purpose-built for pokecrystal-based ROMs. This
integration exists because Polished Map edits `.blk` files and tileset files —
ascii data that Crystal Studio does **not** parse.

### Launch Flow
1. User clicks "Open in Polished Map" for a map in the entity editor.
2. Crystal Studio launches Polished Map as an external process, passing the relevant
   `.blk` file path.
3. From Crystal Studio's perspective, the user has left the app temporarily.
4. When Polished Map closes (or the user returns to Crystal Studio), Crystal Studio
   checks all previously tracked parsed files for external changes.

### Conflict Resolution
- Polished Map primarily edits `.blk` files, which are NOT in Crystal Studio's
  parsed file set — so in most cases there is no conflict.
- If a file that Crystal Studio has parsed was also changed on disk by Polished Map
  (or by any other external tool), Crystal Studio detects the change and prompts:
  - **Re-parse** — re-reads the file from disk, losing any HLR edits not yet patched to it
  - **Keep HLR** — ignores the disk change and continues with the current HLR state
    (the on-disk change will be overwritten at the next patch)
- **Disk wins by default:** Crystal Studio recommends re-parsing. Keeping the HLR is the user's
  responsibility and risks silently overwriting external edits at the next build.
- The user is responsible for avoiding concurrent edits between Crystal Studio and Polished Map.

---

## State Management

The renderer should use a **single source of truth** that mirrors the DTO received
from the main process. Do not derive secondary state that diverges from what the
main process holds.

Recommended approach (TBD during implementation):
- A top-level context or Zustand store that holds the current HLR DTO + metadata
- Updated atomically whenever a main-process response arrives
- Components subscribe to slices of this store

**Dirty state** (unsaved HLR edits) is tracked by the main process (via the command
stack). The renderer should display a dirty indicator based on data in the DTO, not
by tracking its own edit history.

---

## DTO Shape (Planned)

The main process will send an `AppStateDTO` over IPC containing:

```typescript
interface AppStateDTO {
  hlr: HlrDTO;              // serialized HLR snapshot
  parseIssues: ParseIssue[];  // files/entities with parser warnings
  dirtyEntities: EntityRef[]; // entities changed since last patch
  commandStack: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
  };
  activeTasks: TaskSummary[];
}
```

The exact shape will be defined alongside the HLR classes.

---

## Current State

The renderer is **scaffolded only** (`App.tsx`, `main.tsx`, `index.html`).
No UI panels, entity editors, or state management are implemented yet.

When building new UI:
1. Define what data the component needs
2. Ensure that data is present in the DTO returned from main
3. Add the IPC channel if needed (see `src/main/ipc/AGENTS.md`)
4. Keep components stateless where possible — they receive DTOs and emit commands

See [src/main/hlr/AGENTS.md](../main/hlr/AGENTS.md) for the HLR entity scope, which
determines which editors and list views need to be built.
