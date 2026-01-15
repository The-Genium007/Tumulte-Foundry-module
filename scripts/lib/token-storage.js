/**
 * Token Storage for Tumulte VTT Connection
 * Handles secure storage and retrieval of JWT tokens in Foundry VTT
 */

import Logger from '../utils/logger.js'

const STORAGE_PREFIX = 'tumulte_'
const SESSION_TOKEN_KEY = `${STORAGE_PREFIX}session_token`
const REFRESH_TOKEN_KEY = `${STORAGE_PREFIX}refresh_token`
const TOKEN_EXPIRY_KEY = `${STORAGE_PREFIX}token_expiry`
const CONNECTION_ID_KEY = `${STORAGE_PREFIX}connection_id`
const API_KEY_KEY = `${STORAGE_PREFIX}api_key`

export class TokenStorage {
  constructor() {
    this.storage = window.localStorage
  }

  /**
   * Store tokens after successful pairing
   */
  async storeTokens(sessionToken, refreshToken, expiresIn = 3600) {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000)

      this.storage.setItem(SESSION_TOKEN_KEY, sessionToken)
      this.storage.setItem(REFRESH_TOKEN_KEY, refreshToken)
      this.storage.setItem(TOKEN_EXPIRY_KEY, String(expiryTime))

      Logger.debug('Tokens stored successfully', { expiresIn })
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
    this.storage.setItem(CONNECTION_ID_KEY, connectionId)
  }

  /**
   * Store API key for webhook authentication
   */
  storeApiKey(apiKey) {
    this.storage.setItem(API_KEY_KEY, apiKey)
  }

  /**
   * Get stored API key
   */
  getApiKey() {
    return this.storage.getItem(API_KEY_KEY)
  }

  /**
   * Get the session token
   */
  getSessionToken() {
    return this.storage.getItem(SESSION_TOKEN_KEY)
  }

  /**
   * Get the refresh token
   */
  getRefreshToken() {
    return this.storage.getItem(REFRESH_TOKEN_KEY)
  }

  /**
   * Get stored connection ID
   */
  getConnectionId() {
    return this.storage.getItem(CONNECTION_ID_KEY)
  }

  /**
   * Get token expiry timestamp
   */
  getTokenExpiry() {
    const expiry = this.storage.getItem(TOKEN_EXPIRY_KEY)
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
   * Clear all stored tokens
   */
  clearTokens() {
    this.storage.removeItem(SESSION_TOKEN_KEY)
    this.storage.removeItem(REFRESH_TOKEN_KEY)
    this.storage.removeItem(TOKEN_EXPIRY_KEY)
    this.storage.removeItem(CONNECTION_ID_KEY)
    this.storage.removeItem(API_KEY_KEY)
    Logger.info('Tokens cleared')
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
