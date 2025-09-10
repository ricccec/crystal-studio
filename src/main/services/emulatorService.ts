import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, SpawnResult } from "@shared/types/types";
import fs  from "node:fs/promises";

type EmulatorServiceDeps = {
    execAsync: ExecAsyncFn;
    isExecutable: (p: string) => Promise<Boolean>;
};

type EmulatorService = {
    loadRom: LoadRomFn;
}

type LoadRomFn = (
    emulatorPath: string,
    romPath: string,
) => Promise<SpawnResult>;

function createEmulatorService(deps: EmulatorServiceDeps): EmulatorService {
    return {
        loadRom: async (
            emulatorPath: string,
            romPath: string,
        ) => await loadRom(emulatorPath, romPath, deps),
    }
}

const loadRom = async (
    emulatorPath: string,
    romPath: string,
    deps: EmulatorServiceDeps
) : Promise<SpawnResult> => {

    // Check emulator's executable
    const isExec = await deps.isExecutable(emulatorPath);
    if (!isExec) return { status: 'error', error: `${emulatorPath} is not an executable` };

    // Check ROM path
    try {
        const s = await fs.stat(romPath);
        if (!s.isFile()) return { status: 'error', error: `${romPath} is not a valid ROM file` };
    } catch(e: any) {
        return { status: 'error',  error: e?.message ?? String(e) };
    }

    // Run emulator
    const res = await deps.execAsync(emulatorPath, [romPath]);
    return res;
}

export type {
    EmulatorService,
    EmulatorServiceDeps,
};

export {
    createEmulatorService,
}

export default createEmulatorService;