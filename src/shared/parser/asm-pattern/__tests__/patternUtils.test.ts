import { describe, it, expect } from 'vitest';
import { 
    extractPlaceholders, 
    checkPlaceholderUniqueness, 
    hasUnnamedPlaceholder, 
    hasConsecutivePlaceholders,
    normalizePlaceholderNames,
    isValidPlaceholderName,
    isPlaceholderMatch,
    normalizePattern,
} from '../patternUtils';

describe('extractPlaceholders', () => {
    it('should extract named placeholders', () => {
        const result = extractPlaceholders('ld {reg}, {val}');
        expect(result).toEqual(['reg', 'val']);
    });

    it('should extract placeholders with underscores and numbers', () => {
        const result = extractPlaceholders('ld {reg_1}, {val_2}');
        expect(result).toEqual(['reg_1', 'val_2']);
    });

    it('should trim whitespace around placeholder names', () => {
        const result = extractPlaceholders('ld { reg }, {  val  }');
        expect(result).toEqual(['reg', 'val']);
    });

    it('should exclude empty placeholders by default', () => {
        const result = extractPlaceholders('ld {}, {reg}');
        expect(result).toEqual(['reg']);
    });

    it('should include empty placeholders when namedOnly is false', () => {
        const result = extractPlaceholders('ld {}, {reg}, {   }', false);
        expect(result).toEqual(['', 'reg', '']);
    });

    it('should return empty array for pattern with no placeholders', () => {
        const result = extractPlaceholders('ld a, b');
        expect(result).toEqual([]);
    });

    it('should handle escaped brackets', () => {
        const result = extractPlaceholders('ld \\[{reg}\\], {val}');
        expect(result).toEqual(['reg', 'val']);
    });

    it('should handle single placeholder', () => {
        const result = extractPlaceholders('{op}');
        expect(result).toEqual(['op']);
    });
});

describe('checkPlaceholderUniqueness', () => {
    it('should return true for unique placeholders', () => {
        expect(checkPlaceholderUniqueness(['reg', 'val', 'addr'])).toBe(true);
    });

    it('should return false for duplicate placeholders', () => {
        expect(checkPlaceholderUniqueness(['reg', 'val', 'reg'])).toBe(false);
    });

    it('should return true for empty array', () => {
        expect(checkPlaceholderUniqueness([])).toBe(true);
    });

    it('should return true for single placeholder', () => {
        expect(checkPlaceholderUniqueness(['reg'])).toBe(true);
    });
});

describe('hasUnnamedPlaceholder', () => {
    it('should return true for empty placeholder', () => {
        expect(hasUnnamedPlaceholder('ld {}, a')).toBe(true);
    });

    it('should return true for whitespace-only placeholder', () => {
        expect(hasUnnamedPlaceholder('ld {   }, a')).toBe(true);
    });

    it('should return true for tab placeholder', () => {
        expect(hasUnnamedPlaceholder('ld {\t}, a')).toBe(true);
    });

    it('should return false for named placeholder', () => {
        expect(hasUnnamedPlaceholder('ld {reg}, a')).toBe(false);
    });

    it('should return false for pattern with no placeholders', () => {
        expect(hasUnnamedPlaceholder('ld a, b')).toBe(false);
    });

    it('should return true when mixed with named placeholders', () => {
        expect(hasUnnamedPlaceholder('ld {reg}, {}')).toBe(true);
    });
});

describe('hasConsecutivePlaceholders', () => {
    it('should return true for consecutive placeholders', () => {
        expect(hasConsecutivePlaceholders('{a}{b}')).toBe(true);
    });

    it('should return true for consecutive placeholders with spaces', () => {
        expect(hasConsecutivePlaceholders('{a} {b}')).toBe(false);
    });

    it('should return true for multiple consecutive placeholders', () => {
        expect(hasConsecutivePlaceholders('{a}{b}{c}')).toBe(true);
    });

    it('should return false for single placeholder', () => {
        expect(hasConsecutivePlaceholders('{a}')).toBe(false);
    });

    it('should return true for placeholders separated by literals', () => {
        expect(hasConsecutivePlaceholders('{a}b{b}')).toBe(true);
    });

    it('should return true for placeholders separated by numbers', () => {
        expect(hasConsecutivePlaceholders('{a}1{b}')).toBe(true);
    });

    it('should return true for placeholders separated by _', () => {
        expect(hasConsecutivePlaceholders('{a}_{b}')).toBe(true);
    });

    it('should return true for placeholders separated by a possible placeholder name', () => {
        expect(hasConsecutivePlaceholders('{a}_b1_3{b}')).toBe(true);
    });

    it('should return true for consecutive empty placeholders', () => {
        expect(hasConsecutivePlaceholders('{}{}')).toBe(true);
    });
});

describe('normalizePlaceholderNames', () => {
    it('should remove leading and trailing spaces from placeholder names', () => {
        expect(normalizePlaceholderNames('ld { reg }, {val}')).toBe('ld {reg}, {val}');
    });

    it('should handle multiple spaces around placeholder name', () => {
        expect(normalizePlaceholderNames('ld {  reg  }, {  val  }')).toBe('ld {reg}, {val}');
    });

    it('should handle empty placeholder', () => {
        expect(normalizePlaceholderNames('ld { }, a')).toBe('ld {}, a');
    });

    it('should handle placeholder with only spaces', () => {
        expect(normalizePlaceholderNames('ld {   }, a')).toBe('ld {}, a');
    });

    it('should handle tabs around placeholder name', () => {
        expect(normalizePlaceholderNames('ld {\treg\t}, {val}')).toBe('ld {reg}, {val}');
    });

    it('should not modify placeholders without spaces', () => {
        expect(normalizePlaceholderNames('ld {reg}, {val}')).toBe('ld {reg}, {val}');
    });

    it('should handle pattern with no placeholders', () => {
        expect(normalizePlaceholderNames('ld a, b')).toBe('ld a, b');
    });

    it('should handle multiple placeholders with mixed spacing', () => {
        expect(normalizePlaceholderNames('ld { reg1 }, {reg2}, {  reg3  }')).toBe('ld {reg1}, {reg2}, {reg3}');
    });

    it('should handle empty pattern', () => {
        expect(normalizePlaceholderNames('')).toBe('');
    });

    it('should handle placeholder with underscores and numbers', () => {
        expect(normalizePlaceholderNames('ld { reg_1 }, { val2 }')).toBe('ld {reg_1}, {val2}');
    });
});

describe('isValidPlaceholderName', () => {
    it('should return true for empty string', () => {
        expect(isValidPlaceholderName('')).toBe(true);
    });

    it('should return true for valid placeholder with alphanumeric name', () => {
        expect(isValidPlaceholderName('reg')).toBe(true);
    });

    it('should return true for placeholder with underscores', () => {
        expect(isValidPlaceholderName('reg_1')).toBe(true);
    });

    it('should return true for placeholder with numbers', () => {
        expect(isValidPlaceholderName('val123')).toBe(true);
    });

    it('should return true for placeholder with mixed alphanumeric and underscores', () => {
        expect(isValidPlaceholderName('my_var_2')).toBe(true);
    });

    it('should return false for invalid placeholder with special characters', () => {
        expect(isValidPlaceholderName('reg-1')).toBe(false);
    });

    it('should return false for placeholder with spaces', () => {
        expect(isValidPlaceholderName('reg val')).toBe(false);
    });

    it('should return false for malformed placeholder - missing closing brace', () => {
        expect(isValidPlaceholderName('{reg')).toBe(false);
    });

    it('should return false for malformed placeholder - missing opening brace', () => {
        expect(isValidPlaceholderName('reg}')).toBe(false);
    });

});

describe('isPlaceholderMatch', () => {
    it('should return true for lowercase letters', () => {
        expect(isPlaceholderMatch('a')).toBe(true);
    });

    it('should return true for uppercase letters', () => {
        expect(isPlaceholderMatch('Z')).toBe(true);
    });

    it('should return true for digits', () => {
        expect(isPlaceholderMatch('0')).toBe(true);
        expect(isPlaceholderMatch('9')).toBe(true);
    });

    it('should return true for underscore', () => {
        expect(isPlaceholderMatch('_')).toBe(true);
    });

    it('should return false for empty string', () => {
        expect(isPlaceholderMatch('')).toBe(false);
    });

    it('should return false for space', () => {
        expect(isPlaceholderMatch(' ')).toBe(false);
    });

    it('should return false for comma', () => {
        expect(isPlaceholderMatch(',')).toBe(false);
    });

    it('should return false for hyphen', () => {
        expect(isPlaceholderMatch('-')).toBe(false);
    });

    it('should return false for special characters', () => {
        expect(isPlaceholderMatch('!')).toBe(false);
        expect(isPlaceholderMatch('@')).toBe(false);
        expect(isPlaceholderMatch('$')).toBe(false);
    });

    it('should return false for multi-character strings', () => {
        expect(isPlaceholderMatch('abc')).toBe(false);
        expect(isPlaceholderMatch('a1')).toBe(false);
    });
});

describe('normalizePattern', () => {
    it('should remove placeholder labels', () => {
        expect(normalizePattern('ld {reg}, {val}')).toBe('ld {}, {}');
    });

    it('should keep curly brackets', () => {
        expect(normalizePattern('{reg}')).toBe('{}');
    });

    it('should normalize multiple spaces to single space', () => {
        expect(normalizePattern('ld  {reg}   {val}')).toBe('ld {} {}');
    });

    it('should replace tabs with single space', () => {
        expect(normalizePattern('ld\t{reg},\t{val}')).toBe('ld {}, {}');
    });

    it('should handle mixed whitespace types', () => {
        expect(normalizePattern('ld\t  {reg}  \t{val}')).toBe('ld {} {}');
    });

    it('should handle pattern without placeholders', () => {
        expect(normalizePattern('ld a, b')).toBe('ld a, b');
    });

    it('should handle empty pattern', () => {
        expect(normalizePattern('')).toBe('');
    });

    it('should handle pattern with escaped brackets', () => {
        expect(normalizePattern('ld \\[{reg}\\], a')).toBe('ld \\[{}\\], a');
    });

    it('should handle unnamed placeholders', () => {
        expect(normalizePattern('ld {}, {val}')).toBe('ld {}, {}');
    });

    it('should handle whitespace inside placeholder names', () => {
        expect(normalizePattern('ld { reg }, { val }')).toBe('ld {}, {}');
    });

    it('should normalize consecutive whitespace', () => {
        expect(normalizePattern('ld    a,    b')).toBe('ld a, b');
    });
});
