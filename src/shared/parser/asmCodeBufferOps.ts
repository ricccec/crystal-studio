import { AsmLine, LineId } from "./asmLine";
import { AsmCodeBuffer } from "./asmCodeBuffer";
import { LineOpType } from "./asmLineOps";

export function editLinesById(buffer: AsmCodeBuffer, ...edits: { id: LineId, newText: string }[]): AsmLine[] {
    if (edits.length === 0) return [];
    
    const editOps = edits.map(({ id, newText }, i) => {
        const result = buffer.getLineById(id);
        if (!result) throw new Error(`Line with ID ${id} not found`);
        
        return {
            type: LineOpType.EDIT as const,
            index: result.index,
            newText: newText
        };
    });
    
    buffer.execBatchLineOps(editOps);
    
    // Return the updated lines
    return getLinesById(buffer, ...edits.map(i => i.id));
}

export function insertLinesAtIndex(buffer: AsmCodeBuffer, index: number, ...newTexts: string[]): AsmLine[] {
    if (newTexts.length === 0) return [];
    
    const allLines = buffer.getAllLines();
    if (index < 0 || index > allLines.length) {
        throw new Error(`Invalid code line index ${index}: buffer contains ${allLines.length} lines`);
    }
    
    const insertOps = newTexts.map(text => ({
        type: LineOpType.INSERT as const,
        index,
        text
    }));
    
    buffer.execBatchLineOps(insertOps);
    
    // Return the newly inserted lines (they will be at indices starting from 'index')
    const updatedLines = buffer.getAllLines();
    return updatedLines.slice(index, index + newTexts.length);
}

export function insertLinesBeforeId(buffer: AsmCodeBuffer, targetId: LineId, ...newTexts: string[]): AsmLine[] {
    const result = buffer.getLineById(targetId);
    if (!result) {
        throw new Error(`Line with ID ${targetId} not found`);
    }
    return insertLinesAtIndex(buffer, result.index, ...newTexts);
}

export function insertLinesAfterId(buffer: AsmCodeBuffer, targetId: LineId, ...newTexts: string[]): AsmLine[] {
    const result = buffer.getLineById(targetId);
    if (!result) {
        throw new Error(`Line with ID ${targetId} not found`);
    }
    return insertLinesAtIndex(buffer, result.index + 1, ...newTexts);
}

export function removeLinesById(buffer: AsmCodeBuffer, ...ids: LineId[]): number {
    if (ids.length === 0) return 0;
    
    // Get indices of existing lines only
    const indicesToDelete = ids
        .map(id => buffer.getIndexOfLine(id))
        .filter((index): index is number => index !== null);
    
    if (indicesToDelete.length === 0) return 0;
    
    const deleteOps = indicesToDelete.map(index => ({
        type: LineOpType.DELETE as const,
        index
    }));
    buffer.execBatchLineOps(deleteOps);
    
    return indicesToDelete.length;
}

export function swapLines(buffer: AsmCodeBuffer, id1: LineId, id2: LineId): boolean {
    const result1 = buffer.getLineById(id1);
    const result2 = buffer.getLineById(id2);
    
    if (!result1 || !result2) return false;
    
    // Execute both moves to swap the lines
    buffer.execBatchLineOps([
        { type: LineOpType.MOVE as const, indexFrom: result1.index, indexTo: result2.index },
        { type: LineOpType.MOVE as const, indexFrom: result2.index, indexTo: result1.index }
    ]);
    
    return true;
}

export function moveLineToIndex(buffer: AsmCodeBuffer, id: LineId, index: number): boolean {
    const result = buffer.getLineById(id);
    if (!result) throw new Error(`Line with ID ${id} not found`);
    
    return moveRangeToIndex(buffer, result.index, 1, index);
}

export function moveRangeToIndex(buffer: AsmCodeBuffer, rangeFrom: number, rangeLength: number, destIndex: number): boolean {
    const allLines = buffer.getAllLines();
    
    // Validate range parameters
    if (rangeFrom < 0 || rangeLength <= 0 || rangeFrom + rangeLength > allLines.length) {
        throw new Error(`Invalid range [${rangeFrom}, ${rangeLength}]: buffer contains ${allLines.length} lines`);
    }
    
    if (destIndex < 0 || destIndex > allLines.length) {
        throw new Error(`Invalid destination index ${destIndex}: buffer contains ${allLines.length} lines`);
    }
    
    // Create move operations for each line in the range
    const moveOps = [];
    for (let i = 0; i < rangeLength; i++) {
        const fromIndex = rangeFrom + i;
        const toIndex = destIndex;
        moveOps.push({
            type: LineOpType.MOVE as const,
            indexFrom: fromIndex,
            indexTo: toIndex
        });
    }
    buffer.execBatchLineOps(moveOps);
    
    return true;
}

export function removeRange(buffer: AsmCodeBuffer, rangeFrom: number, rangeLength: number): number {
    replaceRange(buffer, rangeFrom, rangeLength, []);
    return rangeLength;
}

/**
 * Replace a range of lines with new content
 * @param buffer The buffer to modify
 * @param rangeFrom Starting index of the range
 * @param rangeLength Number of lines to replace
 * @param newTexts Array of new texts to replace with
 * @returns Array of new lines that were inserted
 */
export function replaceRange(buffer: AsmCodeBuffer, rangeFrom: number, rangeLength: number, newTexts: string[]): AsmLine[] {
    const allLines = buffer.getAllLines();
    
    // Validate range parameters
    if (rangeFrom < 0 || rangeLength < 0 || rangeFrom + rangeLength > allLines.length) {
        throw new Error(`Invalid range [${rangeFrom}, ${rangeLength}]: buffer contains ${allLines.length} lines`);
    }
    
    const ops = [];
    
    // First, delete the existing range
    for (let i = rangeLength - 1; i >= 0; i--) {
        ops.push({
            type: LineOpType.DELETE as const,
            index: rangeFrom + i
        });
    }
    
    // Then, insert the new lines at the start of the range
    for (let i = 0; i < newTexts.length; i++) {
        ops.push({
            type: LineOpType.INSERT as const,
            index: rangeFrom + i,
            text: newTexts[i]
        });
    }
    
    buffer.execBatchLineOps(ops);
    
    // Return the newly inserted lines
    const updatedLines = buffer.getAllLines();
    return updatedLines.slice(rangeFrom, rangeFrom + newTexts.length);
}

function getLinesById(buffer: AsmCodeBuffer, ...ids: LineId[]): AsmLine[] {
    return ids.map(id => {
        const result = buffer.getLineById(id);
        if (!result) throw new Error(`Line with ID ${id} not found`);
        return result.line;
    });
}