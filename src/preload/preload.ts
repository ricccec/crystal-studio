import { allowedChannels, Channel } from '@shared/ipc';
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
    restartApp : (): Promise<ActionResult> => ipcRenderer.invoke('restart-app'), 
    getAppSettings : (): Promise<AppSettings> => ipcRenderer.invoke('get-app-settings'),
    resetAppSetting : (): Promise<ActionResult> => ipcRenderer.invoke('reset-app-settings'),
    openAppSetting : (): Promise<ActionResult> => ipcRenderer.invoke('open-app-settings'),
    setMakeFolder : (makePath: string): Promise<ActionResult> => ipcRenderer.invoke('set-make-folder', makePath),
    setRgbdsFolder : (rgbdsDir: string): Promise<ActionResult> => ipcRenderer.invoke('set-rgbds-folder', rgbdsDir),
    setCygwinFolder : (cygWinDir: string): Promise<ActionResult> => ipcRenderer.invoke('set-cygwin-folder', cygWinDir),
    setGccFolder : (gccDir: string): Promise<ActionResult> => ipcRenderer.invoke('set-gcc-folder', gccDir),
    setBashFolder : (bashDir: string): Promise<ActionResult> => ipcRenderer.invoke('set-bash-folder', bashDir),
    setEmulator : (emulatorExec: string): Promise<ActionResult> => ipcRenderer.invoke('set-emulator', emulatorExec),

    // Project lifecycle IPCs
    newProject : (): Promise<ActionResult> => ipcRenderer.invoke('new-project'),
    saveProject : (): Promise<ProcessResult> => ipcRenderer.invoke('save-project'),
    saveProjectAs : (savePath: string): Promise<ProcessResult> => ipcRenderer.invoke('save-project-as', savePath),
    openProject : (): Promise<ProcessResult<ProjectSettings>> => ipcRenderer.invoke('open-project'),
    getProjectSettings: (): Promise<ActionResult<ProjectSettings>> => ipcRenderer.invoke('get-project-settings'),

    // Dialog IPCs
    showSaveDialog : (options?: Electron.SaveDialogOptions): Promise<ProcessResult> => ipcRenderer.invoke('show-save-dialog', options),
    showSaveProjectDialog : (): Promise<ProcessResult> => ipcRenderer.invoke('show-save-project-dialog'),
    showOpenDirDialog : (title: string): Promise<ProcessResult> => ipcRenderer.invoke('show-open-dir-dialog', title),
    showOpenFileDialog : (title: string, fileFilters?: Electron.FileFilter[]): Promise<ProcessResult> => ipcRenderer.invoke('show-open-file-dialog', title, fileFilters),

    // Shared tools IPCs
    checkTools: () => ipcRenderer.invoke('check-tools'),

    // Git IPCs
    openGitRepo: (repoPath: string):  Promise<ActionResult> => ipcRenderer.invoke('git-open-repo', repoPath),
    cloneGitRepo: (repoUrl: string, targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke('git-clone', repoUrl, targetPath),
    cloneDefaultGitRepo: (targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke('git-clone-default', targetPath),

    // ROM building IPCs
    runMake: (): Promise<SpawnResult> => ipcRenderer.invoke('run-make'),
    runEmulator: (): Promise<SpawnResult> => ipcRenderer.invoke('run-emulator'),

    // Subscribe to a whitelisted renderer event channel
    on: (channel: Channel, listener: (...args: any[]) => void) => {
        if (!allowedChannels.includes(channel)) throw new Error('Channel not allowed');

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
            if (!allowedChannels.includes(channel)) throw new Error('Channel not allowed');

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
            if (!allowedChannels.includes(channel)) throw new Error('Channel not allowed');

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