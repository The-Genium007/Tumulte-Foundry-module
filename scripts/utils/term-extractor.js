/**
 * Universal Term Extractor
 * Extracts detailed information from Foundry VTT Roll terms
 * Supports all game systems through universal Roll API parsing
 */
import Logger from './logger.js';
// ─── Main Export ──────────────────────────────────────────────────────────────
/**
 * Extract universal roll data from a Foundry Roll object
 */
export function extractUniversalRollData(message, roll) {
    const systemId = game.system?.id || 'unknown';
    Logger.debug('Extracting universal roll data', {
        systemId,
        formula: roll.formula,
        termsCount: roll.terms?.length
    });
    // Extract all terms
    const terms = extractTerms(roll.terms || []);
    // Extract flat dice results (active only)
    const diceResults = extractFlatDiceResults(terms);
    // Detect system-specific data
    const systemData = extractSystemData(roll, message, systemId);
    // Detect critical status
    const { isCritical, criticalType } = detectCritical(roll, terms, systemId, systemData);
    return {
        terms,
        diceResults,
        systemData,
        isCritical,
        criticalType,
        systemId
    };
}
/**
 * Extract term data recursively from Foundry terms
 */
function extractTerms(terms) {
    return terms.map(term => extractSingleTerm(term)).filter((t) => t !== null);
}
/**
 * Extract data from a single term
 */
function extractSingleTerm(term) {
    if (!term)
        return null;
    const extTerm = term;
    const className = extTerm.constructor?.name || 'Unknown';
    // Die term (most common)
    if (isDieTerm(extTerm)) {
        return extractDieTerm(extTerm, className);
    }
    // Operator term
    if (isOperatorTerm(extTerm)) {
        return {
            type: 'operator',
            class: className,
            operator: extTerm.operator
        };
    }
    // Numeric term
    if (isNumericTerm(extTerm)) {
        return {
            type: 'number',
            class: className,
            value: extTerm.number
        };
    }
    // Pool term
    if (isPoolTerm(extTerm)) {
        return extractPoolTerm(extTerm, className);
    }
    // Parenthetical term
    if (isParentheticalTerm(extTerm)) {
        return extractParentheticalTerm(extTerm, className);
    }
    // Function term
    if (isFunctionTerm(extTerm)) {
        return extractFunctionTerm(extTerm, className);
    }
    // Unknown term - still extract what we can
    Logger.debug('Unknown term type encountered', { className, term });
    return {
        type: 'unknown',
        class: className,
        expression: extTerm.expression || extTerm.formula || String(term)
    };
}
/**
 * Extract Die term data
 */
function extractDieTerm(term, className) {
    const results = (term.results || []).map((r) => {
        const extR = r;
        return {
            value: extR.result,
            active: extR.active !== false, // Default to true if not specified
            rerolled: extR.rerolled || false,
            exploded: extR.exploded || false,
            success: extR.success,
            failure: extR.failure,
            discarded: extR.discarded || false
        };
    });
    // Get modifiers
    const modifiers = term.modifiers || [];
    // Detect custom denomination for exotic dice
    const denomination = term.constructor?.DENOMINATION || null;
    return {
        type: 'die',
        class: className,
        faces: term.faces,
        count: term.number || results.length,
        results,
        modifiers: Array.isArray(modifiers) ? modifiers : [modifiers].filter(Boolean),
        expression: term.expression || `${term.number || 1}d${term.faces}`,
        denomination
    };
}
/**
 * Extract Pool term data
 */
function extractPoolTerm(term, className) {
    // Pool terms contain multiple rolls
    const rolls = (term.rolls || term.terms || []).map((roll) => {
        const rollAny = roll;
        if (rollAny.terms) {
            return extractTerms(rollAny.terms);
        }
        const single = extractSingleTerm(roll);
        return single ? [single] : [];
    });
    return {
        type: 'pool',
        class: className,
        rolls,
        modifiers: (Array.isArray(term.modifiers) ? term.modifiers : []),
        results: term.results?.map((r) => ({
            value: r.result,
            active: r.active !== false,
            rerolled: false,
            exploded: false,
            success: undefined,
            failure: undefined,
            discarded: false
        })) || []
    };
}
/**
 * Extract Parenthetical term data
 */
function extractParentheticalTerm(term, className) {
    // Parenthetical terms wrap inner terms
    const innerTerms = term.roll?.terms || term.terms || [];
    return {
        type: 'parenthetical',
        class: className,
        rolls: [extractTerms(innerTerms)],
        expression: term.expression
    };
}
/**
 * Extract Function term data
 */
function extractFunctionTerm(term, className) {
    return {
        type: 'function',
        class: className,
        expression: term.expression || term.formula,
        value: term.total
    };
}
/**
 * Type checking helpers
 */
function isDieTerm(term) {
    const className = term.constructor?.name || '';
    return (className === 'Die' ||
        className.endsWith('Die') ||
        className.includes('Dice') ||
        (term.faces !== undefined && term.results !== undefined));
}
function isOperatorTerm(term) {
    const className = term.constructor?.name || '';
    return className === 'OperatorTerm' || term.operator !== undefined;
}
function isNumericTerm(term) {
    const className = term.constructor?.name || '';
    return className === 'NumericTerm' || (term.number !== undefined && term.faces === undefined);
}
function isPoolTerm(term) {
    const className = term.constructor?.name || '';
    return className === 'PoolTerm' || className.includes('Pool');
}
function isParentheticalTerm(term) {
    const className = term.constructor?.name || '';
    return className === 'ParentheticalTerm' || className.includes('Parenthetical');
}
function isFunctionTerm(term) {
    const className = term.constructor?.name || '';
    return className === 'FunctionTerm' || className.includes('Function');
}
/**
 * Extract flat array of all active dice results
 */
function extractFlatDiceResults(terms) {
    const results = [];
    for (const term of terms) {
        if (term.type === 'die' && term.results) {
            for (const r of term.results) {
                if (r.active) {
                    results.push(r.value);
                }
            }
        }
        else if (term.type === 'pool' && term.rolls) {
            for (const roll of term.rolls) {
                results.push(...extractFlatDiceResults(roll));
            }
        }
        else if (term.type === 'parenthetical' && term.rolls) {
            for (const roll of term.rolls) {
                results.push(...extractFlatDiceResults(roll));
            }
        }
    }
    return results;
}
/**
 * Extract system-specific data
 */
function extractSystemData(roll, _message, systemId) {
    const systemData = {
        isPool: false,
        raw: {}
    };
    // PF2e degree of success
    if (roll.degreeOfSuccess !== undefined) {
        systemData.degreeOfSuccess = roll.degreeOfSuccess;
    }
    // Check for pool-based systems
    if (isPoolBasedSystem(systemId)) {
        systemData.isPool = true;
        const poolResults = extractPoolResults(roll, systemId);
        systemData.poolSuccesses = poolResults.successes;
        systemData.poolFailures = poolResults.failures;
    }
    // Check for narrative dice systems
    if (isNarrativeDiceSystem(systemId)) {
        systemData.symbols = extractNarrativeSymbols(roll, systemId);
    }
    // Store any system-specific roll options
    if (roll.options) {
        systemData.raw = {
            ...systemData.raw,
            options: roll.options
        };
    }
    return systemData;
}
/**
 * Check if system uses dice pools
 */
function isPoolBasedSystem(systemId) {
    const poolSystems = [
        'wod5e', 'vtm5e', 'wta5e', 'htr5e', // World of Darkness 5e
        'worldofdarkness', 'cod', // Chronicles of Darkness
        'blades-in-the-dark', 'bitd', 'scum-and-villainy',
        'alienrpg', 'myz', 'forbidden-lands', 'coriolis', 'vaesen', 't2k4e', // Year Zero Engine
        'pbta', 'masks', 'monsterhearts', // Powered by the Apocalypse
    ];
    return poolSystems.includes(systemId);
}
/**
 * Check if system uses narrative dice
 */
function isNarrativeDiceSystem(systemId) {
    const narrativeSystems = [
        'genesys', 'starwarsffg', 'swffg', // Genesys/FFG
        'l5r', 'l5r5e', // Legend of the Five Rings
    ];
    return narrativeSystems.includes(systemId);
}
/**
 * Extract pool results (successes/failures)
 */
function extractPoolResults(roll, systemId) {
    let successes = 0;
    let failures = 0;
    // Try to get from roll options first (many systems store this)
    if (roll.options?.successes !== undefined) {
        successes = roll.options.successes;
    }
    if (roll.options?.failures !== undefined) {
        failures = roll.options.failures;
    }
    // Otherwise count from results
    if (successes === 0 && failures === 0) {
        for (const term of roll.terms || []) {
            if (term.results) {
                for (const result of term.results) {
                    const extResult = result;
                    if (extResult.success)
                        successes++;
                    if (extResult.failure)
                        failures++;
                }
            }
        }
    }
    // System-specific counting
    if (systemId.includes('wod') || systemId.includes('vtm') || systemId.includes('wta') || systemId.includes('htr')) {
        // WoD: 8+ is success on d10
        const threshold = 8;
        for (const term of roll.terms || []) {
            if (term.faces === 10 && term.results) {
                for (const result of term.results) {
                    if (result.result >= threshold)
                        successes++;
                    // 10 is double success in some variants
                    if (result.result === 10 && roll.options?.doubleSuccess)
                        successes++;
                }
            }
        }
    }
    if (systemId === 'blades-in-the-dark' || systemId === 'bitd') {
        // Blades: highest d6 determines outcome
        // 6 = success, 4-5 = partial, 1-3 = failure
        // Multiple 6s = critical
        let highest = 0;
        let sixes = 0;
        for (const term of roll.terms || []) {
            if (term.faces === 6 && term.results) {
                for (const result of term.results) {
                    if (result.result > highest)
                        highest = result.result;
                    if (result.result === 6)
                        sixes++;
                }
            }
        }
        if (sixes >= 2) {
            successes = 2; // Critical
        }
        else if (highest === 6) {
            successes = 1; // Full success
        }
        else if (highest >= 4) {
            successes = 0; // Partial (not a failure, not a full success)
            failures = 0;
        }
        else {
            failures = 1; // Failure
        }
    }
    return { successes, failures };
}
/**
 * Extract narrative dice symbols
 */
function extractNarrativeSymbols(roll, _systemId) {
    const symbols = [];
    // Try to extract from roll options or results
    if (roll.options?.symbols) {
        return roll.options.symbols;
    }
    // Parse from term results if available
    for (const term of roll.terms || []) {
        if (term.results) {
            for (const result of term.results) {
                const extResult = result;
                // Some systems store symbol data in results
                if (extResult.symbols) {
                    for (const sym of extResult.symbols) {
                        const existing = symbols.find(s => s.type === sym.type);
                        if (existing) {
                            existing.count += sym.count || 1;
                        }
                        else {
                            symbols.push({ type: sym.type, icon: sym.icon, count: sym.count || 1 });
                        }
                    }
                }
            }
        }
    }
    // Filter out zero counts
    return symbols.filter(s => s.count > 0);
}
/**
 * Detect critical status
 */
function detectCritical(roll, terms, systemId, systemData) {
    // PF2e: Use degree of success
    if (systemData.degreeOfSuccess !== undefined) {
        if (systemData.degreeOfSuccess === 3) {
            return { isCritical: true, criticalType: 'success' };
        }
        if (systemData.degreeOfSuccess === 0) {
            return { isCritical: true, criticalType: 'failure' };
        }
    }
    // D&D 5e style: Natural 20 or 1 on d20
    if (systemId === 'dnd5e' || !isPoolBasedSystem(systemId)) {
        // Check roll options for custom critical threshold
        const critThreshold = roll.options?.critical || 20;
        const fumbleThreshold = roll.options?.fumble || 1;
        for (const term of terms) {
            if (term.type === 'die' && term.faces === 20) {
                for (const result of term.results || []) {
                    if (result.active) {
                        if (result.value >= critThreshold) {
                            return { isCritical: true, criticalType: 'success' };
                        }
                        if (result.value <= fumbleThreshold) {
                            return { isCritical: true, criticalType: 'failure' };
                        }
                    }
                }
            }
        }
    }
    // Pool systems: Check for critical results
    if (systemData.isPool) {
        // Blades: Two 6s = critical
        if (systemId === 'blades-in-the-dark' || systemId === 'bitd') {
            let sixes = 0;
            for (const term of terms) {
                if (term.type === 'die' && term.faces === 6) {
                    for (const result of term.results || []) {
                        if (result.value === 6)
                            sixes++;
                    }
                }
            }
            if (sixes >= 2) {
                return { isCritical: true, criticalType: 'success' };
            }
        }
        // WoD: Multiple 10s or all 1s
        if (systemId.includes('wod') || systemId.includes('vtm')) {
            let tens = 0;
            let ones = 0;
            let total = 0;
            for (const term of terms) {
                if (term.type === 'die' && term.faces === 10) {
                    for (const result of term.results || []) {
                        total++;
                        if (result.value === 10)
                            tens++;
                        if (result.value === 1)
                            ones++;
                    }
                }
            }
            if (tens >= 2) {
                return { isCritical: true, criticalType: 'success' };
            }
            if (ones === total && total > 0) {
                return { isCritical: true, criticalType: 'failure' };
            }
        }
    }
    return { isCritical: false, criticalType: null };
}
export default {
    extractUniversalRollData,
    extractTerms,
    extractFlatDiceResults,
    isPoolBasedSystem,
    isNarrativeDiceSystem
};
//# sourceMappingURL=term-extractor.js.map