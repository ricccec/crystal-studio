import { ExecAsyncFn, ExecAsyncOptions } from "@main/utils/execAsync";
import { ActionResult, SpawnResult } from "@shared/types/types";
import { ChildProcess, SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";

type TaskManagerServiceDeps = {
    execAsync: ExecAsyncFn;
}

type TaskManagerService = {
    listTasks: ListTaskFn;
    runTask: RunTaskFn;
    killTask: KillTaskFn;
}

type ListTaskFn = () => { id: string, cmd: string, args: string[] }[];

type KillTaskFn = (id: string) => Promise<ActionResult>;

type RunTaskFn = (
    cmd: string,
    args?: string[] | null,
    shell?: string | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void | null,
    opts?: ExecAsyncOptions & { returnTaskId?: boolean },
) => Promise<SpawnResult> | { taskId: string, promise: Promise<SpawnResult> };

type Task = {
    id: string,
    cmd: string,
    args: string[],
    promise: Promise<SpawnResult>,
    controller?: AbortController,
    pid?: number,
}

const tasks = new Map<string, Task>();

function createTaskManagerService(deps: TaskManagerServiceDeps): TaskManagerService {
    return {
        listTasks: listTasksImpl,
        killTask: killTaskImpl,
        runTask: (cmd, args, shell, onOutput, opts) =>
            runTaskImpl(deps, cmd, args, shell, onOutput, opts),
    };
};

const listTasksImpl: ListTaskFn = () => {
    return Array.from(tasks.values()).map(task => ({
        id: task.id,
        cmd: task.cmd,
        args: task.args
    }));
};

const runTaskImpl = (
    deps: TaskManagerServiceDeps,
    cmd: string,
    args?: string[] | null,
    shell?: string | null,
    onOutput?: (stream: 'stdout' | 'stderr', s: string) => void | null,
    opts?: ExecAsyncOptions & { returnTaskId?: boolean },
) => {

    const id = randomUUID();

    // create an internal controller only if caller didn't pass a signal
    const internalController = (opts && opts.signal) ? undefined : new AbortController();
    const signal = (opts && opts.signal) ?? internalController?.signal;

    // create Task entry up-front so onSpawn can update it safely
    const t: Task = { id, cmd, args: (args ?? []), promise: null as any, controller: internalController, pid: undefined };
    tasks.set(id, t);

    // strip adapter-only flag before forwarding; forward any existing onSpawn
    const { returnTaskId, ...execOpts } = (opts ?? {});

    // Launch task; ensure we capture pid on spawn and forward caller onSpawn
    const promise = deps.execAsync(
        cmd,
        args,
        shell,
        onOutput,
        {
            ...execOpts,
            signal,
            onSpawn: (child: ChildProcess) => {
                // capture pid for escalation
                t.pid = child?.pid ?? undefined;
                // forward original callback if present
                try { execOpts?.onSpawn?.(child); } catch {}
            }
        }
    );

    t.promise = promise;

    // ensure cleanup on completion
    promise.finally(() => {
        tasks.delete(id);
    })

    if (opts?.returnTaskId) {
        return { taskId: id, promise };
    } else {
        return promise;
    }
};

const killTaskImpl: KillTaskFn = async (id) => {
    const task = tasks.get(id);
    if (!task) return { ok: false, error: 'Task not found' };

    // attempt graceful stop if we have a controller
    let finished = false;

    if (task.controller) {
        // Request graceful stop
        try {
            task.controller.abort();

            // Wait briefly for the promise to settle
            finished = await Promise.race<boolean>([
                task.promise.then(() => true).catch(() => true),
                new Promise((resolve) => setTimeout(() => resolve(false), 3000))
            ]);
        } catch (err) {
            console.error('Error while aborting task', err);
        }
    }

    // attempt escalation if we have a pid and the task didn't finish
    if (!finished && task.pid) {
        try {
            // best-effort escalation; windows behavior differs but this is harmless if it fails
            process.kill(task.pid, 'SIGKILL');

            // wait a bit for the kill to take effect
            try {
                finished = await Promise.race<boolean>([
                    task.promise.then(() => true).catch(() => true),
                    new Promise(r => setTimeout(() => r(false), 500))
                ]);
            } catch { /* ignore */ }
        } catch (err) {
            console.error('Failed to escalate kill for pid', task.pid, err);
        }
    }

    // Remove from the task map in any case
    if (tasks.has(id)) tasks.delete(id);

    return {
        ok: finished,
        ...(finished ? {} : { error: 'Task did not exit within timeout' })
    } as ActionResult;

};

export type {
    TaskManagerService,
};

export {
    createTaskManagerService,
};

export default createTaskManagerService;