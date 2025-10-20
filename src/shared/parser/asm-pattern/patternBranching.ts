import { hasBranching } from "./patternUtils";
import { compareSimplePatterns, parseSimplePattern, SimplePattern } from "./simplePattern";

/**
 * Parses a pattern with optional branches (separated by |), splits it into simple patterns and validates it.
 * 
 * Rules:
 * - Each branch can only contain literals and placeholders
 * - No nested branching (no [] within branches)
 * - No two branches should have the same set of placeholders
 * - At most one branch can have no placeholders
 * 
 * @param pattern The pattern with optional branches
 * @returns ParsePatternResult with success status, error message, branches, and placeholders
 */
export function parseBranches(pattern: string): 
    | { ok: false, error: string }
    | { ok: true, branches: SimplePattern[], placeholders: Set<string> }
{
    // 1. Check for escaped pipes (which should be treated as literals)
    // Temporarily replace them to avoid splitting on them
    const tempPattern = pattern.replace(/\\\|/g, '__PIPE__');
    
    // 2. Split on unescaped | to get branches
    const branches = tempPattern
        .split('|')
        .map(branch => branch.replace(/__PIPE__/g, '\\|'));
    
    // 3. Validate each branch and convert them to simple patterns 
    const branchSimplePatterns: SimplePattern[] = [];
    for (const branch of branches) {
        
        // Ensure no unescaped [ and ] inside each branch
        // eg. [ ld hl | [ add hl | push af ] ] is not allowed
        if (hasBranching(branch)) {
            return {
                ok: false,
                error: `Branch "${branch}" contains unescaped square brackets. Use \\[ and \\] for literal brackets.`,
            }
        }

        const r = parseSimplePattern(branch);
        if (!r.ok) return { ok: false, error: r.error };

        branchSimplePatterns.push(r.simplePattern);
    }

    // 4. Validate branches one against the others
    const error = validateBranches(branchSimplePatterns);
    if (error) return { ok: false, error };

    // 5. Collect all unique placeholders across all branches
    const uniquePlaceholders = new Set<string>();
    for (const b of branchSimplePatterns) {
        b.placeholderNames.forEach(pl => uniquePlaceholders.add(pl));
    }

    return { ok: true, branches: branchSimplePatterns, placeholders: uniquePlaceholders };
}

/**
 * Validates the subpatterns of a branching pattern 
 *  
 * Rules:
 * - Each branch is a SimplePattern: only contains literals and placeholders
 * - No two branches should have the same set of named placeholders
 * - At most one branch with no placeholders or only empty placeholders
 * - No two branches can be equivalent
 * 
 * @param pattern The pattern with optional branches
 * @returns ParsePatternResult with success status, error message, branches, and placeholders
 */
export function validateBranches(branches: SimplePattern[]): string | undefined {
    
    // Store sorted placeholder arrays for value-based comparison
    const branchesPlaceholders: string[][] = [];
    let hasBranchWithNoPlaceholders = false;

    // Check for duplicate placeholder sets across branches and multiple branches with no placeholders
    for (const branch of branches) {

        const sortedPlaceholders = [...branch.placeholderNames].sort();

        // Multiple branches with no placeholder?
        if (hasBranchWithNoPlaceholders && sortedPlaceholders.length === 0) {
            return `Multiple branches with no placeholders in branching [${branches.map(b=>b.pattern).join('|')}]`;
        }
        hasBranchWithNoPlaceholders = sortedPlaceholders.length === 0;

        // Check if this set of placeholders already exists (value-based comparison)
        const isDuplicate = branchesPlaceholders.some(existing => {
            if (existing.length !== sortedPlaceholders.length) return false;
            return existing.every((placeholder, index) => placeholder === sortedPlaceholders[index]);
        });
        
        if (isDuplicate) {
            return `Multiple branches have the same set of placeholders: [${sortedPlaceholders.join(', ')}]`;
        }
        
        branchesPlaceholders.push(sortedPlaceholders);
    }

    // Check for equivalent branches
    for (let i = 0; i < branches.length; i++) {
        for (let j = (i + 1); j < branches.length; j++) {
            const br1 = branches[i];
            const br2 = branches[j];
            if (compareSimplePatterns(br1, br2)) {
                return `Branches ${br1.pattern} and ${br2.pattern} are equivalent`;
            }
        }
    }
}