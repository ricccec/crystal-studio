import { splitToChunks, checkChunkOverlap } from "./asmPatternChunk";
import { checkPlaceholderUniqueness, extractPlaceholders, hasConsecutivePlaceholders, hasUnnamedPlaceholder, normalizePattern, normalizePlaceholderNames } from "./patternUtils";

export type AsmPattern = {
    pattern: string,
    placeholderNames: string[],
    hasUnnamedPlaceholders: boolean,
};

export type ParseAsmPatternResult = 
    | { ok: false, error: string }
    | { ok: true, simplePattern: AsmPattern };

/**
 * Parse and validates a simple pattern
 *  
 * Rules:
 * - An AsmPattern is a sequence of literals and placeholders
 * - Each named placeholder appears at most once
 * - The empty placeholder might appear multiple times
 * - No consecutive placeholders. Placeholders are consecutive when:
 * 		- there's no char in between (eg. {a}{b})
 * 		- are separed by a sequence that can be matched by a placeholder (eg. {a}w_z{b})
 * 
 */
export function parseAsmPattern(pattern: string): ParseAsmPatternResult {
    
    // Check it has no consecutive placeholders
    if (hasConsecutivePlaceholders(pattern)) {
        return { ok: false, error: `Consecutive placeholders on pattern: ${pattern}`}
    }

    // Extract all named (ie. non-empty) placeholders and check for duplicates
    // eg. ld { reg_1} \[{ reg_1 }\] is not allowed
    const placeholders = extractPlaceholders(pattern);
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
 * Determine whether two patterns have at least one common match.
 * Returns true iff there exists at least one assembly line that would be
 * matched by both patterns (i.e. the intersection of their match sets is
 * non-empty).
 *
 * Placeholders (e.g., {name} or {}) are treated as wildcards that match any
 * sequence of characters allowed by PLACEHOLDER_CHAR_CLASS.
 *
 * Comparison is performed chunk-by-chunk after pattern normalization.
 *
 * @param p1 First pattern to compare
 * @param p2 Second pattern to compare
 * @returns true if there exists at least one asm line matched by both patterns
 */
export function checkPatternOverlap(pattern1: AsmPattern, pattern2: AsmPattern): boolean {
    const chunks1 = splitToChunks(normalizePattern(pattern1.pattern));
    const chunks2 = splitToChunks(normalizePattern(pattern2.pattern));

    if (chunks1.length !== chunks2.length) return false;

    for (let i = 0; i < chunks1.length; i++) {
        if (!checkChunkOverlap(chunks1[i], chunks2[i])) return false;
    }

    return true;
}
