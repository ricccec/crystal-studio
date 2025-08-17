import type { ProjectService } from "@main/services/projectServices";
import type { ReadSettingsFn, WriteSettingsFn } from "@main/utils/settings";
import type { ShowOpenDialogFn, ShowSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from 'path';
import { registerProjectLifecycleIpc } from "./registerProjectLifecycleIpc";
import { registerDialogIpc } from "./registerDialogIpc";
import { registerToolsIpc } from "./registerToolsIpc";
import { GitService } from "@main/services/gitServices";


export function registerIpc(
    win: BrowserWindow,
    appSettings: AppSettings,
    projectSettings: ProjectSettings,
    // Injected deps.
    showSaveDialog: ShowSaveDialogFn,
    showOpenDialog: ShowOpenDialogFn,
    saveAppSettings: () => Promise<ActionResult>,
    projectService: ProjectService,
    gitService: GitService,
    writeSettings: WriteSettingsFn,
    readSettings: ReadSettingsFn,
) {

    registerProjectLifecycleIpc(
        win,
        appSettings,
        projectSettings,
        showSaveDialog,
        showOpenDialog,
        saveAppSettings,
        projectService,
        writeSettings,
        readSettings,
    )

    registerDialogIpc(
        win,
        appSettings,
        showSaveDialog,
        showOpenDialog,
        saveAppSettings,
    )

    registerToolsIpc(
        win,
        projectSettings,
        projectService,
        gitService,
        writeSettings,
    )

}