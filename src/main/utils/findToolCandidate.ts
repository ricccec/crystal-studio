import path from "path";
import execAsync from "./execAsync";

type FindToolCandidateFn = (
    cmd: string, isWindows?: boolean,
    execPath?: string | null,
    execAliases?: string[] | null
) => Promise<{ ok: true, cmd: string} | { ok: false }>;

const findToolCandidate: FindToolCandidateFn = async (
    cmd, isWindows = false,
    execPath,
    execAliases
) => {

    // Build a list of make executable candidates
    const candidates: string[] = [];
    candidates.push(execPath
        ? path.join(execPath, `${cmd}${isWindows ? '.exe' : ''}`)
        : cmd);
    if (execAliases && execAliases.length > 0) {
        for (const alias of execAliases) {
            candidates.push(execPath
                ? path.join(execPath, `${alias}${isWindows ? '.exe' : ''}`)
                : alias);
        }
    }

    // Check executables
    for (const c of candidates) {
        const res = await execAsync(c, ['--version']);
        if (res.status === 'success') {
            return { ok: true, cmd: c };
        }
    }
    return { ok: false };

};

export type {
    FindToolCandidateFn,
}

export default findToolCandidate;
