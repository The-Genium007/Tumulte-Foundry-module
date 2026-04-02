/**
 * Tumulte Connection Menu - FormApplication for pairing with Tumulte
 *
 * This is a settings submenu that allows users to:
 * - Start a new pairing session and see the code
 * - View connection status
 * - Disconnect from Tumulte
 */
import Logger from '../utils/logger.js';
const MODULE_ID = 'tumulte-integration';
export class TumulteConnectionMenu extends FormApplication {
    pairingInfo;
    countdownInterval;
    reauthorizationPollInterval;
    isRevoked;
    constructor(object = {}, options = {}) {
        super(object, options);
        this.pairingInfo = null;
        this.countdownInterval = null;
        this.reauthorizationPollInterval = null;
        this.isRevoked = false;
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
            submitOnChange: false,
        });
    }
    getData() {
        const tumulte = window.tumulte;
        const isPaired = tumulte?.tokenStorage?.isPaired() || false;
        const isConnected = tumulte?.socketClient?.connected || false;
        const isConnecting = tumulte?.socketClient?.connecting || false;
        const pairingStatus = tumulte?.pairingManager?.getPairingStatus() || { active: false };
        const reconnectAttempts = tumulte?.socketClient?.reconnectAttempts || 0;
        const maxReconnectAttempts = tumulte?.socketClient?.maxReconnectAttempts || 10;
        const isReconnecting = isPaired && !isConnected && reconnectAttempts > 0;
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
        };
    }
    activateListeners(html) {
        super.activateListeners(html);
        html.find('.tumulte-start-pairing').on('click', async (event) => {
            event.preventDefault();
            await this._onStartPairing();
        });
        html.find('.tumulte-copy-code').on('click', (event) => {
            event.preventDefault();
            this._onCopyCode();
        });
        html.find('.tumulte-cancel-pairing').on('click', (event) => {
            event.preventDefault();
            this._onCancelPairing();
        });
        html.find('.tumulte-disconnect').on('click', async (event) => {
            event.preventDefault();
            await this._onDisconnect();
        });
        html.find('.tumulte-reconnect').on('click', async (event) => {
            event.preventDefault();
            await this._onReconnect();
        });
        html.find('.tumulte-wait-reauthorization').on('click', async (event) => {
            event.preventDefault();
            await this._onWaitReauthorization();
        });
        html.find('.tumulte-stop-waiting').on('click', (event) => {
            event.preventDefault();
            this._stopReauthorizationPolling();
            this.render(true);
        });
        this._startCountdownIfNeeded();
        this._checkRevocationStatus();
    }
    async _onStartPairing() {
        const tumulte = window.tumulte;
        if (!tumulte) {
            ui.notifications.error('Tumulte module not initialized');
            return;
        }
        try {
            if (tumulte.tokenStorage?.isPaired()) {
                Logger.info('Already paired, disconnecting before new pairing...');
                tumulte.disconnect();
                await tumulte.tokenStorage.clearTokens();
            }
            tumulte.pairingManager.clearCallbacks();
            tumulte.pairingManager.onComplete(async (result) => {
                Logger.info('Pairing completed', result);
                this._stopCountdown();
                await tumulte.connect();
                this.render(true);
                ui.notifications.info('Successfully connected to Tumulte!');
            });
            tumulte.pairingManager.onExpired(() => {
                Logger.info('Pairing expired');
                this._stopCountdown();
                this.render(true);
                ui.notifications.warn('Pairing code expired. Please try again.');
            });
            this.pairingInfo = await tumulte.startPairing();
            this.render(true);
        }
        catch (error) {
            Logger.error('Failed to start pairing', error);
            ui.notifications.error(`Pairing failed: ${error.message}`);
        }
    }
    _onCopyCode() {
        const tumulte = window.tumulte;
        const code = tumulte?.pairingManager?.getFormattedCode();
        if (code) {
            navigator.clipboard.writeText(code);
            ui.notifications.info('Code copied to clipboard!');
        }
    }
    _onCancelPairing() {
        const tumulte = window.tumulte;
        tumulte?.pairingManager?.cancelPairing();
        this._stopCountdown();
        this.render(true);
    }
    async _onDisconnect() {
        const tumulte = window.tumulte;
        if (!tumulte)
            return;
        const confirmed = await Dialog.confirm({
            title: 'Disconnect from Tumulte',
            content: '<p>Are you sure you want to disconnect from Tumulte?</p>',
            yes: () => true,
            no: () => false,
        });
        if (confirmed) {
            await tumulte.unpair();
            this.render(true);
        }
    }
    async _onReconnect() {
        const tumulte = window.tumulte;
        if (!tumulte)
            return;
        try {
            await tumulte.connect();
            this.render(true);
            ui.notifications.info('Reconnected to Tumulte!');
        }
        catch (error) {
            ui.notifications.error(`Reconnection failed: ${error.message}`);
        }
    }
    async _checkRevocationStatus() {
        const tumulte = window.tumulte;
        if (!tumulte?.tokenStorage?.isPaired())
            return;
        if (tumulte?.socketClient?.connected)
            return;
        try {
            const healthStatus = await tumulte.socketClient.checkConnectionHealth();
            if (healthStatus.status === 'revoked') {
                this.isRevoked = true;
                this.render(true);
            }
        }
        catch (error) {
            Logger.warn('Failed to check revocation status', error);
        }
    }
    async _onWaitReauthorization() {
        const tumulte = window.tumulte;
        if (!tumulte)
            return;
        ui.notifications.info('Waiting for GM to reauthorize access on Tumulte...');
        this._startReauthorizationPolling();
        this.render(true);
    }
    _startReauthorizationPolling() {
        if (this.reauthorizationPollInterval) {
            clearInterval(this.reauthorizationPollInterval);
        }
        const POLL_INTERVAL = 3000;
        this.reauthorizationPollInterval = setInterval(async () => {
            await this._checkReauthorizationStatus();
        }, POLL_INTERVAL);
        this._checkReauthorizationStatus();
    }
    _stopReauthorizationPolling() {
        if (this.reauthorizationPollInterval) {
            clearInterval(this.reauthorizationPollInterval);
            this.reauthorizationPollInterval = null;
        }
    }
    async _checkReauthorizationStatus() {
        const tumulte = window.tumulte;
        if (!tumulte)
            return;
        try {
            const result = await tumulte.socketClient.checkReauthorizationStatus();
            if (result.status === 'reauthorized') {
                Logger.info('Connection reauthorized!', result);
                this._stopReauthorizationPolling();
                this.isRevoked = false;
                await tumulte.connect();
                this.render(true);
                ui.notifications.info('Connection reauthorized! Reconnected to Tumulte.');
            }
            else if (result.status === 'still_revoked') {
                Logger.debug('Still waiting for reauthorization...');
            }
            else if (result.status === 'already_active') {
                this._stopReauthorizationPolling();
                this.isRevoked = false;
                await tumulte.connect();
                this.render(true);
            }
        }
        catch (error) {
            Logger.warn('Error checking reauthorization status', error);
        }
    }
    _startCountdownIfNeeded() {
        const tumulte = window.tumulte;
        const pairingStatus = tumulte?.pairingManager?.getPairingStatus();
        if (!pairingStatus?.active)
            return;
        this._stopCountdown();
        this.countdownInterval = setInterval(() => {
            const status = tumulte?.pairingManager?.getPairingStatus();
            if (!status?.active) {
                this._stopCountdown();
                this.render(true);
                return;
            }
            const countdownEl = this.element.find('.tumulte-countdown');
            if (countdownEl.length) {
                countdownEl.text(`${status.remainingSeconds}s`);
            }
        }, 1000);
    }
    _stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }
    async close(options = {}) {
        this._stopCountdown();
        this._stopReauthorizationPolling();
        await super.close(options);
    }
    async _updateObject(_event, _formData) {
        // This FormApplication doesn't save settings directly
        // All actions are handled via button clicks
    }
}
export default TumulteConnectionMenu;
//# sourceMappingURL=connection-menu.js.map