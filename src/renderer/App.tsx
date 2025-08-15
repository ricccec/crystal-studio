import { ProcessResult } from '@shared/types/types';
import React from 'react';

const App = () => {

    const [ consoleOutput, setConsoleState ] = React.useState<string>('');

    const appendToConsoleOutput = (
        result : 
            | ProcessResult
    ) => {
        const output = (() => {
            switch(result.status) {
                case 'canceled': return 'canceled';
                case 'error': return result.error;
                case 'success': return result.data;
        
            }
        })();
        setConsoleState(prev => `${prev}${output}\n`);
    }

    const onSaveProject = async () => {
        const result = await window.api.saveProject();
        appendToConsoleOutput(result);
    }

    const onSaveProjectAs = async () => {
        let result = await window.api.openSaveProjectDialog();
        if (result.status === 'success') {
            result = await window.api.saveProjectAs(result.data);
        }
            appendToConsoleOutput(result);
    }

    return (
        <>
            <div>
                <button onClick={onSaveProject}>Save Project</button>
                <button onClick={onSaveProjectAs}>Save Project As</button>
            </div>
            <div>
                <textarea
                    style={{ width: '100%' }}
                    value={consoleOutput}
                    readOnly
                />
            </div>
        </>
    );
};

export default App;