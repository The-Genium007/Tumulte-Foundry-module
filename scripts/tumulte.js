/**
 * Tumulte Integration Module v2 for Foundry VTT
 *
 * Real-time integration with Tumulte platform for Twitch overlays
 * Features:
 * - JWT-based secure pairing
 * - WebSocket bidirectional communication
 * - Dice roll synchronization
 * - Character data sync
 * - Combat tracking
 */

import Logger from './utils/logger.js'
import TokenStorage from './lib/token-storage.js'
import PairingManager from './lib/pairing-manager.js'
import TumulteSocketClient from './lib/socket-client.js'
import DiceCollector from './collectors/dice-collector.js'
import CharacterCollector from './collectors/character-collector.js'
import CombatCollector from './collectors/combat-collector.js'
import TumulteConnectionMenu from './apps/connection-menu.js'

const MODULE_ID = 'tumulte-integration'
const MODULE_VERSION = '2.0.2'

/**
 * Main Tumulte Integration Class
 */
class TumulteIntegration {
  constructor() {
    // TokenStorage, PairingManager, and SocketClient are initialized in initialize()
    // because they require game.world.id which is only available after Foundry is ready
    this.tokenStorage = null
    this.pairingManager = null
    this.socketClient = null

    // Collectors
    this.diceCollector = null
    this.characterCollector = null
    this.combatCollector = null

    // State
    this.initialized = false
    this.worldId = null
    // Build URL - placeholder is replaced by CI/CD for staging/prod
    // If placeholder is still present, we're in local dev mode
    const configuredUrl = '__TUMULTE_API_URL__'
    this.buildUrl = configuredUrl.startsWith('__') ? null : configuredUrl
    this.serverUrl = this.buildUrl || 'http://localhost:3333'
  }

  /**
   * Initialize the module
   */
  async initialize() {
    Logger.info(`Initializing Tumulte Integration v${MODULE_VERSION}`)

    // Get worldId from Foundry (now available since we're in the ready hook)
    this.worldId = game.world.id
    Logger.info('World ID', { worldId: this.worldId })

    // Register settings
    this.registerSettings()

    // Load server URL from settings, but only in dev mode (no build URL)
    // In staging/production, the build URL takes priority to prevent stale saved URLs
    if (!this.buildUrl) {
      const savedUrl = game.settings.get(MODULE_ID, 'serverUrl')
      if (savedUrl) {
        this.serverUrl = savedUrl
      }
    }

    // Initialize TokenStorage with worldId for namespaced storage
    this.tokenStorage = new TokenStorage(this.worldId)

    // Initialize managers with worldId
    this.pairingManager = new PairingManager({
      worldId: this.worldId,
      tumulteUrl: this.serverUrl,
      tokenStorage: this.tokenStorage
    })

    this.socketClient = new TumulteSocketClient({
      worldId: this.worldId,
      serverUrl: this.serverUrl,
      tokenStorage: this.tokenStorage
    })

    // Initialize collectors (but don't start them yet)
    this.diceCollector = new DiceCollector(this.socketClient)
    this.characterCollector = new CharacterCollector(this.socketClient)
    this.combatCollector = new CombatCollector(this.socketClient)

    // Setup socket event handlers
    this.setupSocketHandlers()

    // Auto-connect if already paired
    if (this.tokenStorage.isPaired()) {
      Logger.info('Found existing pairing, attempting to connect...')
      await this.connect()
    }

    this.initialized = true
    Logger.info('Tumulte Integration initialized')
  }

  /**
   * Register module settings
   */
  registerSettings() {
    // Connection Menu - This adds a button in settings that opens our FormApplication
    game.settings.registerMenu(MODULE_ID, 'connectionMenu', {
      name: 'Tumulte Connection',
      label: 'Manage Connection',
      hint: 'Connect or disconnect from Tumulte, view status, and test the connection.',
      icon: 'fas fa-plug',
      type: TumulteConnectionMenu,
      restricted: true // GM only
    })

    // Server URL (hidden - auto-injected from pairing)
    game.settings.register(MODULE_ID, 'serverUrl', {
      name: 'Tumulte Server URL',
      hint: 'URL of the Tumulte server (automatically configured during pairing)',
      scope: 'world',
      config: false,
      type: String,
      default: '',
      onChange: value => {
        this.serverUrl = value
        Logger.info('Server URL updated', { url: value })
      }
    })

    // Send all rolls (not just criticals)
    game.settings.register(MODULE_ID, 'sendAllRolls', {
      name: 'Send All Rolls',
      hint: 'If enabled, sends all dice rolls to Tumulte. If disabled, only sends critical successes and failures.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true,
      onChange: value => {
        if (this.diceCollector) {
          this.diceCollector.setSendAllRolls(value)
        }
      }
    })

    // Sync characters
    game.settings.register(MODULE_ID, 'syncCharacters', {
      name: 'Sync Characters',
      hint: 'Enable automatic synchronization of character data with Tumulte.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    })

    // Sync combat
    game.settings.register(MODULE_ID, 'syncCombat', {
      name: 'Sync Combat',
      hint: 'Enable combat tracking and turn notifications.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    })

    // Debug mode
    game.settings.register(MODULE_ID, 'debugMode', {
      name: 'Debug Mode',
      hint: 'Enable debug logging in the browser console.',
      scope: 'world',
      config: true,
      type: Boolean,
      default: false
    })

    // Connection ID (hidden, for internal use) - DEPRECATED: kept for reference, now in credentials
    game.settings.register(MODULE_ID, 'connectionId', {
      scope: 'world',
      config: false,
      type: String,
      default: ''
    })

    // Credentials storage (persisted in Foundry DB instead of localStorage)
    game.settings.register(MODULE_ID, 'credentials', {
      name: 'Tumulte Credentials',
      hint: 'Stored credentials for Tumulte connection (persisted in Foundry database)',
      scope: 'world',
      config: false,
      type: Object,
      default: {
        sessionToken: null,
        refreshToken: null,
        tokenExpiry: null,
        connectionId: null,
        apiKey: null
      }
    })
  }

  /**
   * Setup socket event handlers
   */
  setupSocketHandlers() {
    // Connection events
    this.socketClient.addEventListener('connected', () => {
      this.onConnected()
    })

    this.socketClient.addEventListener('disconnected', (event) => {
      this.onDisconnected(event.detail)
    })

    this.socketClient.addEventListener('reconnecting', (event) => {
      const { attempt } = event.detail
      Logger.info(`Reconnecting (attempt ${attempt})...`)
    })

    this.socketClient.addEventListener('reconnect-failed', () => {
      ui.notifications.error('Failed to reconnect to Tumulte')
    })

    this.socketClient.addEventListener('auth-failed', () => {
      ui.notifications.error('Authentication failed. Please re-pair with Tumulte.')
    })

    this.socketClient.addEventListener('revoked', (event) => {
      ui.notifications.warn(`Connection revoked: ${event.detail.reason}`)
    })

    this.socketClient.addEventListener('campaign-deleted', () => {
      // Campaign was deleted on Tumulte, tokens have been cleared
      // Notify user with a dialog
      new Dialog({
        title: 'Campaign No Longer Exists',
        content: `<p>The campaign associated with this Foundry world has been deleted from Tumulte.</p>
                  <p>Please connect to a new campaign.</p>`,
        buttons: {
          connect: {
            icon: '<i class="fas fa-link"></i>',
            label: 'Connect',
            callback: () => {
              // Open the connection menu
              new TumulteConnectionMenu().render(true)
            }
          },
          ok: {
            icon: '<i class="fas fa-check"></i>',
            label: 'OK'
          }
        },
        default: 'connect'
      }).render(true)
    })

    // Acknowledgement events
    this.socketClient.addEventListener('dice-roll-ack', (event) => {
      const { success, error } = event.detail
      if (!success) {
        Logger.warn('Dice roll not acknowledged', { error })
      }
    })
  }

  /**
   * Handle successful connection
   */
  onConnected() {
    Logger.info('Connected to Tumulte')

    // Initialize collectors
    this.diceCollector.initialize()

    if (game.settings.get(MODULE_ID, 'syncCharacters')) {
      this.characterCollector.initialize()
    }

    if (game.settings.get(MODULE_ID, 'syncCombat')) {
      this.combatCollector.initialize()
    }
  }

  /**
   * Handle disconnection
   */
  onDisconnected(detail) {
    Logger.warn('Disconnected from Tumulte', detail)
  }

  /**
   * Connect to Tumulte server
   */
  async connect() {
    if (!this.tokenStorage.isPaired()) {
      Logger.warn('Cannot connect: not paired')
      return false
    }

    try {
      await this.socketClient.connect()
      return true
    } catch (error) {
      Logger.error('Failed to connect', error)
      return false
    }
  }

  /**
   * Disconnect from Tumulte server
   */
  disconnect() {
    this.socketClient.disconnect()
  }

  /**
   * Start pairing process
   */
  async startPairing() {
    try {
      const pairingInfo = await this.pairingManager.startPairing()
      return pairingInfo
    } catch (error) {
      Logger.error('Failed to start pairing', error)
      throw error
    }
  }

  /**
   * Complete pairing with tokens from Tumulte
   */
  async completePairing(connectionData) {
    try {
      const result = await this.pairingManager.completePairing(connectionData)

      // Update serverUrl if provided by pairing
      if (result.serverUrl) {
        this.serverUrl = result.serverUrl
        this.socketClient.updateServerUrl(result.serverUrl)
      }

      // Store connection ID in settings
      game.settings.set(MODULE_ID, 'connectionId', connectionData.connection.id)

      // Connect immediately
      await this.connect()

      return true
    } catch (error) {
      Logger.error('Failed to complete pairing', error)
      throw error
    }
  }

  /**
   * Unpair from Tumulte
   */
  async unpair() {
    this.disconnect()
    await this.pairingManager.unpair()
    game.settings.set(MODULE_ID, 'connectionId', '')
    ui.notifications.info('Disconnected from Tumulte')
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      version: MODULE_VERSION,
      initialized: this.initialized,
      connected: this.socketClient?.connected || false,
      paired: this.tokenStorage.isPaired(),
      connectionId: this.tokenStorage.getConnectionId(),
      serverUrl: this.serverUrl
    }
  }
}

// Initialize when Foundry is ready
Hooks.once('ready', async () => {
  // Only initialize for GM
  if (!game.user.isGM) {
    Logger.info('Tumulte Integration: GM only module')
    return
  }

  window.tumulte = new TumulteIntegration()
  await window.tumulte.initialize()
})

// Export for external access
export { TumulteIntegration }
