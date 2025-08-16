import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    saveProjectForRecovery
} from '../projectServices';
import type { ProjectSettings } from '@shared/types/types';
import path from 'path';

// Mock electron app
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('/mock/userdata')
    }
}));

// Mock path.join to use consistent separators
vi.mock('path', async () => {
    const actual = await vi.importActual('path') as any;
    return {
        ...actual,
        join: (...args: string[]) => { console.log('AAAAAAAAAAAAAAAAAAAAAAA'); return args.join('/'); },
        parse: actual.parse
    };
});

describe('projectServices', () => {
    let mockProjectSettings: ProjectSettings;
    let mockWriteSettings: any;
    let mockReadSettings: any;

    beforeEach(() => {
        mockProjectSettings = {
            projectName: 'Test Project',
            projectPath: '/test/path.json',
            repoPath: '/test/repo',
            tempName: 'temp123'
        };

        mockWriteSettings = vi.fn();
        mockReadSettings = vi.fn();
    });

    describe('newProject', () => {
        it('should reset all project settings to null', () => {
            newProject(mockProjectSettings);

            expect(mockProjectSettings.projectName).toBeNull();
            expect(mockProjectSettings.projectPath).toBeNull();
            expect(mockProjectSettings.repoPath).toBeNull();
            expect(mockProjectSettings.tempName).toBeNull();
        });
    });

    describe('openProject', () => {
        it('should return project data when readSettings succeeds', async () => {
            const expectedData = { projectName: 'Loaded Project' };
            mockReadSettings.mockResolvedValue({ ok: true, data: expectedData });

            const result = await openProject('/test/path.json', { readSettings: mockReadSettings });

            expect(result).toEqual({ ok: true, data: expectedData });
            expect(mockReadSettings).toHaveBeenCalledWith('/test/path.json');
        });

        it('should return error when readSettings fails', async () => {
            mockReadSettings.mockResolvedValue({ ok: false, error: 'File not found' });

            const result = await openProject('/test/path.json', { readSettings: mockReadSettings });

            expect(result).toEqual({ ok: false, error: 'File not found' });
        });
    });

    describe('saveProject', () => {
        it('should return error when projectPath is not set', async () => {
            mockProjectSettings.projectPath = null;

            const result = await saveProject(mockProjectSettings, { writeSettings: mockWriteSettings });

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('Path not set');
            }
            expect(mockWriteSettings).not.toHaveBeenCalled();
        });

        it('should save project when path is set', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });

            const result = await saveProject(mockProjectSettings, { writeSettings: mockWriteSettings });

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.data).toBe('/test/path.json');
            }
            expect(mockWriteSettings).toHaveBeenCalledWith(mockProjectSettings, '/test/path.json');
        });
    });

    describe('saveProjectAs', () => {
        it('should update project path and name, then save', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            const originalName = mockProjectSettings.projectName;
            const originalPath = mockProjectSettings.projectPath;

            const result = await saveProjectAs(mockProjectSettings, '/new/path.json', { writeSettings: mockWriteSettings });

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.data).toBe('/new/path.json');
            }
            expect(mockWriteSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    projectPath: '/new/path.json',
                    projectName: 'path'
                }),
                '/new/path.json'
            );
        });

        it('should clear tempName when saving to different path', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            mockProjectSettings.projectPath = '/old/path.json';
            mockProjectSettings.tempName = 'temp123';

            await saveProjectAs(mockProjectSettings, '/new/path.json', { writeSettings: mockWriteSettings });

            expect(mockWriteSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    tempName: null
                }),
                '/new/path.json'
            );
        });

        it('should leave tempName as it is when saving for the first time', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            mockProjectSettings.projectPath = null;
            mockProjectSettings.tempName = 'temp123';

            await saveProjectAs(mockProjectSettings, '/new/path.json', { writeSettings: mockWriteSettings });

            expect(mockWriteSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    tempName: 'temp123'
                }),
                '/new/path.json'
            );
        });

        it('should restore original values when write fails', async () => {
            mockWriteSettings.mockRejectedValue(new Error('Write failed'));
            const originalName = mockProjectSettings.projectName;
            const originalPath = mockProjectSettings.projectPath;
            const originalTempName = mockProjectSettings.tempName;

            const result = await saveProjectAs(mockProjectSettings, '/new/path.json', { writeSettings: mockWriteSettings });

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('Write failed');
            }
            expect(mockProjectSettings.projectName).toBe(originalName);
            expect(mockProjectSettings.projectPath).toBe(originalPath);
            expect(mockProjectSettings.tempName).toBe(originalTempName);
        });
    });

    describe('saveProjectForRecovery', () => {
        it('should use existing tempName if available', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            mockProjectSettings.tempName = 'existing_temp';

            const result = await saveProjectForRecovery(mockProjectSettings, { writeSettings: mockWriteSettings });

            expect(result).toEqual({ ok: true });
            expect(mockWriteSettings).toHaveBeenCalledWith(
                mockProjectSettings,
                path.join('/', 'mock', 'userdata', 'existing_temp.json'),
            );
        });

        it('should generate new tempName if not available', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            mockProjectSettings.tempName = null;

            // Mock Date.now to make test deterministic
            const mockNow = 1234567890;
            vi.spyOn(Date, 'now').mockReturnValue(mockNow);

            const result = await saveProjectForRecovery(mockProjectSettings, { writeSettings: mockWriteSettings });

            expect(result).toEqual({ ok: true });
            expect(mockProjectSettings.tempName).toBe(`proj_${mockNow}`);
            expect(mockWriteSettings).toHaveBeenCalledWith(
                mockProjectSettings,
                path.join('/', 'mock', 'userdata', `proj_${mockNow}.json`),
            );
        });

        it('should handle write failures gracefully', async () => {
            mockWriteSettings.mockResolvedValue({ ok: false, error: 'Failed to write' });
            mockProjectSettings.tempName = null;

            const result = await saveProjectForRecovery(mockProjectSettings, { writeSettings: mockWriteSettings });

            expect(result).toEqual({ ok: false, error: 'Failed to write' });
        });
    });
});
