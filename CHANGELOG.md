# Changelog

All notable changes to the Tumulte Integration module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.3] - 2025-01-21

### Fixed
- Fixed memory leak in pairing callback registration
- Added API response validation for pairing flow
- Improved error handling for auto-connect failures
- Protected polling from uncaught exceptions

### Changed
- Reduced excessive debug logging in dice collector

## [2.0.2] - 2025-01-21

### Changed
- Migrated token storage from localStorage to Foundry Settings API for better reliability
- Improved pairing flow stability

### Fixed
- Fixed Safari hydration loop issue with PWA components

## [2.0.1] - 2025-01-20

### Fixed
- Debug logging for Foundry pairing API URL issues

## [2.0.0] - 2025-01-19

### Added
- WebSocket-based real-time connection (replaces legacy webhook)
- Secure pairing system with 6-character codes
- Automatic reconnection with exponential backoff
- Character data synchronization
- Combat tracker integration
- Multi-system support (D&D 5e, Pathfinder 2e, and more)

### Changed
- Complete architecture rewrite for better performance
- New connection menu UI

### Removed
- Legacy webhook mode (deprecated)

## [1.0.0] - 2024-12-01

### Added
- Initial release
- Basic dice roll forwarding to Tumulte overlay
- Critical hit/fail detection
- Simple webhook integration
