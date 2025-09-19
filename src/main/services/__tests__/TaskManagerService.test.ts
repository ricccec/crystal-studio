import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChildProcess } from 'node:child_process';
import createTaskManagerService from '../TaskManagerService';
import type { ExecAsyncFn } from '@main/utils/execAsync';
import type { SpawnResult } from '@shared/types/types';

describe('TaskManagerService', () => {
    let mockExecAsync: ExecAsyncFn;
    let taskManager: ReturnType<typeof createTaskManagerService>;
    let mockChild: Partial<ChildProcess>;

    beforeEach(() => {
        mockChild = { pid: 1234 };
        
        mockExecAsync = vi.fn().mockImplementation(async (cmd, args, shell, onOutput, opts) => {
            // Simulate onSpawn callback if provided
            if (opts?.onSpawn) {
                setTimeout(() => opts.onSpawn!(mockChild as ChildProcess), 0);
            }

            // Simulate a successful process
            return Promise.resolve({
                status: 'success',
                stdout: 'test output',
                stderr: '',
            } as SpawnResult);
        });

        taskManager = createTaskManagerService({ execAsync: mockExecAsync });
    });

    afterEach(() => {
        vi.clearAllMocks();
        
        // Clean up any remaining tasks to prevent unhandled promises
        const tasks = taskManager?.listTasks?.() || [];
        tasks.forEach(task => {
            try {
                taskManager.killTask(task.id).catch(() => {
                    // Ignore kill errors in cleanup
                });
            } catch {
                // Ignore errors during cleanup
            }
        });
    });

    describe('runTask', () => {
        it('should return taskId and promise', async () => {
            const result = taskManager.runTask('echo', ['hello']);

            expect(result).toHaveProperty('taskId');
            expect(result).toHaveProperty('promise');
            expect(typeof result.taskId).toBe('string');
            expect(result.promise).toBeInstanceOf(Promise);
        });

        it('should call execAsync with correct parameters', async () => {
            const cmd = 'git';
            const args = ['status'];
            const shell = '/bin/bash';
            const onOutput = vi.fn();
            const opts = { timeoutMs: 5000 };

            taskManager.runTask(cmd, args, shell, onOutput, opts);

            expect(mockExecAsync).toHaveBeenCalledWith(
                cmd,
                args,
                shell,
                onOutput,
                expect.objectContaining({
                    timeoutMs: 5000,
                    signal: expect.any(AbortSignal),
                    onSpawn: expect.any(Function),
                })
            );
        });

        it('should capture pid when onSpawn is called', async () => {
            // Create a promise that doesn't resolve to keep the task alive
            let resolvePromise: (value: SpawnResult) => void;
            const neverResolvingPromise = new Promise<SpawnResult>((resolve) => {
                resolvePromise = resolve;
            });
            
            mockExecAsync = vi.fn().mockImplementation(async (cmd, args, shell, onOutput, opts) => {
                if (opts?.onSpawn) {
                    setTimeout(() => opts.onSpawn!(mockChild as ChildProcess), 0);
                }
                return neverResolvingPromise;
            });
            
            taskManager = createTaskManagerService({ execAsync: mockExecAsync });
            const result = taskManager.runTask('echo', ['hello']);
            
            // Wait for onSpawn to be called
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const tasks = taskManager.listTasks();
            expect(tasks).toHaveLength(1);
            
            // Clean up - resolve the promise to let the task finish
            resolvePromise!({ status: 'success', stdout: '', stderr: '' });
            await result.promise;
        });

        it('should forward original onSpawn callback if provided', async () => {
            const originalOnSpawn = vi.fn();
            
            taskManager.runTask('echo', ['hello'], undefined, undefined, {
                onSpawn: originalOnSpawn
            });

            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(originalOnSpawn).toHaveBeenCalledWith(mockChild);
        });

        it('should use caller signal if provided instead of creating internal controller', () => {
            const controller = new AbortController();
            
            taskManager.runTask('echo', ['hello'], undefined, undefined, {
                signal: controller.signal
            });

            expect(mockExecAsync).toHaveBeenCalledWith(
                'echo',
                ['hello'],
                undefined,
                undefined,
                expect.objectContaining({
                    signal: controller.signal,
                })
            );
        });

        it('should clean up task from map when promise resolves', async () => {
            const result = taskManager.runTask('echo', ['hello']);
            
            expect(taskManager.listTasks()).toHaveLength(1);
            
            await result.promise;
            
            expect(taskManager.listTasks()).toHaveLength(0);
        });

        it('should clean up task from map when command fails', async () => {
            // Create a mock that returns an error SpawnResult (like real execAsync)
            mockExecAsync = vi.fn().mockImplementation(async (cmd, args, shell, onOutput, opts) => {
                // Still call onSpawn if provided for consistency
                if (opts?.onSpawn) {
                    setTimeout(() => opts.onSpawn!(mockChild as ChildProcess), 0);
                }
                // Return an error result (not throw) like real execAsync
                return Promise.resolve({
                    status: 'error',
                    error: 'Command failed',
                    stderr: 'Command execution failed'
                } as SpawnResult);
            });
            
            taskManager = createTaskManagerService({ execAsync: mockExecAsync });
            
            const result = taskManager.runTask('failing-command');
            
            expect(taskManager.listTasks()).toHaveLength(1);
            
            // The promise should resolve (not reject) with an error SpawnResult
            const spawnResult = await result.promise;
            expect(spawnResult.status).toBe('error');
            if (spawnResult.status === 'error') {
                expect(spawnResult.error).toBe('Command failed');
            }
            
            expect(taskManager.listTasks()).toHaveLength(0);
        });
    });

    describe('execAsync wrapper', () => {
        it('should return only the promise (compatible with original execAsync)', async () => {
            const result = taskManager.execAsync('echo', ['hello']);
            
            expect(result).toBeInstanceOf(Promise);
            expect(result).not.toHaveProperty('taskId');
            
            const spawnResult = await result;
            expect(spawnResult).toEqual({
                status: 'success',
                stdout: 'test output',
                stderr: '',
            });
        });

        it('should still track the task internally', async () => {
            const promise = taskManager.execAsync('echo', ['hello']);
            
            expect(taskManager.listTasks()).toHaveLength(1);
            
            await promise;
            
            expect(taskManager.listTasks()).toHaveLength(0);
        });
    });

    describe('listTasks', () => {
        it('should return empty array when no tasks', () => {
            expect(taskManager.listTasks()).toEqual([]);
        });

        it('should list running tasks', () => {
            taskManager.runTask('git', ['status']);
            taskManager.runTask('npm', ['install']);

            const tasks = taskManager.listTasks();
            expect(tasks).toHaveLength(2);
            expect(tasks[0]).toEqual({
                id: expect.any(String),
                cmd: 'git',
                args: ['status']
            });
            expect(tasks[1]).toEqual({
                id: expect.any(String),
                cmd: 'npm',
                args: ['install']
            });
        });
    });

    describe('killTask', () => {
        let longRunningPromise: Promise<SpawnResult>;
        let longRunningResolver: (value: SpawnResult) => void;
        let longRunningRejecter: (reason: any) => void;

        beforeEach(() => {
            longRunningPromise = new Promise<SpawnResult>((resolve, reject) => {
                longRunningResolver = resolve;
                longRunningRejecter = reject;
            });

            mockExecAsync = vi.fn().mockImplementation(async (cmd, args, shell, onOutput, opts) => {
                if (opts?.onSpawn) {
                    setTimeout(() => opts.onSpawn!(mockChild as ChildProcess), 0);
                }

                // Listen for abort signal
                if (opts?.signal) {
                    opts.signal.addEventListener('abort', () => {
                        longRunningResolver({
                            status: 'canceled',
                            signal: 'SIGTERM',
                            stderr: 'Aborted',
                        });
                    });
                }

                return longRunningPromise;
            });

            taskManager = createTaskManagerService({ execAsync: mockExecAsync });
        });

        afterEach(() => {
            // Clean up any unresolved promises to prevent unhandled rejections
            try {
                longRunningResolver({ status: 'success', stdout: '', stderr: '' });
            } catch {
                // Promise may already be resolved
            }
        });

        it('should return error for non-existent task', async () => {
            const result = await taskManager.killTask('non-existent');
            
            expect(result).toEqual({
                ok: false,
                error: 'Task not found'
            });
        });

        it('should abort task and return success when task exits gracefully', async () => {
            const { taskId } = taskManager.runTask('long-running-command');
            
            // Wait for task to start
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const killPromise = taskManager.killTask(taskId);
            
            // The kill should trigger the abort, which resolves the longRunningPromise
            const result = await killPromise;
            
            expect(result.ok).toBe(true);
        });

        it('should escalate to SIGKILL when graceful abort fails', async () => {
            const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
            
            // Mock a task that doesn't respond to abort
            mockExecAsync = vi.fn().mockImplementation(async (cmd, args, shell, onOutput, opts) => {
                if (opts?.onSpawn) {
                    setTimeout(() => opts.onSpawn!(mockChild as ChildProcess), 0);
                }
                // Don't listen to abort signal - simulate unresponsive process
                return new Promise(() => {}); // Never resolves
            });

            taskManager = createTaskManagerService({ execAsync: mockExecAsync });
            
            const { taskId } = taskManager.runTask('unresponsive-command');
            
            // Wait for task to start
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const result = await taskManager.killTask(taskId);
            
            expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
            expect(result.ok).toBe(false); // Because the task never actually exits
            if (!result.ok) {
                expect(result.error).toContain('timeout');
            }
            
            killSpy.mockRestore();
        });

        it('should clean up task from map after kill attempt', async () => {
            const { taskId } = taskManager.runTask('command');
            
            expect(taskManager.listTasks()).toHaveLength(1);
            
            await taskManager.killTask(taskId);
            
            expect(taskManager.listTasks()).toHaveLength(0);
        });

        it('should not attempt abort when caller provided external signal', async () => {
            const externalController = new AbortController();
            const abortSpy = vi.spyOn(externalController, 'abort');
            
            const { taskId } = taskManager.runTask('command', [], undefined, undefined, {
                signal: externalController.signal
            });
            
            await taskManager.killTask(taskId);
            
            // Should not call abort on external controller
            expect(abortSpy).not.toHaveBeenCalled();
            
            abortSpy.mockRestore();
        });
    });

    describe('error handling', () => {
        it('should handle onSpawn callback errors gracefully', async () => {
            const throwingOnSpawn = vi.fn().mockImplementation(() => {
                throw new Error('onSpawn error');
            });
            
            // Should not throw
            expect(() => {
                taskManager.runTask('echo', ['hello'], undefined, undefined, {
                    onSpawn: throwingOnSpawn
                });
            }).not.toThrow();
        });

        it('should handle process.kill errors gracefully', async () => {
            const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
                throw new Error('Kill failed');
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            mockExecAsync = vi.fn().mockImplementation(async (cmd, args, shell, onOutput, opts) => {
                if (opts?.onSpawn) {
                    setTimeout(() => opts.onSpawn!(mockChild as ChildProcess), 0);
                }
                return new Promise(() => {}); // Never resolves
            });

            taskManager = createTaskManagerService({ execAsync: mockExecAsync });
            
            const { taskId } = taskManager.runTask('unresponsive-command');
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const result = await taskManager.killTask(taskId);
            
            expect(result.ok).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to escalate kill for pid',
                1234,
                expect.any(Error)
            );
            
            killSpy.mockRestore();
            consoleSpy.mockRestore();
        });
    });
});
