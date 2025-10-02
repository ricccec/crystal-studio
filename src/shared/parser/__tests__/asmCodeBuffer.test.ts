import { describe, it, expect, beforeEach } from 'vitest';
import { AsmCodeBuffer } from '../asmCodeBuffer';
import { LineOpType } from '../asmLineOps';

describe('AsmCodeBuffer', () => {
    describe('Static factory methods', () => {
        it('should parse ASM source code', () => {
            const source = 'MOV A, B\n; Comment\nADD A, #10';
            const buffer = AsmCodeBuffer.parseAsmCode(source);
            
            const lines = buffer.getAllLines();
            expect(lines).toHaveLength(3);
            expect(lines[0].text).toBe('MOV A, B');
            expect(lines[1].text).toBe('; Comment');
            expect(lines[1].isComment).toBe(true);
            expect(lines[2].text).toBe('ADD A, #10');
        });

        it('should create from lines array', () => {
            const rawLines = ['PUSH A', 'POP B'];
            const buffer = AsmCodeBuffer.fromLines(rawLines);
            
            const lines = buffer.getAllLines();
            expect(lines).toHaveLength(2);
            expect(lines[0].text).toBe('PUSH A');
            expect(lines[1].text).toBe('POP B');
        });

        it('should detect and preserve newline style', () => {
            const crlfSource = 'MOV A, B\r\nADD A, #10';
            const buffer = AsmCodeBuffer.parseAsmCode(crlfSource);
            
            const exported = buffer.toSource();
            expect(exported).toBe('MOV A, B\r\nADD A, #10');
        });
    });

    describe('Line queries', () => {
        let buffer: AsmCodeBuffer;

        beforeEach(() => {
            buffer = AsmCodeBuffer.fromLines(['MOV A, B', '; Comment', 'ADD A, #10']);
        });

        it('should get line by ID', () => {
            const result = buffer.getLineById(0);
            
            expect(result).not.toBeNull();
            expect(result!.line.text).toBe('MOV A, B');
            expect(result!.index).toBe(0);
        });

        it('should return null for non-existent ID', () => {
            const result = buffer.getLineById(999);
            expect(result).toBeNull();
        });

        it('should get multiple lines by IDs', () => {
            const results = buffer.getLinesByIds(0, 2);
            
            expect(results).toHaveLength(2);
            expect(results[0].line.text).toBe('MOV A, B');
            expect(results[1].line.text).toBe('ADD A, #10');
        });

        it('should get index of line', () => {
            const index = buffer.getIndexOfLine(1);
            expect(index).toBe(1);
        });

        it('should return null for non-existent line index', () => {
            const index = buffer.getIndexOfLine(999);
            expect(index).toBeNull();
        });

        it('should get all lines', () => {
            const lines = buffer.getAllLines();
            
            expect(lines).toHaveLength(3);
            expect(lines[0].text).toBe('MOV A, B');
            expect(lines[1].text).toBe('; Comment');
            expect(lines[2].text).toBe('ADD A, #10');
        });
    });

    describe('Versioning', () => {
        let buffer: AsmCodeBuffer;

        beforeEach(() => {
            buffer = AsmCodeBuffer.fromLines(['MOV A, B', 'ADD A, #10']);
        });

        it('should start at version 0', () => {
            expect(buffer.getVersion()).toBe(0);
        });

        it('should increment version after execBatchLineOps', () => {
            const v1 = buffer.getVersion();
            
            buffer.execBatchLineOps([
                { type: LineOpType.INSERT, index: 0, text: 'PUSH A' }
            ]);
            
            const v2 = buffer.getVersion();
            expect(v2).toBe(v1 + 1);
        });

        it('should not increment version for empty operations', () => {
            const v1 = buffer.getVersion();
            buffer.execBatchLineOps([]);
            expect(buffer.getVersion()).toBe(v1);
        });
    });

    describe('execBatchLineOps', () => {
        let buffer: AsmCodeBuffer;

        beforeEach(() => {
            buffer = AsmCodeBuffer.fromLines(['MOV A, B', '; Comment', 'ADD A, #10', '', 'JMP START']);
        });

        it('should update ID mappings after operations', () => {
            const originalFirstLineId = buffer.getAllLines()[0].id;
            
            buffer.execBatchLineOps([
                { type: LineOpType.INSERT, index: 0, text: 'PUSH A' }
            ]);
            
            // Original first line should now be at index 1
            const result = buffer.getLineById(originalFirstLineId);
            expect(result).not.toBeNull();
            expect(result!.index).toBe(1);
        });

        it('should handle FAIL operation by throwing', () => {
            expect(() => {
                buffer.execBatchLineOps([
                    { type: LineOpType.FAIL, index: 0, message: 'Test failure' }
                ]);
            }).toThrow('Operation batch failed due to explicit FAIL operation');
        });
    });

    describe('toSource', () => {
        it('should export to source with correct newlines', () => {
            const buffer = AsmCodeBuffer.fromLines(['MOV A, B', 'ADD A, #10'], '\n');
            const source = buffer.toSource();
            
            expect(source).toBe('MOV A, B\nADD A, #10');
        });

        it('should handle CRLF newlines', () => {
            const buffer = AsmCodeBuffer.fromLines(['MOV A, B', 'ADD A, #10'], '\r\n');
            const source = buffer.toSource();
            
            expect(source).toBe('MOV A, B\r\nADD A, #10');
        });

        it('should handle empty lines', () => {
            const buffer = AsmCodeBuffer.fromLines(['MOV A, B', '', 'ADD A, #10']);
            const source = buffer.toSource();
            
            expect(source).toBe('MOV A, B\n\nADD A, #10');
        });
    });

    describe('Line properties', () => {
        it('should detect empty lines', () => {
            const buffer = AsmCodeBuffer.fromLines(['MOV A, B', '', '   ']);
            const lines = buffer.getAllLines();
            
            expect(lines[0].isEmpty).toBe(false);
            expect(lines[1].isEmpty).toBe(true);
            expect(lines[2].isEmpty).toBe(true);
        });

        it('should detect comment lines', () => {
            const buffer = AsmCodeBuffer.fromLines(['MOV A, B', '; Comment', '  ; Indented comment']);
            const lines = buffer.getAllLines();
            
            expect(lines[0].isComment).toBe(false);
            expect(lines[1].isComment).toBe(true);
            expect(lines[2].isComment).toBe(true);
        });

        it('should calculate line length correctly', () => {
            const buffer = AsmCodeBuffer.fromLines(['MOV A, B', 'ADD A, #10']);
            const lines = buffer.getAllLines();
            
            expect(lines[0].length).toBe(8);
            expect(lines[1].length).toBe(10);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty buffer initialization', () => {
            const emptyBuffer = AsmCodeBuffer.fromLines([]);
            expect(emptyBuffer.getAllLines()).toHaveLength(0);
            expect(emptyBuffer.getVersion()).toBe(0);
        });

        it('should handle whitespace and special characters', () => {
            const specialBuffer = AsmCodeBuffer.fromLines([
                '  \t  ',  // Whitespace only
                '\t; Comment with tabs',
                'NORMAL LINE',
                '!!!Special chars!!!'
            ]);
            
            const lines = specialBuffer.getAllLines();
            expect(lines[0].isEmpty).toBe(true); // Tabs and whitespaces
            expect(lines[1].isComment).toBe(true);
            expect(lines[1].text).toBe('\t; Comment with tabs');
            expect(lines[3].text).toBe('!!!Special chars!!!');
        });

    });
});
