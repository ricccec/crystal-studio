import { describe, it, expect, vi, beforeEach } from 'vitest';
import createToolsService from '../toolsService';
import type { ToolsServicesDeps } from '../toolsService';
import path from 'node:path';

// Mock the dependencies
const mockExecAsync = vi.fn();
const mockFindToolCandidate = vi.fn();

describe('toolsService', () => {
    let toolsService: ReturnType<typeof createToolsService>;
    let deps: ToolsServicesDeps;

    beforeEach(() => {
        vi.clearAllMocks();
        
        deps = {
            execAsync: mockExecAsync,
            findToolCandidate: mockFindToolCandidate,
        };
        
        toolsService = createToolsService('win32', deps);
    });

    describe('checkTools', () => {
        it('should return both git and make when both are available', async () => {
            // Mock findToolCandidate to succeed for both tools
            mockFindToolCandidate
                .mockResolvedValueOnce({ ok: true, cmd: 'git' })
                .mockResolvedValueOnce({ ok: true, cmd: 'make' });
            
            // Mock execAsync to return versions
            mockExecAsync
                .mockResolvedValueOnce({ status: 'success', stdout: 'git version 2.34.1', stderr: '' })
                .mockResolvedValueOnce({ status: 'success', stdout: 'GNU Make 4.3', stderr: '' });

            const result = await toolsService.checkTools([
                { name: 'git' },
                { name: 'make' }
            ]);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                tool: 'git',
                status: { ok: true, exec: 'git', version: 'git version 2.34.1' }
            });
            expect(result[1]).toEqual({
                tool: 'make',
                status: { ok: true, exec: 'make', version: 'GNU Make 4.3' }
            });
        });

        it('should return error when tool not found', async () => {
            // Mock findToolCandidate to succeed for git, fail for make
            mockFindToolCandidate
                .mockResolvedValueOnce({ ok: true, cmd: 'git' })
                .mockResolvedValueOnce({ ok: false });
            
            // Mock execAsync for git only
            mockExecAsync
                .mockResolvedValueOnce({ status: 'success', stdout: 'git version 2.34.1', stderr: '' });

            const result = await toolsService.checkTools([
                { name: 'git' },
                { name: 'make' }
            ]);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                tool: 'git',
                status: { ok: true, exec: 'git', version: 'git version 2.34.1' }
            });
            expect(result[1]).toEqual({
                tool: 'make',
                status: { ok: false, error: 'Command make not found' }
            });
        });

        it('should handle version check failures', async () => {
            // Mock findToolCandidate to succeed
            mockFindToolCandidate
                .mockResolvedValueOnce({ ok: true, cmd: 'git' })
                .mockResolvedValueOnce({ ok: true, cmd: 'make' });
            
            // Mock execAsync to fail for both
            mockExecAsync
                .mockResolvedValueOnce({ status: 'error', error: 'git: command not recognized' })
                .mockResolvedValueOnce({ status: 'error', error: 'make: command not recognized' });

            const result = await toolsService.checkTools([
                { name: 'git' },
                { name: 'make' }
            ]);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                tool: 'git',
                status: { ok: false, error: 'git: command not recognized' }
            });
            expect(result[1]).toEqual({
                tool: 'make',
                status: { ok: false, error: 'make: command not recognized' }
            });
        });

        it('should handle canceled version checks', async () => {
            // Mock findToolCandidate to succeed
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'git' });
            
            // Mock execAsync to be canceled
            mockExecAsync.mockResolvedValue({ status: 'canceled', signal: 'SIGTERM' });

            const result = await toolsService.checkTools([{ name: 'git' }]);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                tool: 'git',
                status: { ok: false, error: 'SIGTERM' }
            });
        });

        it('should handle canceled version checks without signal', async () => {
            // Mock findToolCandidate to succeed
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'git' });
            
            // Mock execAsync to be canceled without signal
            mockExecAsync.mockResolvedValue({ status: 'canceled' });

            const result = await toolsService.checkTools([{ name: 'git' }]);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                tool: 'git',
                status: { ok: false, error: undefined }
            });
        });
    });

    describe('checkTool (individual tool checking)', () => {
        it('should return success with version when tool works', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'git.exe' });
            mockExecAsync.mockResolvedValue({ status: 'success', stdout: 'git version 2.34.1', stderr: '' });

            const result = await toolsService.checkTool('git');

            expect(result).toEqual({
                ok: true,
                exec: 'git.exe',
                version: 'git version 2.34.1'
            });
        });

        it('should return error when tool command fails', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'git' });
            mockExecAsync.mockResolvedValue({ status: 'error', error: 'Command failed' });

            const result = await toolsService.checkTool('git');

            expect(result).toEqual({
                ok: false,
                error: 'Command failed'
            });
        });

        it('should return error when tool is canceled', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'git' });
            mockExecAsync.mockResolvedValue({ status: 'canceled', signal: 'SIGTERM' });

            const result = await toolsService.checkTool('git');

            expect(result).toEqual({
                ok: false,
                error: 'SIGTERM'
            });
        });

        it('should handle unknown status', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'git' });
            mockExecAsync.mockResolvedValue({ status: 'unknown' as any });

            const result = await toolsService.checkTool('git');

            expect(result).toEqual({
                ok: false,
                error: 'Unknown error'
            });
        });

    });
});
