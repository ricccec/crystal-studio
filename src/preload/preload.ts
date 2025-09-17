import { AllowedChannels, Channel, IpcChannels } from '@shared/ipc';
import type {
    ActionResult,
    AppSettings,
    ProcessResult,
    ProjectSettings,
    SpawnResult
 } from '@shared/types/types';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const listenerMap = new Map<
    Channel,
    Map<(...args: any[]) => void, (evt: Electron.IpcRendererEvent, ...args: any[]) => void>
>();

contextBridge.exposeInMainWorld('api', {
    platform: process.platform,

    // Application IPCs
    restartApp : (): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.APP_RESTART), 
    getAppSettings : (): Promise<AppSettings> => ipcRenderer.invoke(IpcChannels.APP_GET_SETTINGS),
    resetAppSetting : (): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.APP_RESET_SETTINGS),
    openAppSetting : (): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.APP_OPEN_SETTINGS),

    // Tool configuration IPCs
    setMakeFolder : (makePath: string): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.TOOLS_SET_MAKE_FOLDER, makePath),
    setRgbdsFolder : (rgbdsDir: string): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.TOOLS_SET_RGBDS_FOLDER, rgbdsDir),
    setCygwinFolder : (cygWinDir: string): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.TOOLS_SET_CYGWIN_FOLDER, cygWinDir),
    setGccFolder : (gccDir: string): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.TOOLS_SET_GCC_FOLDER, gccDir),
    setBashFolder : (bashDir: string): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.TOOLS_SET_BASH_FOLDER, bashDir),
    setEmulator : (emulatorExec: string): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.TOOLS_SET_EMULATOR, emulatorExec),
    checkTools: () => ipcRenderer.invoke(IpcChannels.TOOLS_CHECK),

    // Project lifecycle IPCs
    newProject : (): Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.PROJECT_NEW),
    saveProject : (): Promise<ProcessResult> => ipcRenderer.invoke(IpcChannels.PROJECT_SAVE),
    saveProjectAs : (savePath: string): Promise<ProcessResult> => ipcRenderer.invoke(IpcChannels.PROJECT_SAVE_AS, savePath),
    openProject : (): Promise<ProcessResult<ProjectSettings>> => ipcRenderer.invoke(IpcChannels.PROJECT_OPEN),
    getProjectSettings: (): Promise<ActionResult<ProjectSettings>> => ipcRenderer.invoke(IpcChannels.PROJECT_GET_SETTINGS),

    // Dialog IPCs
    showSaveDialog : (options?: Electron.SaveDialogOptions): Promise<ProcessResult> => ipcRenderer.invoke(IpcChannels.DIALOG_SHOW_SAVE, options),
    showSaveProjectDialog : (): Promise<ProcessResult> => ipcRenderer.invoke(IpcChannels.DIALOG_SHOW_SAVE_PROJECT),
    showOpenDirDialog : (title: string): Promise<ProcessResult> => ipcRenderer.invoke(IpcChannels.DIALOG_SHOW_OPEN_DIR, title),
    showOpenFileDialog : (title: string, fileFilters?: Electron.FileFilter[]): Promise<ProcessResult> => ipcRenderer.invoke(IpcChannels.DIALOG_SHOW_OPEN_FILE, title, fileFilters),

    // Git IPCs
    openGitRepo: (repoPath: string):  Promise<ActionResult> => ipcRenderer.invoke(IpcChannels.GIT_OPEN_REPO, repoPath),
    cloneGitRepo: (repoUrl: string, targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke(IpcChannels.GIT_CLONE, repoUrl, targetPath),
    cloneDefaultGitRepo: (targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke(IpcChannels.GIT_CLONE_DEFAULT, targetPath),

    // ROM building IPCs
    runMake: (): Promise<SpawnResult> => ipcRenderer.invoke(IpcChannels.BUILD_RUN_MAKE),
    runEmulator: (): Promise<SpawnResult> => ipcRenderer.invoke(IpcChannels.EMULATOR_RUN),

    // Subscribe to a whitelisted renderer event channel
    on: (channel: Channel, listener: (...args: any[]) => void) => {
        if (!AllowedChannels.includes(channel)) throw new Error('Channel not allowed');

        const perChannel = listenerMap.get(channel) ?? new Map();
        const wrapper = (evt: IpcRendererEvent, ...args: any[]): void => {
            try {
                // forward only the payload (no event object)
                listener(...args);
            } catch { /* Swallow to avoid breaking IPC internals */ }
        }
        perChannel.set(listener, wrapper);
        listenerMap.set(channel, perChannel);
        ipcRenderer.on(channel, wrapper);

        // Return unsubscribe helper
        return () => {
            ipcRenderer.off(channel, wrapper);
            perChannel.delete(listener);
            if (perChannel.size === 0) listenerMap.delete(channel);
        }
    },

    // Unsubscribe to event channel
    off: (channel: Channel, listener: any) => {
        const perChannel = listenerMap.get(channel);
        if (!perChannel) return;
        const wrapper = perChannel.get(listener);
        if (wrapper) {
            ipcRenderer.off(channel, wrapper);
            perChannel.delete(listener);
            if (perChannel.size === 0) listenerMap.delete(channel);
        }

    },

    once: {
        // Callback style
        subscribe: (
            channel: Channel,
            listener: (...args: any[]) => void,
        ) => {
            if (!AllowedChannels.includes(channel)) throw new Error('Channel not allowed');

            const wrapper = (evt: IpcRendererEvent, ...args: any[]): void => {
                try {
                    // forward only the payload (no event object)
                    listener(...args);
                } catch { /* Swallow to avoid breaking IPC internals */ }
            }
            
            ipcRenderer.once(channel, wrapper);
            
            // allow removing before it fires
            return () => {
                try { ipcRenderer.removeListener(channel, wrapper); } catch {}
            };
        },
        // Promise style
        asPromise: <T = any>(
            channel: Channel,
            timeoutMs?: number,
        ): Promise<T> => {
            if (!AllowedChannels.includes(channel)) throw new Error('Channel not allowed');

            return new Promise<T>((resolve, reject) => {
                const timer = (timeoutMs && timeoutMs > 0) ? setTimeout(() => {
                    try { ipcRenderer.removeListener(channel, handler); } catch {}
                    reject(new Error('IPC once timeout'));
                }) : null;

                const handler = (_: IpcRendererEvent, ...args: any[]) => {
                    if (timer) clearTimeout(timer);
                    const payload = args.length > 1 ? (args as unknown as T) : (args[0] as T);
                    resolve(payload);
                };
                ipcRenderer.once(channel, handler);
            });
        }
    }
});