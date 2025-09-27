import { AsmLine, LineId } from "./asmLine";

export interface AsmCodeBuffer {

    getLineById(id: LineId): { line: AsmLine; index: number } | null;
    readRangeByIds(ids: LineId[]): AsmLine[];
    getIndexOfLine(id: LineId): number | null;

    editLineById(id: LineId, newText: string): AsmLine;
    editLinesById(ids: LineId[], newTexts: string[]): AsmLine[];

    // insertion
    insertLineBeforeId(targetId: LineId, newText: string, meta?: any): AsmLine;
    insertLinesBeforeId(targetId: LineId, newTexts: string[], meta?: any): AsmLine[];
    insertLineAfterId(targetId: LineId, newText: string, meta?: any): AsmLine;
    insertLinesAfterId(targetId: LineId, newTexts: string[], meta?: any): AsmLine[];
    insertLineAtIndex(index: number, newText: string, meta?: any): AsmLine;
    insertLinesAtIndex(index: number, newTexts: string[], meta?: any): AsmLine[];

    // deletion
    removeLineById(id: LineId): boolean;
    removeLinesByIds(ids: LineId[]): number; // returns number removed

    // moving
    moveLineToIndex(id: LineId, destIndex: number): boolean;
    moveLinesToIndex(ids: LineId[], destIndex: number): boolean;
    swapLines(id1: LineId, id2: LineId): boolean;

    getAllLines(): AsmLine[];
    toSource(): string;
    getVersion(): number; // Incremented on every mutation

}