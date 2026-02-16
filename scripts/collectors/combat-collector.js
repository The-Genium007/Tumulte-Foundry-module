/**
 * Combat Collector
 * Tracks combat state and sends updates to Tumulte
 */

import Logger from '../utils/logger.js'

export class CombatCollector {
  constructor(socketClient) {
    this.socket = socketClient
    this.activeCombat = null
  }

  /**
   * Initialize the collector (idempotent — safe to call on reconnection)
   */
  initialize() {
    if (this._initialized) {
      Logger.debug('Combat Collector already initialized, skipping hook registration')
      // Still sync active combat on reconnection
      this.syncActiveCombat()
      return
    }

    // Combat lifecycle hooks
    Hooks.on('createCombat', this.onCombatCreate.bind(this))
    Hooks.on('updateCombat', this.onCombatUpdate.bind(this))
    Hooks.on('deleteCombat', this.onCombatDelete.bind(this))

    // Combat turn/round hooks
    Hooks.on('combatStart', this.onCombatStart.bind(this))
    Hooks.on('combatTurn', this.onTurnChange.bind(this))
    Hooks.on('combatRound', this.onRoundChange.bind(this))

    // Combatant hooks
    Hooks.on('createCombatant', this.onCombatantCreate.bind(this))
    Hooks.on('deleteCombatant', this.onCombatantDelete.bind(this))
    Hooks.on('updateCombatant', this.onCombatantUpdate.bind(this))

    // Scene change hook — re-sync combat when the active scene changes
    Hooks.on('canvasReady', this.onSceneChange.bind(this))

    this._initialized = true
    Logger.info('Combat Collector initialized')

    // Sync active combat if one exists (game is already ready when this is called)
    this.syncActiveCombat()
  }

  /**
   * Sync active combat if one is in progress
   */
  syncActiveCombat() {
    const combat = game.combat

    if (!combat || !combat.active) {
      Logger.debug('No active combat to sync')
      return
    }

    Logger.info('Syncing active combat', {
      id: combat.id,
      round: combat.round,
      turn: combat.turn
    })

    this.activeCombat = combat.id

    // Send current combat state
    this.socket.emit('combat:sync', {
      worldId: game.world.id,
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      combatants: this.extractCombatants(combat),
      currentCombatant: combat.combatant ? this.extractCombatantData(combat.combatant) : null,
      timestamp: Date.now()
    })
  }

  /**
   * Handle scene change (canvasReady) — re-sync or clear combat for the new scene.
   *
   * When the GM switches to a different scene:
   * - If the new scene has an active combat → sync it (replaces Redis cache)
   * - If the new scene has no combat → emit combat:end to clear Redis cache
   *   and trigger monster effect cleanup
   */
  onSceneChange(canvas) {
    const newSceneId = canvas.scene?.id
    const combat = game.combat

    Logger.info('Scene changed', {
      sceneId: newSceneId,
      sceneName: canvas.scene?.name,
      hasCombat: !!combat?.active,
      previousCombat: this.activeCombat,
    })

    if (combat?.active) {
      // New scene has an active combat — sync it
      if (this.activeCombat !== combat.id) {
        // Different combat than before: cleanup old effects then sync new
        if (this.activeCombat) {
          if (typeof this.socket.cleanupMonsterEffects === 'function') {
            this.socket.cleanupMonsterEffects().catch(err => {
              Logger.error('Failed to cleanup monster effects on scene change', err)
            })
          }
        }
        this.activeCombat = combat.id
        this.syncActiveCombat()
      }
      // Same combat (e.g. GM re-navigated to same scene) — just re-sync
      else {
        this.syncActiveCombat()
      }
    } else {
      // No combat on new scene — clear the previous one
      if (this.activeCombat) {
        Logger.info('No combat on new scene, clearing previous combat', {
          previousCombatId: this.activeCombat,
        })

        this.socket.emit('combat:end', {
          worldId: game.world.id,
          combatId: this.activeCombat,
          finalRound: 0,
          timestamp: Date.now()
        })

        // Cleanup monster effects from the previous scene
        if (typeof this.socket.cleanupMonsterEffects === 'function') {
          this.socket.cleanupMonsterEffects().catch(err => {
            Logger.error('Failed to cleanup monster effects on scene change', err)
          })
        }

        this.activeCombat = null
      }
    }
  }

  /**
   * Handle combat creation
   */
  onCombatCreate(combat, options, userId) {
    Logger.debug('Combat created', { id: combat.id })
    this.activeCombat = combat.id
  }

  /**
   * Handle combat start
   */
  onCombatStart(combat, updateData) {
    Logger.info('Combat started', {
      id: combat.id,
      round: combat.round,
      combatants: combat.combatants.size
    })

    this.socket.emit('combat:start', {
      worldId: game.world.id,
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      combatants: this.extractCombatants(combat),
      timestamp: Date.now()
    })
  }

  /**
   * Handle combat update
   */
  onCombatUpdate(combat, changes, options, userId) {
    // Only process significant changes
    if (!changes.round && !changes.turn && !changes.active) {
      return
    }

    Logger.debug('Combat updated', {
      id: combat.id,
      changes
    })
  }

  /**
   * Handle turn change
   */
  onTurnChange(combat, prior, options) {
    const current = combat.combatant

    if (!current) return

    Logger.info('Combat turn changed', {
      round: combat.round,
      turn: combat.turn,
      combatant: current.name
    })

    this.socket.emit('combat:turn', {
      worldId: game.world.id,
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      currentCombatant: this.extractCombatantData(current),
      nextCombatant: this.getNextCombatant(combat),
      timestamp: Date.now()
    })
  }

  /**
   * Handle round change
   */
  onRoundChange(combat, prior, options) {
    Logger.info('Combat round changed', {
      round: combat.round,
      previousRound: prior.round
    })

    this.socket.emit('combat:round', {
      worldId: game.world.id,
      combatId: combat.id,
      round: combat.round,
      previousRound: prior.round,
      combatants: this.extractCombatants(combat),
      timestamp: Date.now()
    })
  }

  /**
   * Handle combat deletion (combat ends)
   */
  onCombatDelete(combat, options, userId) {
    Logger.info('Combat ended', { id: combat.id })

    this.socket.emit('combat:end', {
      worldId: game.world.id,
      combatId: combat.id,
      finalRound: combat.round,
      timestamp: Date.now()
    })

    if (this.activeCombat === combat.id) {
      this.activeCombat = null
    }

    // Auto-cleanup monster effects when combat ends
    if (typeof this.socket.cleanupMonsterEffects === 'function') {
      this.socket.cleanupMonsterEffects().catch(err => {
        Logger.error('Failed to auto-cleanup monster effects on combat end', err)
      })
    }
  }

  /**
   * Handle new combatant
   */
  onCombatantCreate(combatant, options, userId) {
    const combat = combatant.combat

    Logger.debug('Combatant added', {
      name: combatant.name,
      combatId: combat?.id
    })

    if (combat) {
      this.socket.emit('combat:combatant-add', {
        worldId: game.world.id,
        combatId: combat.id,
        combatant: this.extractCombatantData(combatant),
        timestamp: Date.now()
      })
    }
  }

  /**
   * Handle combatant removal
   */
  onCombatantDelete(combatant, options, userId) {
    const combat = combatant.combat

    Logger.debug('Combatant removed', {
      name: combatant.name,
      combatId: combat?.id
    })

    if (combat) {
      this.socket.emit('combat:combatant-remove', {
        worldId: game.world.id,
        combatId: combat.id,
        combatantId: combatant.id,
        name: combatant.name,
        timestamp: Date.now()
      })
    }
  }

  /**
   * Handle combatant update (HP, defeated, etc.)
   */
  onCombatantUpdate(combatant, changes, options, userId) {
    // Only send significant updates
    if (!changes.defeated && !changes.initiative) {
      return
    }

    const combat = combatant.combat
    if (!combat) return

    Logger.debug('Combatant updated', {
      name: combatant.name,
      changes
    })

    if (changes.defeated !== undefined) {
      this.socket.emit('combat:combatant-defeated', {
        worldId: game.world.id,
        combatId: combat.id,
        combatant: this.extractCombatantData(combatant),
        defeated: changes.defeated,
        timestamp: Date.now()
      })
    }
  }

  /**
   * Extract all combatants data
   */
  extractCombatants(combat) {
    return combat.combatants.map(c => this.extractCombatantData(c))
  }

  /**
   * Extract data for a single combatant
   */
  extractCombatantData(combatant) {
    const actor = combatant.actor

    return {
      id: combatant.id,
      actorId: actor?.id,
      name: combatant.name,
      img: combatant.img || actor?.img,
      initiative: combatant.initiative,
      isDefeated: combatant.isDefeated,
      isNPC: !actor?.hasPlayerOwner,
      isVisible: combatant.visible,
      hp: actor ? this.extractHP(actor) : null
    }
  }

  /**
   * Extract HP from actor
   */
  extractHP(actor) {
    const system = actor.system

    // D&D 5e / Generic
    if (system?.attributes?.hp) {
      return {
        current: system.attributes.hp.value,
        max: system.attributes.hp.max,
        temp: system.attributes.hp.temp || 0
      }
    }

    // PF2e
    if (system?.attributes?.hp?.value !== undefined) {
      return {
        current: system.attributes.hp.value,
        max: system.attributes.hp.max,
        temp: system.attributes.hp.temp || 0
      }
    }

    return null
  }

  /**
   * Get next combatant in turn order
   */
  getNextCombatant(combat) {
    const turns = combat.turns
    const currentIndex = combat.turn

    if (!turns || turns.length === 0) return null

    const nextIndex = (currentIndex + 1) % turns.length
    const nextCombatant = turns[nextIndex]

    return nextCombatant ? this.extractCombatantData(nextCombatant) : null
  }

  /**
   * Get current combat status
   */
  getStatus() {
    const combat = game.combat

    if (!combat) {
      return { active: false }
    }

    return {
      active: combat.active,
      id: combat.id,
      round: combat.round,
      turn: combat.turn,
      combatantsCount: combat.combatants.size,
      currentCombatant: combat.combatant?.name
    }
  }
}

export default CombatCollector
