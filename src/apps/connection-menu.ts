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

interface PairingStatus {
  active: boolean
  code?: string
  remainingSeconds?: number
}

interface HealthCheckResult {
  status: string
}

interface ReauthorizationResult {
  status: 'reauthorized' | 'still_revoked' | 'already_active' | string
}

interface TumulteGlobal {
  tokenStorage?: {
    isPaired(): boolean
    getConnectionId(): string | null
    clearTokens(): Promise<void>
  }
  socketClient?: {
    connected: boolean
    connecting: boolean
    reconnectAttempts: number
    maxReconnectAttempts: number
    checkConnectionHealth(): Promise<HealthCheckResult>
    checkReauthorizationStatus(): Promise<ReauthorizationResult>
  }
  pairingManager?: {
    getPairingStatus(): PairingStatus
    getFormattedCode(): string | null
    cancelPairing(): void
    clearCallbacks(): void
    onComplete(callback: (result: unknown) => void): void
    onExpired(callback: () => void): void
  }
  connect(): Promise<void>
  disconnect(): void
  startPairing(): Promise<unknown>
  unpair(): Promise<void>
}

declare global {
  interface Window {
    tumulte?: TumulteGlobal
  }
}

interface ConnectionMenuData {
  isPaired: boolean
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  reconnectAttempts: number
  maxReconnectAttempts: number
  isPairing: boolean
  pairingCode: string | null
  pairingRemainingSeconds: number
  connectionId: string | null
  isRevoked: boolean
  isWaitingReauthorization: boolean
}

export class TumulteConnectionMenu extends FormApplication {
  private pairingInfo: unknown
  private countdownInterval: ReturnType<typeof setInterval> | null
  private reauthorizationPollInterval: ReturnType<typeof setInterval> | null
  private isRevoked: boolean

  constructor(object: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
    super(object, options)
    this.pairingInfo = null
    this.countdownInterval = null
    this.reauthorizationPollInterval = null
    this.isRevoked = false
  }

  static override get defaultOptions(): Record<string, unknown> {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'tumulte-connection-menu',
      title: 'Tumulte Connection',
      template: 'modules/tumulte-integration/templates/connection-menu.hbs',
      classes: ['tumulte-connection-menu'],
      width: 400,
      height: 'auto',
      closeOnSubmit: false,
      submitOnChange: false,
    })
  }

  override getData(): Record<string, unknown> {
    const tumulte = window.tumulte
    const isPaired = tumulte?.tokenStorage?.isPaired() || false
    const isConnected = tumulte?.socketClient?.connected || false
    const isConnecting = tumulte?.socketClient?.connecting || false

    const pairingStatus = tumulte?.pairingManager?.getPairingStatus() || { active: false }

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
      connectionId: tumulte?.tokenStorage?.getConnectionId() || null,
      isRevoked: this.isRevoked,
      isWaitingReauthorization: this.reauthorizationPollInterval !== null,
    }
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html)

    html.find('.tumulte-start-pairing').on('click', async (event: Event) => {
      event.preventDefault()
      await this._onStartPairing()
    })

    html.find('.tumulte-copy-code').on('click', (event: Event) => {
      event.preventDefault()
      this._onCopyCode()
    })

    html.find('.tumulte-cancel-pairing').on('click', (event: Event) => {
      event.preventDefault()
      this._onCancelPairing()
    })

    html.find('.tumulte-disconnect').on('click', async (event: Event) => {
      event.preventDefault()
      await this._onDisconnect()
    })

    html.find('.tumulte-reconnect').on('click', async (event: Event) => {
      event.preventDefault()
      await this._onReconnect()
    })

    html.find('.tumulte-wait-reauthorization').on('click', async (event: Event) => {
      event.preventDefault()
      await this._onWaitReauthorization()
    })

    html.find('.tumulte-stop-waiting').on('click', (event: Event) => {
      event.preventDefault()
      this._stopReauthorizationPolling()
      this.render(true)
    })

    this._startCountdownIfNeeded()
    this._checkRevocationStatus()
  }

  private async _onStartPairing(): Promise<void> {
    const tumulte = window.tumulte
    if (!tumulte) {
      ui.notifications.error('Tumulte module not initialized')
      return
    }

    try {
      if (tumulte.tokenStorage?.isPaired()) {
        Logger.info('Already paired, disconnecting before new pairing...')
        tumulte.disconnect()
        await tumulte.tokenStorage.clearTokens()
      }

      tumulte.pairingManager!.clearCallbacks()

      tumulte.pairingManager!.onComplete(async (result: unknown) => {
        Logger.info('Pairing completed', result)
        this._stopCountdown()
        await tumulte.connect()
        this.render(true)
        ui.notifications.info('Successfully connected to Tumulte!')
      })

      tumulte.pairingManager!.onExpired(() => {
        Logger.info('Pairing expired')
        this._stopCountdown()
        this.render(true)
        ui.notifications.warn('Pairing code expired. Please try again.')
      })

      this.pairingInfo = await tumulte.startPairing()
      this.render(true)
    } catch (error) {
      Logger.error('Failed to start pairing', error)
      ui.notifications.error(`Pairing failed: ${(error as Error).message}`)
    }
  }

  private _onCopyCode(): void {
    const tumulte = window.tumulte
    const code = tumulte?.pairingManager?.getFormattedCode()

    if (code) {
      navigator.clipboard.writeText(code)
      ui.notifications.info('Code copied to clipboard!')
    }
  }

  private _onCancelPairing(): void {
    const tumulte = window.tumulte
    tumulte?.pairingManager?.cancelPairing()
    this._stopCountdown()
    this.render(true)
  }

  private async _onDisconnect(): Promise<void> {
    const tumulte = window.tumulte
    if (!tumulte) return

    const confirmed = await Dialog.confirm({
      title: 'Disconnect from Tumulte',
      content: '<p>Are you sure you want to disconnect from Tumulte?</p>',
      yes: () => true,
      no: () => false,
    })

    if (confirmed) {
      await tumulte.unpair()
      this.render(true)
    }
  }

  private async _onReconnect(): Promise<void> {
    const tumulte = window.tumulte
    if (!tumulte) return

    try {
      await tumulte.connect()
      this.render(true)
      ui.notifications.info('Reconnected to Tumulte!')
    } catch (error) {
      ui.notifications.error(`Reconnection failed: ${(error as Error).message}`)
    }
  }

  private async _checkRevocationStatus(): Promise<void> {
    const tumulte = window.tumulte
    if (!tumulte?.tokenStorage?.isPaired()) return
    if (tumulte?.socketClient?.connected) return

    try {
      const healthStatus = await tumulte.socketClient!.checkConnectionHealth()
      if (healthStatus.status === 'revoked') {
        this.isRevoked = true
        this.render(true)
      }
    } catch (error) {
      Logger.warn('Failed to check revocation status', error)
    }
  }

  private async _onWaitReauthorization(): Promise<void> {
    const tumulte = window.tumulte
    if (!tumulte) return

    ui.notifications.info('Waiting for GM to reauthorize access on Tumulte...')

    this._startReauthorizationPolling()
    this.render(true)
  }

  private _startReauthorizationPolling(): void {
    if (this.reauthorizationPollInterval) {
      clearInterval(this.reauthorizationPollInterval)
    }

    const POLL_INTERVAL = 3000

    this.reauthorizationPollInterval = setInterval(async () => {
      await this._checkReauthorizationStatus()
    }, POLL_INTERVAL)

    this._checkReauthorizationStatus()
  }

  private _stopReauthorizationPolling(): void {
    if (this.reauthorizationPollInterval) {
      clearInterval(this.reauthorizationPollInterval)
      this.reauthorizationPollInterval = null
    }
  }

  private async _checkReauthorizationStatus(): Promise<void> {
    const tumulte = window.tumulte
    if (!tumulte) return

    try {
      const result = await tumulte.socketClient!.checkReauthorizationStatus()

      if (result.status === 'reauthorized') {
        Logger.info('Connection reauthorized!', result)
        this._stopReauthorizationPolling()
        this.isRevoked = false
        await tumulte.connect()
        this.render(true)
        ui.notifications.info('Connection reauthorized! Reconnected to Tumulte.')
      } else if (result.status === 'still_revoked') {
        Logger.debug('Still waiting for reauthorization...')
      } else if (result.status === 'already_active') {
        this._stopReauthorizationPolling()
        this.isRevoked = false
        await tumulte.connect()
        this.render(true)
      }
    } catch (error) {
      Logger.warn('Error checking reauthorization status', error)
    }
  }

  private _startCountdownIfNeeded(): void {
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

      const countdownEl = this.element.find('.tumulte-countdown')
      if (countdownEl.length) {
        countdownEl.text(`${status.remainingSeconds}s`)
      }
    }, 1000)
  }

  private _stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
  }

  override async close(options: Record<string, unknown> = {}): Promise<void> {
    this._stopCountdown()
    this._stopReauthorizationPolling()
    await super.close(options)
  }

  override async _updateObject(_event: Event, _formData: Record<string, unknown>): Promise<void> {
    // This FormApplication doesn't save settings directly
    // All actions are handled via button clicks
  }
}

export default TumulteConnectionMenu
