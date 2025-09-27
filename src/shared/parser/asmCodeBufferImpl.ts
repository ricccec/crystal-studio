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

    readRangeByIds(ids: LineId[]): AsmLine[] {
        throw new Error("Method not implemented.");
    }
    editLineById(id: LineId, newText: string): AsmLine {
        throw new Error("Method not implemented.");
    }
    editLinesById(ids: LineId[], newTexts: string[]): AsmLine[] {
        throw new Error("Method not implemented.");
    }
    insertLineBeforeId(targetId: LineId, newText: string, meta?: any): AsmLine {
        throw new Error("Method not implemented.");
    }
    insertLinesBeforeId(targetId: LineId, newTexts: string[], meta?: any): AsmLine[] {
        throw new Error("Method not implemented.");
    }
    insertLineAfterId(targetId: LineId, newText: string, meta?: any): AsmLine {
        throw new Error("Method not implemented.");
    }
    insertLinesAfterId(targetId: LineId, newTexts: string[], meta?: any): AsmLine[] {
        throw new Error("Method not implemented.");
    }
    insertLineAtIndex(index: number, newText: string, meta?: any): AsmLine {
        throw new Error("Method not implemented.");
    }
    removeLineById(id: LineId): boolean {
        throw new Error("Method not implemented.");
    }
    removeLinesByIds(ids: LineId[]): number {
        throw new Error("Method not implemented.");
    }
    moveLineToIndex(id: LineId, destIndex: number): boolean {
        throw new Error("Method not implemented.");
    }
    moveLinesToIndex(ids: LineId[], destIndex: number): boolean {
        throw new Error("Method not implemented.");
    }
    swapLines(id1: LineId, id2: LineId): boolean {
        throw new Error("Method not implemented.");
    }

    getVersion(): number {
        return this.version;
    }

    getLineById(id: LineId): { line: AsmLine; index: number } | null {
        const idx = this.idToIndex[id];
        return idx !== undefined ? {
            line: this.lines[idx],
            index: idx
        } : null;
    }

    getIndexOfLine(id: LineId): number | null {
        const idx = this.idToIndex[id];
        return idx !== undefined ? idx : null;
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

    private createLine(rawLine: string) {
        const trimmed = rawLine.trim();
        return {
            id: this.getNextId(),
            text: trimmed,
            length: trimmed.length,
            isEmpty: (trimmed === ''),
            isComment: trimmed.startsWith(';'),
        }
    }

}