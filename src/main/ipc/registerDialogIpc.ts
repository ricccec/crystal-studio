import type { ShowOpenDialogFn, ShowSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from 'path';


export function registerDialogIpc(
    win: BrowserWindow,
    appSettings: AppSettings,
    // Injected deps.
    showSaveDialog: ShowSaveDialogFn,
    showOpenDialog: ShowOpenDialogFn,
    saveAppSettings: () => Promise<ActionResult>,
) {

    ipcMain.handle('show-save-dialog', async (_, options?: Electron.SaveDialogOptions) : Promise<ProcessResult> => {
        return await showSaveDialog(win, options);
    });

    ipcMain.handle('show-save-project-dialog', async () : Promise<ProcessResult> => {
        const res = await showSaveDialog(win, {
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

    ipcMain.handle('show-open-dir-dialog', async (_, title: string) : Promise<ProcessResult> => {
        const res = await showOpenDialog(win, {
            title: title,
            defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
            properties: ['openDirectory'],
        });

        if (res.status === 'success') {
            // Update last used path and persist
            const filePath = res.data;
            appSettings.lastUsedPath = path.normalize(filePath);

            await saveAppSettings();
        }

        return res;
    });

}