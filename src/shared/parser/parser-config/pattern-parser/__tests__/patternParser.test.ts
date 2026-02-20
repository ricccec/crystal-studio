import { describe, it, expect } from 'vitest';
import { parsePattern } from '../../parser-config/pattern-parser/patternParser';

describe('parsePattern', () => {
    
    // Basic patterns without branching
    describe('simple patterns without branching', () => {
        it('should parse a pattern with no branches or brackets', () => {
            const result = parsePattern('ld a, b');
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toBe('ld a, b');
            expect(result[0].placeholderNames).toEqual([]);
        });

        it('should parse a pattern with placeholders but no branches', () => {
            const result = parsePattern('ld {reg}, {val}');
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toBe('ld {reg}, {val}');
            expect(result[0].placeholderNames.sort()).toEqual(['reg', 'val']);
        });

        it('should parse a pattern with escaped brackets', () => {
            const result = parsePattern('ld \\[hl\\], a');
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toBe('ld \\[hl\\], a');
        });

        it('should parse an empty pattern', () => {
            const result = parsePattern('');
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toBe('');
        });
    });

    describe('subpattern joining', () => {
        it ('should respect leading/trailing spaces/tabs when joining subpatterns', () => {
           const result = parsePattern('add[ $05 |\t{reg}][\\[hl\\]\t] ;comment')
           expect(result).toHaveLength(2);
           expect(result.map(p => p.pattern).sort()).toEqual([
                'add $05 \\[hl\\]\t ;comment',
                'add\t{reg}\\[hl\\]\t ;comment',
            ].sort());
        });

        it ('should not attempt to remove consecutive spaces/tabs when joining subpatterns', () => {
           const result = parsePattern('add [ $05 |\t{reg}][\t] ;comment')
           expect(result).toHaveLength(2);
           expect(result.map(p => p.pattern).sort()).toEqual([
                'add  $05 \t ;comment',
                'add \t{reg}\t ;comment',
            ].sort());
        });
    });

    // Patterns with pipe branches only (no brackets)
    describe('patterns with pipe branches', () => {
        it('should parse a pattern with two simple branches', () => {
            const result = parsePattern('ld a|add {w}');
            expect(result).toHaveLength(2);
            expect(result[0].pattern).toBe('ld a');
            expect(result[1].pattern).toBe('add {w}');
        });

        it('should parse a pattern with multiple branches', () => {
            const result = parsePattern('ld|add {v}|sub {w}|xor {z}');
            expect(result).toHaveLength(4);
            expect(result.map(p => p.pattern)).toEqual(['ld', 'add {v}', 'sub {w}', 'xor {z}']);
        });

        it('should parse branches with placeholders', () => {
            const result = parsePattern('ld {reg}|add {val}');
            expect(result).toHaveLength(2);
            expect(result[0].placeholderNames).toEqual(['reg']);
            expect(result[1].placeholderNames).toEqual(['val']);
        });

        it('should handle escaped pipes as literals', () => {
            const result = parsePattern('ld a\\|b|add {reg}');
            expect(result).toHaveLength(2);
            expect(result[0].pattern).toBe('ld a\\|b');
            expect(result[1].pattern).toBe('add {reg}');
        });
    });

    // Patterns with brackets only (no pipes inside brackets)
    describe('patterns with bracket alternatives', () => {
        it('should expand a pattern with single bracket alternative', () => {
            const result = parsePattern('ld [{reg}|\\[hl\\]]');
            expect(result).toHaveLength(2);
            expect(result[0].pattern).toBe('ld {reg}');
            expect(result[1].pattern).toBe('ld \\[hl\\]');
        });

        it('should expand a pattern with bracket in the middle', () => {
            const result = parsePattern('ld [{reg}|\\[hl\\]] c');
            expect(result).toHaveLength(2);
            expect(result[0].pattern).toBe('ld {reg} c');
            expect(result[1].pattern).toBe('ld \\[hl\\] c');
        });

        it('should expand multiple bracket alternatives (Cartesian product)', () => {
            const result = parsePattern('[ld|add{w}] [a|b{u}]');
            expect(result).toHaveLength(4);
            expect(result.map(p => p.pattern).sort()).toEqual([
                'add{w} a',
                'add{w} b{u}',
                'ld a',
                'ld b{u}'
            ].sort());
        });

        it('should handle bracket with single option', () => {
            const result = parsePattern('ld [a] b');
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toBe('ld a b');
        });

        it('should handle bracket with placeholders', () => {
            const result = parsePattern('ld [a {reg_a}|b {reg_b}]');
            expect(result).toHaveLength(2);
            expect(result[0].placeholderNames).toEqual(['reg_a']);
            expect(result[1].placeholderNames).toEqual(['reg_b']);
        });
    });

    // Complex patterns with both brackets and pipes
    describe('complex patterns with brackets and pipes', () => {
        it('should handle pattern with brackets containing placeholders', () => {
            const result = parsePattern('[ld|add {reg_0}] {reg_1}, {val}');
            expect(result).toHaveLength(2);
            expect(result[0].pattern).toBe('ld {reg_1}, {val}');
            expect(result[1].pattern).toBe('add {reg_0} {reg_1}, {val}');
            expect(result[0].placeholderNames.sort()).toEqual(['reg_1', 'val']);
        });

        it('should expand complex nested alternatives', () => {
            const result = parsePattern('[ld|st {d},] [{a}|\\[hl\\]], {c}');
            expect(result).toHaveLength(4);
            expect(result.map(p => p.pattern).sort()).toEqual([
                'ld {a}, {c}',
                'ld \\[hl\\], {c}',
                'st {d}, {a}, {c}',
                'st {d}, \\[hl\\], {c}'
            ].sort());
        });

        it('should handle pattern with multiple brackets and literals', () => {
            const result = parsePattern('op [a|b{w}] mid [c|d{u}] end');
            expect(result).toHaveLength(4);
            expect(result.map(p => p.pattern).sort()).toEqual([
                'op a mid c end',
                'op a mid d{u} end',
                'op b{w} mid c end',
                'op b{w} mid d{u} end'
            ].sort());
        });
    });

    // Edge cases
    describe('edge cases', () => {
        it('should handle empty bracket alternatives', () => {
            const result = parsePattern('ld[| {reg}] \\[hl\\]');
            expect(result).toHaveLength(2);
            expect(result.map(p => p.pattern).sort()).toEqual(['ld \\[hl\\]', 'ld {reg} \\[hl\\]'].sort());
        });

        it('should handle pattern with only brackets', () => {
            const result = parsePattern('[a|{u}_e|c {w}]');
            expect(result).toHaveLength(3);
            expect(result.map(p => p.pattern)).toEqual(['a', '{u}_e', 'c {w}']);
        });

        it('should handle adjacent brackets', () => {
            const result = parsePattern('[a|b {u}][c {w}|d {z}]');
            expect(result).toHaveLength(4);
            expect(result.map(p => p.pattern).sort()).toEqual([
                'ac {w}',
                'ad {z}',
                'b {u}c {w}',
                'b {u}d {z}'
            ].sort());
        });

        it('should handle whitespace in branches', () => {
            const result = parsePattern('[  a  |  b{w}  ]');
            expect(result).toHaveLength(2);
            expect(result[0].pattern).toBe('  a  ');
            expect(result[1].pattern).toBe('  b{w}  ');
        });
    });

    // Error cases
    describe('error handling', () => {
        it('should throw error for unmatched opening bracket', () => {
            expect(() => parsePattern('ld [a')).toThrow();
        });

        it('should throw error for unmatched closing bracket', () => {
            expect(() => parsePattern('ld a]')).toThrow();
        });

        it('should throw error for nested brackets', () => {
            expect(() => parsePattern('ld [a [b] c]')).toThrow();
        });

        it('should throw error for duplicate placeholders in branch', () => {
            expect(() => parsePattern('ld {reg}, {reg}')).toThrow();
        });

        it('should throw error for branches with same placeholder set (before concatenation)', () => {
            expect(() => parsePattern('ld [a {x}, {y}|b {x}, {y}]')).toThrow();
        });

        it('should throw error for branches with same placeholder set (after concatenation)', () => {
            expect(() => parsePattern('[a {x}|b {y}][c {y}|d {x}]')).toThrow();
        });

        it('should throw error for equivalent branches', () => {
            expect(() => parsePattern('ld[| a][ a|')).toThrow();
        });

        it('should throw error for multiple branches with no placeholders', () => {
            expect(() => parsePattern('[ld a|add b|sub c]')).toThrow();
        });

        it('should throw error for consecutive placeholders', () => {
            expect(() => parsePattern('[a |b {u}][{z}]')).toThrow();
        });
    });

    // Real-world assembly patterns
    describe('realistic assembly patterns', () => {
        it('should parse complex instructions with branching', () => {
            const result = parsePattern('map_att {map_name}, {map_id}, ${b_block}, [{conn_1}|{conn_1} \\| {conn_2}]');
            expect(result).toHaveLength(2);
            expect(result.map(p => p.pattern).sort()).toEqual([
                'map_att {map_name}, {map_id}, ${b_block}, {conn_1}',
                'map_att {map_name}, {map_id}, ${b_block}, {conn_1} \\| {conn_2}',
            ].sort());
        });

        it('should handle double quotes', () => {
            const result = parsePattern('INCLUDE "maps/{map_name}.asm"');
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toEqual('INCLUDE "maps/{map_name}.asm"');
        });

        it('should handle single quotes', () => {
            const result = parsePattern("INCLUDE 'maps/{map_name}.asm'");
            expect(result).toHaveLength(1);
            expect(result[0].pattern).toEqual("INCLUDE 'maps/{map_name}.asm'");
        });

    });

    // Unnamed placeholders
    describe('unnamed placeholders', () => {
        it('should handle patterns with unnamed placeholders', () => {
            const result = parsePattern('ld {}');
            expect(result).toHaveLength(1);
            expect(result[0].hasUnnamedPlaceholders).toBe(true);
        });

        it('should handle mixed named and unnamed placeholders', () => {
            const result = parsePattern('ld {reg}, {}');
            expect(result).toHaveLength(1);
            expect(result[0].placeholderNames).toEqual(['reg']);
            expect(result[0].hasUnnamedPlaceholders).toBe(true);
        });

    });

});
