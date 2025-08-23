import { ExecAsyncFn } from "@main/utils/execAsync";

type ToolsServicesDeps = {
    execAsync: ExecAsyncFn;
};

type ToolsService = {
    checkTools : CheckToolsFn,
    checkTool: CheckToolFn;
}

type CheckToolsResult =
    | { ok: true, version: string}
    | { ok: false, error: string };

type CheckToolsFn = () => Promise<{
    git: CheckToolsResult,
    make: CheckToolsResult,
}>;

type CheckToolFn = (cmd: string) => Promise<CheckToolsResult>;

function createToolsService(deps: ToolsServicesDeps): ToolsService {
    return {
        checkTools: async () => await checkTools(deps),
        checkTool: async (cmd: string) => await checkTool(cmd, deps),
    };
}
const checkTools = async (deps: ToolsServicesDeps) => {
    const git = await checkTool('git', deps);
    const make = await checkTool('make', deps);
    return {
        git,
        make,
    }
}

const checkTool = async (cmd: string, deps: ToolsServicesDeps) => {
    const res = await deps.execAsync(cmd, ["--version"]);
    switch(res.status) {
        case 'success': return { ok: true, version: res.stdout.trim() } as CheckToolsResult;
        case 'error': return { ok: false, error: res.error } as CheckToolsResult;
        case 'canceled': return { ok: false, error: res.signal } as CheckToolsResult;
        default: return  { ok: false, error: 'Unknown error' } as CheckToolsResult;
    }
}

export type {
    ToolsService,
    ToolsServicesDeps,
};

export {
    createToolsService,
}

export default createToolsService;