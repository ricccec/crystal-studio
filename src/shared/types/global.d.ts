import type { ProcessResult } from "./types";

export {};

declare global {

    interface Window {
        api: {
            saveProject: () => Promise<ProcessResult>;
            saveProjectAs: (path: string) => Promise<ProcessResult>;
            openSaveProjectDialog: () => Promise<ProcessResult>;
            openSaveDialog : (options?: Electron.SaveDialogOptions) => Promise<ProcessResult>,
        };
    }
}