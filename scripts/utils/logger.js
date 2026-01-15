/**
 * Tumulte Logger Utility
 * Centralized logging with debug mode support
 */

const MODULE_ID = 'tumulte-integration'
const LOG_PREFIX = 'Tumulte'

export class Logger {
  static get debugEnabled() {
    try {
      return game.settings.get(MODULE_ID, 'debugMode')
    } catch {
      return false
    }
  }

  static info(message, ...args) {
    console.log(`${LOG_PREFIX} | ${message}`, ...args)
  }

  static warn(message, ...args) {
    console.warn(`${LOG_PREFIX} | ${message}`, ...args)
  }

  static error(message, ...args) {
    console.error(`${LOG_PREFIX} | ${message}`, ...args)
  }

  static debug(message, ...args) {
    if (this.debugEnabled) {
      console.debug(`${LOG_PREFIX} | [DEBUG] ${message}`, ...args)
    }
  }

  static group(label) {
    if (this.debugEnabled) {
      console.group(`${LOG_PREFIX} | ${label}`)
    }
  }

  static groupEnd() {
    if (this.debugEnabled) {
      console.groupEnd()
    }
  }

  /**
   * Log with notification to user
   */
  static notify(message, type = 'info') {
    this.info(message)
    if (typeof ui !== 'undefined' && ui.notifications) {
      ui.notifications[type](`Tumulte: ${message}`)
    }
  }
}

export default Logger
