/**
 * System Adapters for different game systems
 * Provides unified interface for extracting data from various RPG systems
 */

import Logger from './logger.js'
import { createFlavorParser } from './flavor-parser.js'

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

    const diceResults = this.extractDiceResults(roll)
    const isCritical = this.detectCritical(roll)
    const criticalType = isCritical ? this.detectCriticalType(roll) : null
    const rollType = this.detectRollType(roll, message)

    // Parse flavor text for enriched data
    const parsedFlavor = this.parseFlavorText(message.flavor)

    Logger.info('Roll analysis complete', {
      diceResults,
      isCritical,
      criticalType,
      rollType,
      formula: roll.formula,
      total: roll.total,
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
      diceResults,
      isCritical,
      criticalType,
      isHidden: message.whisper?.length > 0,
      rollType: parsedFlavor.rollType || rollType, // Prefer parsed roll type
      // NEW: Enriched flavor data
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
 * Factory to get the appropriate adapter
 */
export function getSystemAdapter() {
  const systemId = game.system?.id

  const adapters = {
    'dnd5e': Dnd5eAdapter,
    'pf2e': Pf2eAdapter
  }

  const AdapterClass = adapters[systemId] || GenericAdapter

  Logger.debug(`Using system adapter: ${AdapterClass.name} for system: ${systemId}`)

  return new AdapterClass()
}

export { GenericAdapter, Dnd5eAdapter, Pf2eAdapter }
