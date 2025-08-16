import type { ActionResult, ProcessResult } from "./types";
import type { ProjectSettings } from './types';

export {};

declare global {

    interface Window {
        api: {
            platform: NodeJS.Platform,

            newProject: () => Promise<ActionResult>;
            saveProject: () => Promise<ProcessResult>;
            saveProjectAs: (savepath: string) => Promise<ProcessResult>;
            openProject : () => Promise<ProcessResult<ProjectSettings>>,
            openSaveProjectDialog: () => Promise<ProcessResult>;
            openSaveDialog : (options?: Electron.SaveDialogOptions) => Promise<ProcessResult>,
        };
    }
}