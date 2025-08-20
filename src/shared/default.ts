import { AppSettings } from "./types/types";

export const defaultAppSettings: AppSettings = {
    repoUrl: "https://github.com/pret/pokecrystal.git",
}

/** Merge a partial/persisted settings object with defaults (typed) */
export function withDefaultAppSettings(s?: Partial<AppSettings> | null): AppSettings {
    return { ...defaultAppSettings, ...(s ?? {})};
}