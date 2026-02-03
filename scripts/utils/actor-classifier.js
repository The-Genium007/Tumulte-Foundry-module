/**
 * Actor Classifier
 * Multi-system support for classifying Foundry VTT actors as PC, NPC, or Monster
 */

import Logger from './logger.js'

/**
 * Character type enum
 * @typedef {'pc' | 'npc' | 'monster'} CharacterType
 */

/**
 * System configuration for actor classification
 * Each system defines how to identify PCs, NPCs, and Monsters
 */
const SYSTEM_ACTOR_CONFIG = {
  // ============================================
  // D&D 5th Edition
  // ============================================
  'dnd5e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['vehicle', 'group'],
    /**
     * Classify NPC vs Monster based on Challenge Rating
     * CR >= 1 = Monster (combat encounter)
     * CR < 1 = NPC (roleplay/minor threat)
     */
    classifyNpcVsMonster: (actor) => {
      const cr = actor.system?.details?.cr ?? 0
      // Also check if it has a creature type (beasts, fiends, etc.)
      const creatureType = actor.system?.details?.type?.value
      const monsterCreatureTypes = ['beast', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'monstrosity', 'ooze', 'plant', 'undead', 'aberration', 'celestial', 'construct']

      if (monsterCreatureTypes.includes(creatureType?.toLowerCase())) {
        return 'monster'
      }
      return cr >= 1 ? 'monster' : 'npc'
    }
  },

  // ============================================
  // Pathfinder 2nd Edition
  // ============================================
  'pf2e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['hazard', 'familiar', 'loot', 'party'],
    /**
     * Classify NPC vs Monster based on rarity and level
     * Unique rarity = important NPC
     * Level < 0 = minion/weak NPC
     * Others = Monster
     */
    classifyNpcVsMonster: (actor) => {
      const rarity = actor.system?.traits?.rarity
      const level = actor.system?.details?.level?.value ?? 0

      // Unique creatures are typically important NPCs
      if (rarity === 'unique') {
        return 'npc'
      }
      // Very low level could be commoners/civilians
      if (level < 0) {
        return 'npc'
      }
      return 'monster'
    }
  },

  // ============================================
  // Call of Cthulhu 7th Edition
  // ============================================
  'CoC7': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: [],
    // Direct type mapping, no additional logic needed
    classifyNpcVsMonster: null
  },

  // ============================================
  // Warhammer Fantasy Roleplay 4th Edition
  // ============================================
  'wfrp4e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: ['vehicle'],
    // Direct type mapping, no additional logic needed
    classifyNpcVsMonster: null
  },

  // ============================================
  // Savage Worlds Adventure Edition
  // ============================================
  'swade': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['vehicle'],
    /**
     * Classify NPC vs Monster based on Wild Card status
     * Wild Cards = Important NPCs (have Wild Die)
     * Extras = Monsters/minions
     */
    classifyNpcVsMonster: (actor) => {
      const isWildCard = actor.system?.wildcard ?? false
      return isWildCard ? 'npc' : 'monster'
    }
  },

  // ============================================
  // Cyberpunk RED
  // ============================================
  'cyberpunk-red-core': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['container', 'program', 'blackIce', 'demon'],
    /**
     * Classify NPC vs Monster based on role assignment
     * NPCs with roles = Important characters
     * NPCs without roles = Goons/threats
     */
    classifyNpcVsMonster: (actor) => {
      const hasRole = actor.system?.role?.value || actor.system?.role
      return hasRole ? 'npc' : 'monster'
    }
  },

  // ============================================
  // Alien RPG
  // ============================================
  'alienrpg': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: ['synthetic', 'territory', 'spacecraft', 'planet-system'],
    // Direct type mapping
    classifyNpcVsMonster: null
  },

  // ============================================
  // Forbidden Lands
  // ============================================
  'forbidden-lands': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: ['stronghold'],
    // Direct type mapping
    classifyNpcVsMonster: null
  },

  // ============================================
  // Vaesen
  // ============================================
  'vaesen': {
    pcTypes: ['player'],
    npcTypes: ['npc'],
    monsterTypes: ['vaesen'],
    excludedTypes: ['headquarters'],
    // Direct type mapping
    classifyNpcVsMonster: null
  },

  // ============================================
  // Blades in the Dark
  // ============================================
  'blades-in-the-dark': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: [], // No distinct monster type
    excludedTypes: ['faction', 'clock', 'crew', '\ud83d\udd5b clock'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Simple Worldbuilding
  // ============================================
  'worldbuilding': {
    pcTypes: ['Actor'], // Uses hasPlayerOwner for classification
    npcTypes: ['Actor'],
    monsterTypes: [],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Shadow of the Demon Lord
  // ============================================
  'demonlord': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: ['vehicle'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Dungeon World
  // ============================================
  'dungeonworld': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Starfinder
  // ============================================
  'sfrpg': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['vehicle', 'starship', 'drone'],
    /**
     * Similar to D&D 5e - use CR for classification
     */
    classifyNpcVsMonster: (actor) => {
      const cr = actor.system?.details?.cr ?? 0
      return cr >= 1 ? 'monster' : 'npc'
    }
  },

  // ============================================
  // The One Ring 2e
  // ============================================
  'tor2e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['adversary'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Dragonbane
  // ============================================
  'dragonbane': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  }
}

/**
 * Generic fallback configuration for unsupported systems
 */
const GENERIC_CONFIG = {
  pcTypes: ['character', 'pc', 'player', 'investigator'],
  npcTypes: ['npc'],
  monsterTypes: ['creature', 'monster', 'enemy', 'adversary', 'beast'],
  excludedTypes: ['vehicle', 'hazard', 'loot', 'party', 'faction', 'clock', 'container'],
  classifyNpcVsMonster: null
}

/**
 * Get the system configuration for the current game system
 * @param {string} [systemId] - System ID (defaults to current game system)
 * @returns {object} System configuration
 */
export function getSystemConfig(systemId = null) {
  const id = systemId || game.system?.id
  return SYSTEM_ACTOR_CONFIG[id] || GENERIC_CONFIG
}

/**
 * Check if an actor should be synchronized to Tumulte
 * @param {Actor} actor - Foundry VTT Actor
 * @returns {boolean} True if actor should be synced
 */
export function shouldSyncActor(actor) {
  if (!actor) return false

  const config = getSystemConfig()
  const actorType = actor.type?.toLowerCase()

  // Check exclusion list
  const isExcluded = config.excludedTypes.some(
    excluded => actorType === excluded.toLowerCase()
  )

  if (isExcluded) {
    Logger.debug('Actor excluded by type', {
      name: actor.name,
      type: actor.type,
      system: game.system?.id
    })
    return false
  }

  return true
}

/**
 * Classify an actor as PC, NPC, or Monster
 * @param {Actor} actor - Foundry VTT Actor
 * @returns {CharacterType} Character type classification
 */
export function classifyActor(actor) {
  if (!actor) return 'npc'

  const config = getSystemConfig()
  const actorType = actor.type?.toLowerCase()

  // Priority 1: Player-owned actors are always PCs
  if (actor.hasPlayerOwner) {
    Logger.debug('Actor classified as PC (hasPlayerOwner)', {
      name: actor.name,
      type: actor.type
    })
    return 'pc'
  }

  // Priority 2: Check if actor type is in pcTypes
  const isPcType = config.pcTypes.some(
    pcType => actorType === pcType.toLowerCase()
  )
  if (isPcType && !actor.hasPlayerOwner) {
    // It's a PC-type actor but not player-owned
    // This could be a pregen or GM-controlled PC - treat as NPC
    Logger.debug('Actor is PC type but not player-owned, treating as NPC', {
      name: actor.name,
      type: actor.type
    })
  }

  // Priority 3: Check if actor type is explicitly a monster type
  const isMonsterType = config.monsterTypes.some(
    monsterType => actorType === monsterType.toLowerCase()
  )

  if (isMonsterType) {
    // If there's a custom classifier, use it
    if (config.classifyNpcVsMonster) {
      const result = config.classifyNpcVsMonster(actor)
      Logger.debug('Actor classified by custom logic', {
        name: actor.name,
        type: actor.type,
        result
      })
      return result
    }

    // Direct monster type mapping
    Logger.debug('Actor classified as monster (type match)', {
      name: actor.name,
      type: actor.type
    })
    return 'monster'
  }

  // Priority 4: Check if actor type is in npcTypes
  const isNpcType = config.npcTypes.some(
    npcType => actorType === npcType.toLowerCase()
  )

  if (isNpcType) {
    // If there's a custom classifier and this type is in both npc and monster lists
    if (config.classifyNpcVsMonster) {
      const result = config.classifyNpcVsMonster(actor)
      Logger.debug('Actor classified by custom NPC/Monster logic', {
        name: actor.name,
        type: actor.type,
        result
      })
      return result
    }

    Logger.debug('Actor classified as NPC (type match)', {
      name: actor.name,
      type: actor.type
    })
    return 'npc'
  }

  // Fallback: Unknown type, default to NPC
  Logger.debug('Actor classified as NPC (fallback)', {
    name: actor.name,
    type: actor.type
  })
  return 'npc'
}

/**
 * Get a summary of supported systems
 * @returns {string[]} List of supported system IDs
 */
export function getSupportedSystems() {
  return Object.keys(SYSTEM_ACTOR_CONFIG)
}

/**
 * Check if current system has dedicated support
 * @returns {boolean} True if system has dedicated configuration
 */
export function hasSystemSupport() {
  return SYSTEM_ACTOR_CONFIG.hasOwnProperty(game.system?.id)
}

export default {
  classifyActor,
  shouldSyncActor,
  getSystemConfig,
  getSupportedSystems,
  hasSystemSupport
}
