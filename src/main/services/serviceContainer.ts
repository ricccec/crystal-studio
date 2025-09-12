import { FindToolCandidateFn } from "@main/utils/findToolCandidate";
import createEmulatorService, { EmulatorService } from "./emulatorService";
import createGitService, { GitService } from "./gitServices";
import createMakeService, { MakeService } from "./makeService";
import projectService, { ProjectService } from "./projectServices";
import createToolsService, { ToolsService } from "./toolsService";
import { ExecAsyncFn } from "@main/utils/execAsync";

type ServiceContainerDeps = {
    execAsync: ExecAsyncFn;
    findToolCandidate: FindToolCandidateFn;
    isDirectory: (path: string) => Promise<boolean>;
    isExecutable: (p: string) => Promise<Boolean>;
}

type ServiceContainer = {
    projectService: ProjectService;
    toolsService: ToolsService;
    gitService: GitService;
    makeService: MakeService;
    emulatorService: EmulatorService;
}

function createServiceContainer({ 
    execAsync,
    isDirectory,
    isExecutable,
    findToolCandidate,
}: ServiceContainerDeps): ServiceContainer {   

    // Load services
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

    return {
        gitService,
        makeService,
        toolsService,
        emulatorService,
        projectService
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