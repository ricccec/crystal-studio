import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, ProjectSettings, SpawnResult } from "@shared/types/types";

type MakeServiceDeps = {
    execAsync: ExecAsyncFn;
    isDirectory: (path: string) => Promise<boolean>; 
};

type MakeService = {
    runMake: RunMakeFn;
}

type RunMakeFn = (
    targetDir: string,
    makeExec?: string | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {
    return {
        runMake: (
            targetDir,
            makeExec,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(targetDir, deps, makeExec, onOutput),
    }
}

const runMake = async (
    targetDir: string,
    deps: MakeServiceDeps,
    makeExec?: string | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {
    return await deps.execAsync(makeExec ?? 'make', null, onOutput, { cwd: targetDir });
};

export type {
    MakeService,
    MakeServiceDeps,
};

export {
    createMakeService,
}

export default createMakeService;