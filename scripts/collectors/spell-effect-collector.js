/**
 * Spell Effect Collector
 * Intercepts spell casts in Foundry VTT to consume buff/debuff effects applied by Tumulte.
 *
 * When a spell has a Tumulte flag (buff or debuff), the collector:
 * 1. Detects the spell being used via system-specific hooks
 * 2. Modifies the roll (advantage/disadvantage/bonus/penalty) when possible
 * 3. Removes the flag after consumption (single-use)
 * 4. Notifies the backend that the effect was consumed
 *
 * Multi-system support:
 * - dnd5e 5.x: preRollAttack + postUseActivity (full pre-roll modification)
 * - dnd5e 4.x: preUseItem + useItem (legacy fallback)
 * - pf2e: pf2e.preRollCheck (pre-roll modification)
 * - wfrp4e: wfrp4e.rollTest (pre-roll modifier)
 * - All other systems: Universal createChatMessage hook (narrative annotation + consumption)
 */

import Logger from '../utils/logger.js'

const MODULE_ID = 'tumulte-integration'
const FLAG_KEY = 'spellEffect'
const DISABLED_FLAG_KEY = 'disabled'

/**
 * Spell-like item types per game system.
 * Aligned with system-adapters.js extractSpells() implementations.
 */
const SPELL_ITEM_TYPES = {
  'dnd5e': ['spell'],
  'pf2e': ['spell'],
  'CoC7': ['spell'],
  'wfrp4e': ['spell', 'prayer'],
  'swade': ['power'],
  'cyberpunk-red-core': ['program'],
  'alienrpg': [], // no spell-like items
  'forbidden-lands': ['spell'],
  'vaesen': ['spell', 'ritual'],
  'blades-in-the-dark': ['ghost', 'ritual'],
  'vtm5e': ['discipline', 'power'],
  'wod5e': ['discipline', 'power'],
  'shadowrun5e': ['spell', 'complex_form', 'adept_power'],
  'shadowrun6-eden': ['spell', 'complex_form', 'adept_power'],
  'starwarsffg': ['forcepower', 'power'],
  'genesys': ['forcepower', 'power'],
  'fate-core-official': ['power', 'extra'],
}

/** Systems that have native pre-roll hook support */
const PRE_ROLL_SYSTEMS = ['dnd5e', 'pf2e', 'wfrp4e']

export class SpellEffectCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.systemId = null
    // Track which spells have had their roll modified (to consume flag after roll, not just after use)
    this._pendingConsumption = new Map()
  }

  /**
   * Initialize the collector — register system-specific hooks (idempotent)
   */
  initialize() {
    if (this._initialized) {
      Logger.debug('Spell Effect Collector already initialized, skipping hook registration')
      return
    }

    this.systemId = game.system.id
    this.registerHooks()
    this._initialized = true
    Logger.info('Spell Effect Collector initialized', { system: this.systemId })
  }

  /**
   * Register hooks based on the game system.
   *
   * Strategy:
   * 1. System-specific pre-roll hooks for systems that support them (dnd5e, pf2e, wfrp4e)
   * 2. Universal createChatMessage hook for ALL non-dnd5e systems (consumption + annotation)
   *
   * dnd5e is excluded from the universal hook because it handles everything
   * via its own pre-roll + post-use activity hooks.
   */
  registerHooks() {
    // 1. Register system-specific pre-roll hooks (if available)
    switch (this.systemId) {
      case 'dnd5e':
        this.registerDnd5eHooks()
        break
      case 'pf2e':
        this.registerPf2eHooks()
        break
      case 'wfrp4e':
        this.registerWfrp4eHooks()
        break
    }

    // 2. Register universal chat intercept for ALL non-dnd5e systems
    // dnd5e handles everything via preRollAttack + postUseActivity
    if (this.systemId !== 'dnd5e') {
      this.registerUniversalChatHooks()
    }

    // 3. Log what was registered
    const hasPreRoll = PRE_ROLL_SYSTEMS.includes(this.systemId)
    Logger.info('Spell Effect Collector hooks registered', {
      system: this.systemId,
      preRollSupport: hasPreRoll,
      itemTypes: this._getSpellItemTypes(),
    })
  }

  // ========================================
  // D&D 5e Hooks (v4.x + v5.x compatible)
  // ========================================

  registerDnd5eHooks() {
    const dnd5eVersion = game.system.version || '0'
    const major = parseInt(dnd5eVersion.split('.')[0], 10)

    if (major >= 5) {
      this._registerDnd5eV5Hooks()
    } else {
      this._registerDnd5eV4Hooks()
    }

    Logger.info('D&D 5e spell hooks registered', { version: dnd5eVersion, major })
  }

  /**
   * dnd5e 5.x hooks — Activities-based system
   *
   * Hook flow for a spell attack:
   *   preUseActivity → [dialog] → preRollAttack → [roll] → postUseActivity
   *
   * - preRollAttack: modify the roll config (advantage/disadvantage/bonus)
   * - postUseActivity: consume the flag after the spell is used
   */
  _registerDnd5eV5Hooks() {
    // 1. Pre-roll: Apply advantage/disadvantage/bonus to attack rolls
    Hooks.on('dnd5e.preRollAttack', (config, dialog, message) => {
      return this._onDnd5ePreRollAttack(config, dialog, message)
    })

    // 2. Also hook damage rolls for bonus/penalty on damage
    Hooks.on('dnd5e.preRollDamage', (config, dialog, message) => {
      return this._onDnd5ePreRollDamage(config, dialog, message)
    })

    // 3. Post-use: Consume the flag after the spell activity completes
    Hooks.on('dnd5e.postUseActivity', (activity, usageConfig, results) => {
      this._onDnd5ePostUseActivity(activity, usageConfig, results)
    })

    Logger.info('D&D 5e v5.x hooks registered (preRollAttack + postUseActivity)')
  }

  /**
   * dnd5e 4.x legacy hooks — preUseItem / useItem
   */
  _registerDnd5eV4Hooks() {
    Hooks.on('dnd5e.preUseItem', (item, config, options) => {
      return this._onDnd5eLegacyPreUseItem(item, config, options)
    })

    Hooks.on('dnd5e.useItem', (item, config, options) => {
      this._onDnd5eLegacyUseItem(item, config, options)
    })

    Logger.info('D&D 5e v4.x legacy hooks registered (preUseItem + useItem)')
  }

  // ----------------------------------------
  // dnd5e 5.x: Attack roll modification
  // ----------------------------------------

  /**
   * Before an attack roll in dnd5e 5.x
   * config: AttackRollProcessConfiguration (extends D20RollProcessConfiguration)
   *   - config.subject: the Activity (attack activity)
   *   - config.advantage / config.disadvantage: booleans
   *   - config.rolls[]: D20RollConfiguration[] with .parts[] and .options
   */
  _onDnd5ePreRollAttack(config, dialog, message) {
    const item = this._resolveItemFromConfig(config)
    if (!item) return true

    const effect = item.getFlag(MODULE_ID, FLAG_KEY)
    if (!effect) return true

    Logger.info('Applying Tumulte effect to attack roll', {
      spellName: item.name,
      effectType: effect.type,
      buffType: effect.buffType,
      debuffType: effect.debuffType,
    })

    if (effect.type === 'buff') {
      if (effect.buffType === 'advantage') {
        config.advantage = true
      } else if (effect.buffType === 'bonus' && effect.bonusValue) {
        this._addPartsToRolls(config, `+${effect.bonusValue}`)
      }
    } else if (effect.type === 'debuff') {
      if (effect.debuffType === 'disadvantage') {
        config.disadvantage = true
      } else if (effect.debuffType === 'penalty' && effect.penaltyValue) {
        this._addPartsToRolls(config, `-${effect.penaltyValue}`)
      }
    }

    // Mark for consumption after the activity completes
    this._pendingConsumption.set(item.id, { effect, itemName: item.name, itemImg: item.img })

    return true
  }

  /**
   * Before a damage roll in dnd5e 5.x — apply bonus/penalty to damage if configured
   */
  _onDnd5ePreRollDamage(config, dialog, message) {
    const item = this._resolveItemFromConfig(config)
    if (!item) return true

    const effect = item.getFlag(MODULE_ID, FLAG_KEY)
    if (!effect) return true

    // Only apply numeric bonus/penalty to damage (advantage/disadvantage don't affect damage)
    if (effect.type === 'buff' && effect.buffType === 'bonus' && effect.bonusValue) {
      this._addPartsToRolls(config, `+${effect.bonusValue}`)
      Logger.info('Applied bonus to damage roll', { spellName: item.name, bonus: effect.bonusValue })
    } else if (effect.type === 'debuff' && effect.debuffType === 'penalty' && effect.penaltyValue) {
      this._addPartsToRolls(config, `-${effect.penaltyValue}`)
      Logger.info('Applied penalty to damage roll', { spellName: item.name, penalty: effect.penaltyValue })
    }

    return true
  }

  // ----------------------------------------
  // dnd5e 5.x: Flag consumption after use
  // ----------------------------------------

  /**
   * After an activity is used in dnd5e 5.x — consume the buff/debuff flag
   * activity.item gives us the Item document
   */
  async _onDnd5ePostUseActivity(activity, usageConfig, results) {
    const item = activity?.item
    if (!item) return

    const effect = item.getFlag(MODULE_ID, FLAG_KEY)
    if (!effect) {
      // Also check pending consumption (in case flag was already read from preRollAttack)
      if (this._pendingConsumption.has(item.id)) {
        this._pendingConsumption.delete(item.id)
        Logger.info('Pending spell effect consumption (flag may have been cleared)', {
          spellName: item.name,
        })
      }
      return
    }

    Logger.info('Consuming spell effect after activity use', {
      spellName: item.name,
      effectType: effect.type,
      requestId: effect.requestId,
    })

    // Remove the flag (single-use effect)
    await item.unsetFlag(MODULE_ID, FLAG_KEY)

    // Clear from pending consumption
    this._pendingConsumption.delete(item.id)

    // Re-render the actor sheet to remove the visual highlighting
    item.actor?.sheet?.render(false)

    // Send chat message about consumption
    await this._sendConsumptionMessage(item, effect)

    // Notify the backend
    this._notifyBackend(item, effect)
  }

  // ----------------------------------------
  // dnd5e 4.x legacy handlers
  // ----------------------------------------

  _onDnd5eLegacyPreUseItem(item, config, options) {
    if (item.type !== 'spell') return true

    const effect = item.getFlag(MODULE_ID, FLAG_KEY)
    if (!effect) return true

    Logger.info('Legacy: Spell with Tumulte effect being cast', {
      spellName: item.name,
      effectType: effect.type,
    })

    if (effect.type === 'buff') {
      if (effect.buffType === 'advantage') {
        if (config.rollConfigs) {
          config.rollConfigs.forEach(rc => {
            rc.options = rc.options || {}
            rc.options.advantage = true
          })
        }
      } else if (effect.buffType === 'bonus' && effect.bonusValue) {
        if (config.rollConfigs) {
          config.rollConfigs.forEach(rc => {
            rc.parts = rc.parts || []
            rc.parts.push(`+${effect.bonusValue}`)
          })
        }
      }
    } else if (effect.type === 'debuff') {
      if (effect.debuffType === 'disadvantage') {
        if (config.rollConfigs) {
          config.rollConfigs.forEach(rc => {
            rc.options = rc.options || {}
            rc.options.disadvantage = true
          })
        }
      } else if (effect.debuffType === 'penalty' && effect.penaltyValue) {
        if (config.rollConfigs) {
          config.rollConfigs.forEach(rc => {
            rc.parts = rc.parts || []
            rc.parts.push(`-${effect.penaltyValue}`)
          })
        }
      }
    }

    return true
  }

  async _onDnd5eLegacyUseItem(item, config, options) {
    if (item.type !== 'spell') return

    const effect = item.getFlag(MODULE_ID, FLAG_KEY)
    if (!effect) return

    Logger.info('Legacy: Consuming spell effect after cast', {
      spellName: item.name,
      effectType: effect.type,
      requestId: effect.requestId,
    })

    await item.unsetFlag(MODULE_ID, FLAG_KEY)
    item.actor?.sheet?.render(false)
    await this._sendConsumptionMessage(item, effect)
    this._notifyBackend(item, effect)
  }

  // ========================================
  // Pathfinder 2e Hooks
  // ========================================

  /**
   * PF2e: register only the pre-roll check hook.
   * Post-use consumption is handled by the universal chat hook.
   */
  registerPf2eHooks() {
    Hooks.on('pf2e.preRollCheck', (roll, context) => {
      return this._onPf2ePreRollCheck(roll, context)
    })

    Logger.info('PF2e spell hooks registered (preRollCheck)')
  }

  /**
   * Before a PF2e check is rolled — apply modifiers
   */
  _onPf2ePreRollCheck(roll, context) {
    const item = context?.item
    if (!item || item.type !== 'spell') return true

    const effect = item.getFlag(MODULE_ID, FLAG_KEY)
    if (!effect) return true

    Logger.info('PF2e spell with Tumulte effect being cast', {
      spellName: item.name,
      effectType: effect.type,
    })

    if (context.options) {
      if (effect.type === 'buff') {
        if (effect.buffType === 'bonus' && effect.bonusValue) {
          context.options.push(`tumulte:bonus:${effect.bonusValue}`)
        }
      } else if (effect.type === 'debuff') {
        if (effect.debuffType === 'penalty' && effect.penaltyValue) {
          context.options.push(`tumulte:penalty:${effect.penaltyValue}`)
        }
      }
    }

    // Mark for consumption by the universal chat hook
    this._pendingConsumption.set(item.id, { effect, itemName: item.name, itemImg: item.img })

    return true
  }

  // ========================================
  // WFRP4e Hooks
  // ========================================

  /**
   * WFRP4e: hook into wfrp4e.rollTest to modify testModifier before the roll.
   * Post-use consumption is handled by the universal chat hook.
   *
   * WFRP4e uses d100 tests. Advantage/disadvantage are mapped to ±20 (fortune/misfortune).
   */
  registerWfrp4eHooks() {
    Hooks.on('wfrp4e.rollTest', (testData, cardOptions) => {
      const item = testData.item
      if (!item) return

      const spellTypes = this._getSpellItemTypes()
      if (!spellTypes.includes(item.type)) return

      const effect = item.getFlag(MODULE_ID, FLAG_KEY)
      if (!effect) return

      Logger.info('WFRP4e: Applying Tumulte effect to test', {
        spellName: item.name,
        effectType: effect.type,
      })

      // Apply numeric bonus/penalty to testModifier
      if (effect.type === 'buff') {
        if (effect.buffType === 'bonus' && effect.bonusValue) {
          testData.testModifier = (testData.testModifier || 0) + effect.bonusValue
        } else if (effect.buffType === 'advantage') {
          // WFRP4e convention: fortune/misfortune is ±20
          testData.testModifier = (testData.testModifier || 0) + 20
        }
      } else if (effect.type === 'debuff') {
        if (effect.debuffType === 'penalty' && effect.penaltyValue) {
          testData.testModifier = (testData.testModifier || 0) - effect.penaltyValue
        } else if (effect.debuffType === 'disadvantage') {
          testData.testModifier = (testData.testModifier || 0) - 20
        }
      }

      // Mark for consumption by the universal chat hook
      this._pendingConsumption.set(item.id, { effect, itemName: item.name, itemImg: item.img })

      Logger.info('WFRP4e: Tumulte modifier applied', {
        spellName: item.name,
        finalModifier: testData.testModifier,
      })
    })

    Logger.info('WFRP4e spell hooks registered (rollTest)')
  }

  // ========================================
  // Universal Chat Hook (all non-dnd5e systems)
  // ========================================

  /**
   * Register a universal createChatMessage hook that handles:
   * 1. Flag consumption for all systems (post-use cleanup)
   * 2. Narrative annotation for systems without pre-roll hooks
   *
   * This hook fires AFTER the message is created, so it cannot modify the roll,
   * but it can consume the flag and send follow-up annotation messages.
   */
  registerUniversalChatHooks() {
    Hooks.on('createChatMessage', async (message) => {
      try {
        await this._onUniversalChatMessage(message)
      } catch (error) {
        Logger.error('Error in universal chat hook', error)
      }
    })

    Logger.info('Universal chat hook registered')
  }

  /**
   * Universal handler for createChatMessage.
   * Handles both flag consumption and narrative annotation.
   */
  async _onUniversalChatMessage(message) {
    // Try to resolve the source item from the message
    const item = this._resolveItemFromMessage(message)
    if (!item) return

    // Check if item has a Tumulte spell effect flag
    const effect = item.getFlag(MODULE_ID, FLAG_KEY)

    if (!effect) {
      // Check pending consumption (from pre-roll hooks like pf2e/wfrp4e)
      if (this._pendingConsumption.has(item.id)) {
        const pending = this._pendingConsumption.get(item.id)
        this._pendingConsumption.delete(item.id)

        await item.unsetFlag(MODULE_ID, FLAG_KEY)
        item.actor?.sheet?.render(false)
        await this._sendConsumptionMessage(item, pending.effect)
        this._notifyBackend(item, pending.effect)
      }
      return
    }

    const hasPreRollSupport = PRE_ROLL_SYSTEMS.includes(this.systemId)

    // For systems WITHOUT pre-roll support: send narrative annotations
    if (!hasPreRollSupport) {
      Logger.info('Universal hook: applying narrative effect', {
        system: this.systemId,
        spellName: item.name,
        effectType: effect.type,
      })

      if (effect.type === 'buff') {
        if (effect.buffType === 'bonus' && effect.bonusValue) {
          await this._sendEffectAnnotation(item, effect, `+${effect.bonusValue}`)
        } else if (effect.buffType === 'advantage') {
          await this._sendAdvantageNotification(item, effect, 'advantage')
        }
      } else if (effect.type === 'debuff') {
        if (effect.debuffType === 'penalty' && effect.penaltyValue) {
          await this._sendEffectAnnotation(item, effect, `-${effect.penaltyValue}`)
        } else if (effect.debuffType === 'disadvantage') {
          await this._sendAdvantageNotification(item, effect, 'disadvantage')
        }
      }
    }

    // Consume the flag (all systems reaching this point)
    Logger.info('Universal hook: consuming spell effect', {
      spellName: item.name,
      effectType: effect.type,
      requestId: effect.requestId,
    })

    await item.unsetFlag(MODULE_ID, FLAG_KEY)
    this._pendingConsumption.delete(item.id)
    item.actor?.sheet?.render(false)
    await this._sendConsumptionMessage(item, effect)
    this._notifyBackend(item, effect)
  }

  // ========================================
  // Helpers
  // ========================================

  /**
   * Get spell-like item types for the current system.
   */
  _getSpellItemTypes() {
    return SPELL_ITEM_TYPES[this.systemId] || ['spell', 'power']
  }

  /**
   * Resolve the source Item from a roll process config.
   * In dnd5e 5.x, config.subject is the Activity, and Activity.item is the Item.
   */
  _resolveItemFromConfig(config) {
    // v5.x: config.subject is the Activity → activity.item is the Item
    const activity = config.subject
    if (activity?.item) return activity.item

    // Fallback: try direct item reference
    if (config.item) return config.item

    return null
  }

  /**
   * Resolve the source Item from a ChatMessage.
   *
   * This is the critical multi-system method. Each system stores item references
   * differently in chat messages. We try multiple strategies in order of reliability.
   */
  _resolveItemFromMessage(message) {
    // Ignore Tumulte's own messages to avoid infinite loops
    if (message.speaker?.alias === 'Tumulte') return null

    // Method 1: Direct item reference (some systems attach item to message object)
    if (message.item) {
      const spellTypes = this._getSpellItemTypes()
      if (spellTypes.includes(message.item.type)) return message.item
    }

    // Method 2: getAssociatedItem (Foundry v12+)
    if (typeof message.getAssociatedItem === 'function') {
      try {
        const item = message.getAssociatedItem()
        if (item) {
          const spellTypes = this._getSpellItemTypes()
          if (spellTypes.includes(item.type)) return item
        }
      } catch {
        // getAssociatedItem may throw in some systems
      }
    }

    // Method 3: Resolve via speaker actor + flags
    const actorId = message.speaker?.actor
    if (!actorId) return null
    const actor = game.actors?.get(actorId)
    if (!actor) return null

    // 3a. Check system-specific message flags for item ID
    const itemId = this._extractItemIdFromFlags(message)
    if (itemId) {
      const item = actor.items.get(itemId)
      if (item) {
        const spellTypes = this._getSpellItemTypes()
        if (spellTypes.includes(item.type)) return item
      }
    }

    // 3b. Fallback: scan actor's spell-like items for Tumulte flags + name match
    // This is the last resort for systems that don't store item refs in messages
    return this._resolveItemByNameMatch(actor, message)
  }

  /**
   * Extract item ID from system-specific message flags.
   */
  _extractItemIdFromFlags(message) {
    try {
      // Foundry core flag
      const coreItemId = message.getFlag?.('core', 'itemId')
      if (coreItemId) return coreItemId

      // System-specific flags (each system stores item refs differently)
      const flags = message.flags || {}

      // dnd5e
      if (flags.dnd5e?.use?.itemId) return flags.dnd5e.use.itemId
      if (flags.dnd5e?.item?.id) return flags.dnd5e.item.id

      // pf2e: origin UUID like "Actor.xxx.Item.yyy"
      const pf2eOrigin = flags.pf2e?.origin?.uuid
      if (pf2eOrigin) {
        const parts = pf2eOrigin.split('.')
        const itemIdx = parts.indexOf('Item')
        if (itemIdx >= 0 && parts[itemIdx + 1]) return parts[itemIdx + 1]
      }

      // wfrp4e
      if (flags.wfrp4e?.itemId) return flags.wfrp4e.itemId

      // CoC7
      if (flags.CoC7?.itemId) return flags.CoC7.itemId

      // SWADE
      if (flags.swade?.itemId) return flags.swade.itemId

      // Generic: some systems use flags.core.sourceId or flags.item.id
      if (flags.core?.sourceId) {
        const parts = flags.core.sourceId.split('.')
        const itemIdx = parts.indexOf('Item')
        if (itemIdx >= 0 && parts[itemIdx + 1]) return parts[itemIdx + 1]
      }
    } catch {
      // Flag extraction should never throw — silently skip
    }

    return null
  }

  /**
   * Last-resort item resolution: scan the actor's spell-like items
   * for items that have a Tumulte flag AND whose name appears in the message.
   */
  _resolveItemByNameMatch(actor, message) {
    const spellTypes = this._getSpellItemTypes()
    if (spellTypes.length === 0) return null

    const content = (message.content || '') + ' ' + (message.flavor || '')

    for (const item of actor.items) {
      if (!spellTypes.includes(item.type)) continue

      // Must have a Tumulte flag to be relevant
      const hasEffect = item.getFlag(MODULE_ID, FLAG_KEY)
      const hasDisabled = item.getFlag(MODULE_ID, DISABLED_FLAG_KEY)
      if (!hasEffect && !hasDisabled) continue

      // Check if item name appears in the message
      if (item.name && content.includes(item.name)) {
        Logger.info('Resolved item via name match fallback', {
          itemName: item.name,
          itemId: item.id,
          system: this.systemId,
        })
        return item
      }
    }

    return null
  }

  /**
   * Add a bonus/penalty string to all rolls in a process config.
   * Works with both v4.x (rollConfigs) and v5.x (rolls) structures.
   */
  _addPartsToRolls(config, partString) {
    // v5.x: config.rolls is the array of roll configurations
    if (config.rolls && Array.isArray(config.rolls)) {
      for (const roll of config.rolls) {
        roll.parts = roll.parts || []
        roll.parts.push(partString)
      }
    }
    // v4.x fallback: config.rollConfigs
    if (config.rollConfigs && Array.isArray(config.rollConfigs)) {
      for (const rc of config.rollConfigs) {
        rc.parts = rc.parts || []
        rc.parts.push(partString)
      }
    }
  }

  /**
   * Send a chat message about effect consumption.
   */
  async _sendConsumptionMessage(item, effect) {
    const label = effect.type === 'buff' ? 'amplification' : 'malédiction'
    await ChatMessage.create({
      content: `
        <div class="tumulte-spell-effect-consumed">
          <img src="${item.img}" width="24" height="24" style="vertical-align:middle; border:none; margin-right:6px"/>
          L'effet de <strong>${label}</strong> sur <strong>${item.name}</strong> a été consommé !
        </div>
      `,
      speaker: { alias: 'Tumulte' },
    })
  }

  /**
   * Send a narrative annotation when an effect is applied on a system without pre-roll support.
   * Shows the bonus/penalty that should have been applied.
   */
  async _sendEffectAnnotation(item, effect, modifier) {
    const label = effect.type === 'buff' ? 'Amplification' : 'Malédiction'
    const color = effect.type === 'buff' ? '#10B981' : '#EF4444'
    await ChatMessage.create({
      content: `
        <div class="tumulte-spell-effect-annotation" style="border-left: 3px solid ${color}; padding: 4px 8px; margin: 4px 0;">
          <img src="${item.img}" width="20" height="20" style="vertical-align:middle; border:none; margin-right:4px"/>
          <strong style="color:${color}">${label} Tumulte</strong> sur <em>${item.name}</em> : <strong>${modifier}</strong> au jet
          <br><small style="opacity:0.7">Le MJ peut ajuster le résultat manuellement</small>
        </div>
      `,
      speaker: { alias: 'Tumulte' },
    })
  }

  /**
   * Send a notification for advantage/disadvantage on systems without pre-roll support.
   * Visible to all players so the table knows the effect is active.
   */
  async _sendAdvantageNotification(item, effect, type) {
    const label = type === 'advantage' ? 'AVANTAGE' : 'DÉSAVANTAGE'
    const icon = type === 'advantage' ? 'fa-arrow-up' : 'fa-arrow-down'
    const color = type === 'advantage' ? '#10B981' : '#EF4444'
    const instruction = type === 'advantage' ? 'avantage' : 'désavantage'

    await ChatMessage.create({
      content: `
        <div class="tumulte-spell-effect-annotation" style="border-left: 3px solid ${color}; padding: 4px 8px;">
          <i class="fas ${icon}" style="color:${color}"></i>
          <strong style="color:${color}">${label}</strong> Tumulte sur <em>${item.name}</em> !
          <br><small style="opacity:0.7">Le MJ doit appliquer l'${instruction} manuellement pour ce jet</small>
        </div>
      `,
      speaker: { alias: 'Tumulte' },
    })
  }

  /**
   * Notify the backend that an effect was consumed.
   */
  _notifyBackend(item, effect) {
    this.socket.emit('spell:effect:consumed', {
      spellId: item.id,
      spellName: item.name,
      effectType: effect.type,
      requestId: effect.requestId,
    })
  }
}

export default SpellEffectCollector
