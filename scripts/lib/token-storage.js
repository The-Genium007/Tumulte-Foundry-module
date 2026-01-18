/**
 * Token Storage for Tumulte VTT Connection
 * Handles secure storage and retrieval of JWT tokens in Foundry VTT
 *
 * IMPORTANT: Tokens are namespaced by worldId to support multiple worlds
 * Each Foundry world has its own isolated token storage
 */

import Logger from '../utils/logger.js'

const STORAGE_PREFIX = 'tumulte_'

export class TokenStorage {
  /**
   * Create a TokenStorage instance for a specific world
   * @param {string} worldId - The Foundry world ID (game.world.id)
   */
  constructor(worldId) {
    if (!worldId) {
      throw new Error('TokenStorage requires a worldId')
    }
    this.worldId = worldId
    this.storage = window.localStorage

    // Namespaced keys for this specific world
    this.keys = {
      sessionToken: `${STORAGE_PREFIX}${worldId}_session_token`,
      refreshToken: `${STORAGE_PREFIX}${worldId}_refresh_token`,
      tokenExpiry: `${STORAGE_PREFIX}${worldId}_token_expiry`,
      connectionId: `${STORAGE_PREFIX}${worldId}_connection_id`,
      apiKey: `${STORAGE_PREFIX}${worldId}_api_key`,
    }

    Logger.debug('TokenStorage initialized for world', { worldId })
  }

  /**
   * Store tokens after successful pairing
   */
  async storeTokens(sessionToken, refreshToken, expiresIn = 3600) {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000)

      this.storage.setItem(this.keys.sessionToken, sessionToken)
      this.storage.setItem(this.keys.refreshToken, refreshToken)
      this.storage.setItem(this.keys.tokenExpiry, String(expiryTime))

      Logger.debug('Tokens stored successfully', { worldId: this.worldId, expiresIn })
      return true
    } catch (error) {
      Logger.error('Failed to store tokens', error)
      return false
    }
  }

  /**
   * Store connection ID for reference
   */
  storeConnectionId(connectionId) {
    this.storage.setItem(this.keys.connectionId, connectionId)
  }

  /**
   * Store API key for webhook authentication
   */
  storeApiKey(apiKey) {
    this.storage.setItem(this.keys.apiKey, apiKey)
  }

  /**
   * Get stored API key
   */
  getApiKey() {
    return this.storage.getItem(this.keys.apiKey)
  }

  /**
   * Get the session token
   */
  getSessionToken() {
    return this.storage.getItem(this.keys.sessionToken)
  }

  /**
   * Get the refresh token
   */
  getRefreshToken() {
    return this.storage.getItem(this.keys.refreshToken)
  }

  /**
   * Get stored connection ID
   */
  getConnectionId() {
    return this.storage.getItem(this.keys.connectionId)
  }

  /**
   * Get token expiry timestamp
   */
  getTokenExpiry() {
    const expiry = this.storage.getItem(this.keys.tokenExpiry)
    return expiry ? parseInt(expiry, 10) : null
  }

  /**
   * Check if session token is expired or about to expire
   * @param bufferSeconds - Buffer time before actual expiry (default 60s)
   */
  isTokenExpired(bufferSeconds = 60) {
    const expiry = this.getTokenExpiry()
    if (!expiry) return true

    const bufferMs = bufferSeconds * 1000
    return Date.now() >= (expiry - bufferMs)
  }

  /**
   * Check if we have valid stored tokens
   */
  hasValidTokens() {
    const sessionToken = this.getSessionToken()
    const refreshToken = this.getRefreshToken()
    return !!(sessionToken && refreshToken)
  }

  /**
   * Check if connection is paired (has tokens)
   */
  isPaired() {
    return this.hasValidTokens() && !!this.getConnectionId()
  }

  /**
   * Clear all stored tokens for this world
   */
  clearTokens() {
    this.storage.removeItem(this.keys.sessionToken)
    this.storage.removeItem(this.keys.refreshToken)
    this.storage.removeItem(this.keys.tokenExpiry)
    this.storage.removeItem(this.keys.connectionId)
    this.storage.removeItem(this.keys.apiKey)
    Logger.info('Tokens cleared for world', { worldId: this.worldId })
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiry() {
    const expiry = this.getTokenExpiry()
    if (!expiry) return 0

    const remaining = expiry - Date.now()
    return Math.max(0, Math.floor(remaining / 1000))
  }

  /**
   * Export tokens for debugging (masked)
   */
  debugInfo() {
    const sessionToken = this.getSessionToken()
    const refreshToken = this.getRefreshToken()
    const apiKey = this.getApiKey()

    return {
      worldId: this.worldId,
      hasSessionToken: !!sessionToken,
      hasRefreshToken: !!refreshToken,
      hasApiKey: !!apiKey,
      sessionTokenPreview: sessionToken ? `${sessionToken.substring(0, 20)}...` : null,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : null,
      connectionId: this.getConnectionId(),
      expiresIn: this.getTimeUntilExpiry(),
      isExpired: this.isTokenExpired()
    }
  }

  /**
   * Static method to clear tokens for all worlds (useful for debugging/reset)
   */
  static clearAllWorlds() {
    const storage = window.localStorage
    const keysToRemove = []

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => storage.removeItem(key))
    Logger.info('All Tumulte tokens cleared', { count: keysToRemove.length })
  }
}

export default TokenStorage
