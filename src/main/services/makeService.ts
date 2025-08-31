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
    rgbdsDir?: string | null,
    env?: NodeJS.ProcessEnv | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {
    return {
        runMake: (
            targetDir,
            makeExec,
            rgbdsDir,
            env,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(targetDir, deps, makeExec, rgbdsDir, env, onOutput),
    }
}

const runMake = async (
    cwd: string,
    deps: MakeServiceDeps,
    makeExec?: string | null,
    rgbdsDir?: string | null,
    env?: NodeJS.ProcessEnv | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {
    
    const opts: string[] = [];
    if (rgbdsDir) opts.push(`RGBDS=${rgbdsDir}`);
    
    return await deps.execAsync(makeExec ?? 'make', opts, onOutput, { cwd, env: env ?? undefined });
};

export type {
    MakeService,
    MakeServiceDeps,
};

export {
    createMakeService,
}

export default createMakeService;