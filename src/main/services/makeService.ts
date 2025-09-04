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

type MakeOptions = {
    makeExec?: string | null,
    shell?: string | null,
    rgbdsDir?: string | null,
    env?: NodeJS.ProcessEnv | null,
};

type RunMakeFn = (
    cwd: string,
    numJobs?: number | null,
    target?: string | null,
    options?: MakeOptions | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createMakeService(deps: MakeServiceDeps): MakeService {
    return {
        runMake: (
            cwd,
            numJobs,
            target,
            options,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => runMake(cwd, deps,
            options?.makeExec ?? null,
            numJobs,
            target,
            options?.shell ?? null,
            options?.rgbdsDir ?? null,
            options?.env ?? null,
            onOutput),
    }
}

const runMake = async (
    cwd: string,
    deps: MakeServiceDeps,
    makeExec?: string | null,
    numJobs?: number | null,
    target?: string | null,
    shell?: string | null,
    rgbdsDir?: string | null,
    env?: NodeJS.ProcessEnv | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {

    // Build args list
    const args: string[] = [];
    if(numJobs) args.push(`-j${numJobs}`);
    if(target) args.push(target);
    if ((process.platform !== 'win32') && rgbdsDir) args.push(`RGBDS=${rgbdsDir}`);

    return await deps.execAsync(
        makeExec ?? 'make',
        args,
        shell,
        onOutput,
        { cwd, env: env ?? undefined });
};

export type {
    MakeOptions,
    MakeService,
    MakeServiceDeps,
};

export {
    createMakeService,
}

export default createMakeService;