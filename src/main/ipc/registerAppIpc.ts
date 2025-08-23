import { ActionResult, AppSettings } from "@shared/types/types";
import { ipcMain } from "electron";

export function registerAppIpc(
    appSettings: AppSettings,
    // Injected deps.
    saveAppSettings: () => Promise<ActionResult>,
) {

    ipcMain.handle('set-make-folder', async (_, makePath: string) => {
        appSettings.makePath = makePath;
        await saveAppSettings();
        return { ok: true, data: appSettings.makePath };
    });
}