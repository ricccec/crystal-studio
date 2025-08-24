import { ActionResult, AppSettings } from "@shared/types/types";
import { ipcMain } from "electron";

export function registerAppIpc(
    appSettings: AppSettings,
    // Injected deps.
    saveAppSettings: () => Promise<ActionResult>,
) {

    ipcMain.handle('set-make-folder', async (_, makePath: string) => {
        appSettings.makeDir = makePath;
        await saveAppSettings();
        return { ok: true, data: appSettings.makeDir };
    });

    ipcMain.handle('set-emulator', async (_, emulatorExec: string) => {
        appSettings.emulator = emulatorExec;
        await saveAppSettings();
        return { ok: true, data: appSettings.emulator };
    });

    ipcMain.handle('set-rgbds-folder', async (_, rgbdsDir: string) => {
        appSettings.rgbdsDir = rgbdsDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.rgbdsDir };
    });


}