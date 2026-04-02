/**
 * System Adapters for different game systems
 * Provides unified interface for extracting data from various RPG systems
 */

import Logger from './logger.js'
import { createFlavorParser } from './flavor-parser.js'
import type { FlavorParser, ParsedFlavor } from './flavor-parser.js'
import { extractUniversalRollData } from './term-extractor.js'
import type { TermData, UniversalRollData } from './term-extractor.js'

// ─── Extended Foundry Types (runtime properties not in base declarations) ─────

/** ChatMessage at runtime exposes `whisper` and a `speaker` with `.actor` (not `.actorId`) */
interface RuntimeChatMessage extends FoundryChatMessage {
  whisper?: unknown[]
}

/** Foundry speaker at runtime uses `.actor` for the actor ID string */
interface RuntimeChatSpeaker extends ChatSpeaker {
  actor?: string
}

/** Foundry Roll at runtime may carry `options`, `degreeOfSuccess`, etc. */
interface ExtendedRoll extends FoundryRoll {
  degreeOfSuccess?: number
  options?: Record<string, unknown>
}

/** Extended die result with runtime properties */
interface ExtendedDieResult extends DieResult {
  exploded?: boolean
  symbols?: Array<{ type: string; count: number; icon?: string }>
}

/** Extended dice term with runtime options */
interface ExtendedDiceTerm extends FoundryDiceTerm {
  options?: Record<string, unknown>
}

// ─── Data Structure Interfaces ───────────────────────────────────────────────

/** HP / resource gauge */
export interface ResourceGauge {
  current: number
  max: number
  temp?: number
}

/** Minimal stat value */
export interface StatValue {
  value: number
}

/** Ability score with modifier and save */
export interface AbilityScore {
  value: number
  mod: number
  save: number
}

/** WFRP / CoC characteristic with value and optional bonus */
export interface CharacteristicValue {
  value: number
  bonus?: number
}

/** SWADE attribute die */
export interface SwadeAttributeDie {
  die: number
  modifier: number
}

/** Year Zero Engine attribute with value/max */
export interface YZAttribute {
  value: number
  max: number
}

/** FATE stress track */
export interface FateStressTrack {
  name: string
  boxes: number
  marked: number
}

/** FATE consequence */
export interface FateConsequence {
  name: string
  severity: string
  active: boolean
}

/** Spell / magical ability extracted from an actor */
export interface ExtractedSpell {
  id: string
  name: string
  img: string | null
  type: string
  level: number | string | null
  school: string | null
  prepared: boolean | null
  uses: { value: number | null; max: number | null } | null
}

/** Feature / ability / talent extracted from an actor */
export interface ExtractedFeature {
  id: string
  name: string
  img: string | null
  type: string
  subtype: string | null
  uses: { value: number | null; max: number | null; per?: string | null } | null
}

/** Inventory item extracted from an actor */
export interface ExtractedInventoryItem {
  id: string
  name: string
  type: string
  quantity: number
  equipped: boolean
  img: string
}

/** Criticality analysis result (V2) */
export interface CriticalityResult {
  isCritical: boolean
  criticalType: string | null
  severity: string | null
  label: string | null
  labelLocalized: string | null
  systemCriticalCategory: string | null
  description: string | null
}

/** Roll metadata included in extracted roll data */
export interface RollMetadata {
  foundryMessageId: string
  foundryActorId: string | undefined
  flavor: string | undefined
  system: string
  systemId: string
  timestamp: number
  parsedFlavor: ParsedFlavor
}

/** Complete extracted roll data returned by adapters */
export interface ExtractedRollData {
  characterId: string
  characterName: string
  rollId: string
  rollFormula: string
  result: number | undefined
  diceResults: number[]
  isCritical: boolean
  criticalType: string | null
  severity: string | null
  criticalLabel: string | null
  criticalCategory: string | null
  isHidden: boolean
  rollType: string
  terms: TermData[]
  systemData: UniversalRollData['systemData']
  skill: string | null
  skillRaw: string | null
  ability: string | null
  abilityRaw: string | null
  modifiers: string[]
  metadata: RollMetadata
}

/** Character stats shape (varies per system, so use Record for flexibility) */
export type CharacterStats = Record<string, unknown>

// ─── Narrative dice symbols for Star Wars FFG ────────────────────────────────

interface FFGSymbols {
  success: number
  failure: number
  advantage: number
  threat: number
  triumph: number
  despair: number
  [key: string]: number
}

// ─── Shadowrun pool count result ─────────────────────────────────────────────

interface PoolCount {
  ones: number
  hits: number
  totalDice: number
}

// ─── Base Adapter ────────────────────────────────────────────────────────────

/**
 * Base adapter with generic implementation
 */
class GenericAdapter {
  protected flavorParser: FlavorParser | null

  constructor() {
    this.flavorParser = null
  }

  get systemId(): string {
    return 'generic'
  }

  /**
   * Initialize the adapter (call after game is ready)
   */
  initialize(): void {
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
  extractRollData(message: RuntimeChatMessage, roll: ExtendedRoll): ExtractedRollData {
    const speaker = message.speaker as RuntimeChatSpeaker
    const actor = game.actors?.get(speaker?.actor ?? '')

    Logger.info('Extracting roll data (GenericAdapter)', {
      speaker,
      actorName: actor?.name,
      actorId: actor?.id,
      flavor: message.flavor,
      rollOptions: (roll as ExtendedRoll).options
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
      isHidden: (message.whisper?.length ?? 0) > 0,
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
  parseFlavorText(flavorText: string | undefined): ParsedFlavor {
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
        rollTypeRaw: null,
        modifiers: [],
        rawFlavor: flavorText ?? '',
        confidence: 0
      }
    }

    return this.flavorParser.parse(flavorText ?? '')
  }

  /**
   * Analyze criticality with enriched V2 data.
   * Returns severity, label, category in addition to isCritical/criticalType.
   * Subclasses override this for system-specific enrichment.
   */
  analyzeCriticality(roll: ExtendedRoll, _message: RuntimeChatMessage): CriticalityResult {
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
  extractDiceResults(roll: ExtendedRoll): number[] {
    const results: number[] = []
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
  detectCritical(roll: ExtendedRoll): boolean {
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
  detectCriticalType(roll: ExtendedRoll): string | null {
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
  detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
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
  extractStats(actor: FoundryActor): CharacterStats {
    return {
      name: actor.name,
      type: actor.type
    }
  }

  /**
   * Extract inventory items
   */
  extractInventory(_actor: FoundryActor): ExtractedInventoryItem[] {
    return []
  }

  /**
   * Extract spells / magical abilities from the actor.
   * Returns a flat array usable by the gamification spell system.
   */
  extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    // Generic fallback: look for items typed 'spell'
    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: (item.system as Record<string, unknown>)?.level as number ?? null,
        school: null,
        prepared: null,
        uses: null,
      }))
  }

  /**
   * Extract features / abilities / talents from the actor.
   */
  extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Helper to safely access nested system data ──────────────────────────────

/**
 * Safely access nested properties on the untyped `actor.system` object.
 * Shorthand for casting and traversing Record<string, unknown>.
 */
function sys(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** Cast sys() result to number with a fallback */
function sysNum(obj: Record<string, unknown> | undefined, path: string, fallback: number = 0): number {
  const v = sys(obj, path)
  return typeof v === 'number' ? v : fallback
}

/** Cast sys() result to string with a fallback */
function sysStr(obj: Record<string, unknown> | undefined, path: string, fallback: string = ''): string {
  const v = sys(obj, path)
  return typeof v === 'string' ? v : fallback
}

/** Cast sys() result to boolean with a fallback */
function sysBool(obj: Record<string, unknown> | undefined, path: string, fallback: boolean = false): boolean {
  const v = sys(obj, path)
  return typeof v === 'boolean' ? v : fallback
}

// ─── D&D 5e ──────────────────────────────────────────────────────────────────

/**
 * D&D 5e System Adapter
 */
class Dnd5eAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'dnd5e'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    // D&D 5e has specific critical detection via options
    if (roll.options?.critical !== undefined) {
      const d20Result = this.getD20Result(roll)
      return d20Result !== null && (d20Result >= (roll.options.critical as number) || d20Result === 1)
    }
    return super.detectCritical(roll)
  }

  getD20Result(roll: ExtendedRoll): number | null {
    for (const term of roll.terms || []) {
      if (term.faces === 20 && term.results && term.results.length > 0) {
        return term.results[0]!.result
      }
    }
    return null
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    Logger.info('D&D 5e detectRollType', {
      flavor: message.flavor,
      flavorLower: flavor,
      rollOptions: (_roll as ExtendedRoll).options
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

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: sysNum(system, 'attributes.hp.value'),
        max: sysNum(system, 'attributes.hp.max'),
        temp: sysNum(system, 'attributes.hp.temp')
      },
      ac: sysNum(system, 'attributes.ac.value'),
      level: sysNum(system, 'details.level'),
      class: sysStr(system, 'details.class'),
      race: sysStr(system, 'details.race'),
      abilities: this.extractAbilities(system),
      proficiencyBonus: sysNum(system, 'attributes.prof')
    }
  }

  extractAbilities(system: Record<string, unknown>): Record<string, AbilityScore> {
    const abilities: Record<string, AbilityScore> = {}
    const rawAbilities = sys(system, 'abilities') as Record<string, Record<string, unknown>> | undefined
    if (!rawAbilities) return abilities

    for (const [key, ability] of Object.entries(rawAbilities)) {
      abilities[key] = {
        value: typeof ability.value === 'number' ? ability.value : 0,
        mod: typeof ability.mod === 'number' ? ability.mod : 0,
        save: typeof ability.save === 'number' ? ability.save : 0
      }
    }
    return abilities
  }

  override extractInventory(actor: FoundryActor): ExtractedInventoryItem[] {
    if (!actor?.items) return []

    const inventoryTypes = ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack']
    return actor.items
      .filter(item => inventoryTypes.includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        quantity: sysNum(item.system, 'quantity', 1),
        equipped: sysBool(item.system, 'equipped'),
        img: item.img
      }))
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: sys(item.system, 'level') as number ?? null,
        school: sysStr(item.system, 'school') || null,
        prepared: sys(item.system, 'preparation.prepared') as boolean ?? null,
        uses: sys(item.system, 'uses') ? {
          value: sys(item.system, 'uses.value') as number ?? null,
          max: sys(item.system, 'uses.max') as number ?? null,
        } : null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'feat')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'feat',
        subtype: sysStr(item.system, 'type.value') || null,
        uses: sys(item.system, 'uses.max') ? {
          value: sys(item.system, 'uses.value') as number ?? null,
          max: sys(item.system, 'uses.max') as number ?? null,
          per: sysStr(item.system, 'uses.per') || null,
        } : null,
      }))
  }
}

// ─── Pathfinder 2e ───────────────────────────────────────────────────────────

/**
 * Pathfinder 2e System Adapter
 */
class Pf2eAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'pf2e'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    // PF2e uses degree of success
    if (roll.degreeOfSuccess !== undefined) {
      return roll.degreeOfSuccess === 3 || roll.degreeOfSuccess === 0
    }
    return super.detectCritical(roll)
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
    if (roll.degreeOfSuccess === 3) return 'success'
    if (roll.degreeOfSuccess === 0) return 'failure'
    return super.detectCriticalType(roll)
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: sysNum(system, 'attributes.hp.value'),
        max: sysNum(system, 'attributes.hp.max'),
        temp: sysNum(system, 'attributes.hp.temp')
      },
      ac: sysNum(system, 'attributes.ac.value'),
      level: sysNum(system, 'details.level.value'),
      ancestry: sysStr(system, 'details.ancestry.name'),
      class: sysStr(system, 'details.class.name')
    }
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'spell')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'spell',
        level: (sys(item.system, 'level.value') ?? sys(item.system, 'level')) as number ?? null,
        school: (sys(item.system, 'traditions.value') as string[] | undefined)?.[0] || null,
        prepared: sys(item.system, 'location.signature') as boolean ?? null,
        uses: sys(item.system, 'location.uses') ? {
          value: sys(item.system, 'location.uses.value') as number ?? null,
          max: sys(item.system, 'location.uses.max') as number ?? null,
        } : null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['feat', 'action'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: (sysStr(item.system, 'category') || sysStr(item.system, 'actionType.value')) || null,
        uses: sys(item.system, 'frequency') ? {
          value: sys(item.system, 'frequency.value') as number ?? null,
          max: sys(item.system, 'frequency.max') as number ?? null,
          per: sysStr(item.system, 'frequency.per') || null,
        } : null,
      }))
  }
}

// ─── Call of Cthulhu 7e ──────────────────────────────────────────────────────

/**
 * Call of Cthulhu 7e System Adapter
 */
class CoC7Adapter extends GenericAdapter {
  override get systemId(): string {
    return 'CoC7'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    // CoC7 uses percentile dice - critical on 01, fumble on 100
    const d100Result = this.getD100Result(roll)
    if (d100Result === 1) return true // Critical success
    if (d100Result === 100) return true // Fumble
    return false
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
    const d100Result = this.getD100Result(roll)
    if (d100Result === 1) return 'success'
    if (d100Result === 100) return 'failure'
    return null
  }

  getD100Result(roll: ExtendedRoll): number | null {
    // CoC7 often uses 2d10 (tens and units) or 1d100
    for (const term of roll.terms || []) {
      if (term.faces === 100 && term.results && term.results.length > 0) {
        return term.results[0]!.result
      }
    }
    return null
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('sanity')) return 'sanity'
    if (flavor.includes('luck')) return 'luck'
    if (flavor.includes('combat')) return 'combat'
    if (flavor.includes('skill')) return 'skill'
    if (flavor.includes('characteristic')) return 'characteristic'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: sysNum(system, 'attribs.hp.value'),
        max: sysNum(system, 'attribs.hp.max')
      },
      sanity: {
        current: sysNum(system, 'attribs.san.value'),
        max: sysNum(system, 'attribs.san.max')
      },
      luck: sysNum(system, 'attribs.lck.value'),
      occupation: sysStr(system, 'infos.occupation'),
      characteristics: this.extractCharacteristics(system)
    }
  }

  extractCharacteristics(system: Record<string, unknown>): Record<string, StatValue> {
    const chars: Record<string, StatValue> = {}
    const charList = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu']
    for (const char of charList) {
      const charData = sys(system, `characteristics.${char}`) as Record<string, unknown> | undefined
      if (charData) {
        chars[char] = {
          value: typeof charData.value === 'number' ? charData.value : 0
        }
      }
    }
    return chars
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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
        uses: sys(item.system, 'uses') ? {
          value: sys(item.system, 'uses.value') as number ?? null,
          max: sys(item.system, 'uses.max') as number ?? null,
        } : null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Warhammer Fantasy Roleplay 4e ──────────────────────────────────────────

/**
 * Warhammer Fantasy Roleplay 4e System Adapter
 */
class Wfrp4eAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'wfrp4e'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    // WFRP uses d100, doubles are special (11, 22, 33, etc)
    const d100Result = this.getD100Result(roll)
    if (!d100Result) return false

    // Check for doubles
    const tens = Math.floor(d100Result / 10)
    const units = d100Result % 10
    return tens === units
  }

  getD100Result(roll: ExtendedRoll): number | null {
    for (const term of roll.terms || []) {
      if (term.faces === 100 && term.results && term.results.length > 0) {
        return term.results[0]!.result
      }
    }
    return null
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('weapon')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('channelling')) return 'magic'
    if (flavor.includes('casting')) return 'magic'
    if (flavor.includes('skill')) return 'skill'
    if (flavor.includes('characteristic')) return 'characteristic'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      hp: {
        current: sysNum(system, 'status.wounds.value'),
        max: sysNum(system, 'status.wounds.max')
      },
      career: sysStr(system, 'details.career.value'),
      species: sysStr(system, 'details.species.value'),
      characteristics: this.extractCharacteristics(system)
    }
  }

  extractCharacteristics(system: Record<string, unknown>): Record<string, CharacteristicValue> {
    const chars: Record<string, CharacteristicValue> = {}
    const charList = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel']
    for (const char of charList) {
      const charData = sys(system, `characteristics.${char}`) as Record<string, unknown> | undefined
      if (charData) {
        chars[char] = {
          value: typeof charData.value === 'number' ? charData.value : 0,
          bonus: typeof charData.bonus === 'number' ? charData.bonus : 0
        }
      }
    }
    return chars
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    // WFRP4e has both 'spell' and 'prayer' item types
    return actor.items
      .filter(item => ['spell', 'prayer'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: sys(item.system, 'cn.value') as number ?? null,
        school: sysStr(item.system, 'lore.value') || null,
        prepared: sys(item.system, 'memorized.value') as boolean ?? null,
        uses: null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'trait'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: sys(item.system, 'tests.value') ? {
          value: null,
          max: null,
          per: null,
        } : null,
      }))
  }
}

// ─── Savage Worlds Adventure Edition ─────────────────────────────────────────

/**
 * Savage Worlds Adventure Edition System Adapter
 */
class SwadeAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'swade'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    // SWADE: Aces (max die result) and critical failures on snake eyes
    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          const extResult = result as ExtendedDieResult
          // Check for exploding dice (aces)
          if (extResult.exploded) return true
          // Check for 1s on trait dice (potential critical failure)
          if (extResult.result === 1 && term.faces !== undefined && term.faces >= 4) return true
        }
      }
    }
    return false
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
    let hasAce = false
    let hasOne = false

    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          const extResult = result as ExtendedDieResult
          if (extResult.exploded) hasAce = true
          if (extResult.result === 1) hasOne = true
        }
      }
    }

    if (hasAce) return 'success'
    if (hasOne) return 'failure'
    return null
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
    let aceCount = 0
    let hasOne = false

    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          const extResult = result as ExtendedDieResult
          if (extResult.exploded) aceCount++
          if (extResult.result === 1) hasOne = true
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('fighting') || flavor.includes('shooting')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('soak')) return 'soak'
    if (flavor.includes('benny')) return 'benny'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      isWildCard: sysBool(system, 'wildcard'),
      wounds: {
        current: sysNum(system, 'wounds.value'),
        max: sysNum(system, 'wounds.max')
      },
      fatigue: sysNum(system, 'fatigue.value'),
      bennies: sysNum(system, 'bennies.value'),
      attributes: this.extractAttributes(system)
    }
  }

  extractAttributes(system: Record<string, unknown>): Record<string, SwadeAttributeDie> {
    const attrs: Record<string, SwadeAttributeDie> = {}
    const attrList = ['agility', 'smarts', 'spirit', 'strength', 'vigor']
    for (const attr of attrList) {
      const attrData = sys(system, `attributes.${attr}`) as Record<string, unknown> | undefined
      if (attrData) {
        const die = attrData.die as Record<string, unknown> | undefined
        attrs[attr] = {
          die: typeof die?.sides === 'number' ? die.sides : 4,
          modifier: typeof die?.modifier === 'number' ? die.modifier : 0
        }
      }
    }
    return attrs
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    // SWADE uses 'power' item type for magical abilities
    return actor.items
      .filter(item => item.type === 'power')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'power',
        level: sys(item.system, 'rank') as number ?? null,
        school: sysStr(item.system, 'arcane') || null,
        prepared: null,
        uses: sys(item.system, 'pp') ? {
          value: sys(item.system, 'pp.value') as number ?? null,
          max: sys(item.system, 'pp.max') as number ?? null,
        } : null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['edge', 'hindrance', 'ability'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: sysBool(item.system, 'isNegative') ? 'hindrance' : null,
        uses: null,
      }))
  }
}

// ─── Cyberpunk RED ───────────────────────────────────────────────────────────

/**
 * Cyberpunk RED System Adapter
 */
class CyberpunkRedAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'cyberpunk-red-core'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
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

  override detectCriticalType(roll: ExtendedRoll): string | null {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack')) return 'attack'
    if (flavor.includes('damage')) return 'damage'
    if (flavor.includes('initiative')) return 'initiative'
    if (flavor.includes('death save')) return 'death-save'
    if (flavor.includes('skill')) return 'skill'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      role: sysStr(system, 'role.value') || sysStr(system, 'role') || null,
      hp: {
        current: sysNum(system, 'derivedStats.hp.value'),
        max: sysNum(system, 'derivedStats.hp.max')
      },
      humanity: sysNum(system, 'derivedStats.humanity.value'),
      stats: this.extractCyberStats(system)
    }
  }

  extractCyberStats(system: Record<string, unknown>): Record<string, number> {
    const stats: Record<string, number> = {}
    const statList = ['int', 'ref', 'dex', 'tech', 'cool', 'will', 'luck', 'move', 'body', 'emp']
    for (const stat of statList) {
      const statData = sys(system, `stats.${stat}`) as Record<string, unknown> | undefined
      if (statData) {
        stats[stat] = typeof statData.value === 'number' ? statData.value : 0
      }
    }
    return stats
  }

  // Cyberpunk RED: no traditional spells, but Netrunner programs serve a similar role
  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => item.type === 'program')
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: 'program',
        level: sysStr(item.system, 'class') || null,
        school: null,
        prepared: sys(item.system, 'equipped') as boolean ?? null,
        uses: null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Alien RPG ───────────────────────────────────────────────────────────────

/**
 * Alien RPG System Adapter
 */
class AlienRpgAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'alienrpg'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
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

  override detectCriticalType(roll: ExtendedRoll): string | null {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('panic')) return 'panic'
    if (flavor.includes('stress')) return 'stress'
    if (flavor.includes('attack') || flavor.includes('combat')) return 'attack'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      health: sysNum(system, 'header.health.value'),
      stress: sysNum(system, 'header.stress.value'),
      attributes: this.extractAlienAttributes(system)
    }
  }

  extractAlienAttributes(system: Record<string, unknown>): Record<string, number> {
    const attrs: Record<string, number> = {}
    const attrList = ['strength', 'agility', 'wits', 'empathy']
    for (const attr of attrList) {
      const attrData = sys(system, `attributes.${attr}`) as Record<string, unknown> | undefined
      if (attrData) {
        attrs[attr] = typeof attrData.value === 'number' ? attrData.value : 0
      }
    }
    return attrs
  }

  // Alien RPG has no spells — extractSpells returns [] via GenericAdapter

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Forbidden Lands ─────────────────────────────────────────────────────────

/**
 * Forbidden Lands System Adapter
 */
class ForbiddenLandsAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'forbidden-lands'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
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

  override detectCriticalType(roll: ExtendedRoll): string | null {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      kin: sysStr(system, 'bio.kin'),
      profession: sysStr(system, 'bio.profession'),
      attributes: this.extractFLAttributes(system)
    }
  }

  extractFLAttributes(system: Record<string, unknown>): Record<string, YZAttribute> {
    const attrs: Record<string, YZAttribute> = {}
    const attrList = ['strength', 'agility', 'wits', 'empathy']
    for (const attr of attrList) {
      const attrData = sys(system, `attribute.${attr}`) as Record<string, unknown> | undefined
      if (attrData) {
        attrs[attr] = {
          value: typeof attrData.value === 'number' ? attrData.value : 0,
          max: typeof attrData.max === 'number' ? attrData.max : 0
        }
      }
    }
    return attrs
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Vaesen ──────────────────────────────────────────────────────────────────

/**
 * Vaesen System Adapter
 */
class VaesenAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'vaesen'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      conditions: sys(system, 'condition') || {},
      attributes: this.extractVaesenAttributes(system)
    }
  }

  extractVaesenAttributes(system: Record<string, unknown>): Record<string, YZAttribute> {
    const attrs: Record<string, YZAttribute> = {}
    const attrList = ['physique', 'precision', 'logic', 'empathy']
    for (const attr of attrList) {
      const attrData = sys(system, `attribute.${attr}`) as Record<string, unknown> | undefined
      if (attrData) {
        attrs[attr] = {
          value: typeof attrData.value === 'number' ? attrData.value : 0,
          max: typeof attrData.max === 'number' ? attrData.max : 0
        }
      }
    }
    return attrs
  }

  // Vaesen: rituals/spells are rare but exist
  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Blades in the Dark ──────────────────────────────────────────────────────

/**
 * Blades in the Dark System Adapter
 */
class BladesInTheDarkAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'blades-in-the-dark'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
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

  override detectCriticalType(roll: ExtendedRoll): string | null {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const system = actor.system
    return {
      name: actor.name,
      type: actor.type,
      playbook: sysStr(system, 'playbook'),
      stress: sysNum(system, 'stress.value'),
      trauma: sysNum(system, 'trauma.value')
    }
  }

  // Blades in the Dark: no traditional spells, but ghost/arcane abilities exist
  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Vampire: The Masquerade 5e / World of Darkness 5e ───────────────────────

/**
 * Vampire: The Masquerade 5e / World of Darkness 5e System Adapter
 */
class Vtm5eAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'vtm5e'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
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

    // Critical: 2+ tens (messy or clean) or all ones (bestial failure)
    return tens >= 2 || (ones > 0 && this.getSuccessCount(roll) === 0)
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
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

  getSuccessCount(roll: ExtendedRoll): number {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
    let tens = 0
    let ones = 0
    let hungerTens = 0
    let hungerOnes = 0

    // V5 separates hunger dice from regular dice
    // Hunger dice are typically in a separate term or marked via options
    const terms = roll.terms || []
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i]!
      if (term.faces === 10 && term.results) {
        const extTerm = term as ExtendedDiceTerm
        const isHungerDie = extTerm.options?.flavor === 'hunger' || i > 0
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('frenzy')) return 'frenzy'
    if (flavor.includes('rouse')) return 'rouse'
    if (flavor.includes('remorse')) return 'remorse'
    if (flavor.includes('hunt')) return 'hunt'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      clan: sysStr(s, 'clan.value'),
      generation: sysNum(s, 'generation.value'),
      hunger: sysNum(s, 'hunger.value'),
      health: { value: sysNum(s, 'health.value'), max: sysNum(s, 'health.max') },
      willpower: { value: sysNum(s, 'willpower.value'), max: sysNum(s, 'willpower.max') },
      humanity: sysNum(s, 'humanity.value'),
      bloodPotency: sysNum(s, 'blood.potency'),
    }
  }

  // VtM5e: Disciplines are the "spells" of Vampire
  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['discipline', 'power'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        level: sys(item.system, 'level') as number ?? null,
        school: sysStr(item.system, 'discipline') || null,
        prepared: null,
        uses: sys(item.system, 'cost') ? {
          value: null,
          max: sys(item.system, 'cost') as number ?? null,
        } : null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Shadowrun 5e/6e ─────────────────────────────────────────────────────────

/**
 * Shadowrun 5e/6e System Adapter
 */
class ShadowrunAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'shadowrun5e'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    const { ones, totalDice } = this.countPool(roll)
    // Glitch: 50%+ ones
    // Critical Glitch: Glitch + 0 hits
    return ones >= Math.ceil(totalDice / 2)
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
    const { ones, totalDice, hits } = this.countPool(roll)
    const isGlitch = ones >= Math.ceil(totalDice / 2)

    if (isGlitch && hits === 0) return 'failure' // Critical Glitch
    if (isGlitch) return 'failure' // Regular Glitch (still a failure-type)
    return null
  }

  countPool(roll: ExtendedRoll): PoolCount {
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

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack') || flavor.includes('combat')) return 'attack'
    if (flavor.includes('damage') || flavor.includes('soak')) return 'damage'
    if (flavor.includes('initiative')) return 'initiative'
    if (flavor.includes('matrix') || flavor.includes('hack')) return 'matrix'
    if (flavor.includes('magic') || flavor.includes('spell') || flavor.includes('drain')) return 'magic'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      metatype: sysStr(s, 'metatype'),
      essence: sysNum(s, 'essence.value', 6),
      edge: { value: sysNum(s, 'edge.value'), max: sysNum(s, 'edge.max') },
      magic: sysNum(s, 'magic.value'),
      resonance: sysNum(s, 'resonance.value'),
      initiative: sysNum(s, 'initiative.value'),
      physicalDamage: sysNum(s, 'track.physical.value'),
      stunDamage: sysNum(s, 'track.stun.value'),
    }
  }

  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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
        school: sysStr(item.system, 'category') || sysStr(item.system, 'type') || null,
        prepared: null,
        uses: null,
      }))
  }

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['quality', 'echo', 'metamagic'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: sysStr(item.system, 'type') || null,
        uses: null,
      }))
  }
}

// ─── Star Wars FFG (Genesys) ─────────────────────────────────────────────────

/**
 * Star Wars FFG (Genesys) System Adapter
 * Handles narrative dice with symbols (Success, Failure, Advantage, Threat, Triumph, Despair)
 */
class StarWarsFFGAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'starwarsffg'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    const symbols = this.extractSymbols(roll)
    return symbols.triumph > 0 || symbols.despair > 0
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
    const symbols = this.extractSymbols(roll)
    if (symbols.triumph > 0) return 'success'
    if (symbols.despair > 0) return 'failure'
    return null
  }

  extractSymbols(roll: ExtendedRoll): FFGSymbols {
    const symbols: FFGSymbols = { success: 0, failure: 0, advantage: 0, threat: 0, triumph: 0, despair: 0 }

    // Try options first (some modules store symbols here)
    if (roll.options?.symbols) {
      const optSymbols = roll.options.symbols as Partial<FFGSymbols>
      symbols.success = optSymbols.success ?? symbols.success
      symbols.failure = optSymbols.failure ?? symbols.failure
      symbols.advantage = optSymbols.advantage ?? symbols.advantage
      symbols.threat = optSymbols.threat ?? symbols.threat
      symbols.triumph = optSymbols.triumph ?? symbols.triumph
      symbols.despair = optSymbols.despair ?? symbols.despair
      return symbols
    }

    // Parse from results
    for (const term of roll.terms || []) {
      if (term.results) {
        for (const result of term.results) {
          const extResult = result as ExtendedDieResult
          if (extResult.symbols) {
            for (const sym of extResult.symbols) {
              const current = symbols[sym.type]
              if (current !== undefined) {
                symbols[sym.type] = current + (sym.count || 1)
              }
            }
          }
          // Proficiency die (d12) face mapping for triumph
          if (extResult.result === 12 && term.faces === 12) symbols.triumph++
          // Challenge die (d12) face mapping for despair
          const extTerm = term as ExtendedDiceTerm
          if (extResult.result === 12 && term.faces === 12 && extTerm.options?.type === 'challenge') {
            symbols.despair++
          }
        }
      }
    }

    return symbols
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('combat') || flavor.includes('attack')) return 'attack'
    if (flavor.includes('force')) return 'force'
    if (flavor.includes('fear')) return 'fear'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      species: sysStr(s, 'species.value'),
      career: sysStr(s, 'career.value'),
      wounds: { current: sysNum(s, 'stats.wounds.value'), max: sysNum(s, 'stats.wounds.max') },
      strain: { current: sysNum(s, 'stats.strain.value'), max: sysNum(s, 'stats.strain.max') },
      soak: sysNum(s, 'stats.soak.value'),
      defense: { melee: sysNum(s, 'stats.defence.melee'), ranged: sysNum(s, 'stats.defence.ranged') },
      forceRating: sysNum(s, 'stats.forcePool.max'),
    }
  }

  // Star Wars FFG: Force powers are the "spells"
  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
    if (!actor?.items) return []

    return actor.items
      .filter(item => ['talent', 'specialization', 'signatureability'].includes(item.type))
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img || null,
        type: item.type,
        subtype: null,
        uses: sys(item.system, 'ranks') ? {
          value: sys(item.system, 'ranks.current') as number ?? null,
          max: sys(item.system, 'ranks.max') as number ?? null,
          per: null,
        } : null,
      }))
  }
}

// ─── FATE Core ───────────────────────────────────────────────────────────────

/**
 * FATE Core System Adapter
 * Uses 4 Fudge dice (4dF): each die has -1, 0, +1 faces. Range: -4 to +4.
 */
class FateAdapter extends GenericAdapter {
  override get systemId(): string {
    return 'fate-core-official'
  }

  override detectCritical(roll: ExtendedRoll): boolean {
    // FATE: +/-4 are extreme results (~1.2% chance each)
    return roll.total === 4 || roll.total === -4
  }

  override detectCriticalType(roll: ExtendedRoll): string | null {
    if (roll.total === 4) return 'success'
    if (roll.total === -4) return 'failure'
    return null
  }

  override analyzeCriticality(roll: ExtendedRoll, message: RuntimeChatMessage): CriticalityResult {
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

  override detectRollType(_roll: ExtendedRoll, message: RuntimeChatMessage): string {
    const flavor = (message.flavor || '').toLowerCase()

    if (flavor.includes('attack')) return 'attack'
    if (flavor.includes('defend')) return 'defend'
    if (flavor.includes('overcome')) return 'overcome'
    if (flavor.includes('create advantage') || flavor.includes('advantage')) return 'create-advantage'

    return super.detectRollType(_roll, message)
  }

  override extractStats(actor: FoundryActor): CharacterStats {
    if (!actor?.system) return super.extractStats(actor)

    const s = actor.system
    return {
      name: actor.name,
      type: actor.type,
      refresh: sysNum(s, 'fatePoints.refresh'),
      current: sysNum(s, 'fatePoints.current'),
      stress: this._extractStressTracks(s),
      consequences: this._extractConsequences(s),
    }
  }

  _extractStressTracks(system: Record<string, unknown>): FateStressTrack[] {
    const tracks: FateStressTrack[] = []
    const rawTracks = sys(system, 'tracks') as Record<string, Record<string, unknown>> | undefined
    if (!rawTracks) return tracks

    for (const [key, track] of Object.entries(rawTracks)) {
      if (track?.enabled) {
        tracks.push({
          name: (typeof track.name === 'string' ? track.name : key),
          boxes: typeof track.size === 'number' ? track.size : 0,
          marked: typeof track.value === 'number' ? track.value : 0
        })
      }
    }
    return tracks
  }

  _extractConsequences(system: Record<string, unknown>): FateConsequence[] {
    const consequences: FateConsequence[] = []
    const rawCons = sys(system, 'consequences') as Record<string, Record<string, unknown>> | undefined
    if (!rawCons) return consequences

    for (const [key, con] of Object.entries(rawCons)) {
      if (con?.name) {
        consequences.push({
          name: typeof con.name === 'string' ? con.name : '',
          severity: typeof con.severity === 'string' ? con.severity : key,
          active: !!con.value
        })
      }
    }
    return consequences
  }

  // FATE: extras/powers can act as "spells" in FATE-based settings
  override extractSpells(actor: FoundryActor): ExtractedSpell[] {
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

  override extractFeatures(actor: FoundryActor): ExtractedFeature[] {
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

// ─── Adapter Registry & Factory ──────────────────────────────────────────────

/** Map of system IDs to adapter constructors */
type AdapterConstructor = new () => GenericAdapter

const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
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

/**
 * Factory to get the appropriate adapter
 */
export function getSystemAdapter(): GenericAdapter {
  const systemId = game.system?.id

  const AdapterClass = (systemId ? ADAPTER_REGISTRY[systemId] : undefined) ?? GenericAdapter

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
