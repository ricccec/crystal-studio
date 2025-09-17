import { describe, it, expect, vi, beforeEach } from 'vitest';
import createProjectService from '../projectService';
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
        join: (...args: string[]) => args.join('/'),
        parse: actual.parse
    };
});

describe('projectServices', () => {
    let mockProjectSettings: ProjectSettings;
    let mockWriteSettings: any;
    let mockReadSettings: any;
    let projectService: ReturnType<typeof createProjectService>;

    beforeEach(() => {
        mockProjectSettings = {
            projectName: 'Test Project',
            projectPath: '/test/path.json',
            repoPath: '/test/repo',
            tempName: 'temp123'
        };

        mockWriteSettings = vi.fn();
        mockReadSettings = vi.fn();

        projectService = createProjectService({
            readSettings: mockReadSettings,
            writeSettings: mockWriteSettings,
        });

    });

    describe('newProject', () => {
        it('should reset all project settings to null', () => {
            projectService.newProject(mockProjectSettings);

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

            const result = await projectService.openProject('/test/path.json');

            expect(result).toEqual({ ok: true, data: expectedData });
            expect(mockReadSettings).toHaveBeenCalledWith('/test/path.json');
        });

        it('should return error when readSettings fails', async () => {
            mockReadSettings.mockResolvedValue({ ok: false, error: 'File not found' });

            const result = await projectService.openProject('/test/path.json');

            expect(result).toEqual({ ok: false, error: 'File not found' });
        });
    });

    describe('saveProject', () => {
        it('should return error when projectPath is not set', async () => {
            mockProjectSettings.projectPath = null;

            const result = await projectService.saveProject(mockProjectSettings);

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('Path not set');
            }
            expect(mockWriteSettings).not.toHaveBeenCalled();
        });

        it('should save project when path is set', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });

            const result = await projectService.saveProject(mockProjectSettings);

            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.data).toBe('/test/path.json');
            }
            expect(mockWriteSettings).toHaveBeenCalledWith(mockProjectSettings, '/test/path.json');
        });

        it('should handle saveProjectAs failure by propagating error', async () => {
            // Setup to trigger saveProjectAs failure through writeSettings
            mockWriteSettings.mockResolvedValue({ ok: false, error: 'Permission denied' });

            const result = await projectService.saveProject(mockProjectSettings);

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('Permission denied');
            }
        });
    });

    describe('saveProjectAs', () => {
        it('should update project path and name, then save', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            const originalName = mockProjectSettings.projectName;
            const originalPath = mockProjectSettings.projectPath;

            const result = await projectService.saveProjectAs(mockProjectSettings, '/new/path.json');

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

            await projectService.saveProjectAs(mockProjectSettings, '/new/path.json');

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

            await projectService.saveProjectAs(mockProjectSettings, '/new/path.json');

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

            const result = await projectService.saveProjectAs(mockProjectSettings, '/new/path.json');

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('Write failed');
            }
            expect(mockProjectSettings.projectName).toBe(originalName);
            expect(mockProjectSettings.projectPath).toBe(originalPath);
            expect(mockProjectSettings.tempName).toBe(originalTempName);
        });

        it('should restore original values when writeSettings returns error result', async () => {
            mockWriteSettings.mockResolvedValue({ ok: false, error: 'Disk full' });
            const originalName = mockProjectSettings.projectName;
            const originalPath = mockProjectSettings.projectPath;
            const originalTempName = mockProjectSettings.tempName;

            const result = await projectService.saveProjectAs(mockProjectSettings, '/new/path.json');

            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toBe('Disk full');
            }
            expect(mockProjectSettings.projectName).toBe(originalName);
            expect(mockProjectSettings.projectPath).toBe(originalPath);
            expect(mockProjectSettings.tempName).toBe(originalTempName);
        });

        it('should preserve tempName when saving to same path', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            mockProjectSettings.projectPath = '/test/path.json';
            mockProjectSettings.tempName = 'temp123';

            await projectService.saveProjectAs(mockProjectSettings, '/test/path.json');

            expect(mockWriteSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    tempName: 'temp123'
                }),
                '/test/path.json'
            );
        });
    });

    describe('saveProjectForRecovery', () => {
        it('should use existing tempName if available', async () => {
            mockWriteSettings.mockResolvedValue({ ok: true });
            mockProjectSettings.tempName = 'existing_temp';

            const result = await projectService.saveProjectForRecovery(mockProjectSettings);

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

            const result = await projectService.saveProjectForRecovery(mockProjectSettings);

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

            const result = await projectService.saveProjectForRecovery(mockProjectSettings);

            expect(result).toEqual({ ok: false, error: 'Failed to write' });
        });
    });
});
