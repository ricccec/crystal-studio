import type {
    ActionResult,
    ProcessResult,
    ProjectSettings,
    SpawnResult
 } from '@shared/types/types';
import { contextBridge, ipcRenderer } from 'electron';


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

    // Git IPCs
    openGitRepo: (repoPath: string):  Promise<ActionResult> => ipcRenderer.invoke('git-open-repo', repoPath),
    cloneGitRepo: (repoUrl: string, targetPath: string): Promise<SpawnResult> => ipcRenderer.invoke('git-clone', repoUrl, targetPath),
});