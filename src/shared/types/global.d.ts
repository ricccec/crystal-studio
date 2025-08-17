import type {
    ActionResult,
    ProcessResult,
    SpawnResult
} from "./types";
import type { ProjectSettings } from './types';

export {};

declare global {

    interface Window {
        api: {
            platform: NodeJS.Platform,

            // Project lifecycle IPCs
            newProject: () => Promise<ActionResult>;
            saveProject: () => Promise<ProcessResult>;
            saveProjectAs: (savepath: string) => Promise<ProcessResult>;
            openProject : () => Promise<ProcessResult<ProjectSettings>>,

            // Dialog IPCs
            showSaveProjectDialog: () => Promise<ProcessResult>;
            showSaveDialog : (options?: Electron.SaveDialogOptions) => Promise<ProcessResult>,

            // Git IPCs
            checkGit: () => Promise<ActionResult<string>>;
            openGitRepo: (repoPath: string) =>  Promise<ActionResult>;
            cloneGitRepo: (repoUrl: string, targetPath: string) => Promise<SpawnResult>;
        };
    }
}