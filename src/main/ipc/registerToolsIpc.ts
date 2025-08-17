import { BrowserWindow, ipcMain } from "electron";
import { isDirectory } from "@shared/utils/utils";
import type { ActionResult, AppSettings, ProjectSettings, SpawnResult } from "@shared/types/types"; 
import type { ProjectService } from "@main/services/projectServices";
import type { WriteSettingsFn } from "@main/utils/settings";
import type { GitService } from "@main/services/gitServices";
import { ExecAsyncFn } from "@main/utils/execAsync";

export function registerToolsIpc(
    win: BrowserWindow,
    appSettings: AppSettings,
    projectSettings: ProjectSettings,
    projectService: ProjectService,
    gitService: GitService,
    writeSettings: WriteSettingsFn,
    execAsync: ExecAsyncFn,
) {

    ipcMain.handle('git-open-repo', async (_, repoPath: string) : Promise<ActionResult> => {
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
            win.webContents.send('app:notification', { data: `Cannot backup project for recovery: ${res.error}` });
        }    
        return { ok: true };
        
    });

    ipcMain.handle('git-clone', async (_, repoUrl: string, targetPath: string) : Promise<SpawnResult> => {
        const res = await gitService.cloneGitRepo(repoUrl, targetPath, { execAsync });
        return res;
    });
}