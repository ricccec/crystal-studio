import { BrowserWindow, ipcMain } from "electron";
import type { ActionResult, AppSettings, ProjectSettings, SpawnResult } from "@shared/types/types"; 
import type { ProjectService } from "@main/services/projectService";
import type { WriteJsonFn } from "@main/utils/jsonPersistence";
import type { GitService } from "@main/services/gitService";
import { TaskStreamPayload, IpcChannels } from "@shared/ipc";
import { MakeOptions, MakeService } from "@main/services/makeService";
import { ToolsService } from "@main/services/toolsService";
import path from "node:path";
import { EmulatorService } from "@main/services/emulatorService";
import { AppSettingsService } from "@main/services/appSettingsService";

export function registerToolsIpc(
    win: BrowserWindow,
    projectSettings: ProjectSettings,
    // Injected deps.
    services: {
        appSettingsService: AppSettingsService,
        projectService: ProjectService,
        toolsService: ToolsService,
        gitService: GitService,
        makeService: MakeService,
        emulatorService: EmulatorService,
    },
) {

    const { getAppSettings } = services.appSettingsService;

    ipcMain.handle(IpcChannels.TOOLS_CHECK, async () => {

        const tools = [
            { name: 'git', path: null, aliases: null },
            { name: 'gcc', path: getAppSettings().gccDir },
            { name: 'bash', path: getAppSettings().bashDir, aliases: getToolAliases('bash')},
            { name: 'rgbasm', path: getAppSettings().rgbdsDir },
            { name: 'rgbgfx', path: getAppSettings().rgbdsDir },
            { name: 'rgbfix', path: getAppSettings().rgbdsDir },
            { name: 'make', path: getAppSettings().makeDir, aliases: getToolAliases('make')},
          
        ]
        
        return await services.toolsService.checkTools(tools);
    });

    ipcMain.handle(IpcChannels.GIT_OPEN_REPO, async (_, repoPath: string) : Promise<ActionResult> => {
        const res = await services.gitService.openGitRepo(projectSettings, repoPath);
        if (!res.ok) return res;

        // Backup project for rcovery
        const bkupRes = await services.projectService.saveProjectForRecovery(projectSettings);
        if (!bkupRes.ok) {
            // Can't save project for recovery -> keep going, but notify the renderer
            win.webContents.send('app:notification', { data: `Cannot backup project for recovery: ${bkupRes.error}` });
        }    

        return res;
        
    });

    ipcMain.handle(IpcChannels.GIT_CLONE, async (
        _,
        repoUrl: string,
        targetPath: string,
    ) : Promise<SpawnResult> => {
        const res = await services.gitService.cloneGitRepo(
            repoUrl, targetPath,
            null, // No need for custom bash for git 
            (stream, text) => { 
                const payload: TaskStreamPayload = { task: 'git-clone', stream, text };
                win.webContents.send(IpcChannels.TASK_STREAM, payload);
            },
        );
        return res;
    });

    ipcMain.handle(IpcChannels.GIT_CLONE_DEFAULT, async (
        _,
        targetPath: string,
    ) : Promise<SpawnResult> => {
        const repoUrl = getAppSettings().repoUrl;
        const res = await services.gitService.cloneGitRepo(
            repoUrl, targetPath,
            null, // No need for custom bash for git
            (stream, text) => { 
                const payload: TaskStreamPayload = { task: 'git-clone', stream, text };
                win.webContents.send(IpcChannels.TASK_STREAM, payload);
            },
        );
        return res;
    });

    ipcMain.handle(IpcChannels.EMULATOR_RUN, async () : Promise<SpawnResult> => {
        
        const repoDir = projectSettings.repoPath;
        if (!repoDir) return { status: 'error', error: 'Pret repo not set' };
        
        const romName = getAppSettings().rom;
        if (!romName) return { status: 'error', error: 'Missing ROM name in config. file' };

        const emulatorPath = getAppSettings().emulator;
        if (!emulatorPath) return { status: 'error', error: 'Missing emulator path in config. file' };
        
        const romPath = path.join(repoDir, romName);

        const r = await services.emulatorService.loadRom(emulatorPath, romPath);
        return r;

    });

    ipcMain.handle(IpcChannels.BUILD_RUN_MAKE, async (
        _,
    ) : Promise<SpawnResult> => {
        
        if (!projectSettings.repoPath) {
            return { status: 'error', error: 'Repo not set'};
        }

        const makeCwd = projectSettings.repoPath;
        const makePath = getAppSettings().makeDir;
        const makeAliases = getToolAliases('make');
        const makeNumJobs = getAppSettings().make.numJobs;
        const makeTarget = getAppSettings().make.target;
        
        // Check make is available
        const checkRes = (await services.toolsService.checkTool(
            'make',
            makePath,
            makeAliases
        ));
        if (!checkRes.ok) {
            return { status:'error', error: `Cannot run make: ${checkRes.error}`};
        }
        const makeExec = checkRes.exec;
        
        // Check custom bash is available
        let bash = null;
        if (getAppSettings().bashDir) {
            const bashRes = (await services.toolsService.checkTool(
                'bash',
                getAppSettings().bashDir,
                getToolAliases('bash')
            ));
            if (bashRes.ok) bash = bashRes.exec;
        }

        // Prepare PATH for make so it can find its deps.
        const envForMake = buildPathForMake(
            getAppSettings().rgbdsDir,
            getAppSettings().gccDir,
            getAppSettings().cygwinDir,
        );

        // Run make
        const res = await services.makeService.runMake(
            makeCwd,
            makeNumJobs,
            makeTarget,
            {
                env: envForMake,
                makeExec,
                rgbdsDir: getAppSettings().rgbdsDir,
                shell: bash,
            },
            (stream, text) => { 
                const payload: TaskStreamPayload = { task: 'make', stream, text };
                win.webContents.send(IpcChannels.TASK_STREAM, payload);
            },
        );
        return res;
    });

    function getToolAliases(tool: string): string[] {
        if (!getAppSettings().toolAliases[tool])
            return [];
        const toolAliases = getAppSettings().toolAliases[tool];
        return toolAliases[process.platform] ?? [];
    }

    function buildPathForMake(
        rgbdsDir?: string | null,
        gccDir?: string | null,
        cygwinDir?: string | null,
    ): NodeJS.ProcessEnv {

        const pathEntries : string[] = [];
        if (rgbdsDir) pathEntries.push(rgbdsDir);
        if (gccDir) pathEntries.push(gccDir);
        if (cygwinDir) pathEntries.push(cygwinDir);

        // Use platform-specific path separator
        const pathSeparator = (process.platform === 'win32') ? ';' : ':';

        // Build an augmented PATH (custom entries have precedence)
        const env = { ...process.env };
        const oldPath = env.PATH || env.Path || '';
        const newPath = [...pathEntries, oldPath].filter(Boolean).join(pathSeparator);

        env.PATH = newPath;
        if (process.platform === 'win32') {
            env.Path = newPath; // Windows sometimes uses Path instead of PATH
        }

        return env;
    }
}