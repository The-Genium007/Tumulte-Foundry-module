/**
 * Tumulte WebSocket Client
 * Handles Socket.IO connection to Tumulte backend with auto-reconnect
 */

import Logger from '../utils/logger.js'
import TokenStorage from './token-storage.js'

const MODULE_ID = 'tumulte-integration'

export class TumulteSocketClient extends EventTarget {
  /**
   * Create a TumulteSocketClient instance
   * @param {Object} options - Configuration options
   * @param {string} options.worldId - Required: The Foundry world ID (game.world.id)
   * @param {string} options.serverUrl - Optional: Tumulte server URL
   * @param {TokenStorage} options.tokenStorage - Optional: Custom TokenStorage instance
   */
  constructor(options = {}) {
    super()

    if (!options.worldId) {
      throw new Error('TumulteSocketClient requires a worldId')
    }

    this.worldId = options.worldId
    this.serverUrl = options.serverUrl || 'http://localhost:3333'
    this.tokenStorage = options.tokenStorage || new TokenStorage(options.worldId)

    this.socket = null
    this.connected = false
    this.connecting = false

    // Reconnection settings
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10
    this.reconnectDelay = options.reconnectDelay || 1000
    this.maxReconnectDelay = options.maxReconnectDelay || 30000

    // Heartbeat
    this.lastPong = null

    // Bind methods
    this.handleConnect = this.handleConnect.bind(this)
    this.handleDisconnect = this.handleDisconnect.bind(this)
    this.handleError = this.handleError.bind(this)
    this.handlePing = this.handlePing.bind(this)
    this.handleRevoked = this.handleRevoked.bind(this)
  }

  /**
   * Update server URL (used after pairing provides the URL)
   */
  updateServerUrl(url) {
    this.serverUrl = url
    Logger.info('Socket client server URL updated', { url })
  }

  /**
   * Get Socket.IO library
   */
  getIO() {
    // Socket.IO should be loaded via vendor/socket.io.min.js
    if (typeof io !== 'undefined') {
      return io
    }
    throw new Error('Socket.IO not loaded. Please ensure vendor/socket.io.min.js is included.')
  }

  /**
   * Connect to Tumulte server
   */
  async connect() {
    if (this.connected || this.connecting) {
      Logger.debug('Already connected or connecting')
      return
    }

    const sessionToken = this.tokenStorage.getSessionToken()
    if (!sessionToken) {
      throw new Error('No session token available. Please complete pairing first.')
    }

    // Check if token needs refresh before connecting
    if (this.tokenStorage.isTokenExpired()) {
      Logger.info('Session token expired, attempting refresh...')
      await this.refreshToken()
    }

    this.connecting = true

    return new Promise((resolve, reject) => {
      try {
        const io = this.getIO()

        Logger.info('Connecting to Tumulte server...', { url: this.serverUrl })

        this.socket = io(`${this.serverUrl}/vtt`, {
          auth: {
            token: this.tokenStorage.getSessionToken()
          },
          transports: ['websocket'],
          reconnection: false, // We handle reconnection ourselves
          timeout: 10000
        })

        // Connection events
        this.socket.on('connect', () => {
          this.handleConnect()
          resolve()
        })

        this.socket.on('disconnect', this.handleDisconnect)
        this.socket.on('connect_error', (error) => {
          this.handleError(error)
          if (this.reconnectAttempts === 0) {
            reject(error)
          }
        })

        // Server events
        this.socket.on('connected', (data) => {
          Logger.info('Server acknowledged connection', data)
          this.dispatchEvent(new CustomEvent('server-connected', { detail: data }))
        })

        this.socket.on('ping', this.handlePing)
        this.socket.on('connection:revoked', this.handleRevoked)
        this.socket.on('campaign:deleted', this.handleCampaignDeleted.bind(this))

        // Acknowledgement events
        this.socket.on('dice:roll:ack', (data) => {
          this.dispatchEvent(new CustomEvent('dice-roll-ack', { detail: data }))
        })

        this.socket.on('character:update:ack', (data) => {
          this.dispatchEvent(new CustomEvent('character-update-ack', { detail: data }))
        })

        this.socket.on('campaign:sync:ack', (data) => {
          this.dispatchEvent(new CustomEvent('campaign-sync-ack', { detail: data }))
        })

        this.socket.on('combat:start:ack', (data) => {
          this.dispatchEvent(new CustomEvent('combat-start-ack', { detail: data }))
        })

        this.socket.on('combat:turn:ack', (data) => {
          this.dispatchEvent(new CustomEvent('combat-turn-ack', { detail: data }))
        })

        this.socket.on('combat:end:ack', (data) => {
          this.dispatchEvent(new CustomEvent('combat-end-ack', { detail: data }))
        })

        // Command events from Tumulte (gamification)
        this.socket.on('command:roll_dice', (data) => {
          this.handleCommandRollDice(data)
        })

        this.socket.on('command:chat_message', (data) => {
          this.handleCommandChatMessage(data)
        })

        this.socket.on('command:delete_message', (data) => {
          this.handleCommandDeleteMessage(data)
        })

        this.socket.on('command:modify_actor', (data) => {
          this.handleCommandModifyActor(data)
        })

        // Spell effect commands (gamification)
        this.socket.on('command:apply_spell_effect', (data) => {
          this.handleCommandApplySpellEffect(data)
        })

        this.socket.on('command:remove_spell_effect', (data) => {
          this.handleCommandRemoveSpellEffect(data)
        })

        // Cleanup all Tumulte effects (maintenance tool)
        this.socket.on('command:cleanup_all_effects', (data) => {
          this.handleCommandCleanupAllEffects(data)
        })

        // On-demand sync request
        this.socket.on('command:request_sync', (data) => {
          this.dispatchEvent(new CustomEvent('command:request_sync', { detail: data }))
        })

      } catch (error) {
        this.connecting = false
        reject(error)
      }
    })
  }

  /**
   * Handle successful connection
   */
  handleConnect() {
    this.connected = true
    this.connecting = false
    this.reconnectAttempts = 0
    this.lastPong = Date.now()

    Logger.info('Connected to Tumulte server')
    Logger.notify('Connected to Tumulte', 'info')

    this.dispatchEvent(new CustomEvent('connected'))
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(reason) {
    this.connected = false
    this.connecting = false

    Logger.warn('Disconnected from Tumulte', { reason })

    if (reason === 'io server disconnect') {
      // Server initiated disconnect, don't reconnect automatically
      Logger.notify('Disconnected by server', 'warn')
      this.dispatchEvent(new CustomEvent('disconnected', { detail: { reason, willReconnect: false } }))
    } else {
      // Try to reconnect
      this.dispatchEvent(new CustomEvent('disconnected', { detail: { reason, willReconnect: true } }))
      this.scheduleReconnect()
    }
  }

  /**
   * Handle connection error
   */
  async handleError(error) {
    this.connecting = false
    Logger.error('Connection error', error.message)

    // Check if the campaign was deleted
    if (error.message.includes('CAMPAIGN_DELETED')) {
      const reason = error.message.split(':')[1] || 'The campaign no longer exists'
      Logger.warn('Campaign deleted, clearing tokens', { reason })
      Logger.notify('The campaign associated with this Foundry world no longer exists on Tumulte. Please connect to a new campaign.', 'error')
      await this.tokenStorage.clearTokens()
      this.dispatchEvent(new CustomEvent('campaign-deleted', { detail: { reason } }))
      return
    }

    // Check if it's an auth error that might be fixable by refreshing token
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      try {
        await this.refreshToken()
        this.scheduleReconnect(0) // Immediate reconnect after token refresh
        return
      } catch (refreshError) {
        Logger.error('Token refresh failed', refreshError)
        Logger.notify('Authentication failed. Please re-pair with Tumulte.', 'error')
        await this.tokenStorage.clearTokens()
        this.dispatchEvent(new CustomEvent('auth-failed'))
        return
      }
    }

    this.scheduleReconnect()
  }

  /**
   * Handle ping from server
   */
  handlePing(data) {
    this.lastPong = Date.now()
    if (this.socket) {
      this.socket.emit('pong', {
        timestamp: data.timestamp,
        moduleVersion: game.modules.get('tumulte-integration')?.version || null,
      })
    }
  }

  /**
   * Handle connection revocation
   */
  async handleRevoked(data) {
    Logger.warn('Connection revoked by server', data)
    Logger.notify(`Connection revoked: ${data.reason}`, 'error')

    await this.tokenStorage.clearTokens()
    this.disconnect()

    this.dispatchEvent(new CustomEvent('revoked', { detail: data }))
  }

  /**
   * Handle campaign deletion notification from server
   * This is different from revocation - the campaign was explicitly deleted
   */
  async handleCampaignDeleted(data) {
    Logger.warn('Campaign deleted on Tumulte', data)
    Logger.notify(`Campaign "${data.campaignName || 'Unknown'}" has been deleted on Tumulte`, 'warn')

    // Clear tokens since the campaign no longer exists
    await this.tokenStorage.clearTokens()
    this.disconnect()

    // Dispatch event for UI handling
    this.dispatchEvent(new CustomEvent('campaign-deleted', { detail: data }))
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect(delay = null) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      Logger.error('Max reconnection attempts reached')
      Logger.notify('Tumulte service is currently unavailable. Your data will sync when the connection is restored.', 'error')
      this.dispatchEvent(new CustomEvent('reconnect-failed'))
      return
    }

    // Exponential backoff
    const actualDelay = delay ?? Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    )

    this.reconnectAttempts++
    Logger.info(`Reconnecting in ${actualDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    // Notify user of reconnection attempt
    Logger.notify(`Tumulte server unavailable, retrying... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warn')

    this.dispatchEvent(new CustomEvent('reconnecting', {
      detail: { attempt: this.reconnectAttempts, delay: actualDelay, maxAttempts: this.maxReconnectAttempts }
    }))

    setTimeout(() => {
      this.connect().catch(() => {
        // Error handled in handleError
      })
    }, actualDelay)
  }

  /**
   * Refresh the session token using refresh token
   * Includes fingerprint for security validation by the backend
   */
  async refreshToken() {
    const refreshToken = this.tokenStorage.getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    // Get fingerprint for security validation
    const fingerprint = this.tokenStorage.getFingerprint()

    Logger.info('Refreshing session token...', { hasFingerprint: !!fingerprint })

    const response = await fetch(`${this.serverUrl}/mj/vtt-connections/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken,
        fingerprint // Backend validates this to prevent token theft
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    await this.tokenStorage.storeTokens(data.sessionToken, data.refreshToken, data.expiresIn)

    Logger.info('Token refreshed successfully')
  }

  /**
   * Emit an event to the server
   */
  emit(event, data) {
    if (!this.connected || !this.socket) {
      Logger.warn(`Cannot emit ${event}: not connected`)
      return false
    }

    Logger.debug(`Emitting ${event}`, data)
    this.socket.emit(event, data)
    return true
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.connected = false
    this.connecting = false
    this.reconnectAttempts = 0

    Logger.info('Disconnected from Tumulte')
  }

  /**
   * Check if the connection has been reauthorized on Tumulte
   * The module polls this endpoint when in revoked state to detect reauthorization
   * Returns the new tokens if reauthorized, or the current status
   */
  async checkReauthorizationStatus() {
    try {
      const response = await fetch(
        `${this.serverUrl}/webhooks/foundry/reauthorization-status?worldId=${encodeURIComponent(this.worldId)}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { status: 'error', error: error.error || `HTTP ${response.status}` }
      }

      const data = await response.json()

      if (data.status === 'reauthorized') {
        Logger.info('Connection reauthorized! Storing new tokens...')

        // Store the new tokens
        await this.tokenStorage.storeTokens(
          data.sessionToken,
          data.refreshToken,
          data.expiresIn
        )

        // Update connection info if needed
        if (data.connectionId) {
          await this.tokenStorage.storeConnectionId(data.connectionId)
        }
        if (data.apiKey) {
          await this.tokenStorage.storeApiKey(data.apiKey)
        }

        // Store fingerprint for security validation on future token refresh
        if (data.fingerprint) {
          await this.tokenStorage.storeFingerprint(data.fingerprint)
          Logger.debug('Fingerprint stored from reauthorization', { fingerprintPreview: data.fingerprint.substring(0, 8) + '...' })
        }

        return {
          status: 'reauthorized',
          connectionId: data.connectionId,
          serverUrl: data.serverUrl,
          reauthorizedAt: data.reauthorizedAt
        }
      }

      return data
    } catch (error) {
      Logger.warn('Failed to check reauthorization status', error.message)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Check connection health via HTTP endpoint
   * This is a fallback when WebSocket is not available
   * Returns: { status: 'healthy' | 'not_found' | 'revoked' | 'expired' | 'campaign_deleted' | 'server_unavailable', ... }
   */
  async checkConnectionHealth() {
    const apiKey = this.tokenStorage.getApiKey()

    if (!apiKey) {
      return { status: 'not_paired', error: 'No API key available' }
    }

    try {
      const response = await fetch(`${this.serverUrl}/webhooks/foundry/connection-health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok) {
        Logger.debug('Connection health check: healthy', data)
        return {
          status: 'healthy',
          connectionId: data.connectionId,
          campaignId: data.campaignId,
          campaignName: data.campaignName,
          tunnelStatus: data.tunnelStatus,
          lastHeartbeatAt: data.lastHeartbeatAt
        }
      }

      // Handle specific error statuses
      if (response.status === 404) {
        Logger.warn('Connection health check: not found')
        return { status: 'not_found', error: data.error }
      }

      if (response.status === 401) {
        Logger.warn('Connection health check: revoked or expired', data)
        return { status: data.status || 'revoked', error: data.error }
      }

      if (response.status === 410) {
        Logger.warn('Connection health check: campaign deleted', data)
        return { status: 'campaign_deleted', error: data.error, connectionId: data.connectionId }
      }

      // Generic error
      Logger.error('Connection health check failed', data)
      return { status: 'error', error: data.error || 'Unknown error' }

    } catch (error) {
      // Network error - server unavailable
      Logger.warn('Connection health check: server unavailable', error.message)
      return { status: 'server_unavailable', error: error.message }
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      reconnectAttempts: this.reconnectAttempts,
      lastPong: this.lastPong,
      socketId: this.socket?.id
    }
  }

  // ========================================
  // COMMAND HANDLERS (Gamification)
  // ========================================

  /**
   * Handle roll_dice command from Tumulte
   * Rolls a die with an optionally forced result
   */
  async handleCommandRollDice(data) {
    const { formula, forcedResult, flavor, speaker, requestId } = data

    Logger.info('Received roll_dice command', { formula, forcedResult, flavor, requestId })

    try {
      // Create a new Roll
      const roll = new Roll(formula)
      await roll.evaluate()

      // If forcedResult is specified, modify the roll result
      if (forcedResult !== undefined && roll.dice.length > 0) {
        const mainDie = roll.dice[0]
        if (mainDie.results && mainDie.results.length > 0) {
          mainDie.results[0].result = forcedResult
          // Recalculate total
          roll._total = roll._evaluateTotal()
        }
      }

      // Build speaker data
      let speakerData = {}
      if (speaker?.actorId) {
        const actor = game.actors.get(speaker.actorId)
        if (actor) {
          speakerData = ChatMessage.getSpeaker({ actor })
        }
      }

      // Send to chat
      await roll.toMessage({
        speaker: speakerData,
        flavor: flavor || ''
      })

      Logger.info('Roll dice command executed successfully', { requestId, total: roll.total })
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'roll_dice', requestId, success: true, total: roll.total }
      }))

    } catch (error) {
      Logger.error('Failed to execute roll_dice command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'roll_dice', requestId, success: false, error: error.message }
      }))
    }
  }

  /**
   * Handle chat_message command from Tumulte
   * Sends a message to the Foundry chat
   */
  async handleCommandChatMessage(data) {
    const { content, speaker, requestId } = data

    Logger.info('Received chat_message command', { contentLength: content?.length, requestId })

    try {
      const messageData = {
        content: content || ''
      }

      if (speaker?.alias) {
        messageData.speaker = { alias: speaker.alias }
      } else if (speaker?.actorId) {
        const actor = game.actors.get(speaker.actorId)
        if (actor) {
          messageData.speaker = ChatMessage.getSpeaker({ actor })
        }
      }

      await ChatMessage.create(messageData)

      Logger.info('Chat message command executed successfully', { requestId })
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'chat_message', requestId, success: true }
      }))

    } catch (error) {
      Logger.error('Failed to execute chat_message command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'chat_message', requestId, success: false, error: error.message }
      }))
    }
  }

  /**
   * Handle delete_message command from Tumulte
   * Deletes a message from the Foundry chat
   */
  async handleCommandDeleteMessage(data) {
    const { messageId, requestId } = data

    Logger.info('Received delete_message command', { messageId, requestId })

    try {
      const message = game.messages.get(messageId)
      if (!message) {
        throw new Error(`Message not found: ${messageId}`)
      }

      await message.delete()

      Logger.info('Delete message command executed successfully', { requestId, messageId })
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'delete_message', requestId, success: true }
      }))

    } catch (error) {
      Logger.error('Failed to execute delete_message command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'delete_message', requestId, success: false, error: error.message }
      }))
    }
  }

  /**
   * Handle modify_actor command from Tumulte
   * Modifies an actor's data
   */
  async handleCommandModifyActor(data) {
    const { actorId, updates, requestId } = data

    Logger.info('Received modify_actor command', { actorId, updateKeys: Object.keys(updates || {}), requestId })

    try {
      const actor = game.actors.get(actorId)
      if (!actor) {
        throw new Error(`Actor not found: ${actorId}`)
      }

      await actor.update(updates)

      Logger.info('Modify actor command executed successfully', { requestId, actorId })
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'modify_actor', requestId, success: true }
      }))

    } catch (error) {
      Logger.error('Failed to execute modify_actor command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'modify_actor', requestId, success: false, error: error.message }
      }))
    }
  }

  // ========================================
  // SPELL EFFECT COMMANDS (Gamification)
  // ========================================

  /**
   * Handle apply_spell_effect command from Tumulte
   * Applies a spell effect (disable, buff, or debuff) on an actor's spell item
   */
  async handleCommandApplySpellEffect(data) {
    const { actorId, spellId, spellName, effect, requestId } = data

    Logger.info('Received apply_spell_effect command', {
      actorId, spellId, spellName, effectType: effect?.type, requestId
    })

    try {
      const actor = game.actors.get(actorId)
      if (!actor) {
        throw new Error(`Actor not found: ${actorId}`)
      }

      const spell = actor.items.get(spellId)
      if (!spell) {
        throw new Error(`Spell not found: ${spellId} on actor ${actorId}`)
      }

      const effectType = effect?.type
      if (!effectType) {
        throw new Error('Missing effect type')
      }

      switch (effectType) {
        case 'disable':
          await this._applySpellDisable(actor, spell, effect, requestId)
          break
        case 'buff':
          await this._applySpellBuff(actor, spell, effect, requestId)
          break
        case 'debuff':
          await this._applySpellDebuff(actor, spell, effect, requestId)
          break
        default:
          throw new Error(`Unknown spell effect type: ${effectType}`)
      }

      Logger.info('Spell effect applied successfully', { requestId, spellName, effectType })
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'apply_spell_effect', requestId, success: true }
      }))

    } catch (error) {
      Logger.error('Failed to execute apply_spell_effect command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'apply_spell_effect', requestId, success: false, error: error.message }
      }))
    }
  }

  /**
   * Apply spell disable effect
   * Marks spell as unprepared (D&D 5e) and sets a recovery timer via flag
   */
  async _applySpellDisable(actor, spell, effect, requestId) {
    const durationSeconds = effect.durationSeconds || 600 // default 10 min
    const durationMs = durationSeconds * 1000
    const disabledAt = Date.now()
    const expiresAt = disabledAt + durationMs
    const triggeredBy = effect.triggeredBy || 'le chat'

    // Store original prepared state for recovery
    const originalPrepared = spell.system?.preparation?.prepared ?? true

    // Set disabled flag with all recovery info
    await spell.setFlag(MODULE_ID, 'disabled', {
      requestId,
      disabledAt,
      durationMs,
      expiresAt,
      originalPrepared,
      triggeredBy,
    })

    // System-specific: mark spell as unprepared
    const systemId = game.system.id
    if (systemId === 'dnd5e') {
      await spell.update({ 'system.preparation.prepared': false })
    }

    // Re-render the actor sheet so the visual highlighting hook fires
    actor.sheet?.render(false)

    // Schedule re-enable timer
    const timeoutId = setTimeout(() => {
      this._reEnableSpell(actor.id, spell.id)
    }, durationMs)

    // Store timeout reference for cleanup
    if (!this._spellDisableTimers) this._spellDisableTimers = new Map()
    this._spellDisableTimers.set(`${actor.id}.${spell.id}`, timeoutId)

    // Send chat message
    const durationMin = Math.round(durationSeconds / 60)
    await ChatMessage.create({
      content: `
        <div class="tumulte-spell-effect tumulte-spell-disable">
          <div class="tumulte-spell-effect-header">
            <img src="${spell.img}" width="32" height="32"/>
            <div>
              <strong>${spell.name}</strong> a été <em>bloqué</em> pendant ${durationMin} min !
              <br/><small>Déclenché par <strong>${triggeredBy}</strong></small>
            </div>
          </div>
        </div>
      `,
      speaker: { alias: 'Tumulte' },
    })

    Logger.info('Spell disabled', {
      spellName: spell.name,
      durationSeconds,
      expiresAt: new Date(expiresAt).toISOString(),
    })
  }

  /**
   * Apply spell buff effect
   * Flags the spell so the SpellEffectCollector applies advantage/bonus on next cast
   */
  async _applySpellBuff(actor, spell, effect, requestId) {
    const triggeredBy = effect.triggeredBy || 'le chat'
    const buffType = effect.buffType || 'advantage'
    const bonusValue = effect.bonusValue || 2
    const highlightColor = effect.highlightColor || '#10B981'

    // Set the buff flag — will be consumed by SpellEffectCollector on next cast
    await spell.setFlag(MODULE_ID, 'spellEffect', {
      type: 'buff',
      buffType,
      bonusValue,
      highlightColor,
      requestId,
      triggeredBy,
      appliedAt: Date.now(),
    })

    // Re-render the actor sheet so the visual highlighting hook fires
    actor.sheet?.render(false)

    // Send chat message
    const buffLabel = buffType === 'advantage' ? 'avantage' : `+${bonusValue}`
    await ChatMessage.create({
      content: `
        <div class="tumulte-spell-effect tumulte-spell-buff">
          <div class="tumulte-spell-effect-header">
            <img src="${spell.img}" width="32" height="32"/>
            <div>
              <strong>${spell.name}</strong> a été <em>amplifié</em> (${buffLabel}) !
              <br/><small>Déclenché par <strong>${triggeredBy}</strong></small>
            </div>
          </div>
        </div>
      `,
      speaker: { alias: 'Tumulte' },
    })

    Logger.info('Spell buffed', { spellName: spell.name, buffType, bonusValue })
  }

  /**
   * Apply spell debuff effect
   * Flags the spell so the SpellEffectCollector applies disadvantage/penalty on next cast
   */
  async _applySpellDebuff(actor, spell, effect, requestId) {
    const triggeredBy = effect.triggeredBy || 'le chat'
    const debuffType = effect.debuffType || 'disadvantage'
    const penaltyValue = effect.penaltyValue || 2
    const highlightColor = effect.highlightColor || '#EF4444'

    // Set the debuff flag — will be consumed by SpellEffectCollector on next cast
    await spell.setFlag(MODULE_ID, 'spellEffect', {
      type: 'debuff',
      debuffType,
      penaltyValue,
      highlightColor,
      requestId,
      triggeredBy,
      appliedAt: Date.now(),
    })

    // Re-render the actor sheet so the visual highlighting hook fires
    actor.sheet?.render(false)

    // Send chat message
    const debuffLabel = debuffType === 'disadvantage' ? 'désavantage' : `-${penaltyValue}`
    await ChatMessage.create({
      content: `
        <div class="tumulte-spell-effect tumulte-spell-debuff">
          <div class="tumulte-spell-effect-header">
            <img src="${spell.img}" width="32" height="32"/>
            <div>
              <strong>${spell.name}</strong> a été <em>maudit</em> (${debuffLabel}) !
              <br/><small>Déclenché par <strong>${triggeredBy}</strong></small>
            </div>
          </div>
        </div>
      `,
      speaker: { alias: 'Tumulte' },
    })

    Logger.info('Spell debuffed', { spellName: spell.name, debuffType, penaltyValue })
  }

  /**
   * Re-enable a spell that was disabled by Tumulte
   */
  async _reEnableSpell(actorId, spellId) {
    try {
      const actor = game.actors.get(actorId)
      if (!actor) {
        Logger.warn('Cannot re-enable spell: actor not found', { actorId })
        return
      }

      const spell = actor.items.get(spellId)
      if (!spell) {
        Logger.warn('Cannot re-enable spell: spell not found', { actorId, spellId })
        return
      }

      const disabledFlag = spell.getFlag(MODULE_ID, 'disabled')
      if (!disabledFlag) {
        Logger.debug('Spell already re-enabled (no flag)', { spellName: spell.name })
        return
      }

      // Restore original prepared state (D&D 5e)
      const systemId = game.system.id
      if (systemId === 'dnd5e' && disabledFlag.originalPrepared !== undefined) {
        await spell.update({ 'system.preparation.prepared': disabledFlag.originalPrepared })
      }

      // Remove the disabled flag
      await spell.unsetFlag(MODULE_ID, 'disabled')

      // Re-render the actor sheet to remove the visual highlighting
      actor.sheet?.render(false)

      // Clean up timer reference
      if (this._spellDisableTimers) {
        this._spellDisableTimers.delete(`${actorId}.${spellId}`)
      }

      // Send chat message
      const enableMessage = disabledFlag.enableMessage || null
      await ChatMessage.create({
        content: `
          <div class="tumulte-spell-effect tumulte-spell-reenable">
            <div class="tumulte-spell-effect-header">
              <img src="${spell.img}" width="32" height="32"/>
              <div>
                <strong>${spell.name}</strong> est de nouveau disponible !
                ${enableMessage ? `<br/><small>${enableMessage}</small>` : ''}
              </div>
            </div>
          </div>
        `,
        speaker: { alias: 'Tumulte' },
      })

      Logger.info('Spell re-enabled', { spellName: spell.name, actorId })

      // Notify backend
      this.emit('spell:effect:expired', {
        actorId,
        spellId,
        spellName: spell.name,
        effectType: 'disable',
        requestId: disabledFlag.requestId,
      })

    } catch (error) {
      Logger.error('Failed to re-enable spell', { actorId, spellId, error: error.message })
    }
  }

  /**
   * Handle remove_spell_effect command from Tumulte
   * Manually removes a spell effect (e.g., GM override)
   */
  async handleCommandRemoveSpellEffect(data) {
    const { actorId, spellId, requestId } = data

    Logger.info('Received remove_spell_effect command', { actorId, spellId, requestId })

    try {
      const actor = game.actors.get(actorId)
      if (!actor) {
        throw new Error(`Actor not found: ${actorId}`)
      }

      const spell = actor.items.get(spellId)
      if (!spell) {
        throw new Error(`Spell not found: ${spellId}`)
      }

      // Remove disabled flag and re-enable if needed
      const disabledFlag = spell.getFlag(MODULE_ID, 'disabled')
      if (disabledFlag) {
        // Clear the timer
        if (this._spellDisableTimers) {
          const timerKey = `${actorId}.${spellId}`
          const timerId = this._spellDisableTimers.get(timerKey)
          if (timerId) {
            clearTimeout(timerId)
            this._spellDisableTimers.delete(timerKey)
          }
        }

        // Restore prepared state
        if (game.system.id === 'dnd5e' && disabledFlag.originalPrepared !== undefined) {
          await spell.update({ 'system.preparation.prepared': disabledFlag.originalPrepared })
        }

        await spell.unsetFlag(MODULE_ID, 'disabled')
      }

      // Remove buff/debuff flag
      const effectFlag = spell.getFlag(MODULE_ID, 'spellEffect')
      if (effectFlag) {
        await spell.unsetFlag(MODULE_ID, 'spellEffect')
      }

      // Re-render the actor sheet to remove the visual highlighting
      actor.sheet?.render(false)

      Logger.info('Spell effect removed manually', { requestId, spellName: spell.name })
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'remove_spell_effect', requestId, success: true }
      }))

    } catch (error) {
      Logger.error('Failed to execute remove_spell_effect command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'remove_spell_effect', requestId, success: false, error: error.message }
      }))
    }
  }

  /**
   * Handle cleanup_all_effects command — bulk remove ALL Tumulte effects from Foundry
   * Scans all actors/items, clears flags, restores spell states, cancels timers
   */
  async handleCommandCleanupAllEffects(data) {
    const { requestId, cleanChat = false } = data
    const results = { disabledRestored: 0, effectsRemoved: 0, timersCleared: 0, messagesDeleted: 0 }

    Logger.info('Received cleanup_all_effects command', { requestId, cleanChat })

    try {
      // 1. Cancel all spell disable timers
      if (this._spellDisableTimers) {
        for (const [key, timerId] of this._spellDisableTimers.entries()) {
          clearTimeout(timerId)
          results.timersCleared++
        }
        this._spellDisableTimers.clear()
      }

      // 2. Scan all actors and their items
      for (const actor of game.actors) {
        let actorModified = false

        for (const item of actor.items) {
          // 2a. Restore disabled spells
          const disabledFlag = item.getFlag(MODULE_ID, 'disabled')
          if (disabledFlag) {
            // Restore D&D 5e prepared state
            if (game.system.id === 'dnd5e' && disabledFlag.originalPrepared !== undefined) {
              await item.update({ 'system.preparation.prepared': disabledFlag.originalPrepared })
            }
            await item.unsetFlag(MODULE_ID, 'disabled')
            results.disabledRestored++
            actorModified = true
          }

          // 2b. Remove buff/debuff effects
          const effectFlag = item.getFlag(MODULE_ID, 'spellEffect')
          if (effectFlag) {
            await item.unsetFlag(MODULE_ID, 'spellEffect')
            results.effectsRemoved++
            actorModified = true
          }
        }

        // Re-render actor sheet if any flags were removed
        if (actorModified) {
          actor.sheet?.render(false)
        }
      }

      // 3. Optionally clean Tumulte chat messages
      if (cleanChat) {
        const tumulteMessages = game.messages.filter(m => m.speaker?.alias === 'Tumulte')
        for (const msg of tumulteMessages) {
          await msg.delete()
          results.messagesDeleted++
        }
      }

      // 4. Post summary chat message
      const total = results.disabledRestored + results.effectsRemoved + results.timersCleared
      if (total > 0 || cleanChat) {
        await ChatMessage.create({
          content: `
            <div class="tumulte-spell-effect tumulte-cleanup-summary">
              <div class="tumulte-spell-effect-header">
                <div>
                  <strong>Nettoyage Tumulte effectué</strong>
                  <br/><small>
                    Sorts réactivés : ${results.disabledRestored},
                    Effets supprimés : ${results.effectsRemoved},
                    Timers annulés : ${results.timersCleared}
                    ${cleanChat ? `, Messages supprimés : ${results.messagesDeleted}` : ''}
                  </small>
                </div>
              </div>
            </div>
          `,
          speaker: { alias: 'Tumulte' },
        })
      }

      Logger.info('Cleanup all effects completed', results)

      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'cleanup_all_effects', requestId, success: true, results }
      }))

    } catch (error) {
      Logger.error('Failed to execute cleanup_all_effects command', error)
      this.dispatchEvent(new CustomEvent('command-executed', {
        detail: { command: 'cleanup_all_effects', requestId, success: false, error: error.message }
      }))
    }
  }

  /**
   * Recover spell effects after page reload
   * Called from tumulte.js on the 'ready' hook after connection is established
   */
  async recoverSpellEffects() {
    if (!game.actors) return

    Logger.info('Recovering spell effects after reload...')
    let recovered = 0
    let expired = 0

    for (const actor of game.actors) {
      for (const item of actor.items) {
        // Check for disabled spells
        const disabledFlag = item.getFlag(MODULE_ID, 'disabled')
        if (disabledFlag) {
          const now = Date.now()
          const expiresAt = disabledFlag.expiresAt || (disabledFlag.disabledAt + disabledFlag.durationMs)

          if (now >= expiresAt) {
            // Already expired — re-enable immediately
            Logger.info('Recovering expired disabled spell', { spellName: item.name, actorName: actor.name })
            await this._reEnableSpell(actor.id, item.id)
            expired++
          } else {
            // Still active — schedule re-enable for remaining time
            const remainingMs = expiresAt - now
            Logger.info('Recovering active disabled spell', {
              spellName: item.name,
              actorName: actor.name,
              remainingMs,
            })

            if (!this._spellDisableTimers) this._spellDisableTimers = new Map()
            const timeoutId = setTimeout(() => {
              this._reEnableSpell(actor.id, item.id)
            }, remainingMs)
            this._spellDisableTimers.set(`${actor.id}.${item.id}`, timeoutId)
            recovered++
          }
        }

        // Buff/debuff flags persist without timers — they're consumed on cast
        const effectFlag = item.getFlag(MODULE_ID, 'spellEffect')
        if (effectFlag) {
          Logger.info('Found persisted spell effect', {
            spellName: item.name,
            actorName: actor.name,
            effectType: effectFlag.type,
          })
          recovered++
        }
      }
    }

    Logger.info('Spell effect recovery complete', { recovered, expired })
  }
}

export default TumulteSocketClient
