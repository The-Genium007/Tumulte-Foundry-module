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

const MODULE_ID = 'tumulte-integration'
const MODULE_VERSION = '2.0.1'

/**
 * Main Tumulte Integration Class
 */
class TumulteIntegration {
  constructor() {
    this.tokenStorage = new TokenStorage()
    this.pairingManager = null
    this.socketClient = null

    // Collectors
    this.diceCollector = null
    this.characterCollector = null
    this.combatCollector = null

    // State
    this.initialized = false
    // Default URL for initial pairing - will be replaced by server response
    this.serverUrl = 'https://api.tumulte.tv'
  }

  /**
   * Initialize the module
   */
  async initialize() {
    Logger.info(`Initializing Tumulte Integration v${MODULE_VERSION}`)

    // Register settings
    this.registerSettings()

    // Load server URL from settings (may be empty if first pairing)
    const savedUrl = game.settings.get(MODULE_ID, 'serverUrl')
    if (savedUrl) {
      this.serverUrl = savedUrl
    }

    // Initialize managers
    this.pairingManager = new PairingManager({
      tumulteUrl: this.serverUrl,
      tokenStorage: this.tokenStorage
    })

    this.socketClient = new TumulteSocketClient({
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

    // Add UI elements
    this.addUIElements()

    this.initialized = true
    Logger.info('Tumulte Integration initialized')
  }

  /**
   * Register module settings
   */
  registerSettings() {
    // Server URL (hidden - auto-injected from pairing)
    game.settings.register(MODULE_ID, 'serverUrl', {
      name: game.i18n.localize('TUMULTE.SettingsServerUrl'),
      hint: game.i18n.localize('TUMULTE.SettingsServerUrlHint'),
      scope: 'world',
      config: false, // Hidden - auto-injected from pairing completion
      type: String,
      default: '',
      onChange: value => {
        this.serverUrl = value
        Logger.info('Server URL updated', { url: value })
      }
    })

    // Send all rolls (not just criticals)
    game.settings.register(MODULE_ID, 'sendAllRolls', {
      name: game.i18n.localize('TUMULTE.SettingsSendAllRolls'),
      hint: game.i18n.localize('TUMULTE.SettingsSendAllRollsHint'),
      scope: 'world',
      config: true,
      type: Boolean,
      default: false,
      onChange: value => {
        if (this.diceCollector) {
          this.diceCollector.setSendAllRolls(value)
        }
      }
    })

    // Sync characters
    game.settings.register(MODULE_ID, 'syncCharacters', {
      name: game.i18n.localize('TUMULTE.SettingsSyncCharacters'),
      hint: game.i18n.localize('TUMULTE.SettingsSyncCharactersHint'),
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    })

    // Sync combat
    game.settings.register(MODULE_ID, 'syncCombat', {
      name: game.i18n.localize('TUMULTE.SettingsSyncCombat'),
      hint: game.i18n.localize('TUMULTE.SettingsSyncCombatHint'),
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    })

    // Debug mode
    game.settings.register(MODULE_ID, 'debugMode', {
      name: game.i18n.localize('TUMULTE.SettingsDebugMode'),
      hint: game.i18n.localize('TUMULTE.SettingsDebugModeHint'),
      scope: 'world',
      config: true,
      type: Boolean,
      default: false
    })

    // Connection status (hidden, for internal use)
    game.settings.register(MODULE_ID, 'connectionId', {
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
      Logger.notify('Failed to reconnect to Tumulte', 'error')
    })

    this.socketClient.addEventListener('auth-failed', () => {
      Logger.notify('Authentication failed. Please re-pair with Tumulte.', 'error')
    })

    this.socketClient.addEventListener('revoked', (event) => {
      Logger.notify(`Connection revoked: ${event.detail.reason}`, 'warn')
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

    // Update UI
    this.updateConnectionStatus(true)
  }

  /**
   * Handle disconnection
   */
  onDisconnected(detail) {
    Logger.warn('Disconnected from Tumulte', detail)
    this.updateConnectionStatus(false)
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
    this.updateConnectionStatus(false)
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
    Logger.notify('Disconnected from Tumulte', 'info')
  }

  /**
   * Add UI elements (buttons, indicators)
   */
  addUIElements() {
    // Add settings button
    Hooks.on('renderSettingsConfig', (app, html) => {
      this.addSettingsButtons(html)
    })

    // Add scene control button (optional)
    Hooks.on('getSceneControlButtons', (controls) => {
      this.addSceneControl(controls)
    })
  }

  /**
   * Add buttons to settings panel
   */
  addSettingsButtons(html) {
    const section = html.find('[data-category="tumulte-integration"]')
    if (section.length === 0) return

    const isPaired = this.tokenStorage.isPaired()
    const isConnected = this.socketClient?.connected

    // Create status text
    let statusText = game.i18n.localize('TUMULTE.StatusDisconnected')
    let statusClass = 'disconnected'
    if (isConnected) {
      statusText = game.i18n.localize('TUMULTE.StatusConnected')
      statusClass = 'connected'
    } else if (isPaired) {
      statusText = game.i18n.localize('TUMULTE.StatusPaired')
      statusClass = 'paired'
    }

    // Create button container using DOM methods
    const container = document.createElement('div')
    container.className = 'tumulte-settings-buttons'

    // Status display
    const statusGroup = document.createElement('div')
    statusGroup.className = 'form-group tumulte-buttons'

    const statusLabel = document.createElement('label')
    statusLabel.textContent = game.i18n.localize('TUMULTE.ConnectionStatus')
    statusGroup.appendChild(statusLabel)

    const statusFields = document.createElement('div')
    statusFields.className = 'form-fields'

    const statusSpan = document.createElement('span')
    statusSpan.className = `tumulte-status ${statusClass}`

    const statusIcon = document.createElement('i')
    statusIcon.className = 'fas fa-circle'
    statusSpan.appendChild(statusIcon)
    statusSpan.appendChild(document.createTextNode(' ' + statusText))

    statusFields.appendChild(statusSpan)
    statusGroup.appendChild(statusFields)
    container.appendChild(statusGroup)

    // Buttons group
    const buttonsGroup = document.createElement('div')
    buttonsGroup.className = 'form-group'

    if (isPaired) {
      // Unpair button
      const unpairBtn = document.createElement('button')
      unpairBtn.type = 'button'
      unpairBtn.className = 'tumulte-unpair'

      const unpairIcon = document.createElement('i')
      unpairIcon.className = 'fas fa-unlink'
      unpairBtn.appendChild(unpairIcon)
      unpairBtn.appendChild(document.createTextNode(' ' + game.i18n.localize('TUMULTE.Unpair')))
      unpairBtn.addEventListener('click', () => this.unpair())
      buttonsGroup.appendChild(unpairBtn)

      // Reconnect button (if not connected)
      if (!isConnected) {
        const reconnectBtn = document.createElement('button')
        reconnectBtn.type = 'button'
        reconnectBtn.className = 'tumulte-reconnect'

        const reconnectIcon = document.createElement('i')
        reconnectIcon.className = 'fas fa-plug'
        reconnectBtn.appendChild(reconnectIcon)
        reconnectBtn.appendChild(document.createTextNode(' ' + game.i18n.localize('TUMULTE.Reconnect')))
        reconnectBtn.addEventListener('click', () => this.connect())
        buttonsGroup.appendChild(reconnectBtn)
      }
    } else {
      // Pair button
      const pairBtn = document.createElement('button')
      pairBtn.type = 'button'
      pairBtn.className = 'tumulte-pair'

      const pairIcon = document.createElement('i')
      pairIcon.className = 'fas fa-link'
      pairBtn.appendChild(pairIcon)
      pairBtn.appendChild(document.createTextNode(' ' + game.i18n.localize('TUMULTE.StartPairing')))
      pairBtn.addEventListener('click', () => this.showPairingDialog())
      buttonsGroup.appendChild(pairBtn)
    }

    // Test button
    const testBtn = document.createElement('button')
    testBtn.type = 'button'
    testBtn.className = 'tumulte-test'

    const testIcon = document.createElement('i')
    testIcon.className = 'fas fa-vial'
    testBtn.appendChild(testIcon)
    testBtn.appendChild(document.createTextNode(' ' + game.i18n.localize('TUMULTE.TestRoll')))
    testBtn.addEventListener('click', () => this.sendTestRoll())
    buttonsGroup.appendChild(testBtn)

    container.appendChild(buttonsGroup)
    section.append(container)
  }

  /**
   * Add scene control button
   */
  addSceneControl(controls) {
    const tokenControls = controls.find(c => c.name === 'token')
    if (!tokenControls) return

    tokenControls.tools.push({
      name: 'tumulte',
      title: 'Tumulte',
      icon: 'fas fa-broadcast-tower',
      visible: game.user.isGM,
      onClick: () => this.showStatusDialog(),
      button: true
    })
  }

  /**
   * Update connection status display
   */
  updateConnectionStatus(connected) {
    // Update any UI elements showing connection status
    const statusElements = document.querySelectorAll('.tumulte-status')
    statusElements.forEach(el => {
      el.className = `tumulte-status ${connected ? 'connected' : 'disconnected'}`
      // Clear existing content
      while (el.firstChild) {
        el.removeChild(el.firstChild)
      }
      // Add new content safely
      const icon = document.createElement('i')
      icon.className = 'fas fa-circle'
      el.appendChild(icon)
      el.appendChild(document.createTextNode(' ' + (connected ? 'Connected' : 'Disconnected')))
    })
  }

  /**
   * Show pairing dialog
   */
  async showPairingDialog() {
    try {
      const pairingInfo = await this.startPairing()

      // Build content safely using DOM
      const content = document.createElement('div')
      content.className = 'tumulte-pairing-dialog'

      const instructions = document.createElement('p')
      instructions.textContent = game.i18n.localize('TUMULTE.PairingInstructions')
      content.appendChild(instructions)

      // Pairing code display
      const codeDiv = document.createElement('div')
      codeDiv.className = 'pairing-code'

      const codeLabel = document.createElement('label')
      codeLabel.textContent = game.i18n.localize('TUMULTE.PairingCode')
      codeDiv.appendChild(codeLabel)

      const codeEl = document.createElement('code')
      codeEl.className = 'code'
      codeEl.textContent = pairingInfo.code
      codeDiv.appendChild(codeEl)
      content.appendChild(codeDiv)

      // Pairing URL
      const urlDiv = document.createElement('div')
      urlDiv.className = 'pairing-url'

      const urlLabel = document.createElement('label')
      urlLabel.textContent = game.i18n.localize('TUMULTE.PairingUrl')
      urlDiv.appendChild(urlLabel)

      const urlInput = document.createElement('input')
      urlInput.type = 'text'
      urlInput.value = pairingInfo.url
      urlInput.readOnly = true
      urlInput.addEventListener('click', () => urlInput.select())
      urlDiv.appendChild(urlInput)

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'copy-url'

      const copyIcon = document.createElement('i')
      copyIcon.className = 'fas fa-copy'
      copyBtn.appendChild(copyIcon)
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(pairingInfo.url)
        ui.notifications.info(game.i18n.localize('TUMULTE.UrlCopied'))
      })
      urlDiv.appendChild(copyBtn)
      content.appendChild(urlDiv)

      // Expiry info
      const expiryP = document.createElement('p')
      expiryP.className = 'expires'
      const remainingSecs = Math.floor((pairingInfo.expiresAt - Date.now()) / 1000)
      expiryP.textContent = game.i18n.format('TUMULTE.PairingExpires', { seconds: remainingSecs })
      content.appendChild(expiryP)

      new Dialog({
        title: game.i18n.localize('TUMULTE.PairingDialogTitle'),
        content: content.outerHTML,
        buttons: {
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('Cancel'),
            callback: () => this.pairingManager.cancelPairing()
          }
        },
        default: 'cancel',
        render: (html) => {
          html.find('.copy-url').on('click', () => {
            navigator.clipboard.writeText(pairingInfo.url)
            ui.notifications.info(game.i18n.localize('TUMULTE.UrlCopied'))
          })
        }
      }).render(true)

    } catch (error) {
      Logger.notify(`Pairing failed: ${error.message}`, 'error')
    }
  }

  /**
   * Show status dialog
   */
  showStatusDialog() {
    const status = this.getStatus()
    const tokenInfo = this.tokenStorage.debugInfo()

    // Build content safely
    const content = document.createElement('div')
    content.className = 'tumulte-status-dialog'

    // Connection section
    const connHeader = document.createElement('h3')
    connHeader.textContent = 'Connection'
    content.appendChild(connHeader)

    const connList = document.createElement('ul')
    const connItems = [
      { label: 'Connected', value: status.connected ? 'Yes' : 'No' },
      { label: 'Paired', value: status.paired ? 'Yes' : 'No' },
      { label: 'Connection ID', value: status.connectionId || 'N/A' }
    ]
    connItems.forEach(item => {
      const li = document.createElement('li')
      const strong = document.createElement('strong')
      strong.textContent = item.label + ':'
      li.appendChild(strong)
      li.appendChild(document.createTextNode(' ' + item.value))
      connList.appendChild(li)
    })
    content.appendChild(connList)

    // Collectors section
    const collHeader = document.createElement('h3')
    collHeader.textContent = 'Collectors'
    content.appendChild(collHeader)

    const collList = document.createElement('ul')
    const collItems = [
      { label: 'Dice Collector', value: this.diceCollector ? 'Active' : 'Inactive' },
      { label: 'Character Collector', value: this.characterCollector ? 'Active' : 'Inactive' },
      { label: 'Combat Collector', value: this.combatCollector ? 'Active' : 'Inactive' }
    ]
    collItems.forEach(item => {
      const li = document.createElement('li')
      const strong = document.createElement('strong')
      strong.textContent = item.label + ':'
      li.appendChild(strong)
      li.appendChild(document.createTextNode(' ' + item.value))
      collList.appendChild(li)
    })
    content.appendChild(collList)

    // Token info section
    const tokenHeader = document.createElement('h3')
    tokenHeader.textContent = 'Token Storage'
    content.appendChild(tokenHeader)

    const pre = document.createElement('pre')
    pre.textContent = JSON.stringify(tokenInfo, null, 2)
    content.appendChild(pre)

    new Dialog({
      title: 'Tumulte Status',
      content: content.outerHTML,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: 'OK'
        }
      }
    }).render(true)
  }

  /**
   * Send a test dice roll
   */
  async sendTestRoll() {
    if (!this.socketClient?.connected) {
      Logger.notify('Not connected to Tumulte', 'warn')
      return
    }

    const sent = await this.diceCollector?.sendTestRoll()
    if (sent) {
      Logger.notify('Test roll sent', 'info')
    } else {
      Logger.notify('Failed to send test roll', 'error')
    }
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
