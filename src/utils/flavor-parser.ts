/**
 * Flavor Parser for Foundry VTT Dice Rolls
 *
 * Extracts structured information (skill, ability, roll type, modifiers)
 * from flavor text across different RPG systems and languages.
 */

import { getSystemMappings } from './localization-mappings.js'
import type { LanguageMappings } from './localization-mappings.js'
import Logger from './logger.js'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of matching a localized name to a normalized key */
interface MatchResult {
  normalized: string
  raw: string
}

/** Parsed flavor data returned by FlavorParser.parse() */
export interface ParsedFlavor {
  skill: string | null
  skillRaw: string | null
  ability: string | null
  abilityRaw: string | null
  rollType: string | null
  rollTypeRaw: string | null
  modifiers: string[]
  rawFlavor: string
  confidence: number
}

/** Universal patterns for detecting common roll elements */
interface UniversalPatterns {
  skillCheck: RegExp[]
  savingThrow: RegExp[]
  modifier: RegExp
  parenthetical: RegExp
  colonSeparated: RegExp
}

/**
 * Universal patterns for detecting common roll elements
 * These work across multiple systems as fallbacks
 */
const UNIVERSAL_PATTERNS: UniversalPatterns = {
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
  private systemId: string
  private language: string
  private mappings: LanguageMappings

  /**
   * @param systemId - Foundry system ID (e.g., 'dnd5e', 'pf2e')
   * @param language - Language code (e.g., 'en', 'fr')
   */
  constructor(systemId: string, language: string = 'en') {
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
   * @param flavorText - Raw flavor text from the dice roll
   * @returns Parsed flavor data
   */
  parse(flavorText: string): ParsedFlavor {
    const result: ParsedFlavor = {
      skill: null,
      skillRaw: null,
      ability: null,
      abilityRaw: null,
      rollType: null,
      rollTypeRaw: null,
      modifiers: [],
      rawFlavor: flavorText,
      confidence: 0
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
   * @param lowerFlavor - Lowercase flavor text
   * @returns Match result or null
   */
  private detectRollType(lowerFlavor: string): MatchResult | null {
    const rollTypes = this.mappings.rollTypes || {}

    // Try to match against known roll types (longest match first)
    const sortedPatterns = Object.keys(rollTypes).sort((a, b) => b.length - a.length)

    for (const pattern of sortedPatterns) {
      if (lowerFlavor.includes(pattern)) {
        return {
          normalized: rollTypes[pattern]!,
          raw: this.capitalizeFirst(pattern)
        }
      }
    }

    return null
  }

  /**
   * Extract skill from flavor text
   * @param lowerFlavor - Lowercase flavor text
   * @param originalFlavor - Original case flavor text
   * @returns Match result or null
   */
  private extractSkill(lowerFlavor: string, originalFlavor: string): MatchResult | null {
    const skills = this.mappings.skills || {}

    // 1. Direct match against known skills (longest match first)
    const sortedSkills = Object.keys(skills).sort((a, b) => b.length - a.length)

    for (const skillName of sortedSkills) {
      if (lowerFlavor.includes(skillName)) {
        // Try to extract the original case version
        const rawMatch = this.findOriginalCase(originalFlavor, skillName)
        return {
          normalized: skills[skillName]!,
          raw: rawMatch || this.capitalizeFirst(skillName)
        }
      }
    }

    // 2. Try universal patterns
    for (const pattern of UNIVERSAL_PATTERNS.skillCheck) {
      const match = lowerFlavor.match(pattern)
      if (match?.[1]) {
        const potentialSkill = match[1].trim().toLowerCase()
        if (skills[potentialSkill]) {
          return {
            normalized: skills[potentialSkill]!,
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
            normalized: skills[content]!,
            raw: paren.slice(1, -1).trim()
          }
        }
      }
    }

    // 4. Check colon-separated format
    const colonMatch = originalFlavor.match(UNIVERSAL_PATTERNS.colonSeparated)
    if (colonMatch?.[1]) {
      const potentialSkill = colonMatch[1].trim().toLowerCase()
      if (skills[potentialSkill]) {
        return {
          normalized: skills[potentialSkill]!,
          raw: colonMatch[1].trim()
        }
      }
    }

    return null
  }

  /**
   * Extract ability from flavor text
   * @param lowerFlavor - Lowercase flavor text
   * @param originalFlavor - Original case flavor text
   * @returns Match result or null
   */
  private extractAbility(lowerFlavor: string, originalFlavor: string): MatchResult | null {
    const abilities = this.mappings.abilities || {}

    // 1. Check parenthetical content first (common pattern: "Acrobatics (Dexterity)")
    const parentheticals = originalFlavor.match(UNIVERSAL_PATTERNS.parenthetical)
    if (parentheticals) {
      for (const paren of parentheticals) {
        const content = paren.slice(1, -1).toLowerCase().trim()
        if (abilities[content]) {
          return {
            normalized: abilities[content]!,
            raw: paren.slice(1, -1).trim()
          }
        }
      }
    }

    // 2. Try saving throw patterns
    for (const pattern of UNIVERSAL_PATTERNS.savingThrow) {
      const match = lowerFlavor.match(pattern)
      if (match?.[1]) {
        const potentialAbility = match[1].trim().toLowerCase()
        if (abilities[potentialAbility]) {
          return {
            normalized: abilities[potentialAbility]!,
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
   * @param flavorText - Original flavor text
   * @returns Array of modifier strings (e.g., ["+2", "-1"])
   */
  private extractModifiers(flavorText: string): string[] {
    const modifiers: string[] = []
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
   * @param text - Original text
   * @param word - Word to find (lowercase)
   * @returns Original case version or null
   */
  private findOriginalCase(text: string, word: string): string | null {
    const regex = new RegExp(`\\b(${this.escapeRegex(word)})\\b`, 'i')
    const match = text.match(regex)
    return match ? match[1]! : null
  }

  /**
   * Capitalize first letter of a string
   * @param str - Input string
   * @returns Capitalized string
   */
  private capitalizeFirst(str: string): string {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Escape special regex characters
   * @param str - Input string
   * @returns Escaped string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

/**
 * Create a FlavorParser instance for the current game
 * @returns Parser instance
 */
export function createFlavorParser(): FlavorParser {
  const systemId = game?.system?.id || 'generic'
  const language = game?.i18n?.lang || 'en'

  Logger.info('Creating FlavorParser', { systemId, language })

  return new FlavorParser(systemId, language)
}

export default FlavorParser
