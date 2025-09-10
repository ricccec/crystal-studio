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

function createToolsService(platform: string, deps: ToolsServiceDeps): ToolsService {
    return {
        checkTools: async (tools) => await checkTools(tools, platform, deps),
        checkTool: async (
            name: string,
            path?: string | null,
            aliases?: string[] | null
        ) => await checkTool(name, platform, deps, path, aliases),
    };
}

const checkTools = async (
    tools: { name: string, path?: string | null, aliases?: string[] | null }[],
    platform: string,
    deps: ToolsServiceDeps
) => {

    const res: { tool: string, status: CheckToolsResult }[] = [];
    for (const t of tools) {
      const r = await checkTool(t.name, platform, deps, t.path, t.aliases);

      res.push({ tool: t.name, status: r });
    }

    return res;
}

const checkTool = async (
    name: string,
    platform: string,
    deps: ToolsServiceDeps,
    path?: string | null,
    aliases?: string[] | null
): Promise<CheckToolsResult> => {
    
    // Find executable/command for this tool
    const r = await deps.findToolCandidate(
        name,
        platform === 'win32',
        path,
        aliases
    )

    if (!r.ok) {
        return { ok: false, error: `Command ${name} not found`};
    }

    // Get tool version
    const res = await deps.execAsync(r.cmd, ['--version']);
    
    if(res.status === 'success') {
        // Parse semver token
        const tokenRe = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?)/;
        const m = res.stdout.match(tokenRe);
        const version = m ? m[1] : res.stdout.split('\n')[0].trim();
        return { ok: true, exec: r.cmd, version } as CheckToolsResult
    }
    if (res.status === 'error') return { ok: false, error: res.error } as CheckToolsResult;
    if (res.status === 'canceled') return { ok: false, error: res.signal } as CheckToolsResult;
    return { ok: false, error: 'Unknown error' } as CheckToolsResult;

}

export type {
    ToolsService,
    ToolsServiceDeps,
};

export {
    createToolsService,
}

export default createToolsService;