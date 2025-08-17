import type { SpawnResult } from "@shared/types/types";
import { spawn } from "node:child_process";

export type ExecAsyncFn = (
    cmd: string,
    args?: string[],
) => Promise<SpawnResult>;

const execAsync:ExecAsyncFn = (cmd, args) => {
    
    return new Promise<SpawnResult>((resolve) => {
        // child events can fire miltiple times -> ensure single resolve
        let closed = false;
        const done = (res: SpawnResult) => {
            if (closed) return;
            closed = true;
            resolve(res);
        }

        // Spawn child process with no stdin attached
        const child = spawn(cmd, args ?? [], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Update stdout and stderr
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        child.stdout.on('data', (d: Buffer | any) => 
            stdoutChunks.push(Buffer.isBuffer(d) ? d : Buffer.from(String(d)))
        );
        child.stderr.on('data', (d: Buffer | any) => 
            stderrChunks.push(Buffer.isBuffer(d) ? d : Buffer.from(String(d)))
        );

        child.on('close', (code, signal) => {
            const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
            const stderr = Buffer.concat(stderrChunks).toString('utf-8');
            if (code === 0) done({ status: 'success', stdout, stderr });
            else if (code !== null) done({ status: 'error', error: `${cmd} exited with code ${code}`, stderr });
            else done({ status: 'canceled', signal: String(signal), stderr });
        });
        child.on('error', (err) => done( { status: 'error', error: err?.message ?? String(err)}));

    });

}

export default execAsync;