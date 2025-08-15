import type { ProcessResult } from '@shared/types/types';
import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('api', {
    platform: process.platform,

    saveProject : (): Promise<ProcessResult> => ipcRenderer.invoke('save-project'),
    saveProjectAs : (path: string): Promise<ProcessResult> => ipcRenderer.invoke('save-project-as', path),
    openSaveDialog : (options?: Electron.SaveDialogOptions): Promise<ProcessResult> => ipcRenderer.invoke('open-save-dialog', options),
    openSaveProjectDialog : (): Promise<ProcessResult> => ipcRenderer.invoke('open-save-dialog'),

});