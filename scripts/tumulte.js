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
const MODULE_VERSION = '2.0.7'

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
    this.reauthorizationPollInterval = null
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

    // Run migrations if module version changed
    await this.runMigrations()

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
      try {
        // First check connection health to detect revocation before attempting WebSocket
        const healthStatus = await this.socketClient.checkConnectionHealth()

        if (healthStatus.status === 'revoked') {
          Logger.warn('Connection is revoked, starting automatic reauthorization polling')
          // Start polling automatically in background - reconnection will happen without user action
          this.startReauthorizationPolling()
          // Also show dialog to inform the user
          this.showRevocationDialog(healthStatus.message)
          return
        }

        await this.connect()
      } catch (error) {
        Logger.error('Auto-connect failed', error)
        Logger.notify('Failed to auto-connect to Tumulte. Please reconnect manually.', 'warn')
      }
    }

    this.initialized = true
    Logger.info('Tumulte Integration initialized')
  }

  /**
   * Run migrations when module version changes
   * This ensures settings are updated when deploying new versions
   */
  async runMigrations() {
    const savedVersion = game.settings.get(MODULE_ID, 'moduleVersion') || '0.0.0'

    if (savedVersion === MODULE_VERSION) {
      return // No migration needed
    }

    Logger.info('Module updated, running migrations...', {
      from: savedVersion,
      to: MODULE_VERSION
    })

    // Migration: Force server URL to build URL if available
    // This prevents stale URLs from old installations
    if (this.buildUrl) {
      const currentUrl = game.settings.get(MODULE_ID, 'serverUrl')
      if (currentUrl !== this.buildUrl) {
        await game.settings.set(MODULE_ID, 'serverUrl', this.buildUrl)
        this.serverUrl = this.buildUrl
        Logger.info('Server URL migrated to build URL', {
          oldUrl: currentUrl,
          newUrl: this.buildUrl
        })
      }
    }

    // Save current version to prevent re-running migrations
    await game.settings.set(MODULE_ID, 'moduleVersion', MODULE_VERSION)
    Logger.info('Migration completed', { version: MODULE_VERSION })
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

    // Module version tracking for migrations
    game.settings.register(MODULE_ID, 'moduleVersion', {
      scope: 'world',
      config: false,
      type: String,
      default: ''
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
      // Connection was revoked (manually by user or due to token invalidation)
      const reason = event.detail?.reason || 'Unknown reason'
      new Dialog({
        title: 'Tumulte Connection Revoked',
        content: `
          <div style="text-align: center; padding: 10px;">
            <i class="fas fa-unlink fa-3x" style="color: #e74c3c; margin-bottom: 15px;"></i>
            <p style="font-size: 14px; margin-bottom: 10px;">Your connection to Tumulte has been revoked.</p>
            <p style="font-size: 12px; color: #666;"><strong>Reason:</strong> ${reason}</p>
            <p style="font-size: 12px; color: #666; margin-top: 15px;">You can reconnect by starting a new pairing process.</p>
          </div>
        `,
        buttons: {
          reconnect: {
            icon: '<i class="fas fa-plug"></i>',
            label: 'Reconnect',
            callback: () => {
              new TumulteConnectionMenu().render(true)
            }
          },
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Close'
          }
        },
        default: 'reconnect'
      }).render(true)
    })

    this.socketClient.addEventListener('campaign-deleted', (event) => {
      // Campaign was deleted on Tumulte, tokens have been cleared
      const campaignName = event.detail?.campaignName || 'your campaign'
      new Dialog({
        title: 'Campaign Deleted',
        content: `
          <div style="text-align: center; padding: 10px;">
            <i class="fas fa-trash-alt fa-3x" style="color: #e74c3c; margin-bottom: 15px;"></i>
            <p style="font-size: 14px; margin-bottom: 10px;">The campaign <strong>"${campaignName}"</strong> has been deleted from Tumulte.</p>
            <p style="font-size: 12px; color: #666;">This Foundry world is no longer linked to any Tumulte campaign.</p>
            <p style="font-size: 12px; color: #666; margin-top: 15px;">You can connect to a new campaign to continue using Tumulte features.</p>
          </div>
        `,
        buttons: {
          connect: {
            icon: '<i class="fas fa-link"></i>',
            label: 'Connect to New Campaign',
            callback: () => {
              new TumulteConnectionMenu().render(true)
            }
          },
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Close'
          }
        },
        default: 'connect'
      }).render(true)
    })

    this.socketClient.addEventListener('reconnect-failed', () => {
      // Show a dialog when reconnection fails after max attempts
      new Dialog({
        title: 'Connection Lost',
        content: `
          <div style="text-align: center; padding: 10px;">
            <i class="fas fa-cloud-download-alt fa-3x" style="color: #f39c12; margin-bottom: 15px;"></i>
            <p style="font-size: 14px; margin-bottom: 10px;">Unable to reach Tumulte server after multiple attempts.</p>
            <p style="font-size: 12px; color: #666;">The server may be temporarily unavailable.</p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;"><strong>Your dice rolls and data are not being lost.</strong></p>
            <p style="font-size: 12px; color: #666;">They will sync automatically when the connection is restored.</p>
          </div>
        `,
        buttons: {
          retry: {
            icon: '<i class="fas fa-redo"></i>',
            label: 'Retry Now',
            callback: async () => {
              try {
                await this.connect()
              } catch (error) {
                ui.notifications.error('Connection failed. Please try again later.')
              }
            }
          },
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Close'
          }
        },
        default: 'retry'
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

  /**
   * Start polling for reauthorization status
   * Called automatically when connection is revoked at startup
   * Will auto-reconnect when GM reauthorizes from Tumulte dashboard
   */
  startReauthorizationPolling() {
    // Don't start if already polling
    if (this.reauthorizationPollInterval) {
      Logger.debug('Reauthorization polling already active')
      return
    }

    const POLL_INTERVAL = 3000 // 3 seconds

    Logger.info('Starting reauthorization polling...')

    this.reauthorizationPollInterval = setInterval(async () => {
      await this._checkReauthorizationStatus()
    }, POLL_INTERVAL)

    // Check immediately too
    this._checkReauthorizationStatus()
  }

  /**
   * Stop reauthorization polling
   */
  stopReauthorizationPolling() {
    if (this.reauthorizationPollInterval) {
      clearInterval(this.reauthorizationPollInterval)
      this.reauthorizationPollInterval = null
      Logger.info('Reauthorization polling stopped')
    }
  }

  /**
   * Check reauthorization status (internal method for polling)
   */
  async _checkReauthorizationStatus() {
    try {
      const result = await this.socketClient.checkReauthorizationStatus()

      if (result.status === 'reauthorized') {
        Logger.info('Connection reauthorized via polling!', result)
        this.stopReauthorizationPolling()

        // Connect with new tokens
        await this.connect()
        ui.notifications.info('Connexion réautorisée ! Reconnecté à Tumulte.')
      } else if (result.status === 'already_active') {
        Logger.info('Connection already active, connecting...')
        this.stopReauthorizationPolling()

        await this.connect()
        ui.notifications.info('Connexion rétablie !')
      } else {
        Logger.debug('Still waiting for reauthorization...', { status: result.status })
      }
    } catch (error) {
      Logger.warn('Error checking reauthorization status', error)
    }
  }

  /**
   * Show revocation dialog with reauthorization polling
   * Note: Polling is already started automatically, this dialog is informational
   */
  showRevocationDialog(message) {
    let dialog = null

    // Listen for successful reconnection to close the dialog
    const onConnected = () => {
      if (dialog) {
        dialog.close()
      }
    }

    // Register one-time listener
    this.socketClient.addEventListener('connected', onConnected, { once: true })

    dialog = new Dialog({
      title: 'Connexion Tumulte Révoquée',
      content: `
        <div style="text-align: center; padding: 15px;">
          <i class="fas fa-ban fa-3x" style="color: #e74c3c; margin-bottom: 15px;"></i>
          <p style="font-size: 14px; margin-bottom: 10px;">
            ${message || "L'accès à Tumulte a été révoqué."}
          </p>
          <p style="font-size: 12px; color: #666; margin-bottom: 15px;">
            Demandez au GM de réautoriser l'accès depuis le tableau de bord Tumulte.
          </p>
          <p style="font-size: 12px; color: #3498db;">
            <i class="fas fa-circle-notch fa-spin"></i> En attente de réautorisation...
          </p>
        </div>
      `,
      buttons: {
        newPairing: {
          icon: '<i class="fas fa-link"></i>',
          label: 'Nouveau pairing',
          callback: () => {
            this.stopReauthorizationPolling()
            new TumulteConnectionMenu().render(true)
          }
        },
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Fermer',
          callback: () => {
            // Keep polling in background even if dialog is closed
            Logger.info('Dialog closed, polling continues in background')
          }
        }
      },
      default: 'close',
      close: () => {
        // Remove the listener if dialog is closed manually
        this.socketClient.removeEventListener('connected', onConnected)
      }
    })

    dialog.render(true)
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
