# Changelog

All notable changes to the Tumulte Integration module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.4] - 2025-01-21

### Added
- Connection health check endpoint for improved resilience
- Automatic detection of campaign deletion with user notification
- HTTP fallback (`checkConnectionHealth()`) when WebSocket connection fails
- Clear distinction between "server unavailable" and "connection revoked" states
- New dialog UI for connection issues (revoked, campaign deleted, reconnect failed)

### Improved
- Better error messages when connection issues occur
- Reconnection dialogs with clear action buttons
- Campaign deletion notification includes campaign name

### Fixed
- Module now gracefully handles temporary server unavailability without losing pairing

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
