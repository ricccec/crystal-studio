/**
 * Computes the Cartesian product of an array of languages (arrays of arrays of strings).
 * Examples:
 * - concatLanguages([['a', 'b'], ['c'], ['d', 'e']]) → ['acd', 'ace', 'bcd', 'bce']
 * - concatLanguages([['a'], []]) → [] (empty array in input)
 * - concatLanguages([]) → [''] (empty input)
 * 
 * Note that language concatenation !== cartesian product
 * 
 * @param languages Array of string arrays
 * @returns Array of concatenated strings representing all combinations
 */
export function concatLanguages(languages: string[][], currDepth: number = 0): Set<string> {
    // By convention, the empty Cartesian product is defined as a set containing exactly one element: the empty tuple
    if (languages.length === 0) {
        return new Set(['']);
    }
    
    if (languages.length === 1) {
        return new Set(languages[0]);
    }

    // Base case
    if (currDepth === languages.length - 1) return new Set(languages[currDepth]);

    // If one language is empty, the result should be the empty language
    if (languages[currDepth].length === 0) return new Set();

    const subproduct = concatLanguages(languages, currDepth + 1);
    const result: string[] = []
    for (const suffix of subproduct) {
        for (const prefix of languages[currDepth]) {
            result.push(prefix+suffix);
        }
    }
    
    return new Set(result);
}