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
  },

  // ============================================
  // Mausritter
  // ============================================
  'mausritter': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: ['hireling'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Mothership (0e and 1e)
  // ============================================
  'mothership': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'monster'],
    excludedTypes: ['ship', 'vehicle'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // FATE Core / Accelerated / Condensed
  // ============================================
  'fate-core-official': {
    pcTypes: ['character', 'fate-core-official.character'],
    npcTypes: ['npc', 'fate-core-official.npc'],
    monsterTypes: [],
    excludedTypes: ['thing', 'extra'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Ironsworn / Starforged
  // ============================================
  'foundry-ironsworn': {
    pcTypes: ['character'],
    npcTypes: ['shared', 'site', 'foe'],
    monsterTypes: ['foe'],
    excludedTypes: ['location', 'delve-site'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Coriolis
  // ============================================
  'yzecoriolis': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: ['ship'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Symbaroum
  // ============================================
  'symbaroum': {
    pcTypes: ['player'],
    npcTypes: ['npc'],
    monsterTypes: ['monster', 'beast'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Tales from the Loop / Things from the Flood
  // ============================================
  'tftloop': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: [],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Mutant Year Zero
  // ============================================
  'mutant-year-zero': {
    pcTypes: ['character', 'mutant'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'robot'],
    excludedTypes: ['vehicle', 'ark'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Twilight 2000 4e
  // ============================================
  't2k4e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: [],
    excludedTypes: ['vehicle', 'unit'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Old-School Essentials (OSE)
  // ============================================
  'ose': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: ['container'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Dungeon Crawl Classics (DCC)
  // ============================================
  'dcc': {
    pcTypes: ['player'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Castles & Crusades
  // ============================================
  'castles-and-crusades': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Shadow of the Weird Wizard
  // ============================================
  'weirdwizard': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // GURPS (Generic Universal RolePlaying System)
  // ============================================
  'gurps': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Rolemaster
  // ============================================
  'rolemaster': {
    pcTypes: ['character', 'pc'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // 13th Age
  // ============================================
  'archmage': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['monster'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Traveller (Mongoose 2e)
  // ============================================
  'traveller': {
    pcTypes: ['traveller'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'animal'],
    excludedTypes: ['ship', 'vehicle', 'spacecraft'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Star Wars FFG (Edge of the Empire, etc.)
  // ============================================
  'starwarsffg': {
    pcTypes: ['character'],
    npcTypes: ['npc', 'minion', 'rival'],
    monsterTypes: ['creature'],
    excludedTypes: ['vehicle', 'homestead'],
    /**
     * Classify based on NPC type
     * Nemesis = important NPC, Rival = minor NPC, Minion = monster/mook
     */
    classifyNpcVsMonster: (actor) => {
      const npcType = actor.system?.characteristics?.npctype
      if (npcType === 'minion') return 'monster'
      return 'npc'
    }
  },

  // ============================================
  // Genesys
  // ============================================
  'genesys': {
    pcTypes: ['character'],
    npcTypes: ['npc', 'rival'],
    monsterTypes: ['minion'],
    excludedTypes: ['vehicle'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // A5E (Level Up: Advanced 5th Edition)
  // ============================================
  'a5e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['vehicle', 'group'],
    /**
     * Same logic as D&D 5e - CR based
     */
    classifyNpcVsMonster: (actor) => {
      const cr = actor.system?.details?.cr ?? 0
      return cr >= 1 ? 'monster' : 'npc'
    }
  },

  // ============================================
  // Pirate Borg / Mork Borg / CY_BORG
  // ============================================
  'morkborg': {
    pcTypes: ['character'],
    npcTypes: ['creature', 'follower'],
    monsterTypes: ['creature'],
    excludedTypes: ['container', 'misery'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Quest RPG
  // ============================================
  'quest': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: [],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Lancer RPG
  // ============================================
  'lancer': {
    pcTypes: ['pilot'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['mech', 'deployable'],
    /**
     * NPCs with higher tier are more threatening
     */
    classifyNpcVsMonster: (actor) => {
      const tier = actor.system?.tier ?? 0
      return tier >= 2 ? 'monster' : 'npc'
    }
  },

  // ============================================
  // SWADE Pathfinder (Savage Pathfinder)
  // ============================================
  'swpf': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['npc'],
    excludedTypes: ['vehicle'],
    classifyNpcVsMonster: (actor) => {
      const isWildCard = actor.system?.wildcard ?? false
      return isWildCard ? 'npc' : 'monster'
    }
  },

  // ============================================
  // City of Mist
  // ============================================
  'city-of-mist': {
    pcTypes: ['character'],
    npcTypes: ['extra', 'crew'],
    monsterTypes: ['danger'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Powered by the Apocalypse (Generic)
  // ============================================
  'pbta': {
    pcTypes: ['character'],
    npcTypes: ['npc', 'other'],
    monsterTypes: ['threat'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Monster of the Week
  // ============================================
  'motw': {
    pcTypes: ['character'],
    npcTypes: ['bystander', 'minion'],
    monsterTypes: ['monster'],
    excludedTypes: ['location'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Avatar Legends
  // ============================================
  'avatarlegends': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: [],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Root RPG
  // ============================================
  'root': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['denizen'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Masks: A New Generation
  // ============================================
  'masks': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['villain', 'threat'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Kids on Bikes / Brooms
  // ============================================
  'kids-on-bikes': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'adversary'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Daggerheart
  // ============================================
  'daggerheart': {
    pcTypes: ['character', 'pc'],
    npcTypes: ['npc'],
    monsterTypes: ['adversary'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Draw Steel (MCDM)
  // ============================================
  'draw-steel': {
    pcTypes: ['hero'],
    npcTypes: ['npc'],
    monsterTypes: ['monster', 'creature'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Delta Green (CoC-based horror)
  // ============================================
  'deltagreen': {
    pcTypes: ['character', 'agent'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'unnatural'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // World of Darkness 5e (Vampire V5, Hunter, Werewolf)
  // ============================================
  'wod5e': {
    pcTypes: ['vampire', 'mortal', 'ghoul', 'hunter', 'werewolf', 'changeling'],
    npcTypes: ['spc'],  // Secondary/Supporting Characters
    monsterTypes: ['creature'],
    excludedTypes: ['cell', 'coterie', 'group'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Chronicles of Darkness 2e (Mage, Vampire, etc.)
  // ============================================
  'mta': {
    pcTypes: ['mage', 'vampire', 'changeling', 'werewolf', 'hunter', 'mortal', 'sleepwalker', 'proximi'],
    npcTypes: ['sleepwalker', 'mortal'],
    monsterTypes: ['ephemeral', 'spirit', 'demon', 'horror'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Shadowrun 6th Edition
  // ============================================
  'shadowrun6-eden': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['critter'],
    excludedTypes: ['vehicle', 'host', 'device', 'sprite', 'ic'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Shadowrun 5th Edition
  // ============================================
  'shadowrun5e': {
    pcTypes: ['character'],
    npcTypes: ['npc', 'spirit'],
    monsterTypes: ['critter'],
    excludedTypes: ['vehicle', 'host', 'device'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Ars Magica 5e
  // ============================================
  'arm5e': {
    pcTypes: ['magus', 'companion', 'grog'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'beast'],
    excludedTypes: ['covenant', 'laboratory'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Pendragon 6th Edition
  // ============================================
  'pendragon': {
    pcTypes: ['character', 'knight'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'beast'],
    excludedTypes: ['manor', 'holding'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Legend of the Five Rings 5e
  // ============================================
  'l5r5e': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'mahō'],
    excludedTypes: ['army'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // RuneQuest: Roleplaying in Glorantha
  // ============================================
  'rqg': {
    pcTypes: ['character'],
    npcTypes: ['character'],  // RQG uses one type for all
    monsterTypes: [],
    excludedTypes: [],
    // RQG uses hasPlayerOwner for PC detection
    classifyNpcVsMonster: null
  },

  // ============================================
  // Mythras
  // ============================================
  'mythras': {
    pcTypes: ['character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature'],
    excludedTypes: [],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Dark Heresy 2nd Edition (Warhammer 40k)
  // ============================================
  'dark-heresy': {
    pcTypes: ['acolyte', 'character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'daemon'],
    excludedTypes: ['vehicle'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Wrath & Glory (Warhammer 40k)
  // ============================================
  'wrath-and-glory': {
    pcTypes: ['agent', 'character'],
    npcTypes: ['npc'],
    monsterTypes: ['threat', 'creature'],
    excludedTypes: ['vehicle', 'voidship'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Cypher System (Numenera, The Strange, etc.)
  // ============================================
  'cyphersystem': {
    pcTypes: ['pc', 'character'],
    npcTypes: ['npc'],
    monsterTypes: ['creature', 'community'],  // Cypher uses 'community' for large threats
    excludedTypes: ['marker', 'vehicle'],
    classifyNpcVsMonster: null
  },

  // ============================================
  // Paranoia (Perfect Edition)
  // ============================================
  'paranoia': {
    pcTypes: ['troubleshooter'],
    npcTypes: ['npc-somebody', 'npc-accomplice'],
    monsterTypes: ['npc-nobody'],  // Expendable NPCs are "monsters"
    excludedTypes: [],
    classifyNpcVsMonster: null
  }
}

/**
 * Generic fallback configuration for unsupported systems
 * This covers the most common naming conventions across RPG systems
 */
const GENERIC_CONFIG = {
  // Common PC type names across various systems
  pcTypes: [
    'character',      // Most common (D&D, PF, CoC, etc.)
    'pc',             // Generic abbreviation
    'player',         // Vaesen, Symbaroum, DCC
    'investigator',   // Call of Cthulhu
    'hero',           // Draw Steel, superhero systems
    'protagonist',    // Story-focused games
    'adventurer',     // Generic fantasy
    'traveller',      // Traveller RPG
    'pilot',          // Lancer, mech games
    'mutant',         // Mutant Year Zero
    'agent',          // Spy/espionage games, Delta Green, Wrath & Glory
    'operative',      // Delta Green, Cyberpunk
    'survivor',       // Horror/survival games
    'hunter',         // Monster of the Week, World of Darkness
    'chosen',         // Urban fantasy
    'keeper',         // Keeper-style games (player side)
    'acolyte',        // Dark Heresy (Warhammer 40k)
    'troubleshooter', // Paranoia
    'magus',          // Ars Magica
    'companion',      // Ars Magica (PC type, not the excluded companion)
    'grog',           // Ars Magica
    'knight',         // Pendragon
    'vampire',        // World of Darkness
    'werewolf',       // World of Darkness
    'mage',           // Chronicles of Darkness
    'changeling',     // Chronicles of Darkness
    'mortal',         // World of Darkness
    'ghoul',          // World of Darkness
    'sleepwalker',    // Chronicles of Darkness
    'proximi',        // Chronicles of Darkness
  ],
  // Common NPC type names
  npcTypes: [
    'npc',
    'extra',          // FATE, City of Mist
    'bystander',      // Monster of the Week
    'ally',           // Generic
    'follower',       // Mork Borg
    'hireling',       // OSR games
    'minion',         // Star Wars FFG
    'rival',          // Genesys, Star Wars
    'contact',        // Cyberpunk
    'spc',            // World of Darkness (Supporting Characters)
    'npc-somebody',   // Paranoia
    'npc-accomplice', // Paranoia
  ],
  // Common monster/enemy type names
  monsterTypes: [
    'creature',       // Generic fantasy
    'monster',        // D&D, OSE
    'enemy',          // Generic
    'adversary',      // PF2e, Daggerheart
    'beast',          // Fantasy
    'threat',         // PbtA games, Wrath & Glory
    'danger',         // City of Mist
    'villain',        // Superhero games
    'foe',            // Ironsworn
    'horror',         // Horror games, Chronicles of Darkness
    'abomination',    // Horror/fantasy
    'demon',          // Fantasy
    'undead',         // Fantasy
    'critter',        // Shadowrun
    'unnatural',      // Delta Green
    'ephemeral',      // Chronicles of Darkness
    'spirit',         // Shadowrun, various
    'daemon',         // Warhammer 40k
    'mahō',           // Legend of the Five Rings (tainted creatures)
    'npc-nobody',     // Paranoia (expendable NPCs)
    'community',      // Cypher System (large threats)
  ],
  // Types to exclude from sync (non-character entities)
  excludedTypes: [
    'vehicle',
    'ship',
    'starship',
    'spacecraft',
    'mech',
    'hazard',
    'trap',
    'loot',
    'item',
    'party',
    'faction',
    'organization',
    'clock',
    'container',
    'location',
    'site',
    'base',
    'headquarters',
    'stronghold',
    'settlement',
    'thing',          // FATE extras
    'deployable',     // Lancer
    'drone',
    'familiar',
    'mount',
    'covenant',       // Ars Magica
    'laboratory',     // Ars Magica
    'manor',          // Pendragon
    'holding',        // Various
    'coterie',        // World of Darkness
    'cell',           // Hunter (WoD)
    'group',          // World of Darkness
    'host',           // Shadowrun
    'ic',             // Shadowrun (Intrusion Countermeasures)
    'sprite',         // Shadowrun
    'device',         // Shadowrun
    'voidship',       // Warhammer 40k
    'army',           // Legend of the Five Rings
    'marker',         // Cypher System
  ],
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
 *
 * Classification priority:
 * 1. hasPlayerOwner = true → PC (Foundry user assigned as owner)
 * 2. actor.type in pcTypes → PC (type-based detection for unassigned PCs)
 * 3. actor.type in monsterTypes → Monster (with custom classifier if available)
 * 4. actor.type in npcTypes → NPC (with custom classifier if available)
 * 5. Fallback → NPC
 *
 * @param {Actor} actor - Foundry VTT Actor
 * @returns {CharacterType} Character type classification
 */
export function classifyActor(actor) {
  if (!actor) return 'npc'

  const config = getSystemConfig()
  const actorType = actor.type?.toLowerCase()

  // Priority 1: Player-owned actors are always PCs
  // This is the most reliable signal - a Foundry user has ownership
  if (actor.hasPlayerOwner) {
    Logger.debug('Actor classified as PC (hasPlayerOwner)', {
      name: actor.name,
      type: actor.type
    })
    return 'pc'
  }

  // Priority 2: Check if actor type is in pcTypes
  // This catches PCs that don't have a Foundry user assigned yet
  // (e.g., pregens, campaign templates, or PCs created before player joins)
  const isPcType = config.pcTypes.some(
    pcType => actorType === pcType.toLowerCase()
  )

  if (isPcType) {
    Logger.debug('Actor classified as PC (type-based)', {
      name: actor.name,
      type: actor.type,
      hasPlayerOwner: false
    })
    return 'pc'
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
