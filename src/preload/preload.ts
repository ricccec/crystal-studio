import { allowedChannels, Channel } from '@shared/ipc';
import type {
    ActionResult,
    AppSettings,
    ProcessResult,
    ProjectSettings,
    SpawnResult
 } from '@shared/types/types';
import { contextBridge, ipcRenderer } from 'electron';

const listenerMap = new Map<
    Channel,
    Map<(...args: any[]) => void, (evt: Electron.IpcRendererEvent, ...args: any[]) => void>
>();

contextBridge.exposeInMainWorld('api', {
    platform: process.platform,

    // Application IPCs
    getAppSettings : (): Promise<AppSettings> => ipcRenderer.invoke('get-app-settings'),
    resetAppSetting : (): Promise<ActionResult> => ipcRenderer.invoke('reset-app-settings'),
    setMakeFolder : (makePath: string): Promise<ActionResult> => ipcRenderer.invoke('set-make-folder', makePath),
    setRgbdsFolder : (rgbdsDir: string): Promise<ActionResult> => ipcRenderer.invoke('set-rgbds-folder', rgbdsDir),
    setGccFolder : (rgbdsDir: string): Promise<ActionResult> => ipcRenderer.invoke('set-gcc-folder', rgbdsDir),
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

    // Make IPCs
    runMake: (): Promise<SpawnResult> => ipcRenderer.invoke('run-make'),

    // Subscribe to a whitelisted renderer event channel
    on: (channel: Channel, listener: (...args: any[]) => void) => {
        if (!allowedChannels.includes(channel)) throw new Error('Channel not allowed');

        const perChannel = listenerMap.get(channel) ?? new Map();
        const wrapper = (evt: Electron.IpcRendererEvent, ...args: any[]): void => {
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
});