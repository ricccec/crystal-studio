import { describe, it, expect, beforeEach } from 'vitest';
import { AsmCodeBuffer } from '../asmCodeBuffer';
import * as BufferOps from '../asmCodeBufferOps';
import { AsmLine, LineId } from '../asmLine';

describe('AsmCodeBufferImpl Module Functions', () => {
    let buffer: AsmCodeBuffer;
    const sampleLines = [
        'MOV A, B',
        '; This is a comment',
        'ADD A, #10',
        '',
        'JMP START'
    ];
    const newline = '\n';

    beforeEach(() => {
        buffer = AsmCodeBuffer.fromLines(sampleLines, newline);
    });

    describe('editLinesById', () => {
        it('should edit existing line and preserve ID', () => {
            const originalLine = buffer.getLineById(1);
            const editedLine = BufferOps.editLinesById(buffer, { id:1, newText:'EDITED LINE'})[0];
            
            expect(editedLine.text).toBe('EDITED LINE');
            expect(editedLine.id).toBe(originalLine!.line.id);
            expect(buffer.getVersion()).toBe(1);
        });

        it('should throw error for invalid ID', () => {
            expect(() => BufferOps.editLinesById(buffer, { id:999, newText:'NEW TEXT' })).toThrow('Line with ID 999 not found');
        });

        it('should update line properties correctly', () => {
            const editedLine = BufferOps.editLinesById(buffer, { id:0, newText:'; New comment' })[0];
            expect(editedLine.isComment).toBe(true);
            expect(editedLine.isEmpty).toBe(false);
            expect(editedLine.length).toBe(13);
        });

        it('should edit multiple lines correctly', () => {
            const editedLines = BufferOps.editLinesById(buffer,
                { id:0, newText:'NEW LINE 1' },
                { id:2, newText:'NEW LINE 2' }
            );
            
            expect(editedLines).toHaveLength(2);
            expect(editedLines[0].text).toBe('NEW LINE 1');
            expect(editedLines[1].text).toBe('NEW LINE 2');
            expect(buffer.getVersion()).toBe(1);
        });

        it('should throw error for invalid IDs', () => {
            expect(() => BufferOps.editLinesById(buffer,
                { id:0, newText:'EDIT 1' },
                { id:999, newText:'INVALID' },
                { id:2, newText:'EDIT 3' },
            )).toThrow('Line with ID 999 not found');
        });
    });

    describe('insertLinesAtIndex', () => {
        it('should insert line at specified index', () => {
            const newLine = BufferOps.insertLinesAtIndex(buffer, 1, 'INSERTED LINE')[0];
            
            expect(newLine.text).toBe('INSERTED LINE');
            expect(buffer.getAllLines()).toHaveLength(6);
            expect(buffer.getAllLines()[1].text).toBe('INSERTED LINE');
            expect(buffer.getVersion()).toBe(1);
        });

        it('should insert at beginning', () => {
            BufferOps.insertLinesAtIndex(buffer, 0, 'FIRST LINE');
            expect(buffer.getAllLines()[0].text).toBe('FIRST LINE');
        });

        it('should insert at end', () => {
            BufferOps.insertLinesAtIndex(buffer, 5, 'LAST LINE');
            expect(buffer.getAllLines()[5].text).toBe('LAST LINE');
        });

        it('should throw error for invalid index', () => {
            expect(() => BufferOps.insertLinesAtIndex(buffer, -1, 'INVALID'))
                .toThrow('Invalid code line index -1');
            expect(() => BufferOps.insertLinesAtIndex(buffer, 10, 'INVALID'))
                .toThrow('Invalid code line index 10');
        });

        it('should insert multiple lines at specified index', () => {
            const newLines = BufferOps.insertLinesAtIndex(buffer, 2, 'LINE 1', 'LINE 2', 'LINE 3');
            
            expect(newLines).toHaveLength(3);
            expect(buffer.getAllLines()).toHaveLength(8);
            expect(buffer.getAllLines()[2].text).toBe('LINE 1');
            expect(buffer.getAllLines()[3].text).toBe('LINE 2');
            expect(buffer.getAllLines()[4].text).toBe('LINE 3');
        });

        it('should handle empty array', () => {
            const newLines = BufferOps.insertLinesAtIndex(buffer, 1);
            expect(newLines).toHaveLength(0);
            expect(buffer.getAllLines()).toHaveLength(5); // No change
            expect(buffer.getVersion()).toBe(0); // No version increment
        });
    });

    describe('insertLinesBeforeId', () => {
        it('should insert single line before target ID', () => {
            const newLine = BufferOps.insertLinesBeforeId(buffer, 2, 'BEFORE LINE')[0];
            
            expect(newLine.text).toBe('BEFORE LINE');
            expect(buffer.getAllLines()).toHaveLength(6);
            
            const targetLineResult = buffer.getLineById(2);
            expect(targetLineResult!.index).toBe(3); // Original line should be at index 3 now
        });

        it('should throw error for invalid target ID', () => {
            expect(() => BufferOps.insertLinesBeforeId(buffer, 999, 'NEW LINE'))
                .toThrow('Line with ID 999 not found');
        });

        it('should insert multiple lines before target ID', () => {
            const newLines = BufferOps.insertLinesBeforeId(buffer, 1, 'BEFORE 1', 'BEFORE 2');
            
            expect(newLines).toHaveLength(2);
            expect(buffer.getAllLines()).toHaveLength(7);
            
            const targetLineResult = buffer.getLineById(1);
            expect(targetLineResult!.index).toBe(3); // Original line should be at index 3 now
        });
    });

    describe('insertLinesAfterId', () => {
        it('should insert single line after target ID', () => {
            const newLine = BufferOps.insertLinesAfterId(buffer, 1, 'AFTER LINE')[0];
            
            expect(newLine.text).toBe('AFTER LINE');
            expect(buffer.getAllLines()).toHaveLength(6);
            
            const targetLineResult = buffer.getLineById(1);
            expect(targetLineResult!.index).toBe(1); // Original line should stay at index 1
            expect(buffer.getAllLines()[2].text).toBe('AFTER LINE');
        });

        it('should insert multiple lines after target ID', () => {
            const newLines = BufferOps.insertLinesAfterId(buffer, 1, 'AFTER 1', 'AFTER 2');
            
            expect(newLines).toHaveLength(2);
            expect(buffer.getAllLines()).toHaveLength(7);
            expect(buffer.getAllLines()[2].text).toBe('AFTER 1');
            expect(buffer.getAllLines()[3].text).toBe('AFTER 2');
        });
    });
    
    describe('removeLinesByIds', () => {
        it('should remove single line by ID successfully', () => {
            const count = BufferOps.removeLinesById(buffer, 1);
            
            expect(count).toBe(1);
            expect(buffer.getAllLines()).toHaveLength(4);
            expect(buffer.getLineById(1)).toBeNull();
            expect(buffer.getVersion()).toBe(1);
        });
    
        it('should update indices correctly after removal', () => {
            BufferOps.removeLinesById(buffer, 1); // Remove second line
            
            const line2Result = buffer.getLineById(2);
            expect(line2Result!.index).toBe(1); // Should move to index 1
        });

        it('should remove multiple lines by IDs', () => {
            const count = BufferOps.removeLinesById(buffer, 1, 3);
            
            expect(count).toBe(2);
            expect(buffer.getAllLines()).toHaveLength(3);
            expect(buffer.getLineById(1)).toBeNull();
            expect(buffer.getLineById(3)).toBeNull();
        });

        it('should handle invalid IDs gracefully', () => {
            const count = BufferOps.removeLinesById(buffer, 1, 999, 3);
            
            expect(count).toBe(2); // Only 2 valid IDs removed
            expect(buffer.getAllLines()).toHaveLength(3);
        });

        it('should handle empty array', () => {
            const count = BufferOps.removeLinesById(buffer);
            expect(count).toBe(0);
            expect(buffer.getAllLines()).toHaveLength(5); // No change
        });
    });

    describe('moveLineToIndex', () => {
        it('should move line to new position', () => {
            const result = BufferOps.moveLineToIndex(buffer, 0, 3); // Move first line to position 3
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[2].text).toBe('MOV A, B'); // Adjusted index due to removal first
            expect(buffer.getLineById(0)!.index).toBe(2);
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle moving line backwards', () => {
            const result = BufferOps.moveLineToIndex(buffer, 4, 1); // Move last line to position 1
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[1].text).toBe('JMP START');
            expect(buffer.getLineById(4)!.index).toBe(1);
        });

        it('should throw error for invalid line ID', () => {
            expect(() => BufferOps.moveLineToIndex(buffer, 999, 1)).toThrowError();
        });

        it('should throw error for invalid destination index', () => {
            expect(() => BufferOps.moveLineToIndex(buffer, 0, -1))
                .toThrow('Invalid destination index -1');
            expect(() => BufferOps.moveLineToIndex(buffer, 0, 10))
                .toThrow('Invalid destination index 10');
        });
    });

    describe('swapLines', () => {
        it('should swap two lines successfully', () => {
            const result = BufferOps.swapLines(buffer, 0, 2);
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[0].text).toBe('ADD A, #10'); // Was at index 2
            expect(buffer.getAllLines()[2].text).toBe('MOV A, B');   // Was at index 0
            expect(buffer.getVersion()).toBe(1);
        });

        it('should return false if either ID is invalid', () => {
            expect(BufferOps.swapLines(buffer, 0, 999)).toBe(false);
            expect(BufferOps.swapLines(buffer, 999, 0)).toBe(false);
            expect(BufferOps.swapLines(buffer, 999, 1000)).toBe(false);
        });
    });

    describe('moveRangeToIndex', () => {
        it('should move range to new position', () => {
            const result = BufferOps.moveRangeToIndex(buffer, 1, 2, 4); // Move 2 lines from index 1 to index 4
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[2].text).toBe('; This is a comment'); // Originally at index 1
            expect(buffer.getAllLines()[3].text).toBe('ADD A, #10'); // Originally at index 2
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle moving range backwards', () => {
            const result = BufferOps.moveRangeToIndex(buffer, 3, 2, 1); // Move 2 line from index 3 to index 1
            
            expect(result).toBe(true);
            expect(buffer.getAllLines()[1].text).toBe(''); // Empty line moved from index 3
            expect(buffer.getAllLines()[2].text).toBe('JMP START'); // line moved from index 4
        });

        it('should throw error for invalid range', () => {
            expect(() => BufferOps.moveRangeToIndex(buffer, -1, 1, 2))
                .toThrow('Invalid range [-1, 1]');
            expect(() => BufferOps.moveRangeToIndex(buffer, 1, 0, 2))
                .toThrow('Invalid range [1, 0]');
            expect(() => BufferOps.moveRangeToIndex(buffer, 1, 10, 2))
                .toThrow('Invalid range [1, 10]');
            expect(buffer.getVersion()).toBe(0);
        });

        it('should throw error for invalid destination', () => {
            expect(() => BufferOps.moveRangeToIndex(buffer, 1, 1, -1))
                .toThrow('Invalid destination index -1');
            expect(() => BufferOps.moveRangeToIndex(buffer, 1, 1, 10))
                .toThrow('Invalid destination index 10');
            expect(buffer.getVersion()).toBe(0);
        });
    });

    describe('removeRange', () => {
        it('should remove range of lines', () => {
            const count = BufferOps.removeRange(buffer, 1, 2); // Remove 2 lines starting at index 1
            
            expect(count).toBe(2);
            expect(buffer.getAllLines()).toHaveLength(3);
            expect(buffer.getAllLines()[1].text).toBe(''); // Empty line, originally at index 3
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle removing single line', () => {
            const count = BufferOps.removeRange(buffer, 2, 1);
            
            expect(count).toBe(1);
            expect(buffer.getAllLines()).toHaveLength(4);
        });
    });

    describe('replaceRange', () => {
        it('should replace range with new lines', () => {
            const newLines = BufferOps.replaceRange(buffer, 1, 2, ['REPLACE 1', 'REPLACE 2', 'REPLACE 3']);
            
            expect(newLines).toHaveLength(3);
            expect(buffer.getAllLines()).toHaveLength(6); // 5 original - 2 removed + 3 added
            expect(buffer.getAllLines()[1].text).toBe('REPLACE 1');
            expect(buffer.getAllLines()[2].text).toBe('REPLACE 2');
            expect(buffer.getAllLines()[3].text).toBe('REPLACE 3');
            expect(buffer.getVersion()).toBe(1);
        });

        it('should handle replacing with fewer lines', () => {
            const newLines = BufferOps.replaceRange(buffer, 1, 2, ['SINGLE']);
            
            expect(newLines).toHaveLength(1);
            expect(buffer.getAllLines()).toHaveLength(4); // 5 original - 2 removed + 1 added
        });

        it('should handle replacing with empty array (deletion)', () => {
            const newLines = BufferOps.replaceRange(buffer, 1, 2, []);
            
            expect(newLines).toHaveLength(0);
            expect(buffer.getAllLines()).toHaveLength(3); // 5 original - 2 removed
        });

        it('should throw error for invalid range', () => {
            expect(() => BufferOps.replaceRange(buffer, -1, 1, ['NEW']))
                .toThrow('Invalid range [-1, 1]');
            expect(() => BufferOps.replaceRange(buffer, 1, -1, ['NEW']))
                .toThrow('Invalid range [1, -1]');
            expect(() => BufferOps.replaceRange(buffer, 1, 10, ['NEW']))
                .toThrow('Invalid range [1, 10]');
            expect(buffer.getVersion()).toBe(0);
        });
    });

    describe('replaceLines', () => {
        it('should just delete lines when third argument is empty', () => {
            const originalLength = buffer.getAllLines().length;
            const newLines = BufferOps.replaceLines(buffer, [1, 3], []);

            expect(newLines).toHaveLength(0); // No new lines created
            expect(buffer.getAllLines()).toHaveLength(originalLength - 2);
            expect(buffer.getLineById(1)).toBeNull;
            expect(buffer.getLineById(3)).toBeNull;
        });

        it('should replace lines with same number of new texts', () => {
            const newLines = BufferOps.replaceLines(buffer, [1, 3], ['REPLACED COMMENT', 'REPLACED EMPTY']);
            
            expect(newLines).toHaveLength(2);
            expect(buffer.getAllLines()).toHaveLength(5); // Same number of lines
            expect(buffer.getAllLines()[1].text).toBe('REPLACED COMMENT');
            expect(buffer.getAllLines()[3].text).toBe('REPLACED EMPTY');
            expect(buffer.getVersion()).toBe(1);
        });
        
        it('should insert a single block of lines when just one ID is provided', () => {
            const newLines = BufferOps.replaceLines(buffer, [2], ['NEW LINE 1', 'NEW LINE 2', 'NEW LINE 3']);
            
            expect(newLines).toHaveLength(3);
            expect(buffer.getAllLines()).toHaveLength(7); // 5 original - 1 removed + 3 added
            expect(buffer.getAllLines()[2].text).toBe('NEW LINE 1');
            expect(buffer.getAllLines()[3].text).toBe('NEW LINE 2');
            expect(buffer.getAllLines()[4].text).toBe('NEW LINE 3');
        });

        it('should replace lines with more new texts than IDs', () => {
            const newLines = BufferOps.replaceLines(buffer, [2, 4], ['NEW LINE 1', 'NEW LINE 2', 'NEW LINE 3']);
            
            expect(newLines).toHaveLength(3);
            expect(buffer.getAllLines()).toHaveLength(6); // 5 original - 2 removed + 3 added
            expect(buffer.getAllLines()[2].text).toBe('NEW LINE 1');
            expect(buffer.getAllLines()[4].text).toBe('NEW LINE 2');
            expect(buffer.getAllLines()[5].text).toBe('NEW LINE 3');
        });

        it('should replace lines with fewer new texts than IDs', () => {
            const newLines = BufferOps.replaceLines(buffer, [0, 1, 2], ['SINGLE REPLACEMENT']);
            
            expect(newLines).toHaveLength(1);
            expect(buffer.getAllLines()).toHaveLength(3); // 5 original - 3 removed + 1 added
            expect(buffer.getAllLines()[0].text).toBe('SINGLE REPLACEMENT');
            expect(buffer.getLineById(0)).toBeNull;
            expect(buffer.getLineById(1)).toBeNull;
            expect(buffer.getLineById(2)).toBeNull;
          
        });

        it('should return the correct lines when provided with fewer IDs then new texts', () => {
            const newLines = BufferOps.replaceLines(buffer, [0, 4], ['FIRST', 'SECOND', 'THIRD', 'FOURTH']);

            expect(newLines).toHaveLength(4);
            expect(newLines[0].text).toBe('FIRST');
            expect(newLines[1].text).toBe('SECOND');
            expect(newLines[2].text).toBe('THIRD');
            expect(newLines[3].text).toBe('FOURTH');
        });

        it('should return the correct lines when provided with same number of IDs and texts', () => {
            const newLines = BufferOps.replaceLines(buffer, [0, 2, 4], ['FIRST', 'SECOND', 'THIRD']);

            expect(newLines).toHaveLength(3);
            expect(newLines[0].text).toBe('FIRST');
            expect(newLines[1].text).toBe('SECOND');
            expect(newLines[2].text).toBe('THIRD');
        });

        it('should return the correct lines when provided with more IDs then new texts', () => {
            const newLines = BufferOps.replaceLines(buffer, [0, 1, 3, 4], ['FIRST', 'SECOND', 'THIRD']);

            expect(newLines).toHaveLength(3);
            expect(newLines[0].text).toBe('FIRST');
            expect(newLines[1].text).toBe('SECOND');
            expect(newLines[2].text).toBe('THIRD');
        });

        it('should throw error for empty IDs array', () => {
            expect(() => BufferOps.replaceLines(buffer, [], ['NEW TEXT']))
                .toThrowError();
        });

        it('should throw error for invalid IDs', () => {
            expect(() => BufferOps.replaceLines(buffer, [999], ['NEW TEXT']))
                .toThrowError();
        });

    });

});