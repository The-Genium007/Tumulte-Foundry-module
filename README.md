# Tumulte Integration for Foundry VTT

[![Foundry Version](https://img.shields.io/badge/Foundry-v11--v13-green)](https://foundryvtt.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

Connect your Foundry VTT game to [Tumulte](https://tumulte.app) and display dice rolls, character data, and combat tracking on your Twitch stream overlay.

## Features

- **Dice Rolls** — Send critical hits, critical fails, or all rolls to your overlay
- **Combat Tracking** — Real-time turn order and round updates
- **Character Sync** — Automatic HP and stats synchronization
- **Spell & Effect Tracking** — Track spell usage, buffs, and debuffs
- **Gamification** — Twitch Channel Points integration for in-game effects
- **Multi-System** — 15+ supported systems including D&D 5e, Pathfinder 2e, Call of Cthulhu, WFRP4e, and more

## Installation

### Via Foundry (Recommended)

1. Open Foundry VTT
2. Go to **Add-on Modules** → **Install Module**
3. Search for "Tumulte Integration" or paste the manifest URL:
   ```
   https://raw.githubusercontent.com/The-Genium007/Tumulte-Foundry-module/main/module.json
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

- [GitHub Issues](https://github.com/The-Genium007/Tumulte/discussions/categories/bugs-issues)
- [Tumulte Discord](https://discord.gg/tumulte)

## License

This module is proprietary software. All rights reserved. See the [LICENSE](LICENSE) file for details.
