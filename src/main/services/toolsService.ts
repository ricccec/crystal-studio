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
    | { ok: true, exec: string, version: string}
    | { ok: false, error: string };

type CheckToolsFn = (
    tools: { name: string, path?: string | null, aliases?: string[] | null }[],
) => Promise<{
    tool: string,
    status: CheckToolsResult,
}[]>;

type CheckToolFn = (
    name: string, path?: string | null, aliases?: string[] | null
) => Promise<CheckToolsResult>;

function createToolsService(deps: ToolsServiceDeps): ToolsService {
    return {
        checkTools: async (tools) => await checkTools(tools, deps),
        checkTool: async (
            name: string,
            path?: string | null,
            aliases?: string[] | null
        ) => await checkTool(name, deps, path, aliases),
    };
}

const checkTools = async (
    tools: { name: string, path?: string | null, aliases?: string[] | null }[],
    deps: ToolsServiceDeps
) => {

    const res: { tool: string, status: CheckToolsResult }[] = [];
    for (const t of tools) {
      const r = await checkTool(t.name, deps, t.path, t.aliases);

      res.push({ tool: t.name, status: r });
    }

    return res;
}

const checkTool = async (
    name: string,
    deps: ToolsServiceDeps,
    path?: string | null,
    aliases?: string[] | null
): Promise<CheckToolsResult> => {
    
    // Find executable/command for this tool
    const r = await deps.findToolCandidate(
        name,
        process.platform === 'win32',
        path,
        aliases
    )

    if (!r.ok) {
        return { ok: false, error: `Command ${name} not found`};
    }

    // Get tool version
    const res = await deps.execAsync(r.cmd, ['--version']);
    switch(res.status) {
        case 'success': return { ok: true, exec: r.cmd, version: res.stdout.trim() } as CheckToolsResult;
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