import { TaskStreamPayload } from '@shared/ipc';
import type { ActionResult, ProcessResult, SpawnResult } from '@shared/types/types';
import React from 'react';

const App = () => {

    const [ consoleOutput, setConsoleState ] = React.useState<string>('');
    const [ progressLine, setProgressLine ] = React.useState<string>('');

    // Register callback for app notifications
    React.useEffect(() => {
        const unsub = window.api.on('task:stream', (payload) => {
            if (!payload) return;

            const p = payload as TaskStreamPayload;
            const line = p.text;

            if (line.endsWith('\r')) {
                // progress update -> replace progress line
                setProgressLine(line);
            } else {
                // Complete line -> clear progress and append
                setProgressLine('');
                appendToConsoleOutput(line);
            }
        })
        // Return unmount callback for React StrictMode to prevent registering twice
        return unsub;
    }, []);

    const formatValue = (v: unknown): string => {
        if (v === undefined) return '';
        if (v === null) return 'null';
        if (typeof v === 'object') {
            try { return JSON.stringify(v, null, 2); } catch { return String(v); }
        }
        return String(v);
    };

    const appendToConsoleOutput = (
        out : 
            | string
            | ProcessResult<any>
            | ActionResult<any>
            | SpawnResult
    ) => {
        const output = (() => {
            if (typeof out === 'string') return out;
            if ('status' in out) {
                switch(out.status) {
                    case 'canceled': return 'canceled';
                    case 'error': return out.error;
                    case 'success': 
                        if ('data' in out) return formatValue(out.data);
                        if ('stdout' in out) return formatValue(out.stdout);
                        return '';
                }
            } else if('ok' in out) {
                return out.ok ? formatValue(out.data) : out.error;
            }
            return '';
        })();
        setConsoleState(prev => `${prev}${output.trim()}\n`);
    };

    const onNewProject = async () => {
        const res = await window.api.newProject();
        appendToConsoleOutput(res);
    }

    const onOpenProject = async () => {
        const result = await window.api.openProject();
        appendToConsoleOutput(result);
    };

    const onSaveProject = async () => {
        const result = await window.api.saveProject();
        appendToConsoleOutput(result);
    };

    const onSaveProjectAs = async () => {
        let result = await window.api.showSaveProjectDialog();
        if (result.status === 'success') {
            result = await window.api.saveProjectAs(result.data);
        }
        appendToConsoleOutput(result);
    };

    const onCheckTools = async () => {
        const res = await window.api.checkTools() as { tool: string, status: any }[];

        function formatToolLine(toolName: string, res: { ok: boolean, version?: string, error?: string}) {
            return `${toolName}: ${res.ok ? (res.version ?? 'OK') : `ERROR: ${res.error}`}`;
        }
        
        const lines = res.map((item) => formatToolLine(item.tool, item.status));
        appendToConsoleOutput(lines.join('\n'));

    };

    const onOpenGit = async() => {
        const d = await window.api.showOpenDirDialog("Open pret repo");
        if (d.status !== 'success') {
            appendToConsoleOutput(d);
            return;
        }

        const repoPath = d.data;
        const res = await window.api.openGitRepo(repoPath);
        appendToConsoleOutput(res);
    }

    const onGitClone = async() => {
        const d = await window.api.showOpenDirDialog("Select target directory");
        if (d.status !== 'success') {
            appendToConsoleOutput(d);
            return;
        }

        const repoPath = d.data;
        const runRes = await window.api.cloneDefaultGitRepo(repoPath);
        if (runRes.status === 'error') {
            appendToConsoleOutput(runRes.error);
        } else if (runRes.status === 'canceled') {
            appendToConsoleOutput(runRes.signal ?? 'Canceled');
        }
    }

    const onRunMake = async () => {

        const runRes = await window.api.runMake();
        if (runRes.status === 'error') {
            appendToConsoleOutput(runRes.error);
        } else if (runRes.status === 'canceled') {
            appendToConsoleOutput(runRes.signal ?? 'Canceled');
        }
    }

    const onSelectMakeDir = async () => {
        const r = await window.api.showOpenDirDialog("Select folder");
        if (r.status === 'success') {
            const setRes = await window.api.setMakeFolder(r.data);
            if (setRes.ok) {
                appendToConsoleOutput(setRes.data!);
            }
        }
    }

    const onSelectRgbdsDir = async () => {
        const r = await window.api.showOpenDirDialog("Select folder");
        if (r.status === 'success') {
            const setRes = await window.api.setRgbdsFolder(r.data);
            if (setRes.ok) {
                appendToConsoleOutput(setRes.data!);
            }
        }
    }

    const onSelectGccDir = async () => {
        const r = await window.api.showOpenDirDialog("Select folder");
        if (r.status === 'success') {
            const setRes = await window.api.setGccFolder(r.data);
            if (setRes.ok) {
                appendToConsoleOutput(setRes.data!);
            }
        }
    };

    const onSelectBashDir = async () => {
        const r = await window.api.showOpenDirDialog("Select folder");
        if (r.status === 'success') {
            const setRes = await window.api.setBashFolder(r.data);
            if (setRes.ok) {
                appendToConsoleOutput(setRes.data!);
            }
        }
    };

    const onSelectEmulator = async () => {
        let filters = null;
        if (window.api.platform === 'win32') {
            filters = [
                { name: 'Executables', extensions: ['exe'] },
                { name: 'All Files', extensions: ['*'] },
            ];
        }

        const r = await window.api.showOpenFileDialog("Select emulator", filters ?? []);
        if (r.status !== 'success') return;

        const setRes = await window.api.setEmulator(r.data);
        if (setRes.ok) {
            appendToConsoleOutput(setRes.data!);
        }
        
    }

    const onShowAppSettings = async () => {
        const s = await window.api.getAppSettings();
        appendToConsoleOutput(JSON.stringify(s, null, 2));
    };

    const onResetAppSettings = async () => {
        const r = await window.api.resetAppSetting();
        if (!r.ok) appendToConsoleOutput(r.error);
    }
    
    return (
        <>
            <div>
                <h5>App Settings</h5>
                <button onClick={onResetAppSettings}>Reset App Settings</button>
                <button onClick={onShowAppSettings}>Show App Settings</button>
            </div>
            <div>
                <h5>Project lifecycle</h5>
                <button onClick={onNewProject}>New Project</button>
                <button onClick={onOpenProject}>Open Project</button>
                <button onClick={onSaveProject}>Save Project</button>
                <button onClick={onSaveProjectAs}>Save Project As</button>
            </div>
            <div>
                <h5>ROM building</h5>
                <button onClick={onOpenGit}>Open pret repo</button>
                <button onClick={onGitClone}>Clone pret repo</button>
                <button onClick={onRunMake}>Build project</button>
            </div>
            <div>
                <h5>Tools</h5>
                <button onClick={onCheckTools}>Check tools</button>
                <button onClick={onSelectBashDir}>Select bash folder</button>
                <button onClick={onSelectMakeDir}>Select make folder</button>
                <button onClick={onSelectGccDir}>Select GCC folder</button>
                <button onClick={onSelectRgbdsDir}>Select rgbds folder</button>
                <button onClick={onSelectEmulator}>Select emulator</button>
            </div>
            <div>
                <textarea
                    rows={25}
                    style={{ width: '100%' }}
                    value={`${consoleOutput}${progressLine}`}
                    readOnly
                />
            </div>
        </>
    );
};

export default App;