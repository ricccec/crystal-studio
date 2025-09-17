import type { ShowOpenDialogFn, ShowSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { IpcChannels } from "@shared/ipc";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from 'path';
import { AppSettingsService } from "@main/services/appSettingsService";


export function registerDialogIpc(
    win: BrowserWindow,
    // Injected deps.
    showSaveDialog: ShowSaveDialogFn,
    showOpenDialog: ShowOpenDialogFn,
    services: { appSettingsService: AppSettingsService, },
) {

    const { getAppSettings, saveAppSettings } = services.appSettingsService;

    ipcMain.handle(IpcChannels.DIALOG_SHOW_SAVE, async (_, options?: Electron.SaveDialogOptions) : Promise<ProcessResult> => {
        return await showSaveDialog(win, options);
    });

    ipcMain.handle(IpcChannels.DIALOG_SHOW_SAVE_PROJECT, async () : Promise<ProcessResult> => {
        const res = await showSaveDialog(win, {
            title: 'Save project',
            defaultPath: getAppSettings().lastUsedPath ?? app.getPath('documents'),
            filters: [
                { name: 'JSON files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        if (res.status === 'success') {
            // Update last used path and persist
            const filePath = res.data;
            getAppSettings().lastUsedPath = path.parse(filePath).dir;
            await saveAppSettings();
        }

        return res;
    });

    ipcMain.handle(IpcChannels.DIALOG_SHOW_OPEN_FILE, async (_, title: string, fileFilters?: Electron.FileFilter[]) : Promise<ProcessResult> => {

        const res = await showOpenDialog(win, {
            title: title,
            defaultPath: getAppSettings().lastUsedPath ?? app.getPath('documents'),
            properties: ['openFile'],
            filters: fileFilters,
        });

        if (res.status === 'success') {
            // Update last used path and persist
            const filePath = res.data;
            getAppSettings().lastUsedPath = path.normalize(path.parse(filePath).dir);

            await saveAppSettings();
        }

        return res;
        
    });

    ipcMain.handle(IpcChannels.DIALOG_SHOW_OPEN_DIR, async (_, title: string) : Promise<ProcessResult> => {
        const res = await showOpenDialog(win, {
            title: title,
            defaultPath: getAppSettings().lastUsedPath ?? app.getPath('documents'),
            properties: ['openDirectory'],
        });

        if (res.status === 'success') {
            // Update last used path and persist
            const filePath = res.data;
            getAppSettings().lastUsedPath = path.normalize(filePath);

            await saveAppSettings();
        }

        return res;
    });

}