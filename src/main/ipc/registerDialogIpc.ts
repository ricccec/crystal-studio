import type { ShowOpenDialogFn, ShowSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { IpcChannels } from "@shared/ipc";
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

    ipcMain.handle(IpcChannels.DIALOG_SHOW_SAVE, async (_, options?: Electron.SaveDialogOptions) : Promise<ProcessResult> => {
        return await showSaveDialog(win, options);
    });

    ipcMain.handle(IpcChannels.DIALOG_SHOW_SAVE_PROJECT, async () : Promise<ProcessResult> => {
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

    ipcMain.handle(IpcChannels.DIALOG_SHOW_OPEN_FILE, async (_, title: string, fileFilters?: Electron.FileFilter[]) : Promise<ProcessResult> => {

        const res = await showOpenDialog(win, {
            title: title,
            defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
            properties: ['openFile'],
            filters: fileFilters,
        });

        if (res.status === 'success') {
            // Update last used path and persist
            const filePath = res.data;
            appSettings.lastUsedPath = path.parse(filePath).dir;

            await saveAppSettings();
        }

        return res;
        
    });

    ipcMain.handle(IpcChannels.DIALOG_SHOW_OPEN_DIR, async (_, title: string) : Promise<ProcessResult> => {
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