import { describe, it, expect, beforeEach } from 'vitest';
import { 
    execBatchLineOps, 
    LineOpType, 
    AsmLineOp, 
    LineFactory,
    InsertOp,
    DeleteOp,
    EditOp,
    MoveOp,
    FailOp
} from '../asmLineOps';
import { AsmLine, LineId } from '../asmLine';

describe('execBatchLineOps', () => {
    let sampleLines: AsmLine[];
    let createLine: LineFactory;
    let nextId: number;

    beforeEach(() => {
        nextId = 100; // Start IDs at 100 to avoid conflicts with sample data
        
        createLine = (text: string, id?: LineId): AsmLine => {
            const trimmed = text.replace(/^[\n\r]+|[\n\r]+$/g, '');
            return {
                id: id ?? nextId++,
                text: trimmed,
                length: trimmed.length,
                isEmpty: trimmed.trim() === '',
                isComment: trimmed.trim().startsWith(';')
            };
        };

        sampleLines = [
            createLine('MOV A, B', 0),
            createLine('; Comment line', 1),
            createLine('ADD A, #10', 2),
            createLine('', 3),
            createLine('JMP START', 4),
        ];
    });

    describe('Basic Operations', () => {
        describe('INSERT operations', () => {
            it('should insert single line at beginning', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: 0, text: 'NEW START' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(6);
                expect(result[0].text).toBe('NEW START');
                expect(result[0].id).toBe(100);
                expect(result[1]).toBe(sampleLines[0]); // Original first line moved to index 1
            });

            it('should insert single line at end', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: 5, text: 'NEW END' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(6);
                expect(result[5].text).toBe('NEW END');
                expect(result[4]).toBe(sampleLines[4]); // Original last line unchanged
            });

            it('should insert single line in middle', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: 2, text: 'MIDDLE LINE' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(6);
                expect(result[2].text).toBe('MIDDLE LINE');
                expect(result[1]).toBe(sampleLines[1]);
                expect(result[3]).toBe(sampleLines[2]); // Original line at index 2 moved to index 3
            });

            it('should insert multiple lines at same index', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: 1, text: 'FIRST INSERT' },
                    { type: LineOpType.INSERT, index: 1, text: 'SECOND INSERT' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(7);
                expect(result[1].text).toBe('FIRST INSERT');
                expect(result[2].text).toBe('SECOND INSERT');
                expect(result[3]).toBe(sampleLines[1]); // Original line moved down
            });

            it('should insert multiple lines at different indices', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: 0, text: 'AT START' },
                    { type: LineOpType.INSERT, index: 3, text: 'AT MIDDLE' },
                    { type: LineOpType.INSERT, index: 5, text: 'AT END' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(8);
                expect(result[0].text).toBe('AT START');
                expect(result[4].text).toBe('AT MIDDLE'); // Adjusted for previous insert
                expect(result[7].text).toBe('AT END'); // Adjusted for previous inserts
            });
        });

        describe('DELETE operations', () => {
            it('should delete single line at beginning', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 0 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(4);
                expect(result[0]).toBe(sampleLines[1]); // Second line becomes first
            });

            it('should delete single line at end', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 4 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(4);
                expect(result[3]).toBe(sampleLines[3]); // Second-to-last becomes last
            });

            it('should delete single line in middle', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 2 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(4);
                expect(result[1]).toBe(sampleLines[1]);
                expect(result[2]).toBe(sampleLines[3]); // Line after deleted one moved up
            });

            it('should delete multiple non-consecutive lines', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 0 },
                    { type: LineOpType.DELETE, index: 2 },
                    { type: LineOpType.DELETE, index: 4 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(2);
                expect(result[0]).toBe(sampleLines[1]);
                expect(result[1]).toBe(sampleLines[3]);
            });

            it('should delete all lines', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 0 },
                    { type: LineOpType.DELETE, index: 1 },
                    { type: LineOpType.DELETE, index: 2 },
                    { type: LineOpType.DELETE, index: 3 },
                    { type: LineOpType.DELETE, index: 4 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(0);
            });
        });

        describe('EDIT operations', () => {
            it('should edit single line', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.EDIT, index: 1, newText: 'EDITED COMMENT' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(5);
                expect(result[1].text).toBe('EDITED COMMENT');
                expect(result[1].id).toBe(sampleLines[1].id); // ID should be preserved
                expect(result[0]).toBe(sampleLines[0]); // Other lines unchanged
                expect(result[2]).toBe(sampleLines[2]);
            });

            it('should edit multiple lines', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.EDIT, index: 0, newText: 'EDITED FIRST' },
                    { type: LineOpType.EDIT, index: 2, newText: 'EDITED THIRD' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(5);
                expect(result[0].text).toBe('EDITED FIRST');
                expect(result[0].id).toBe(sampleLines[0].id);
                expect(result[2].text).toBe('EDITED THIRD');
                expect(result[2].id).toBe(sampleLines[2].id);
                expect(result[1]).toBe(sampleLines[1]); // Unmodified line unchanged
            });

            it('should update line properties correctly', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.EDIT, index: 3, newText: '; Now a comment' }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result[3].text).toBe('; Now a comment');
                expect(result[3].isEmpty).toBe(false);
                expect(result[3].isComment).toBe(true);
                expect(result[3].length).toBe(15);
            });
        });

        describe('MOVE operations', () => {
            it('should move line forward', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 1, indexTo: 3 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(5);
                expect(result[0]).toBe(sampleLines[0]);
                expect(result[1]).toBe(sampleLines[2]); // Line 2 moved up
                expect(result[2]).toStrictEqual(sampleLines[1]); // Original line 1 at new position (preserves ID)
                expect(result[3]).toBe(sampleLines[3]); // Lines 3 and 4 not moved
                expect(result[4]).toBe(sampleLines[4]);
            });

            it('should move line backward', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 3, indexTo: 1 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(5);
                expect(result[0]).toBe(sampleLines[0]);
                expect(result[1]).toStrictEqual(sampleLines[3]); // Moved line at new position (recreated)
                expect(result[2]).toBe(sampleLines[1]); // Original lines shifted down
                expect(result[3]).toBe(sampleLines[2]);
                expect(result[4]).toBe(sampleLines[4]);
            });

            it('should move line to beginning', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 4, indexTo: 0 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(5);
                expect(result[0]).toStrictEqual(sampleLines[4]); // Last line moved to first (recreated)
                expect(result[1]).toBe(sampleLines[0]); // Others shifted down
            });

            it('should move line to end', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 0, indexTo: 5 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result).toHaveLength(5);
                expect(result[4]).toStrictEqual(sampleLines[0]); // First line moved to last (recreated)
                expect(result[0]).toBe(sampleLines[1]); // Others shifted up
            });

            it('should preserve line ID during move', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 2, indexTo: 0 }
                ];

                const result = execBatchLineOps(sampleLines, ops, createLine);

                expect(result[0].id).toBe(sampleLines[2].id);
                expect(result[0].text).toBe(sampleLines[2].text);
            });
        });
    });

    describe('Complex Operations', () => {
        it('should handle mixed operations in sequence', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.DELETE, index: 1 }, // Delete comment
                { type: LineOpType.EDIT, index: 2, newText: 'SUB A, #5' }, // Edit ADD line
                { type: LineOpType.INSERT, index: 0, text: 'START:' }, // Insert label at beginning
                { type: LineOpType.MOVE, indexFrom: 4, indexTo: 2 } // Move JMP up
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(5);
            expect(result[0].text).toBe('START:'); // Inserted line
            expect(result[1]).toBe(sampleLines[0]); // Original MOV
            expect(result[2]).toStrictEqual(sampleLines[4]); // Moved JMP (recreated)
            expect(result[3].text).toBe('SUB A, #5'); // Edited line
            expect(result[4]).toBe(sampleLines[3]); // Empty line
            // Comment line was deleted
        });

        it('should handle insert and move operations affecting same area', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: 2, text: 'INSERTED' },
                { type: LineOpType.MOVE, indexFrom: 3, indexTo: 1 }
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(6);
            // Insert at index 2 shifts existing lines
            // Move from index 1 to 3 refers to original positions
            expect(result[3].text).toBe('INSERTED'); // Moved from index 2 to 3 after inserts
            expect(result[1]).toStrictEqual(sampleLines[3]); // Original line 1 moved to 2
        });

        it('should handle multiple edits and deletes', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.EDIT, index: 0, newText: 'MOV B, A' },
                { type: LineOpType.EDIT, index: 2, newText: 'SUB A, #10' },
                { type: LineOpType.DELETE, index: 3 }, // Delete empty line
                { type: LineOpType.EDIT, index: 4, newText: 'JMP END' }
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(4);
            expect(result[0].text).toBe('MOV B, A');
            expect(result[1]).toBe(sampleLines[1]); // Unchanged comment
            expect(result[2].text).toBe('SUB A, #10');
            expect(result[3].text).toBe('JMP END'); // Edited line shifted up
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty operations array', () => {
            const result = execBatchLineOps(sampleLines, [], createLine);
            expect(result).toEqual([...sampleLines]);
        });

        it('should handle operations on empty buffer', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: 0, text: 'FIRST LINE' }
            ];

            const result = execBatchLineOps([], ops, createLine);

            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('FIRST LINE');
        });

        it('should handle inserting at maximum index', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: sampleLines.length, text: 'AT MAX INDEX' }
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(6);
            expect(result[5].text).toBe('AT MAX INDEX');
        });

        it('should preserve original array immutability', () => {
            const originalLength = sampleLines.length;
            const originalFirstLine = sampleLines[0];

            const ops: AsmLineOp[] = [
                { type: LineOpType.DELETE, index: 0 }
            ];

            execBatchLineOps(sampleLines, ops, createLine);

            expect(sampleLines).toHaveLength(originalLength);
            expect(sampleLines[0]).toBe(originalFirstLine);
        });

    });

    describe('Error Handling', () => {
        describe('Invalid indices', () => {
            it('should throw for invalid insert index (negative)', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: -1, text: 'INVALID' }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid insert index -1: buffer contains 5 lines');
            });

            it('should throw for invalid insert index (too large)', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.INSERT, index: 6, text: 'INVALID' }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid insert index 6: buffer contains 5 lines');
            });

            it('should throw for invalid delete index (negative)', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: -1 }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid delete index -1: buffer contains 5 lines');
            });

            it('should throw for invalid delete index (too large)', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 5 }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid delete index 5: buffer contains 5 lines');
            });

            it('should throw for invalid edit index', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.EDIT, index: 10, newText: 'INVALID' }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid edit index 10: buffer contains 5 lines');
            });

            it('should throw for invalid move source index', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: -1, indexTo: 2 }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid move source index -1: buffer contains 5 lines');
            });

            it('should throw for invalid move destination index', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 2, indexTo: 6 }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Invalid move destination index 6: buffer contains 5 lines');
            });
        });

        describe('Operation conflicts', () => {
            it('should throw when trying to delete already deleted line', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 1 },
                    { type: LineOpType.DELETE, index: 1 }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Cannot delete line at index 1: line was already deleted');
            });

            it('should throw when trying to edit already deleted line', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 2 },
                    { type: LineOpType.EDIT, index: 2, newText: 'INVALID EDIT' }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Cannot delete line at index 2: line was already deleted');
            });

            it('should throw when trying to move already deleted line', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.DELETE, index: 1 },
                    { type: LineOpType.MOVE, indexFrom: 1, indexTo: 3 }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Cannot move line from index 1: line was already deleted');
            });

            it('should not complain when the delete comes after the move', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.MOVE, indexFrom: 1, indexTo: 3 },
                    { type: LineOpType.DELETE, index: 1 },
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .not.toThrow('Cannot move line from index 1: line was already deleted');
            });

        });

        describe('FAIL operation', () => {
            it('should throw immediately on FAIL operation', () => {
                const ops: AsmLineOp[] = [
                    { type: LineOpType.EDIT, index: 0, newText: 'BEFORE FAIL' },
                    { type: LineOpType.FAIL, index: 0, message: 'Test failure' },
                    { type: LineOpType.EDIT, index: 1, newText: 'AFTER FAIL' }
                ];

                expect(() => execBatchLineOps(sampleLines, ops, createLine))
                    .toThrow('Operation batch failed due to explicit FAIL operation');
            });
        });
    });

    describe('Atomicity', () => {
        it('should not modify original array on success', () => {
            const originalLines = [...sampleLines];
            const ops: AsmLineOp[] = [
                { type: LineOpType.EDIT, index: 0, newText: 'MODIFIED' }
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(sampleLines).toEqual(originalLines);
            expect(result).not.toBe(sampleLines);
        });

        it('should not modify original array on failure', () => {
            const originalLines = [...sampleLines];
            const ops: AsmLineOp[] = [
                { type: LineOpType.EDIT, index: 0, newText: 'BEFORE ERROR' },
                { type: LineOpType.DELETE, index: 10 } // Invalid index
            ];

            expect(() => execBatchLineOps(sampleLines, ops, createLine)).toThrow();
            expect(sampleLines).toEqual(originalLines);
        });

        it('should fail completely on any error', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.EDIT, index: 0, newText: 'VALID EDIT' },
                { type: LineOpType.INSERT, index: 2, text: 'VALID INSERT' },
                { type: LineOpType.DELETE, index: 10 } // This will cause failure
            ];

            expect(() => execBatchLineOps(sampleLines, ops, createLine)).toThrow();

            // Verify no partial changes occurred by checking original is untouched
            expect(sampleLines[0].text).toBe('MOV A, B'); // Should not be "VALID EDIT"
        });
    });

    describe('Performance and Stress Tests', () => {
        it('should handle large number of operations efficiently', () => {
            const largeOps: AsmLineOp[] = [];
            
            // Create 1000 insert operations
            for (let i = 0; i < 1000; i++) {
                largeOps.push({
                    type: LineOpType.INSERT,
                    index: 0,
                    text: `LINE_${i}`
                });
            }

            const result = execBatchLineOps(sampleLines, largeOps, createLine);

            expect(result).toHaveLength(1005); // 5 original + 1000 inserts
            expect(result[0].text).toBe('LINE_0'); // First insert at index 0
            expect(result[999].text).toBe('LINE_999'); // Last insert at index 0
        });
        
        it('should handle operations on large buffer', () => {
            const largeBuffer: AsmLine[] = [];
            for (let i = 0; i < 10000; i++) {
                largeBuffer.push(createLine(`Line ${i}`));
            }
            
            const ops: AsmLineOp[] = [
                { type: LineOpType.DELETE, index: 0 },
                { type: LineOpType.EDIT, index: 1000, newText: 'EDITED' },
                { type: LineOpType.MOVE, indexFrom: 9000, indexTo: 5000 }
            ];
            
            const result = execBatchLineOps(largeBuffer, ops, createLine);
            
            expect(result).toHaveLength(9999); // One line deleted
            
            expect(result[999].text).toBe('EDITED'); // Edit at index 1000, moved to 999 after delete
            expect(result[4999].text).toBe('Line 9000'); // Moved line
        });

        it('should handle large number of operations on a larhe buffer efficiently', () => {
            const largeBuffer: AsmLine[] = [];
            for (let i = 0; i < 10000; i++) {
                largeBuffer.push(createLine(`Line ${i}`));
            }

            const largeOps: AsmLineOp[] = [];
            // Create 1000 deletions operations
            for (let i = 0; i < 10000; i++) {
                largeOps.push({
                    type: LineOpType.DELETE,
                    index: i,
                });
            }

            const result = execBatchLineOps(largeBuffer, largeOps, createLine);

            expect(result).toHaveLength(0);
        });
    });

    describe('Line Factory Integration', () => {
        it('should use custom line factory correctly', () => {
            const customFactory: LineFactory = (text: string, id?: LineId) => ({
                id: id ?? 999,
                text: `CUSTOM: ${text}`,
                length: text.length + 8,
                isEmpty: false,
                isComment: text.startsWith('COMMENT')
            });

            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: 0, text: 'TEST' }
            ];

            const result = execBatchLineOps(sampleLines, ops, customFactory);

            expect(result[0].text).toBe('CUSTOM: TEST');
            expect(result[0].length).toBe(12); // 'TEST'.length + 8
            expect(result[0].id).toBe(999);
        });

        it('should preserve IDs when provided to factory', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.EDIT, index: 1, newText: 'EDITED TEXT' }
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result[1].id).toBe(sampleLines[1].id); // ID preserved from original
            expect(result[1].text).toBe('EDITED TEXT');
        });

        it('should handle factory that throws errors', () => {
            const throwingFactory: LineFactory = (text: string) => {
                if (text === 'ERROR') {
                    throw new Error('Factory error');
                }
                return createLine(text);
            };

            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: 0, text: 'ERROR' }
            ];

            expect(() => execBatchLineOps(sampleLines, ops, throwingFactory))
                .toThrow('Factory error');
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle realistic code refactoring scenario', () => {
            // Simulate refactoring: remove comments, add new instructions, reorder
            const ops: AsmLineOp[] = [
                { type: LineOpType.DELETE, index: 1 }, // Remove comment
                { type: LineOpType.INSERT, index: 0, text: 'PUSH A' }, // Save register
                { type: LineOpType.EDIT, index: 2, newText: 'ADD A, B' }, // Change operation
                { type: LineOpType.INSERT, index: 4, text: 'POP A' }, // Restore register
                { type: LineOpType.MOVE, indexFrom: 3, indexTo: 1 } // Reorder empty line
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(6);
            expect(result[0].text).toBe('PUSH A');
            expect(result[1]).toBe(sampleLines[0]); // Original MOV moved forward by insert
            expect(result[2]).toStrictEqual(sampleLines[3]); // Moved empty line (recreated)
            expect(result[3].text).toBe('ADD A, B'); // Edited line (preserved ID)
            expect(result[4].text).toBe('POP A');
            expect(result[5]).toBe(sampleLines[4]); // Original JMP
        });

        it('should handle batch replace', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.DELETE, index: 1 }, // Remove line 2
                { type: LineOpType.DELETE, index: 2 }, // Remove line 3
                { type: LineOpType.DELETE, index: 3 }, // Remove line 4
                { type: LineOpType.INSERT, index: 1, text: '; block start' }, // Insert comment
                { type: LineOpType.INSERT, index: 1, text: 'POP A' }, // Save register
                { type: LineOpType.INSERT, index: 1, text: 'ADD A, B' }, // Change operation
                { type: LineOpType.INSERT, index: 1, text: 'PUSH A' }, // Restore register
                { type: LineOpType.INSERT, index: 1, text: '; block end' }, // Insert comment
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(7);
            expect(result[1].text).toBe('; block start');
            expect(result[2].text).toBe('POP A');
            expect(result[3].text).toBe('ADD A, B');
            expect(result[4].text).toBe('PUSH A');
            expect(result[5].text).toBe('; block end');
            expect(result[6]).toBe(sampleLines[4]); // Original JMP at index 4 pushed down
        });

        it('should handle code generation scenario', () => {
            // Generate loop structure
            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: 0, text: 'LOOP_START:' },
                { type: LineOpType.INSERT, index: 5, text: 'DEC B' },
                { type: LineOpType.INSERT, index: 5, text: 'JNZ LOOP_START' },
                { type: LineOpType.EDIT, index: 4, newText: 'JMP END' } // Change final jump
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result).toHaveLength(8);
            expect(result[0].text).toBe('LOOP_START:');
            expect(result[5].text).toBe('JMP END'); // Edited line at original index 4
            expect(result[6].text).toBe('DEC B');
            expect(result[7].text).toBe('JNZ LOOP_START');
        });

        it('should handle mixed insert and move correctly', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.INSERT, index: 0, text: 'FIRST INSERT @0' },
                { type: LineOpType.INSERT, index: 4, text: 'INSERT @4' },
                { type: LineOpType.MOVE, indexFrom: 4, indexTo: 0 },
                { type: LineOpType.INSERT, index: 0, text: 'SECOND INSERT @0' },
                { type: LineOpType.EDIT, index: 4, newText: 'MOVE @0' } // Change moved line
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result[0].text).toBe('FIRST INSERT @0');
            expect(result[1].text).toBe('MOVE @0');
            expect(result[2].text).toBe('SECOND INSERT @0');
            expect(result[7].text).toBe('INSERT @4');
            
        });

        
        it('should handle line swapping', () => {
            const ops: AsmLineOp[] = [
                { type: LineOpType.MOVE, indexFrom: 0, indexTo: 1 },
                { type: LineOpType.MOVE, indexFrom: 1, indexTo: 0 },
                // Swap in reverse order
                { type: LineOpType.MOVE, indexFrom: 3, indexTo: 2 },
                { type: LineOpType.MOVE, indexFrom: 2, indexTo: 3 },
            ];

            const result = execBatchLineOps(sampleLines, ops, createLine);

            expect(result[0]).toStrictEqual(sampleLines[1]);
            expect(result[1]).toStrictEqual(sampleLines[0]);
            expect(result[2]).toStrictEqual(sampleLines[3]);
            expect(result[3]).toStrictEqual(sampleLines[2]);
        });
    });
});