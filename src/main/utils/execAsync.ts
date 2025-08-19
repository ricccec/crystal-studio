import type { SpawnResult } from "@shared/types/types";
import { spawn } from "node:child_process";

export type ExecAsyncFn = (
    cmd: string,
    args?: string[],
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void,
) => Promise<SpawnResult>;

const execAsync:ExecAsyncFn = (cmd, args, onOutput) => {
    
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

        // Incomplete chunk tails
        let stdoutPending = '';
        let stderrPending = '';

        child.stdout.on('data', (d: Buffer | any) => { 
            const buf = Buffer.isBuffer(d) ? d : Buffer.from(String(d));
            stdoutChunks.push(buf);

            // Split chunk into lines and send them to the listener (if any)
            const { lines, prevPending } = handleChunk(stdoutPending, buf);
            stdoutPending = prevPending;
            for (const l of lines) {
                try { onOutput?.('stdout', l); } catch { /* swallow */ }
            }
        });
        child.stderr.on('data', (d: Buffer | any) => {
            const buf = Buffer.isBuffer(d) ? d : Buffer.from(String(d));
            stderrChunks.push(buf);

             // Split chunk into lines and send them to the listener (if any)
            const { lines, prevPending } = handleChunk(stderrPending, buf);
            stderrPending = prevPending;
            for (const l of lines) {
                try { onOutput?.('stderr', l); } catch { /* swallow */ }
            }
        });

        child.on('close', (code, signal) => {
            // flush pending tails as final partial lines (ending === null)
            if (stdoutPending) {
                try { onOutput?.('stdout', stdoutPending); } catch { /* swallow */ }
                stdoutPending = '';
            }
            if (stderrPending) {
                try { onOutput?.('stderr', stderrPending); } catch { /* swallow */ }
                stderrPending = '';
            }

            const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
            const stderr = Buffer.concat(stderrChunks).toString('utf-8');
            if (code === 0) done({ status: 'success', stdout, stderr });
            else if (code !== null) done({ status: 'error', error: `${cmd} exited with code ${code}`, stderr });
            else done({ status: 'canceled', signal: String(signal), stderr });
        });
        child.on('error', (err) => done( { status: 'error', error: err?.message ?? String(err)}));

    });

}

function handleChunk(pendingTail: string, newChunk: Buffer) {
    
    const raw = newChunk.toString('utf-8');
    const combined = pendingTail + raw;
    

    const lines: string[] = [];

    let cur = ''; // The line being build
    for (let i = 0; i < combined.length; i++) {
        const ch = combined[i];
        if (ch === '\r') {
            // Check for CRLF -> treat as \n
            if ((i + 1) < combined.length && combined[i + 1] === '\n') {
                lines.push(`${cur}\n`);
                i++; // Skip '\n'
                cur = '';
            } else {
                lines.push(`${cur}\r`);
                cur = '';
            }
        } else if (ch === '\n') {
            lines.push(`${cur}\n`);
            cur = '';
        } else {
            cur += ch;
        }
    }

    // cur is the incomplete tail (no ending yet)
    return { lines, prevPending: pendingTail };
}

export default execAsync;