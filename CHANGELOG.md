# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-15

### Added
- **Dynamic Window Caption, Alt-Tab & Task Manager Calendar Date:** Today's live date (`1`–`31`) is dynamically rendered on the window caption/title bar badge in the app, and dynamically set on the window via Win32 `WM_SETICON` (`ICON_BIG`, `ICON_SMALL`) and `GCLP_HICON`/`GCLP_HICONSM` with a High-DPI 256×256 icon so Alt-Tab switcher and Task Manager display today's actual date.
- **Clean Static Taskbar Icon for Desktop Calendar:** Restored clean official emerald green calendar with the "31" number for the taskbar icon, removing unsightly corner overlay dots/badges.
- **Installer Active Process Termination:** NSIS setup installers now terminate running application instances before file extraction during setup (`.onInit` and `Install` section), preventing file lock errors (`ERROR_SHARING_VIOLATION`) and guaranteeing seamless reinstalls and upgrades.
- **Offline UI Screenshot Test Suite:** Added comprehensive headless browser UI screenshot test suite (`tests/screenshot-ui.test.js`) validating 10 distinct UI states across Desktop Mail and Desktop Calendar (titlebars, dynamic calendar dates, welcome dialogs, settings, about modals) without requiring live Google services.
- **Dynamic Calendar Date & Clean Taskbar E2E Test Suite:** Added `tests/calendar-date-e2e.test.js` verifying dynamic date icon generation, Alt-Tab icon setting, in-app title bar date badge rendering, and clean static 31 taskbar icon configuration.
- **Release Naming Standardization:** Standardized GitHub release titles to strictly version-only format (e.g., `0.4.0`) per project guidelines in `AGENTS.md`.

## [0.3.1] - 2026-11-15

### Added
- **First-Run Welcome Screen Before Sign-In:** Welcome dialog is now presented immediately on initial launch before Google account sign-in on `accounts.google.com`. Once dismissed, it never reappears across origins or future app launches (persisted in `%LOCALAPPDATA%`).
- **Universal Shell Stylesheet:** Extracted native frameless titlebar and first-run dialog styles into `shared/styles/shell.css`, allowing controls and dialogs to render safely on sign-in pages without interfering with Google's authentication inputs.
- **High-Resolution Documentation Screenshots:** Embedded crisp, up-to-date screenshots into `README.md` showcasing Desktop Calendar main view, Desktop Mail and Desktop Calendar welcome dialogs, and the native Windows 11 Settings modals.

### Fixed
- **Google Calendar Window Width & Header Layout:** Increased default window width to 1380px (min width 800px, min height 600px), ensuring all header elements, user profile avatar, and action controls fit without horizontal cutoff.
- **Fixed CSS Transform Containing Block Bug:** Replaced `body` CSS transform with top margin in `win11-theme.css`, eliminating the CSS Transform Level 1 containing-block glitch that previously disrupted Google Calendar's companion sidebar and drawer coordinates.

## [0.3.0] - 2026-11-14

### Added
- **Windows 11 Default Apps Integration & Friendly Naming:** Registered `Software\Classes\Applications\<app>` and ProgID application metadata so Windows 11 Settings -> Default Apps and protocol pickers display friendly names ("Desktop Mail" and "Desktop Calendar") for `mailto:`, `webcal:`, and `.ics` files.
- **Ultra High-DPI NSIS Installer Wizard Graphics:** Upgraded installer sidebar wizard branding graphics to 6x High-DPI resolution (984×1884 uncompressed 24-bit bitmaps) with `ManifestDPIAware true` for razor-sharp rendering on 4K/high-DPI monitors.
- **Restored Dual Packaging in Release Pipeline:** Automated generation of both standalone portable binaries (`desktop-mail.exe`, `desktop-calendar.exe`) and setup installers (`desktop-mail-setup.exe`, `desktop-calendar-setup.exe`) alongside `SHA256SUMS.txt` and `release-manifest.json`.
- **Complete PE Resource Information:** Full Win32 `VERSIONINFO` metadata (ProductName, FileDescription, CompanyName, LegalCopyright, FileVersion, ProductVersion) across all binaries and setup installers so Windows File Properties -> Details is 100% complete.
- **Strict Brand Independence & Internal Workspace Refactoring:** Fully renamed internal directory names and variables to `desktop-mail` and `desktop-calendar` to eliminate Google trademarks from code identifiers; introduced `AGENTS.md` guidelines.
- **Comprehensive End-to-End (E2E) Test Suite:** Added end-to-end test coverage for full app lifecycles, Trusted Types CSP DOM safety, authentication flow guards, PE binary headers, and installer registry validation.

## [0.2.0] - 2026-11-12

### Added
- **Telegram-Style Taskbar Unread Counter Badge:** Dynamic unread email counter rendered on the Desktop Mail taskbar icon and overlay badge (supporting `1`–`999`, `K`, and `M` formatting).
- **Dynamic Calendar Date Icon:** Desktop Calendar automatically renders the current day of the month (`1`–`31`) in emerald green on its taskbar icon and updates across midnight.
- **High-Definition 1024×1024 & 512×512 Icon Suite:** Redesigned tactile orange envelope (Mail) and emerald green desk calendar (Calendar) icons at 1024×1024 and 512×512 resolutions, plus multi-size Windows `.ico` bundles.
- **Windows Shell & Jump List Metadata:** Embedded `VERSIONINFO` (`FileDescription`, `ProductName`) and Win32 `IPropertyStore` relaunch properties so taskbar right-click Jump Lists display "Desktop Mail" and "Desktop Calendar".
- **Automated UI & Asset Verification Suite:** Added CI tests enforcing Trusted Types CSP compliance, 1024×1024 icon asset dimensions, and observer configurations.

### Fixed
- **About Dialog Trusted Types CSP Compliance:** Rebuilt About dialog vector logos using strict DOM `createElementNS` APIs without `.innerHTML`.
- **Google Calendar Offline Sync & Navigation:** Inverted domain matching to allow the full Google ecosystem in-app while unwrapping external redirect URLs to the default browser; added automatic recovery for corrupt offline IndexedDB state.
- **Native Window Open Semantics:** Removed `window.open` monkey-patching so popup and print windows retain native browser semantics.
- **Adaptive Titlebar & Caption Controls:** Improved luminance detection, contrast drop-shadows, and sidebar/companion panel layout isolation.

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
