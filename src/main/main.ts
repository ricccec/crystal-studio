import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'path';

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
const RENDERER_DIST = path.join(APP_ROOT, 'dist/renderer');
const VITE_PUBLIC = path.join(APP_ROOT, VITE_DEV_SERVER_URL ? 'public' : 'dist/renderer');


let win: BrowserWindow | null;

const createWindow = () => {
    win = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }
};

app.on('ready', createWindow);
app.on('window-all-closed', () => {
    if (process.platform != 'darwin') app.quit();
});