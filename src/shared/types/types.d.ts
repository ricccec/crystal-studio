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
    makePath?: string | null;
    rgbdsPath?: string | null;
    emulatorPath?: string | null;
    repoUrl: string;
    makeAliases: { windows: string[], macos: string[], linux: string[] };
}