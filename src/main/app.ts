import type { ActionResult, AppSettings, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow } from "electron";
import path from 'path';
import fs from 'node:fs/promises';
import { createWindow, showOpenDialog, showSaveDialog } from "./windows/windows";
import { registerIpc } from "./ipc/registerIpc";
import projectService from "./services/projectServices";
import { readSettings, writeSettings } from "./utils/settings";
import createGitService from "./services/gitServices";
import execAsync from "./utils/execAsync";
import { isDirectory } from "@shared/utils/utils";
import { withDefaultAppSettings } from "@shared/default";

let win : BrowserWindow | null = null;

const projectSettings : ProjectSettings = {};
const appSettings : AppSettings = withDefaultAppSettings();

export async function start(publicFolder: string, viteUrl?: string) {

    // Load app settings before creating the window    
    const result = await loadAppSettings();
    if (result.ok) Object.assign(appSettings, result.data);
    else console.error('Failed to load settings:', result.error);

    win = createWindow(publicFolder, viteUrl);

    // Load services
    const gitService = createGitService({
        execAsync,
        isDirectory,
    });

    // Register IPC handlers
    registerIpc(
        win!,
        appSettings,
        projectSettings,
        showSaveDialog,
        showOpenDialog,
        saveAppSettings,
        projectService,
        gitService,
        writeSettings,
        readSettings,
    );
    
    app.on('window-all-closed', () => {
        if (process.platform != 'darwin') app.quit();
    });

}

async function loadAppSettings() : Promise<ActionResult<Partial<AppSettings>>> {
    const settingPath = path.join(app.getPath('userData'), 'app-settings.json');
    
    try {
        const data = await fs.readFile(settingPath, 'utf-8');
        const settings = JSON.parse(data) as Partial<AppSettings>;
        return { ok: true, data: settings };
    } catch (e: any) {
        // ENOENT -> No settings yet, that's fine
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return { ok: true, data: {}};
        }
        return { ok: false, error: e?.message ?? String(e) };
    }
};

async function saveAppSettings() : Promise<ActionResult> {
    const settingPath = path.join(app.getPath('userData'), 'app-settings.json');

    try {
        // Ensure folder exists
        await fs.mkdir(path.dirname(settingPath), { recursive: true });

        // Read existing settings file (if any) so we can preserve older keys
        let prevSettings : Partial<AppSettings> = {};
        try {
            const result  = await loadAppSettings();
            if (result.ok) prevSettings = result.data ?? {};
        } catch (e: any) {};

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