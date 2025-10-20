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

    while (i < p1.length && j < p2.length) {
        const char1 = p1[i];
        const char2 = p2[j];

        if ((char1 !== '{') && (char2 !== '{')) {
            // None inside placeholder -> compare characters
            if (char1 !== char2) return false;
            i++; j++;
            continue;
        }
        
        let ptrn1InsidePlaceholder = false;
        let ptrn2InsidePlaceholder = false;

        // Check if we're at the start of a placeholder in pattern1
        if (char1 === '{') {
            ptrn1InsidePlaceholder = true;
            // Move pattern1 cursor to the } at the end of the placeholder
            const placeholderEnd = p1.indexOf('}', i);
            if (placeholderEnd === -1) {
                throw new Error(`Unmatched closing bracket detected in pattern ${pattern1.pattern}`);
            }
            i = placeholderEnd;
            

        }

        // Check if we're at the start of a placeholder in pattern2
        if (char2 === '{') {
            ptrn2InsidePlaceholder = true;
            // Move pattern2 cursor to the } at the end of the placeholder
            const placeholderEnd = p2.indexOf('}', j);
            if (placeholderEnd === -1) {
                throw new Error(`Unmatched closing bracket detected in pattern ${pattern2.pattern}`);
            }
            j = placeholderEnd;
        }

        // pattern1 has placeholder, pattern2 has literal
        if (ptrn1InsidePlaceholder && !ptrn2InsidePlaceholder) {
            // Check if the first literal matches the placeholder character class
            if (!isPlaceholderMatch(char2)) return false;
        }

        // pattern2 has placeholder, pattern1 has literal
        if (ptrn2InsidePlaceholder && !ptrn1InsidePlaceholder) {
            // Check if the first literal matches the placeholder character class
            if (!isPlaceholderMatch(char1)) return false;
        }
        
        // One or both inside placeholder -> reverse check
        // Move both cursors to the first chars that could not be captured by a placeholder's regex
        let b1 = findPlaceholderBoundaries(p1, i, ptrn1InsidePlaceholder);
        let b2 = findPlaceholderBoundaries(p2, j, ptrn2InsidePlaceholder);
        // reverse check until one of the cursor hits a placeholder
        let k = 0;
        while(true) {
            const char1 = p1[b1-k];
            const char2 = p2[b2-k];
            if (char1 === '}' || char2 === '}') {
                i = b1; j = b2;
                break;
            }
            if (((b1-k) === i) || ((b2-k) === j)) return false;
            if (char1 !== char2) return false;
            k++;
        }
        
        i++; j++;

    }

    // Both patterns should be fully consumed
    return i === p1.length && j === p2.length;

}

function findPlaceholderBoundaries(pattern: string, startPos: number, checkBrackets: boolean): number {
    for (let i = startPos + 1; i < pattern.length; i++) {
        const nextChar = pattern[i];
        if (nextChar === '{') {
            if (checkBrackets) {
                throw new Error(`Consecutive placeholders detected in pattern ${pattern}`);
            }
            continue; // Skip bracket
        }
        if (nextChar === '}') {
            if (checkBrackets) {
                throw new Error(`Unmatched closing bracket detected in pattern ${pattern}`);
            }
            continue; // Skip brackets
        }
        // Check we've reached the border
        if (!isPlaceholderMatch(nextChar)) return i - 1;
    }
    return pattern.length - 1;
}