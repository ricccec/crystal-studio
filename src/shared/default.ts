import { AppSettings } from "./types/types";

const toolAliases = {
    make: {
        win32: ["make", "mingw32-make", "gmake", "nmake", "jom"],
        darwin: ["make", "gmake"],
        linux: ["make", "gmake"],
    }
};

export const defaultAppSettings: AppSettings = {
    repoUrl: "https://github.com/pret/pokecrystal.git",
    toolAliases,

}

/** Merge a partial/persisted settings object with defaults (typed) */
export function withDefaultAppSettings(s?: Partial<AppSettings> | null): AppSettings {
    return { ...defaultAppSettings, ...(s ?? {})};
}