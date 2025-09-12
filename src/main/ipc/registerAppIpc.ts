import { APP_SETTINGS_FILENAME } from "@shared/constants";
import { defaultAppSettings, withDefaultAppSettings } from "@shared/default";
import { IpcChannels } from "@shared/ipc";
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

    ipcMain.handle(IpcChannels.APP_RESTART, async () => {
        return restartApp();
    });

    ipcMain.handle(IpcChannels.APP_GET_SETTINGS, async () => {
        return appSettings;
    });

    ipcMain.handle(IpcChannels.APP_RESET_SETTINGS, async () => {
        return await resetAppSettings();
    });

    ipcMain.handle(IpcChannels.APP_OPEN_SETTINGS, async () => {
        const settingsPath = path.join(app.getPath('userData'), APP_SETTINGS_FILENAME);
        const res = await shell.openPath(settingsPath);
        if (res) return { ok: false, error: res };
        return { ok: true };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_MAKE_FOLDER, async (_, makePath: string) => {
        appSettings.makeDir = makePath;
        await saveAppSettings();
        return { ok: true, data: appSettings.makeDir };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_RGBDS_FOLDER, async (_, rgbdsDir: string) => {
        appSettings.rgbdsDir = rgbdsDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.rgbdsDir };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_GCC_FOLDER, async (_, gccDir: string) => {
        appSettings.gccDir = gccDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.gccDir };
    });

    
    ipcMain.handle(IpcChannels.TOOLS_SET_BASH_FOLDER, async (_, bashDir: string) => {
        appSettings.bashDir = bashDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.bashDir };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_EMULATOR, async (_, emulatorExec: string) => {
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

    ipcMain.handle(IpcChannels.TOOLS_SET_CYGWIN_FOLDER, async (_, cygwinDir: string) => {
        appSettings.cygwinDir = cygwinDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.cygwinDir };    
    });

}