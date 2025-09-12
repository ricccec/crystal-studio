import { ProcessResult } from "@shared/types/types";
import { BrowserWindow, dialog } from "electron";
import path from 'path';

export type ShowSaveDialogFn = (win: BrowserWindow, options?: Electron.SaveDialogOptions) => Promise<ProcessResult>;
export type ShowOpenDialogFn = (win: BrowserWindow, options?: Electron.OpenDialogOptions) => Promise<ProcessResult>;

export const createWindow = (publicFolder: string, viteUrl?: string) : BrowserWindow => {
    const win = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
        },
    });

    const isDev = !!viteUrl;
    if (isDev) {
        win.loadURL(viteUrl);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(publicFolder, 'index.html'));
    }

    return win;
};

export const showSaveDialog: ShowSaveDialogFn = async (win, options) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(win, options ?? {});
        if (canceled || !filePath) return { status: 'canceled' };
        return { status: 'success', data: filePath };
    } catch (e: any) {
        return { status: 'error', error: e?.message ?? String(e) };
    }
};

export const showOpenDialog: ShowOpenDialogFn = async (win, options) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(win, options ?? {});
        if (canceled || !filePaths[0]) return { status: 'canceled' };
        return { status: 'success', data: filePaths[0] };
    } catch (e: any) {
        return { status: 'error', error: e?.message ?? String(e) };
    }
};