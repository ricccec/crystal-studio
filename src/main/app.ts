import type { ActionResult, AppSettings, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow } from "electron";
import { createWindow, showOpenDialog, showSaveDialog } from "./windows/windows";
import { registerIpc } from "./ipc/registerIpc";
import { readJson, writeJson } from "./utils/jsonPersistence";
import execAsync from "./utils/execAsync";
import { isDirectory, isExecutable } from "@shared/utils/utils";
import findToolCandidate from "./utils/findToolCandidate";
import createServiceContainer, { ServiceContainer } from "./services/serviceContainer";

let win : BrowserWindow | null = null;

let serviceContainer : ServiceContainer | null = null;

const projectSettings : ProjectSettings = {};

let isDev : boolean;

export async function start(publicFolder: string, viteUrl?: string) {

    isDev = !!viteUrl;
    
    // Load services
    serviceContainer = createServiceContainer({
        execAsync,
        isDirectory,
        isExecutable,
        findToolCandidate,
        readJson,
        writeJson,
    });

    // Load app settings before creating the window    
    const r = await serviceContainer.initServices();
    if (!r.ok) throw new Error(`Failed to initialize services: ${r.error}`);

    win = createWindow(publicFolder, viteUrl);

    // Register IPC handlers
    registerIpc(
        win!,
        projectSettings,
        showSaveDialog,
        showOpenDialog,
        restartApp,
        serviceContainer,
    );
    
    app.on('window-all-closed', () => {
        if (process.platform != 'darwin') app.quit();
    });

}

async function restartApp() : Promise<ActionResult> {
    try {
        if (isDev) {
            // In dev mode, process lifecycle is handled by Vite. To prevent Vite from loosing
            // track of the project, we just reinitialize the app without launching a new process
            await serviceContainer!.appSettingsService.initAppSettings()
            if (win && !win.isDestroyed) {
                win.reload();
            }
            return { ok: true };
        } else {
            // In production, use the normal relaunch + quit pattern
            app.relaunch();
            setTimeout(() => {
                try { app.quit(); } catch { app.exit(0); }
            }, 500);
            return { ok: true };
        }
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}