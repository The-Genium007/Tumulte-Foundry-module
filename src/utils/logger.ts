/**
 * Tumulte Logger Utility
 * Centralized logging with debug mode support
 */

const MODULE_ID = 'tumulte-integration'
const LOG_PREFIX = 'Tumulte'

type NotificationType = 'info' | 'warn' | 'error'

export class Logger {
  static get debugEnabled(): boolean {
    try {
      return game.settings.get(MODULE_ID, 'debugMode') as boolean
    } catch {
      return false
    }
  }

  static info(message: string, ...args: unknown[]): void {
    console.log(`${LOG_PREFIX} | ${message}`, ...args)
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`${LOG_PREFIX} | ${message}`, ...args)
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(`${LOG_PREFIX} | ${message}`, ...args)
  }

  static debug(message: string, ...args: unknown[]): void {
    if (this.debugEnabled) {
      console.debug(`${LOG_PREFIX} | [DEBUG] ${message}`, ...args)
    }
  }

  static group(label: string): void {
    if (this.debugEnabled) {
      console.group(`${LOG_PREFIX} | ${label}`)
    }
  }

  static groupEnd(): void {
    if (this.debugEnabled) {
      console.groupEnd()
    }
  }

  /**
   * Log with notification to user
   */
  static notify(message: string, type: NotificationType = 'info'): void {
    this.info(message)
    if (typeof ui !== 'undefined' && ui.notifications) {
      ui.notifications[type](`Tumulte: ${message}`)
    }
  }
}

export default Logger
