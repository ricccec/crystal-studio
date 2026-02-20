import { concatLanguages } from "@shared/utils/languageProduct";
import { parseAsmPattern, AsmPattern } from "../../asm-pattern/asmPattern";
import { parseBranches, validateBranches } from "./patternBranching";
import { splitPattern } from "./patternSplitter";

/**
 * Parses a pattern with optional branches ([...] and |) into an array of simple patterns.
 * 
 * Process:
 * 1. Split the pattern by unescaped brackets [...] to get subpatterns
 * 2. For each subpattern, parse branches separated by |
 * 3. Compute the Cartesian product of all branch combinations
 * 4. Return the resulting simple patterns
 * 
 * @param pattern The pattern string with optional brackets and pipes
 * @returns Array of SimplePattern objects, or throws an error if parsing fails
 */
export function parsePattern(pattern: string): AsmPattern[] {
    
    // Step 1: Split by brackets to get subpatterns
    const splitResult = splitPattern(pattern);
    if (!splitResult.ok) {
        throw new Error(`Pattern parsing failed: ${splitResult.error}`);
    }
    
    const { subpatterns } = splitResult;
    
    // Step 2: Parse each subpattern to get branches
    const allBranchSets: AsmPattern[][] = [];
    
    for (const subpattern of subpatterns) {
        const branchResult = parseBranches(subpattern);
        if (!branchResult.ok) {
            throw new Error(`Branch parsing failed for "${subpattern}": ${branchResult.error}`);
        }
        
        allBranchSets.push(branchResult.branches);
    }
    
    // Step 3: Compute language product of branches
    // Convert SimplePattern[] to string[] for each branch set
    const branchStrings: string[][] = allBranchSets.map(branches =>
        branches.map(branch => branch.pattern)
    );
    
    // Get all combinations
    const combinations = concatLanguages(branchStrings);
    
    // Step 4: Parse each combination back to SimplePattern
	// TODO remove any escaped chars?
    const result: AsmPattern[] = [];
    for (const combination of combinations) {
        const parseResult = parseAsmPattern(combination);
        if (!parseResult.ok) {
            throw new Error(`Failed to parse combination "${combination}": ${parseResult.error}`);
        }    
        result.push(parseResult.simplePattern);
    }

    // Step 5: validate language
    const err = validateBranches(result);
    if (err) throw new Error(`Failed to validate pattern ${pattern}: ${err}`);
    
    return result;
}

