# Tumulte Integration for Foundry VTT

[![Foundry Version](https://img.shields.io/badge/Foundry-v11+-green)](https://foundryvtt.com/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

Connect your Foundry VTT game to [Tumulte](https://tumulte.app) and display dice rolls, character data, and combat tracking on your Twitch stream overlay.

## Features

- **Dice Rolls** — Send critical hits, critical fails, or all rolls to your overlay
- **Combat Tracking** — Real-time turn order and round updates
- **Character Sync** — Automatic HP and stats synchronization
- **Multi-System** — Works with D&D 5e, Pathfinder 2e, and other systems

## Installation

### Via Foundry (Recommended)

1. Open Foundry VTT
2. Go to **Add-on Modules** → **Install Module**
3. Search for "Tumulte Integration" or paste the manifest URL:
   ```
   __TUMULTE_MANIFEST_URL__
   ```
4. Click **Install** and enable the module in your world

### Manual Installation

Copy the module folder to `[FoundryData]/Data/modules/tumulte-integration/`

## Quick Setup

1. In Foundry, go to **Game Settings** → **Module Settings** → **Tumulte Integration**
2. Click **Connect to Tumulte**
3. A pairing code appears (e.g., `ABC-123`)
4. On [tumulte.app](https://tumulte.app), go to your campaign settings and enter the code
5. Done! Your VTT is now connected

## Configuration

| Setting | Description |
|---------|-------------|
| Send all rolls | Send every roll (default: critical only) |
| Sync characters | Enable automatic character data sync |
| Sync combat | Enable combat tracker events |

## Support

- [GitHub Issues](https://github.com/tumulte/foundry-integration/issues)
- [Tumulte Discord](https://discord.gg/tumulte)

## License

MIT License
