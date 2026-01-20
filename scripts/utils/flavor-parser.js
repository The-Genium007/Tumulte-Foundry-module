/**
 * Flavor Parser for Foundry VTT Dice Rolls
 *
 * Extracts structured information (skill, ability, roll type, modifiers)
 * from flavor text across different RPG systems and languages.
 */

import { getSystemMappings } from './localization-mappings.js'
import Logger from './logger.js'

/**
 * Universal patterns for detecting common roll elements
 * These work across multiple systems as fallbacks
 */
const UNIVERSAL_PATTERNS = {
  // Patterns for skill/ability detection
  // "Skill Check: Perception" or "Perception Check" or "Test de Perception"
  skillCheck: [
    /(?:skill\s*check|test\s*de\s*compétence|check|test)[\s:]+(\w[\w\s]*?)(?:\s*\(|$|\s*-|\s*:)/i,
    /(\w[\w\s]*?)\s+(?:check|test|roll|jet)/i
  ],

  // "Saving Throw: Dexterity" or "Dexterity Save" or "Jet de sauvegarde"
  savingThrow: [
    /(?:saving\s*throw|jet\s*de\s*sauvegarde|save)[\s:]+(\w+)/i,
    /(\w+)\s+(?:save|saving\s*throw)/i
  ],

  // Modifier patterns: "+2 bonus" or "-1 penalty" or "(+3)"
  modifier: /([+-]\d+)(?:\s*(?:bonus|penalty|malus|modifier))?/gi,

  // Parenthetical info: "(Dexterity)" or "(Force)"
  parenthetical: /\(([^)]+)\)/g,

  // Colon-separated: "Acrobatics: " at the start
  colonSeparated: /^([^:]+):/
}

/**
 * FlavorParser class for parsing dice roll flavor text
 */
export class FlavorParser {
  /**
   * @param {string} systemId - Foundry system ID (e.g., 'dnd5e', 'pf2e')
   * @param {string} language - Language code (e.g., 'en', 'fr')
   */
  constructor(systemId, language = 'en') {
    this.systemId = systemId
    this.language = language
    this.mappings = getSystemMappings(systemId, language)

    Logger.debug('FlavorParser initialized', {
      systemId,
      language,
      hasSkills: Object.keys(this.mappings.skills || {}).length,
      hasAbilities: Object.keys(this.mappings.abilities || {}).length,
      hasRollTypes: Object.keys(this.mappings.rollTypes || {}).length
    })
  }

  /**
   * Parse flavor text and extract structured information
   * @param {string} flavorText - Raw flavor text from the dice roll
   * @returns {Object} Parsed flavor data
   */
  parse(flavorText) {
    const result = {
      skill: null,           // Normalized skill key
      skillRaw: null,        // Raw skill name (for display)
      ability: null,         // Normalized ability key
      abilityRaw: null,      // Raw ability name (for display)
      rollType: null,        // Normalized roll type
      rollTypeRaw: null,     // Raw roll type (for display)
      modifiers: [],         // Detected modifiers array
      rawFlavor: flavorText, // Original flavor text
      confidence: 0          // Confidence score (0-100)
    }

    if (!flavorText || typeof flavorText !== 'string') {
      return result
    }

    const lowerFlavor = flavorText.toLowerCase().trim()

    // 1. Detect roll type first (most specific)
    const rollTypeMatch = this.detectRollType(lowerFlavor)
    if (rollTypeMatch) {
      result.rollType = rollTypeMatch.normalized
      result.rollTypeRaw = rollTypeMatch.raw
      result.confidence += 30
    }

    // 2. Extract skill
    const skillMatch = this.extractSkill(lowerFlavor, flavorText)
    if (skillMatch) {
      result.skill = skillMatch.normalized
      result.skillRaw = skillMatch.raw
      result.confidence += 40
    }

    // 3. Extract ability
    const abilityMatch = this.extractAbility(lowerFlavor, flavorText)
    if (abilityMatch) {
      result.ability = abilityMatch.normalized
      result.abilityRaw = abilityMatch.raw
      result.confidence += 20
    }

    // 4. Extract modifiers
    result.modifiers = this.extractModifiers(flavorText)
    if (result.modifiers.length > 0) {
      result.confidence += 10
    }

    // Cap confidence at 100
    result.confidence = Math.min(result.confidence, 100)

    Logger.debug('Flavor parsed', {
      input: flavorText,
      result: {
        skill: result.skill,
        ability: result.ability,
        rollType: result.rollType,
        modifiers: result.modifiers,
        confidence: result.confidence
      }
    })

    return result
  }

  /**
   * Detect roll type from flavor text
   * @param {string} lowerFlavor - Lowercase flavor text
   * @returns {Object|null} { normalized, raw } or null
   */
  detectRollType(lowerFlavor) {
    const rollTypes = this.mappings.rollTypes || {}

    // Try to match against known roll types (longest match first)
    const sortedPatterns = Object.keys(rollTypes).sort((a, b) => b.length - a.length)

    for (const pattern of sortedPatterns) {
      if (lowerFlavor.includes(pattern)) {
        return {
          normalized: rollTypes[pattern],
          raw: this.capitalizeFirst(pattern)
        }
      }
    }

    return null
  }

  /**
   * Extract skill from flavor text
   * @param {string} lowerFlavor - Lowercase flavor text
   * @param {string} originalFlavor - Original case flavor text
   * @returns {Object|null} { normalized, raw } or null
   */
  extractSkill(lowerFlavor, originalFlavor) {
    const skills = this.mappings.skills || {}

    // 1. Direct match against known skills (longest match first)
    const sortedSkills = Object.keys(skills).sort((a, b) => b.length - a.length)

    for (const skillName of sortedSkills) {
      if (lowerFlavor.includes(skillName)) {
        // Try to extract the original case version
        const rawMatch = this.findOriginalCase(originalFlavor, skillName)
        return {
          normalized: skills[skillName],
          raw: rawMatch || this.capitalizeFirst(skillName)
        }
      }
    }

    // 2. Try universal patterns
    for (const pattern of UNIVERSAL_PATTERNS.skillCheck) {
      const match = lowerFlavor.match(pattern)
      if (match && match[1]) {
        const potentialSkill = match[1].trim().toLowerCase()
        if (skills[potentialSkill]) {
          return {
            normalized: skills[potentialSkill],
            raw: this.capitalizeFirst(match[1].trim())
          }
        }
      }
    }

    // 3. Check parenthetical content
    const parentheticals = originalFlavor.match(UNIVERSAL_PATTERNS.parenthetical)
    if (parentheticals) {
      for (const paren of parentheticals) {
        const content = paren.slice(1, -1).toLowerCase().trim()
        if (skills[content]) {
          return {
            normalized: skills[content],
            raw: paren.slice(1, -1).trim()
          }
        }
      }
    }

    // 4. Check colon-separated format
    const colonMatch = originalFlavor.match(UNIVERSAL_PATTERNS.colonSeparated)
    if (colonMatch && colonMatch[1]) {
      const potentialSkill = colonMatch[1].trim().toLowerCase()
      if (skills[potentialSkill]) {
        return {
          normalized: skills[potentialSkill],
          raw: colonMatch[1].trim()
        }
      }
    }

    return null
  }

  /**
   * Extract ability from flavor text
   * @param {string} lowerFlavor - Lowercase flavor text
   * @param {string} originalFlavor - Original case flavor text
   * @returns {Object|null} { normalized, raw } or null
   */
  extractAbility(lowerFlavor, originalFlavor) {
    const abilities = this.mappings.abilities || {}

    // 1. Check parenthetical content first (common pattern: "Acrobatics (Dexterity)")
    const parentheticals = originalFlavor.match(UNIVERSAL_PATTERNS.parenthetical)
    if (parentheticals) {
      for (const paren of parentheticals) {
        const content = paren.slice(1, -1).toLowerCase().trim()
        if (abilities[content]) {
          return {
            normalized: abilities[content],
            raw: paren.slice(1, -1).trim()
          }
        }
      }
    }

    // 2. Try saving throw patterns
    for (const pattern of UNIVERSAL_PATTERNS.savingThrow) {
      const match = lowerFlavor.match(pattern)
      if (match && match[1]) {
        const potentialAbility = match[1].trim().toLowerCase()
        if (abilities[potentialAbility]) {
          return {
            normalized: abilities[potentialAbility],
            raw: this.capitalizeFirst(match[1].trim())
          }
        }
      }
    }

    // 3. Direct match against known abilities (but avoid false positives)
    // Only match if the ability name appears as a standalone word
    for (const [abilityName, normalizedKey] of Object.entries(abilities)) {
      // Skip very short abbreviations to avoid false matches
      if (abilityName.length <= 2) continue

      const regex = new RegExp(`\\b${this.escapeRegex(abilityName)}\\b`, 'i')
      if (regex.test(lowerFlavor)) {
        const rawMatch = this.findOriginalCase(originalFlavor, abilityName)
        return {
          normalized: normalizedKey,
          raw: rawMatch || this.capitalizeFirst(abilityName)
        }
      }
    }

    return null
  }

  /**
   * Extract modifiers from flavor text
   * @param {string} flavorText - Original flavor text
   * @returns {string[]} Array of modifier strings (e.g., ["+2", "-1"])
   */
  extractModifiers(flavorText) {
    const modifiers = []
    const matches = flavorText.matchAll(UNIVERSAL_PATTERNS.modifier)

    for (const match of matches) {
      if (match[1] && !modifiers.includes(match[1])) {
        modifiers.push(match[1])
      }
    }

    return modifiers
  }

  /**
   * Find the original case version of a word in the text
   * @param {string} text - Original text
   * @param {string} word - Word to find (lowercase)
   * @returns {string|null} Original case version or null
   */
  findOriginalCase(text, word) {
    const regex = new RegExp(`\\b(${this.escapeRegex(word)})\\b`, 'i')
    const match = text.match(regex)
    return match ? match[1] : null
  }

  /**
   * Capitalize first letter of a string
   * @param {string} str - Input string
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Escape special regex characters
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

/**
 * Create a FlavorParser instance for the current game
 * @returns {FlavorParser} Parser instance
 */
export function createFlavorParser() {
  const systemId = game?.system?.id || 'generic'
  const language = game?.i18n?.lang || 'en'

  Logger.info('Creating FlavorParser', { systemId, language })

  return new FlavorParser(systemId, language)
}

export default FlavorParser
