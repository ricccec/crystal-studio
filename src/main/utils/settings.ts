import path from 'path';
import fs from 'node:fs/promises';
import {app} from 'electron';
import { ActionResult, ProjectSettings } from '@shared/types/types';

type WriteSettingsFn = (s: ProjectSettings, filePath: string) => Promise<ActionResult>;
type ReadSettingsFn = (filePath: string) => Promise<ActionResult<ProjectSettings>>;

const readSettings = async (
    projectPath : string
) :  Promise<ActionResult<ProjectSettings>> => {
    try {
        const rawData = await fs.readFile(projectPath, 'utf8');
        const data = JSON.parse(rawData);
        return { ok: true, data };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e)};
    }
};

const writeSettings = async (
    s : Partial<ProjectSettings>,
    projectPath : string
) : Promise<ActionResult> => {
    try {
        // Ensure the directory exists
        await fs.mkdir(path.dirname(projectPath), { recursive: true });
        
        // Atomic write
        const tmp = `${projectPath}.tmp`
        await fs.writeFile(
            tmp,
            JSON.stringify(s, null, 2),
            'utf-8'
        );
        await fs.rename(tmp, projectPath);

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    } 
};

export type { 
    WriteSettingsFn,
    ReadSettingsFn,
};
export {
    readSettings,
    writeSettings
};