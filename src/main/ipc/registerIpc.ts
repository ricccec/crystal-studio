import type { ProjectService } from "@main/services/projectServices";
import type { ReadJsonFn, WriteJsonFn } from "@main/utils/jsonPersistence";
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
    projectSettings: ProjectSettings,
    // Injected deps.
    showSaveDialog: ShowSaveDialogFn,
    showOpenDialog: ShowOpenDialogFn,
    restartApp: () => Promise<ActionResult>,
    services: ServiceContainer,
    writeSettings: WriteJsonFn,
    readSettings: ReadJsonFn,
) {

    registerAppIpc(
        restartApp,
        services,
    );

    registerProjectLifecycleIpc(
        win,
        projectSettings,
        showSaveDialog,
        showOpenDialog,
        services,
        writeSettings,
        readSettings,
    )

    registerDialogIpc(
        win,
        showSaveDialog,
        showOpenDialog,
        services,
    )

    registerToolsIpc(
        win,
        projectSettings,
        services,
        writeSettings,
    )

}