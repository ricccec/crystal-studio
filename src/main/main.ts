import {
    app, dialog,
    BrowserWindow,
    ipcMain
} from 'electron';
import type {
    ActionResul,
    AppSettings,
    ProcessResult,
    ProjectSettings
} from '@shared/types/types';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path, { dirname } from 'path';
import { readSettings, writeSettings } from './utils/settings';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └┬ renderer
// | |  ├──index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
const APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const IS_DEV = !!VITE_DEV_SERVER_URL;

// Where the Vite dev server outputs assets from
const DEV_PUBLIC = path.join(APP_ROOT, 'public');

// Where the Vite dev server outputs assets from
const PROD_PUBLIC = path.join(APP_ROOT, 'dist', 'renderer');

// Pick the correct one based on mode
const VITE_PUBLIC = IS_DEV ? DEV_PUBLIC : PROD_PUBLIC;

let win: BrowserWindow | null;
const projectSettings : ProjectSettings = {};
const appSettings : AppSettings = {};

const createWindow = () => {
    win = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (IS_DEV) {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(PROD_PUBLIC, 'index.html'));
    }
};

app.whenReady().then(async () => {
    // Load persisted app settings before creating the window    
    const result = await loadAppSettings();
    if (result.ok) Object.assign(appSettings, result.data);
    else console.error('Failed to load settings:', result.error);

    createWindow();
    
    app.on('window-all-closed', () => {
        if (process.platform != 'darwin') app.quit();
    });
});

const openProject = async (loadPath: string) : Promise<ActionResul<ProjectSettings>> => {

    const result : ActionResul<ProjectSettings> = await readSettings(loadPath);
    if (result.ok) {
        Object.assign(projectSettings, result.data);
        return result;
    }
    return result;
};

const openSaveDialog = async (options?: Electron.SaveDialogOptions): Promise<ProcessResult> => {
    if (!win) return { status: 'canceled' };
    
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(win, options ?? {});
        if (canceled || !filePath) return { status: 'canceled' };

        appSettings.lastUsedPath = path.parse(filePath).dir;
        await saveAppSettings();

        return { status: 'success', data: filePath };
    } catch (e: any) {
        return { status: 'error', error: e?.message ?? String(e) };
    }
};

const saveProject = async (newPath?: string | null) : Promise<ProcessResult> => {

    const savePath = newPath ?? projectSettings.projectPath;
    if (!savePath) return { status: 'error', error: "Path not set"};

    try {
        const result = await writeSettings(projectSettings, savePath);
        if (result.ok) {
            return { status: 'success', data: projectSettings.projectPath! }
        } else {
            return { status: 'error', error: result.error };
        }
    } catch (e: any) {
        return { status: 'error', error: e?.message ?? String(e) };
    }

};

const saveProjectForRecovery = async () : Promise<ActionResul> => {

    // Use the project temp name or generate one on the fly
    const filename = projectSettings.tempName ?? `proj_${Date.now()}`;
    projectSettings.tempName = filename;
    const targetPath = path.join(app.getPath('userData'), `${filename}.json`);
    
    return await writeSettings(projectSettings, targetPath);
};

const loadAppSettings = async () : Promise<ActionResul<Partial<AppSettings>>> => {
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

const saveAppSettings = async () : Promise<ActionResul> => {
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

ipcMain.handle('update-settings', (evt, newSettings : ProjectSettings) => {
    Object.assign(projectSettings, newSettings); 
});

ipcMain.handle('open-save-dialog', async (_, options?: Electron.SaveDialogOptions) : Promise<ProcessResult> => {
    return await openSaveDialog(options);
});

ipcMain.handle('open-save-project-dialog', async () : Promise<ProcessResult> => {
    return await openSaveDialog({
        title: 'Save project',
        defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
        filters: [
            { name: 'JSON files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });
});

ipcMain.handle('save-project', async () : Promise<ProcessResult> => {
    let savePath = null;
    if (!projectSettings.projectPath) {
        const result = await openSaveDialog({
            title: 'Save project',
            defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
            filters: [
                { name: 'JSON files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        if (result.status !== 'success') return result;
        savePath = result.data;
    }

    return await saveProject(savePath);
});

ipcMain.handle('save-project-as', async (_, savePath: string) : Promise<ProcessResult> => {

    if (!win) return { status: 'canceled' };

    // Just a regular save?
    if (savePath === projectSettings.projectPath)
        return await saveProject(savePath);

    // Cache prev name, path and tempName in case writing goes wrong
    const oldName = projectSettings.projectName;
    const oldPath = projectSettings.projectPath;
    const oldTempName = projectSettings.tempName;
    
    // Update project name and path
    projectSettings.projectPath = savePath;
    projectSettings.projectName = path.parse(savePath).name;

    // Clear recovery file name
    projectSettings.tempName = null;

    try {
        const result = await saveProject(savePath);

        if (result.status != 'success') {
            // Restore cached props
            projectSettings.projectName = oldName;
            projectSettings.projectPath = oldPath;
            projectSettings.tempName = oldTempName;
        }
        
        return result;
        
    } catch (e: any) {
        // Restore cached props
        projectSettings.projectName = oldName;
        projectSettings.projectPath = oldPath;
        projectSettings.tempName = oldTempName;
        return { status: 'error', error: e?.message ?? String(e) };
    }
});

ipcMain.handle('open-project', async () : Promise<ProcessResult<ProjectSettings>> => {
    if (!win) return { status: 'canceled' };

    let openPath = null;
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Open project',
            defaultPath: appSettings.lastUsedPath ?? app.getPath('documents'),
            filters: [
                { name: 'JSON files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        if (canceled || !filePaths[0]) return { status: 'canceled' };
        openPath = filePaths[0];
    } catch (e: any) {
        return { status: 'error', error: e?.message ?? String(e) };
    }

    appSettings.lastUsedPath = path.parse(openPath).dir;
    await saveAppSettings();

    const result = await openProject(openPath);
    if (result.ok) {
        return { status: 'success', data: projectSettings };
    }
    return { status: 'error', error: result.error };
});