import type { ActionResult, ProcessResult, SpawnResult } from '@shared/types/types';
import React from 'react';

const App = () => {

    const [ consoleOutput, setConsoleState ] = React.useState<string>('');

    const formatValue = (v: unknown): string => {
        if (v === undefined) return '';
        if (v === null) return 'null';
        if (typeof v === 'object') {
            try { return JSON.stringify(v, null, 2); } catch { return String(v); }
        }
        return String(v);
    };

    const appendToConsoleOutput = (
        result : 
            | ProcessResult<any>
            | ActionResult<any>
            | SpawnResult
    ) => {
        const output = (() => {
            if ('status' in result) {
                switch(result.status) {
                    case 'canceled': return 'canceled';
                    case 'error': return result.error;
                    case 'success': 
                        if ('data' in result) return formatValue(result.data);
                        if ('stdout' in result) return formatValue(result.stdout);
                        return '';
                }
            } else if('ok' in result) {
                return result.ok ? formatValue(result.data) : result.error;
            }
            return '';
        })();
        setConsoleState(prev => `${prev}${output}\n`);
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
        const res = await window.api.cloneDefaultGitRepo(repoPath);
        appendToConsoleOutput(res);
    }

    return (
        <>
            <div>
                <button onClick={onNewProject}>New Project</button>
                <button onClick={onOpenProject}>Open Project</button>
                <button onClick={onSaveProject}>Save Project</button>
                <button onClick={onSaveProjectAs}>Save Project As</button>
            </div>
            <div>
                <button onClick={onOpenGit}>Open pret repo</button>
                <button onClick={onGitClone}>Clone pret repo</button>
            </div>
            <div>
                <textarea
                    rows={25}
                    style={{ width: '100%' }}
                    value={consoleOutput}
                    readOnly
                />
            </div>
        </>
    );
};

export default App;