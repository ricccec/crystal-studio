export const IpcChannels = {
    // Application IPCs
    APP_RESTART: 'app:restart',
    APP_GET_SETTINGS: 'app:get-settings',
    APP_RESET_SETTINGS: 'app:reset-settings',
    APP_OPEN_SETTINGS: 'app:open-settings',
    APP_NOTIFICATION: 'app:notification',

    // Tool configuration IPCs
    TOOLS_SET_MAKE_FOLDER: 'tools:set-make-folder',
    TOOLS_SET_RGBDS_FOLDER: 'tools:set-rgbds-folder',
    TOOLS_SET_CYGWIN_FOLDER: 'tools:set-cygwin-folder',
    TOOLS_SET_GCC_FOLDER: 'tools:set-gcc-folder',
    TOOLS_SET_BASH_FOLDER: 'tools:set-bash-folder',
    TOOLS_SET_EMULATOR: 'tools:set-emulator',
    TOOLS_CHECK: 'tools:check',

    // Project lifecycle IPCs
    PROJECT_NEW: 'project:new',
    PROJECT_SAVE: 'project:save',
    PROJECT_SAVE_AS: 'project:save-as',
    PROJECT_OPEN: 'project:open',
    PROJECT_GET_SETTINGS: 'project:get-settings',
    PROJECT_UPDATE_SETTINGS: 'project:update-settings',

    // Dialog IPCs
    DIALOG_SHOW_SAVE: 'dialog:show-save',
    DIALOG_SHOW_SAVE_PROJECT: 'dialog:show-save-project',
    DIALOG_SHOW_OPEN_DIR: 'dialog:show-open-dir',
    DIALOG_SHOW_OPEN_FILE: 'dialog:show-open-file',

    // Git IPCs
    GIT_OPEN_REPO: 'git:open-repo',
    GIT_CLONE: 'git:clone',
    GIT_CLONE_DEFAULT: 'git:clone-default',

    // Build & Emulation IPCs
    BUILD_RUN_MAKE: 'build:run-make',
    EMULATOR_RUN: 'build:run-emulator',

    // Task streaming
    TASK_STREAM: 'task:stream',
} as const

export const AllowedChannels = [
    IpcChannels.APP_NOTIFICATION,
    IpcChannels.TASK_STREAM,
] as const;

export type Channel = (typeof AllowedChannels)[number];

export interface TaskStreamPayload {
    task: 'git-clone' | string;
    id?: string;
    stream: 'stdout' | 'stderr';
    text: string;
    final?: boolean;
}