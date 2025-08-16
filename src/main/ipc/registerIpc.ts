import type { ProjectService } from "@main/services/projectServices";
import type { ReadSettingsFn, WriteSettingsFn } from "@main/utils/settings";
import type { OpenOpenDialogFn, OpenSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from 'path';


export function registerIpc(
    win: BrowserWindow,
    appSettings: AppSettings,
    projectSettings: ProjectSettings,
    // Injected deps.
    openSaveDialog: OpenSaveDialogFn,
    openOpenDialog: OpenOpenDialogFn,
    saveAppSettings: () => Promise<ActionResult>,
    projectService: ProjectService,
    writeSettings: WriteSettingsFn,
    readSettings: ReadSettingsFn,
) {

    ipcMain.handle('update-settings', (_, newSettings : ProjectSettings) => {
        Object.assign(projectSettings, newSettings); 
    });


    ipcMain.handle('open-save-dialog', async (_, options?: Electron.SaveDialogOptions) : Promise<ProcessResult> => {
        return await openSaveDialog(win, options);
    });

    ipcMain.handle('open-save-project-dialog', async () : Promise<ProcessResult> => {
        const res = await openSaveDialog(win, {
            title: 'Save project',
            defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
            filters: [
                { name: 'JSON files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        if (res.status === 'success') {
            // Update last used path and persist
            const filePath = res.data;
            appSettings.lastUsedPath = path.parse(filePath).dir;
            await saveAppSettings();
        }

        return res;
    });

    ipcMain.handle('new-project', async () : Promise<ActionResult> => {
        projectService.newProject(projectSettings);
        return { ok: true };
    });

    ipcMain.handle('save-project', async () : Promise<ProcessResult> => {
        let savePath = projectSettings.projectPath;
        if (!savePath) {
            const result = await openSaveDialog(win, {
                title: 'Save project',
                defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
                filters: [
                    { name: 'JSON files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.status !== 'success') return result;

            // Update last used path and persist
            const filePath = result.data;
            appSettings.lastUsedPath = path.parse(filePath).dir;
            await saveAppSettings();

            savePath = result.data;
        }
        return await projectService.saveProjectAs(projectSettings, savePath, { writeSettings });
    });

    ipcMain.handle('save-project-as', async (_, savePath: string) : Promise<ProcessResult> => {
        return await projectService.saveProjectAs(projectSettings, savePath, { writeSettings });
    });

    ipcMain.handle('open-project', async () : Promise<ProcessResult<ProjectSettings>> => {

        let openPath = null;
        try {
            const res = await openOpenDialog(win, {
                title: 'Open project',
                defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
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
        appSettings.lastUsedPath = path.parse(openPath).dir;
        await saveAppSettings();

        const result = await projectService.openProject(openPath, { readSettings });
        if (!result.ok) return { status: 'error', error: result.error };
        
        // Update project settings and return
        Object.assign(projectSettings, result.data);
        return { status: 'success', data: projectSettings };
        
    });

}