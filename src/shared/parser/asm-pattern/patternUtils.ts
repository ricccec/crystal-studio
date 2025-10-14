// Character class that placeholders can match (single character)
const PLACEHOLDER_CHAR_CLASS = /^[a-zA-Z0-9_]$/;

// Character class for valid placeholder names (any length, including empty)
const PLACEHOLDER_NAME_CHARS = '[a-zA-Z0-9_]*';

// Full regex for validating placeholder names (with anchors)
const PLACEHOLDER_VALID_NAME = new RegExp(`^${PLACEHOLDER_NAME_CHARS}$`);

// Pattern for matching placeholder syntax in strings
const PLACEHOLDER_NAME_PATTERN = `\\{\\s*${PLACEHOLDER_NAME_CHARS}\\s*\\}`;

function getPlaceholderNameRegex() {
    return new RegExp(PLACEHOLDER_NAME_PATTERN, 'g');
}

export function isValidPlaceholderName(str: string) {
    if (str.length === 0) return true;
    return PLACEHOLDER_VALID_NAME.test(str);
}

export function isPlaceholderMatch(str: string) {
    if (str.length === 0) return false;
    return PLACEHOLDER_CHAR_CLASS.test(str);
}

export function extractPlaceholders(pattern: string, namedOnly = true): string[] {
    const matches = pattern.match(getPlaceholderNameRegex());
    const placeholders = matches ? matches.map(match => match.slice(1, -1).trim()): [];
    // if includeEmpty is false, filter out empty placeholders
    return namedOnly ? placeholders.filter(p => p.length > 0) : placeholders;
}

export function checkPlaceholderUniqueness(placeholders: string[]) {
    return new Set(placeholders).size === placeholders.length;  
}

/**
 * Normalizes a pattern by removing placeholder labels and normalizing whitespace.
 * Keeps the curly brackets but replaces the placeholder name with empty string.
 * Replaces tabs and multiple spaces with single spaces.
 * 
 * @param branch The pattern string to normalize
 * @returns Normalized branch string
 */
export function normalizePattern(pattern: string): string {
    
    // Remove placeholder labels but keep the brackets
    const withoutLabels = pattern.replace(getPlaceholderNameRegex(), '{}');
    // Replace tabs and multiple spaces with single space
    const normalized = withoutLabels.replace(/\s+/g, ' ');
    // Trim leading/trailing spaces
    const trimmed = normalized.trim();

    return trimmed;
}

/**
 * Normalizes placeholder names by removing whitespace before and after the name inside { and }.
 * Transforms patterns like '{ reg }' to '{reg}' and '{  val  }' to '{val}'.
 * 
 * @param pattern The pattern string to normalize
 * @returns Pattern with normalized placeholder names
 * 
 * @example
 * normalizePlaceholderNames('ld { reg }, {val}') // returns 'ld {reg}, {val}'
 * normalizePlaceholderNames('{ }') // returns '{}'
 */
export function normalizePlaceholderNames(pattern: string): string {
    // Replace placeholders with whitespace-trimmed versions
    return pattern.replace(getPlaceholderNameRegex(), (match) => {
        // Extract the name between { and }, trim it, and wrap it back in {}
        return `{${match.slice(1, -1).trim()}}`;
    });
}

export function hasUnnamedPlaceholder(pattern: string) {
    return /\{\s*\}/.test(pattern);
}

/**
 * Checks if a pattern contains consecutive placeholders that are not properly separated.
 * Placeholders must be separated by characters that do NOT belong to PLACEHOLDER_CHAR_CLASS.
 * 
 * @param pattern The pattern to check
 * @returns true if consecutive placeholders are found (not properly separated), false otherwise
 * 
 * @example
 * hasConsecutivePlaceholders('{a}{b}') // true - no separator
 * hasConsecutivePlaceholders('{a} {b}') // false - separated by space (not in PLACEHOLDER_CHAR_CLASS)
 * hasConsecutivePlaceholders('{a}b{c}') // true - separated by 'b' (in PLACEHOLDER_CHAR_CLASS)
 */
export function hasConsecutivePlaceholders(pattern: string): boolean {
    // Match a placeholder followed by zero or more PLACEHOLDER_CHAR_CLASS characters, then another placeholder
    const regex = new RegExp(
        PLACEHOLDER_NAME_PATTERN + // First placeholder
        `[a-zA-Z0-9_]*` + // Zero or more chars in PLACEHOLDER_CHAR_CLASS
        PLACEHOLDER_NAME_PATTERN // Second placeholder
    );
    return regex.test(pattern);
}

/**
 * Checks if a pattern contains branching (unescaped |, [, or ]).
 * Valid patterns contain only literals and placeholders, no branching or bracketed alternatives.
 * 
 * @param pattern The pattern to check
 * @returns true if the pattern is simple, false otherwise
 */
export function hasBranching(pattern: string): boolean {
    // Check for unescaped |, [, or ]
    // Using negative lookbehind to ensure not preceded by \
    return /(?<!\\)\||(?<!\\)\[|(?<!\\)\]/.test(pattern);
}
