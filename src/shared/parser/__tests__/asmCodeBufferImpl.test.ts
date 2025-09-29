import { describe, it, expect, beforeEach } from 'vitest';
import { AsmCodeBufferImpl } from '../asmCodeBufferImpl';
import { AsmLine, LineId } from '../asmLine';

describe('AsmCodeBufferImpl', () => {
    let buffer: AsmCodeBufferImpl;
    const sampleLines = [
        'MOV A, B',
        '; This is a comment',
        'ADD A, #10',
        '',
        'JMP START'
    ];
    const newline = '\n';

    beforeEach(() => {
        buffer = new AsmCodeBufferImpl(sampleLines, newline);
    });

    describe('Constructor and Basic Properties', () => {
        it('should initialize with provided lines', () => {
            const lines = buffer.getAllLines();
            expect(lines).toHaveLength(5);
            expect(lines[0].text).toBe('MOV A, B');
            expect(lines[1].text).toBe('; This is a comment');
            expect(lines[2].text).toBe('ADD A, #10');
            expect(lines[3].text).toBe('');
            expect(lines[4].text).toBe('JMP START');
        });

        it('should assign sequential IDs starting from 0', () => {
            const lines = buffer.getAllLines();
            lines.forEach((line, index) => {
                expect(line.id).toBe(index);
            });
        });

        it('should detect empty lines correctly', () => {
            const lines = buffer.getAllLines();
            expect(lines[3].isEmpty).toBe(true);
            expect(lines[0].isEmpty).toBe(false);
        });

        it('should detect comments correctly', () => {
            const lines = buffer.getAllLines();
            expect(lines[1].isComment).toBe(true);
            expect(lines[0].isComment).toBe(false);
        });

        it('should calculate line lengths correctly', () => {
            const lines = buffer.getAllLines();
            expect(lines[0].length).toBe(8); // 'MOV A, B' (trimmed)
            expect(lines[3].length).toBe(0); // empty line
        });

        it('should start with version 0', () => {
            expect(buffer.getVersion()).toBe(0);
        });
    });

    describe('getLineById', () => {
        it('should return line and index for valid ID', () => {
            const result = buffer.getLineById(1);
            expect(result).not.toBeNull();
            expect(result!.line.text).toBe('; This is a comment');
            expect(result!.index).toBe(1);
        });

        it('should return null for invalid ID', () => {
            const result = buffer.getLineById(999);
            expect(result).toBeNull();
        });

        it('should return correct index after modifications', () => {
            const { line, index } = buffer.getLineById(0)!;
            buffer.insertLineAtIndex(index, 'NEW LINE');
            const result = buffer.getIndexOfLine(line.id);
            expect(result).not.toBeNull();
            expect(result).toBe(1); // Should be at index 1 now
        });
    });

    describe('getLinesByIds', () => {
        it('should return multiple lines by their IDs', () => {
            const results = buffer.getLinesByIds([0, 2, 4]);
            expect(results).toHaveLength(3);
            expect(results[0].line.text).toBe('MOV A, B');
            expect(results[1].line.text).toBe('ADD A, #10');
            expect(results[2].line.text).toBe('JMP START');
        });

        it('should skip invalid IDs', () => {
            const results = buffer.getLinesByIds([0, 999, 2]);
            expect(results).toHaveLength(2);
            expect(results[0].line.text).toBe('MOV A, B');
            expect(results[1].line.text).toBe('ADD A, #10');
        });

        it('should return empty array for all invalid IDs', () => {
            const results = buffer.getLinesByIds([999, 1000]);
            expect(results).toHaveLength(0);
        });
    });

    describe('getIndexOfLine', () => {
        it('should return correct index for valid ID', () => {
            expect(buffer.getIndexOfLine(0)).toBe(0);
            expect(buffer.getIndexOfLine(2)).toBe(2);
        });

        it('should return null for invalid ID', () => {
            expect(buffer.getIndexOfLine(999)).toBeNull();
        });
    });

    describe('editLineById', () => {
        it('should edit existing line and preserve ID', () => {
            const originalLine = buffer.getLineById(1);
            const editedLine = buffer.editLineById(1, 'EDITED LINE');
            
            expect(editedLine.text).toBe('EDITED LINE');
            expect(editedLine.id).toBe(originalLine!.line.id);
            expect(buffer.getVersion()).toBe(1);
        });

        it('should throw error for invalid ID', () => {
            expect(() => buffer.editLineById(999, 'NEW TEXT')).toThrow('Line with ID 999 not found');
        });

        it('should update line properties correctly', () => {
            const editedLine = buffer.editLineById(0, '; New comment');
            expect(editedLine.isComment).toBe(true);
            expect(editedLine.isEmpty).toBe(false);
            expect(editedLine.length).toBe(13);
        });
    });

    describe('editLinesById', () => {
        it('should edit multiple lines correctly', () => {
            const editedLines = buffer.editLinesById([0, 2], ['NEW LINE 1', 'NEW LINE 2']);
            
            expect(editedLines).toHaveLength(2);
            expect(editedLines[0].text).toBe('NEW LINE 1');
            expect(editedLines[1].text).toBe('NEW LINE 2');
            expect(buffer.getVersion()).toBe(1);
        });

        it('should throw error for mismatched array lengths', () => {
            expect(() => buffer.editLinesById([0, 1], ['ONLY ONE']))
                .toThrow('ids and newTexts arrays must have the same length');
        });

        it('should throw error for invalid IDs', () => {
            expect(() => buffer.editLinesById([0, 999, 2], ['EDIT 1', 'INVALID', 'EDIT 3']))
                .toThrow('Line with ID 999 not found');
        });
    });

    describe('insertLineAtIndex', () => {
        it('should insert line at specified index', () => {
            const newLine = buffer.insertLineAtIndex(1, 'INSERTED LINE');
            
            expect(newLine.text).toBe('INSERTED LINE');
            expect(buffer.getAllLines()).toHaveLength(6);
            expect(buffer.getAllLines()[1].text).toBe('INSERTED LINE');
            expect(buffer.getVersion()).toBe(1);
        });

        it('should insert at beginning', () => {
            const newLine = buffer.insertLineAtIndex(0, 'FIRST LINE');
            expect(buffer.getAllLines()[0].text).toBe('FIRST LINE');
        });

        it('should insert at end', () => {
            const newLine = buffer.insertLineAtIndex(5, 'LAST LINE');
            expect(buffer.getAllLines()[5].text).toBe('LAST LINE');
        });

        it('should throw error for invalid index', () => {
            expect(() => buffer.insertLineAtIndex(-1, 'INVALID'))
                .toThrow('Invalid code line index -1');
            expect(() => buffer.insertLineAtIndex(10, 'INVALID'))
                .toThrow('Invalid code line index 10');
        });
    });

    describe('insertLinesAtIndex', () => {
        it('should insert multiple lines at specified index', () => {
            const newLines = buffer.insertLinesAtIndex(2, ['LINE 1', 'LINE 2', 'LINE 3']);
            
            expect(newLines).toHaveLength(3);
            expect(buffer.getAllLines()).toHaveLength(8);
            expect(buffer.getAllLines()[2].text).toBe('LINE 1');
            expect(buffer.getAllLines()[3].text).toBe('LINE 2');
            expect(buffer.getAllLines()[4].text).toBe('LINE 3');
        });

        it('should handle empty array', () => {
            const newLines = buffer.insertLinesAtIndex(1, []);
            expect(newLines).toHaveLength(0);
            expect(buffer.getAllLines()).toHaveLength(5); // No change
            expect(buffer.getVersion()).toBe(0); // No version increment
        });
    });

    describe('insertLineBeforeId', () => {
        it('should insert line before target ID', () => {
            const newLine = buffer.insertLineBeforeId(2, 'BEFORE LINE');
            
            expect(newLine.text).toBe('BEFORE LINE');
            expect(buffer.getAllLines()).toHaveLength(6);
            
            const targetLineResult = buffer.getLineById(2);
            expect(targetLineResult!.index).toBe(3); // Original line should be at index 3 now
        });

        it('should throw error for invalid target ID', () => {
            expect(() => buffer.insertLineBeforeId(999, 'NEW LINE'))
                .toThrow('Line with ID 999 not found');
        });
    });

    describe('insertLinesBeforeId', () => {
        it('should insert multiple lines before target ID', () => {
            const newLines = buffer.insertLinesBeforeId(1, ['BEFORE 1', 'BEFORE 2']);
            
            expect(newLines).toHaveLength(2);
            expect(buffer.getAllLines()).toHaveLength(7);
            
            const targetLineResult = buffer.getLineById(1);
            expect(targetLineResult!.index).toBe(3); // Original line should be at index 3 now
        });
    });

    describe('insertLineAfterId', () => {
        it('should insert line after target ID', () => {
            const newLine = buffer.insertLineAfterId(1, 'AFTER LINE');
            
            expect(newLine.text).toBe('AFTER LINE');
            expect(buffer.getAllLines()).toHaveLength(6);
            
            const targetLineResult = buffer.getLineById(1);
            expect(targetLineResult!.index).toBe(1); // Original line should stay at index 1
            expect(buffer.getAllLines()[2].text).toBe('AFTER LINE');
        });
    });

    describe('insertLinesAfterId', () => {
        it('should insert multiple lines after target ID', () => {
            const newLines = buffer.insertLinesAfterId(1, ['AFTER 1', 'AFTER 2']);
            
            expect(newLines).toHaveLength(2);
            expect(buffer.getAllLines()).toHaveLength(7);
            expect(buffer.getAllLines()[2].text).toBe('AFTER 1');
            expect(buffer.getAllLines()[3].text).toBe('AFTER 2');
        });
    });

    describe('removeLineById', () => {
        it('should remove line by ID successfully', () => {
            const result = buffer.removeLineById(1);
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()).toHaveLength(4);
            expect(buffer.getLineById(1)).toBeNull();
            expect(buffer.getVersion()).toBe(1);
        });

        it('should return false for invalid ID', () => {
            const result = buffer.removeLineById(999);
            expect(result).toBe(false);
            expect(buffer.getAllLines()).toHaveLength(5); // No change
            expect(buffer.getVersion()).toBe(0);
        });

        it('should update indices correctly after removal', () => {
            buffer.removeLineById(1); // Remove second line
            
            const line2Result = buffer.getLineById(2);
            expect(line2Result!.index).toBe(1); // Should move to index 1
        });
    });

    describe('removeLinesByIds', () => {
        it('should remove multiple lines by IDs', () => {
            const count = buffer.removeLinesByIds([1, 3]);
            
            expect(count).toBe(2);
            expect(buffer.getAllLines()).toHaveLength(3);
            expect(buffer.getLineById(1)).toBeNull();
            expect(buffer.getLineById(3)).toBeNull();
        });

        it('should handle invalid IDs gracefully', () => {
            const count = buffer.removeLinesByIds([1, 999, 3]);
            
            expect(count).toBe(2); // Only 2 valid IDs removed
            expect(buffer.getAllLines()).toHaveLength(3);
        });

        it('should handle empty array', () => {
            const count = buffer.removeLinesByIds([]);
            expect(count).toBe(0);
            expect(buffer.getAllLines()).toHaveLength(5); // No change
        });
    });

    describe('moveLineToIndex', () => {
        it('should move line to new position', () => {
            const result = buffer.moveLineToIndex(0, 3); // Move first line to position 3
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[2].text).toBe('MOV A, B'); // Adjusted index due to removal first
            expect(buffer.getLineById(0)!.index).toBe(2);
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle moving line backwards', () => {
            const result = buffer.moveLineToIndex(4, 1); // Move last line to position 1
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[1].text).toBe('JMP START');
            expect(buffer.getLineById(4)!.index).toBe(1);
        });

        it('should return false for invalid line ID', () => {
            const result = buffer.moveLineToIndex(999, 1);
            expect(result).toBe(false);
        });

        it('should throw error for invalid destination index', () => {
            expect(() => buffer.moveLineToIndex(0, -1))
                .toThrow('Invalid destination index -1');
            expect(() => buffer.moveLineToIndex(0, 10))
                .toThrow('Invalid destination index 10');
        });
    });

    describe('swapLines', () => {
        it('should swap two lines successfully', () => {
            const result = buffer.swapLines(0, 2);
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[0].text).toBe('ADD A, #10'); // Was at index 2
            expect(buffer.getAllLines()[2].text).toBe('MOV A, B');   // Was at index 0
            expect(buffer.getVersion()).toBe(1);
        });

        it('should return false if either ID is invalid', () => {
            expect(buffer.swapLines(0, 999)).toBe(false);
            expect(buffer.swapLines(999, 0)).toBe(false);
            expect(buffer.swapLines(999, 1000)).toBe(false);
        });
    });

    describe('moveRangeToIndex', () => {
        it('should move range to new position', () => {
            const result = buffer.moveRangeToIndex(1, 2, 4); // Move 2 lines from index 1 to index 4
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[2].text).toBe('; This is a comment'); // Originally at index 1
            expect(buffer.getAllLines()[3].text).toBe('ADD A, #10'); // Originally at index 2
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle moving range backwards', () => {
            const result = buffer.moveRangeToIndex(3, 2, 1); // Move 2 line from index 3 to index 1
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[1].text).toBe(''); // Empty line moved from index 3
            expect(buffer.getAllLines()[2].text).toBe('JMP START'); // line moved from index 4
        });

        it('should throw error for invalid range', () => {
            expect(() => buffer.moveRangeToIndex(-1, 1, 2))
                .toThrow('Invalid range [-1, 1]');
            expect(() => buffer.moveRangeToIndex(1, 0, 2))
                .toThrow('Invalid range [1, 0]');
            expect(() => buffer.moveRangeToIndex(1, 10, 2))
                .toThrow('Invalid range [1, 10]');
            expect(buffer.getVersion()).toBe(0);
        });

        it('should throw error for invalid destination', () => {
            expect(() => buffer.moveRangeToIndex(1, 1, -1))
                .toThrow('Invalid destination index -1');
            expect(() => buffer.moveRangeToIndex(1, 1, 10))
                .toThrow('Invalid destination index 10');
            expect(buffer.getVersion()).toBe(0);
        });
    });

    describe('removeRange', () => {
        it('should remove range of lines', () => {
            const count = buffer.removeRange(1, 2); // Remove 2 lines starting at index 1
            
            expect(count).toBe(2);
            expect(buffer.getAllLines()).toHaveLength(3);
            expect(buffer.getAllLines()[1].text).toBe(''); // Empty line, originally at index 3
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle removing single line', () => {
            const count = buffer.removeRange(2, 1);
            
            expect(count).toBe(1);
            expect(buffer.getAllLines()).toHaveLength(4);
        });
    });

    describe('replaceRange', () => {
        it('should replace range with new lines', () => {
            const newLines = buffer.replaceRange(1, 2, ['REPLACE 1', 'REPLACE 2', 'REPLACE 3']);
            
            expect(newLines).toHaveLength(3);
            expect(buffer.getAllLines()).toHaveLength(6); // 5 original - 2 removed + 3 added
            expect(buffer.getAllLines()[1].text).toBe('REPLACE 1');
            expect(buffer.getAllLines()[2].text).toBe('REPLACE 2');
            expect(buffer.getAllLines()[3].text).toBe('REPLACE 3');
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle replacing with fewer lines', () => {
            const newLines = buffer.replaceRange(1, 2, ['SINGLE']);
            
            expect(newLines).toHaveLength(1);
            expect(buffer.getAllLines()).toHaveLength(4); // 5 original - 2 removed + 1 added
        });

        it('should handle replacing with empty array (deletion)', () => {
            const newLines = buffer.replaceRange(1, 2, []);
            
            expect(newLines).toHaveLength(0);
            expect(buffer.getAllLines()).toHaveLength(3); // 5 original - 2 removed
        });

        it('should throw error for invalid range', () => {
            expect(() => buffer.replaceRange(-1, 1, ['NEW']))
                .toThrow('Invalid range [-1, 1]');
            expect(() => buffer.replaceRange(1, -1, ['NEW']))
                .toThrow('Invalid range [1, -1]');
            expect(() => buffer.replaceRange(1, 10, ['NEW']))
                .toThrow('Invalid range [1, 10]');
            expect(buffer.getVersion()).toBe(0);
        });
    });

    describe('toSource', () => {
        it('should reconstruct source with correct newlines', () => {
            const source = buffer.toSource();
            const expectedSource = sampleLines.join(newline);
            expect(source).toBe(expectedSource);
        });

        it('should handle different newline types', () => {
            const windowsBuffer = new AsmCodeBufferImpl(['LINE1', 'LINE2'], '\r\n');
            expect(windowsBuffer.toSource()).toBe('LINE1\r\nLINE2');
            
            const macBuffer = new AsmCodeBufferImpl(['LINE1', 'LINE2'], '\r');
            expect(macBuffer.toSource()).toBe('LINE1\rLINE2');
        });
    });

    describe('Version Management', () => {
        it('should increment version on mutations', () => {
            expect(buffer.getVersion()).toBe(0);
            
            buffer.editLineById(0, 'EDIT');
            expect(buffer.getVersion()).toBe(1);
            
            buffer.insertLineAtIndex(0, 'INSERT');
            expect(buffer.getVersion()).toBe(2);
            
            buffer.removeLineById(1); // Remove the inserted line instead of the edited one
            expect(buffer.getVersion()).toBe(3);
            
            buffer.moveLineToIndex(0, 1);
            expect(buffer.getVersion()).toBe(4);
            
            buffer.swapLines(0, 2);
            expect(buffer.getVersion()).toBe(5);
        });

        it('should not increment version for no-op operations', () => {
            const initialVersion = buffer.getVersion();
            
            buffer.insertLinesAtIndex(0, []); // Empty array
            expect(buffer.getVersion()).toBe(initialVersion);
            
            buffer.removeLinesByIds([]); // Empty array
            expect(buffer.getVersion()).toBe(initialVersion);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty buffer initialization', () => {
            const emptyBuffer = new AsmCodeBufferImpl([], '\n');
            expect(emptyBuffer.getAllLines()).toHaveLength(0);
            expect(emptyBuffer.getVersion()).toBe(0);
        });

        it('should handle whitespace and special characters', () => {
            const specialBuffer = new AsmCodeBufferImpl([
                '  \t  ',  // Whitespace only
                '\t; Comment with tabs',
                'NORMAL LINE',
                '!!!Special chars!!!'
            ], '\n');
            
            const lines = specialBuffer.getAllLines();
            expect(lines[0].isEmpty).toBe(true); // Tabs and whitespaces
            expect(lines[1].isComment).toBe(true);
            expect(lines[1].text).toBe('\t; Comment with tabs');
            expect(lines[3].text).toBe('!!!Special chars!!!');
        });

        it('should maintain consistency after complex operations', () => {
            // Perform a series of operations
            buffer.insertLineAtIndex(2, 'INSERTED');
            buffer.editLineById(0, 'EDITED');
            buffer.removeLineById(3);
            buffer.moveLineToIndex(1, 4);
            
            // Verify all lines can still be accessed by their IDs
            const allLines = buffer.getAllLines();
            allLines.forEach(line => {
                const result = buffer.getLineById(line.id);
                expect(result).not.toBeNull();
                expect(result!.line.id).toBe(line.id);
            });
        });

        it('should handle large operations efficiently', () => {
            // Create a larger buffer for performance testing
            const largeLines = Array(1000).fill(0).map((_, i) => `LINE ${i}`);
            const largeBuffer = new AsmCodeBufferImpl(largeLines, '\n');
            
            // Perform bulk operations
            const insertTexts = Array(100).fill(0).map((_, i) => `INSERT ${i}`);
            const newLines = largeBuffer.insertLinesAtIndex(500, insertTexts);
            
            expect(newLines).toHaveLength(100);
            expect(largeBuffer.getAllLines()).toHaveLength(1100);
            
            // Verify random access still works
            const randomLine = largeBuffer.getLineById(750);
            expect(randomLine).not.toBeNull();
        });
    });
});