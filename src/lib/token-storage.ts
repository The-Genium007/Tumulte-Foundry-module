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

interface StoredCredentials {
  sessionToken: string | null
  refreshToken: string | null
  tokenExpiry: number | null
  connectionId: string | null
  apiKey: string | null
  fingerprint: string | null
}

interface DebugInfo {
  worldId: string
  storageType: string
  hasSessionToken: boolean
  hasRefreshToken: boolean
  hasApiKey: boolean
  hasFingerprint: boolean
  sessionTokenPreview: string | null
  apiKeyPreview: string | null
  fingerprintPreview: string | null
  connectionId: string | null
  expiresIn: number
  isExpired: boolean
}

export class TokenStorage {
  private worldId: string

  /**
   * Create a TokenStorage instance for a specific world
   * @param worldId - The Foundry world ID (game.world.id)
   */
  constructor(worldId: string) {
    if (!worldId) {
      throw new Error('TokenStorage requires a worldId')
    }
    this.worldId = worldId

    Logger.debug('TokenStorage initialized for world', { worldId })
  }

  /**
   * Get credentials object from Foundry settings
   */
  private getCredentials(): StoredCredentials {
    return game.settings.get(MODULE_ID, SETTING_KEY) as StoredCredentials
  }

  /**
   * Set credentials object in Foundry settings
   */
  private async setCredentials(credentials: StoredCredentials): Promise<void> {
    await game.settings.set(MODULE_ID, SETTING_KEY, credentials)
  }

  /**
   * Store tokens after successful pairing
   * @param sessionToken - JWT session token
   * @param refreshToken - Refresh token
   * @param expiresIn - Token lifetime in seconds (default 3600)
   */
  async storeTokens(sessionToken: string, refreshToken: string, expiresIn: number = 3600): Promise<boolean> {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000)
      const credentials = this.getCredentials()

      credentials.sessionToken = sessionToken
      credentials.refreshToken = refreshToken
      credentials.tokenExpiry = expiryTime

      await this.setCredentials(credentials)

      Logger.debug('Tokens stored successfully', { worldId: this.worldId, expiresIn })
      return true
    } catch (error) {
      Logger.error('Failed to store tokens', error)
      return false
    }
  }

  /**
   * Store connection ID for reference
   * @param connectionId - Connection UUID
   */
  async storeConnectionId(connectionId: string): Promise<void> {
    const credentials = this.getCredentials()
    credentials.connectionId = connectionId
    await this.setCredentials(credentials)
  }

  /**
   * Store API key for webhook authentication
   * @param apiKey - API key
   */
  async storeApiKey(apiKey: string): Promise<void> {
    const credentials = this.getCredentials()
    credentials.apiKey = apiKey
    await this.setCredentials(credentials)
  }

  /**
   * Get stored API key
   */
  getApiKey(): string | null {
    return this.getCredentials().apiKey
  }

  /**
   * Store fingerprint for security validation on token refresh
   * The fingerprint is generated from worldId + moduleVersion and validated by the backend
   * to detect token theft across different Foundry instances
   * @param fingerprint - Security fingerprint hash
   */
  async storeFingerprint(fingerprint: string): Promise<void> {
    const credentials = this.getCredentials()
    credentials.fingerprint = fingerprint
    await this.setCredentials(credentials)
    Logger.debug('Fingerprint stored', { worldId: this.worldId })
  }

  /**
   * Get stored fingerprint for token refresh validation
   */
  getFingerprint(): string | null {
    return this.getCredentials().fingerprint
  }

  /**
   * Get the session token
   */
  getSessionToken(): string | null {
    return this.getCredentials().sessionToken
  }

  /**
   * Get the refresh token
   */
  getRefreshToken(): string | null {
    return this.getCredentials().refreshToken
  }

  /**
   * Get stored connection ID
   */
  getConnectionId(): string | null {
    return this.getCredentials().connectionId
  }

  /**
   * Get token expiry timestamp
   */
  getTokenExpiry(): number | null {
    return this.getCredentials().tokenExpiry
  }

  /**
   * Check if session token is expired or about to expire
   * @param bufferSeconds - Buffer time before actual expiry (default 60s)
   */
  isTokenExpired(bufferSeconds: number = 60): boolean {
    const expiry = this.getTokenExpiry()
    if (!expiry) return true

    const bufferMs = bufferSeconds * 1000
    return Date.now() >= (expiry - bufferMs)
  }

  /**
   * Check if we have valid stored tokens
   */
  hasValidTokens(): boolean {
    const sessionToken = this.getSessionToken()
    const refreshToken = this.getRefreshToken()
    return !!(sessionToken && refreshToken)
  }

  /**
   * Check if connection is paired (has tokens)
   */
  isPaired(): boolean {
    return this.hasValidTokens() && !!this.getConnectionId()
  }

  /**
   * Clear all stored tokens for this world
   */
  async clearTokens(): Promise<void> {
    await this.setCredentials({
      sessionToken: null,
      refreshToken: null,
      tokenExpiry: null,
      connectionId: null,
      apiKey: null,
      fingerprint: null
    })
    Logger.info('Tokens cleared for world', { worldId: this.worldId })
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiry(): number {
    const expiry = this.getTokenExpiry()
    if (!expiry) return 0

    const remaining = expiry - Date.now()
    return Math.max(0, Math.floor(remaining / 1000))
  }

  /**
   * Export tokens for debugging (masked)
   */
  debugInfo(): DebugInfo {
    const sessionToken = this.getSessionToken()
    const refreshToken = this.getRefreshToken()
    const apiKey = this.getApiKey()
    const fingerprint = this.getFingerprint()

    return {
      worldId: this.worldId,
      storageType: 'foundry-settings',
      hasSessionToken: !!sessionToken,
      hasRefreshToken: !!refreshToken,
      hasApiKey: !!apiKey,
      hasFingerprint: !!fingerprint,
      sessionTokenPreview: sessionToken ? `${sessionToken.substring(0, 20)}...` : null,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : null,
      fingerprintPreview: fingerprint ? `${fingerprint.substring(0, 8)}...` : null,
      connectionId: this.getConnectionId(),
      expiresIn: this.getTimeUntilExpiry(),
      isExpired: this.isTokenExpired()
    }
  }
}

export default TokenStorage
