/**
 * Token Storage for Tumulte VTT Connection
 * Handles secure storage and retrieval of JWT tokens in Foundry VTT
 *
 * v2.0.2: Migrated from localStorage to Foundry Settings API
 * Data is now persisted in the Foundry world database, surviving browser cache clears
 */

import Logger from '../utils/logger.js'

const MODULE_ID = 'tumulte-integration'
const SETTING_KEY = 'credentials'

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

    Logger.debug('TokenStorage initialized for world', { worldId })
  }

  /**
   * Get credentials object from Foundry settings
   * @returns {Object} Credentials object
   */
  #getCredentials() {
    return game.settings.get(MODULE_ID, SETTING_KEY)
  }

  /**
   * Set credentials object in Foundry settings
   * @param {Object} credentials - Credentials to store
   * @returns {Promise<void>}
   */
  async #setCredentials(credentials) {
    await game.settings.set(MODULE_ID, SETTING_KEY, credentials)
  }

  /**
   * Store tokens after successful pairing
   * @param {string} sessionToken - JWT session token
   * @param {string} refreshToken - Refresh token
   * @param {number} expiresIn - Token lifetime in seconds (default 3600)
   * @returns {Promise<boolean>}
   */
  async storeTokens(sessionToken, refreshToken, expiresIn = 3600) {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000)
      const credentials = this.#getCredentials()

      credentials.sessionToken = sessionToken
      credentials.refreshToken = refreshToken
      credentials.tokenExpiry = expiryTime

      await this.#setCredentials(credentials)

      Logger.debug('Tokens stored successfully', { worldId: this.worldId, expiresIn })
      return true
    } catch (error) {
      Logger.error('Failed to store tokens', error)
      return false
    }
  }

  /**
   * Store connection ID for reference
   * @param {string} connectionId - Connection UUID
   * @returns {Promise<void>}
   */
  async storeConnectionId(connectionId) {
    const credentials = this.#getCredentials()
    credentials.connectionId = connectionId
    await this.#setCredentials(credentials)
  }

  /**
   * Store API key for webhook authentication
   * @param {string} apiKey - API key
   * @returns {Promise<void>}
   */
  async storeApiKey(apiKey) {
    const credentials = this.#getCredentials()
    credentials.apiKey = apiKey
    await this.#setCredentials(credentials)
  }

  /**
   * Get stored API key
   * @returns {string|null}
   */
  getApiKey() {
    return this.#getCredentials().apiKey
  }

  /**
   * Get the session token
   * @returns {string|null}
   */
  getSessionToken() {
    return this.#getCredentials().sessionToken
  }

  /**
   * Get the refresh token
   * @returns {string|null}
   */
  getRefreshToken() {
    return this.#getCredentials().refreshToken
  }

  /**
   * Get stored connection ID
   * @returns {string|null}
   */
  getConnectionId() {
    return this.#getCredentials().connectionId
  }

  /**
   * Get token expiry timestamp
   * @returns {number|null}
   */
  getTokenExpiry() {
    return this.#getCredentials().tokenExpiry
  }

  /**
   * Check if session token is expired or about to expire
   * @param {number} bufferSeconds - Buffer time before actual expiry (default 60s)
   * @returns {boolean}
   */
  isTokenExpired(bufferSeconds = 60) {
    const expiry = this.getTokenExpiry()
    if (!expiry) return true

    const bufferMs = bufferSeconds * 1000
    return Date.now() >= (expiry - bufferMs)
  }

  /**
   * Check if we have valid stored tokens
   * @returns {boolean}
   */
  hasValidTokens() {
    const sessionToken = this.getSessionToken()
    const refreshToken = this.getRefreshToken()
    return !!(sessionToken && refreshToken)
  }

  /**
   * Check if connection is paired (has tokens)
   * @returns {boolean}
   */
  isPaired() {
    return this.hasValidTokens() && !!this.getConnectionId()
  }

  /**
   * Clear all stored tokens for this world
   * @returns {Promise<void>}
   */
  async clearTokens() {
    await this.#setCredentials({
      sessionToken: null,
      refreshToken: null,
      tokenExpiry: null,
      connectionId: null,
      apiKey: null
    })
    Logger.info('Tokens cleared for world', { worldId: this.worldId })
  }

  /**
   * Get time until token expires (in seconds)
   * @returns {number}
   */
  getTimeUntilExpiry() {
    const expiry = this.getTokenExpiry()
    if (!expiry) return 0

    const remaining = expiry - Date.now()
    return Math.max(0, Math.floor(remaining / 1000))
  }

  /**
   * Export tokens for debugging (masked)
   * @returns {Object}
   */
  debugInfo() {
    const sessionToken = this.getSessionToken()
    const refreshToken = this.getRefreshToken()
    const apiKey = this.getApiKey()

    return {
      worldId: this.worldId,
      storageType: 'foundry-settings',
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
}

export default TokenStorage
