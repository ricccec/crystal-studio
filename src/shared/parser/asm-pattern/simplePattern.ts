import { checkPlaceholderUniqueness, extractPlaceholders as extractPlaceholderNames, hasBranching, hasConsecutivePlaceholders, hasUnnamedPlaceholder, isPlaceholderMatch, normalizePattern, normalizePlaceholderNames } from "./patternUtils";

/**
 * A SimplePattern is a pattern with no branching (ie. no unsecaped '|' nor '[' and ']')
 */
export type SimplePattern = {
    pattern: string,
    placeholderNames: string[],
    hasUnnamedPlaceholders: boolean,
};

export type SimplePatternResult = 
    | { ok: false, error: string }
    | { ok: true, simplePattern: SimplePattern };

/**
 * Parse and validates a simple pattern
 *  
 * Rules:
 * - A SimplePattern only contains literals and placeholders (ie. no branching)
 * - Each named placeholder appears at most once
 * - The empty placeholder might appear multiple times
 * - No consecutive placeholders (eg. {a}{b} or {a}_{b})
 * 
 */
export function parseSimplePattern(pattern: string): SimplePatternResult {
    
    // Check this is indeed a SimplePattern
    if (hasBranching(pattern)) {
        return { ok: false, error: `Branching not allowed on pattern: ${pattern}` };
    }
    
    // Check it has no consecutive placeholders
    if (hasConsecutivePlaceholders(pattern)) {
        return { ok: false, error: `Consecutive placeholders on pattern: ${pattern}`}
    }

    // Extract all named (ie. non-empty) placeholders and check for duplicates
    // eg. ld { reg_1} \[{ reg_1 }\] is not allowed
    const placeholders = extractPlaceholderNames(pattern);
    if (!checkPlaceholderUniqueness(placeholders)) {
        return { ok: false, error: `Duplicate placeholders on pattern ${pattern}` };
    }

    // Normalize placeholder names inside the pattern
    const normPattern = normalizePlaceholderNames(pattern);

    return {
        ok: true,
        simplePattern: {
            pattern: normPattern,
            placeholderNames: placeholders,
            hasUnnamedPlaceholders: hasUnnamedPlaceholder(pattern),
        } 
    }

}

/**
 * Checks if two simple patterns are equivalent by comparing them character by character.
 * Placeholders (e.g., {name} or {}) are treated as wildcards that match any 
 * sequence of characters matching PLACEHOLDER_CHAR_CLASS.
 * 
 * @param p1 First pattern to compare
 * @param p2 Second pattern to compare
 * @returns true if patterns are equivalent, false otherwise
 */
export function compareSimplePatterns(pattern1: SimplePattern, pattern2: SimplePattern): boolean {
    
    // Normalize patterns
    const p1 = normalizePattern(pattern1.pattern);
    const p2 = normalizePattern(pattern2.pattern);

    let i = 0;
    let j = 0;

    let ptrn1InsidePlaceholder = false;
    let ptrn2InsidePlaceholder = false;

    while (i < p1.length && j < p2.length) {
        const char1 = p1[i];
        const char2 = p2[j];

        // Check if we're at the start of a placeholder in pattern1
        if (char1 === '{') {
            ptrn1InsidePlaceholder = true;
            // Move pattern1 cursor to the } at the end of the placeholder
            const placeholderEnd = p1.indexOf('}', i);
            if (placeholderEnd === -1) return false; // Malformed placeholder
            i = placeholderEnd;
        }

        // Check if we're at the start of a placeholder in pattern2
        if (char2 === '{') {
            ptrn2InsidePlaceholder = true;
            // Move pattern2 cursor to the } at the end of the placeholder
            const placeholderEnd = p2.indexOf('}', j);
            if (placeholderEnd === -1) return false; // Malformed placeholder
            j = placeholderEnd;
        }

        // pattern1 has placeholder, pattern2 has literal
        if (ptrn1InsidePlaceholder && !ptrn2InsidePlaceholder) {
            // Check if the first literal matches the placeholder character class
            if (!isPlaceholderMatch(char2)) return false;
            // Move pattern2 cursor to the last char of the literal
            while ((j + 1) < p2.length) {
                if (!isPlaceholderMatch(p2[j + 1])) break;
                j++; 
            }
        }

        // pattern2 has placeholder, pattern1 has literal
        if (ptrn2InsidePlaceholder && !ptrn1InsidePlaceholder) {
            // Check if the first literal matches the placeholder character class
            if (!isPlaceholderMatch(char1)) return false;
            // Move pattern1 cursor to the last char of the literal
            while ((i + 1) < p1.length) {
                if (!isPlaceholderMatch(p1[i + 1])) break;
                i++; 
            }
        }

        // None inside placeholder -> compare characters
        if (!(ptrn1InsidePlaceholder || ptrn2InsidePlaceholder)) {
            if (char1 !== char2) return false;
        }

        ptrn1InsidePlaceholder = false;
        ptrn2InsidePlaceholder = false;

        i++; j++;

    }

    // Both patterns should be fully consumed
    return i === p1.length && j === p2.length;

}
