import { describe, it, expect } from 'vitest';
import { concatLanguages as cartesianProduct } from '../languageProduct';

describe('cartesianProduct', () => {
    it('should return empty string for empty input', () => {
        const result = cartesianProduct([]);
        expect(result).toEqual(new Set(['']));
    });

    it('should return single array unchanged', () => {
        const result = cartesianProduct([['a', 'b', 'c']]);
        expect(result).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should compute product of two arrays', () => {
        const result = cartesianProduct([['a', 'b'], ['c', 'd']]);
        expect(result).toEqual(new Set(['ac', 'ad', 'bc', 'bd']));
    });

    it('should compute product of multiple arrays', () => {
        const result = cartesianProduct([['a', 'b'], ['c'], ['d', 'e']]);
        expect(result).toEqual(new Set(['acd', 'ace', 'bcd', 'bce']));
    });

    it('should return empty array when any input array is empty', () => {
        const result = cartesianProduct([['a', 'b'], [], ['c']]);
        expect(result).toEqual(new Set([]));
    });

    it('should handle arrays with single elements', () => {
        const result = cartesianProduct([['x'], ['y'], ['z']]);
        expect(result).toEqual(new Set(['xyz']));
    });

    it('should handle arrays with empty strings', () => {
        const result = cartesianProduct([[''], ['a'], ['']]);
        expect(result).toEqual(new Set(['a']));
    });

    it('should handle complex combinations', () => {
        const result = cartesianProduct([
            ['ld', 'add'],
            ['a', 'b', 'c'],
            [', ', ' + '],
            ['hl', 'de']
        ]);
        expect(result).toEqual(new Set([
            'lda, hl', 'lda, de', 'lda + hl', 'lda + de',
            'ldb, hl', 'ldb, de', 'ldb + hl', 'ldb + de',
            'ldc, hl', 'ldc, de', 'ldc + hl', 'ldc + de',
            'adda, hl', 'adda, de', 'adda + hl', 'adda + de',
            'addb, hl', 'addb, de', 'addb + hl', 'addb + de',
            'addc, hl', 'addc, de', 'addc + hl', 'addc + de'
        ]));
    });

    it('should preserve order of combinations', () => {
        const result = cartesianProduct([['1', '2'], ['a', 'b']]);
        expect(result).toEqual(new Set(['1a', '1b', '2a', '2b']));
    });
});