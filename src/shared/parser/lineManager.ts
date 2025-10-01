import { LineId, AsmLine } from './asmLine';

export enum LineOpType {
    INSERT = 'insert',
    DELETE = 'delete',
    EDIT = 'edit',
    MOVE = 'move',
    FAIL = 'fail'
}

export type InsertOp = {
    type: LineOpType.INSERT;
    index: number;
    text: string;
}

export type DeleteOp = {
    type: LineOpType.DELETE;
    index: number;
}

export type EditOp = {
    type: LineOpType.EDIT;
    index: number;
    newText: string;
}

export type MoveOp = {
    type: LineOpType.MOVE;
    indexFrom: number;
    indexTo: number;
}

export type FailOp = {
    type: LineOpType.FAIL;
    index: number;
    message: string;
}

export type AsmLineOp = InsertOp | DeleteOp | EditOp | MoveOp | FailOp;

// Used internally for move operations
type InsertWithIdOp = 
    & InsertOp
    & {id?: number};

export class LineManager {
    private lines: AsmLine[] = [];
    private idToIndex: number[] = [];
    private lineIdCount = 0;
    private version = 0;

    constructor(initialLines: AsmLine[] = []) {
        this.lines = [...initialLines];
        this.lineIdCount = initialLines.length > 0 ? Math.max(...initialLines.map(l => l.id)) + 1 : 0;
        this.rebuildIndexMap();
    }

    /**
     * Execute a batch of operations atomically.
     * All operations use indices relative to the initial state.
     * Version is only incremented if all operations succeed.
     */
    execBatchOps(ops: AsmLineOp[]): void {
        if (ops.length === 0) return;

        // Create a snapshot of the current state for potential rollback
        const originalLineIdCount = this.lineIdCount;

        try {
            // Step 1: Create a working copy of the lines array
            const workingLines: (AsmLine | null)[] = [...this.lines];
            
            // Step 2: First pass - execute edits and mark deletes as null
            // Also validate all operations and check for conflicts
            this.validateAndExecuteFirstPass(ops, workingLines);
            
            // Step 3: Convert move operations to insert operations
            const opsWithMovesConverted = this.convertMovesToInserts(ops, workingLines);
            
            // Step 4: Execute insert operations in proper order
            const finalLines = this.executeInsertOperations(opsWithMovesConverted, workingLines);

            // Step 5: Remove all null elements
            const cleanLines = finalLines.filter(line => line !== null);
            
            // Step 6: Replace original lines and rebuild index map
            this.lines = cleanLines;
            this.rebuildIndexMap();
            
            // Increment version only after successful completion
            this.version++;
            
        } catch (error) {
            // Rollback on any failure
            this.lineIdCount = originalLineIdCount;
            throw error;
        }
    }

    /**
     * Step 2: First pass - execute edits and mark deletes as null
     * Also validate all operations and check for conflicts
     */
    private validateAndExecuteFirstPass(ops: AsmLineOp[], workingLines: (AsmLine | null)[]): void {
        const deletedIndices = new Set<number>();

        for (const op of ops) {
            // Validate operation ranges
            this.validateOperationRange(op, this.lines.length);

            // Validate operations sequence
            switch (op.type) {
                case LineOpType.EDIT:
                case LineOpType.DELETE:
                    if (workingLines[op.index] === null) {
                        throw new Error(`Cannot delete line at index ${op.index}: line was already deleted`);
                    }
                    break;

                case LineOpType.MOVE:
                    const moveOp = op as MoveOp;
                    if (workingLines[moveOp.indexFrom] === null) {
                        throw new Error(`Cannot move line from index ${moveOp.indexFrom}: line was already deleted`);
                    }
                    // Move validation will be done later
                    break;
            }

            // Execute operation
            switch (op.type) {
                case LineOpType.EDIT:
                    const editOp = op as EditOp;
                    // Execute edit immediately - preserves line ID
                    const originalLine = workingLines[editOp.index] as AsmLine;
                    workingLines[editOp.index] = this.createLine(editOp.newText, originalLine.id);
                    break;

                case LineOpType.DELETE:
                    const deleteOp = op as DeleteOp;
                    // Mark as deleted (null) but keep array structure intact
                    workingLines[deleteOp.index] = null;
                    break;

                case LineOpType.MOVE:
                case LineOpType.INSERT:
                    // Move and insert operations will be done later
                    break;

                case LineOpType.FAIL:
                    throw new Error('Operation batch failed due to explicit FAIL operation');

                default:
                    throw new Error(`Unknown operation type: ${(op as any).type}`);
            }
        }
    }

    /**
     * Step 3: Convert move operations to insert operations
     */
    private convertMovesToInserts(ops: AsmLineOp[], workingLines: (AsmLine | null)[]): InsertWithIdOp[] {
        const result: InsertWithIdOp[] = [];

        for (const op of ops) {
            if (op.type === LineOpType.MOVE) {
                const moveOp = op as MoveOp;
                const lineToMove = workingLines[moveOp.indexFrom];
                
                if (lineToMove === null) {
                    throw new Error(`Cannot move line from index ${moveOp.indexFrom}: line was deleted`);
                }

                // Replace move with insert operation
                result.push({
                    type: LineOpType.INSERT,
                    index: moveOp.indexTo,
                    text: lineToMove.text,
                    id: lineToMove.id
                } as InsertWithIdOp);

                // Mark source as deleted
                workingLines[moveOp.indexFrom] = null;
            } else if (op.type === LineOpType.INSERT) {
                result.push(op as InsertWithIdOp);
            }
            // Skip edit and delete operations - already handled
        }

        return result;
    }

    /**
     * Step 4: Execute insert operations in proper order
     */
    private executeInsertOperations(insertOps: InsertWithIdOp[], workingLines: (AsmLine | null)[]): (AsmLine | null)[] {

        // Sort by index descending, preserving original order for same index
        const sortedInserts = insertOps
            .map((op, originalIndex) => ({ op, originalIndex }))
            .sort((a, b) => {
                if (a.op.index !== b.op.index) {
                    return b.op.index - a.op.index; // Descending by index
                }
                return a.originalIndex - b.originalIndex; // Preserve order for same index
            })
            .map(({ op }) => op);

        // Create a copy to work with
        let result: (AsmLine | null)[] = [...workingLines];

        // Execute inserts in sorted order
        for (const op of sortedInserts) {
            const newLine = this.createLine(op.text, op.id);
            result.splice(op.index, 0, newLine);
        }

        return result;
    }

    /**
     * Validate operation range
     */
    private validateOperationRange(op: AsmLineOp, bufferSize: number): void {
        switch (op.type) {
            case LineOpType.DELETE:
            case LineOpType.EDIT:
                const indexOp = op as DeleteOp | EditOp;
                if (indexOp.index < 0 || indexOp.index >= bufferSize) {
                    throw new Error(`Invalid ${op.type} index ${indexOp.index}: buffer contains ${bufferSize} lines`);
                }
                break;

            case LineOpType.INSERT:
                const insertOp = op as InsertOp;
                if (insertOp.index < 0 || insertOp.index > bufferSize) {
                    throw new Error(`Invalid insert index ${insertOp.index}: buffer contains ${bufferSize} lines`);
                }
                break;

            case LineOpType.MOVE:
                const moveOp = op as MoveOp;
                if (moveOp.indexFrom < 0 || moveOp.indexFrom >= bufferSize) {
                    throw new Error(`Invalid move source index ${moveOp.indexFrom}: buffer contains ${bufferSize} lines`);
                }
                if (moveOp.indexTo < 0 || moveOp.indexTo > bufferSize) {
                    throw new Error(`Invalid move destination index ${moveOp.indexTo}: buffer contains ${bufferSize} lines`);
                }
                break;
        }
    }

    /**
     * Create a new line
     */
    private createLine(text: string, id?: number): AsmLine {
        const processedText =  this.stripLineEndings(text);
        return {
            id: id ?? this.getNextId(),
            text: processedText,
            length: processedText.length,
            isEmpty: (processedText.trim() === ''),
            isComment: processedText.trim().startsWith(';'),
        };
    }
    
    /**
     * remove newline and carriage return characters 
     */
    private stripLineEndings(text: string): string {
        return text.replace(/^[\n\r]+|[\n\r]+$/g, '');
    }

    /**
     * Get the next available line ID
     */
    private getNextId(): LineId {
        return this.lineIdCount++;
    }

    /**
     * Rebuild the index mapping after operations
     */
    private rebuildIndexMap(): void {
        // Ensure array can hold all current IDs
        this.ensureIdToIndexCapacity(this.lineIdCount);

        // Clear existing mappings
        this.idToIndex.fill(-1);
        
        this.lines.forEach((line,idx)=> {
            this.idToIndex[line.id] = idx;
        });
    }

    /**
     * Ensure the idToIndex array has sufficient capacity
     */
    private ensureIdToIndexCapacity(minCapacity: number): void {
        while (this.idToIndex.length < minCapacity) {
            this.idToIndex.push(-1);
        }
    }

    // Public getters for read access
    getLines(): readonly AsmLine[] {
        return this.lines;
    }

    getVersion(): number {
        return this.version;
    }

    getLineById(id: LineId): { line: AsmLine; index: number } | null {
        const idx = this.idToIndex[id];
        return (idx !== undefined && idx !== -1) ? {
            line: this.lines[idx],
            index: idx
        } : null;
    }

    getLineCount(): number {
        return this.lines.length;
    }
}