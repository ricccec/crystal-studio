import { Channel } from "@shared/ipc";
import type {
    ActionResult,
    AppSettings,
    ProcessResult,
    SpawnResult
} from "./types";
import type { ProjectSettings } from './types';

export {};

declare global {

    interface Window {
        api: {
            platform: NodeJS.Platform,

            // Application IPCs
            restartApp : () => Promise<ActionResult>;
            getAppSettings : () => Promise<AppSettings>;
            resetAppSetting : ()=> Promise<ActionResult>;
            openAppSetting : () => Promise<ActionResult>;
            setMakeFolder : (makePath: string) =>  Promise<ActionResult>;    
            setRgbdsFolder : (rgbdsDir: string) =>  Promise<ActionResult>;
            setCygwinFolder : (cygWinDir: string) => Promise<ActionResult>;
            setGccFolder : (rgbdsDir: string) =>  Promise<ActionResult>;
            setBashFolder : (bashDir: string) => Promise<ActionResult>;
            setEmulator : (emulatorExec: string) =>  Promise<ActionResult>;

            // Project lifecycle IPCs
            newProject: () => Promise<ActionResult>;
            saveProject: () => Promise<ProcessResult>;
            saveProjectAs: (savepath: string) => Promise<ProcessResult>;
            openProject : () => Promise<ProcessResult<ProjectSettings>>;
            getProjectSettings: () =>  Promise<ActionResult<ProjectSettings>>;

            // Dialog IPCs
            showSaveProjectDialog: () => Promise<ProcessResult>;
            showSaveDialog : (options?: Electron.SaveDialogOptions) => Promise<ProcessResult>;
            showOpenDirDialog : (title: string) => Promise<ProcessResult>;
            showOpenFileDialog : (title: string, fileFilters?: Electron.FileFilter[]) => Promise<ProcessResult>;

            // Shared tools IPCs
            checkTools: () => any;

            // Git IPCs
            openGitRepo: (repoPath: string) =>  Promise<ActionResult>;
            cloneGitRepo: (repoUrl: string, targetPath: string) => Promise<SpawnResult>;
            cloneDefaultGitRepo: (targetPath: string) => Promise<SpawnResult>;
            
            // ROM building IPCs
            runMake: () => Promise<SpawnResult>;
            runEmulator: () => Promise<SpawnResult>

            // Event helpers
            on: (channel: Channel, listener: (...args: any[]) => void) => (() => void);
            off: (channel: Channel, listener: (...args: any[]) => void) => void;
        };
    }
}