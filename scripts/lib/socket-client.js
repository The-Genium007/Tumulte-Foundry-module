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
      this.socket.emit('pong', { timestamp: data.timestamp })
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
}

export default TumulteSocketClient
