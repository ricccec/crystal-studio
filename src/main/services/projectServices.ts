import { ReadSettingsFn, WriteSettingsFn } from "@main/utils/settings";
import { ActionResult, ProcessResult, ProjectSettings } from "@shared/types/types";
import { app } from "electron";
import path from 'path';

export type NewProjectFn = (
    projectSettings: ProjectSettings,
) => void;

export type OpenProjectFn = (
  loadPath: string,
  deps: { readSettings: ReadSettingsFn }
) => Promise<ActionResult<ProjectSettings>>;

export type SaveProjectFn = (
  projectSettings: ProjectSettings,
  deps: { writeSettings: WriteSettingsFn }
) => Promise<ProcessResult>;

export type SaveProjectAsFn = (
  projectSettings: ProjectSettings,
  savePath: string,
  deps: { writeSettings: WriteSettingsFn }
) => Promise<ProcessResult>;

export type SaveProjectForRecoveryFn = (
    projectSettings: ProjectSettings,
    deps: { writeSettings: WriteSettingsFn }
) => Promise<ActionResult>;

export type ProjectService = {
    newProject: NewProjectFn;
    openProject: OpenProjectFn;
    saveProject: SaveProjectFn;
    saveProjectAs: SaveProjectAsFn;
    saveProjectForRecovery: SaveProjectForRecoveryFn;
};

export const newProject: NewProjectFn = (projectSettings) => {
    (Object.keys(projectSettings) as Array<keyof ProjectSettings>)
        .forEach((key) => projectSettings[key] = null);
}

export const openProject: OpenProjectFn = async (loadPath, deps) => {
    return await deps.readSettings(loadPath);
};

export const saveProject: SaveProjectFn = async (projectSettings, deps) => {

    const savePath = projectSettings.projectPath;
    if (!savePath) return { status: 'error', error: "Path not set"};

    return await saveProjectAs(projectSettings, savePath, deps);

};

export const saveProjectAs: SaveProjectAsFn = async (projectSettings, savePath, deps) =>  {

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

export const saveProjectForRecovery: SaveProjectForRecoveryFn = async (projectSettings,deps) => {

    // Use the project temp name or generate one on the fly
    const filename = projectSettings.tempName ?? `proj_${Date.now()}`;
    projectSettings.tempName = filename;
    const targetPath = path.join(app.getPath('userData'), `${filename}.json`);
    
    console.log(app.getPath('userData'));
    console.log('TEST ' + targetPath);
    return await deps.writeSettings(projectSettings, targetPath);
};

export const projectService: ProjectService = {
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    saveProjectForRecovery,
};

export default projectService;