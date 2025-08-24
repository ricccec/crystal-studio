import { ActionResult, AppSettings } from "@shared/types/types";
import { isExecutable } from "@shared/utils/utils";
import { error } from "console";
import { ipcMain } from "electron";

export function registerAppIpc(
    appSettings: AppSettings,
    // Injected deps.
    saveAppSettings: () => Promise<ActionResult>,
) {

    ipcMain.handle('get-app-settings', async () => {
        return appSettings;
    });

    ipcMain.handle('set-make-folder', async (_, makePath: string) => {
        appSettings.makeDir = makePath;
        await saveAppSettings();
        return { ok: true, data: appSettings.makeDir };
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

    ipcMain.handle('set-rgbds-folder', async (_, rgbdsDir: string) => {
        appSettings.rgbdsDir = rgbdsDir;
        await saveAppSettings();
        return { ok: true, data: appSettings.rgbdsDir };
    });


}