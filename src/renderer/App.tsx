import { ProcessResult } from '@shared/types/types';import React from 'react';

const App = () => {

    const [ consoleOutput, setConsoleState ] = React.useState<string>('');

    const appendToConsoleOutput = (
        result : 
            | ProcessResult<any>
    ) => {
        const output = (() => {
            switch(result.status) {
                case 'canceled': return 'canceled';
                case 'error': return result.error;
                case 'success': 
                    if (result.data === undefined) return '';
                    if (typeof result.data === 'object') return JSON.stringify(result.data, null, 2);
                    return String(result.data);
            }
        })();
        setConsoleState(prev => `${prev}${output}\n`);
    };

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