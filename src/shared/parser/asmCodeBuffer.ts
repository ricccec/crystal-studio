import { AsmLine, LineId } from "./asmLine";
import { AsmLineOp, execBatchLineOps as execBatchLineOpsFunction } from "./asmLineOps";

export class AsmCodeBuffer {
    private lines: AsmLine[];
    private idToIndex: Map<LineId, number>;
    private lineIdCounter: number;
    private version: number;
    private newline: "\n" | "\r\n" | "\r";

    static parseAsmCode(asmSource: string): AsmCodeBuffer {
        const newline = detectNewline(asmSource);
        const rawLines = asmSource.split(/\r\n|\r|\n/);
        return new AsmCodeBuffer(rawLines, newline);
    }

    static fromLines(rawLines: string[], newline: ("\n" | "\r\n" | "\r") = '\n'): AsmCodeBuffer {
        return new AsmCodeBuffer(rawLines, newline);
    }

    private constructor(rawLines: string[], newline: "\n" | "\r\n" | "\r") {
        this.newline = newline;
        this.version = 0;
        this.lineIdCounter = 0;
        this.idToIndex = new Map();
        this.lines = rawLines.map(text => this.createLine(text));
        this.rebuildIndexMap();
    }

    getLineById(id: LineId): { line: AsmLine; index: number } | null {
        const index = this.idToIndex.get(id);
        if (index === undefined) return null;
        return { line: this.lines[index], index };
    }

    getLinesByIds(...ids: LineId[]): { line: AsmLine; index: number }[] {
        return ids
                .map(id => this.getLineById(id))
                .filter(result => result !== null);
    }

    getIndexOfLine(id: LineId): number | null {
        const index = this.idToIndex.get(id);
        return index !== undefined ? index : null;
    }

    getAllLines(): AsmLine[] {
        return [...this.lines];
    }

    toSource(): string {
        return this.lines.map(line => line.text).join(this.newline);
    }

    getVersion(): number {
        return this.version;
    }

    execBatchLineOps(ops: AsmLineOp[]): void {
        if (ops.length === 0) return;
        const newLines = execBatchLineOpsFunction(
            this.lines, 
            ops, 
            (text: string, id?: LineId) => this.createLine(text, id)
        );
        this.lines = newLines;
        this.rebuildIndexMap();
        this.version++;
    }

    private rebuildIndexMap(): void {
        this.idToIndex.clear();
        this.lines.forEach((line, index) => { this.idToIndex.set(line.id, index); });
    }

    private createLine(text: string, id?: LineId): AsmLine {
        const processedText = this.stripLineEndings(text);
        return {
            id: id ?? this.getNextId(),
            text: processedText,
            length: processedText.length,
            isEmpty: processedText.trim() === '',
            isComment: processedText.trim().startsWith(';')
        };
    }

    private getNextId(): LineId {
        return this.lineIdCounter++;
    }

    private stripLineEndings(text: string): string {
        return text.replace(/^[\n\r]+|[\n\r]+$/g, '');
    }
}

function detectNewline(asmSource: string): "\n" | "\r\n" | "\r" {
    const crlf = asmSource.indexOf('\r\n');
    if (crlf !== -1) return '\r\n';
    const cr = asmSource.indexOf('\r');
    if (cr !== -1) return '\r';
    return '\n';
}
