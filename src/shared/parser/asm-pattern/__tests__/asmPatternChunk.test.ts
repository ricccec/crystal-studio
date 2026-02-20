import { describe, it, expect } from 'vitest';
import { checkChunkOverlap, splitToChunks } from '../asmPatternChunk';

describe('splitToChunks', () => {
    describe('basic delimiter-based splitting', () => {
        it('should return empty array for empty pattern', () => {
            const chunks = splitToChunks('');
            expect(chunks).toEqual([]);
        });

        it('should create single chunk for only placeholder-class chars', () => {
            const chunks = splitToChunks('abc123');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('abc123');
            expect(chunks[0].hasPlaceholder).toBe(false);
            expect(chunks[0].isSeparator).toBe(false);
        });

        it('should create single chunk for only separators', () => {
            const chunks = splitToChunks(', ');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe(', ');
            expect(chunks[0].isSeparator).toBe(true);
        });

        it('should split on flip from placeholder-class to delimiter', () => {
            const chunks = splitToChunks('ld a');
            expect(chunks).toHaveLength(3);
            expect(chunks[0].text).toBe('ld');
            expect(chunks[0].isSeparator).toBe(false);
            expect(chunks[1].text).toBe(' ');
            expect(chunks[1].isSeparator).toBe(true);
            expect(chunks[2].text).toBe('a');
            expect(chunks[2].isSeparator).toBe(false);
        });

        it('should split on multiple flips', () => {
            const chunks = splitToChunks('ld a, b');
            expect(chunks).toHaveLength(5);
            expect(chunks[0].text).toBe('ld');
            expect(chunks[1].text).toBe(' ');
            expect(chunks[2].text).toBe('a');
            expect(chunks[3].text).toBe(', ');
            expect(chunks[4].text).toBe('b');
        });

        it('should handle consecutive separators', () => {
            const chunks = splitToChunks('a,, b');
            expect(chunks).toHaveLength(3);
            expect(chunks[0].text).toBe('a');
            expect(chunks[1].text).toBe(',, ');
            expect(chunks[2].text).toBe('b');
        });

        it('should handle leading separators', () => {
            const chunks = splitToChunks(' abc');
            expect(chunks).toHaveLength(2);
            expect(chunks[0].text).toBe(' ');
            expect(chunks[0].isSeparator).toBe(true);
            expect(chunks[1].text).toBe('abc');
        });

        it('should handle trailing separators', () => {
            const chunks = splitToChunks('abc ');
            expect(chunks).toHaveLength(2);
            expect(chunks[0].text).toBe('abc');
            expect(chunks[1].text).toBe(' ');
            expect(chunks[1].isSeparator).toBe(true);
        });
    });

    describe('placeholder handling', () => {
        it('should handle placeholder with no prefix or suffix', () => {
            const chunks = splitToChunks('{reg}');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('{reg}');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].hasPrefix).toBe(false);
            expect(chunks[0].hasSuffix).toBe(false);
            expect(chunks[0].prefix).toBe('');
            expect(chunks[0].suffix).toBe('');
        });

        it('should handle empty placeholder', () => {
            const chunks = splitToChunks('{}');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('{}');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].hasPrefix).toBe(false);
            expect(chunks[0].hasSuffix).toBe(false);
        });

        it('should handle placeholder with whitespace in name', () => {
            const chunks = splitToChunks('{ reg }');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('{ reg }');
            expect(chunks[0].hasPlaceholder).toBe(true);
        });

        it('should handle placeholder followed by separator', () => {
            const chunks = splitToChunks('{reg}, ');
            expect(chunks).toHaveLength(2);
            expect(chunks[0].text).toBe('{reg}');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[1].text).toBe(', ');
            expect(chunks[1].isSeparator).toBe(true);
        });

        it('should handle separator followed by placeholder', () => {
            const chunks = splitToChunks(', {reg}');
            expect(chunks).toHaveLength(2);
            expect(chunks[0].text).toBe(', ');
            expect(chunks[0].isSeparator).toBe(true);
            expect(chunks[1].text).toBe('{reg}');
            expect(chunks[1].hasPlaceholder).toBe(true);
        });

        it('should handle placeholder with prefix', () => {
            const chunks = splitToChunks('r{num}');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('r{num}');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].hasPrefix).toBe(true);
            expect(chunks[0].prefix).toBe('r');
            expect(chunks[0].suffix).toBe('');
        });

        it('should handle placeholder with suffix', () => {
            const chunks = splitToChunks('{reg}x');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('{reg}x');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].hasPrefix).toBe(false);
            expect(chunks[0].hasSuffix).toBe(true);
            expect(chunks[0].prefix).toBe('');
            expect(chunks[0].suffix).toBe('x');
        });

        it('should handle placeholder with both prefix and suffix', () => {
            const chunks = splitToChunks('r{num}x');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('r{num}x');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].hasPrefix).toBe(true);
            expect(chunks[0].hasSuffix).toBe(true);
            expect(chunks[0].prefix).toBe('r');
            expect(chunks[0].suffix).toBe('x');
        });

        it('should handle multiple placeholders separated by delimiters', () => {
            const chunks = splitToChunks('{a}, {b}');
            expect(chunks).toHaveLength(3);
            expect(chunks[0].text).toBe('{a}');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[1].text).toBe(', ');
            expect(chunks[1].isSeparator).toBe(true);
            expect(chunks[2].text).toBe('{b}');
            expect(chunks[2].hasPlaceholder).toBe(true);
        });

        it('should handle placeholder with long prefix', () => {
            const chunks = splitToChunks('prefix{val}');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('prefix{val}');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].prefix).toBe('prefix');
        });

        it('should handle placeholder with long suffix', () => {
            const chunks = splitToChunks('{val}suffix');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('{val}suffix');
            expect(chunks[0].hasPlaceholder).toBe(true);
            expect(chunks[0].suffix).toBe('suffix');
        });
    });

    describe('mixed content', () => {
        it('should handle pattern with placeholder-class chars, delimiters, and placeholders', () => {
            const chunks = splitToChunks('ld {reg}, val');
            expect(chunks).toHaveLength(5);
            expect(chunks[0].text).toBe('ld');
            expect(chunks[1].text).toBe(' ');
            expect(chunks[2].text).toBe('{reg}');
            expect(chunks[2].hasPlaceholder).toBe(true);
            expect(chunks[3].text).toBe(', ');
            expect(chunks[4].text).toBe('val');
        });

        it('should handle instruction mnemonic with placeholders', () => {
            const chunks = splitToChunks('mov {dst}, {src}');
            expect(chunks).toHaveLength(5);
            expect(chunks[0].text).toBe('mov');
            expect(chunks[1].text).toBe(' ');
            expect(chunks[2].text).toBe('{dst}');
            expect(chunks[3].text).toBe(', ');
            expect(chunks[4].text).toBe('{src}');
        });

        it('should handle special characters as separators', () => {
            const chunks = splitToChunks('ld [{reg}]');
            expect(chunks).toHaveLength(4);
            expect(chunks[0].text).toBe('ld');
            expect(chunks[1].text).toBe(' [');
            expect(chunks[2].text).toBe('{reg}');
            expect(chunks[3].text).toBe(']');
        });

        it('should handle underscore as placeholder-class char', () => {
            const chunks = splitToChunks('r_1 {val}');
            expect(chunks).toHaveLength(3);
            expect(chunks[0].text).toBe('r_1');
            expect(chunks[0].isSeparator).toBe(false);
            expect(chunks[1].text).toBe(' ');
            expect(chunks[2].text).toBe('{val}');
        });

        it('should handle numbers as placeholder-class chars', () => {
            const chunks = splitToChunks('123 {val}');
            expect(chunks).toHaveLength(3);
            expect(chunks[0].text).toBe('123');
            expect(chunks[0].isSeparator).toBe(false);
            expect(chunks[1].text).toBe(' ');
            expect(chunks[2].text).toBe('{val}');
        });
    });

    describe('edge cases and validation', () => {
        it('should throw on unmatched opening brace', () => {
            expect(() => splitToChunks('ld {reg')).toThrow('Unmatched opening bracket');
        });

        it('should throw on unmatched closing brace in chunk', () => {
            expect(() => splitToChunks('ld }')).toThrow('Unmatched closing bracket');
        });

        it('should handle single character patterns', () => {
            const chunks = splitToChunks('a');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('a');
        });

        it('should handle single separator character', () => {
            const chunks = splitToChunks(' ');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe(' ');
            expect(chunks[0].isSeparator).toBe(true);
        });

        it('should throw on consecutive placeholders in same chunk', () => {
            // This should be caught by createChunk validation
            expect(() => splitToChunks('{a}{b}')).toThrow('Consecutive placeholders');
        });

        it('should handle escaped backslash', () => {
            const chunks = splitToChunks('\\{reg}\\');
            expect(chunks[0].text).toBe('\\');
            expect(chunks[1].text).toBe('{reg}');
            expect(chunks[2].text).toBe('\\');
        });
    });

    describe('complex real-world patterns', () => {
        it('should handle load instruction pattern', () => {
            const chunks = splitToChunks('ld {reg}, [{addr}]');
            expect(chunks.length).toBeGreaterThan(0);
            const placeholderChunks = chunks.filter(c => c.hasPlaceholder);
            expect(placeholderChunks).toHaveLength(2);
        });

        it('should handle arithmetic instruction pattern', () => {
            const chunks = splitToChunks('add {dst}, {src1}, {src2}');
            expect(chunks.length).toBeGreaterThan(0);
            const placeholderChunks = chunks.filter(c => c.hasPlaceholder);
            expect(placeholderChunks).toHaveLength(3);
        });


        it('should handle pattern with register numbering', () => {
            const chunks = splitToChunks('r{num} {val}');
            expect(chunks.length).toBeGreaterThan(0);
            const firstChunk = chunks[0];
            expect(firstChunk.text).toContain('r{num}');
            expect(firstChunk.hasPlaceholder).toBe(true);
            expect(firstChunk.prefix).toBe('r');
        });
    });

    describe('chunk properties', () => {

        it('should correctly identify non-separator chunks without placeholders', () => {
            const chunks = splitToChunks('abc def');
            const contentChunks = chunks.filter(c => !c.isSeparator && !c.hasPlaceholder);
            expect(contentChunks).toHaveLength(2);
            expect(contentChunks[0].text).toBe('abc');
            expect(contentChunks[1].text).toBe('def');
        });

        it('should correctly set prefix and suffix for placeholder chunks', () => {
            const chunks = splitToChunks('pre{val}suf');
            expect(chunks).toHaveLength(1);
            expect(chunks[0].hasPrefix).toBe(true);
            expect(chunks[0].hasSuffix).toBe(true);
            expect(chunks[0].prefix).toBe('pre');
            expect(chunks[0].suffix).toBe('suf');
        });

        it('should handle chunk with only prefix', () => {
            const chunks = splitToChunks('pre{val} ');
            const placeholderChunk = chunks.find(c => c.hasPlaceholder);
            expect(placeholderChunk?.hasPrefix).toBe(true);
            expect(placeholderChunk?.hasSuffix).toBe(false);
        });

        it('should handle chunk with only suffix', () => {
            const chunks = splitToChunks(' {val}suf');
            const placeholderChunk = chunks.find(c => c.hasPlaceholder);
            expect(placeholderChunk?.hasPrefix).toBe(false);
            expect(placeholderChunk?.hasSuffix).toBe(true);
        });
    });

    describe('splitToChunks - various scenarios', () => {
        it.each([
            // [inputPattern,       expectedChunks]
            ['ld {reg}, val', ['ld', ' ', '{reg}', ', ', 'val']],
            ['r{num}x', ['r{num}x']],
            ['', []],
            ['abc123', ['abc123']],    // Only placeholder-class chars
            [', ', [', ']],        // Only separators
        ])('should split "%s" correctly', (inputPattern, expectedChunks) => {
            const result = splitToChunks(inputPattern);
            expect(result.map(r => r.text)).toEqual(expectedChunks);
        });
    });
});

describe('compareChunks', () => {
	describe('various scenarios (simple)', () => {
		it.each([
			// [chunkA,		chunkB,				expected]
			['+@',          '+@',               true],      // Both separators
			['+@',          '  +@',             true],      // Both separators (ignore tabs)
			['+@',          ' +@',              true],      // Both separators (ignore leading spaces)
			['+ @',         '+   @',            true],      // Both separators (ignore multiple spaces)
			['@+!',         '@+',               false],     // Both separators
			['abc',         'abc',              true],      // Both litterals
			['abc',         'abd',              false],     // Both litterals
			['abc',         'dbc',              false],     // Both litterals
			['abc',         'atc',              false],     // Both litterals
			['abc',         '+@',                false],     // One litteral vs one separator
			['+@',           'abc',              false],     // One litteral vs one separator
			['{}',          '+@',                false],      // placeholder+litteral vs separator
			['a{}',         '+@',                false],      // placeholder+litteral vs separator
			['{}b',         '+@',                false],      // placeholder+litteral vs separator
			['a{}b',        '+@',                false],      // placeholder+litteral vs separator
			// Just placeholder
			['{}',	        'ab',                true],
			['{}',        	'{}',                true],
			// Placeholder w/ prefix
			['a{}',	        'a',                false],
			['a{}',	        'b',                false],
			['a{}',	        'ab',                true],
			['a{}',	        'ba',                false],
			// Placeholder w/ prefix
			['{}b',	        'b',                false],
			['{}b',	        'a',                false],
			['{}b',	        'ab',                true],
			['{}b',	        'ba',                false],
			// Placeholder w/ prefix and suffix
			['a{}b',	     'ab',                false],
			['a{}b',	        'ba',                false],
			['a{}b',	        'b_a',                false],
			['a{}b',	        'a_b',                true],
			['a{}b',	        'b_a',                false],
			['a{}b',	        'a_c',                false],
			['a{}b',	        'c_a',                false],
			// Placeholder w/ prefix vs placeholder
			['a{}',	     	'{}',                	true],
			['a{}',	        'a{}',                	true],
			['a{}',	        'b{}',                	false],
			['a{}',	        '{}a',                	true],
			['a{}',	        '{}b',                	true],
			['a{}',	        'a{}b',                	true],
			['a{}',	        'c{}b',                	false],
			['a{}',	        'a{}c',                	true],
			// Placeholder w/ suffix vs placeholder
			['{}b',	     	'{}',                	true],
			['{}b',	        'a{}',                	true],
			['{}b',	        'b{}',                	true],
			['{}b',	        '{}a',                	false],
			['{}b',	        '{}b',                	true],
			['{}b',	        'a{}b',                	true],
			['{}b',	        'c{}b',                	true],
			['{}b',	        'a{}c',                	false],
			// Placeholder w/ suffix vs placeholder
			['a{}b',	     	'{}',                	true],
			['a{}b',	        'a{}',                	true],
			['a{}b',	        'b{}',                	false],
			['a{}b',	        '{}a',                	false],
			['a{}b',	        '{}b',                	true],
			['a{}b',	        'a{}b',                	true],
			['a{}b',	        'c{}b',                	false],
			['a{}b',	        'a{}c',                	false],
			['a{}b',	        'c{}c',                	false],
	
		])('should compare "%s" and "%s" correctly', (chunkA, chunkB, expected) => {
			const a = splitToChunks(chunkA);
			const b = splitToChunks(chunkB);
			
			// Ensure we are dealing w/ single chunk strings
			expect(a.length).toBe(1);
			expect(b.length).toBe(1);
	
			expect(checkChunkOverlap(a[0], b[0])).toBe(expected);
		});
	});
	
	
	describe('various scenarios (complex)', () => {
		it.each([
			// [chunkA,		chunkB,			expected]
			['abc{}de',		'abcadede',		true],
			['ab{}',		'{}b',			true],
			['a{}',			'ab',			true],
			['a{}a',		'aa',			false],
			['ab{}b',		'a{}b',			true],
			['{}c',			'b',			false],
		])('should compare "%s" and "%s" correctly', (chunkA, chunkB, expected) => {
			const a = splitToChunks(chunkA);
			const b = splitToChunks(chunkB);
			
			// Ensure we are dealing w/ single chunk strings
			expect(a.length).toBe(1);
			expect(b.length).toBe(1);
	
			expect(checkChunkOverlap(a[0], b[0])).toBe(expected);
		});
	});
});