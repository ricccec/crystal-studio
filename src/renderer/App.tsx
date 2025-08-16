import type { ActionResult, ProcessResult } from '@shared/types/types';
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
    ) => {
        const output = (() => {
            if ('status' in result) {
                switch(result.status) {
                    case 'canceled': return 'canceled';
                    case 'error': return result.error;
                    case 'success': return formatValue(result.data);
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
        let result = await window.api.openSaveProjectDialog();
        if (result.status === 'success') {
            result = await window.api.saveProjectAs(result.data);
        }
        appendToConsoleOutput(result);
    };

    return (
        <>
            <div>
                <button onClick={onNewProject}>New Project</button>
                <button onClick={onOpenProject}>Open Project</button>
                <button onClick={onSaveProject}>Save Project</button>
                <button onClick={onSaveProjectAs}>Save Project As</button>
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