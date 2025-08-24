import { ExecAsyncFn } from "@main/utils/execAsync";
import { ActionResult, ProjectSettings, SpawnResult } from "@shared/types/types";

type GitServiceDeps = {
    execAsync: ExecAsyncFn;
    isDirectory: (path: string) => Promise<boolean>; 
};

type GitService = {
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
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

function createGitService(deps: GitServiceDeps): GitService {

    return {

        openGitRepo: async (
            projectSettings: ProjectSettings,
            repoPath: string
        ) => await openGitRepo(projectSettings, repoPath, deps),

        cloneGitRepo: (
            repoUrl: string,
            targetDir: string,
            onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
        ) => cloneGitRepo(repoUrl, targetDir, deps, onOutput),
    }
}

const openGitRepo = async (
    projectSettings: ProjectSettings,
    repoPath: string,
    deps: GitServiceDeps
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
    dev: GitServiceDeps,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) : Promise<SpawnResult> => {
    return await dev.execAsync('git', ['clone', repoUrl, targetDir], onOutput);
};

export type {
    GitService,
    GitServiceDeps as GitRepoDeps,
};

export {
    createGitService,
}

export default createGitService;