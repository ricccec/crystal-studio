import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, ProjectSettings, SpawnResult } from "@shared/types/types";

type MakeServiceDeps = {
    execAsync: ExecAsyncFn;
    isDirectory: (path: string) => Promise<boolean>; 
};

type MakeService = {
    runMake: RunMakeFn;
}

type CheckMakeFn = () => Promise<ActionResult<string>>;

type RunMakeFn = (
    targetDir: string,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {

    return {
        runMake: (
            targetDir: string,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(targetDir, deps, onOutput),
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