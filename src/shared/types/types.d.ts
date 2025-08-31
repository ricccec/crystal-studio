export type ProcessResult<T = string> =
    | { status: 'canceled' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };

export type ActionResult<T = null> = 
    | { ok : true, data?: T }
    | { ok : false, error : string };

export type SpawnResult = 
    | { status: 'success', stdout: string, stderr: string }
    | { status: 'canceled', signal?: string, stderr?: string }
    | { status: 'error', error: string, stderr?: string }

export interface ProjectSettings {
    projectName?: string | null;
    projectPath?: string | null;
    repoPath?: string | null;
    tempName?: string | null;
}

export interface AppSettings {
    lastUsedPath?: string | null;
    makeDir?: string | null;
    rgbdsDir?: string | null;
    gccDir?: string | null;
    emulator?: string | null;
    repoUrl: string;
    toolAliases: Record<string,  Record<string, string[]>>;
}