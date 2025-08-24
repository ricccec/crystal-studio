import { describe, it, expect, vi, beforeEach } from 'vitest';
import findToolCandidate from '../findToolCandidate';
import type { FindToolCandidateFn } from '../findToolCandidate';

// Mock execAsync
vi.mock('../execAsync', () => ({
    default: vi.fn()
}));

import execAsync from '../execAsync';
const mockExecAsync = vi.mocked(execAsync);

describe('findToolCandidate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic functionality', () => {
        it('should find tool when first candidate works', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git');

            expect(result).toEqual({
                ok: true,
                cmd: 'git'
            });
            expect(mockExecAsync).toHaveBeenCalledWith('git', ['--version']);
        });

        it('should return error when tool not found', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'error',
                error: 'Command not found'
            });

            const result = await findToolCandidate('nonexistent');

            expect(result).toEqual({
                ok: false
            });
            expect(mockExecAsync).toHaveBeenCalledWith('nonexistent', ['--version']);
        });

        it('should return error when tool execution is canceled', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'canceled',
                signal: 'SIGTERM'
            });

            const result = await findToolCandidate('git');

            expect(result).toEqual({
                ok: false
            });
        });
    });

    describe('Windows platform handling', () => {
        it('should use command as-is when no execPath provided (Windows)', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', true);

            expect(result).toEqual({
                ok: true,
                cmd: 'git'
            });
            expect(mockExecAsync).toHaveBeenCalledWith('git', ['--version']);
        });

        it('should use command as-is when no execPath provided (Linux)', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', false);

            expect(result).toEqual({
                ok: true,
                cmd: 'git'
            });
            expect(mockExecAsync).toHaveBeenCalledWith('git', ['--version']);
        });
    });

    describe('custom execution path', () => {
        it('should use custom execPath with .exe on Windows', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', true, '/custom/path');

            expect(result).toEqual({
                ok: true,
                cmd: '\\custom\\path\\git.exe'
            });
            expect(mockExecAsync).toHaveBeenCalledWith('\\custom\\path\\git.exe', ['--version']);
        });

        it('should use custom execPath without .exe on Linux', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', false, '/usr/local/bin');

            expect(result).toEqual({
                ok: true,
                cmd: '\\usr\\local\\bin\\git'
            });
            expect(mockExecAsync).toHaveBeenCalledWith('\\usr\\local\\bin\\git', ['--version']);
        });

        it('should handle null execPath', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', false, null);

            expect(result).toEqual({
                ok: true,
                cmd: 'git'
            });
            expect(mockExecAsync).toHaveBeenCalledWith('git', ['--version']);
        });
    });

    describe('aliases handling', () => {
        it('should try aliases when main command fails', async () => {
            mockExecAsync
                .mockResolvedValueOnce({ status: 'error', error: 'Command not found' }) // main command fails
                .mockResolvedValueOnce({ status: 'success', stdout: 'GNU Make 4.3', stderr: '' }); // first alias works

            const result = await findToolCandidate('make', false, null, ['gmake', 'mingw32-make']);

            expect(result).toEqual({
                ok: true,
                cmd: 'gmake'
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(2);
            expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'make', ['--version']);
            expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'gmake', ['--version']);
        });

        it('should try all aliases until one works', async () => {
            mockExecAsync
                .mockResolvedValueOnce({ status: 'error', error: 'Command not found' }) // main command fails
                .mockResolvedValueOnce({ status: 'error', error: 'Command not found' }) // first alias fails
                .mockResolvedValueOnce({ status: 'success', stdout: 'GNU Make 4.3', stderr: '' }); // second alias works

            const result = await findToolCandidate('make', false, null, ['gmake', 'mingw32-make']);

            expect(result).toEqual({
                ok: true,
                cmd: 'mingw32-make'
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(3);
            expect(mockExecAsync).toHaveBeenNthCalledWith(3, 'mingw32-make', ['--version']);
        });

        it('should return false when all aliases fail', async () => {
            mockExecAsync.mockResolvedValue({ status: 'error', error: 'Command not found' });

            const result = await findToolCandidate('make', false, null, ['gmake', 'mingw32-make']);

            expect(result).toEqual({
                ok: false
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(3); // main + 2 aliases
        });

        it('should handle empty aliases array', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', false, null, []);

            expect(result).toEqual({
                ok: true,
                cmd: 'git'
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(1);
        });

        it('should handle null aliases', async () => {
            mockExecAsync.mockResolvedValue({
                status: 'success',
                stdout: 'git version 2.34.1',
                stderr: ''
            });

            const result = await findToolCandidate('git', false, null, null);

            expect(result).toEqual({
                ok: true,
                cmd: 'git'
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(1);
        });
    });

    describe('complex scenarios', () => {
        it('should combine execPath with aliases on Windows', async () => {
            mockExecAsync
                .mockResolvedValueOnce({ status: 'error', error: 'Command not found' }) // main command fails
                .mockResolvedValueOnce({ status: 'success', stdout: 'GNU Make 4.3', stderr: '' }); // first alias works

            const result = await findToolCandidate('make', true, 'C:/MinGW/bin', ['gmake', 'mingw32-make']);

            expect(result).toEqual({
                ok: true,
                cmd: 'C:\\MinGW\\bin\\gmake.exe'
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(2);
            expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'C:\\MinGW\\bin\\make.exe', ['--version']);
            expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'C:\\MinGW\\bin\\gmake.exe', ['--version']);
        });

        it('should combine execPath with aliases on Linux', async () => {
            mockExecAsync
                .mockResolvedValueOnce({ status: 'error', error: 'Command not found' }) // main command fails
                .mockResolvedValueOnce({ status: 'error', error: 'Command not found' }) // first alias fails
                .mockResolvedValueOnce({ status: 'success', stdout: 'GNU Make 4.3', stderr: '' }); // second alias works

            const result = await findToolCandidate('make', false, '/usr/local/bin', ['gmake', 'bmake']);

            expect(result).toEqual({
                ok: true,
                cmd: '\\usr\\local\\bin\\bmake'
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(3);
            expect(mockExecAsync).toHaveBeenNthCalledWith(1, '\\usr\\local\\bin\\make', ['--version']);
            expect(mockExecAsync).toHaveBeenNthCalledWith(2, '\\usr\\local\\bin\\gmake', ['--version']);
            expect(mockExecAsync).toHaveBeenNthCalledWith(3, '\\usr\\local\\bin\\bmake', ['--version']);
        });

        it('should handle all combinations failing', async () => {
            mockExecAsync.mockResolvedValue({ status: 'error', error: 'Command not found' });

            const result = await findToolCandidate('nonexistent', true, 'C:/Tools', ['alt1', 'alt2']);

            expect(result).toEqual({
                ok: false
            });
            expect(mockExecAsync).toHaveBeenCalledTimes(3);
            expect(mockExecAsync).toHaveBeenNthCalledWith(1, 'C:\\Tools\\nonexistent.exe', ['--version']);
            expect(mockExecAsync).toHaveBeenNthCalledWith(2, 'C:\\Tools\\alt1.exe', ['--version']);
            expect(mockExecAsync).toHaveBeenNthCalledWith(3, 'C:\\Tools\\alt2.exe', ['--version']);
        });
    });
});
