import { describe, it, expect } from 'vitest';
import { splitPattern } from '../patternSplitter';

describe('splitPattern', () => {
    it('should split a simple bracketed pattern', () => {
        const result = splitPattern('a[b]c');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['a', 'b', 'c']);
        }
    });

    it('should handle multiple bracketed sections', () => {
        const result = splitPattern('ld [hl], a[bc]');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['ld ', 'hl', ', a', 'bc']);
        }
    });

    it('should handle escaped brackets as literals', () => {
        const result = splitPattern('a\\[b\\]c');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['a\\[b\\]c']);
        }
    });

    it('should handle pattern with no brackets', () => {
        const result = splitPattern('hello world');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['hello world']);
        }
    });

    it('should handle empty string', () => {
        const result = splitPattern('');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual([]);
        }
    });

    it('should return error for unmatched opening bracket', () => {
        const result = splitPattern('a[b');
        expect(result.ok).toBe(false);
    });

    it('should return error for unmatched opening bracket (complex case)', () => {
        const result = splitPattern('a[b]c d \[ [');
        expect(result.ok).toBe(false);
    });

    it('should return error for unmatched closing bracket', () => {
        const result = splitPattern('a]b');
        expect(result.ok).toBe(false);
    });
    
    it('should return error for unmatched closing bracket (complex case)', () => {
        const result = splitPattern('a[b]c]');
        expect(result.ok).toBe(false);
    });

    it('should return error for nested brackets', () => {
        const result = splitPattern('a[b[c]]d');
        expect(result.ok).toBe(false);
    });

    it('should handle consecutive brackets', () => {
        const result = splitPattern('a[b][c]d');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['a', 'b', 'c', 'd']);
        }
    });

    it('should handle brackets at start and end', () => {
        const result = splitPattern('[start]middle[end]');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['start', 'middle', 'end']);
        }
    });

    it('should ignore empty brackets ', () => {
        const result = splitPattern('a[]d[bc]');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['a', 'd', 'bc']);
        }
    });

    it('should leave escaped brackets unchanged', () => {
        const result = splitPattern('ld \\[hl\\], a');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.subpatterns).toEqual(['ld \\[hl\\], a']);
        }
    });
    
});