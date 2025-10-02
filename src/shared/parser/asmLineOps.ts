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

export type LineFactory = (text: string, id?: LineId) => AsmLine;

/**
 * Execute a batch of line operations on the provided lines array.
 * Returns a new array with all operations applied atomically.
 * 
 * @param lines - The initial array of lines to operate on
 * @param ops - Array of operations to execute
 * @param createLine - Factory function to create new AsmLine instances
 * @returns New array of lines with operations applied
 * @throws Error if any operation is invalid or conflicts occur
 */
export function execBatchLineOps(
    lines: readonly AsmLine[], 
    ops: AsmLineOp[], 
    createLine: LineFactory
): AsmLine[] {

    if (ops.length === 0) return [...lines];

    // Step 1: Create a working copy of the lines array
    const workingLines: (AsmLine | null)[] = [...lines];
    
    // Step 2: First pass - execute edits and mark deletes as null
    // Also validate all operations and check for conflicts
    validateAndExecuteFirstPass(ops, workingLines, lines.length, createLine);
    
    // Step 3: Convert move operations to insert operations
    const opsWithMovesConverted = convertMovesToInserts(ops, workingLines);
    
    // Step 4: Execute insert operations in proper order
    const finalLines = executeInsertOperations(opsWithMovesConverted, workingLines, createLine);

    // Step 5: Remove all null elements and return
    return finalLines.filter(line => line !== null) as AsmLine[];
}

/**
 * Step 2: First pass - execute edits and mark deletes as null
 * Also validate all operations and check for conflicts
 */
function validateAndExecuteFirstPass(
    ops: AsmLineOp[], 
    workingLines: (AsmLine | null)[], 
    bufferSize: number, 
    createLine: LineFactory
): void {
        const deletedIndices = new Set<number>();

        for (const op of ops) {
            // Validate operation ranges
            validateOperationRange(op, bufferSize);

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
                    workingLines[editOp.index] = createLine(editOp.newText, originalLine.id);
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
function convertMovesToInserts(ops: AsmLineOp[], workingLines: (AsmLine | null)[]): InsertWithIdOp[] {
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
function executeInsertOperations(
    insertOps: InsertWithIdOp[], 
    workingLines: (AsmLine | null)[], 
    createLine: LineFactory
): (AsmLine | null)[] {

        // Sort by index descending, preserving original order for same index
        const sortedInserts = insertOps
            .map((op, originalIndex) => ({ op, originalIndex }))
            .sort((a, b) => {
                if (a.op.index !== b.op.index) {
                    return b.op.index - a.op.index; // Descending by index
                }
                return b.originalIndex - a.originalIndex; // Ascending by original order for same index
            })
            .map(({ op }) => op);

        // Create a copy to work with
        let result: (AsmLine | null)[] = [...workingLines];

        // Execute inserts in sorted order
        for (const op of sortedInserts) {
            const newLine = createLine(op.text, op.id);
            result.splice(op.index, 0, newLine);
        }

        return result;
    }

/**
 * Validate operation range
 */
function validateOperationRange(op: AsmLineOp, bufferSize: number): void {
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

