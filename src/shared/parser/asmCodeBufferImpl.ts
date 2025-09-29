import { AsmLine, LineId } from "./asmLine";
import { AsmCodeBuffer } from "./asmCodeBuffer";

export class AsmCodeBufferImpl implements AsmCodeBuffer {

    private lines: AsmLine[];
    private idToIndex: number[] = [];    // idToIndex[lineId] = index in lines[]
    private lineIdCount = 0;
    private version = 0;
    private newline: "\n" | "\r\n" | "\r";

    constructor(rawLines: string[], newline: "\n" | "\r\n" | "\r") {
        
        this.newline = newline;
        
        // Build the code lines
        this.lines = rawLines.map((line) => this.createLine(line));

        // Populate the index array
        this.rebuildIndexMap();
    }

    getLineById(id: LineId): { line: AsmLine; index: number } | null {
        const idx = this.idToIndex[id];
        return (idx !== undefined && idx !== -1) ? {
            line: this.lines[idx],
            index: idx
        } : null;
    }

    getLinesByIds(ids: LineId[]): { line: AsmLine; index: number }[] {
        return ids
            .map(id => this.getLineById(id))
            .filter(result => result !== null);
    }

    editLineById(id: LineId, newText: string): AsmLine {
        return this.editLinesById([id], [newText])[0];
    }
    
    editLinesById(ids: LineId[], newTexts: string[]): AsmLine[] {
        if (ids.length !== newTexts.length) {
            throw new Error('ids and newTexts arrays must have the same length');
        }
        if (newTexts.length === 0) return [];
        
        const updatedLines: AsmLine[] = [];
        
        ids.forEach((id, i) => {
            const result = this.getLineById(id);
            if (!result) throw new Error(`Line with ID ${id} not found`);
            
            const { line, index } = result;
            const updatedLine = this.createLineWithId(newTexts[i], line.id);

            // Replace the line at the same position
            this.lines[index] = updatedLine;
            updatedLines.push(updatedLine);
        });
        
        // No need to rebuild index map since position didn't change
        this.version++;
        
        return updatedLines;
    }

    insertLineAtIndex(index: number, newText: string, meta?: any): AsmLine {
        return this.insertLinesAtIndex(index, [newText])[0];
    }

    insertLinesAtIndex(index: number, newTexts: string[]): AsmLine[] {
        
        if (newTexts.length === 0) return [];
        if ((index < 0) || (index > this.lines.length)) {
            throw new Error(`Invalid code line index ${index}: code file contains ${this.lines.length} lines`)
        }
        
        // Create new lines from the input texts
        const lines = newTexts.map((text) => this.createLine(text));

        // Insert the lines and update mappings
        this.lines.splice(index, 0, ...lines);
        
        // Rebuild the index map after insertion
        this.rebuildIndexMap();

        // Increment version
        this.version++;

        return [...lines];
    }

    insertLineBeforeId(targetId: LineId, newText: string, meta?: any): AsmLine {
        return this.insertLinesBeforeId(targetId, [newText])[0];
    }
    
    insertLinesBeforeId(targetId: LineId, newTexts: string[], meta?: any): AsmLine[] {
        if (newTexts.length === 0) return [];
        
        const result = this.getLineById(targetId);
        if (!result) {
            throw new Error(`Line with ID ${targetId} not found`);
        }
        
        return this.insertLinesAtIndex(result.index, newTexts);   
    }
    
    insertLineAfterId(targetId: LineId, newText: string, meta?: any): AsmLine {
        return this.insertLinesAfterId(targetId, [newText])[0];
    }
    
    insertLinesAfterId(targetId: LineId, newTexts: string[], meta?: any): AsmLine[] {
        if (newTexts.length === 0) return [];
        
        const result = this.getLineById(targetId);
        if (!result) {
            throw new Error(`Line with ID ${targetId} not found`);
        }
        
        return this.insertLinesAtIndex(result.index + 1, newTexts);
    }

    removeLineById(id: LineId): boolean {
        return (this.removeLinesByIds([id]) !== 0);
    }
    
    removeLinesByIds(ids: LineId[]): number {
        if (ids.length === 0) return 0;
        
        // Sort indices in descending order to remove from end first
        // This prevents index shifting from affecting subsequent removals
        const linesToRemove = this.
            getLinesByIds(ids)
            .sort((a, b) => b!.index - a!.index);
        
        // Only proceed if there are actual lines to remove
        if (linesToRemove.length === 0) return 0;
        
        // Remove lines from end to beginning
        linesToRemove.forEach(line => {
            this.lines.splice(line.index!, 1);
        });
        
        // Rebuild the index map
        this.rebuildIndexMap();
        this.version++;

        return linesToRemove.length;
        
    }

    moveLineToIndex(id: LineId, destIndex: number): boolean {
        const result = this.getLineById(id);
        if (!result) return false;
        
        if (destIndex < 0 || destIndex > this.lines.length) {
            throw new Error(`Invalid destination index ${destIndex}: code file contains ${this.lines.length} lines`);
        }
        
        const { line, index: currentIndex } = result;
        
        // Remove from current position
        this.lines.splice(currentIndex, 1);
        
        // Adjust destination index if moving from earlier to later position
        const adjustedDestIndex = currentIndex < destIndex ? destIndex - 1 : destIndex;
        
        // Insert at new position
        this.lines.splice(adjustedDestIndex, 0, line);
        
        // Rebuild the index map
        this.rebuildIndexMap();
        this.version++;
        
        return true;
    }
    
    swapLines(id1: LineId, id2: LineId): boolean {
        const result1 = this.getLineById(id1);
        const result2 = this.getLineById(id2);
        
        if (!result1 || !result2) return false;
        
        const { line: line1, index: index1 } = result1;
        const { line: line2, index: index2 } = result2;
        
        // Swap the lines in the array
        this.lines[index1] = line2;
        this.lines[index2] = line1;
        
        // Update the index mappings
        this.idToIndex[id1] = index2;
        this.idToIndex[id2] = index1;
        
        this.version++;
        
        return true;
    }

    
    moveRangeToIndex(rangeFrom: number, rangeLength: number, destIndex: number): boolean {
        // Validate range parameters
        if (rangeFrom < 0 || rangeLength <= 0 || rangeFrom + rangeLength > this.lines.length) {
            throw new Error(`Invalid range [${rangeFrom}, ${rangeLength}]: code file contains ${this.lines.length} lines`);
        }
        
        if (destIndex < 0 || destIndex > this.lines.length) {
            throw new Error(`Invalid destination index ${destIndex}: code file contains ${this.lines.length} lines`);
        }
        
        // Extract the lines to move
        const linesToMove = this.lines.slice(rangeFrom, rangeFrom + rangeLength);
        
        // Remove the lines from their current position
        this.lines.splice(rangeFrom, rangeLength);
        
        // Calculate adjusted destination index
        // If moving to a position after the removed range, adjust for the removal
        const adjustedDestIndex = destIndex > rangeFrom ? destIndex - rangeLength : destIndex;
        
        // Insert the lines at the new position
        this.lines.splice(adjustedDestIndex, 0, ...linesToMove);
        
        // Rebuild the index map and update version
        this.rebuildIndexMap();
        this.version++;
        
        return true;
    }

    removeRange(rangeFrom: number, rangeLength: number): number {
        this.replaceRange(rangeFrom, rangeLength, []);
        return rangeLength;
    }

    replaceRange(rangeFrom: number, rangeLength: number, newTexts: string[]): AsmLine[] {
        // Validate range parameters
        if (rangeFrom < 0 || rangeLength < 0 || rangeFrom + rangeLength > this.lines.length) {
            throw new Error(`Invalid range [${rangeFrom}, ${rangeLength}]: code file contains ${this.lines.length} lines`);
        }
        
        // Create new lines from the replacement texts
        const newLines = newTexts.map(text => this.createLine(text));
        
        // Replace the range with new lines
        this.lines.splice(rangeFrom, rangeLength, ...newLines);
        
        // Rebuild the index map and update version
        this.rebuildIndexMap();
        this.version++;
        
        return newLines;
    }

    getVersion(): number {
        return this.version;
    }

    getIndexOfLine(id: LineId): number | null {
        const idx = this.idToIndex[id];
        return (idx !== undefined && idx !== -1) ? idx : null;
    }

    getAllLines(): AsmLine[] {
        return [...this.lines];
    }

    toSource(): string {
        return this.lines.map(l => l.text).join(this.newline);
    }

    private rebuildIndexMap() {
        // Ensure array can hold all current IDs
        this.ensureIdToIndexCapacity(this.lineIdCount);

        // Clear existing mappings
        this.idToIndex.fill(-1);
        
        this.lines.forEach((line,idx)=> {
            this.idToIndex[line.id] = idx;
        });
    }

    private ensureIdToIndexCapacity(minCapacity: number) {
        if (this.idToIndex.length >= minCapacity) return;
        const tmp = new Array(minCapacity);
        // Copy existing values
        for (let i = 0; i < this.idToIndex.length; i++) {
            tmp[i] = this.idToIndex[i];
        }
        this.idToIndex = tmp;
    }
    
    private getNextId(): number {
        return this.lineIdCount++;
    }

    private createLine(rawLine: string): AsmLine {
        return this.createLineWithId(rawLine, this.getNextId());
    }

    private createLineWithId(rawLine: string, id: LineId): AsmLine {
        const trimmed = rawLine.trim();
        return {
            id: id,
            text: rawLine, // Don't use trimmed version
            length: rawLine.length,
            isEmpty: (trimmed === ''),
            isComment: trimmed.startsWith(';'),
        }
    }


}