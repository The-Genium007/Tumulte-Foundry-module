/**
 * Universal Term Extractor
 * Extracts detailed information from Foundry VTT Roll terms
 * Supports all game systems through universal Roll API parsing
 */

import Logger from './logger.js'

/**
 * @typedef {Object} DieResult
 * @property {number} value - The rolled value
 * @property {boolean} active - Whether this result is counted (not dropped/rerolled)
 * @property {boolean} [rerolled] - Whether this die was rerolled
 * @property {boolean} [exploded] - Whether this die exploded
 * @property {boolean} [success] - For pool systems: is this a success?
 * @property {boolean} [failure] - For pool systems: is this a critical failure?
 * @property {boolean} [discarded] - Whether this result was discarded
 */

/**
 * @typedef {Object} TermData
 * @property {'die'|'operator'|'number'|'pool'|'function'|'parenthetical'|'unknown'} type
 * @property {string} [class] - Original Foundry class name
 * @property {number} [faces] - Number of faces (for dice)
 * @property {number} [count] - Number of dice rolled
 * @property {DieResult[]} [results] - Individual die results
 * @property {string[]} [modifiers] - Applied modifiers (kh, kl, r, x, etc.)
 * @property {string} [operator] - Operator symbol (+, -, *, /)
 * @property {number} [value] - Numeric value
 * @property {TermData[][]} [rolls] - Nested rolls (for pools)
 * @property {string} [expression] - Original expression
 * @property {string} [denomination] - Custom die denomination (for exotic dice)
 */

/**
 * @typedef {Object} SymbolResult
 * @property {string} type - Symbol type (success, failure, advantage, threat, triumph, despair, etc.)
 * @property {number} count - Number of this symbol
 * @property {string} [icon] - Display icon/emoji
 */

/**
 * @typedef {Object} SystemData
 * @property {number} [degreeOfSuccess] - PF2e degree of success (0-3)
 * @property {boolean} [isPool] - Is this a dice pool system?
 * @property {number} [poolSuccesses] - Number of successes in pool
 * @property {number} [poolFailures] - Number of failures in pool
 * @property {SymbolResult[]} [symbols] - Narrative dice symbols
 * @property {string} [outcomeType] - System-specific outcome (critical, fumble, etc.)
 * @property {Object} [raw] - Raw system-specific data
 */

/**
 * @typedef {Object} UniversalRollData
 * @property {string} rollId - Unique roll identifier
 * @property {string} characterId - Character/Actor ID
 * @property {string} characterName - Character name
 * @property {string} systemId - Game system ID
 * @property {string} formula - Original roll formula
 * @property {number} total - Final total
 * @property {TermData[]} terms - Extracted term data
 * @property {number[]} diceResults - Flat array of all active die results
 * @property {boolean} isCritical - Whether this is a critical result
 * @property {string|null} criticalType - 'success' or 'failure'
 * @property {boolean} isHidden - Whether this roll is hidden/whispered
 * @property {string|null} rollType - Type of roll (attack, damage, skill, etc.)
 * @property {SystemData} systemData - System-specific metadata
 */

/**
 * Extract universal roll data from a Foundry Roll object
 * @param {Object} message - Foundry ChatMessage
 * @param {Object} roll - Foundry Roll object
 * @returns {UniversalRollData}
 */
export function extractUniversalRollData(message, roll) {
  const systemId = game.system?.id || 'unknown'

  Logger.debug('Extracting universal roll data', {
    systemId,
    formula: roll.formula,
    termsCount: roll.terms?.length
  })

  // Extract all terms
  const terms = extractTerms(roll.terms || [])

  // Extract flat dice results (active only)
  const diceResults = extractFlatDiceResults(terms)

  // Detect system-specific data
  const systemData = extractSystemData(roll, message, systemId)

  // Detect critical status
  const { isCritical, criticalType } = detectCritical(roll, terms, systemId, systemData)

  return {
    terms,
    diceResults,
    systemData,
    isCritical,
    criticalType,
    systemId
  }
}

/**
 * Extract term data recursively from Foundry terms
 * @param {Array} terms - Foundry Roll terms
 * @returns {TermData[]}
 */
function extractTerms(terms) {
  return terms.map(term => extractSingleTerm(term)).filter(Boolean)
}

/**
 * Extract data from a single term
 * @param {Object} term - Foundry RollTerm
 * @returns {TermData|null}
 */
function extractSingleTerm(term) {
  if (!term) return null

  const className = term.constructor?.name || 'Unknown'

  // Die term (most common)
  if (isDieTerm(term)) {
    return extractDieTerm(term, className)
  }

  // Operator term
  if (isOperatorTerm(term)) {
    return {
      type: 'operator',
      class: className,
      operator: term.operator
    }
  }

  // Numeric term
  if (isNumericTerm(term)) {
    return {
      type: 'number',
      class: className,
      value: term.number
    }
  }

  // Pool term
  if (isPoolTerm(term)) {
    return extractPoolTerm(term, className)
  }

  // Parenthetical term
  if (isParentheticalTerm(term)) {
    return extractParentheticalTerm(term, className)
  }

  // Function term
  if (isFunctionTerm(term)) {
    return extractFunctionTerm(term, className)
  }

  // Unknown term - still extract what we can
  Logger.debug('Unknown term type encountered', { className, term })
  return {
    type: 'unknown',
    class: className,
    expression: term.expression || term.formula || String(term)
  }
}

/**
 * Extract Die term data
 * @param {Object} term - Die term
 * @param {string} className - Class name
 * @returns {TermData}
 */
function extractDieTerm(term, className) {
  const results = (term.results || []).map(r => ({
    value: r.result,
    active: r.active !== false, // Default to true if not specified
    rerolled: r.rerolled || false,
    exploded: r.exploded || false,
    success: r.success,
    failure: r.failure,
    discarded: r.discarded || false
  }))

  // Get modifiers
  const modifiers = term.modifiers || []

  // Detect custom denomination for exotic dice
  const denomination = term.constructor?.DENOMINATION || null

  return {
    type: 'die',
    class: className,
    faces: term.faces,
    count: term.number || results.length,
    results,
    modifiers: Array.isArray(modifiers) ? modifiers : [modifiers].filter(Boolean),
    expression: term.expression || `${term.number || 1}d${term.faces}`,
    denomination
  }
}

/**
 * Extract Pool term data
 * @param {Object} term - Pool term
 * @param {string} className - Class name
 * @returns {TermData}
 */
function extractPoolTerm(term, className) {
  // Pool terms contain multiple rolls
  const rolls = (term.rolls || term.terms || []).map(roll => {
    if (roll.terms) {
      return extractTerms(roll.terms)
    }
    return [extractSingleTerm(roll)].filter(Boolean)
  })

  return {
    type: 'pool',
    class: className,
    rolls,
    modifiers: term.modifiers || [],
    results: term.results?.map(r => ({
      value: r.result,
      active: r.active !== false
    })) || []
  }
}

/**
 * Extract Parenthetical term data
 * @param {Object} term - Parenthetical term
 * @param {string} className - Class name
 * @returns {TermData}
 */
function extractParentheticalTerm(term, className) {
  // Parenthetical terms wrap inner terms
  const innerTerms = term.roll?.terms || term.terms || []

  return {
    type: 'parenthetical',
    class: className,
    rolls: [extractTerms(innerTerms)],
    expression: term.expression
  }
}

/**
 * Extract Function term data
 * @param {Object} term - Function term
 * @param {string} className - Class name
 * @returns {TermData}
 */
function extractFunctionTerm(term, className) {
  return {
    type: 'function',
    class: className,
    expression: term.expression || term.formula,
    value: term.total
  }
}

/**
 * Type checking helpers
 */
function isDieTerm(term) {
  const className = term.constructor?.name || ''
  return (
    className === 'Die' ||
    className.endsWith('Die') ||
    className.includes('Dice') ||
    (term.faces !== undefined && term.results !== undefined)
  )
}

function isOperatorTerm(term) {
  const className = term.constructor?.name || ''
  return className === 'OperatorTerm' || term.operator !== undefined
}

function isNumericTerm(term) {
  const className = term.constructor?.name || ''
  return className === 'NumericTerm' || (term.number !== undefined && term.faces === undefined)
}

function isPoolTerm(term) {
  const className = term.constructor?.name || ''
  return className === 'PoolTerm' || className.includes('Pool')
}

function isParentheticalTerm(term) {
  const className = term.constructor?.name || ''
  return className === 'ParentheticalTerm' || className.includes('Parenthetical')
}

function isFunctionTerm(term) {
  const className = term.constructor?.name || ''
  return className === 'FunctionTerm' || className.includes('Function')
}

/**
 * Extract flat array of all active dice results
 * @param {TermData[]} terms - Extracted terms
 * @returns {number[]}
 */
function extractFlatDiceResults(terms) {
  const results = []

  for (const term of terms) {
    if (term.type === 'die' && term.results) {
      for (const r of term.results) {
        if (r.active) {
          results.push(r.value)
        }
      }
    } else if (term.type === 'pool' && term.rolls) {
      for (const roll of term.rolls) {
        results.push(...extractFlatDiceResults(roll))
      }
    } else if (term.type === 'parenthetical' && term.rolls) {
      for (const roll of term.rolls) {
        results.push(...extractFlatDiceResults(roll))
      }
    }
  }

  return results
}

/**
 * Extract system-specific data
 * @param {Object} roll - Foundry Roll
 * @param {Object} message - Foundry ChatMessage
 * @param {string} systemId - Game system ID
 * @returns {SystemData}
 */
function extractSystemData(roll, message, systemId) {
  const systemData = {
    isPool: false,
    raw: {}
  }

  // PF2e degree of success
  if (roll.degreeOfSuccess !== undefined) {
    systemData.degreeOfSuccess = roll.degreeOfSuccess
  }

  // Check for pool-based systems
  if (isPoolBasedSystem(systemId)) {
    systemData.isPool = true
    const poolResults = extractPoolResults(roll, systemId)
    systemData.poolSuccesses = poolResults.successes
    systemData.poolFailures = poolResults.failures
  }

  // Check for narrative dice systems
  if (isNarrativeDiceSystem(systemId)) {
    systemData.symbols = extractNarrativeSymbols(roll, systemId)
  }

  // Store any system-specific roll options
  if (roll.options) {
    systemData.raw = {
      ...systemData.raw,
      options: roll.options
    }
  }

  return systemData
}

/**
 * Check if system uses dice pools
 * @param {string} systemId - System ID
 * @returns {boolean}
 */
function isPoolBasedSystem(systemId) {
  const poolSystems = [
    'wod5e', 'vtm5e', 'wta5e', 'htr5e', // World of Darkness 5e
    'worldofdarkness', 'cod', // Chronicles of Darkness
    'blades-in-the-dark', 'bitd', 'scum-and-villainy',
    'alienrpg', 'myz', 'forbidden-lands', 'coriolis', 'vaesen', 't2k4e', // Year Zero Engine
    'pbta', 'masks', 'monsterhearts', // Powered by the Apocalypse
  ]
  return poolSystems.includes(systemId)
}

/**
 * Check if system uses narrative dice
 * @param {string} systemId - System ID
 * @returns {boolean}
 */
function isNarrativeDiceSystem(systemId) {
  const narrativeSystems = [
    'genesys', 'starwarsffg', 'swffg', // Genesys/FFG
    'l5r', 'l5r5e', // Legend of the Five Rings
  ]
  return narrativeSystems.includes(systemId)
}

/**
 * Extract pool results (successes/failures)
 * @param {Object} roll - Foundry Roll
 * @param {string} systemId - System ID
 * @returns {{successes: number, failures: number}}
 */
function extractPoolResults(roll, systemId) {
  let successes = 0
  let failures = 0

  // Try to get from roll options first (many systems store this)
  if (roll.options?.successes !== undefined) {
    successes = roll.options.successes
  }
  if (roll.options?.failures !== undefined) {
    failures = roll.options.failures
  }

  // Otherwise count from results
  if (successes === 0 && failures === 0) {
    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          if (result.success) successes++
          if (result.failure) failures++
        }
      }
    }
  }

  // System-specific counting
  if (systemId.includes('wod') || systemId.includes('vtm') || systemId.includes('wta') || systemId.includes('htr')) {
    // WoD: 8+ is success on d10
    const threshold = 8
    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          if (result.result >= threshold) successes++
          // 10 is double success in some variants
          if (result.result === 10 && roll.options?.doubleSuccess) successes++
        }
      }
    }
  }

  if (systemId === 'blades-in-the-dark' || systemId === 'bitd') {
    // Blades: highest d6 determines outcome
    // 6 = success, 4-5 = partial, 1-3 = failure
    // Multiple 6s = critical
    let highest = 0
    let sixes = 0
    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result > highest) highest = result.result
          if (result.result === 6) sixes++
        }
      }
    }

    if (sixes >= 2) {
      successes = 2 // Critical
    } else if (highest === 6) {
      successes = 1 // Full success
    } else if (highest >= 4) {
      successes = 0 // Partial (not a failure, not a full success)
      failures = 0
    } else {
      failures = 1 // Failure
    }
  }

  return { successes, failures }
}

/**
 * Extract narrative dice symbols
 * @param {Object} roll - Foundry Roll
 * @param {string} systemId - System ID
 * @returns {SymbolResult[]}
 */
function extractNarrativeSymbols(roll, systemId) {
  const symbols = []

  // Genesys/Star Wars FFG symbol types
  const genesysSymbols = {
    success: { icon: '⚔️', count: 0 },
    failure: { icon: '✖️', count: 0 },
    advantage: { icon: '🔷', count: 0 },
    threat: { icon: '⬛', count: 0 },
    triumph: { icon: '⭐', count: 0 },
    despair: { icon: '💀', count: 0 }
  }

  // Try to extract from roll options or results
  if (roll.options?.symbols) {
    return roll.options.symbols
  }

  // Parse from term results if available
  for (const term of roll.terms || []) {
    if (term.results) {
      for (const result of term.results) {
        // Some systems store symbol data in results
        if (result.symbols) {
          for (const sym of result.symbols) {
            const existing = symbols.find(s => s.type === sym.type)
            if (existing) {
              existing.count += sym.count || 1
            } else {
              symbols.push({ type: sym.type, icon: sym.icon, count: sym.count || 1 })
            }
          }
        }
      }
    }
  }

  // Filter out zero counts
  return symbols.filter(s => s.count > 0)
}

/**
 * Detect critical status
 * @param {Object} roll - Foundry Roll
 * @param {TermData[]} terms - Extracted terms
 * @param {string} systemId - System ID
 * @param {SystemData} systemData - Extracted system data
 * @returns {{isCritical: boolean, criticalType: string|null}}
 */
function detectCritical(roll, terms, systemId, systemData) {
  // PF2e: Use degree of success
  if (systemData.degreeOfSuccess !== undefined) {
    if (systemData.degreeOfSuccess === 3) {
      return { isCritical: true, criticalType: 'success' }
    }
    if (systemData.degreeOfSuccess === 0) {
      return { isCritical: true, criticalType: 'failure' }
    }
  }

  // D&D 5e style: Natural 20 or 1 on d20
  if (systemId === 'dnd5e' || !isPoolBasedSystem(systemId)) {
    // Check roll options for custom critical threshold
    const critThreshold = roll.options?.critical || 20
    const fumbleThreshold = roll.options?.fumble || 1

    for (const term of terms) {
      if (term.type === 'die' && term.faces === 20) {
        for (const result of term.results || []) {
          if (result.active) {
            if (result.value >= critThreshold) {
              return { isCritical: true, criticalType: 'success' }
            }
            if (result.value <= fumbleThreshold) {
              return { isCritical: true, criticalType: 'failure' }
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
      let sixes = 0
      for (const term of terms) {
        if (term.type === 'die' && term.faces === 6) {
          for (const result of term.results || []) {
            if (result.value === 6) sixes++
          }
        }
      }
      if (sixes >= 2) {
        return { isCritical: true, criticalType: 'success' }
      }
    }

    // WoD: Multiple 10s or all 1s
    if (systemId.includes('wod') || systemId.includes('vtm')) {
      let tens = 0
      let ones = 0
      let total = 0
      for (const term of terms) {
        if (term.type === 'die' && term.faces === 10) {
          for (const result of term.results || []) {
            total++
            if (result.value === 10) tens++
            if (result.value === 1) ones++
          }
        }
      }
      if (tens >= 2) {
        return { isCritical: true, criticalType: 'success' }
      }
      if (ones === total && total > 0) {
        return { isCritical: true, criticalType: 'failure' }
      }
    }
  }

  return { isCritical: false, criticalType: null }
}

export default {
  extractUniversalRollData,
  extractTerms,
  extractFlatDiceResults,
  isPoolBasedSystem,
  isNarrativeDiceSystem
}
