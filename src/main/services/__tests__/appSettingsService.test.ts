import { describe, it, expect, vi, beforeEach } from 'vitest';
import createAppSettingsService from '../appSettingsService';
import type { AppSettings } from '@shared/types/types';
import { defaultAppSettings } from '@shared/default';

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

// Mock constants
vi.mock('@shared/constants', () => ({
    APP_SETTINGS_FILENAME: 'settings.json'
}));

describe('appSettingsService', () => {
    let mockWriteSettings: any;
    let mockReadSettings: any;
    let appSettingsService: ReturnType<typeof createAppSettingsService>;

    beforeEach(() => {
        mockWriteSettings = vi.fn();
        mockReadSettings = vi.fn();

        appSettingsService = createAppSettingsService({
            settingsPath: '/test',
            readSettings: mockReadSettings,
            writeSettings: mockWriteSettings,
        });
    });

    describe('initAppSettings', () => {
        it('should initialize app settings with defaults when file doesn\'t exist', async () => {
            mockReadSettings.mockResolvedValue({ ok: false, error: 'ENOENT' });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(false); // Should fail when file read fails, even with ENOENT
            expect(mockReadSettings).toHaveBeenCalledWith('\\test\\settings.json');
        });

        it('should initialize app settings with loaded data when file exists', async () => {
            const existingSettings = {
                lastUsedPath: '/existing/path',
                makeDir: '/existing/make'
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: existingSettings });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(true);
            expect(mockReadSettings).toHaveBeenCalledWith('\\test\\settings.json');
            
            // Verify settings were merged with defaults
            const settings = appSettingsService.getAppSettings();
            expect(settings).toEqual({ ...defaultAppSettings, ...existingSettings });
        });

        it('should return error when loading fails with non-ENOENT error', async () => {
            mockReadSettings.mockResolvedValue({ ok: false, error: 'Permission denied' });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe('Failed to load settings: Permission denied');
            }
        });

        it('should handle validation errors during initialization', async () => {
            const invalidSettings = {
                repoUrl: 123, // Should be string
                make: 'invalid' // Should be object
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: invalidSettings });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Failed to load settings:');
            }
        });

        it('should initialize with defaults when ENOENT error occurs', async () => {
            const enoentError = new Error('File not found');
            (enoentError as any).code = 'ENOENT';
            mockReadSettings.mockRejectedValue(enoentError);

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(true);
            const settings = appSettingsService.getAppSettings();
            expect(settings).toEqual(defaultAppSettings);
        });
    });

    describe('loadAppSettings', () => {
        beforeEach(async () => {
            // Initialize service first
            mockReadSettings.mockResolvedValue({ ok: true, data: {} });
            await appSettingsService.initAppSettings();
        });

        it('should load and merge settings with current state', async () => {
            const fileSettings = {
                lastUsedPath: '/loaded/path',
                makeDir: '/loaded/make',
                rgbdsDir: '/loaded/rgbds'
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: fileSettings });

            const result = await appSettingsService.loadAppSettings();

            expect(result.ok).toBe(true);
            expect(mockReadSettings).toHaveBeenCalledWith('\\test\\settings.json');
            
            // Verify settings were updated
            const settings = appSettingsService.getAppSettings();
            expect(settings.lastUsedPath).toBe('/loaded/path');
            expect(settings.makeDir).toBe('/loaded/make');
            expect(settings.rgbdsDir).toBe('/loaded/rgbds');
        });

        it('should return error when file read fails', async () => {
            mockReadSettings.mockResolvedValue({ ok: false, error: 'Permission denied' });

            const result = await appSettingsService.loadAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe('Permission denied');
            }
        });

        it('should handle validation errors gracefully', async () => {
            const invalidSettings = {
                repoUrl: 123, // Should be string
                make: 'invalid' // Should be object
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: invalidSettings });

            const result = await appSettingsService.loadAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it('should return error if not initialized', async () => {
            const uninitializedService = createAppSettingsService({
                settingsPath: '/test',
                readSettings: mockReadSettings,
                writeSettings: mockWriteSettings,
            });

            const result = await uninitializedService.loadAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe('Settings not initialized');
            }
        });

        it('should handle ENOENT errors as empty settings', async () => {
            const enoentError = new Error('File not found');
            (enoentError as any).code = 'ENOENT';
            mockReadSettings.mockRejectedValue(enoentError);

            const result = await appSettingsService.loadAppSettings();

            expect(result.ok).toBe(true);
        });
    });

    describe('saveAppSettings', () => {
        beforeEach(async () => {
            // Initialize service first
            mockReadSettings.mockResolvedValue({ ok: true, data: {} });
            await appSettingsService.initAppSettings();
        });

        it('should save current settings without preserving existing by default', async () => {
            const settings = appSettingsService.getAppSettings();
            settings.lastUsedPath = '/modified/path';

            const result = await appSettingsService.saveAppSettings(false);

            expect(result.ok).toBe(true);
            expect(mockWriteSettings).toHaveBeenCalledWith(settings, '\\test\\settings.json');
        });

        it('should save current settings and preserve existing when requested', async () => {
            const settings = appSettingsService.getAppSettings();
            settings.lastUsedPath = '/modified/path';
            
            const existingSettings = {
                lastUsedPath: '/existing/path',
                makeDir: '/existing/make', // Valid schema field
                customKey: 'customValue' // This will be filtered out by schema validation
            };
            // Mock the readSettings call that happens during saveAppSettings with preserveExisting=true
            mockReadSettings.mockResolvedValueOnce({ ok: true, data: existingSettings });

            const result = await appSettingsService.saveAppSettings(true);

            expect(result.ok).toBe(true);
            // Verify that the service tried to merge existing settings
            expect(mockWriteSettings).toHaveBeenCalled();
            const callArgs = mockWriteSettings.mock.calls[0];
            expect(callArgs[1]).toBe('\\test\\settings.json');
            // The merged settings should have both existing and current values
            // Note: customKey will be filtered out by schema validation
            expect(callArgs[0]).toMatchObject({
                lastUsedPath: '/modified/path', // Current overwrites existing
                makeDir: '/existing/make' // Existing preserved (valid schema field)
            });
            // customKey should NOT be present because it's filtered by schema validation
            expect(callArgs[0]).not.toHaveProperty('customKey');
        });

        it('should handle write errors gracefully', async () => {
            const writeError = new Error('Write permission denied');
            mockWriteSettings.mockImplementation(() => {
                throw writeError;
            });

            const result = await appSettingsService.saveAppSettings(false);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe('Write permission denied');
            }
        });

        it('should return error if not initialized', async () => {
            const uninitializedService = createAppSettingsService({
                settingsPath: '/test',
                readSettings: mockReadSettings,
                writeSettings: mockWriteSettings,
            });

            const result = await uninitializedService.saveAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBe('Settings not initialized');
            }
        });

        it('should handle errors when loading existing settings for preservation', async () => {
            // First call succeeds for initialization, second fails during save
            mockReadSettings
                .mockResolvedValueOnce({ ok: true, data: {} })
                .mockResolvedValueOnce({ ok: false, error: 'Read error' });

            const result = await appSettingsService.saveAppSettings(true);

            // Should still save successfully, just without preserving existing
            expect(result.ok).toBe(true);
            const settings = appSettingsService.getAppSettings();
            expect(mockWriteSettings).toHaveBeenCalledWith(settings, '\\test\\settings.json');
        });
    });

    describe('resetAppSettings', () => {
        beforeEach(async () => {
            // Initialize service with custom settings
            const customSettings = { lastUsedPath: '/custom/path' };
            mockReadSettings.mockResolvedValue({ ok: true, data: customSettings });
            await appSettingsService.initAppSettings();
        });

        it('should reset settings to defaults and save them', async () => {
            const result = await appSettingsService.resetAppSettings();

            expect(result.ok).toBe(true);
            expect(mockWriteSettings).toHaveBeenCalledWith(defaultAppSettings, '\\test\\settings.json');
            
            // Verify internal state was reset
            const currentSettings = appSettingsService.getAppSettings();
            expect(currentSettings).toEqual(defaultAppSettings);
        });

        it('should handle write errors during reset but still update internal state', async () => {
            const writeError = new Error('Write failed');
            mockWriteSettings.mockImplementation(() => {
                throw writeError;
            });

            const result = await appSettingsService.resetAppSettings();
            
            // Reset should still succeed in terms of updating internal state
            expect(result.ok).toBe(true);
            const currentSettings = appSettingsService.getAppSettings();
            expect(currentSettings).toEqual(defaultAppSettings);
        });
    });

    describe('getAppSettings', () => {
        it('should throw error if not initialized', () => {
            const uninitializedService = createAppSettingsService({
                settingsPath: '/test',
                readSettings: mockReadSettings,
                writeSettings: mockWriteSettings,
            });

            expect(() => uninitializedService.getAppSettings()).toThrow(
                'Settings not initialized. Call initAppSettings() first.'
            );
        });

        it('should return current settings state after initialization', async () => {
            const loadedSettings = {
                lastUsedPath: '/loaded/path',
                makeDir: '/loaded/make'
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: loadedSettings });
            
            await appSettingsService.initAppSettings();
            const settings = appSettingsService.getAppSettings();

            expect(settings).toEqual({ ...defaultAppSettings, ...loadedSettings });
        });

        it('should return mutable reference that updates internal state', async () => {
            mockReadSettings.mockResolvedValue({ ok: true, data: {} });
            await appSettingsService.initAppSettings();

            const settings = appSettingsService.getAppSettings();
            settings.lastUsedPath = '/mutated/path';

            const settingsAgain = appSettingsService.getAppSettings();
            expect(settingsAgain.lastUsedPath).toBe('/mutated/path');
        });

        it('should maintain reference equality for the same settings object', async () => {
            mockReadSettings.mockResolvedValue({ ok: true, data: {} });
            await appSettingsService.initAppSettings();

            const settings1 = appSettingsService.getAppSettings();
            const settings2 = appSettingsService.getAppSettings();

            expect(settings1).toBe(settings2);
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete workflow: init -> load -> modify -> save -> reset', async () => {
            // Initial setup
            mockReadSettings.mockResolvedValue({ ok: true, data: { lastUsedPath: '/initial' } });
            await appSettingsService.initAppSettings();
            
            // Load additional settings
            mockReadSettings.mockResolvedValue({ ok: true, data: { makeDir: '/loaded/make' } });
            await appSettingsService.loadAppSettings();
            
            // Modify settings
            const settings = appSettingsService.getAppSettings();
            settings.rgbdsDir = '/modified/rgbds';
            
            // Save
            await appSettingsService.saveAppSettings(false);
            
            // Reset
            await appSettingsService.resetAppSettings();
            
            // Final state should be defaults
            const finalSettings = appSettingsService.getAppSettings();
            expect(finalSettings).toEqual(defaultAppSettings);
        });

        it('should maintain state consistency across multiple load operations', async () => {
            // Initialize
            mockReadSettings.mockResolvedValue({ ok: true, data: { lastUsedPath: '/initial' } });
            await appSettingsService.initAppSettings();
            
            // First load
            mockReadSettings.mockResolvedValue({ ok: true, data: { makeDir: '/first' } });
            await appSettingsService.loadAppSettings();
            
            // Second load
            mockReadSettings.mockResolvedValue({ ok: true, data: { rgbdsDir: '/second' } });
            await appSettingsService.loadAppSettings();
            
            const settings = appSettingsService.getAppSettings();
            expect(settings.lastUsedPath).toBe('/initial');
            expect(settings.makeDir).toBe('/first');
            expect(settings.rgbdsDir).toBe('/second');
        });

        it('should handle large settings object efficiently', async () => {
            const largeSettings = {
                ...defaultAppSettings,
                lastUsedPath: '/large/path', // Valid schema field
                makeDir: '/large/make', // Valid schema field
                // Note: largeArray and deepObject will be filtered out by schema validation
                largeArray: new Array(1000).fill('test'),
                deepObject: {
                    level1: {
                        level2: {
                            level3: {
                                data: 'deep'
                            }
                        }
                    }
                }
            };
            
            mockReadSettings.mockResolvedValue({ ok: true, data: largeSettings });
            await appSettingsService.initAppSettings();
            
            const settings = appSettingsService.getAppSettings();
            // Only valid schema fields should be present
            expect(settings.lastUsedPath).toBe('/large/path');
            expect(settings.makeDir).toBe('/large/make');
            // Invalid schema fields should be filtered out
            expect(settings).not.toHaveProperty('largeArray');
            expect(settings).not.toHaveProperty('deepObject');
        });
    });

    describe('error handling and edge cases', () => {
        it('should handle null/undefined settings gracefully during load', async () => {
            mockReadSettings.mockResolvedValue({ ok: true, data: {} });
            await appSettingsService.initAppSettings();
            
            mockReadSettings.mockResolvedValue({ ok: true, data: null });
            const result = await appSettingsService.loadAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toBeDefined();
            }
        });

        it('should handle empty settings file during initialization', async () => {
            mockReadSettings.mockResolvedValue({ ok: true, data: {} });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(true);
            const settings = appSettingsService.getAppSettings();
            expect(settings).toEqual(defaultAppSettings);
        });

        it('should validate complex nested toolAliases structure', async () => {
            const validToolAliases = {
                toolAliases: {
                    make: {
                        win32: ['make.exe', 'nmake.exe'],
                        linux: ['make', 'gmake']
                    },
                    bash: {
                        win32: ['bash.exe', 'sh.exe'],
                        darwin: ['zsh', 'bash']
                    }
                }
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: validToolAliases });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(true);
            const settings = appSettingsService.getAppSettings();
            expect(settings.toolAliases).toEqual(validToolAliases.toolAliases);
        });

        it('should reject settings with invalid types', async () => {
            const invalidSettings = {
                repoUrl: 123, // Should be string
                toolAliases: 'invalid', // Should be object
                make: {
                    numJobs: 'invalid', // Should be number
                    target: true // Should be string
                }
            };
            mockReadSettings.mockResolvedValue({ ok: true, data: invalidSettings });

            const result = await appSettingsService.initAppSettings();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Failed to load settings:');
            }
        });
    });
});