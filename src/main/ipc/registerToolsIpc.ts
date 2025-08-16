import { BrowserWindow, ipcMain } from "electron";
import { isDirectory } from "@shared/utils/utils";
import type { ActionResult, ProjectSettings } from "@shared/types/types"; 
import type { ProjectService } from "@main/services/projectServices";
import type { WriteSettingsFn } from "@main/utils/settings";

export function registerToolsIpc(
    win: BrowserWindow,
    projectSettings: ProjectSettings,
    projectService: ProjectService,
    writeSettings: WriteSettingsFn,
) {

    ipcMain.handle('open-git-repo', async (_, repoPath: string) : Promise<ActionResult> => {
        // Check if it's a valid dir
        try {
            const isDir = await isDirectory(repoPath);
            if (!isDir) return { ok: false, error: 'Not a directory' };
        } catch (e: any) {
            return { ok: false,  error: e?.message ?? String(e) };
        }

        // Update project settings and save a copy
        projectSettings.repoPath = repoPath;
        const res = await projectService.saveProjectForRecovery(projectSettings, { writeSettings });
        if (!res.ok) {
            // Can't save project for recovery -> keep going, but notify the renderer
            win.webContents.send('app:notification', { data: `Cannot backup project for recovery: ${res.error}`);
        }    
        return { ok: true };
        
    });
}