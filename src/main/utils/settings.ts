import path from 'path';
import fs from 'node:fs/promises';
import {app} from 'electron';

interface ProjectSettings {
    projectName? : string | null;
    repoPath? : string | null;
    makePath?: string | null;
    rgbdsPath?: string | null;
    emulatorPath? : string | null;
    unsaved? : boolean | null;
}

const readSettings = async (projectPath : string) :  Promise<ProjectSettings> => {
    try {
        const data = await fs.readFile(projectPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
};

const writeSettings = async (
    s : ProjectSettings,
    projPath? : string
) : Promise<{ ok : boolean, error? : string }> => {
    try {
        // Get the project name or generate one on the fly
        const filename = s.projectName ?? `temp_proj_${Date.now()}`; 

        // Fallback to user data folder if no path provided
        const targetPath = projPath ?? path.join(app.getPath('userData'), `${filename}.json`);

        // Read settings from fs, if any
        const curr = await readSettings(targetPath);

        // Ensure the directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // Write project to file
        await fs.writeFile(
            targetPath,
            JSON.stringify({...curr, ...s}, null, 2),
            'utf-8'
        );

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    } 
};

export {
    ProjectSettings,
    readSettings,
    writeSettings
};