/**
 * Dice Roll Collector
 * Captures dice rolls from Foundry VTT and sends them to Tumulte
 */

import Logger from '../utils/logger.js'
import { getSystemAdapter } from '../utils/system-adapters.js'

const MODULE_ID = 'tumulte-integration'

export class DiceCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.systemAdapter = null
    this.enabled = true
    this.sendAllRolls = false
  }

  /**
   * Initialize the collector
   */
  initialize() {
    this.systemAdapter = getSystemAdapter()

    // Load settings
    this.loadSettings()

    // Register hook for chat messages (dice rolls)
    Hooks.on('createChatMessage', this.onChatMessage.bind(this))

    // System-specific hooks
    this.registerSystemHooks()

    Logger.info('Dice Collector initialized', { system: game.system.id })
  }

  /**
   * Load settings
   */
  loadSettings() {
    try {
      this.sendAllRolls = game.settings.get(MODULE_ID, 'sendAllRolls')
    } catch {
      this.sendAllRolls = false
    }
  }

  /**
   * Register system-specific hooks
   */
  registerSystemHooks() {
    const systemId = game.system.id

    switch (systemId) {
      case 'dnd5e':
        // D&D 5e specific hooks
        Hooks.on('dnd5e.rollAttack', (item, roll) => {
          Logger.debug('D&D 5e attack roll detected', { item: item.name })
        })
        Hooks.on('dnd5e.rollDamage', (item, roll) => {
          Logger.debug('D&D 5e damage roll detected', { item: item.name })
        })
        break

      case 'pf2e':
        // Pathfinder 2e specific hooks
        Hooks.on('pf2e.rollCheck', (actor, roll, type) => {
          Logger.debug('PF2e check roll detected', { actor: actor.name, type })
        })
        break
    }
  }

  /**
   * Handle new chat messages
   */
  async onChatMessage(message, options, userId) {
    Logger.info('Chat message received', {
      isRoll: message.isRoll,
      hasRolls: message.rolls?.length > 0,
      rollCount: message.rolls?.length || 0,
      flavor: message.flavor,
      speaker: message.speaker
    })

    // Only process if enabled
    if (!this.enabled) {
      Logger.debug('Dice collector disabled, skipping')
      return
    }

    // Only process rolls
    if (!message.isRoll) {
      Logger.debug('Not a roll message, skipping')
      return
    }

    // Skip messages without rolls
    if (!message.rolls || message.rolls.length === 0) {
      Logger.debug('No rolls in message, skipping')
      return
    }

    // Process each roll in the message
    Logger.info(`Processing ${message.rolls.length} roll(s) from message`)
    for (const roll of message.rolls) {
      await this.processRoll(message, roll)
    }
  }

  /**
   * Process a single dice roll
   */
  async processRoll(message, roll) {
    try {
      // Log raw roll object for debugging
      Logger.info('Raw roll object', {
        formula: roll.formula,
        total: roll.total,
        terms: roll.terms?.map(t => ({
          class: t.constructor.name,
          faces: t.faces,
          results: t.results
        })),
        options: roll.options
      })

      // Extract roll data using system adapter
      const rollData = this.systemAdapter.extractRollData(message, roll)

      // Add world/campaign info
      rollData.worldId = game.world.id
      rollData.campaignId = game.world.id // Use world ID as campaign ID

      // Log full roll data for debugging
      Logger.info('Roll data extracted', {
        characterName: rollData.characterName,
        characterId: rollData.characterId,
        formula: rollData.rollFormula,
        result: rollData.result,
        rollType: rollData.rollType,
        isCritical: rollData.isCritical,
        criticalType: rollData.criticalType,
        // Enriched flavor data
        skill: rollData.skill,
        skillRaw: rollData.skillRaw,
        ability: rollData.ability,
        abilityRaw: rollData.abilityRaw,
        modifiers: rollData.modifiers
      })

      // Check if we should send this roll
      if (!this.shouldSendRoll(rollData)) {
        Logger.info('Roll filtered out (not critical, sendAllRolls disabled)', {
          formula: rollData.rollFormula,
          isCritical: rollData.isCritical,
          sendAllRolls: this.sendAllRolls
        })
        return
      }

      // Send to Tumulte via WebSocket
      Logger.info('Sending dice:roll event to Tumulte', { rollId: rollData.rollId })
      const sent = this.socket.emit('dice:roll', rollData)

      if (sent) {
        Logger.info('Dice roll sent successfully', {
          formula: rollData.rollFormula,
          result: rollData.result,
          isCritical: rollData.isCritical,
          rollType: rollData.rollType
        })
      } else {
        Logger.warn('Dice roll NOT sent - socket.emit returned false', {
          isConnected: this.socket?.isConnected?.()
        })
      }

    } catch (error) {
      Logger.error('Failed to process dice roll', error)
    }
  }

  /**
   * Determine if a roll should be sent to Tumulte
   */
  shouldSendRoll(rollData) {
    // Always send if sendAllRolls is enabled
    if (this.sendAllRolls) {
      return true
    }

    // Otherwise, only send critical rolls
    return rollData.isCritical
  }

  /**
   * Enable/disable the collector
   */
  setEnabled(enabled) {
    this.enabled = enabled
    Logger.info(`Dice Collector ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Update sendAllRolls setting
   */
  setSendAllRolls(value) {
    this.sendAllRolls = value
    Logger.debug('sendAllRolls setting updated', { value })
  }
}

export default DiceCollector
