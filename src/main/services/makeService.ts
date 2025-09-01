import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, ProjectSettings, SpawnResult } from "@shared/types/types";
import path from "node:path";

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
    shell?: string | null,
    env?: NodeJS.ProcessEnv | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {
    return {
        runMake: (
            cwd,
            makeExec,
            shell,
            env,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(cwd, deps, makeExec, shell, env, onOutput),
    }
}

const runMake = async (
    cwd: string,
    deps: MakeServiceDeps,
    makeExec?: string | null,
    shell?: string | null,
    env?: NodeJS.ProcessEnv | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {
    
    return await deps.execAsync(makeExec ?? 'make', null, shell, onOutput, { cwd, env: env ?? undefined });
};

export type {
    MakeService,
    MakeServiceDeps,
};

export {
    createMakeService,
}

export default createMakeService;