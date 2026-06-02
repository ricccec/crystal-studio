# IPC Subsystem – Agent Context

This directory contains all **IPC channel registrations** for the Electron main process.

---

## Architecture

Crystal Studio follows a strict **main-process-owns-state** model:

```
Renderer  ──(invoke/send)──►  preload (contextBridge)  ──►  ipcMain handler
                                                               │
                                                          ServiceContainer
                                                               │
                                                        ◄── DTO response
```

- The **renderer never imports from `src/main/`**. All communication is via IPC.
- The **main process might sometime push unsolicited data to the renderer**, for instance
	- streaming channels (e.g. `TASK_STREAM`)
	- output of a long running task (eg. codebase validation task)
	- detected file changes in the pret codebase by an external application 
- All channel names are defined as constants in `src/shared/ipc.ts`. Never
  hardcode channel strings in handlers.

---

## File Map

| File | Purpose |
|---|---|
| `registerIpc.ts` | Entry point — wires all channel groups together |
| `registerAppIpc.ts` | App-level channels (restart, settings get/reset) |
| `registerProjectLifecycleIpc.ts` | Project open/save/new channels |
| `registerDialogIpc.ts` | Native dialog channels (open file, save file) |
| `registerToolsIpc.ts` | Tool path configuration channels |

**Not yet created (planned):**
- `registerParserIpc.ts` — trigger parse, get HLR snapshot, get parse issues
- `registerPatcherIpc.ts` — trigger patch/build, undo patch
- `registerHlrIpc.ts` — CRUD operations on HLR entities
- `registerGitIpc.ts` — commit, status, branch (git channels exist in `ipc.ts` but handler is not registered)
- `registerCommandStackIpc.ts` — undo, redo, get stack state

---

## DTO Pattern

IPC responses must be **plain serializable objects** (no class instances, no
functions, no `undefined` values). Use the `ActionResult<T>` or `ProcessResult<T>`
types from `src/shared/types/types.d.ts` as response wrappers.

```typescript
// Good
return { ok: true, data: { name: 'BULBASAUR', hp: 45 } };

// Bad — class instance, not serializable
return new PokemonSpecies('BULBASAUR', 45);
```

The renderer receives a **DTO snapshot** of the HLR — a plain JSON representation.
It does not receive live class instances. The full shape of HLR DTOs will be
defined alongside the HLR classes in `src/main/` (not yet created).

---

## Streaming Channels

Some operations (make, git clone, parser) are long-running and stream output.
Use the `TASK_STREAM` push channel (defined in `src/shared/ipc.ts`) for this:

```typescript
// Main process pushes to renderer:
win.webContents.send(IpcChannels.TASK_STREAM, {
    task: 'git-clone',
    id: taskId,
    stream: 'stdout',
    text: 'Cloning into ...',
    final: false,   // true on last message
} satisfies TaskStreamPayload);
```

The renderer subscribes to `TASK_STREAM` via the preload and renders output in
the integrated console panel. The `final: true` flag signals end of output.

---

## Conventions

- Each `register*Ipc.ts` file handles one logical domain.
- Handlers should be thin: validate input, call a service method, return result.
  Do not put business logic in handlers.
- All handlers should be `async` and wrapped in try/catch; return
  `{ ok: false, error: '...' }` on unexpected errors rather than throwing.
- `ipcMain.handle` is used for request/response (invoke from renderer).
- `ipcMain.on` is used only for fire-and-forget messages (very rare).

---

## Adding a New Channel

1. Add the channel constant to `IpcChannels` in `src/shared/ipc.ts`
2. Add a `register*Ipc.ts` file (or extend an existing one if closely related)
3. Register the new file in `registerIpc.ts`
4. Expose the channel to the renderer in `src/preload/preload.ts` if needed
