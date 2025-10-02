export type LineId = number;

export interface AsmLine {
    id: LineId;
    text: string;      // content of the code line (no trailing newline)
    length: number;    // cached text.length (optional but handy)
    isEmpty: boolean;
    isComment: boolean;
}