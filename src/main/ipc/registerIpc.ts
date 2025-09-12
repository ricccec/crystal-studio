import type { ProjectService } from "@main/services/projectServices";
import type { ReadSettingsFn, WriteSettingsFn } from "@main/utils/settings";
import type { ShowOpenDialogFn, ShowSaveDialogFn } from "@main/windows/windows";
import { ActionResult, AppSettings, ProcessResult, ProjectSettings } from "@shared/types/types";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { registerProjectLifecycleIpc } from "./registerProjectLifecycleIpc";
import { registerDialogIpc } from "./registerDialogIpc";
import { registerToolsIpc } from "./registerToolsIpc";
import { GitService } from "@main/services/gitServices";
import { MakeService } from "@main/services/makeService";
import { ToolsService } from "@main/services/toolsService";
import { registerAppIpc } from "./registerAppIpc";
import { EmulatorService } from "@main/services/emulatorService";
import { ServiceContainer } from "@main/services/serviceContainer";


export function registerIpc(
    win: BrowserWindow,
    appSettings: AppSettings,
    projectSettings: ProjectSettings,
    // Injected deps.
    showSaveDialog: ShowSaveDialogFn,
    showOpenDialog: ShowOpenDialogFn,
    restartApp: () => Promise<ActionResult>,
    saveAppSettings: () => Promise<ActionResult>,
    resetAppSettings: () => Promise<ActionResult>,
    services: ServiceContainer,
    writeSettings: WriteSettingsFn,
    readSettings: ReadSettingsFn,
) {

    registerAppIpc(
        appSettings,
        restartApp,
        saveAppSettings,
        resetAppSettings,
    );

    registerProjectLifecycleIpc(
        win,
        appSettings,
        projectSettings,
        showSaveDialog,
        showOpenDialog,
        saveAppSettings,
        services,
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
        appSettings,
        services,
        writeSettings,
    )

}