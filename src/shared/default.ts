import { AppSettings } from "./types/types";

const makeAliases = {
    windows: ["make.exe", "mingw32-make.exe", "gmake.exe", "nmake.exe", "jom.exe"],
    macos: ["make", "gmake"],
    linux: ["make", "gmake"],
};

export const defaultAppSettings: AppSettings = {
    repoUrl: "https://github.com/pret/pokecrystal.git",
    makeAliases,

}

/** Merge a partial/persisted settings object with defaults (typed) */
export function withDefaultAppSettings(s?: Partial<AppSettings> | null): AppSettings {
    return { ...defaultAppSettings, ...(s ?? {})};
}