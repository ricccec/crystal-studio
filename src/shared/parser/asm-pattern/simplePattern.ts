import { checkPlaceholderUniqueness, extractPlaceholders as extractPlaceholderNames, hasBranching, hasConsecutivePlaceholders, hasUnnamedPlaceholder, isPlaceholderMatch, normalizePattern, normalizePlaceholderNames } from "./patternUtils";
import { splitToChunks, compareChunks } from "./chunkUtils";

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
    const chunks1 = splitToChunks(normalizePattern(pattern1.pattern));
    const chunks2 = splitToChunks(normalizePattern(pattern2.pattern));

    if (chunks1.length !== chunks2.length) return false;

    for (let i = 0; i < chunks1.length; i++) {
        if (!compareChunks(chunks1[i], chunks2[i])) return false;
    }

    return true;
}
