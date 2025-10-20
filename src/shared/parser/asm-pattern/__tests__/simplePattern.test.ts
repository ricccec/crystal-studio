import { describe, it, expect } from 'vitest';
import { compareSimplePatterns, parseSimplePattern } from '../simplePattern';

function comparePatterns(p1: string, p2: string): any {
    return compareSimplePatterns(
        {
            pattern: p1,
            placeholderNames: [],
            hasUnnamedPlaceholders: false
        },
        {
            pattern: p2,
            placeholderNames: [],
            hasUnnamedPlaceholders: false
        },
    )
}

describe('compareSimplePatterns', () => {
    describe('exact matches', () => {
        it('should match identical patterns', () => {
            expect(comparePatterns('ld a, b', 'ld a, b')).toBe(true);
        });

        it('should match empty patterns', () => {
            expect(comparePatterns('', '')).toBe(true);
        });

        it('should not match different literals', () => {
            expect(comparePatterns('ld a', 'ld b')).toBe(false);
        });
    });

    describe('placeholder matching literals', () => {
        it('should match single character placeholder to literal', () => {
            expect(comparePatterns('ld {reg}', 'ld a')).toBe(true);
        });

        it('should match multi-character placeholder to literals', () => {
            expect(comparePatterns('ld {reg}', 'ld abc')).toBe(true);
        });

        it('should match placeholder at start', () => {
            expect(comparePatterns('{op} a', 'mov a')).toBe(true);
        });

        it('should match placeholder at end', () => {
            expect(comparePatterns('ld {reg}', 'ld xyz')).toBe(true);
        });

        it('should match placeholder with underscore literal', () => {
            expect(comparePatterns('ld {reg}', 'ld a_b')).toBe(true);
        });

        it('should match placeholder with number literal', () => {
            expect(comparePatterns('ld {reg}', 'ld r1')).toBe(true);
        });
    });

    describe('both patterns have placeholders', () => {
        it('should match when both have placeholders at same position', () => {
            expect(comparePatterns('ld {reg}', 'ld {val}')).toBe(true);
        });

        it('should match multiple placeholders', () => {
            expect(comparePatterns('ld {a}, {b}', 'ld {x}, {y}')).toBe(true);
        });

        it('should match placeholders with different names', () => {
            expect(comparePatterns('{op1} {reg1}', '{op2} {reg2}')).toBe(true);
        });
    });

    describe('placeholder boundaries', () => {
        it('should respect character after placeholder', () => {
            expect(comparePatterns('ld {reg}, a', 'ld bc, b')).toBe(false);
        });

        it('should match when placeholder consumes correct characters', () => {
            expect(comparePatterns('ld {reg}, a', 'ld bc, a')).toBe(true);
        });

        it('should match placeholder followed by comma', () => {
            expect(comparePatterns('ld {reg}, b', 'ld a, b')).toBe(true);
        });

        it('should stop placeholder at space', () => {
            expect(comparePatterns('ld {reg} a', 'ld bc a')).toBe(true);
        });

        it('should handle placeholder followed by special char', () => {
            expect(comparePatterns('ld {reg}[', 'ld a[')).toBe(true);
        });
    });

    describe('invalid matches', () => {
        it('should not match when non-placeholder-class character found', () => {
            expect(comparePatterns('ld {reg}', 'ld [a]')).toBe(false);
        });

        it('should not match placeholder to special characters', () => {
            expect(comparePatterns('{op}', '+')).toBe(false);
        });

        it('should not match different literals', () => {
            expect(comparePatterns('ld a', 'ld b')).toBe(false);
        });

        it('should not match different lengths', () => {
            expect(comparePatterns('ld {reg}', 'ld')).toBe(false);
        });

        it('should not match when pattern1 is longer', () => {
            expect(comparePatterns('ld a, b', 'ld a')).toBe(false);
        });

        it('should not match when pattern2 is longer', () => {
            expect(comparePatterns('ld a', 'ld a, b')).toBe(false);
        });

        it('should not match placeholder to comma', () => {
            expect(comparePatterns('ld {reg}', 'ld ,')).toBe(false);
        });

        it('should not match placeholder to space', () => {
            expect(comparePatterns('ld {reg}', 'ld  ')).toBe(false);
        });
    });

    describe('consecutive placeholders', () => {
        it('should handle consecutive placeholders', () => {
            expect(comparePatterns('ld {a} {b}', 'ld {x} {y}')).toBe(true);
        });

        it('should match consecutive placeholders to literals', () => {
            expect(comparePatterns('{a} {b}', 'ab c')).toBe(true);
        });

        it('should handle multiple consecutive placeholders', () => {
            expect(comparePatterns('{a} {b} {c}', 'a b {}')).toBe(true);
        });

    });

    describe('empty placeholders', () => {
        it('should match empty placeholder to valid characters', () => {
            expect(comparePatterns('ld {}', 'ld abc')).toBe(true);
        });

        it('should not match empty placeholder to invalid characters', () => {
            expect(comparePatterns('ld {}', 'ld [a]')).toBe(false);
        });

        it('should match two empty placeholders', () => {
            expect(comparePatterns('ld {}', 'ld {reg}')).toBe(true);
        });
    });

    describe('mixed scenarios', () => {
        it('should match complex pattern with multiple placeholders', () => {
            expect(comparePatterns('ld {r1}, {r2}', 'ld a, b')).toBe(true);
        });

        it('should match pattern with placeholder in middle', () => {
            expect(comparePatterns('ld {reg}, bc', 'ld a, bc')).toBe(true);
        });

        it('should not match when middle differs', () => {
            expect(comparePatterns('ld {reg}, bc', 'ld a, bd')).toBe(false);
        });

        it('should match symmetric patterns', () => {
            expect(comparePatterns('ld a, {reg}', 'ld {}, b')).toBe(true);
        });

        it('should handle pattern with escaped brackets', () => {
            expect(comparePatterns('ld \\[{reg}\\]', 'ld \\[a\\]')).toBe(true);
        });
    });

    describe('spaces and tabs', () => {
        it('should ignore leading spaces', () => {
            expect(comparePatterns('ld reg', '  ld reg')).toBe(true);
        });

        it('should ignore leading tabs', () => {
            expect(comparePatterns('ld reg', '\tld reg')).toBe(true);
        });

        
        it('should ignore trailing spaces', () => {
            expect(comparePatterns('ld reg', 'ld reg  ')).toBe(true);
        });

        it('should ignore trailing tabs', () => {
            expect(comparePatterns('ld reg', 'ld reg\t')).toBe(true);
        });

        it('should ignore multiple spaces and tabs inside patterns', () => {
            expect(comparePatterns('ld\treg a  b', 'ld reg   a\t b')).toBe(true);
        });

    });

    describe('malformed patterns', () => {
        it('should throw error for malformed placeholder in both patterns', () => {
            expect(() => comparePatterns('ld {reg', 'ld {reg')).toThrowError();
        });
    
        it('should throw error for malformed vs well-formed', () => {
            expect(() => comparePatterns('ld {reg', 'ld {reg}')).toThrowError();
        });
    
        it('should throw error for well-formed vs  malformed', () => {
            expect(() => comparePatterns('ld {reg}', 'ld {reg')).toThrowError();
        });

        it('should throw error for consecutive placeholders in first pattern', () => {
            expect(() => comparePatterns('ld {reg}_{test}', 'ld {reg}_a')).toThrowError();
        });

        
        it('should throw error for consecutive placeholders in second pattern', () => {
            expect(() => comparePatterns('ld {reg}_a', 'ld {reg}_{test}')).toThrowError();
        });
    
    });

    describe('edge cases', () => {

        it('should handle placeholder at very end', () => {
            expect(comparePatterns('ld {reg}', 'ld abc')).toBe(true);
        });

        it('should handle placeholder with no following char', () => {
            expect(comparePatterns('{op}', 'mov')).toBe(true);
        });
    });

    describe('placeholders within literals', () => {
        it.each([
            // [pattern1, pattern2, expected]
            ['a{}', 'abcd', true],
            ['a{}_def', 'a_def', false],
            ['a{}_def', 'ab_def', true],
            ['a{}_def', 'ab_deft', false],
            ['a{}_def', 'ab_def_def', true],
            ['a{}_def t', 'ab_def_def t', true],
            ['a{}d', 'abc', false],
            ['a{}c', 'ab@c', false],
            ['{}@', 'ptrn1@', true],
            ['{}ptrn1@', 'ptrn2ptrn1@', true],
            ['{}ptrn1@', 'ptrn1@', false],
            ['{}ptrn1@', '{}ptrn1@', true],
            ['{}ptrn1@', 'ptrn2{}@', true],
            ['{}ptrn1@', 'ptrn2{}ptrn1@', true],
            ['ptrn2ptrn1@', '{}ptrn1@', true],
            ['ptrn1@', '{}ptrn1@', false],
            ['{}ptrn1@', '{}ptrn1@', true],
            ['ptrn2{}@', '{}ptrn1@', true],
            ['ptrn2{}ptrn1@', '{}ptrn1@', true],
        ])('%s vs %s => %s', (pattern1, pattern2, expected) => {
            expect(comparePatterns(pattern1, pattern2)).toBe(expected);
        });
    });
});

describe('parseSimplePattern', () => {
    describe('valid patterns', () => {
        it('should parse simple literal pattern', () => {
            const result = parseSimplePattern('ld a, b');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld a, b');
                expect(result.simplePattern.placeholderNames).toEqual([]);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse pattern with single placeholder', () => {
            const result = parseSimplePattern('ld {reg}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld {reg}');
                expect(result.simplePattern.placeholderNames).toEqual(['reg']);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse pattern with multiple placeholders', () => {
            const result = parseSimplePattern('ld {reg1}, {reg2}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld {reg1}, {reg2}');
                expect(result.simplePattern.placeholderNames).toEqual(['reg1', 'reg2']);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse pattern with unnamed placeholder', () => {
            const result = parseSimplePattern('ld {}, a');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld {}, a');
                expect(result.simplePattern.placeholderNames).toEqual([]);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(true);
            }
        });

        it('should parse pattern with mixed named and unnamed placeholders', () => {
            const result = parseSimplePattern('ld {reg}, {}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld {reg}, {}');
                expect(result.simplePattern.placeholderNames).toEqual(['reg']);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(true);
            }
        });

        it('should parse pattern with escaped brackets', () => {
            const result = parseSimplePattern('ld \\[{reg}\\], a');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld \\[{reg}\\], a');
                expect(result.simplePattern.placeholderNames).toEqual(['reg']);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse pattern with escaped pipe', () => {
            const result = parseSimplePattern('ld a\\|b');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('ld a\\|b');
                expect(result.simplePattern.placeholderNames).toEqual([]);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse empty pattern', () => {
            const result = parseSimplePattern('');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.pattern).toBe('');
                expect(result.simplePattern.placeholderNames).toEqual([]);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse pattern with placeholders separated by non-alphanumeric', () => {
            const result = parseSimplePattern('{reg1}, {reg2}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual(['reg1', 'reg2']);
            }
        });

        it('should parse pattern with multiple unnamed placeholders', () => {
            const result = parseSimplePattern('ld {}, {}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual([]);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(true);
            }
        });

        it('should parse pattern with placeholders inside litterals', () => {
            const result = parseSimplePattern('ld temp_{var_1}2');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual(['var_1']);
            }
        });
    });

    describe('invalid patterns - branching', () => {
        it('should reject pattern with unescaped pipe', () => {
            const result = parseSimplePattern('ld a|b');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Branching not allowed');
            }
        });

        it('should reject pattern with unescaped opening bracket', () => {
            const result = parseSimplePattern('ld [hl]');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Branching not allowed');
            }
        });

        it('should reject pattern with unescaped closing bracket', () => {
            const result = parseSimplePattern('ld hl]');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Branching not allowed');
            }
        });

        it('should reject pattern with multiple unescaped special chars', () => {
            const result = parseSimplePattern('[a|b]');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Branching not allowed');
            }
        });
    });

    describe('invalid patterns - consecutive placeholders', () => {
        it('should reject consecutive placeholders with no separator', () => {
            const result = parseSimplePattern('{a}{b}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Consecutive placeholders');
            }
        });

        it('should reject consecutive placeholders separated by alphanumeric', () => {
            const result = parseSimplePattern('{a}b{c}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Consecutive placeholders');
            }
        });

        it('should reject consecutive placeholders separated by underscore', () => {
            const result = parseSimplePattern('{a}_{b}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Consecutive placeholders');
            }
        });

        it('should reject multiple consecutive placeholders', () => {
            const result = parseSimplePattern('{a}{b}{c}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Consecutive placeholders');
            }
        });

        it('should reject consecutive empty placeholders', () => {
            const result = parseSimplePattern('{}{}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Consecutive placeholders');
            }
        });
    });

    describe('invalid patterns - duplicate placeholders', () => {
        it('should reject duplicate named placeholders', () => {
            const result = parseSimplePattern('ld {reg}, {reg}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Duplicate placeholders');
            }
        });

        it('should reject duplicate placeholders with whitespace differences', () => {
            const result = parseSimplePattern('ld {reg}, { reg }');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Duplicate placeholders');
            }
        });

        it('should reject multiple duplicate placeholders', () => {
            const result = parseSimplePattern('ld {a}, {b}, {a}, {b}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('Duplicate placeholders');
            }
        });
    });

    describe('edge cases', () => {
        it('should parse pattern with only placeholder', () => {
            const result = parseSimplePattern('{reg}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual(['reg']);
            }
        });

        it('should parse pattern with only unnamed placeholder', () => {
            const result = parseSimplePattern('{}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(true);
            }
        });

        it('should parse complex valid pattern', () => {
            const result = parseSimplePattern('ldi {reg1}, \\[hl+{offset}\\]');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual(['reg1', 'offset']);
                expect(result.simplePattern.hasUnnamedPlaceholders).toBe(false);
            }
        });

        it('should parse pattern with placeholder containing numbers', () => {
            const result = parseSimplePattern('ld {reg_1}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual(['reg_1']);
            }
        });

        it('should handle whitespace in pattern', () => {
            const result = parseSimplePattern('ld   {reg},   {val}');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.simplePattern.placeholderNames).toEqual(['reg', 'val']);
            }
        });
    });
});
