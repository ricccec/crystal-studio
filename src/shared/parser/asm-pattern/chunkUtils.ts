import { isPlaceholderMatch, isValidPlaceholderName } from "./patternUtils";

/**
 * A SimplePattern is a pattern with no branching (ie. no unsecaped '|' nor '[' and ']')
 */
export type SimplePatternChunk = {
    text: string;
    hasPlaceholder: boolean;
    hasPrefix: boolean;
    hasSuffix: boolean;
    isSeparator: boolean;
    prefix: string; // Text before placeholder or full text if no placeholder
    suffix: string; // Text after placeholder
};

function createChunk(text: string): SimplePatternChunk {
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
export function splitToChunks(pattern: string): SimplePatternChunk[] {
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

    const chunks: SimplePatternChunk[] = runs.map(r => createChunk(r.text));
    return chunks;
}