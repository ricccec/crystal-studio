import { describe, it, expect, vi, beforeEach } from 'vitest';
import createToolsService from '../toolsService';
import type { ToolsServiceDeps } from '../toolsService';
import path from 'node:path';

// Mock the dependencies
const mockExecAsync = vi.fn();
const mockFindToolCandidate = vi.fn();

describe('toolsService', () => {
    let toolsService: ReturnType<typeof createToolsService>;
    let deps: ToolsServiceDeps;

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
                status: { ok: true, exec: 'git', version: '2.34.1' }
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
                status: { ok: true, exec: 'git', version: '2.34.1' }
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

        it('should handle mixed success and failure scenarios', async () => {
            // Mock for multiple tools with different outcomes
            mockFindToolCandidate
                .mockResolvedValueOnce({ ok: true, cmd: 'git' })    // git succeeds
                .mockResolvedValueOnce({ ok: false })               // make not found
                .mockResolvedValueOnce({ ok: true, cmd: 'gcc' });   // gcc succeeds
            
            // Mock execAsync for successful tools only
            mockExecAsync
                .mockResolvedValueOnce({ status: 'success', stdout: 'git version 2.40.1', stderr: '' })
                .mockResolvedValueOnce({ status: 'error', error: 'gcc: command failed' });

            const result = await toolsService.checkTools([
                { name: 'git' },
                { name: 'make' },
                { name: 'gcc' }
            ]);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                tool: 'git',
                status: { ok: true, exec: 'git', version: '2.40.1' }
            });
            expect(result[1]).toEqual({
                tool: 'make',
                status: { ok: false, error: 'Command make not found' }
            });
            expect(result[2]).toEqual({
                tool: 'gcc',
                status: { ok: false, error: 'gcc: command failed' }
            });
        });

        it('should handle tools with custom paths and aliases', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: '/custom/rgbasm.exe' });
            mockExecAsync.mockResolvedValue({ status: 'success', stdout: 'rgbasm version 0.7.0', stderr: '' });

            const result = await toolsService.checkTools([
                { 
                    name: 'rgbasm', 
                    path: '/custom/rgbds/bin', 
                    aliases: ['rgbasm.exe'] 
                }
            ]);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                tool: 'rgbasm',
                status: { ok: true, exec: '/custom/rgbasm.exe', version: '0.7.0' }
            });

            expect(mockFindToolCandidate).toHaveBeenCalledWith(
                'rgbasm',
                true, // isWindows
                '/custom/rgbds/bin',
                ['rgbasm.exe']
            );
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
                version: '2.34.1'
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

        it('should extract semver from complex version strings', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'make' });
            mockExecAsync.mockResolvedValue({ 
                status: 'success', 
                stdout: 'GNU Make 4.3.2-alpha1+build123\nBuilt for x86_64-pc-linux-gnu', 
                stderr: '' 
            });

            const result = await toolsService.checkTool('make');

            expect(result).toEqual({
                ok: true,
                exec: 'make',
                version: '4.3.2-alpha1+build123'
            });
        });

        it('should fallback to first line when no semver found', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: 'custom-tool' });
            mockExecAsync.mockResolvedValue({ 
                status: 'success', 
                stdout: 'CustomTool v1.0 beta\nNo semver here!', 
                stderr: '' 
            });

            const result = await toolsService.checkTool('custom-tool');

            expect(result).toEqual({
                ok: true,
                exec: 'custom-tool',
                version: 'CustomTool v1.0 beta'
            });
        });

        it('should handle tool not found', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: false, error: 'not found' });

            const result = await toolsService.checkTool('nonexistent');

            expect(result).toEqual({
                ok: false,
                error: 'Command nonexistent not found'
            });
        });

        it('should pass through custom path and aliases', async () => {
            mockFindToolCandidate.mockResolvedValue({ ok: true, cmd: '/custom/path/git' });
            mockExecAsync.mockResolvedValue({ status: 'success', stdout: 'git version 2.39.0', stderr: '' });

            const result = await toolsService.checkTool('git', '/custom/path', ['git.exe']);

            expect(result).toEqual({
                ok: true,
                exec: '/custom/path/git',
                version: '2.39.0'
            });

            expect(mockFindToolCandidate).toHaveBeenCalledWith(
                'git',
                true, // isWindows (since we created with 'win32')
                '/custom/path',
                ['git.exe']
            );
        });

    });
});
