# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-11

### Added
- **Desktop Mail Application:** Standalone, lightweight Windows 11 desktop app for Gmail powered by Tauri 2.0 and Microsoft Edge WebView2.
- **Desktop Calendar Application:** Standalone, lightweight Windows 11 desktop app for Google Calendar with dedicated window lifecycle.
- **Windows 11 Fluent Titlebar:** Custom frameless titlebar matching Windows 11 design guidelines, supporting Snap Assist, window dragging, minimize, maximize/restore, and close.
- **First-Run Welcome Splash:** Transparent introduction overlay outlining the open-source wrapper architecture and zero-telemetry privacy guarantees.
- **System Tray Integration:** Background daemon with minimize-to-tray capability, dynamic unread email badge counter on both Taskbar and Tray, and quick context menu.
- **In-App Update Checker:** Direct integration with GitHub Releases API in Settings to notify users when a new version is available with a 1-click external download link.
- **Configurable Protocol Handler:** Optional toggle in Settings -> General (off by default) to intercept and route `mailto:` links into Desktop Mail or `webcal:` calendar subscription links into Desktop Calendar.
- **Privacy & Security Architecture:**
  - 100% untouched Google Authentication & OAuth flow with no DOM alterations or script hooks during sign-in.
  - Zero analytics, zero telemetry beacons, and zero local activity logging.
  - Top-level subframe guard preventing duplicate UI injection inside embedded child iframes (Meet, Tasks, Keep).
- **Packaging & Distribution:**
  - Automated NSIS setup installers (`desktop-mail-setup.exe` and `desktop-calendar-setup.exe`, ~4 MB each).
  - MIT open-source license with explicit all-caps warranty and limitation of liability disclaimer.
