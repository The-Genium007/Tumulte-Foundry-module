/**
 * Tumulte Connection Menu - FormApplication for pairing with Tumulte
 *
 * This is a settings submenu that allows users to:
 * - Start a new pairing session and see the code
 * - View connection status
 * - Disconnect from Tumulte
 */

import Logger from '../utils/logger.js'

const MODULE_ID = 'tumulte-integration'

export class TumulteConnectionMenu extends FormApplication {
  constructor(object = {}, options = {}) {
    super(object, options)
    this.pairingInfo = null
    this.countdownInterval = null
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'tumulte-connection-menu',
      title: 'Tumulte Connection',
      template: 'modules/tumulte-integration/templates/connection-menu.hbs',
      classes: ['tumulte-connection-menu'],
      width: 400,
      height: 'auto',
      closeOnSubmit: false,
      submitOnChange: false
    })
  }

  /**
   * Get data for the template
   */
  getData() {
    const tumulte = window.tumulte
    const isPaired = tumulte?.tokenStorage?.isPaired() || false
    const isConnected = tumulte?.socketClient?.connected || false
    const isConnecting = tumulte?.socketClient?.connecting || false

    // Get pairing status if currently pairing
    const pairingStatus = tumulte?.pairingManager?.getPairingStatus() || { active: false }

    // Get reconnection status
    const reconnectAttempts = tumulte?.socketClient?.reconnectAttempts || 0
    const maxReconnectAttempts = tumulte?.socketClient?.maxReconnectAttempts || 10
    const isReconnecting = isPaired && !isConnected && reconnectAttempts > 0

    return {
      isPaired,
      isConnected,
      isConnecting,
      isReconnecting,
      reconnectAttempts,
      maxReconnectAttempts,
      isPairing: pairingStatus.active,
      pairingCode: pairingStatus.code || null,
      pairingRemainingSeconds: pairingStatus.remainingSeconds || 0,
      connectionId: tumulte?.tokenStorage?.getConnectionId() || null
    }
  }

  /**
   * Activate event listeners
   */
  activateListeners(html) {
    super.activateListeners(html)

    // Start pairing button
    html.find('.tumulte-start-pairing').on('click', async (event) => {
      event.preventDefault()
      await this._onStartPairing()
    })

    // Copy code button
    html.find('.tumulte-copy-code').on('click', (event) => {
      event.preventDefault()
      this._onCopyCode()
    })

    // Cancel pairing button
    html.find('.tumulte-cancel-pairing').on('click', (event) => {
      event.preventDefault()
      this._onCancelPairing()
    })

    // Disconnect button
    html.find('.tumulte-disconnect').on('click', async (event) => {
      event.preventDefault()
      await this._onDisconnect()
    })

    // Reconnect button
    html.find('.tumulte-reconnect').on('click', async (event) => {
      event.preventDefault()
      await this._onReconnect()
    })

    // Start countdown if pairing is active
    this._startCountdownIfNeeded()
  }

  /**
   * Start pairing process
   * If already paired, this will disconnect first and start a new pairing
   */
  async _onStartPairing() {
    const tumulte = window.tumulte
    if (!tumulte) {
      ui.notifications.error('Tumulte module not initialized')
      return
    }

    try {
      // If already paired, disconnect first to start fresh
      if (tumulte.tokenStorage?.isPaired()) {
        Logger.info('Already paired, disconnecting before new pairing...')
        tumulte.disconnect()
        await tumulte.tokenStorage.clearTokens()
        await game.settings.set('tumulte-integration', 'connectionId', '')
      }

      // Register callbacks for pairing completion/expiry
      tumulte.pairingManager.onComplete(async (result) => {
        Logger.info('Pairing completed', result)
        this._stopCountdown()

        // Connect to WebSocket after successful pairing
        await tumulte.connect()

        this.render(true)
        ui.notifications.info('Successfully connected to Tumulte!')
      })

      tumulte.pairingManager.onExpired(() => {
        Logger.info('Pairing expired')
        this._stopCountdown()
        this.render(true)
        ui.notifications.warn('Pairing code expired. Please try again.')
      })

      // Start pairing
      this.pairingInfo = await tumulte.startPairing()
      this.render(true)

    } catch (error) {
      Logger.error('Failed to start pairing', error)
      ui.notifications.error(`Pairing failed: ${error.message}`)
    }
  }

  /**
   * Copy pairing code to clipboard
   */
  _onCopyCode() {
    const tumulte = window.tumulte
    const code = tumulte?.pairingManager?.getFormattedCode()

    if (code) {
      navigator.clipboard.writeText(code)
      ui.notifications.info('Code copied to clipboard!')
    }
  }

  /**
   * Cancel current pairing
   */
  _onCancelPairing() {
    const tumulte = window.tumulte
    tumulte?.pairingManager?.cancelPairing()
    this._stopCountdown()
    this.render(true)
  }

  /**
   * Disconnect from Tumulte
   */
  async _onDisconnect() {
    const tumulte = window.tumulte
    if (!tumulte) return

    const confirmed = await Dialog.confirm({
      title: 'Disconnect from Tumulte',
      content: '<p>Are you sure you want to disconnect from Tumulte?</p>',
      yes: () => true,
      no: () => false
    })

    if (confirmed) {
      await tumulte.unpair()
      this.render(true)
    }
  }

  /**
   * Reconnect to Tumulte
   */
  async _onReconnect() {
    const tumulte = window.tumulte
    if (!tumulte) return

    try {
      await tumulte.connect()
      this.render(true)
      ui.notifications.info('Reconnected to Tumulte!')
    } catch (error) {
      ui.notifications.error(`Reconnection failed: ${error.message}`)
    }
  }

  /**
   * Start countdown timer if pairing is active
   */
  _startCountdownIfNeeded() {
    const tumulte = window.tumulte
    const pairingStatus = tumulte?.pairingManager?.getPairingStatus()

    if (!pairingStatus?.active) return

    this._stopCountdown()

    this.countdownInterval = setInterval(() => {
      const status = tumulte?.pairingManager?.getPairingStatus()

      if (!status?.active) {
        this._stopCountdown()
        this.render(true)
        return
      }

      // Update countdown display
      const countdownEl = this.element.find('.tumulte-countdown')
      if (countdownEl.length) {
        countdownEl.text(`${status.remainingSeconds}s`)
      }
    }, 1000)
  }

  /**
   * Stop countdown timer
   */
  _stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
  }

  /**
   * Clean up on close
   */
  async close(options = {}) {
    this._stopCountdown()
    return super.close(options)
  }

  /**
   * No form submission needed
   */
  async _updateObject(event, formData) {
    // This FormApplication doesn't save settings directly
    // All actions are handled via button clicks
  }
}

export default TumulteConnectionMenu
