import path from 'path';
import fs from 'node:fs/promises';
import { ActionResult, ProjectSettings } from '@shared/types/types';

type WriteJsonFn = (
    data: Record<string, any>,
    filePath: string,
    forceFolderCreation?: boolean,
) => Promise<ActionResult>;

type ReadJsonFn = (
    filePath: string
) => Promise<ActionResult<Record<string, any>>>;

const readJson: ReadJsonFn = async (
    filePath
) => {
    try {
        const rawData = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(rawData);
        return { ok: true, data };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e)};
    }
};

const writeJson: WriteJsonFn = async (
    data,
    filePath,
    forceFolderCreation = true,
) => {
    try {

        const dirPath = path.dirname(filePath);

        if (forceFolderCreation) {
            // Ensure the directory exists
            await fs.mkdir(dirPath, { recursive: true });
        } else {
            // Check folder exists
            try {
                await fs.stat(dirPath)
            } catch (e: any){
                return { ok: false, error: `Directory does not exist: ${dirPath}` };
            }
        }
        
        // Atomic write
        const tmp = `${filePath}.tmp`
        await fs.writeFile(
            tmp,
            JSON.stringify(data, null, 2),
            'utf-8'
        );
        await fs.rename(tmp, filePath);

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    } 
};

export type { 
    WriteJsonFn,
    ReadJsonFn,
};
export {
    readJson,
    writeJson
};