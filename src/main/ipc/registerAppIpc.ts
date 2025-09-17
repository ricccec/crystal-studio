import { AppSettingsService } from "@main/services/appSettingsService";
import { APP_SETTINGS_FILENAME } from "@shared/constants";
import { defaultAppSettings, withDefaultAppSettings } from "@shared/default";
import { IpcChannels } from "@shared/ipc";
import { ActionResult, AppSettings } from "@shared/types/types";
import { isExecutable } from "@shared/utils/utils";
import { app, ipcMain, shell } from "electron";
import path from "node:path";

export function registerAppIpc(
    // Injected deps.
    restartApp: () => Promise<ActionResult>,
    services: {
        appSettingsService: AppSettingsService,
    },
) {
    const {
        getAppSettings, 
        saveAppSettings,
        resetAppSettings
    } = services.appSettingsService;

    ipcMain.handle(IpcChannels.APP_RESTART, async () => {
        return restartApp();
    });

    ipcMain.handle(IpcChannels.APP_GET_SETTINGS, async () => {
        return getAppSettings();
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
        getAppSettings().makeDir = makePath;
        await saveAppSettings();
        return { ok: true, data: getAppSettings().makeDir };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_RGBDS_FOLDER, async (_, rgbdsDir: string) => {
        getAppSettings().rgbdsDir = rgbdsDir;
        await saveAppSettings();
        return { ok: true, data: getAppSettings().rgbdsDir };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_GCC_FOLDER, async (_, gccDir: string) => {
        getAppSettings().gccDir = gccDir;
        await saveAppSettings();
        return { ok: true, data: getAppSettings().gccDir };
    });

    
    ipcMain.handle(IpcChannels.TOOLS_SET_BASH_FOLDER, async (_, bashDir: string) => {
        getAppSettings().bashDir = bashDir;
        await saveAppSettings();
        return { ok: true, data: getAppSettings().bashDir };
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

        getAppSettings().emulator = emulatorExec;
        await saveAppSettings();
        return { ok: true, data: getAppSettings().emulator };
    });

    ipcMain.handle(IpcChannels.TOOLS_SET_CYGWIN_FOLDER, async (_, cygwinDir: string) => {
        getAppSettings().cygwinDir = cygwinDir;
        await saveAppSettings();
        return { ok: true, data: getAppSettings().cygwinDir };    
    });

}