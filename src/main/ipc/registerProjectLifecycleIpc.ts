import type { ProjectService } from "@main/services/projectService";
import type { ReadJsonFn, WriteJsonFn } from "@main/utils/jsonPersistence";
import type { ShowOpenDialogFn, ShowSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { IpcChannels } from "@shared/ipc";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from 'path';
import { AppSettingsService } from "@main/services/appSettingsService";


export function registerProjectLifecycleIpc(
    win: BrowserWindow,
    projectSettings: ProjectSettings,
    // Injected deps.
    showSaveDialog: ShowSaveDialogFn,
    showOpenDialog: ShowOpenDialogFn,
    services: {
        projectService: ProjectService,
        appSettingsService: AppSettingsService,
     },
) {
    const { getAppSettings, saveAppSettings } = services.appSettingsService;

    ipcMain.handle(IpcChannels.PROJECT_GET_SETTINGS, async (): Promise<ActionResult<ProjectSettings>> => { 
        return { ok: true, data: projectSettings };
    });

    ipcMain.handle(IpcChannels.PROJECT_UPDATE_SETTINGS, async (_, newSettings : Partial<ProjectSettings>) => {
        Object.assign(projectSettings, newSettings); 
    });

    ipcMain.handle(IpcChannels.PROJECT_NEW, async () : Promise<ActionResult> => {
        services.projectService.newProject(projectSettings);
        return { ok: true };
    });

    ipcMain.handle(IpcChannels.PROJECT_SAVE, async () : Promise<ProcessResult> => {
        let savePath = projectSettings.projectPath;
        if (!savePath) {
            const result = await showSaveDialog(win, {
                title: 'Save project',
                defaultPath: getAppSettings().lastUsedPath ?? app.getPath('documents'),
                filters: [
                    { name: 'JSON files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.status !== 'success') return result;

            // Update last used path and persist
            const filePath = result.data;
            getAppSettings().lastUsedPath = path.parse(filePath).dir;
            await saveAppSettings();

            savePath = result.data;
        }
        return await services.projectService.saveProjectAs(projectSettings, savePath);
    });

    ipcMain.handle(IpcChannels.PROJECT_SAVE_AS, async (_, savePath: string) : Promise<ProcessResult> => {
        return await services.projectService.saveProjectAs(projectSettings, savePath);
    });

    ipcMain.handle(IpcChannels.PROJECT_OPEN, async () : Promise<ProcessResult<ProjectSettings>> => {

        let openPath = null;
        try {
            const res = await showOpenDialog(win, {
                title: 'Open project',
                defaultPath: getAppSettings().lastUsedPath ?? app.getPath('documents'),
                filters: [
                    { name: 'JSON files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });

            if (res.status !== 'success') return { status: 'canceled' };
            openPath = res.data;
        } catch (e: any) {
            return { status: 'error', error: e?.message ?? String(e) };
        }

        // Update last used path and persist
        getAppSettings().lastUsedPath = path.parse(openPath).dir;
        await saveAppSettings();

        const result = await services.projectService.openProject(openPath);
        if (!result.ok) return { status: 'error', error: result.error };
        
        // Update project settings and return
        Object.assign(projectSettings, result.data);
        return { status: 'success', data: projectSettings };
        
    });

}