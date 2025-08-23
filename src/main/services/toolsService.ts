import { ExecAsyncFn } from "@main/utils/execAsync";
import { FindToolCandidateFn } from "@main/utils/findToolCandidate";

type ToolsServiceDeps = {
    execAsync: ExecAsyncFn;
    findToolCandidate: FindToolCandidateFn;
};

type ToolsService = {
    checkTools : CheckToolsFn,
    checkTool: CheckToolFn;
}

type CheckToolsResult =
    | { ok: true, version: string}
    | { ok: false, error: string };

type CheckToolsFn = (
    tools: { name: string, path?: string | null, aliases?: string[] | null }[],
) => Promise<{
    tool: string,
    status: CheckToolsResult,
}[]>;

type CheckToolFn = (cmd: string) => Promise<CheckToolsResult>;

function createToolsService(deps: ToolsServiceDeps): ToolsService {
    return {
        checkTools: async (tools) => await checkTools(tools, deps),
        checkTool: async (cmd: string) => await checkTool(cmd, deps),
    };
}

const checkTools = async (
    tools: { name: string, path?: string | null, aliases?: string[] | null }[],
    deps: ToolsServiceDeps
) => {
    
    const res: { tool: string, status: CheckToolsResult }[] = [];
    for (const t of tools) {
        // Find executable/command for this tool
        const r = await deps.findToolCandidate(
            t.name,
            process.platform === 'win32',
            t.path,
            t.aliases
        )

        if (r.ok) {
            res.push({ tool: t.name, status: await checkTool(r.cmd, deps) });
        }
        else {
            res.push({ tool: t.name, status: { ok: false, error: `Command ${t.name} not found`} });
        }
    }

    return res;
}

const checkTool = async (cmd: string, deps: ToolsServiceDeps) => {
    const res = await deps.execAsync(cmd, ['--version']);
    switch(res.status) {
        case 'success': return { ok: true, version: res.stdout.trim() } as CheckToolsResult;
        case 'error': return { ok: false, error: res.error } as CheckToolsResult;
        case 'canceled': return { ok: false, error: res.signal } as CheckToolsResult;
        default: return  { ok: false, error: 'Unknown error' } as CheckToolsResult;
    }
}

export type {
    ToolsService,
    ToolsServiceDeps as ToolsServicesDeps,
};

export {
    createToolsService,
}

export default createToolsService;