import { LineId, AsmLine } from './asmLine';

export enum LineOpType {
    INSERT = 'insert',
    DELETE = 'delete',
    EDIT = 'edit',
    MOVE = 'move',
    FAIL = 'fail'
}

export interface InsertOp {
    type: LineOpType.INSERT;
    index: number;
    text: string;
    id?: number;
}

export interface DeleteOp {
    type: LineOpType.DELETE;
    index: number;
}

export interface EditOp {
    type: LineOpType.EDIT;
    index: number;
    newText: string;
}

export interface MoveOp {
    type: LineOpType.MOVE;
    indexFrom: number;
    indexTo: number;
}

export type AsmLineOp = InsertOp | DeleteOp | EditOp | MoveOp;

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

        // Operations' target
        const opsTarget: (AsmLine | null)[] = [...this.lines];

        try {
            // Convert complex operations to basic insert/delete operations
            const basicOps = this.convertComplexOps(ops);
            
            // Sort operations by index descending, DELETE first, but preserve original order for same index
            const sortedOps = this.sortBasicOps(basicOps);
            
            // Execute basic operations
            for (const op of sortedOps) {
                //Check operation is valid
                this.checkBasicOp(op);
                
                switch (op.type) {
                    case LineOpType.INSERT:
                        const newLine = this.createLine(op.text, op.id);
                        opsTarget.splice(op.index, 0, newLine);
                        break;
                    case LineOpType.DELETE:
                        opsTarget[op.index] = null;
                        break;
                }
            }
        } catch (error) {
            // Rollback on any failure
            this.lineIdCount = originalLineIdCount;
            throw error;
        }

        // Remove deleted lines and update state
        this.lines = opsTarget.filter((line) => line !== null);

        // Rebuild index map after all operations
        this.rebuildIndexMap();
            
        // Increment version only after successful completion
        this.version++;
    }

    /**
     * Convert complex operations (edit, move) to basic insert/delete operations
     */
    private convertComplexOps(ops: AsmLineOp[]): (InsertOp | DeleteOp)[] {
        const basicOps: (InsertOp | DeleteOp)[] = [];
        for (const op of ops) {
            basicOps.push(...this.convertComplexOp(op));
        }
        return basicOps;
    }

    /**
     * Convert a complex operation (edit, move) to basic insert/delete operations
     */
    private convertComplexOp(op: AsmLineOp): (InsertOp | DeleteOp)[] {
        switch (op.type) {
            case LineOpType.INSERT:
            case LineOpType.DELETE:
                return [op];
            case LineOpType.EDIT:
                const editOp = op as EditOp;
                const lineToEdit = this.lines[editOp.index];
                // Edit = Delete + Insert at same position
                return [
                    {
                        type: LineOpType.DELETE,
                        index: editOp.index,
                    },
                    {
                        type: LineOpType.INSERT,
                        index: editOp.index,
                        text: editOp.newText,
                        id: lineToEdit.id,
                    },
                ];
            case LineOpType.MOVE:
                const moveOp = op as MoveOp;
                // Move = Extract line + Delete from source + Insert at destination
                const lineToMove = this.lines[moveOp.indexFrom];
                const textsToMove = lineToMove.text;
                return [
                    // Delete from source
                    {
                        type: LineOpType.DELETE,
                        index: moveOp.indexFrom,
                    },
                    // Insert at destination
                    {
                        type: LineOpType.INSERT,
                        index: moveOp.indexTo,
                        text: textsToMove,
                        id: lineToMove.id,
                    },
                ];
            default:
                throw new Error(`Unknown operation type: ${(op as any).type}`);
        }
    }

    /**
     * Sort operations by index descending, preserving order for operations on same index
     */
    private sortBasicOps(ops: (InsertOp | DeleteOp)[]): (InsertOp | DeleteOp)[] {
        return ops
            .map((op, originalIndex) => ({ op, originalIndex }))
            .sort((a, b) => {
                // First sort by index descending
                if (a.op.index !== b.op.index) {
                    return b.op.index - a.op.index;
                }
                if (a.op.type !== b.op.type) {
                    return (a.op.type === LineOpType.DELETE) ? -1 : +1;
                }
                // Then by original order for same index
                return a.originalIndex - b.originalIndex;
            })
            .map(({ op }) => op);
    }

    private checkBasicOp(op: InsertOp | DeleteOp): void {
        switch (op.type) {
            case LineOpType.INSERT:
                this.checkInsert(op);
                break;
            case LineOpType.DELETE:
                this.checkDelete(op);
                break;
            default:
                throw new Error(`Unexpected basic operation type: ${(op as any).type}`);
        }
    }

    private checkInsert(op: InsertOp): void {
        const { index, text } = op;
        if (index < 0 || index > this.lines.length) {
            throw new Error(`Invalid insert index ${index}: buffer contains ${this.lines.length} lines`);
        }
    }

    private checkDelete(op: DeleteOp): void {
        const index = op.index;
        if (index < 0 || index >= this.lines.length) {
            throw new Error(`Invalid delete index ${index}: buffer contains ${this.lines.length} lines`);
        }
    }

    /**
     * Create a new line with unique ID
     */
    private createLine(text: string, id?: number): AsmLine {
        const trimmed = text.replace(/^[\n\r]+|[\n\r]+$/g, '');
        return {
            id: id ?? this.getNextId(),
            text,
            length: text.length,
            isEmpty: (trimmed === ''),
            isComment: trimmed.startsWith(';'),
        };
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

}