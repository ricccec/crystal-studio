import type { ActionResult, AppSettings, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow } from "electron";
import path from 'path';
import fs from 'node:fs/promises';
import { createWindow, showOpenDialog, showSaveDialog } from "./windows/windows";
import { registerIpc } from "./ipc/registerIpc";
import { readSettings, writeSettings } from "./utils/settings";
import execAsync from "./utils/execAsync";
import { isDirectory, isExecutable } from "@shared/utils/utils";
import { withDefaultAppSettings } from "@shared/default";
import findToolCandidate from "./utils/findToolCandidate";
import { APP_SETTINGS_FILENAME } from "@shared/constants";
import { AppSettingsSchema } from "@shared/types/settingsSchema";
import createServiceContainer from "./services/serviceContainer";

let win : BrowserWindow | null = null;

const projectSettings : ProjectSettings = {};
let appSettings : AppSettings;

let isDev : boolean;

export async function start(publicFolder: string, viteUrl?: string) {

    isDev = !!viteUrl;
    
    // Load app settings before creating the window    
    await initAppSettings();

    win = createWindow(publicFolder, viteUrl);

    // Load services
    const services = createServiceContainer({
        execAsync,
        isDirectory,
        isExecutable,
        findToolCandidate
    });

    // Register IPC handlers
    registerIpc(
        win!,
        appSettings,
        projectSettings,
        showSaveDialog,
        showOpenDialog,
        restartApp,
        saveAppSettings,
        resetAppSettings,
        services,
        writeSettings,
        readSettings,
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
            await initAppSettings()
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

async function initAppSettings() {

    appSettings = withDefaultAppSettings();

    // Load app settings
    const result = await loadAppSettings();
    if (result.ok) Object.assign(appSettings, result.data);
    else console.error('Failed to load settings:', result.error);

}

async function loadAppSettings() : Promise<ActionResult<Partial<AppSettings>>> {
    const settingPath = path.join(app.getPath('userData'), APP_SETTINGS_FILENAME);
    
    try {
        const data = await fs.readFile(settingPath, 'utf-8');
        const settings = JSON.parse(data) as Partial<AppSettings>;

        // Validate settings
        const validated = AppSettingsSchema.partial().safeParse(settings);
        if (!validated.success) {
            return { ok: false, error: validated.error.message };
        }
        return { ok: true, data: validated.data };
    } catch (e: any) {
        // ENOENT -> No settings yet, that's fine
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return { ok: true, data: {}};
        }
        return { ok: false, error: e?.message ?? String(e) };
    }
};

async function resetAppSettings() {
    appSettings = withDefaultAppSettings();
    return await saveAppSettings(false);
}

async function saveAppSettings(preserveExisting = true) : Promise<ActionResult> {
    const settingPath = path.join(app.getPath('userData'), APP_SETTINGS_FILENAME);

    try {
        // Ensure folder exists
        await fs.mkdir(path.dirname(settingPath), { recursive: true });

        let prevSettings : Partial<AppSettings> = {};
        if (preserveExisting) {
            // Read existing settings file (if any) so we can preserve older keys
            try {
                const result  = await loadAppSettings();
                if (result.ok) prevSettings = result.data ?? {};
            } catch (e: any) {};
        }
        
        // Merge existing with current (current overwrites existing)
        const merged = { ...prevSettings, ...appSettings};

        // Atomic write: write to temp then rename
        const tmp = `${settingPath}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(merged, null, 2), 'utf-8');
        await fs.rename(tmp, settingPath);

        // Update in-memory settings with the merged version
        Object.assign(appSettings, merged);

        return { ok: true };
    } catch (e : any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
};