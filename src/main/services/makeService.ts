import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, ProjectSettings, SpawnResult } from "@shared/types/types";

type MakeServiceDeps = {
    execAsync: ExecAsyncFn;
    isDirectory: (path: string) => Promise<boolean>; 
};

type MakeService = {
    checkMake: CheckMakeFn,
    runMake: RunMakeFn;
}

type CheckMakeFn = () => Promise<ActionResult<string>>;

type RunMakeFn = (
    targetDir: string,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {

    return {
        checkMake: async () => await checkMake(deps),

        runMake: (
            targetDir: string,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(targetDir, deps, onOutput),
    }
}

const checkMake = async (deps: MakeServiceDeps) : Promise<ActionResult<string>> => {
    const rs = await deps.execAsync('make', ['--version']);;
    switch(rs.status) {
        case 'success': return { ok: true, data: rs.stdout };
        case 'error': return { ok: false, error: rs.error };
        case 'canceled': return { ok: false, error: rs.signal ?? '' };
        default: return { ok: false, error: 'Unknown error' };
    }
}

const runMake = async (
    targetDir: string,
    deps: MakeServiceDeps,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {

    // Check if it's a valid dir
    try {
        const isDir = await deps.isDirectory(targetDir);
        if (!isDir) return { status:'error', error:'Not a directory' };
    } catch (e: any) {
        return { status:'error',  error: e?.message ?? String(e) };
    }

    return await deps.execAsync('make', [targetDir], onOutput);
};

export type {
    MakeService,
    MakeServiceDeps,
};

export {
    createMakeService,
}

export default createMakeService;