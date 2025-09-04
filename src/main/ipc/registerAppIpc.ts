import { APP_SETTINGS_FILENAME } from "@shared/constants";
import { defaultAppSettings, withDefaultAppSettings } from "@shared/default";
import { ActionResult, AppSettings } from "@shared/types/types";
import { isExecutable } from "@shared/utils/utils";
import { app, ipcMain, shell } from "electron";
import { error } from "node:console";
import path from "node:path";

export function registerAppIpc(
    appSettings: AppSettings,
    // Injected deps.
    restartApp: () => Promise<ActionResult>,
    saveAppSettings: () => Promise<ActionResult>,
    resetAppSettings: () => Promise<ActionResult>,
) {

    ipcMain.handle('restart-app', async () => {
        return restartApp();
    });

    ipcMain.handle('get-app-settings', async () => {
        return appSettings;
    });

    ipcMain.handle('reset-app-settings', async () => {
        return await resetAppSettings();
    });

    ipcMain.handle('open-app-settings', async () => {
        const settingsPath = path.join(app.getPath('userData'), APP_SETTINGS_FILENAME);
        const res = await shell.openPath(settingsPath);
        if (res) return { ok: false, error: res };
        return { ok: true };
    });

    ipcMain.handle('set-make-folder', async (_, makePath: string) => {
        appSettings.makeDir = makePath;
        await saveAppSettings();
        return { ok: true, data: appSettings.makeDir };
    });

    ipcMain.handle('set-rgbds-folder', async (_, rgbdsDir: string) => {
        appSettings.rgbdsDir = rgbdsDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.rgbdsDir };
    });

    ipcMain.handle('set-gcc-folder', async (_, gccDir: string) => {
        appSettings.gccDir = gccDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.gccDir };
    });

    
    ipcMain.handle('set-bash-folder', async (_, bashDir: string) => {
        appSettings.bashDir = bashDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.bashDir };
    });

    ipcMain.handle('set-emulator', async (_, emulatorExec: string) => {
        try {
            const ok = await isExecutable(emulatorExec);
            if (!ok) {
                return { ok: false, error: 'Selected file is not an executable' };
            }    
        } catch (e: any) {
            return { ok: false, error: `Failed to validate executable: ${e.message ?? String(e)}`};
        }    

        appSettings.emulator = emulatorExec;
        await saveAppSettings();
        return { ok: true, data: appSettings.emulator };
    });    


}