import { AsmCodeBufferImpl } from "./asmCodeBufferImpl";

/**
 * Detect the newline style used in the source.
 */
function detectNewline(asmSource: string) {
    const crlf = asmSource.indexOf('\r\n');
    if (crlf !== -1) return '\r\n';

    const cr = asmSource.indexOf("\r");
    if (cr !== -1) return "\r";

    return "\n"; // default
}

/**
 * Parse raw ASM text into a LineBuffer
 */
export function parseAsmCode(asmSource: string): AsmCodeBufferImpl {
    const newline = detectNewline(asmSource);
    const lines = asmSource.split(/\r\n|\r|\n/); // Allow for messed up newlines

    return new AsmCodeBufferImpl(lines, newline);
}