import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGitService } from '../gitService';
import type { ExecAsyncFn } from '@main/utils/execAsync';
import type { ProjectSettings, SpawnResult } from '@shared/types/types';

describe('gitServices', () => {
    let mockExecAsync: any;
    let mockIsDirectory: any;
    let mockProjectSettings: ProjectSettings;
    let gitService: ReturnType<typeof createGitService>;

    beforeEach(() => {
        mockExecAsync = vi.fn();
        mockIsDirectory = vi.fn();
        mockProjectSettings = {
            projectName: 'Test Project',
            projectPath: '/test/project.json',
            repoPath: null,
            tempName: null
        };

        gitService = createGitService({
            execAsync: mockExecAsync,
            isDirectory: mockIsDirectory
        });
    });

    describe('openGitRepo', () => {
        it('should successfully open a valid directory', async () => {
            mockIsDirectory.mockResolvedValue(true);

            const result = await gitService.openGitRepo(mockProjectSettings, '/path/to/repo');

            expect(result).toEqual({ ok: true });
            expect(mockProjectSettings.repoPath).toBe('/path/to/repo');
            expect(mockIsDirectory).toHaveBeenCalledWith('/path/to/repo');
        });

        it('should return error when path is not a directory', async () => {
            mockIsDirectory.mockResolvedValue(false);

            const result = await gitService.openGitRepo(mockProjectSettings, '/path/to/file');

            expect(result).toEqual({
                ok: false,
                error: 'Not a directory'
            });
            expect(mockProjectSettings.repoPath).toBeNull();
        });

        it('should handle isDirectory throwing an error', async () => {
            mockIsDirectory.mockRejectedValue(new Error('Permission denied'));

            const result = await gitService.openGitRepo(mockProjectSettings, '/path/to/repo');

            expect(result).toEqual({
                ok: false,
                error: 'Permission denied'
            });
            expect(mockProjectSettings.repoPath).toBeNull();
        });

        it('should handle non-Error exceptions', async () => {
            mockIsDirectory.mockRejectedValue('Some string error');

            const result = await gitService.openGitRepo(mockProjectSettings, '/path/to/repo');

            expect(result).toEqual({
                ok: false,
                error: 'Some string error'
            });
        });
    });

    describe('cloneGitRepo', () => {
        it('should successfully clone a repository', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Cloning into target...\nDone.',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await gitService.cloneGitRepo(
                'https://github.com/user/repo.git',
                '/target/path'
            );

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'git',
                ['clone', 'https://github.com/user/repo.git', '/target/path'],
                undefined, // shell parameter (when not provided)
                undefined // onOutput parameter
            );
        });

        it('should handle clone failure', async () => {
            const mockResult: SpawnResult = {
                status: 'error',
                error: 'Repository not found',
                stderr: 'fatal: repository not found'
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await gitService.cloneGitRepo(
                'https://github.com/user/nonexistent.git',
                '/target/path'
            );

            expect(result).toEqual(mockResult);
        });

        it('should handle clone cancellation', async () => {
            const mockResult: SpawnResult = {
                status: 'canceled',
                signal: 'SIGINT',
                stderr: 'Operation canceled'
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await gitService.cloneGitRepo(
                'https://github.com/user/repo.git',
                '/target/path'
            );

            expect(result).toEqual(mockResult);
        });

        it('should pass output callback to execAsync', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Clone output',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);
            const mockOnOutput = vi.fn();

            await gitService.cloneGitRepo(
                'https://github.com/user/repo.git',
                '/target/path',
                null, // shell parameter
                mockOnOutput // onOutput parameter
            );

            expect(mockExecAsync).toHaveBeenCalledWith(
                'git',
                ['clone', 'https://github.com/user/repo.git', '/target/path'],
                null, // shell parameter
                mockOnOutput // onOutput parameter
            );
        });
    });
});
