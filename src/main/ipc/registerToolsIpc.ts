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

    ipcMain.handle('git-check', async () => {
        return await gitService.checkGit();
    });

    ipcMain.handle('git-open-repo', async (_, repoPath: string) : Promise<ActionResult> => {
        const res = await gitService.openGitRepo(projectSettings, repoPath);
        if (!res.ok) return res;

        // Backup project for rcovery
        const bkupRes = await projectService.saveProjectForRecovery(projectSettings, { writeSettings });
        if (!bkupRes.ok) {
            // Can't save project for recovery -> keep going, but notify the renderer
            win.webContents.send('app:notification', { data: `Cannot backup project for recovery: ${bkupRes.error}` });
        }    

        return res;
        
    });

    ipcMain.handle('git-clone', async (_, repoUrl: string, targetPath: string) : Promise<SpawnResult> => {
        const res = await gitService.cloneGitRepo(repoUrl, targetPath);
        return res;
    });
}