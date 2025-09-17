import { app } from 'electron';
import path from 'path';
import type { ActionResult, AppSettings } from '@shared/types/types';
import { withDefaultAppSettings } from '@shared/default';
import { APP_SETTINGS_FILENAME } from '@shared/constants';
import { AppSettingsSchema } from '@shared/types/settingsSchema';
import { ReadJsonFn, WriteJsonFn } from '@main/utils/jsonPersistence';

type AppSettingsService = {
    initAppSettings(): Promise<ActionResult>;
    loadAppSettings(): Promise<ActionResult>;
    saveAppSettings(preserveExisting?: boolean): Promise<ActionResult>;
    resetAppSettings(): Promise<ActionResult>;
    getAppSettings(): AppSettings;
}

type AppSettingsServiceDeps = {
    settingsPath?: string;
    writeSettings: WriteJsonFn;
    readSettings: ReadJsonFn;
}

function createAppSettingsService(deps: AppSettingsServiceDeps): AppSettingsService {
    let appSettings: AppSettings | null = null;
    const settingsPath = path.join(deps.settingsPath ?? app.getPath('userData'), APP_SETTINGS_FILENAME);

    return {
        async initAppSettings(): Promise<ActionResult> {
            const r = await initAppSettingsImpl(settingsPath, deps);
            if (r.ok) appSettings = r.data!;
            return r as ActionResult;
        },

        async loadAppSettings(): Promise<ActionResult> {
            if (!appSettings) {
                return { ok: false, error: 'Settings not initialized' };
            }
            const r = await loadAppSettingsImpl(settingsPath, deps);
            if (r.ok) Object.assign(appSettings, r.data);
            return r as ActionResult;
        },

        async saveAppSettings(preserveExisting = true): Promise<ActionResult> {
            if (!appSettings) {
                return { ok: false, error: 'Settings not initialized' };
            }
            return await saveAppSettingsImpl(appSettings, settingsPath, preserveExisting, deps);
        },

        async resetAppSettings(): Promise<ActionResult> {
            appSettings = await resetAppSettingsImpl(settingsPath, deps);
            return { ok: true };
        },
        
        getAppSettings(): AppSettings {
            if (!appSettings) {
                throw new Error('Settings not initialized. Call initAppSettings() first.');
            }
            return appSettings;
        },
    };
}

// Implementation functions outside the factory
const initAppSettingsImpl = async (
    settingsPath: string,
    deps: AppSettingsServiceDeps,
): Promise<ActionResult<AppSettings>> => {
    const appSettings = withDefaultAppSettings();

    // Load app settings
    const r = await loadAppSettingsImpl(settingsPath, deps);
    if (!r.ok) {
        return { ok: false, error: `Failed to load settings: ${r.error}`};    
    }

    Object.assign(appSettings, r.data);
    return { ok: true, data: appSettings };
};

const loadAppSettingsImpl = async (
    settingsPath: string,
    deps: AppSettingsServiceDeps,
): Promise<ActionResult<Partial<AppSettings>>> => {
    try {
        const r = await deps.readSettings(settingsPath);
        if (!r.ok) return r;

        const settings = r.data as AppSettings;

        // Validate settings
        const validated = AppSettingsSchema.partial().safeParse(settings);
        if (!validated.success) {
            return { ok: false, error: validated.error.message };
        }
        return { ok: true, data: validated.data };
    } catch (e: any) {
        // ENOENT -> No settings yet, that's fine
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return { ok: true, data: {} };
        }
        return { ok: false, error: e?.message ?? String(e) };
    }
};

const saveAppSettingsImpl = async (
    appSettings: AppSettings,
    settingsPath: string,
    preserveExisting: boolean,
    deps: AppSettingsServiceDeps,
): Promise<ActionResult> => {
    try {
        let prevSettings: Partial<AppSettings> = {};

        if (preserveExisting) {
            // Read existing settings file (if any) so we can preserve older keys
            try {
                const result = await loadAppSettingsImpl(settingsPath, deps);
                if (result.ok) prevSettings = result.data ?? {};
            } catch (e: any) {}
        }

        // Merge existing with current (current overwrites existing)
        const merged = { ...prevSettings, ...appSettings };

        const r = await deps.writeSettings(merged, settingsPath);
        return r;
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
};

const resetAppSettingsImpl = async (
    settingsPath: string,
    deps: AppSettingsServiceDeps,
): Promise<AppSettings> => {
    const defaultSettings = withDefaultAppSettings();
    await saveAppSettingsImpl(defaultSettings, settingsPath, false, deps);
    return defaultSettings;
};

export type {
    AppSettingsServiceDeps,
    AppSettingsService,
};

export default createAppSettingsService;