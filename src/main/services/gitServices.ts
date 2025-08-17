import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, ProjectSettings, SpawnResult } from "@shared/types/types";

type GitRepoDeps = {
    execAsync: ExecAsyncFn;
    isDirectory: (path: string) => Promise<boolean>; 
};

type GitService = {
    checkGit: CheckGitFn,
    openGitRepo: OpenGitRepoFn;
    cloneGitRepo: CloneGitRepoFn;
}

type CheckGitFn = () => Promise<ActionResult<string>>;

type OpenGitRepoFn = (
    projectSettings: ProjectSettings,
    repoPath: string,
) => Promise<ActionResult>;

type CloneGitRepoFn = (
    repoUrl: string,
    targetDir: string,
) => Promise<SpawnResult>;

function createGitService(deps: GitRepoDeps): GitService {

    return {
        checkGit: async () => await checkGit(deps),

        openGitRepo: async (
            projectSettings: ProjectSettings,
            repoPath: string
        ) => await openGitRepo(projectSettings, repoPath, deps),

        cloneGitRepo: (
            repoUrl: string,
            targetDir: string
        ) => cloneGitRepo(repoUrl, targetDir, deps),
    }
}

const checkGit = async (deps: GitRepoDeps) : Promise<ActionResult<string>> => {
    const rs = await deps.execAsync('git', ['--version']);;
    switch(rs.status) {
        case 'success': return { ok: true, data: rs.stdout };
        case 'error': return { ok: false, error: rs.error };
        case 'canceled': return { ok: false, error: rs.signal ?? '' };
        default: return { ok: false, error: 'Unknown error' };
    }
}

const openGitRepo = async (
    projectSettings: ProjectSettings,
    repoPath: string,
    deps: GitRepoDeps
) : Promise<ActionResult> => {
    // Check if it's a valid dir
    try {
        const isDir = await deps.isDirectory(repoPath);
        if (!isDir) return { ok: false, error: 'Not a directory' };
    } catch (e: any) {
        return { ok: false,  error: e?.message ?? String(e) };
    }

    // Update project settings
    projectSettings.repoPath = repoPath;
    return { ok: true };
}

const cloneGitRepo = async (
    repoUrl: string,
    targetDir: string,
    dev: GitRepoDeps
) : Promise<SpawnResult> => {
    return await dev.execAsync('git', ['clone', repoUrl, targetDir]);
};

export type {
    GitService,
};

export {
    createGitService,
}

export default createGitService;

