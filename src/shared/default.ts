import { AppSettings } from "./types/types";

const toolAliases = {
    make: {
        win32: ["make", "mingw32-make", "gmake", "nmake", "jom"],
        darwin: ["make", "gmake"],
        linux: ["make", "gmake"],
    },
    bash: {
        win32: [ "bash", "mingw64", "sh", "zsh", "fish", "ksh", "tcsh", "dash"],
        darwin: ["zsh", "bash", "sh"],
        linux: ["bash", "zsh", "sh"],
    },
};

export const defaultAppSettings: AppSettings = {
    repoUrl: "https://github.com/pret/pokecrystal.git",
    toolAliases,
    make: {
        numJobs: 4,
        target: 'crystal11',
    },
}

/** Merge a partial/persisted settings object with defaults (typed) */
export function withDefaultAppSettings(s?: Partial<AppSettings> | null): AppSettings {
    return { ...defaultAppSettings, ...(s ?? {})};
}