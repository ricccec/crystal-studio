import { ReadJsonFn, WriteJsonFn } from "@main/utils/jsonPersistence";
import { ActionResult, ProcessResult, ProjectSettings } from "@shared/types/types";
import { app } from "electron";
import path from 'path';

type ProjectServiceDeps = {
    readSettings: ReadJsonFn;
    writeSettings: WriteJsonFn;
};

type ProjectService = {
    newProject: NewProjectFn;
    openProject: OpenProjectFn;
    saveProject: SaveProjectFn;
    saveProjectAs: SaveProjectAsFn;
    saveProjectForRecovery: SaveProjectForRecoveryFn;
};

type NewProjectFn = (
    projectSettings: ProjectSettings,
) => void;

type OpenProjectFn = (
  loadPath: string,
) => Promise<ActionResult<ProjectSettings>>;

type SaveProjectFn = (
  projectSettings: ProjectSettings,
) => Promise<ProcessResult>;

type SaveProjectAsFn = (
  projectSettings: ProjectSettings,
  savePath: string,
) => Promise<ProcessResult>;

type SaveProjectForRecoveryFn = (
    projectSettings: ProjectSettings,
) => Promise<ActionResult>;

function createProjectService(deps: ProjectServiceDeps): ProjectService {
    return {
        newProject: (projectSettings) => newProject(projectSettings),
        openProject: (loadPath) => openProject(loadPath, deps),
        saveProject: (projectSettings) => saveProject(projectSettings, deps),
        saveProjectAs: (projectSettings, savePath) => saveProjectAs(projectSettings, savePath, deps),
        saveProjectForRecovery: (projectSettings) => saveProjectForRecovery(projectSettings, deps),
    };
}

const newProject = (projectSettings: ProjectSettings): void => {
    (Object.keys(projectSettings) as Array<keyof ProjectSettings>)
        .forEach((key) => projectSettings[key] = null);
}

const openProject = async (
    loadPath: string,
    deps: ProjectServiceDeps
): Promise<ActionResult<ProjectSettings>> => {
    return await deps.readSettings(loadPath);
};

const saveProject = async (
    projectSettings: ProjectSettings,
    deps: ProjectServiceDeps
): Promise<ProcessResult> => {
    const savePath = projectSettings.projectPath;
    if (!savePath) return { status: 'error', error: "Path not set" };

    return await saveProjectAs(projectSettings, savePath, deps);
};

const saveProjectAs = async (
    projectSettings: ProjectSettings,
    savePath: string,
    deps: ProjectServiceDeps
): Promise<ProcessResult> => {

    // Cache prev name, path and tempName in case writing goes wrong
    const oldName = projectSettings.projectName;
    const oldPath = projectSettings.projectPath;
    const oldTempName = projectSettings.tempName;
    
    // Update project name and path
    projectSettings.projectPath = savePath;
    projectSettings.projectName = path.parse(savePath).name;

    if (oldPath && (savePath !== oldPath)) {
        // We are saving a copy -> Clear recovery file name
        projectSettings.tempName = null;
    }

    try {
        const result = await deps.writeSettings(projectSettings, savePath);

        if (result.ok) {
            return { status: 'success', data: savePath };
        } else {
            // Restore cached props on write failure
            projectSettings.projectName = oldName;
            projectSettings.projectPath = oldPath;
            projectSettings.tempName = oldTempName;
            return { status: 'error', error: result.error };
        }
        
    } catch (e: any) {
        // Restore cached props
        projectSettings.projectName = oldName;
        projectSettings.projectPath = oldPath;
        projectSettings.tempName = oldTempName;
        return { status: 'error', error: e?.message ?? String(e) };
    }
};

const saveProjectForRecovery = async (
    projectSettings: ProjectSettings,
    deps: ProjectServiceDeps
): Promise<ActionResult> => {

    // Use the project temp name or generate one on the fly
    const filename = projectSettings.tempName ?? `proj_${Date.now()}`;
    projectSettings.tempName = filename;
    const targetPath = path.join(app.getPath('userData'), `${filename}.json`);
    
    return await deps.writeSettings(projectSettings, targetPath);
};

export type {
    ProjectServiceDeps,
    ProjectService,
};

export default createProjectService;