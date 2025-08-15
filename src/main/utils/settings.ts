import path from 'path';
import fs from 'node:fs/promises';
import {app} from 'electron';
import { ActionResul, ProjectSettings } from '@shared/types/types';

const readSettings = async (
    projectPath : string
) :  Promise<ActionResul<ProjectSettings>> => {
    try {
        const rawData = await fs.readFile(projectPath, 'utf8');
        const data = JSON.parse(rawData);
        return { ok: true, data };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e)};
    }
};

const writeSettings = async (
    s : ProjectSettings
) : Promise<ActionResul> => {
    try {
        // Get the project name or generate one on the fly
        const filename = s.projectName ?? `temp_proj_${Date.now()}`; 

        // Fallback to user data folder if no path provided
        const targetPath = s.projectPath ?? path.join(app.getPath('userData'), `${filename}.json`);

        // Read settings from fs, if any
        // const curr = await readSettings(targetPath);

        // Ensure the directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // Write project to file
        await fs.writeFile(
            targetPath,
            JSON.stringify(s, null, 2),
            'utf-8'
        );

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    } 
};

export type {
    ProjectSettings,
};
export {
    readSettings,
    writeSettings
};