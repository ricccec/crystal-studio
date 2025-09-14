import path from 'path';
import fs from 'node:fs/promises';
import { ActionResult, ProjectSettings } from '@shared/types/types';

type WriteJsonFn = (data: Record<string, any>, filePath: string) => Promise<ActionResult>;
type ReadJsonFn = (filePath: string) => Promise<ActionResult<Record<string, any>>>;

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
    filePath
) => {
    try {
        // Ensure the directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
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