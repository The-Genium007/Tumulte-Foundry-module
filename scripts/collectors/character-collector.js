/**
 * Character Collector
 * Synchronizes character data from Foundry VTT to Tumulte
 * Supports multiple game systems with PC/NPC/Monster classification
 */

import Logger from '../utils/logger.js'
import { getSystemAdapter } from '../utils/system-adapters.js'
import { classifyActor, shouldSyncActor as checkShouldSync, hasSystemSupport, getSystemConfig } from '../utils/actor-classifier.js'

export class CharacterCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.systemAdapter = null
    this.syncedCharacters = new Map()
    this.syncDebounce = new Map()
    this.debounceDelay = 2000 // 2 seconds debounce
  }

  /**
   * Initialize the collector
   */
  initialize() {
    this.systemAdapter = getSystemAdapter()

    // Actor update hooks
    Hooks.on('updateActor', this.onActorUpdate.bind(this))
    Hooks.on('createActor', this.onActorCreate.bind(this))
    Hooks.on('deleteActor', this.onActorDelete.bind(this))

    // Item changes (for inventory sync)
    Hooks.on('createItem', this.onItemChange.bind(this))
    Hooks.on('updateItem', this.onItemChange.bind(this))
    Hooks.on('deleteItem', this.onItemChange.bind(this))

    Logger.info('Character Collector initialized')

    // Initial sync - game is already ready when this is called
    // (we're initialized after successful WebSocket connection)
    setTimeout(() => this.syncAllCharacters(), 2000)
  }

  /**
   * Sync all characters (PCs, NPCs, and Monsters)
   */
  async syncAllCharacters() {
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
      totalActors: game.actors.size
    })

    for (const actor of charactersToSync) {
      await this.syncCharacter(actor)
    }

    Logger.info('Character sync complete', { syncedCount: charactersToSync.length })
  }


  /**
   * Sync a single character to Tumulte
   */
  async syncCharacter(actor) {
    try {
      // Normalize avatar path (relative only, no localhost URLs)
      const avatarUrl = actor.img ? this.normalizeAvatarPath(actor.img) : null

      // Classify actor using multi-system classifier (pc, npc, or monster)
      const characterType = classifyActor(actor)

      const characterData = {
        worldId: game.world.id,
        campaignId: game.world.id,
        characterId: actor.id,
        name: actor.name,
        avatarUrl,
        characterType,
        stats: this.systemAdapter.extractStats(actor),
        inventory: this.systemAdapter.extractInventory(actor),
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
        campaignId: characterData.campaignId
      })

      const sent = this.socket.emit('character:update', characterData)

      if (sent) {
        this.syncedCharacters.set(actor.id, {
          lastSync: Date.now(),
          name: actor.name
        })

        Logger.debug('Character synced', { name: actor.name, id: actor.id })
      }

    } catch (error) {
      Logger.error('Failed to sync character', { actor: actor.name, error })
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
    setTimeout(() => this.syncCharacter(actor), 1000)
  }

  /**
   * Handle actor deletion
   */
  onActorDelete(actor, options, userId) {
    // Remove from synced characters
    this.syncedCharacters.delete(actor.id)

    // Clear any pending debounce
    if (this.syncDebounce.has(actor.id)) {
      clearTimeout(this.syncDebounce.get(actor.id))
      this.syncDebounce.delete(actor.id)
    }

    Logger.debug('Character removed from sync', { name: actor.name })
  }

  /**
   * Handle item changes (inventory updates)
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
    await this.syncAllCharacters()
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
}

export default CharacterCollector
