import { describe, it, expect } from 'vitest';
import { hasBranching, parseBranches } from '../patternBranching';

describe('parseBranches', () => {

    it('should split simple pattern with two branches', () => {
        const result = parseBranches('a|b {test}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['a', 'b {test}']);
            expect(Array.from(result.placeholders).sort()).toEqual(['test']);
        }
    });

    it('should split pattern with multiple branches', () => {
        const result = parseBranches('ld | add {a} | sub {b} | xor {c}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld ', ' add {a} ', ' sub {b} ', ' xor {c}']);
            expect(Array.from(result.placeholders).sort()).toEqual(['a', 'b', 'c']);
        }
    });

    it('should handle pattern with no branches', () => {
        const result = parseBranches('single');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['single']);
            expect(Array.from(result.placeholders)).toEqual([]);
        }
    });

    it('should handle empty branches', () => {
        const result = parseBranches('a{u}||c{w}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['a{u}', '', 'c{w}']);
        }
    });

    it('should handle branch with only whitespace', () => {
        const result = parseBranches('a{u}|  |c{w}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['a{u}', '  ', 'c{w}']);
        }
    });

    it('should not trim whitespace from branches', () => {
        const result = parseBranches('  a{u}  |  b{w}  |  c{z}  ');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['  a{u}  ', '  b{w}  ', '  c{z}  ']);
        }
    });

    
    it('should trim whitespace from placeholders', () => {
        const result = parseBranches('  a{ u }  |  b{ w }  |  c{ z }  ');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['  a{u}  ', '  b{w}  ', '  c{z}  ']);
            expect(Array.from(result.placeholders).sort()).toEqual(['u', 'w', 'z']);
        }
    });

    it('should handle escaped pipe as literal', () => {
        const result = parseBranches('a\\|b|c{u}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['a\\|b', 'c{u}']);
        }
    });

    it('should handle multiple escaped pipes', () => {
        const result = parseBranches('a\\|b\\|c|d\\|{u}e');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['a\\|b\\|c', 'd\\|{u}e']);
        }
    });

    it('should extract placeholders from single branch', () => {
        const result = parseBranches('ld {reg}, {value}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld {reg}, {value}']);
            expect(Array.from(result.placeholders).sort()).toEqual(['reg', 'value']);
        }
    });

    it('should extract placeholders from multiple branches', () => {
        const result = parseBranches('ld {reg}|add {val}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld {reg}', 'add {val}']);
            expect(Array.from(result.placeholders).sort()).toEqual(['reg', 'val']);
        }
    });

    it('should collect unique placeholders across branches', () => {
        const result = parseBranches('ld {reg}, {value}|add {reg}, {offset}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Array.from(result.placeholders).sort()).toEqual(['offset', 'reg', 'value']);
        }
    });

    it('should return error for duplicate placeholders within same branch', () => {
        const result = parseBranches('ld {reg}, \\[{reg}\\]');
        expect(result.ok).toBe(false);
    });

    it('should return error for unescaped square brackets in branch', () => {
        const result = parseBranches('ld [hl]|add bc');
        expect(result.ok).toBe(false);
    });

    it('should allow escaped square brackets in branch', () => {
        const result = parseBranches('ld \\[hl\\]|add bc{u}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld \\[hl\\]', 'add bc{u}']);
        }
    });

    it('should return error for opening bracket without closing', () => {
        const result = parseBranches('ld [hl|add bc');
        expect(result.ok).toBe(false);
    });

    it('should return error for closing bracket without opening', () => {
        const result = parseBranches('ld hl]|add bc');
        expect(result.ok).toBe(false);
    });

    it('should handle complex pattern with placeholders and literals', () => {
        const result = parseBranches('ld {reg1}, {reg2}|add {reg1}, {val}|sub a');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld {reg1}, {reg2}', 'add {reg1}, {val}', 'sub a']);
            expect(Array.from(result.placeholders).sort()).toEqual(['reg1', 'reg2', 'val']);
        }
    });

    it('should handle empty string pattern', () => {
        const result = parseBranches('');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['']);
            expect(Array.from(result.placeholders)).toEqual([]);
        }
    });

    it('should handle pattern with trailing pipe', () => {
        const result = parseBranches('a{u}|b{v}|');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['a{u}', 'b{v}', '']);
        }
    });

    it('should handle pattern with leading pipe', () => {
        const result = parseBranches('|a{u}|b{v}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['', 'a{u}', 'b{v}']);
        }
    });

    it('should handle mixed escaped and unescaped pipes', () => {
        const result = parseBranches('{u}a\\|b|{v}c|{w}d\\|e\\|f');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['{u}a\\|b', '{v}c', '{w}d\\|e\\|f']);
        }
    });

    it('should handle placeholders with underscores and numbers', () => {
        const result = parseBranches('ld {reg_1}, {val_2}|add {reg_3}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Array.from(result.placeholders).sort()).toEqual(['reg_1', 'reg_3', 'val_2']);
        }
    });

    it('should handle long branch with multiple elements', () => {
        const result = parseBranches('ld {reg}, \\[{addr}\\] ; comment|add a, {val}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld {reg}, \\[{addr}\\] ; comment', 'add a, {val}']);
            expect(Array.from(result.placeholders).sort()).toEqual(['addr', 'reg', 'val']);
        }
    });

    it('should handle branches with special characters', () => {
        const result = parseBranches('ld a, #$FF|add b, @label{u}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld a, #$FF', 'add b, @label{u}']);
        }
    });

    it('should allow branches with different structure', () => {
        const result = parseBranches('ld {a}, {b}|add {x}');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.branches.map(b => b.pattern)).toEqual(['ld {a}, {b}', 'add {x}']);
        }
    });

    describe('invalid branches', () => {
        it('should split simple pattern with two branches', () => {
            const result = parseBranches('a|b');
            expect(result.ok).toBe(false);
        });

        it('should split simple pattern with two branches', () => {
            const result = parseBranches('a|{}');
            expect(result.ok).toBe(false);
        });

        it('should return error for duplicate branches with same placeholders', () => {
            const result = parseBranches('ld {reg}, {val}|ld {reg}, {val}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('placeholders');
            }
        });

        it('should return error for duplicate branches with different placeholder names', () => {
            const result = parseBranches('ld {a}, {b}|ld {x}, {y}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('equivalent');
            }
        });

        it('should return error for duplicate branches with different whitespace', () => {
            const result = parseBranches('ld  a,  b{u}|ld a, b{v}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('equivalent');
            }
        });

        it('should return error for duplicate branches with tabs vs spaces', () => {
            const result = parseBranches('ld\ta,\tb{u}|ld a, b{v}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('equivalent');
            }
        });

        it('should return error when branches differ only in placeholder names', () => {
            const result = parseBranches('add {reg1}|add {reg2}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('equivalent');
            }
        });

        it('should return error when branches only contain placeholders', () => {
            const result = parseBranches('{op}|{reg}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('equivalent');
            }
        });

        it('should return error with single pipe', () => {
            const result = parseBranches('|');
            expect(result.ok).toBe(false);
        });

        it('should not allow different branches with same placeholder names', () => {
            const result = parseBranches('ld {reg}|add {reg}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('placeholders');
            }
        });

        it('should normalize complex whitespace patterns', () => {
            const result = parseBranches('ld   {reg},   {val}|ld\t{reg},\t{val}|ld {reg}, {val}');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toContain('placeholders');
            }
        });
    });

    describe('complex cases', () => {
        it('should flag equivalent branches even for complex cases', () => {
            const result = parseBranches('a {} {} d|{} b c {w}');
            expect(result.ok).toBe(false);
        });

        it('should flag equivalent branches even for complex cases', () => {
            const result = parseBranches('a {} {} d|{} b {w} d');
            expect(result.ok).toBe(false);
        });

        it('should not flag non-equivalent branches even for complex cases', () => {
            const result = parseBranches('a {}\t{} d|{} b {w}');
            expect(result.ok).toBe(true);
        });

        it('should flag equivalent branches even for complex cases', () => {
            const result = parseBranches('a\t{}-{} d|{} b-cde {w} ');
            expect(result.ok).toBe(false);
        });
    });
});

describe('hasBranching', () => {
	it('should return true for simple literal pattern', () => {
		expect(hasBranching('ld a, b')).toBe(false);
	});

	it('should return true for pattern with placeholders', () => {
		expect(hasBranching('ld {reg}, {val}')).toBe(false);
	});

	it('should return true for pattern with escaped brackets', () => {
		expect(hasBranching('ld \\[hl\\]')).toBe(false);
	});

	it('should return true for pattern with escaped pipe', () => {
		expect(hasBranching('ld a\\|b')).toBe(false);
	});

	it('should return false for pattern with unescaped pipe', () => {
		expect(hasBranching('ld a|b')).toBe(true);
	});

	it('should return false for pattern with unescaped opening bracket', () => {
		expect(hasBranching('ld [hl]')).toBe(true);
	});

	it('should return false for pattern with unescaped closing bracket', () => {
		expect(hasBranching('ld hl]')).toBe(true);
	});

	it('should return false for pattern with multiple unescaped special chars', () => {
		expect(hasBranching('[a|b]')).toBe(true);
	});

	it('should return true for empty string', () => {
		expect(hasBranching('')).toBe(false);
	});

	it('should return true for complex simple pattern', () => {
		expect(hasBranching('ldi {reg1}, \\[hl+{offset}\\]')).toBe(false);
	});
});