import { isPlaceholderMatch, isValidPlaceholderName, normalizePattern } from "./patternUtils";

/**
 * A SimplePattern is a pattern with no branching (ie. no unsecaped '|' nor '[' and ']')
 */
export type AsmPatternChunk = {
    text: string;
    hasPlaceholder: boolean;
    hasPrefix: boolean;
    hasSuffix: boolean;
    isSeparator: boolean;
    prefix: string; // Text before placeholder or full text if no placeholder
    suffix: string; // Text after placeholder
};

function createChunk(text: string): AsmPatternChunk {
    // Validation: ensure placeholders (if present) are well-formed and unique within this chunk
    const openCount = (text.match(/\{/g) || []).length;
    const closeCount = (text.match(/\}/g) || []).length;

    if (closeCount > 0 && openCount === 0) {
        throw new Error(`Unmatched closing bracket detected in pattern substring: ${text}`);
    }

    if (openCount > 1 || closeCount > 1) {
        // More than one placeholder in a single chunk is not allowed in our model
        throw new Error(`Consecutive placeholders detected in substring: ${text}`);
    }

    const placeholderStartIndex = text.indexOf('{');
    const placeholderEndIndex = placeholderStartIndex !== -1 ? text.indexOf('}', placeholderStartIndex) : -1;

    if (placeholderStartIndex !== -1 && placeholderEndIndex === -1) {
        throw new Error(`Unmatched opening bracket detected in pattern substring: ${text}`);
    }

    const hasPlaceholder = placeholderStartIndex !== -1 && placeholderEndIndex !== -1;
    const hasPrefix = hasPlaceholder ? placeholderStartIndex > 0 : false;
    const hasSuffix = hasPlaceholder ? placeholderEndIndex < (text.length - 1) : false;

    // Validate placeholder name if present
    if (hasPlaceholder) {
        const name = text.substring(placeholderStartIndex + 1, placeholderEndIndex).trim();
        if (!isValidPlaceholderName(name)) {
            throw new Error(`Invalid placeholder name '${name}' in substring: ${text}`);
        }
    }

    return {
        text,
        hasPlaceholder,
        isSeparator: !hasPlaceholder && !isPlaceholderMatch(text[0]),
        prefix: hasPlaceholder ? text.substring(0, placeholderStartIndex) : text,
        suffix: hasPlaceholder ? text.substring(placeholderEndIndex + 1) : "",
        hasPrefix,
        hasSuffix,
    };
}

/**
 * Split a pattern into chunks.
 * Rules:
 * - A chunk accumulates characters that are in the placeholder class or a placeholder itself.
 * - A chunk ends when:
 *   1. A character outside the placeholder class is encountered.
 *   2. A *second* placeholder is encountered.
 * - Characters outside the placeholder class form their own chunks.
 */
export function splitToChunks(pattern: string): AsmPatternChunk[] {
     // Consume pattern sequentially. Split when the `isPlaceholderMatch` class
    // flips; however, if we encounter a '{' we atomically consume until the
    // matching '}' and treat that substring as a single run.
    if (pattern.length === 0) return [];

    const runs: { text: string; isPlaceholderClass: boolean }[] = [];
    let i = 0;
    let currentText = '';
    let currentIsPlaceholder = 
            (pattern[0] === '{') ||
            (pattern[0] === '}') ||
            isPlaceholderMatch(pattern[0]);

    while (i < pattern.length) {
        const ch = pattern[i];

        const chIsPlaceholder = (ch === '{') || (ch === '}') || isPlaceholderMatch(ch);
        if (currentIsPlaceholder !== chIsPlaceholder) {
            runs.push({ text: currentText, isPlaceholderClass: currentIsPlaceholder });
            currentText = ch;
            currentIsPlaceholder = chIsPlaceholder;
        } else {
            currentText += ch;
        }
        
        // Handle opening '{'
        if (ch !== '{') {
            i++;
        } else if (i + 1 < pattern.length){
            let end = pattern.indexOf('}', i);
            if (end === -1) {
                end = pattern.length - 1;
            } 
            
            const placeholderSubstr = pattern.substring(i + 1, end + 1);
            currentText += placeholderSubstr;
            i = end + 1;
        }

    }

    if (currentText.length > 0) runs.push({ text: currentText, isPlaceholderClass: currentIsPlaceholder });

    const chunks: AsmPatternChunk[] = runs.map(r => createChunk(r.text));
    return chunks;
}

/**
 * Returns true iff there exists at least one assembly chunk that would be
 * matched by both chunks
 */
export function checkChunkOverlap(c1: AsmPatternChunk, c2: AsmPatternChunk): boolean {
    // 1. Separator vs non-separator -> not equal
    if (c1.isSeparator !== c2.isSeparator) return false;

    const t1 = normalizePattern(c1.text);
    const t2 = normalizePattern(c2.text);

    // 2. If both separators, must match exactly
    if (c1.isSeparator && c2.isSeparator) return t1 === t2;

    // 3. Neither is separator now
    // If neither has placeholder -> exact match
    if (!c1.hasPlaceholder && !c2.hasPlaceholder) return t1 === t2;

	// 4. At least one has a placeholder now
    // If one or both is a pure placeholder -> match
	const c1IsPlaceholder = c1.hasPlaceholder && !(c1.hasPrefix || c1.hasSuffix);
	const c2IsPlaceholder = c2.hasPlaceholder && !(c2.hasPrefix || c2.hasSuffix); 
    if (c1IsPlaceholder || c2IsPlaceholder) return true;

    // 5. At least one has prefix/duffix now -> compare prefixes and suffixes
    
    // Prefix (forward comparison)
    let i = 0;
    let j = 0;
    while (true) {
        const char1 = t1[i]; // Might be undefined
        const char2 = t2[j]; // Might be undefined

        // None inside placeholder -> compare characters
        if ((char1 !== '{') && (char2 !== '{')) {
            if (char1 !== char2) return false;
            i++; j++;
            continue; // Keep going
        }

        // At least one inside placeholder
        
        let ptrn1InsidePlaceholder = (char1 === '{');
        let ptrn2InsidePlaceholder = (char2 === '{');

        // pattern1 has placeholder, pattern2 has literal
        if (ptrn1InsidePlaceholder && !ptrn2InsidePlaceholder) {
            // Check if there is at least a character to match the placeholder
            if (!char2) return false;
            break; // Start backward comparison
        }

        // pattern2 has placeholder, pattern1 has literal
        if (ptrn2InsidePlaceholder && !ptrn1InsidePlaceholder) {
            // Check if there is at least a character to match the placeholder
            if (!char1) return false;
            break; // Start backward comparison
        }
        
        // Both have placeholders -> always match
        break; // Start backward comparison

    }

    // Suffix (backward comparison)
    let b_i = t1.length - 1;
    let b_j = t2.length - 1;
    while (true) {

		
		const char1 = t1[b_i]; // Might be undefined
        const char2 = t2[b_j]; // Might be undefined
		
        // Either one or the other is inside placeholder
        if ((char1 === '}') || (char2 === '}')) {
			break;
        }
		
		
        // None inside placeholder -> compare characters
		if ((i >= b_i) || (j >= b_j)) return false;
        if (char1 !== char2) return false;

        // Keep going
        b_i--; b_j--;
    }

    return true;
}