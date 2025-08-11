import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'path';
import type { ProjectSettings } from './utils/settings';
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
let projectPath : string | null = null;
const projectSettings : ProjectSettings = {};

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

app.on('ready', createWindow);
app.on('window-all-closed', () => {
    if (process.platform != 'darwin') app.quit();
});

ipcMain.handle('update-settings', (evt, newSettings : ProjectSettings) => {
              Object.assign(projectSettings, newSettings); 
    }
);

ipcMain.handle('save-project', async () => {
    if (!projectPath) {
        return { ok: false, error: 'Project path is missing' };
    }
    return writeSettings(projectSettings, projectPath);
});
