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
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {

    return {
        runMake: (
            targetDir: string,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(targetDir, deps, null, null, onOutput),
    }
}

const runMake = async (
    targetDir: string,
    deps: MakeServiceDeps,
    makePath?: string | null,
    makeAliases?: string[] | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {



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