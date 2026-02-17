/**
 * Character Collector
 * Synchronizes character data from Foundry VTT to Tumulte
 * Supports multiple game systems with PC/NPC/Monster classification
 */

import Logger from '../utils/logger.js'
import { getSystemAdapter } from '../utils/system-adapters.js'
import { classifyActor, shouldSyncActor as checkShouldSync, hasSystemSupport, getSystemConfig } from '../utils/actor-classifier.js'

/**
 * Simple string hash for change detection.
 * Used to compare actor data between syncs and skip unchanged payloads.
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return hash.toString(36)
}

export class CharacterCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.systemAdapter = null
    this.syncedCharacters = new Map()
    this.syncDebounce = new Map()
    this.lastSyncHash = new Map()
    this.debounceDelay = 60_000 // 1 minute debounce
    this.periodicSyncInterval = null
    this.periodicSyncDelay = 5 * 60_000 // 5 minutes
  }

  /**
   * Initialize the collector (idempotent — safe to call on reconnection)
   */
  initialize() {
    if (this._initialized) {
      Logger.debug('Character Collector already initialized, skipping hook registration')
      return
    }

    this.systemAdapter = getSystemAdapter()

    // Actor update hooks
    Hooks.on('updateActor', this.onActorUpdate.bind(this))
    Hooks.on('createActor', this.onActorCreate.bind(this))
    Hooks.on('deleteActor', this.onActorDelete.bind(this))

    // Item changes (for inventory/spell/feature sync)
    Hooks.on('createItem', this.onItemChange.bind(this))
    Hooks.on('updateItem', this.onItemChange.bind(this))
    Hooks.on('deleteItem', this.onItemChange.bind(this))

    // Listen for on-demand sync requests from the backend
    this.socket.addEventListener('command:request_sync', (event) => {
      this.handleRequestSync(event.detail)
    })

    this._initialized = true
    Logger.info('Character Collector initialized')

    // Initial sync - game is already ready when this is called
    // (we're initialized after successful WebSocket connection)
    setTimeout(() => this.syncAllCharacters(), 2000)

    // Start periodic full-sync
    this.startPeriodicSync()
  }

  /**
   * Start periodic full-sync interval
   */
  startPeriodicSync() {
    if (this.periodicSyncInterval) return

    this.periodicSyncInterval = setInterval(() => {
      if (!this.socket?.connected) return

      Logger.debug('Periodic sync triggered')
      this.syncAllCharacters(false)
    }, this.periodicSyncDelay)

    Logger.info('Periodic sync started', { intervalMs: this.periodicSyncDelay })
  }

  /**
   * Stop periodic full-sync interval
   */
  stopPeriodicSync() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval)
      this.periodicSyncInterval = null
    }
  }

  /**
   * Handle on-demand sync request from the backend.
   * Used before executing spell actions to ensure fresh data.
   */
  handleRequestSync(data) {
    Logger.info('On-demand sync requested by backend', data)

    if (data?.actorId) {
      const actor = game.actors?.get(data.actorId)
      if (actor) {
        this.syncCharacter(actor, true)
      } else {
        Logger.warn('Requested actor not found', { actorId: data.actorId })
      }
    } else {
      this.syncAllCharacters(true)
    }
  }

  /**
   * Sync all characters (PCs, NPCs, and Monsters)
   * @param {boolean} force - Skip hash check and force sync all
   */
  async syncAllCharacters(force = false) {
    if (!game.actors) {
      Logger.warn('Actors not available yet')
      return
    }

    // Log system support status
    const systemId = game.system.id
    const hasDedicatedSupport = hasSystemSupport()
    Logger.info(`System detection: ${systemId}`, {
      hasDedicatedSupport,
      config: getSystemConfig()
    })

    // Log all available actor types with classification for debugging
    const actorsByClassification = { pc: [], npc: [], monster: [], excluded: [] }
    game.actors.forEach(actor => {
      if (!checkShouldSync(actor)) {
        actorsByClassification.excluded.push({ name: actor.name, type: actor.type })
      } else {
        const classification = classifyActor(actor)
        actorsByClassification[classification].push({ name: actor.name, type: actor.type })
      }
    })

    Logger.info('Actor classification summary', {
      system: systemId,
      totalActors: game.actors.size,
      pcs: actorsByClassification.pc.length,
      npcs: actorsByClassification.npc.length,
      monsters: actorsByClassification.monster.length,
      excluded: actorsByClassification.excluded.length,
      details: actorsByClassification
    })

    const charactersToSync = game.actors.filter(actor => checkShouldSync(actor))

    Logger.info(`Syncing ${charactersToSync.length} characters...`, {
      system: systemId,
      totalActors: game.actors.size,
      force
    })

    let syncedCount = 0
    for (const actor of charactersToSync) {
      const didSync = await this.syncCharacter(actor, force)
      if (didSync) syncedCount++
    }

    Logger.info('Character sync complete', { syncedCount, totalChecked: charactersToSync.length })
  }


  /**
   * Sync a single character to Tumulte
   * @param {Actor} actor - Foundry VTT actor document
   * @param {boolean} force - Skip hash check and force sync
   * @returns {boolean} true if data was actually sent
   */
  async syncCharacter(actor, force = false) {
    try {
      // Normalize avatar path (relative only, no localhost URLs)
      const avatarUrl = actor.img ? this.normalizeAvatarPath(actor.img) : null

      // Classify actor using multi-system classifier (pc, npc, or monster)
      const characterType = classifyActor(actor)

      const stats = this.systemAdapter.extractStats(actor)
      const inventory = this.systemAdapter.extractInventory(actor)

      // Use dynamic item categories from Tumulte when available (supports any system),
      // fall back to system adapter hardcoded types otherwise
      const dynamicTypes = this.socket?.getTargetableItemTypes?.()
      let spells
      if (dynamicTypes && dynamicTypes.length > 0) {
        spells = actor.items
          .filter(item => dynamicTypes.includes(item.type))
          .map(item => ({
            id: item.id,
            name: item.name,
            img: item.img,
            type: item.type,
            level: item.system?.level ?? null,
            school: item.system?.school ?? null,
            prepared: item.system?.prepared ?? item.system?.preparation?.prepared ?? null,
            uses: item.system?.uses ? {
              value: item.system.uses.value ?? null,
              max: item.system.uses.max ?? null,
            } : null,
            activeEffect: this._extractTumulteEffect(item),
          }))
        Logger.debug('Using dynamic item categories for spell extraction', {
          types: dynamicTypes,
          count: spells.length,
        })
      } else {
        spells = this.systemAdapter.extractSpells(actor)
        // Enrich system adapter spells with Tumulte effect flags
        spells = spells.map(s => {
          const item = actor.items.get(s.id)
          return { ...s, activeEffect: item ? this._extractTumulteEffect(item) : null }
        })
      }

      const features = this.systemAdapter.extractFeatures(actor)

      // Hash-based dedup: skip sync if nothing changed
      const dataForHash = JSON.stringify({ stats, inventory, spells, features, name: actor.name, avatarUrl })
      const hash = simpleHash(dataForHash)

      if (!force && this.lastSyncHash.get(actor.id) === hash) {
        Logger.debug('Skipping sync (unchanged)', { name: actor.name, id: actor.id })
        return false
      }

      const characterData = {
        worldId: game.world.id,
        campaignId: game.world.id,
        characterId: actor.id,
        name: actor.name,
        avatarUrl,
        characterType,
        stats,
        inventory,
        spells,
        features,
        vttData: {
          system: game.system.id,
          type: actor.type,
          flags: actor.flags
        }
      }

      Logger.info('Sending character:update', {
        characterId: actor.id,
        name: actor.name,
        characterType,
        campaignId: characterData.campaignId,
        spellCount: spells.length,
        featureCount: features.length,
      })

      const sent = this.socket.emit('character:update', characterData)

      if (sent) {
        this.lastSyncHash.set(actor.id, hash)
        this.syncedCharacters.set(actor.id, {
          lastSync: Date.now(),
          name: actor.name
        })

        Logger.debug('Character synced', { name: actor.name, id: actor.id })
      }

      return sent

    } catch (error) {
      Logger.error('Failed to sync character', { actor: actor.name, error })
      return false
    }
  }

  /**
   * Handle actor update
   */
  onActorUpdate(actor, changes, options, userId) {
    if (!checkShouldSync(actor)) return

    // Debounce updates to prevent spam
    this.debouncedSync(actor)
  }

  /**
   * Handle actor creation
   */
  onActorCreate(actor, options, userId) {
    if (!checkShouldSync(actor)) return

    // Sync new character after a short delay
    setTimeout(() => this.syncCharacter(actor, true), 1000)
  }

  /**
   * Handle actor deletion
   */
  onActorDelete(actor, options, userId) {
    // Remove from synced characters
    this.syncedCharacters.delete(actor.id)
    this.lastSyncHash.delete(actor.id)

    // Clear any pending debounce
    if (this.syncDebounce.has(actor.id)) {
      clearTimeout(this.syncDebounce.get(actor.id))
      this.syncDebounce.delete(actor.id)
    }

    Logger.debug('Character removed from sync', { name: actor.name })
  }

  /**
   * Handle item changes (inventory/spell/feature updates)
   */
  onItemChange(item, options, userId) {
    const actor = item.parent
    if (!actor || actor.documentName !== 'Actor') return
    if (!checkShouldSync(actor)) return

    // Debounce inventory updates
    this.debouncedSync(actor)
  }

  /**
   * Debounced sync to prevent update spam
   */
  debouncedSync(actor) {
    // Clear existing debounce timer
    if (this.syncDebounce.has(actor.id)) {
      clearTimeout(this.syncDebounce.get(actor.id))
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.syncCharacter(actor)
      this.syncDebounce.delete(actor.id)
    }, this.debounceDelay)

    this.syncDebounce.set(actor.id, timer)
  }

  /**
   * Get sync status for all characters
   */
  getSyncStatus() {
    const status = []

    for (const [id, data] of this.syncedCharacters) {
      status.push({
        id,
        name: data.name,
        lastSync: data.lastSync,
        age: Date.now() - data.lastSync
      })
    }

    return status
  }

  /**
   * Force resync all characters
   */
  async resyncAll() {
    this.syncedCharacters.clear()
    this.lastSyncHash.clear()
    await this.syncAllCharacters(true)
  }

  /**
   * Extract active Tumulte effect from an item's flags.
   * Returns a lightweight summary for backend filtering, or null if no effect.
   * @param {Item} item - Foundry VTT item document
   * @returns {{ type: string, expiresAt?: number|null }|null}
   */
  _extractTumulteEffect(item) {
    try {
      const disabled = item.getFlag?.('tumulte-integration', 'disabled')
      const effect = item.getFlag?.('tumulte-integration', 'spellEffect')
      if (disabled) return { type: 'disabled', expiresAt: disabled.expiresAt ?? null }
      if (effect) return { type: effect.type }
    } catch {
      // getFlag may throw if module flags are not initialized
    }
    return null
  }

  /**
   * Normalize avatar path for storage
   * Stores relative paths only - absolute URLs are converted to relative
   * This avoids Mixed Content issues when displaying from HTTPS
   *
   * @param {string} path - The image path from Foundry
   * @returns {string|null} - Relative path or null
   */
  normalizeAvatarPath(path) {
    if (!path) return null

    // If it's an absolute URL pointing to this Foundry instance, extract the path
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const url = new URL(path)
        // Only extract path if it's from the same Foundry instance
        if (url.origin === window.location.origin) {
          return url.pathname
        }
        // External URLs (like S3, CDN) - keep as-is if HTTPS
        if (path.startsWith('https://')) {
          return path
        }
        // HTTP external URLs - return null to use fallback
        return null
      } catch {
        return null
      }
    }

    // Already a relative path - normalize it
    return path.startsWith('/') ? path : `/${path}`
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.stopPeriodicSync()

    // Clear all debounce timers
    for (const timer of this.syncDebounce.values()) {
      clearTimeout(timer)
    }
    this.syncDebounce.clear()
    this.lastSyncHash.clear()
    this.syncedCharacters.clear()
  }
}

export default CharacterCollector
