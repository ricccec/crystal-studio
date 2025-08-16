import { newProject } from '@main/services/projectServices';
import type { ActionResult, ProcessResult, ProjectSettings} from '@shared/types/types';
import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('api', {
    platform: process.platform,

    newProject : (): Promise<ActionResult> => ipcRenderer.invoke('new-project'),
    saveProject : (): Promise<ProcessResult> => ipcRenderer.invoke('save-project'),
    saveProjectAs : (savePath: string): Promise<ProcessResult> => ipcRenderer.invoke('save-project-as', savePath),
    openProject : (): Promise<ProcessResult<ProjectSettings>> => ipcRenderer.invoke('open-project'),
    openSaveDialog : (options?: Electron.SaveDialogOptions): Promise<ProcessResult> => ipcRenderer.invoke('open-save-dialog', options),
    openSaveProjectDialog : (): Promise<ProcessResult> => ipcRenderer.invoke('open-save-project-dialog'),
});