/**
 * Pairing Manager for Tumulte VTT Connection
 * Handles the code-based pairing flow between Foundry VTT and Tumulte
 *
 * Flow:
 * 1. Module requests a pairing code from Tumulte backend
 * 2. User enters the code (ABC-123) on Tumulte dashboard
 * 3. Module polls for pairing status until completed
 * 4. Module receives tokens and stores them
 */

import Logger from '../utils/logger.js'
import TokenStorage from './token-storage.js'

const MODULE_ID = 'tumulte-integration'
const POLLING_INTERVAL = 2000 // 2 seconds

export class PairingManager {
  constructor(options = {}) {
    this.tumulteUrl = options.tumulteUrl || 'http://localhost:3333'
    this.tokenStorage = options.tokenStorage || new TokenStorage()

    this.currentPairing = null
    this.pairingTimeout = null
    this.pollingInterval = null
    this.onPairingComplete = null
    this.onPairingExpired = null
  }

  /**
   * Start a new pairing session
   * Requests a code from the backend and starts polling for completion
   */
  async startPairing() {
    try {
      Logger.info('Starting pairing session...')

      // Cancel any existing pairing
      this.cancelPairing()

      // Request pairing code from Tumulte backend
      const response = await fetch(`${this.tumulteUrl}/webhooks/foundry/request-pairing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          worldId: game.world.id,
          worldName: game.world.title,
          gmUserId: game.user.id,
          moduleVersion: game.modules.get(MODULE_ID)?.version || '2.0.0'
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `Failed to start pairing: HTTP ${response.status}`)
      }

      const { code, expiresIn, expiresAt, serverUrl } = await response.json()

      // Store server URL from backend response
      if (serverUrl) {
        this.tumulteUrl = serverUrl
        // Save to Foundry settings for persistence
        await game.settings.set(MODULE_ID, 'serverUrl', serverUrl)
        Logger.info('Server URL set from backend', { serverUrl })
      }

      // Store current pairing info
      this.currentPairing = {
        code,
        worldId: game.world.id,
        expiresAt,
        expiresIn,
        serverUrl: this.tumulteUrl,
        createdAt: Date.now()
      }

      // Set timeout to expire pairing
      this.setPairingTimeout(expiresIn * 1000)

      // Start polling for completion
      this.startPolling()

      Logger.info('Pairing session started', { code, expiresIn, serverUrl: this.tumulteUrl })

      return {
        code,
        expiresAt,
        expiresIn,
        serverUrl: this.tumulteUrl
      }

    } catch (error) {
      Logger.error('Failed to start pairing', error)
      throw error
    }
  }

  /**
   * Start polling for pairing completion
   */
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }

    this.pollingInterval = setInterval(async () => {
      await this.checkPairingStatus()
    }, POLLING_INTERVAL)
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * Check pairing status by polling the backend
   */
  async checkPairingStatus() {
    if (!this.currentPairing) {
      this.stopPolling()
      return
    }

    try {
      const response = await fetch(
        `${this.tumulteUrl}/webhooks/foundry/pairing-status?worldId=${encodeURIComponent(this.currentPairing.worldId)}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        Logger.warn('Failed to check pairing status', { status: response.status })
        return
      }

      const result = await response.json()

      switch (result.status) {
        case 'completed':
          // Pairing completed! Store tokens
          Logger.info('Pairing completed via backend')
          await this.completePairingFromBackend(result)
          break

        case 'expired':
          Logger.info('Pairing expired')
          this.handlePairingExpired()
          break

        case 'pending':
          // Still waiting, continue polling
          Logger.debug('Pairing still pending', { remainingSeconds: result.remainingSeconds })
          break

        case 'not_found':
          // Session was cancelled or never existed
          Logger.warn('Pairing session not found')
          this.cancelPairing()
          break

        default:
          Logger.warn('Unknown pairing status', { status: result.status })
      }

    } catch (error) {
      Logger.error('Error checking pairing status', error)
    }
  }

  /**
   * Complete pairing with data received from backend polling
   */
  async completePairingFromBackend(data) {
    try {
      // Stop polling
      this.stopPolling()

      // Store server URL if provided (for future connections)
      if (data.serverUrl) {
        this.tumulteUrl = data.serverUrl
        await game.settings.set(MODULE_ID, 'serverUrl', data.serverUrl)
        Logger.info('Server URL saved from pairing completion', { serverUrl: data.serverUrl })
      }

      // Store tokens
      await this.tokenStorage.storeTokens(
        data.sessionToken,
        data.refreshToken,
        data.expiresIn
      )

      // Store connection info
      this.tokenStorage.storeConnectionId(data.connectionId)
      this.tokenStorage.storeApiKey(data.apiKey)

      const completedPairing = this.currentPairing

      // Clear pairing session
      this.currentPairing = null
      if (this.pairingTimeout) {
        clearTimeout(this.pairingTimeout)
        this.pairingTimeout = null
      }

      Logger.info('Pairing completed successfully', {
        connectionId: data.connectionId,
        serverUrl: this.tumulteUrl
      })

      // Notify callback if registered
      if (this.onPairingComplete) {
        this.onPairingComplete({
          success: true,
          connectionId: data.connectionId,
          worldId: completedPairing?.worldId,
          serverUrl: this.tumulteUrl
        })
      }

      return { success: true, connectionId: data.connectionId, serverUrl: this.tumulteUrl }

    } catch (error) {
      Logger.error('Failed to complete pairing', error)
      throw error
    }
  }

  /**
   * Handle pairing expiration
   */
  handlePairingExpired() {
    this.stopPolling()
    this.currentPairing = null
    if (this.pairingTimeout) {
      clearTimeout(this.pairingTimeout)
      this.pairingTimeout = null
    }

    // Notify callback if registered
    if (this.onPairingExpired) {
      this.onPairingExpired()
    }
  }

  /**
   * Set timeout to expire current pairing
   */
  setPairingTimeout(duration) {
    if (this.pairingTimeout) {
      clearTimeout(this.pairingTimeout)
    }

    this.pairingTimeout = setTimeout(() => {
      if (this.currentPairing) {
        Logger.info('Pairing session expired (timeout)')
        this.handlePairingExpired()
      }
    }, duration)
  }

  /**
   * Cancel current pairing session
   */
  cancelPairing() {
    this.stopPolling()

    if (this.pairingTimeout) {
      clearTimeout(this.pairingTimeout)
      this.pairingTimeout = null
    }

    this.currentPairing = null
    Logger.info('Pairing cancelled')
  }

  /**
   * Complete pairing by storing tokens received from callback
   * Used when tokens are received via WebSocket or other means
   */
  async completePairing(connectionData) {
    try {
      const { connection, tokens } = connectionData

      // Stop polling
      this.stopPolling()

      // Store tokens
      await this.tokenStorage.storeTokens(
        tokens.sessionToken,
        tokens.refreshToken,
        tokens.expiresIn
      )

      // Store connection ID
      this.tokenStorage.storeConnectionId(connection.id)

      // Store API key if provided
      if (connection.apiKey) {
        this.tokenStorage.storeApiKey(connection.apiKey)
      }

      // Clear pairing session
      this.currentPairing = null
      if (this.pairingTimeout) {
        clearTimeout(this.pairingTimeout)
        this.pairingTimeout = null
      }

      Logger.info('Pairing completed successfully', {
        connectionId: connection.id,
        worldName: connection.worldName
      })

      // Notify callback if registered
      if (this.onPairingComplete) {
        this.onPairingComplete({
          success: true,
          connectionId: connection.id,
          worldName: connection.worldName
        })
      }

      return {
        success: true,
        connectionId: connection.id,
        worldName: connection.worldName
      }

    } catch (error) {
      Logger.error('Failed to complete pairing', error)
      throw error
    }
  }

  /**
   * Check if currently paired
   */
  isPaired() {
    return this.tokenStorage.isPaired()
  }

  /**
   * Get current pairing status
   */
  getPairingStatus() {
    if (!this.currentPairing) {
      return { active: false }
    }

    const remainingTime = this.currentPairing.expiresAt - Date.now()

    return {
      active: remainingTime > 0,
      code: this.currentPairing.code,
      expiresAt: this.currentPairing.expiresAt,
      remainingSeconds: Math.max(0, Math.floor(remainingTime / 1000))
    }
  }

  /**
   * Get formatted pairing code for display (ABC-123)
   */
  getFormattedCode() {
    if (!this.currentPairing?.code) return null
    return this.currentPairing.code
  }

  /**
   * Register callback for pairing completion
   */
  onComplete(callback) {
    this.onPairingComplete = callback
  }

  /**
   * Register callback for pairing expiration
   */
  onExpired(callback) {
    this.onPairingExpired = callback
  }

  /**
   * Unpair and clear tokens
   */
  async unpair() {
    // Notify backend if we have a connection
    const connectionId = this.tokenStorage.getConnectionId()
    const apiKey = this.tokenStorage.getApiKey()

    if (connectionId && apiKey) {
      try {
        await fetch(`${this.tumulteUrl}/webhooks/foundry/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            apiKey,
            reason: 'User disconnected from Foundry'
          })
        })
      } catch (error) {
        Logger.warn('Failed to notify backend of disconnection', error)
      }
    }

    this.tokenStorage.clearTokens()
    this.cancelPairing()
    Logger.info('Unpaired from Tumulte')
  }
}

export default PairingManager
