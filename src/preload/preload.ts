import { allowedChannels, Channel } from '@shared/ipc';
import type {
    ActionResult,
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

    // Project lifecycle IPCs
    newProject : (): Promise<ActionResult> => ipcRenderer.invoke('new-project'),
    saveProject : (): Promise<ProcessResult> => ipcRenderer.invoke('save-project'),
    saveProjectAs : (savePath: string): Promise<ProcessResult> => ipcRenderer.invoke('save-project-as', savePath),
    openProject : (): Promise<ProcessResult<ProjectSettings>> => ipcRenderer.invoke('open-project'),
    
    // Dialog IPCs
    showSaveDialog : (options?: Electron.SaveDialogOptions): Promise<ProcessResult> => ipcRenderer.invoke('show-save-dialog', options),
    showSaveProjectDialog : (): Promise<ProcessResult> => ipcRenderer.invoke('show-save-project-dialog'),
    showOpenDirDialog : (title: string): Promise<ProcessResult> => ipcRenderer.invoke('show-open-dir-dialog', title),

    // Git IPCs
    checkGit: (): Promise<ActionResult<string>> => ipcRenderer.invoke('git-check'),
    openGitRepo: (repoPath: string):  Promise<ActionResult> => ipcRenderer.invoke('git-open-repo', repoPath),
    cloneGitRepo: (repoUrl: string, targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke('git-clone', repoUrl, targetPath),
    cloneDefaultGitRepo: (targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke('git-clone-default', targetPath),

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