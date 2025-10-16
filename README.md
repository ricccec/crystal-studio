# Crystal Studio

A **GBStudio-style IDE** built on top of the [pret/pokecrystal](https://github.com/pret/pokecrystal) disassembly to edit game content and manage the full Game Boy ROM workflow.  
Built with **Electron**, **Vite**, **React**, and **TypeScript**.

---

## Goals

- Provide **disassembly-aware editors** for pokecrystal content (maps, connections, encounters, trainers, Pokémon data, items, scripts, text, etc.).
- Enable a **seamless ROM workflow**:
  - Configure toolchain and emulator paths.
  - Clone or open an existing pret/pokecrystal repo.
  - Build the ROM via `make`.
  - Run the game directly in an emulator.
  - Stream logs and build output inside the UI.

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript  
- **Backend:** Electron (main/preload)  
- **Testing:** Vitest  
- **Toolchain:** RGBDS, GNU make, Git, optional Python (used by pokecrystal build scripts)

---

## Getting Started

### Prerequisites (Windows)

- **Node.js 18+**
- **Cygwin** with `make`, `git`, and `gcc-core`
- **RGBDS** (`rgbasm`, `rgblink`, `rgbfix`)
- **Emulator** (e.g. BGB, Emulicious)

### Install & Run

```bash
npm install
npm run dev

