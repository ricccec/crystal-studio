import { describe, it, expect, vi, beforeEach } from 'vitest';
import createMakeService from '../makeService';
import type { MakeServiceDeps } from '../makeService';
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
                null,
                undefined,
                { cwd: '/path/to/project' }
            );
        });

        it('should run make with custom executable', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'GNU Make 4.3\nBuilding...',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', 'gmake');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'gmake',
                null,
                undefined,
                { cwd: '/path/to/project' }
            );
        });

        it('should handle null makeExec by using default make command', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'make: Nothing to be done for `all`.',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', null);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                null,
                undefined,
                { cwd: '/path/to/project' }
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

            const result = await makeService.runMake('/path/to/project', 'make', mockCallback);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                null,
                mockCallback,
                { cwd: '/path/to/project' }
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
                null,
                undefined,
                { cwd: '/path/to/invalid' }
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
                null,
                undefined,
                { cwd: customDir }
            );
        });

        it('should work with Windows-style make executables', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Microsoft (R) Program Maintenance Utility Version',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', 'nmake.exe');

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'nmake.exe',
                null,
                undefined,
                { cwd: '/path/to/project' }
            );
        });

        it('should handle output callback with stderr data', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Build completed',
                stderr: 'Warning: deprecated function used'
            };
            mockExecAsync.mockResolvedValue(mockResult);
            const mockCallback = vi.fn();

            const result = await makeService.runMake('/path/to/project', 'make', mockCallback);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                null,
                mockCallback,
                { cwd: '/path/to/project' }
            );
            
            // The callback should be passed to execAsync, but we don't need to test
            // its invocation here since that's the responsibility of execAsync
        });

        it('should handle undefined makeExec parameter', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'make: `all` is up to date.',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);

            const result = await makeService.runMake('/path/to/project', undefined);

            expect(result).toEqual(mockResult);
            expect(mockExecAsync).toHaveBeenCalledWith(
                'make',
                null,
                undefined,
                { cwd: '/path/to/project' }
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
                null,
                undefined,
                { cwd: './src/modules' }
            );
        });

        it('should preserve exact arguments passed to execAsync', async () => {
            const mockResult: SpawnResult = {
                status: 'success',
                stdout: 'Build complete',
                stderr: ''
            };
            mockExecAsync.mockResolvedValue(mockResult);
            const mockCallback = vi.fn();

            await makeService.runMake('/test/dir', 'custom-make', mockCallback);

            expect(mockExecAsync).toHaveBeenCalledWith(
                'custom-make',      // makeExec
                null,               // args (always null for make service)
                mockCallback,       // onOutput callback
                { cwd: '/test/dir' } // options with working directory
            );
            expect(mockExecAsync).toHaveBeenCalledTimes(1);
        });
    });
});
