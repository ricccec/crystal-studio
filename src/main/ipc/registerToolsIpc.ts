import { BrowserWindow, ipcMain } from "electron";
import type { ActionResult, AppSettings, ProjectSettings, SpawnResult } from "@shared/types/types"; 
import type { ProjectService } from "@main/services/projectServices";
import type { WriteSettingsFn } from "@main/utils/settings";
import type { GitService } from "@main/services/gitServices";
import { TaskStreamPayload } from "@shared/ipc";
import { MakeService } from "@main/services/makeService";
import { ToolsService } from "@main/services/toolsService";
import findToolCandidate from "@main/utils/findToolCandidate";

export function registerToolsIpc(
    win: BrowserWindow,
    projectSettings: ProjectSettings,
    appSettings: AppSettings,
    // Injected deps.
    projectService: ProjectService,
    toolsService: ToolsService,
    gitService: GitService,
    makeService: MakeService,
    writeSettings: WriteSettingsFn,
) {

    
    ipcMain.handle('check-tools', async () => {

        const tools = [
            { name: 'git', path: null, aliases: null },
            { name: 'gcc', path: appSettings.gccDir },
            { name: 'make', path: appSettings.makeDir, aliases: getToolAliases('make')},
            { name: 'rgbasm', path: appSettings.rgbdsDir },
            { name: 'rgbfix', path: appSettings.rgbdsDir },
            { name: 'rgbgfx', path: appSettings.rgbdsDir },
            { name: 'rgbfix', path: appSettings.rgbdsDir },
        ]
        
        return await toolsService.checkTools(tools);
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

    ipcMain.handle('git-clone', async (
        _,
        repoUrl: string,
        targetPath: string,
    ) : Promise<SpawnResult> => {
        const res = await gitService.cloneGitRepo(
            repoUrl, targetPath,
            (stream, text) => { 
                const payload: TaskStreamPayload = { task: 'git-clone', stream, text };
                win.webContents.send('task:stream', payload);
            },
        );
        return res;
    });

    ipcMain.handle('git-clone-default', async (
        _,
        targetPath: string,
    ) : Promise<SpawnResult> => {
        const repoUrl = appSettings.repoUrl;
        const res = await gitService.cloneGitRepo(
            repoUrl, targetPath,
            (stream, text) => { 
                const payload: TaskStreamPayload = { task: 'git-clone', stream, text };
                win.webContents.send('task:stream', payload);
            },
        );
        return res;
    });

    ipcMain.handle('run-make', async (
        _,
    ) : Promise<SpawnResult> => {
        
        if (!projectSettings.repoPath) {
            return { status:'error', error:'Repo not set'};
        }

        const makeCwd = projectSettings.repoPath;
        const makePath = appSettings.makeDir;
        const makeAliases = getToolAliases('make');
        
        // Check make is available
        const checkRes = (await toolsService.checkTool(
            'make',
            makePath,
            makeAliases
        ));
        if (!checkRes.ok) {
            return { status:'error', error: `Cannot run make: ${checkRes.error}`};
        }
        const makeExec = checkRes.exec;
        
        // Prepare PATH for make so it can find its deps.
        const envForMake = buildPathForMake(
            appSettings.rgbdsDir,
            appSettings.gccDir,
        );

        const res = await makeService.runMake(
            makeCwd,
            makeExec,
            appSettings.rgbdsDir,
            envForMake,
            (stream, text) => { 
                const payload: TaskStreamPayload = { task: 'make', stream, text };
                win.webContents.send('task:stream', payload);
            },
        );
        return res;
    });

    function getToolAliases(tool: string): string[] {
        if (!appSettings.toolAliases[tool])
            return [];
        const toolAliases = appSettings.toolAliases[tool];
        return toolAliases[process.platform] ?? [];
    }

    function buildPathForMake(
        rgbdsDir?: string | null,
        gccDir?: string | null,
    ): NodeJS.ProcessEnv {

        const pathEntries : string[] = [];
        if (rgbdsDir) pathEntries.push(rgbdsDir);
        if (gccDir) pathEntries.push(gccDir);

        // Use platform-specific path separator
        const pathSeparator = (process.platform === 'win32') ? ';' : ':';

        // Build an augmented PATH
        const env = { ...process.env };
        const oldPath = env.PATH || env.Path || '';
        const newPath = [oldPath, ...pathEntries].filter(Boolean).join(pathSeparator);

        env.PATH = newPath;
        if (process.platform === 'win32') {
            env.Path = newPath; // Windows sometimes uses Path instead of PATH
        }

        return env;
    }
}