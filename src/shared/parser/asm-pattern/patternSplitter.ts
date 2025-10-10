/**
 * Splits a pattern using unescaped [ and ] as delimiters, with validation.
 * 
 * Validates that brackets are properly matched:
 * - No unescaped [ without a matching ]
 * - No unescaped ] without a preceding [
 * - No nested brackets (a [ followed by another [ before closing ])
 * 
 * @param pattern The pattern to split
 * @returns Success status plus an array of subpatterns or an error message if validation fails
 */
export function splitPattern(pattern: string): 
    | { success: false, error: string }
    | { success: true, subpatterns: string[] } {
        
    const subpatterns: string[] = [];
    let currentPart = '';
    let bracketDepth = 0;
    let i = 0;
    
    while (i < pattern.length) {
        const char = pattern[i];
        const nextChar = pattern[i + 1];
        
        // Handle escaped brackets
        if (char === '\\' && (nextChar === '[' || nextChar === ']')) {
            currentPart += nextChar;
            i += 2;
            continue;
        }
        
        // Handle unescaped brackets
        if (char === '[') {
            if (bracketDepth > 0) {
                return {
                    success: false,
                    error: `Nested unescaped brackets at position i in pattern "${pattern}". Use \\[ and \\] for literal brackets.`
                };
            }
            bracketDepth++;
            // Start a new subpattern with the content before the bracket
            if (currentPart) {
                subpatterns.push(currentPart);
                currentPart = '';
            }
        } else if (char === ']') {
            if (bracketDepth === 0) {
                return {
                    success: false,
                    error: `Closing unescaped brackets without opening at position i in pattern "${pattern}". Use \\[ and \\] for literal brackets.`
                };
            }
            bracketDepth--;
            // End the current bracketed subpattern
            if (currentPart) {
                subpatterns.push(currentPart);
                currentPart = '';
            }
        } else {
            currentPart += char;
        }
        
        i++;
    }
    
    // Check for unclosed brackets
    if (bracketDepth > 0) {
        return {
            success: false,
            error: `Unclosed brackets in pattern "${pattern}".`
        };
    }
    
    // Add the final part if any
    if (currentPart) {
        subpatterns.push(currentPart);
    }
    
    return { success: true, subpatterns };
}