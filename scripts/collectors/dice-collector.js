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
    // Only process if enabled
    if (!this.enabled) return

    // Only process rolls
    if (!message.isRoll) return

    // Skip messages without rolls
    if (!message.rolls || message.rolls.length === 0) return

    // Process each roll in the message
    for (const roll of message.rolls) {
      await this.processRoll(message, roll)
    }
  }

  /**
   * Process a single dice roll
   */
  async processRoll(message, roll) {
    try {
      // Extract roll data using system adapter
      const rollData = this.systemAdapter.extractRollData(message, roll)

      // Add world/campaign info
      rollData.worldId = game.world.id
      rollData.campaignId = game.world.id // Use world ID as campaign ID

      // Check if we should send this roll
      if (!this.shouldSendRoll(rollData)) {
        Logger.debug('Roll not sent (filtered)', { formula: rollData.rollFormula })
        return
      }

      // Send to Tumulte via WebSocket
      const sent = this.socket.emit('dice:roll', rollData)

      if (sent) {
        Logger.debug('Dice roll sent', {
          formula: rollData.rollFormula,
          result: rollData.result,
          isCritical: rollData.isCritical
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
