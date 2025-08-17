import { ExecAsyncFn } from "@main/utils/execAsync";
import { SpawnResult } from "@shared/types/types";

type CloneGitRepoFn = (
    repoUrl: string,
    targetDir: string,
    dev: {
        execAsync: ExecAsyncFn,
    },
) => Promise<SpawnResult>;

type GitService = {
    cloneGitRepo: CloneGitRepoFn;
}

const cloneGitRepo: CloneGitRepoFn = async (repoUrl, targetDir, dev) => {
    return await dev.execAsync('git', ['clone', repoUrl, targetDir]);
};

const gitService: GitService = {
    cloneGitRepo,
}

export type {
    CloneGitRepoFn,

    GitService,
};

export {
    cloneGitRepo,
}

export default gitService;

