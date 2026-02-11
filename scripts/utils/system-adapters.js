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

    Logger.info('Roll analysis complete (with universal extraction)', {
      diceResults: universalData.diceResults,
      termsCount: universalData.terms.length,
      isCritical: universalData.isCritical,
      criticalType: universalData.criticalType,
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
      isCritical: universalData.isCritical,
      criticalType: universalData.criticalType,
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

    return actor.items
      .filter(item => ['weapon', 'equipment', 'consumable', 'tool'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: item.system?.quantity || 1,
        equipped: item.system?.equipped || false,
        img: item.img
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
    'blades-in-the-dark': BladesInTheDarkAdapter
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
  BladesInTheDarkAdapter
}
