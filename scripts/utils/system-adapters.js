/**
 * System Adapters for different game systems
 * Provides unified interface for extracting data from various RPG systems
 */

import Logger from './logger.js'
import { createFlavorParser } from './flavor-parser.js'
import { extractUniversalRollData } from './term-extractor.js'

/**
 * Base adapter with generic implementation
 */
class GenericAdapter {
  constructor() {
    this.flavorParser = null
  }

  get systemId() {
    return 'generic'
  }

  /**
   * Initialize the adapter (call after game is ready)
   */
  initialize() {
    this.flavorParser = createFlavorParser()
    Logger.info('System adapter initialized with FlavorParser', {
      systemId: this.systemId,
      language: game?.i18n?.lang
    })
  }

  /**
   * Extract roll data from a chat message
   * Now uses Universal Term Extractor for complete dice data
   */
  extractRollData(message, roll) {
    const speaker = message.speaker
    const actor = game.actors?.get(speaker?.actor)

    Logger.info('Extracting roll data (GenericAdapter)', {
      speaker,
      actorName: actor?.name,
      actorId: actor?.id,
      flavor: message.flavor,
      rollOptions: roll.options
    })

    // Use universal term extractor for detailed dice data
    const universalData = extractUniversalRollData(message, roll)

    // Legacy extraction for backwards compatibility
    const legacyDiceResults = this.extractDiceResults(roll)
    const rollType = this.detectRollType(roll, message)

    // Parse flavor text for enriched data
    const parsedFlavor = this.parseFlavorText(message.flavor)

    // Criticality enrichment V2
    const criticality = this.analyzeCriticality(roll, message)

    Logger.info('Roll analysis complete (with universal extraction)', {
      diceResults: universalData.diceResults,
      termsCount: universalData.terms.length,
      isCritical: criticality.isCritical,
      criticalType: criticality.criticalType,
      severity: criticality.severity,
      criticalLabel: criticality.label,
      criticalCategory: criticality.systemCriticalCategory,
      rollType,
      formula: roll.formula,
      total: roll.total,
      systemData: universalData.systemData,
      parsedFlavor: {
        skill: parsedFlavor.skill,
        ability: parsedFlavor.ability,
        confidence: parsedFlavor.confidence
      }
    })

    return {
      characterId: actor?.id || speaker?.actor || 'unknown',
      characterName: actor?.name || speaker?.alias || 'Unknown Character',
      rollId: message.id,
      rollFormula: roll.formula,
      result: roll.total,
      // Use universal extraction results (more complete)
      diceResults: universalData.diceResults.length > 0 ? universalData.diceResults : legacyDiceResults,
      isCritical: criticality.isCritical,
      criticalType: criticality.criticalType,
      // Criticality enrichment V2
      severity: criticality.severity,
      criticalLabel: criticality.label,
      criticalCategory: criticality.systemCriticalCategory,
      isHidden: message.whisper?.length > 0,
      rollType: parsedFlavor.rollType || rollType, // Prefer parsed roll type
      // NEW: Universal term data for advanced rendering
      terms: universalData.terms,
      systemData: universalData.systemData,
      // Enriched flavor data
      skill: parsedFlavor.skill,
      skillRaw: parsedFlavor.skillRaw,
      ability: parsedFlavor.ability,
      abilityRaw: parsedFlavor.abilityRaw,
      modifiers: parsedFlavor.modifiers,
      metadata: {
        foundryMessageId: message.id,
        foundryActorId: actor?.id,
        flavor: message.flavor,
        system: game.system.id,
        systemId: universalData.systemId,
        timestamp: Date.now(),
        parsedFlavor: parsedFlavor // Include full parsed data for debugging
      }
    }
  }

  /**
   * Parse flavor text using the FlavorParser
   */
  parseFlavorText(flavorText) {
    // Lazy initialization of parser if not already done
    if (!this.flavorParser) {
      this.initialize()
    }

    if (!this.flavorParser) {
      Logger.warn('FlavorParser not available, returning empty result')
      return {
        skill: null,
        skillRaw: null,
        ability: null,
        abilityRaw: null,
        rollType: null,
        modifiers: [],
        rawFlavor: flavorText,
        confidence: 0
      }
    }

    return this.flavorParser.parse(flavorText)
  }

  /**
   * Analyze criticality with enriched V2 data.
   * Returns severity, label, category in addition to isCritical/criticalType.
   * Subclasses override this for system-specific enrichment.
   */
  analyzeCriticality(roll, _message) {
    const isCritical = this.detectCritical(roll)
    const criticalType = this.detectCriticalType(roll)

    if (!isCritical) {
      return {
        isCritical: false,
        criticalType: null,
        severity: null,
        label: null,
        labelLocalized: null,
        systemCriticalCategory: null,
        description: null,
      }
    }

    return {
      isCritical: true,
      criticalType,
      severity: 'major',
      label: criticalType === 'success' ? 'Critical Success' : 'Critical Failure',
      labelLocalized: null,
      systemCriticalCategory: criticalType === 'success' ? 'generic_success' : 'generic_failure',
      description: null,
    }
  }

  /**
   * Extract all dice results from a roll
   */
  extractDiceResults(roll) {
    const results = []
    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          results.push(result.result)
        }
      }
    }
    return results
  }

  /**
   * Detect if roll is critical (generic: d20 natural 1 or 20)
   */
  detectCritical(roll) {
    for (const term of roll.terms || []) {
      if (term.faces === 20 && term.results) {
        for (const result of term.results) {
          if (result.result === 1 || result.result === 20) {
            return true
          }
        }
      }
    }
    return false
  }

  /**
   * Detect critical type (success or failure)
   */
  detectCriticalType(roll) {
    for (const term of roll.terms || []) {
      if (term.faces === 20 && term.results) {
        for (const result of term.results) {
          if (result.result === 20) return 'success'
          if (result.result === 1) return 'failure'
        }
      }
    }
    return null
  }

  /**
   * Detect roll type from flavor text
   */
  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('save') || flavor.includes('saving')) return 'save'
    if (flavor.includes('skill') || flavor.includes('check')) return 'skill'
    if (flavor.includes('initiative')) return 'initiative'
    if (flavor.includes('heal')) return 'heal'

    return 'generic'
  }

  /**
   * Extract character stats
   */
  extractStats(actor) {
    return {
      name: actor.name,
      type: actor.type
    }
  }

  /**
   * Extract inventory items
   */
  extractInventory(actor) {
    return []
  }

  /**
   * Extract spells / magical abilities from the actor.
   * Returns a flat array usable by the gamification spell system.
   *
   * @param {Actor} actor - Foundry VTT actor document
   * @returns {Array<{id: string, name: string, img: string, type: string, level: number|null, school: string|null, prepared: boolean|null, uses: {value: number|null, max: number|null}|null}>}
   */
  extractSpells(actor) {
    if (!actor?.items) return []

    // Generic fallback: look for items typed 'spell'
    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: item.system?.level ?? null,
        school: null,
        prepared: null,
        uses: null,
      }))
  }

  /**
   * Extract features / abilities / talents from the actor.
   *
   * @param {Actor} actor - Foundry VTT actor document
   * @returns {Array<{id: string, name: string, img: string, type: string, subtype: string|null, uses: {value: number|null, max: number|null, per: string|null}|null}>}
   */
  extractFeatures(actor) {
    if (!actor?.items) return []

    // Generic fallback: look for items typed 'feat'
    return actor.items
      .filter(item => item.type === 'feat')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'feat',
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * D&D 5e System Adapter
 */
class Dnd5eAdapter extends GenericAdapter {
  get systemId() {
    return 'dnd5e'
  }

  detectCritical(roll) {
    // D&D 5e has specific critical detection via options
    if (roll.options?.critical !== undefined) {
      const d20Result = this.getD20Result(roll)
      return d20Result >= roll.options.critical || d20Result === 1
    }
    return super.detectCritical(roll)
  }

  getD20Result(roll) {
    for (const term of roll.terms || []) {
      if (term.faces === 20 && term.results?.length > 0) {
        return term.results[0].result
      }
    }
    return null
  }

  analyzeCriticality(roll, message) {
    const isCritical = this.detectCritical(roll)
    if (!isCritical) return super.analyzeCriticality(roll, message)

    const d20Result = this.getD20Result(roll)
    const criticalType = d20Result === 1 ? 'failure' : 'success'

    return {
      isCritical: true,
      criticalType,
      severity: 'major',
      label: d20Result === 20 ? 'Natural 20' : d20Result === 1 ? 'Natural 1' : `Natural ${d20Result}`,
      labelLocalized: null,
      systemCriticalCategory: d20Result === 1 ? 'nat1' : 'nat20',
      description: criticalType === 'success'
        ? 'Automatic hit, roll damage dice twice'
        : 'Automatic miss',
    }
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    Logger.info('D&D 5e detectRollType', {
      flavor: message.flavor,
      flavorLower: flavor,
      rollOptions: roll.options
    })

    // D&D 5e specific roll types
    if (flavor.includes('attack roll')) return 'attack'
    if (flavor.includes('damage roll')) return 'damage'
    if (flavor.includes('saving throw')) return 'save'
    if (flavor.includes('ability check')) return 'ability'
    if (flavor.includes('skill check')) return 'skill'
    if (flavor.includes('death saving throw')) return 'death-save'
    if (flavor.includes('initiative')) return 'initiative'
    if (flavor.includes('hit dice')) return 'hit-dice'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: system.attributes?.hp?.value || 0,
        max: system.attributes?.hp?.max || 0,
        temp: system.attributes?.hp?.temp || 0
      },
      ac: system.attributes?.ac?.value || 0,
      level: system.details?.level || 0,
      class: system.details?.class || '',
      race: system.details?.race || '',
      abilities: this.extractAbilities(system),
      proficiencyBonus: system.attributes?.prof || 0
    }
  }

  extractAbilities(system) {
    const abilities = {}
    for (const [key, ability] of Object.entries(system.abilities || {})) {
      abilities[key] = {
        value: ability.value,
        mod: ability.mod,
        save: ability.save
      }
    }
    return abilities
  }

  extractInventory(actor) {
    if (!actor?.items) return []

    const inventoryTypes = ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack']
    return actor.items
      .filter(item => inventoryTypes.includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: item.system?.quantity || 1,
        equipped: item.system?.equipped || false,
        img: item.img
      }))
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: item.system?.level ?? null,
        school: item.system?.school || null,
        prepared: item.system?.preparation?.prepared ?? null,
        uses: item.system?.uses ? {
          value: item.system.uses.value ?? null,
          max: item.system.uses.max ?? null,
        } : null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'feat')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'feat',
        subtype: item.system?.type?.value || null,
        uses: item.system?.uses?.max ? {
          value: item.system.uses.value ?? null,
          max: item.system.uses.max ?? null,
          per: item.system.uses.per || null,
        } : null,
      }))
  }
}

/**
 * Pathfinder 2e System Adapter
 */
class Pf2eAdapter extends GenericAdapter {
  get systemId() {
    return 'pf2e'
  }

  detectCritical(roll) {
    // PF2e uses degree of success
    if (roll.degreeOfSuccess !== undefined) {
      return roll.degreeOfSuccess === 3 || roll.degreeOfSuccess === 0
    }
    return super.detectCritical(roll)
  }

  detectCriticalType(roll) {
    if (roll.degreeOfSuccess === 3) return 'success'
    if (roll.degreeOfSuccess === 0) return 'failure'
    return super.detectCriticalType(roll)
  }

  analyzeCriticality(roll, message) {
    if (roll.degreeOfSuccess === undefined) return super.analyzeCriticality(roll, message)

    if (roll.degreeOfSuccess === 3) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'major',
        label: 'Critical Success',
        labelLocalized: null,
        systemCriticalCategory: 'degree_3',
        description: 'Beat DC by 10 or more, or natural 20 improved outcome',
      }
    }

    if (roll.degreeOfSuccess === 0) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'major',
        label: 'Critical Failure',
        labelLocalized: null,
        systemCriticalCategory: 'degree_0',
        description: 'Missed DC by 10 or more, or natural 1 worsened outcome',
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: system.attributes?.hp?.value || 0,
        max: system.attributes?.hp?.max || 0,
        temp: system.attributes?.hp?.temp || 0
      },
      ac: system.attributes?.ac?.value || 0,
      level: system.details?.level?.value || 0,
      ancestry: system.details?.ancestry?.name || '',
      class: system.details?.class?.name || ''
    }
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: item.system?.level?.value ?? item.system?.level ?? null,
        school: item.system?.traditions?.value?.[0] || null,
        prepared: item.system?.location?.signature ?? null,
        uses: item.system?.location?.uses ? {
          value: item.system.location.uses.value ?? null,
          max: item.system.location.uses.max ?? null,
        } : null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['feat', 'action'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: item.system?.category || item.system?.actionType?.value || null,
        uses: item.system?.frequency ? {
          value: item.system.frequency.value ?? null,
          max: item.system.frequency.max ?? null,
          per: item.system.frequency.per || null,
        } : null,
      }))
  }
}

/**
 * Call of Cthulhu 7e System Adapter
 */
class CoC7Adapter extends GenericAdapter {
  get systemId() {
    return 'CoC7'
  }

  detectCritical(roll) {
    // CoC7 uses percentile dice - critical on 01, fumble on 100
    const d100Result = this.getD100Result(roll)
    if (d100Result === 1) return true // Critical success
    if (d100Result === 100) return true // Fumble
    return false
  }

  detectCriticalType(roll) {
    const d100Result = this.getD100Result(roll)
    if (d100Result === 1) return 'success'
    if (d100Result === 100) return 'failure'
    return null
  }

  getD100Result(roll) {
    // CoC7 often uses 2d10 (tens and units) or 1d100
    for (const term of roll.terms || []) {
      if (term.faces === 100 && term.results?.length > 0) {
        return term.results[0].result
      }
    }
    return null
  }

  analyzeCriticality(roll, message) {
    const d100Result = this.getD100Result(roll)
    if (d100Result === null) return super.analyzeCriticality(roll, message)

    if (d100Result === 1) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'extreme',
        label: 'Critical',
        labelLocalized: null,
        systemCriticalCategory: 'coc_critical',
        description: 'Rolled 01 — the best possible result',
      }
    }

    if (d100Result === 100) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'extreme',
        label: 'Fumble',
        labelLocalized: null,
        systemCriticalCategory: 'coc_fumble',
        description: 'Rolled 100 — catastrophic failure',
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('sanity')) return 'sanity'
    if (flavor.includes('luck')) return 'luck'
    if (flavor.includes('combat')) return 'combat'
    if (flavor.includes('skill')) return 'skill'
    if (flavor.includes('characteristic')) return 'characteristic'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: system.attribs?.hp?.value || 0,
        max: system.attribs?.hp?.max || 0
      },
      sanity: {
        current: system.attribs?.san?.value || 0,
        max: system.attribs?.san?.max || 0
      },
      luck: system.attribs?.lck?.value || 0,
      occupation: system.infos?.occupation || '',
      characteristics: this.extractCharacteristics(system)
    }
  }

  extractCharacteristics(system) {
    const chars = {}
    const charList = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu']
    for (const char of charList) {
      if (system.characteristics?.[char]) {
        chars[char] = {
          value: system.characteristics[char].value || 0
        }
      }
    }
    return chars
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: null,
        school: null,
        prepared: null,
        uses: item.system?.uses ? {
          value: item.system.uses.value ?? null,
          max: item.system.uses.max ?? null,
        } : null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['skill', 'talent', 'occupation'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Warhammer Fantasy Roleplay 4e System Adapter
 */
class Wfrp4eAdapter extends GenericAdapter {
  get systemId() {
    return 'wfrp4e'
  }

  detectCritical(roll) {
    // WFRP uses d100, doubles are special (11, 22, 33, etc)
    const d100Result = this.getD100Result(roll)
    if (!d100Result) return false

    // Check for doubles
    const tens = Math.floor(d100Result / 10)
    const units = d100Result % 10
    return tens === units
  }

  getD100Result(roll) {
    for (const term of roll.terms || []) {
      if (term.faces === 100 && term.results?.length > 0) {
        return term.results[0].result
      }
    }
    return null
  }

  analyzeCriticality(roll, message) {
    const d100Result = this.getD100Result(roll)
    if (!d100Result) return super.analyzeCriticality(roll, message)

    const tens = Math.floor(d100Result / 10)
    const units = d100Result % 10
    if (tens !== units) return super.analyzeCriticality(roll, message)

    // Doubles — determine success/failure from context (total vs target)
    // Default to success for doubles (WFRP doubles on success = critical hit)
    const criticalType = roll.options?.outcome === 'failure' ? 'failure' : 'success'

    return {
      isCritical: true,
      criticalType,
      severity: 'major',
      label: `Doubles! (${d100Result})`,
      labelLocalized: null,
      systemCriticalCategory: criticalType === 'success' ? 'doubles_success' : 'doubles_failure',
      description: `Rolled doubles ${d100Result} on d100`,
    }
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('weapon')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('channelling')) return 'magic'
    if (flavor.includes('casting')) return 'magic'
    if (flavor.includes('skill')) return 'skill'
    if (flavor.includes('characteristic')) return 'characteristic'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: system.status?.wounds?.value || 0,
        max: system.status?.wounds?.max || 0
      },
      career: system.details?.career?.value || '',
      species: system.details?.species?.value || '',
      characteristics: this.extractCharacteristics(system)
    }
  }

  extractCharacteristics(system) {
    const chars = {}
    const charList = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel']
    for (const char of charList) {
      if (system.characteristics?.[char]) {
        chars[char] = {
          value: system.characteristics[char].value || 0,
          bonus: system.characteristics[char].bonus || 0
        }
      }
    }
    return chars
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    // WFRP4e has both 'spell' and 'prayer' item types
    return actor.items
      .filter(item => ['spell', 'prayer'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: item.system?.cn?.value ?? null,
        school: item.system?.lore?.value || null,
        prepared: item.system?.memorized?.value ?? null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'trait'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: item.system?.tests?.value ? {
          value: null,
          max: null,
          per: null,
        } : null,
      }))
  }
}

/**
 * Savage Worlds Adventure Edition System Adapter
 */
class SwadeAdapter extends GenericAdapter {
  get systemId() {
    return 'swade'
  }

  detectCritical(roll) {
    // SWADE: Aces (max die result) and critical failures on snake eyes
    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          // Check for exploding dice (aces)
          if (result.exploded) return true
          // Check for 1s on trait dice (potential critical failure)
          if (result.result === 1 && term.faces >= 4) return true
        }
      }
    }
    return false
  }

  detectCriticalType(roll) {
    let hasAce = false
    let hasOne = false

    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          if (result.exploded) hasAce = true
          if (result.result === 1) hasOne = true
        }
      }
    }

    if (hasAce) return 'success'
    if (hasOne) return 'failure'
    return null
  }

  analyzeCriticality(roll, message) {
    let aceCount = 0
    let hasOne = false

    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          if (result.exploded) aceCount++
          if (result.result === 1) hasOne = true
        }
      }
    }

    if (aceCount > 0) {
      // Dynamic severity based on explosion count
      const severity = aceCount >= 3 ? 'extreme' : aceCount >= 2 ? 'major' : 'minor'
      return {
        isCritical: true,
        criticalType: 'success',
        severity,
        label: aceCount > 1 ? `Ace x${aceCount}!` : 'Ace!',
        labelLocalized: null,
        systemCriticalCategory: 'ace',
        description: `Die exploded ${aceCount} time(s)`,
      }
    }

    if (hasOne) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'major',
        label: 'Critical Failure',
        labelLocalized: null,
        systemCriticalCategory: 'swade_fumble',
        description: 'Rolled 1 on trait die',
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('fighting') || flavor.includes('shooting')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('soak')) return 'soak'
    if (flavor.includes('benny')) return 'benny'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      isWildCard: system.wildcard || false,
      wounds: {
        current: system.wounds?.value || 0,
        max: system.wounds?.max || 0
      },
      fatigue: system.fatigue?.value || 0,
      bennies: system.bennies?.value || 0,
      attributes: this.extractAttributes(system)
    }
  }

  extractAttributes(system) {
    const attrs = {}
    const attrList = ['agility', 'smarts', 'spirit', 'strength', 'vigor']
    for (const attr of attrList) {
      if (system.attributes?.[attr]) {
        attrs[attr] = {
          die: system.attributes[attr].die?.sides || 4,
          modifier: system.attributes[attr].die?.modifier || 0
        }
      }
    }
    return attrs
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    // SWADE uses 'power' item type for magical abilities
    return actor.items
      .filter(item => item.type === 'power')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'power',
        level: item.system?.rank ?? null,
        school: item.system?.arcane || null,
        prepared: null,
        uses: item.system?.pp ? {
          value: item.system.pp.value ?? null,
          max: item.system.pp.max ?? null,
        } : null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['edge', 'hindrance', 'ability'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: item.system?.isNegative ? 'hindrance' : null,
        uses: null,
      }))
  }
}

/**
 * Cyberpunk RED System Adapter
 */
class CyberpunkRedAdapter extends GenericAdapter {
  get systemId() {
    return 'cyberpunk-red-core'
  }

  detectCritical(roll) {
    // Cyberpunk RED: Natural 10 is critical success, natural 1 is critical failure
    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          if (result.result === 10 || result.result === 1) return true
        }
      }
    }
    return false
  }

  detectCriticalType(roll) {
    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          if (result.result === 10) return 'success'
          if (result.result === 1) return 'failure'
        }
      }
    }
    return null
  }

  analyzeCriticality(roll, message) {
    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          if (result.result === 10) {
            return {
              isCritical: true,
              criticalType: 'success',
              severity: 'major',
              label: 'Critical Success',
              labelLocalized: null,
              systemCriticalCategory: 'cpred_crit',
              description: 'Natural 10 — roll again and add',
            }
          }
          if (result.result === 1) {
            return {
              isCritical: true,
              criticalType: 'failure',
              severity: 'major',
              label: 'Critical Failure',
              labelLocalized: null,
              systemCriticalCategory: 'cpred_fumble',
              description: 'Natural 1 — roll again and subtract',
            }
          }
        }
      }
    }
    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('initiative')) return 'initiative'
    if (flavor.includes('death save')) return 'death-save'
    if (flavor.includes('skill')) return 'skill'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      role: system.role?.value || system.role || null,
      hp: {
        current: system.derivedStats?.hp?.value || 0,
        max: system.derivedStats?.hp?.max || 0
      },
      humanity: system.derivedStats?.humanity?.value || 0,
      stats: this.extractCyberStats(system)
    }
  }

  extractCyberStats(system) {
    const stats = {}
    const statList = ['int', 'ref', 'dex', 'tech', 'cool', 'will', 'luck', 'move', 'body', 'emp']
    for (const stat of statList) {
      if (system.stats?.[stat]) {
        stats[stat] = system.stats[stat].value || 0
      }
    }
    return stats
  }

  // Cyberpunk RED: no traditional spells, but Netrunner programs serve a similar role
  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'program')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'program',
        level: item.system?.class || null,
        school: null,
        prepared: item.system?.equipped ?? null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['cyberware', 'talent', 'role'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Alien RPG System Adapter
 */
class AlienRpgAdapter extends GenericAdapter {
  get systemId() {
    return 'alienrpg'
  }

  detectCritical(roll) {
    // Alien RPG uses d6 dice pool - 6s are successes, 1s on stress dice cause panic
    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) return true
          if (result.result === 1) return true
        }
      }
    }
    return false
  }

  detectCriticalType(roll) {
    let hasSix = false
    let hasOne = false

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) hasSix = true
          if (result.result === 1) hasOne = true
        }
      }
    }

    if (hasSix) return 'success'
    if (hasOne) return 'failure' // Panic potential
    return null
  }

  analyzeCriticality(roll, message) {
    let hasSix = false
    let hasStressOne = false
    let sixCount = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) { hasSix = true; sixCount++ }
          // Stress dice 1s trigger panic (Alien RPG marks stress dice via options or class)
          if (result.result === 1) hasStressOne = true
        }
      }
    }

    if (hasSix && hasStressOne) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'major',
        label: 'Success under Stress',
        labelLocalized: null,
        systemCriticalCategory: 'stress_success',
        description: `${sixCount} success(es) but stress die triggered panic`,
      }
    }

    if (hasStressOne && !hasSix) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'major',
        label: 'Facehugger',
        labelLocalized: null,
        systemCriticalCategory: 'facehugger',
        description: 'Stress die rolled 1 — panic check required',
      }
    }

    if (hasSix) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: sixCount >= 2 ? 'major' : 'minor',
        label: sixCount >= 2 ? 'Multiple Successes' : 'Success',
        labelLocalized: null,
        systemCriticalCategory: 'alien_success',
        description: `${sixCount} success(es) on dice pool`,
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('panic')) return 'panic'
    if (flavor.includes('stress')) return 'stress'
    if (flavor.includes('attack') || flavor.includes('combat')) return 'attack'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      health: system.header?.health?.value || 0,
      stress: system.header?.stress?.value || 0,
      attributes: this.extractAlienAttributes(system)
    }
  }

  extractAlienAttributes(system) {
    const attrs = {}
    const attrList = ['strength', 'agility', 'wits', 'empathy']
    for (const attr of attrList) {
      if (system.attributes?.[attr]) {
        attrs[attr] = system.attributes[attr].value || 0
      }
    }
    return attrs
  }

  // Alien RPG has no spells — extractSpells returns [] via GenericAdapter

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'agenda'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Forbidden Lands System Adapter
 */
class ForbiddenLandsAdapter extends GenericAdapter {
  get systemId() {
    return 'forbidden-lands'
  }

  detectCritical(roll) {
    // Forbidden Lands: Year Zero Engine - 6s are successes, 1s on base dice cause damage
    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6 || result.result === 1) return true
        }
      }
    }
    return false
  }

  detectCriticalType(roll) {
    let hasSix = false
    let hasOne = false

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) hasSix = true
          if (result.result === 1) hasOne = true
        }
      }
    }

    if (hasSix) return 'success'
    if (hasOne) return 'failure'
    return null
  }

  analyzeCriticality(roll, message) {
    let sixCount = 0
    let oneCount = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) sixCount++
          if (result.result === 1) oneCount++
        }
      }
    }

    if (sixCount > 0) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: sixCount >= 2 ? 'major' : 'minor',
        label: 'Triumph',
        labelLocalized: null,
        systemCriticalCategory: 'yz_triumph',
        description: `${sixCount} success(es) on Year Zero dice`,
      }
    }

    if (oneCount > 0) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: oneCount >= 2 ? 'major' : 'minor',
        label: 'Bane',
        labelLocalized: null,
        systemCriticalCategory: 'yz_bane',
        description: `${oneCount} bane(s) — attribute/gear damage`,
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      kin: system.bio?.kin || '',
      profession: system.bio?.profession || '',
      attributes: this.extractFLAttributes(system)
    }
  }

  extractFLAttributes(system) {
    const attrs = {}
    const attrList = ['strength', 'agility', 'wits', 'empathy']
    for (const attr of attrList) {
      if (system.attribute?.[attr]) {
        attrs[attr] = {
          value: system.attribute[attr].value || 0,
          max: system.attribute[attr].max || 0
        }
      }
    }
    return attrs
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: null,
        school: null,
        prepared: null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'criticalInjury'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Vaesen System Adapter
 */
class VaesenAdapter extends GenericAdapter {
  get systemId() {
    return 'vaesen'
  }

  detectCritical(roll) {
    // Vaesen uses Year Zero Engine - similar to Forbidden Lands
    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6 || result.result === 1) return true
        }
      }
    }
    return false
  }

  analyzeCriticality(roll, message) {
    let sixCount = 0
    let oneCount = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) sixCount++
          if (result.result === 1) oneCount++
        }
      }
    }

    if (sixCount > 0) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: sixCount >= 2 ? 'major' : 'minor',
        label: 'Triumph',
        labelLocalized: null,
        systemCriticalCategory: 'yz_triumph',
        description: `${sixCount} success(es) on Year Zero dice`,
      }
    }

    if (oneCount > 0) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: oneCount >= 2 ? 'major' : 'minor',
        label: 'Bane',
        labelLocalized: null,
        systemCriticalCategory: 'yz_bane',
        description: `${oneCount} bane(s)`,
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      conditions: system.condition || {},
      attributes: this.extractVaesenAttributes(system)
    }
  }

  extractVaesenAttributes(system) {
    const attrs = {}
    const attrList = ['physique', 'precision', 'logic', 'empathy']
    for (const attr of attrList) {
      if (system.attribute?.[attr]) {
        attrs[attr] = {
          value: system.attribute[attr].value || 0,
          max: system.attribute[attr].max || 0
        }
      }
    }
    return attrs
  }

  // Vaesen: rituals/spells are rare but exist
  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['spell', 'ritual'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: null,
        school: null,
        prepared: null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'condition'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Blades in the Dark System Adapter
 */
class BladesInTheDarkAdapter extends GenericAdapter {
  get systemId() {
    return 'blades-in-the-dark'
  }

  detectCritical(roll) {
    // BitD: 6 is success, multiple 6s is critical, 1-3 on highest is bad
    let sixCount = 0
    let highestResult = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) sixCount++
          if (result.result > highestResult) highestResult = result.result
        }
      }
    }

    return sixCount >= 2 || highestResult <= 3
  }

  detectCriticalType(roll) {
    let sixCount = 0
    let highestResult = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) sixCount++
          if (result.result > highestResult) highestResult = result.result
        }
      }
    }

    if (sixCount >= 2) return 'success' // Critical success
    if (highestResult <= 3) return 'failure' // Bad outcome
    return null
  }

  analyzeCriticality(roll, message) {
    let sixCount = 0
    let highestResult = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          if (result.result === 6) sixCount++
          if (result.result > highestResult) highestResult = result.result
        }
      }
    }

    if (sixCount >= 2) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'major',
        label: 'Critical',
        labelLocalized: null,
        systemCriticalCategory: 'bitd_critical',
        description: `${sixCount} sixes — enhanced effect`,
      }
    }

    if (highestResult <= 3) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'major',
        label: 'Desperate Failure',
        labelLocalized: null,
        systemCriticalCategory: 'bitd_desperate',
        description: `Highest die: ${highestResult} — bad outcome with consequences`,
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      playbook: system.playbook || '',
      stress: system.stress?.value || 0,
      trauma: system.trauma?.value || 0
    }
  }

  // Blades in the Dark: no traditional spells, but ghost/arcane abilities exist
  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['ghost', 'ritual'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: null,
        school: null,
        prepared: null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['ability', 'crew_ability', 'item'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

// ============================================================================
// NEW ADAPTERS — Criticality V2
// ============================================================================

/**
 * Vampire: The Masquerade 5e / World of Darkness 5e System Adapter
 */
class Vtm5eAdapter extends GenericAdapter {
  get systemId() {
    return 'vtm5e'
  }

  detectCritical(roll) {
    let tens = 0
    let ones = 0
    let totalDice = 0

    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          totalDice++
          if (result.result === 10) tens++
          if (result.result === 1) ones++
        }
      }
    }

    // Critical: 2+ tens (messy or clean) or all ones (bestial failure)
    return tens >= 2 || (ones > 0 && this.getSuccessCount(roll) === 0)
  }

  detectCriticalType(roll) {
    let tens = 0
    let ones = 0

    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          if (result.result === 10) tens++
          if (result.result === 1) ones++
        }
      }
    }

    if (tens >= 2) return 'success'
    if (ones > 0 && this.getSuccessCount(roll) === 0) return 'failure'
    return null
  }

  getSuccessCount(roll) {
    let successes = 0
    for (const term of roll.terms || []) {
      if (term.faces === 10 && term.results) {
        for (const result of term.results) {
          if (result.result >= 6) successes++
        }
      }
    }
    return successes
  }

  analyzeCriticality(roll, message) {
    let tens = 0
    let ones = 0
    let hungerTens = 0
    let hungerOnes = 0

    // V5 separates hunger dice from regular dice
    // Hunger dice are typically in a separate term or marked via options
    for (let i = 0; i < (roll.terms || []).length; i++) {
      const term = roll.terms[i]
      if (term.faces === 10 && term.results) {
        const isHungerDie = term.options?.flavor === 'hunger' || i > 0
        for (const result of term.results) {
          if (result.result === 10) {
            tens++
            if (isHungerDie) hungerTens++
          }
          if (result.result === 1) {
            ones++
            if (isHungerDie) hungerOnes++
          }
        }
      }
    }

    const successes = this.getSuccessCount(roll)

    // Messy Critical: 2+ tens with at least one on a hunger die
    if (tens >= 2 && hungerTens >= 1) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'extreme',
        label: 'Messy Critical',
        labelLocalized: null,
        systemCriticalCategory: 'messy_critical',
        description: 'Critical success but the Beast takes control — brutal, risky outcome',
      }
    }

    // Clean Critical: 2+ tens, none on hunger dice
    if (tens >= 2) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'major',
        label: 'Critical Success',
        labelLocalized: null,
        systemCriticalCategory: 'vtm_critical',
        description: `${tens} tens — 4+ successes`,
      }
    }

    // Bestial Failure: 0 successes with 1s on hunger dice
    if (successes === 0 && hungerOnes >= 1) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'extreme',
        label: 'Bestial Failure',
        labelLocalized: null,
        systemCriticalCategory: 'bestial_failure',
        description: 'The Beast lashes out — compulsion triggered',
      }
    }

    // Total Failure: 0 successes with 1s (no hunger)
    if (successes === 0 && ones > 0) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'major',
        label: 'Total Failure',
        labelLocalized: null,
        systemCriticalCategory: 'vtm_failure',
        description: 'Complete failure with complications',
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('frenzy')) return 'frenzy'
    if (flavor.includes('rouse')) return 'rouse'
    if (flavor.includes('remorse')) return 'remorse'
    if (flavor.includes('hunt')) return 'hunt'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      clan: s.clan?.value || '',
      generation: s.generation?.value || 0,
      hunger: s.hunger?.value || 0,
      health: { value: s.health?.value || 0, max: s.health?.max || 0 },
      willpower: { value: s.willpower?.value || 0, max: s.willpower?.max || 0 },
      humanity: s.humanity?.value || 0,
      bloodPotency: s.blood?.potency || 0,
    }
  }

  // VtM5e: Disciplines are the "spells" of Vampire
  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['discipline', 'power'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: item.system?.level ?? null,
        school: item.system?.discipline || null,
        prepared: null,
        uses: item.system?.cost ? {
          value: null,
          max: item.system.cost ?? null,
        } : null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['merit', 'flaw', 'background'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Shadowrun 5e/6e System Adapter
 */
class ShadowrunAdapter extends GenericAdapter {
  get systemId() {
    return 'shadowrun5e'
  }

  detectCritical(roll) {
    const { ones, totalDice, hits } = this.countPool(roll)
    // Glitch: 50%+ ones
    // Critical Glitch: Glitch + 0 hits
    return ones >= Math.ceil(totalDice / 2)
  }

  detectCriticalType(roll) {
    const { ones, totalDice, hits } = this.countPool(roll)
    const isGlitch = ones >= Math.ceil(totalDice / 2)

    if (isGlitch && hits === 0) return 'failure' // Critical Glitch
    if (isGlitch) return 'failure' // Regular Glitch (still a failure-type)
    return null
  }

  countPool(roll) {
    let ones = 0
    let hits = 0
    let totalDice = 0

    for (const term of roll.terms || []) {
      if (term.faces === 6 && term.results) {
        for (const result of term.results) {
          totalDice++
          if (result.result === 1) ones++
          if (result.result >= 5) hits++ // 5+ = hit in Shadowrun
        }
      }
    }

    return { ones, hits, totalDice }
  }

  analyzeCriticality(roll, message) {
    const { ones, totalDice, hits } = this.countPool(roll)
    const isGlitch = totalDice > 0 && ones >= Math.ceil(totalDice / 2)

    if (!isGlitch) return super.analyzeCriticality(roll, message)

    if (hits === 0) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'extreme',
        label: 'Critical Glitch',
        labelLocalized: null,
        systemCriticalCategory: 'critical_glitch',
        description: `${ones}/${totalDice} ones with 0 hits — catastrophic failure`,
      }
    }

    return {
      isCritical: true,
      criticalType: 'failure',
      severity: 'major',
      label: 'Glitch',
      labelLocalized: null,
      systemCriticalCategory: 'glitch',
      description: `${ones}/${totalDice} ones — something goes wrong, but you still got ${hits} hit(s)`,
    }
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack') || flavor.includes('combat')) return 'attack'
    if (flavor.includes('damage') || flavor.includes('soak')) return 'damage'
    if (flavor.includes('initiative')) return 'initiative'
    if (flavor.includes('matrix') || flavor.includes('hack')) return 'matrix'
    if (flavor.includes('magic') || flavor.includes('spell') || flavor.includes('drain')) return 'magic'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      metatype: s.metatype || '',
      essence: s.essence?.value || 6,
      edge: { value: s.edge?.value || 0, max: s.edge?.max || 0 },
      magic: s.magic?.value || 0,
      resonance: s.resonance?.value || 0,
      initiative: s.initiative?.value || 0,
      physicalDamage: s.track?.physical?.value || 0,
      stunDamage: s.track?.stun?.value || 0,
    }
  }

  extractSpells(actor) {
    if (!actor?.items) return []

    // Shadowrun: spells, complex forms, adept powers
    return actor.items
      .filter(item => ['spell', 'complex_form', 'adept_power'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: null,
        school: item.system?.category || item.system?.type || null,
        prepared: null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['quality', 'echo', 'metamagic'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: item.system?.type || null,
        uses: null,
      }))
  }
}

/**
 * Star Wars FFG (Genesys) System Adapter
 * Handles narrative dice with symbols (Success, Failure, Advantage, Threat, Triumph, Despair)
 */
class StarWarsFFGAdapter extends GenericAdapter {
  get systemId() {
    return 'starwarsffg'
  }

  detectCritical(roll) {
    const symbols = this.extractSymbols(roll)
    return symbols.triumph > 0 || symbols.despair > 0
  }

  detectCriticalType(roll) {
    const symbols = this.extractSymbols(roll)
    if (symbols.triumph > 0) return 'success'
    if (symbols.despair > 0) return 'failure'
    return null
  }

  extractSymbols(roll) {
    const symbols = { success: 0, failure: 0, advantage: 0, threat: 0, triumph: 0, despair: 0 }

    // Try options first (some modules store symbols here)
    if (roll.options?.symbols) {
      return { ...symbols, ...roll.options.symbols }
    }

    // Parse from results
    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          if (result.symbols) {
            for (const sym of result.symbols) {
              if (symbols[sym.type] !== undefined) {
                symbols[sym.type] += sym.count || 1
              }
            }
          }
          // Proficiency die (d12) face mapping for triumph
          if (result.result === 12 && term.faces === 12) symbols.triumph++
          // Challenge die (d12) face mapping for despair
          if (result.result === 12 && term.faces === 12 && term.options?.type === 'challenge') {
            symbols.despair++
          }
        }
      }
    }

    return symbols
  }

  analyzeCriticality(roll, message) {
    const symbols = this.extractSymbols(roll)

    if (symbols.triumph > 0 && symbols.despair > 0) {
      return {
        isCritical: true,
        criticalType: 'success', // Triumph takes narrative precedence
        severity: 'extreme',
        label: 'Triumph & Despair',
        labelLocalized: null,
        systemCriticalCategory: 'triumph_and_despair',
        description: `${symbols.triumph} Triumph(s) and ${symbols.despair} Despair(s) — dramatic narrative moment`,
      }
    }

    if (symbols.triumph > 0) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: symbols.triumph >= 2 ? 'extreme' : 'major',
        label: symbols.triumph >= 2 ? `Triumph x${symbols.triumph}` : 'Triumph',
        labelLocalized: null,
        systemCriticalCategory: 'triumph',
        description: 'Powerful positive narrative effect',
      }
    }

    if (symbols.despair > 0) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: symbols.despair >= 2 ? 'extreme' : 'major',
        label: symbols.despair >= 2 ? `Despair x${symbols.despair}` : 'Despair',
        labelLocalized: null,
        systemCriticalCategory: 'despair',
        description: 'Powerful negative narrative effect',
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('combat') || flavor.includes('attack')) return 'attack'
    if (flavor.includes('force')) return 'force'
    if (flavor.includes('fear')) return 'fear'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      species: s.species?.value || '',
      career: s.career?.value || '',
      wounds: { current: s.stats?.wounds?.value || 0, max: s.stats?.wounds?.max || 0 },
      strain: { current: s.stats?.strain?.value || 0, max: s.stats?.strain?.max || 0 },
      soak: s.stats?.soak?.value || 0,
      defense: { melee: s.stats?.defence?.melee || 0, ranged: s.stats?.defence?.ranged || 0 },
      forceRating: s.stats?.forcePool?.max || 0,
    }
  }

  // Star Wars FFG: Force powers are the "spells"
  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['forcepower', 'power'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: null,
        school: 'force',
        prepared: null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'specialization', 'signatureability'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: item.system?.ranks ? {
          value: item.system.ranks.current ?? null,
          max: item.system.ranks.max ?? null,
          per: null,
        } : null,
      }))
  }
}

/**
 * FATE Core System Adapter
 * Uses 4 Fudge dice (4dF): each die has -1, 0, +1 faces. Range: -4 to +4.
 */
class FateAdapter extends GenericAdapter {
  get systemId() {
    return 'fate-core-official'
  }

  detectCritical(roll) {
    // FATE: ±4 are extreme results (~1.2% chance each)
    return roll.total === 4 || roll.total === -4
  }

  detectCriticalType(roll) {
    if (roll.total === 4) return 'success'
    if (roll.total === -4) return 'failure'
    return null
  }

  analyzeCriticality(roll, message) {
    if (roll.total === 4) {
      return {
        isCritical: true,
        criticalType: 'success',
        severity: 'major',
        label: '+4',
        labelLocalized: null,
        systemCriticalCategory: 'fate_extreme',
        description: 'All four Fudge dice show + — legendary result',
      }
    }

    if (roll.total === -4) {
      return {
        isCritical: true,
        criticalType: 'failure',
        severity: 'major',
        label: '-4',
        labelLocalized: null,
        systemCriticalCategory: 'fate_extreme',
        description: 'All four Fudge dice show - — catastrophic result',
      }
    }

    return super.analyzeCriticality(roll, message)
  }

  detectRollType(roll, message) {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack')) return 'attack'
    if (flavor.includes('defend')) return 'defend'
    if (flavor.includes('overcome')) return 'overcome'
    if (flavor.includes('create advantage') || flavor.includes('advantage')) return 'create-advantage'

    return super.detectRollType(roll, message)
  }

  extractStats(actor) {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      refresh: s.fatePoints?.refresh || 0,
      current: s.fatePoints?.current || 0,
      stress: this._extractStressTracks(s),
      consequences: this._extractConsequences(s),
    }
  }

  _extractStressTracks(system) {
    const tracks = []
    for (const [key, track] of Object.entries(system.tracks || {})) {
      if (track?.enabled) {
        tracks.push({ name: track.name || key, boxes: track.size || 0, marked: track.value || 0 })
      }
    }
    return tracks
  }

  _extractConsequences(system) {
    const consequences = []
    for (const [key, con] of Object.entries(system.consequences || {})) {
      if (con?.name) {
        consequences.push({ name: con.name, severity: con.severity || key, active: !!con.value })
      }
    }
    return consequences
  }

  // FATE: extras/powers can act as "spells" in FATE-based settings
  extractSpells(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['power', 'extra'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: null,
        school: null,
        prepared: null,
        uses: null,
      }))
  }

  extractFeatures(actor) {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['stunt', 'aspect'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: null,
      }))
  }
}

/**
 * Factory to get the appropriate adapter
 */
export function getSystemAdapter() {
  const systemId = game.system?.id

  const adapters = {
    'dnd5e': Dnd5eAdapter,
    'pf2e': Pf2eAdapter,
    'CoC7': CoC7Adapter,
    'wfrp4e': Wfrp4eAdapter,
    'swade': SwadeAdapter,
    'cyberpunk-red-core': CyberpunkRedAdapter,
    'alienrpg': AlienRpgAdapter,
    'forbidden-lands': ForbiddenLandsAdapter,
    'vaesen': VaesenAdapter,
    'blades-in-the-dark': BladesInTheDarkAdapter,
    // NEW — Criticality V2
    'vtm5e': Vtm5eAdapter,
    'wod5e': Vtm5eAdapter,
    'shadowrun5e': ShadowrunAdapter,
    'shadowrun6-eden': ShadowrunAdapter,
    'starwarsffg': StarWarsFFGAdapter,
    'genesys': StarWarsFFGAdapter,
    'fate-core-official': FateAdapter,
  }

  const AdapterClass = adapters[systemId] || GenericAdapter

  Logger.debug(`Using system adapter: ${AdapterClass.name} for system: ${systemId}`)

  return new AdapterClass()
}

export {
  GenericAdapter,
  Dnd5eAdapter,
  Pf2eAdapter,
  CoC7Adapter,
  Wfrp4eAdapter,
  SwadeAdapter,
  CyberpunkRedAdapter,
  AlienRpgAdapter,
  ForbiddenLandsAdapter,
  VaesenAdapter,
  BladesInTheDarkAdapter,
  Vtm5eAdapter,
  ShadowrunAdapter,
  StarWarsFFGAdapter,
  FateAdapter,
}
