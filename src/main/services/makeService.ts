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
    cwd: string,
    makeExec?: string | null,
    numJobs?: number,
    target?: string,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {
    return {
        runMake: (
            cwd,
            makeExec,
            numJobs,
            target,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(cwd, deps, makeExec, numJobs, target, onOutput),
    }
}

const runMake = async (
    cwd: string,
    deps: MakeServiceDeps,
    makeExec?: string | null,
    numJobs?: number,
    target?: string,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {
    // Build args list
    const args = [];
    if(numJobs) args.push(`-j${numJobs}`);
    if(target) args.push(target);
    return await deps.execAsync(makeExec ?? 'make', args, onOutput, { cwd });
};

export type {
    MakeService,
    MakeServiceDeps,
};

export {
    createMakeService,
}

export default createMakeService;