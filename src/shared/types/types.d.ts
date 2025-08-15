export type ProcessResult<T = string> =
    | { status: 'canceled' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: string };

export type ActionResul<T = null> = 
    | { ok : true, data?: T }
    | { ok : false, error : string };

export interface ProjectSettings {
    projectName?: string | null;
    projectPath?: string | null;
    repoPath?: string | null;
    tempName?: string | null;
}

export interface AppSettings {
    lastUsedPath?: string | null;
    makePath?: string | null;
    rgbdsPath?: string | null;
    emulatorPath?: string | null;   
}