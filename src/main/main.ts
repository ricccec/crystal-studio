import {
    app, dialog,
    BrowserWindow,
    ipcMain
} from 'electron';
import type {
    ActionResult,
    AppSettings,
    ProcessResult,
    ProjectSettings
} from '@shared/types/types';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path, { dirname } from 'path';
import { readSettings, writeSettings } from './utils/settings';
import { start } from './app';

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

app.whenReady().then(async () => {
    start(VITE_PUBLIC, VITE_DEV_SERVER_URL)
});

















