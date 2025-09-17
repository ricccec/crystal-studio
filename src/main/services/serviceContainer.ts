import { FindToolCandidateFn } from "@main/utils/findToolCandidate";
import createEmulatorService, { EmulatorService } from "./emulatorService";
import createGitService, { GitService } from "./gitService";
import createMakeService, { MakeService } from "./makeService";
import createProjectService, { ProjectService } from "./projectService";
import createToolsService, { ToolsService } from "./toolsService";
import { ExecAsyncFn } from "@main/utils/execAsync";
import createAppSettingsService from "./appSettingsService";
import type { AppSettingsService } from "./appSettingsService";
import { ActionResult } from "@shared/types/types";
import { ReadJsonFn, WriteJsonFn } from "@main/utils/jsonPersistence";

type ServiceContainerDeps = {
    appSettingsPath?: string;
    execAsync: ExecAsyncFn;
    findToolCandidate: FindToolCandidateFn;
    isDirectory: (path: string) => Promise<boolean>;
    isExecutable: (p: string) => Promise<Boolean>;
    readJson: ReadJsonFn;
    writeJson: WriteJsonFn;
}

type ServiceContainer = {
    initServices: () => Promise<ActionResult>;
    appSettingsService: AppSettingsService;
    projectService: ProjectService;
    toolsService: ToolsService;
    gitService: GitService;
    makeService: MakeService;
    emulatorService: EmulatorService;
}

function createServiceContainer({
    appSettingsPath, 
    execAsync,
    isDirectory,
    isExecutable,
    findToolCandidate,
    readJson,
    writeJson,
}: ServiceContainerDeps): ServiceContainer {   

    // Create services
    const appSettingsService = createAppSettingsService({
        settingsPath: appSettingsPath, 
        readSettings: readJson,
        writeSettings: writeJson,
    })
    const gitService = createGitService({
        execAsync,
        isDirectory,
    });
    const makeService = createMakeService({
        execAsync,
        isDirectory,
    });
    const toolsService = createToolsService(process.platform, {
        execAsync,
        findToolCandidate,
    });
    const emulatorService = createEmulatorService({
        execAsync,
        isExecutable,
    });
    const projectService = createProjectService({
        readSettings: readJson,
        writeSettings: writeJson,
    });

    return {
        appSettingsService,
        gitService,
        makeService,
        toolsService,
        emulatorService,
        projectService,

        initServices: () => {
            return appSettingsService.initAppSettings();
        },
    };
}

export type {
    ServiceContainer,
    ServiceContainerDeps,
};

export {
    createServiceContainer,
};

export default createServiceContainer;