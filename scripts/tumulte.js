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
import SpellEffectCollector from './collectors/spell-effect-collector.js'
import TumulteGlowFilter from './utils/glow-filter.js'
import TumulteConnectionMenu from './apps/connection-menu.js'

const MODULE_ID = 'tumulte-integration'
let MODULE_VERSION = '2.0.0' // Fallback, overridden by initialize() from game.modules

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
    this.spellEffectCollector = null

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
    // Read real version from Foundry module registry (source of truth = module.json)
    MODULE_VERSION = game.modules.get(MODULE_ID)?.version || '2.0.0'
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
    this.spellEffectCollector = new SpellEffectCollector(this.socketClient)

    // Setup socket event handlers
    this.setupSocketHandlers()

    // Register visual hooks for spell effects on actor/item sheets
    this.registerSpellEffectVisualHooks()

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
   * Register hooks to visually mark items affected by Tumulte effects
   * on actor sheets and item sheets (disabled = grayed, buff/debuff = colored border)
   *
   * Compatible with ALL Foundry systems: scans items by flag presence, not by type.
   * Supports both AppV1 (renderActorSheet) and AppV2 (renderActorSheetV2) hooks
   * for compatibility across Foundry v11-v13 and all game systems.
   */
  registerSpellEffectVisualHooks() {
    // Unified handler for actor sheet hooks — works with any hook variant
    const actorHookHandler = (hookName, app, html) => {
      const actor = app.actor ?? app.document ?? app.object
      if (!actor?.items) return // Not an actor sheet — skip silently

      Logger.info(`Visual hook [${hookName}] fired`, { actor: actor.name, htmlType: html?.constructor?.name })
      const el = this._resolveHtmlElement(html)
      if (!el) {
        Logger.warn(`Visual hook [${hookName}]: could not resolve HTML element`)
        return
      }
      this._highlightSpellEffectsOnSheet(actor, el)
      this._highlightMonsterEffectOnSheet(actor, el)
    }

    // Unified handler for item sheet hooks
    const itemHookHandler = (hookName, app, html) => {
      const item = app.item ?? app.document ?? app.object
      if (!item?.getFlag) return // Not a valid item sheet

      const el = this._resolveHtmlElement(html)
      if (!el) return
      this._renderItemSheetBanner(item, el)
    }

    // Register ALL possible render hook names for maximum cross-version compatibility:
    // - renderActorSheet : AppV1 (Foundry v11, some v12 systems)
    // - renderActorSheetV2 : AppV2 (dnd5e 4.x+, Foundry v12-v13)
    // - renderApplication / renderApplicationV2 : generic fallbacks for custom sheet classes
    Hooks.on('renderActorSheet', (app, html) => actorHookHandler('renderActorSheet', app, html))
    Hooks.on('renderActorSheetV2', (app, html) => actorHookHandler('renderActorSheetV2', app, html))
    Hooks.on('renderApplication', (app, html) => actorHookHandler('renderApplication', app, html))
    Hooks.on('renderApplicationV2', (app, html) => actorHookHandler('renderApplicationV2', app, html))

    // Item sheet hooks (V1 + V2)
    Hooks.on('renderItemSheet', (app, html) => itemHookHandler('renderItemSheet', app, html))
    Hooks.on('renderItemSheetV2', (app, html) => itemHookHandler('renderItemSheetV2', app, html))

    Logger.info('Spell effect visual hooks registered (AppV1 + AppV2 + fallbacks)')

    // Monster effect: token halo rendering
    // Register multiple hooks for maximum cross-version compatibility (Foundry v11-v13).
    // - refreshToken : fires on token visual refresh (v11+, most reliable)
    // - drawToken    : fires when a token is first drawn on the canvas
    // - updateToken  : fires when a token document is updated (e.g. flag change via setFlag)
    const tokenHaloHandler = (token) => this._renderMonsterHalo(token)
    Hooks.on('refreshToken', tokenHaloHandler)
    Hooks.on('drawToken', tokenHaloHandler)
    // updateToken passes (document, change, options, userId) — extract the token placeable
    Hooks.on('updateToken', (tokenDoc) => {
      const token = tokenDoc?.object
      if (token) tokenHaloHandler(token)
    })

    Logger.debug('Monster effect token halo hooks registered (refreshToken + drawToken + updateToken)')
  }

  /**
   * Render a colored glow halo around a monster token affected by a Tumulte effect.
   * Reads the `monsterHalo` flag from the token document and applies a PIXI GlowFilter.
   *
   * Compatible with Foundry v11-v13: resolves the correct PIXI display object
   * from token.mesh (v11), token.texture (v12 early), or falls back to the token itself.
   */
  _renderMonsterHalo(token) {
    const haloFlag = token.document?.getFlag(MODULE_ID, 'monsterHalo')

    // Resolve the PIXI display object that accepts filters.
    // Priority: token.mesh (v11+), then the token object itself (v12-v13 uses Token as container)
    const displayObject = token.mesh || token

    // Remove existing Tumulte glow filter if no flag
    if (!haloFlag?.enabled) {
      if (displayObject?.filters) {
        displayObject.filters = displayObject.filters.filter(f => !f._tumulteMonsterHalo)
      }
      return
    }

    // Parse color from hex string
    const colorHex = haloFlag.color || (haloFlag.type === 'buff' ? '#10B981' : '#EF4444')
    const colorInt = parseInt(colorHex.replace('#', ''), 16)

    // Check if we already have the filter applied
    const existing = displayObject?.filters?.find(f => f._tumulteMonsterHalo)
    if (existing) {
      // Update color if it changed
      existing.color = colorInt
      return
    }

    // Apply embedded TumulteGlowFilter
    if (displayObject) {
      try {
        const glow = new TumulteGlowFilter({
          distance: 10,
          outerStrength: 3,
          innerStrength: 0.5,
          color: colorInt,
          quality: 0.3,
        })
        glow._tumulteMonsterHalo = true

        if (!displayObject.filters) displayObject.filters = []
        displayObject.filters = [...displayObject.filters, glow]
        Logger.debug('Monster halo applied', { name: token.name, color: colorHex, target: token.mesh ? 'mesh' : 'token' })
      } catch (err) {
        Logger.error('Failed to apply monster halo filter', err)
      }
    }
  }

  /**
   * Normalize the `html` parameter from render hooks into a plain HTMLElement.
   *
   * - AppV1 (Foundry v11-v12): html is a jQuery object → html[0] gives HTMLElement
   * - AppV2 (Foundry v12 dnd5e 4.x): html is jQuery in v12, HTMLElement in v13
   * - AppV2 (Foundry v13): html is a plain HTMLElement
   *
   * This method handles all cases transparently.
   */
  _resolveHtmlElement(html) {
    // Already a native HTMLElement (AppV2 in Foundry v13)
    if (html instanceof HTMLElement) return html

    // jQuery object (AppV1 or AppV2 in Foundry v12) — extract first element
    if (html?.[0] instanceof HTMLElement) return html[0]

    // ApplicationV2 may also pass the element directly as html.element
    if (html?.element instanceof HTMLElement) return html.element

    Logger.warn('Could not resolve HTML element from hook parameter', { type: typeof html })
    return null
  }

  /**
   * Render an enriched banner on an item sheet when the item has Tumulte effects
   */
  _renderItemSheetBanner(item, html) {
    if (!item) return

    const disabledFlag = item.getFlag(MODULE_ID, 'disabled')
    const effectFlag = item.getFlag(MODULE_ID, 'spellEffect')

    if (!disabledFlag && !effectFlag) return

    const banner = document.createElement('div')
    const icon = document.createElement('i')
    const textSpan = document.createElement('span')

    if (disabledFlag) {
      banner.className = 'tumulte-item-banner tumulte-item-disabled'
      icon.className = 'fas fa-lock'
      textSpan.textContent = ' Bloqué par Tumulte'

      // Enriched details
      if (disabledFlag.triggeredBy) {
        const detail = document.createElement('small')
        detail.textContent = ` — déclenché par ${disabledFlag.triggeredBy}`
        detail.style.opacity = '0.8'
        textSpan.appendChild(detail)
      }
      if (disabledFlag.expiresAt) {
        const remaining = disabledFlag.expiresAt - Date.now()
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60000)
          const seconds = Math.floor((remaining % 60000) / 1000)
          const timer = document.createElement('small')
          timer.textContent = ` (${minutes}:${String(seconds).padStart(2, '0')} restant)`
          timer.style.opacity = '0.8'
          textSpan.appendChild(timer)
        }
      }
    } else if (effectFlag?.type === 'buff') {
      banner.className = 'tumulte-item-banner tumulte-item-buffed'
      icon.className = 'fas fa-arrow-up'
      const buffLabel = effectFlag.buffType === 'advantage' ? 'Avantage' : `+${effectFlag.bonusValue || '?'}`
      textSpan.textContent = ` Amplifié par Tumulte (${buffLabel})`
      if (effectFlag.triggeredBy) {
        const detail = document.createElement('small')
        detail.textContent = ` — déclenché par ${effectFlag.triggeredBy}`
        detail.style.opacity = '0.8'
        textSpan.appendChild(detail)
      }
    } else {
      banner.className = 'tumulte-item-banner tumulte-item-debuffed'
      icon.className = 'fas fa-arrow-down'
      const debuffLabel = effectFlag.debuffType === 'disadvantage' ? 'Désavantage' : `-${effectFlag.penaltyValue || '?'}`
      textSpan.textContent = ` Maudit par Tumulte (${debuffLabel})`
      if (effectFlag.triggeredBy) {
        const detail = document.createElement('small')
        detail.textContent = ` — déclenché par ${effectFlag.triggeredBy}`
        detail.style.opacity = '0.8'
        textSpan.appendChild(detail)
      }
    }

    banner.appendChild(icon)
    banner.appendChild(textSpan)

    // html is now a normalized HTMLElement from _resolveHtmlElement()
    const header = html.querySelector('.sheet-header')
    if (header) {
      header.insertAdjacentElement('afterend', banner)
    } else {
      // Fallback for AppV2 sheets that may use a different header structure
      const form = html.querySelector('form') || html.querySelector('.sheet-body')
      if (form) form.insertAdjacentElement('afterbegin', banner)
    }
  }

  /**
   * Highlight items with Tumulte effects on an actor sheet
   * Scans ALL items (no type filter) — compatible with every game system.
   * Only items with Tumulte flags are affected.
   *
   * @param {Actor} actor - The Foundry actor
   * @param {HTMLElement} htmlEl - Normalized HTML element from _resolveHtmlElement()
   */
  _highlightSpellEffectsOnSheet(actor, htmlEl) {
    if (!actor) return

    let matchCount = 0

    for (const item of actor.items) {
      const disabledFlag = item.getFlag(MODULE_ID, 'disabled')
      const effectFlag = item.getFlag(MODULE_ID, 'spellEffect')

      if (!disabledFlag && !effectFlag) continue

      // Try multiple selectors for cross-system compatibility:
      // - [data-item-id] : standard Foundry (most systems, AppV1 and AppV2)
      // - [data-entry-id] : some AppV2 systems use this variant
      // - [data-document-id] : another AppV2 variant
      const itemEl =
        htmlEl.querySelector(`[data-item-id="${item.id}"]`) ||
        htmlEl.querySelector(`[data-entry-id="${item.id}"]`) ||
        htmlEl.querySelector(`[data-document-id="${item.id}"]`)

      if (!itemEl) {
        Logger.debug('Could not find item element on sheet', { itemName: item.name, itemId: item.id, itemType: item.type })
        continue
      }

      matchCount++

      if (disabledFlag) {
        this._applyDisabledVisuals(itemEl, disabledFlag)
      } else if (effectFlag) {
        this._applyEffectVisuals(itemEl, effectFlag)
      }
    }

    if (matchCount > 0) {
      Logger.debug('Tumulte visual effects applied', { actor: actor.name, matchCount })
    }
  }

  /**
   * Show a banner + stat value highlights on an actor sheet when the actor
   * has an active Tumulte monster effect (buff or debuff).
   *
   * 100 % system-agnostic: uses the monsterEffect flag on the actor and
   * heuristic DOM scanning to find HP/AC elements.
   *
   * @param {Actor} actor - The Foundry actor
   * @param {HTMLElement} htmlEl - Normalized HTML element from _resolveHtmlElement()
   */
  _highlightMonsterEffectOnSheet(actor, htmlEl) {
    if (!actor) return

    const effectFlag = actor.getFlag(MODULE_ID, 'monsterEffect')
    if (!effectFlag) return

    // Avoid duplicate banners on re-render
    if (htmlEl.querySelector('.tumulte-monster-banner')) return

    // ── Build the banner ──────────────────────────────────────────────
    const isBuff = effectFlag.type === 'buff'
    const banner = document.createElement('div')
    banner.className = `tumulte-monster-banner ${isBuff ? 'tumulte-monster-banner-buff' : 'tumulte-monster-banner-debuff'}`

    // Icon
    const icon = document.createElement('i')
    icon.className = isBuff ? 'fas fa-arrow-up' : 'fas fa-arrow-down'
    banner.appendChild(icon)

    // Text container
    const textContainer = document.createElement('div')
    textContainer.className = 'tumulte-monster-banner-content'

    // Title
    const title = document.createElement('strong')
    title.textContent = isBuff ? 'Renforcé par Tumulte' : 'Affaibli par Tumulte'
    textContainer.appendChild(title)

    // Stat changes as pills
    const pills = document.createElement('div')
    pills.className = 'tumulte-monster-banner-pills'

    if (isBuff) {
      if (effectFlag.acBonus) {
        const pill = this._createStatPill(`+${effectFlag.acBonus} CA`, 'buff')
        pills.appendChild(pill)
      }
      if (effectFlag.tempHp) {
        const pill = this._createStatPill(`+${effectFlag.tempHp} PV temp`, 'buff')
        pills.appendChild(pill)
      }
    } else {
      if (effectFlag.acPenalty) {
        const pill = this._createStatPill(`-${effectFlag.acPenalty} CA`, 'debuff')
        pills.appendChild(pill)
      }
      if (effectFlag.maxHpReduction) {
        const pill = this._createStatPill(`-${effectFlag.maxHpReduction} PV max`, 'debuff')
        pills.appendChild(pill)
      }
    }

    if (pills.children.length > 0) {
      textContainer.appendChild(pills)
    }

    // Attribution
    if (effectFlag.triggeredBy) {
      const attribution = document.createElement('small')
      attribution.textContent = `Déclenché par ${effectFlag.triggeredBy}`
      textContainer.appendChild(attribution)
    }

    banner.appendChild(textContainer)

    // ── Insert banner into sheet ──────────────────────────────────────
    const header = htmlEl.querySelector('.sheet-header')
    if (header) {
      header.insertAdjacentElement('afterend', banner)
    } else {
      const form = htmlEl.querySelector('form') || htmlEl.querySelector('.sheet-body')
      if (form) form.insertAdjacentElement('afterbegin', banner)
    }

    // ── Highlight modified stat values in the sheet ───────────────────
    this._highlightModifiedStats(htmlEl, effectFlag)

    Logger.debug('Monster effect banner injected', { actor: actor.name, type: effectFlag.type })
  }

  /**
   * Create a small pill element displaying a stat change (e.g. "+2 CA")
   */
  _createStatPill(text, type) {
    const pill = document.createElement('span')
    pill.className = `tumulte-stat-pill tumulte-stat-pill-${type}`
    pill.textContent = text
    return pill
  }

  /**
   * Heuristic DOM scan to find and highlight modified HP/AC values on an actor sheet.
   *
   * Uses two strategies in order:
   * 1. Foundry data-attributes ([data-property], [name], [data-path]) containing "ac" or "hp"
   * 2. Proximity scan: elements whose numeric textContent matches the current AC, near a
   *    label containing common stat names ("AC", "CA", "Armor", "HP", "PV", "Health", etc.)
   *
   * When a match is found, the element gets a colored background and the original value
   * is shown as a strikethrough annotation next to the current value.
   *
   * @param {HTMLElement} htmlEl - The actor sheet HTML element
   * @param {object} effectFlag - The monsterEffect flag data
   */
  _highlightModifiedStats(htmlEl, effectFlag) {
    const isBuff = effectFlag.type === 'buff'

    // ── AC highlighting ───────────────────────────────────────────────
    if (effectFlag.originalAc != null && (effectFlag.acBonus || effectFlag.acPenalty)) {
      const currentAc = isBuff
        ? effectFlag.originalAc + (effectFlag.acBonus ?? 0)
        : effectFlag.originalAc - (effectFlag.acPenalty ?? 0)

      const acEl = this._findStatElement(htmlEl, currentAc, effectFlag.originalAc, [
        // Strategy 1: data-attributes
        '[data-property*="ac" i]', '[name*="ac" i]', '[data-path*="ac" i]',
        '[data-property*="armor" i]', '[name*="armor" i]',
        '[data-property*="toughness" i]', '[name*="toughness" i]',
        '[data-property*="soak" i]', '[name*="soak" i]',
        '[data-property*="sp" i]',
      ], ['AC', 'CA', 'Armor', 'Armure', 'Defence', 'Défense', 'Toughness', 'Soak', 'SP'])

      if (acEl) {
        this._applyStatHighlight(acEl, effectFlag.originalAc, isBuff)
      }
    }

    // ── HP highlighting ───────────────────────────────────────────────
    // For buffs: temp HP was added — show the temp HP amount on the temp HP field
    // For debuffs: max HP was reduced — show original max on the max HP field
    if (isBuff && effectFlag.tempHp) {
      // Try to find the temp HP element specifically
      const tempHpEl = this._findStatElementByAttribute(htmlEl, [
        '[data-property*="hp.temp" i]', '[name*="hp.temp" i]', '[data-path*="hp.temp" i]',
        '[data-property*="temp" i][data-property*="hp" i]',
      ])
      if (tempHpEl) {
        // For temp HP, only apply the colored highlight — don't show "0" as original value
        if (!tempHpEl.classList.contains('tumulte-stat-modified')) {
          tempHpEl.classList.add('tumulte-stat-modified', 'tumulte-stat-buffed')
        }
      }
    } else if (!isBuff && effectFlag.maxHpReduction && effectFlag.originalMaxHp != null) {
      const currentMaxHp = effectFlag.originalMaxHp - (effectFlag.maxHpReduction ?? 0)
      const maxHpEl = this._findStatElement(htmlEl, currentMaxHp, effectFlag.originalMaxHp, [
        '[data-property*="hp.max" i]', '[name*="hp.max" i]', '[data-path*="hp.max" i]',
        '[data-property*="wounds.max" i]', '[name*="wounds.max" i]',
        '[data-property*="health.max" i]', '[name*="health.max" i]',
      ], ['HP Max', 'PV Max', 'Max HP', 'Max PV', 'Wounds Max', 'Health Max'])

      if (maxHpEl) {
        this._applyStatHighlight(maxHpEl, effectFlag.originalMaxHp, false)
      }
    }
  }

  /**
   * Find a stat element using data-attribute selectors, then fallback to proximity scan.
   *
   * @param {HTMLElement} root - The sheet HTML root
   * @param {number} currentValue - The current stat value displayed
   * @param {number} originalValue - The original stat value before modification
   * @param {string[]} attrSelectors - CSS selectors for data-attribute matching
   * @param {string[]} labelKeywords - Keywords to look for near numeric elements
   * @returns {HTMLElement|null}
   */
  _findStatElement(root, currentValue, originalValue, attrSelectors, labelKeywords) {
    // Strategy 1: data-attribute selectors
    const attrMatch = this._findStatElementByAttribute(root, attrSelectors)
    if (attrMatch) return attrMatch

    // Strategy 2: proximity scan — find elements containing the exact numeric value
    // near a label with matching keywords
    if (currentValue == null) return null

    const valueStr = String(currentValue)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        // Accept form elements (<input>, <select>) by their .value property
        if (node.tagName === 'INPUT' || node.tagName === 'SELECT') {
          return (node.value ?? '').trim() === valueStr
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP
        }
        // For other elements, only accept true leaf nodes (no child elements)
        // to avoid matching containers whose concatenated textContent happens to match
        if (node.childElementCount > 0) return NodeFilter.FILTER_SKIP
        const text = (node.textContent ?? '').trim()
        if (text === valueStr) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })

    const candidates = []
    let node
    while ((node = walker.nextNode())) {
      // Avoid matching elements already highlighted by Tumulte
      if (node.closest('.tumulte-monster-banner')) continue
      if (node.classList?.contains('tumulte-stat-modified')) continue
      candidates.push(node)
    }

    // Score candidates by proximity to a label keyword
    const lcKeywords = labelKeywords.map(k => k.toLowerCase())
    for (const candidate of candidates) {
      // Check parent, grandparent, and sibling text for keyword match
      const context = [
        candidate.parentElement?.textContent,
        candidate.parentElement?.parentElement?.textContent,
        candidate.previousElementSibling?.textContent,
        candidate.closest('[class*="attribute"], [class*="stat"], [class*="resource"]')?.textContent,
      ].filter(Boolean).join(' ').toLowerCase()

      if (lcKeywords.some(kw => context.includes(kw))) {
        return candidate
      }
    }

    return null
  }

  /**
   * Find an element matching one of the given CSS attribute selectors.
   * Returns the first input/element found, preferring <input> over plain text.
   */
  _findStatElementByAttribute(root, selectors) {
    for (const selector of selectors) {
      try {
        const el = root.querySelector(selector)
        if (el) return el
      } catch {
        // Invalid selector — skip
      }
    }
    return null
  }

  /**
   * Apply a visual highlight to a stat element: colored background + original value annotation.
   *
   * @param {HTMLElement} el - The element containing the stat value
   * @param {number} originalValue - The original value before modification
   * @param {boolean} isBuff - true for buff (green), false for debuff (red)
   */
  _applyStatHighlight(el, originalValue, isBuff) {
    if (el.classList.contains('tumulte-stat-modified')) return // Already highlighted

    el.classList.add('tumulte-stat-modified', isBuff ? 'tumulte-stat-buffed' : 'tumulte-stat-debuffed')

    // Inject original value annotation next to the current value
    const annotation = document.createElement('span')
    annotation.className = 'tumulte-original-value'
    annotation.textContent = String(originalValue)
    annotation.title = `Valeur originale : ${originalValue}`

    // For <input> elements, insert after; for text elements, append as sibling
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
      el.insertAdjacentElement('afterend', annotation)
    } else {
      el.appendChild(annotation)
    }
  }

  /**
   * Apply visual indicators for a disabled item (locked spell/power/ability)
   */
  _applyDisabledVisuals(itemEl, flag) {
    itemEl.classList.add('tumulte-spell-item-disabled')
    itemEl.style.position = 'relative'
    this._injectBadge(itemEl, flag, 'disabled')
    if (flag.expiresAt) this._injectCountdown(itemEl, flag)
    this._registerTooltipHandler(itemEl, flag, 'disabled')
  }

  /**
   * Apply visual indicators for a buffed/debuffed item
   */
  _applyEffectVisuals(itemEl, flag) {
    const cls = flag.type === 'buff' ? 'tumulte-spell-item-buffed' : 'tumulte-spell-item-debuffed'
    itemEl.classList.add(cls)
    itemEl.style.position = 'relative'
    this._injectBadge(itemEl, flag, flag.type)
    this._registerTooltipHandler(itemEl, flag, flag.type)
  }

  /**
   * Inject a pill-shaped badge into the item row
   */
  _injectBadge(itemEl, flag, type) {
    // Avoid duplicates on re-render
    if (itemEl.querySelector('.tumulte-badge')) return

    const badge = document.createElement('span')
    badge.className = `tumulte-badge tumulte-badge-${type}`

    const icon = document.createElement('i')
    let label = ''

    if (type === 'disabled') {
      icon.className = 'fas fa-lock'
      label = 'Bloqué'
    } else if (type === 'buff') {
      icon.className = 'fas fa-arrow-up'
      if (flag.buffType === 'advantage') {
        label = 'Avantage'
      } else if (flag.bonusValue) {
        label = `+${flag.bonusValue}`
      } else {
        label = 'Amplifié'
      }
    } else {
      icon.className = 'fas fa-arrow-down'
      if (flag.debuffType === 'disadvantage') {
        label = 'Désavantage'
      } else if (flag.penaltyValue) {
        label = `-${flag.penaltyValue}`
      } else {
        label = 'Maudit'
      }
    }

    icon.style.fontSize = '9px'
    badge.appendChild(icon)

    const text = document.createElement('span')
    text.textContent = ` ${label}`
    badge.appendChild(text)

    itemEl.appendChild(badge)
  }

  /**
   * Inject a live countdown timer into the badge for temporary disables
   */
  _injectCountdown(itemEl, flag) {
    const badge = itemEl.querySelector('.tumulte-badge')
    if (!badge) return

    const remaining = flag.expiresAt - Date.now()
    if (remaining <= 0) return

    const countdown = document.createElement('span')
    countdown.className = 'tumulte-countdown'

    const updateCountdown = () => {
      const ms = flag.expiresAt - Date.now()
      if (ms <= 0) {
        countdown.textContent = ''
        if (itemEl._tumulteCountdownInterval) {
          clearInterval(itemEl._tumulteCountdownInterval)
          itemEl._tumulteCountdownInterval = null
        }
        return
      }
      const min = Math.floor(ms / 60000)
      const sec = Math.floor((ms % 60000) / 1000)
      countdown.textContent = ` (${min}:${String(sec).padStart(2, '0')})`
    }

    updateCountdown()
    itemEl._tumulteCountdownInterval = setInterval(updateCountdown, 1000)

    badge.appendChild(countdown)
  }

  /**
   * Register mouseenter/mouseleave handlers for a rich tooltip
   * Uses DOM API (textContent) — no innerHTML with external content
   */
  _registerTooltipHandler(itemEl, flag, type) {
    // Remove native title
    itemEl.removeAttribute('title')
    itemEl.style.position = 'relative'

    let tooltip = null

    const showTooltip = () => {
      if (tooltip) return

      tooltip = document.createElement('div')
      tooltip.className = 'tumulte-tooltip'

      // Header
      const header = document.createElement('div')
      header.className = 'tumulte-tooltip-header'

      const headerIcon = document.createElement('i')
      const headerText = document.createElement('span')

      if (type === 'disabled') {
        headerIcon.className = 'fas fa-lock'
        headerIcon.style.color = '#8B5CF6'
        headerText.textContent = 'Bloqué par Tumulte'
      } else if (type === 'buff') {
        headerIcon.className = 'fas fa-arrow-up'
        headerIcon.style.color = '#10B981'
        headerText.textContent = 'Amplifié par Tumulte'
      } else {
        headerIcon.className = 'fas fa-arrow-down'
        headerIcon.style.color = '#EF4444'
        headerText.textContent = 'Maudit par Tumulte'
      }

      header.appendChild(headerIcon)
      header.appendChild(headerText)
      tooltip.appendChild(header)

      // Details
      const addDetail = (text) => {
        const detail = document.createElement('div')
        detail.className = 'tumulte-tooltip-detail'
        detail.textContent = text
        tooltip.appendChild(detail)
      }

      if (flag.triggeredBy) {
        addDetail(`Déclenché par ${flag.triggeredBy}`)
      }

      if (type === 'disabled' && flag.expiresAt) {
        const ms = flag.expiresAt - Date.now()
        if (ms > 0) {
          const min = Math.floor(ms / 60000)
          const sec = Math.floor((ms % 60000) / 1000)
          addDetail(`Durée restante : ${min}:${String(sec).padStart(2, '0')}`)
        } else {
          addDetail('Expiration imminente…')
        }
      } else if (type === 'disabled' && !flag.expiresAt) {
        addDetail('Durée : permanente (jusqu\'au nettoyage)')
      }

      if (type === 'buff') {
        if (flag.buffType === 'advantage') {
          addDetail('Type : Avantage sur le prochain jet')
        } else if (flag.buffType === 'bonus' && flag.bonusValue) {
          addDetail(`Bonus : +${flag.bonusValue} au prochain jet`)
        }
      } else if (type === 'debuff') {
        if (flag.debuffType === 'disadvantage') {
          addDetail('Type : Désavantage sur le prochain jet')
        } else if (flag.debuffType === 'penalty' && flag.penaltyValue) {
          addDetail(`Pénalité : -${flag.penaltyValue} au prochain jet`)
        }
      }

      itemEl.appendChild(tooltip)
    }

    const hideTooltip = () => {
      if (tooltip) {
        tooltip.remove()
        tooltip = null
      }
    }

    itemEl.addEventListener('mouseenter', showTooltip)
    itemEl.addEventListener('mouseleave', hideTooltip)
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

    // Initialize spell effect collector (intercepts casts for buff/debuff consumption)
    this.spellEffectCollector.initialize()

    // Recover spell effects from flags after page reload
    this.socketClient.recoverSpellEffects()
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
