import { describe, it, expect, vi, beforeEach } from 'vitest';
import createMakeService from '../makeService';
import type { MakeServiceDeps, MakeOptions } from '../makeService';
import type { SpawnResult } from '@shared/types/types';

// Mock the dependencies
const mockExecAsync = vi.fn();
const mockIsDirectory = vi.fn();

describe('makeService', () => {
    let makeService: ReturnType<typeof createMakeService>;
    let deps: MakeServiceDeps;

    beforeEach(() => {
        vi.clearAllMocks();
        
        deps = {
            execAsync: mockExecAsync,
            isDirectory: mockIsDirectory,
        };
        
        makeService = createMakeService(deps);
    });

    describe('runMake', () => {
        it('should run make with default command in target directory', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building project...\nBuild successful',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should run make with custom executable', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'GNU Make 4.3\nBuilding...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const options: MakeOptions = {
                makeExec: 'gmake'
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'gmake',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should run make with parallel jobs', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with 4 jobs...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', 4);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['-j4'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should run make with specific target', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building crystal11 target...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', null, 'crystal11');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['crystal11'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should run make with RGBDS directory on Windows', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with RGBDS...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const options: MakeOptions = {
                rgbdsDir: 'C:\\tools\\rgbds'
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['RGBDS=C:/tools/rgbds/'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should run make with RGBDS directory on Unix', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with RGBDS...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const options: MakeOptions = {
                rgbdsDir: '/usr/local/bin/rgbds'
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['RGBDS=/usr/local/bin/rgbds/'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should handle RGBDS directory that already has trailing slash', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with RGBDS...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const options: MakeOptions = {
                rgbdsDir: '/usr/local/bin/rgbds/'
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['RGBDS=/usr/local/bin/rgbds/'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should run make with custom shell', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with bash...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const options: MakeOptions = {
                shell: 'bash'
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                'bash',
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should run make with custom environment', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with custom env...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const customEnv = { PATH: '/custom/path', CUSTOM_VAR: 'value' };
            const options: MakeOptions = {
                env: customEnv
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: customEnv }
            );
        });

        it('should run make with all options combined', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with all options...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const customEnv = { PATH: '/custom/path' };
            const options: MakeOptions = {
                makeExec: 'mingw32-make',
                shell: 'bash',
                rgbdsDir: 'D:\\tools\\rgbds',
                env: customEnv
            };

            const mockCallback = vi.fn();

            const result = await makeService.runMake(
                '/path/to/project',
                8,
                'crystal11',
                options,
                mockCallback
            );

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'mingw32-make',
                ['-j8', 'crystal11', 'RGBDS=D:/tools/rgbds/'],
                'bash',
                mockCallback,
                { cwd: '/path/to/project', env: customEnv }
            );

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should handle null numJobs parameter', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building without parallel jobs...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', null);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should handle null target parameter', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building default target...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', 4, null);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['-j4'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should handle null options parameter', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with default options...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', 2, 'all', null);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                ['-j2', 'all'],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should pass output callback to execAsync', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Compiling main.c...\nLinking...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);
            const mockCallback = vi.fn();

            const result = await makeService.runMake('/path/to/project', null, null, null, mockCallback);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                mockCallback,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should handle make command errors', async () => {
            const mockResult: SpawnResult = {
                status: 'error',
                error: 'make: *** No targets specified and no makefile found.  Stop.'
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/invalid');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/invalid', env: undefined }
            );
        });

        it('should handle make command cancellation', async () => {
            const mockResult: SpawnResult = {
                status: 'canceled',
                signal: 'SIGTERM'
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project');

            expect(result).toEqual(mockResult);
        });

        it('should handle build failures with stderr output', async () => {
            const mockResult: SpawnResult = {
                status: 'error',
                error: 'make: *** [target] Error 1',
                stderr: 'gcc: error: main.c: No such file or directory'
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project');

            expect(result).toEqual(mockResult);
        });

        it('should work with different target directories', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building in custom directory',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const customDir = 'C:\\Projects\\MyApp\\src';
            const result = await makeService.runMake(customDir);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: customDir, env: undefined }
            );
        });

        it('should work with relative target directories', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building in relative path',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('./src/modules');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: './src/modules', env: undefined }
            );
        });

        it('should handle empty string rgbdsDir', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building without RGBDS...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const options: MakeOptions = {
                rgbdsDir: ''
            };

            const result = await makeService.runMake('/path/to/project', null, null, options);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should handle zero numJobs', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building with 0 jobs...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', 0);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });

        it('should handle empty string target', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Building default target...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', null, '');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                [],
                null,
                undefined,
                { cwd: '/path/to/project', env: undefined }
            );
        });
    });
});
