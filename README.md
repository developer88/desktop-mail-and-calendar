# Desktop Mail & Desktop Calendar (Windows 11)

[![Release](https://img.shields.io/badge/Release-v0.1.0-blue.svg)](https://github.com/developer88/desktop_gmail_and_gcalendar/releases)
[![Rust](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8DB.svg)](https://tauri.app/)
[![Windows 11](https://img.shields.io/badge/Platform-Windows%2011-0078D4.svg)](https://www.microsoft.com/windows)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero%20Telemetry-success.svg)](#-privacy--security-guarantees)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Native-feeling, standalone Windows 11 desktop applications for **Gmail** and **Google Calendar** powered by **Tauri 2.0** and **Microsoft Edge WebView2**.

Engineered to provide a focused, lightweight desktop window for email and calendar management on Windows 11 without running a full Chromium browser or cluttering your daily tabs.

---

## 📥 Download (Release v0.1.0)

Pre-built binaries and Windows NSIS setup installers are available in [GitHub Releases](https://github.com/developer88/desktop_gmail_and_gcalendar/releases):

| Application | Installer (`.exe`) | Portable Executable | Size |
| :--- | :--- | :--- | :--- |
| **Desktop Mail** | [`desktop-mail-setup.exe`](https://github.com/developer88/desktop_gmail_and_gcalendar/releases/download/v0.1.0/desktop-mail-setup.exe) | [`desktop-mail.exe`](https://github.com/developer88/desktop_gmail_and_gcalendar/releases/download/v0.1.0/desktop-mail.exe) | ~4 MB / ~12.8 MB |
| **Desktop Calendar** | [`desktop-calendar-setup.exe`](https://github.com/developer88/desktop_gmail_and_gcalendar/releases/download/v0.1.0/desktop-calendar-setup.exe) | [`desktop-calendar.exe`](https://github.com/developer88/desktop_gmail_and_gcalendar/releases/download/v0.1.0/desktop-calendar.exe) | ~4 MB / ~12.8 MB |

*Every release includes cryptographic hashes in `SHA256SUMS.txt` and a machine-readable `release-manifest.json`.*

---

## 🔒 Privacy & Security Guarantees

* **Zero Telemetry & Tracking:** No analytics libraries, no tracking pixels, and no diagnostic beacon calls.
* **Zero Logging:** No user activity, keystrokes, or message contents are ever logged or sent to any third party.
* **No Underlying Data Access:** The wrapper does not read, modify, or store your emails, calendar events, contacts, or passwords. Your session and credentials reside exclusively between your local Edge WebView2 sandbox and Google's official servers.
* **100% Free & Open Source:** The entire source code is transparent, auditable, and freely available on GitHub.

---

## ✨ Features & Windows 11 Integration

* **Independent Lifecycles:** Separate standalone executables. Closing your browser or encountering a tab crash does not interrupt your email or calendar.
* **Windows 11 Fluent Design:** Custom frameless titlebar with native Windows 11 minimize, maximize, and close controls, full-window snapping, and theme sync (Dark/Light).
* **Smart External Link Routing:** Links inside emails and calendar events automatically open in your default Windows browser (Edge, Chrome, Firefox), keeping your app focused.
* **Windows `mailto:` Protocol Association:** Clicking `mailto:` links across Windows opens directly in the Desktop Mail compose view instead of spawning browser tabs.
* **System Tray Daemon & Badges:** Minimize to tray with unread email badges on the Windows Taskbar and Notification Area.
* **First-Run Welcome Notice:** Transparent splash modal informing first-time users of the privacy architecture and wrapper design.
* **In-App Update Checker:** Direct integration with GitHub Releases to notify and link to new application versions.

---

## 📁 Repository Structure

```
desktop-google-apps/
├── apps/
│   ├── desktop-gmail/                  # Desktop Mail (Tauri v2 application)
│   │   ├── tauri.conf.json             # "Desktop Mail" product configuration
│   │   ├── src-tauri/                  # Rust entrypoint, tray, commands, resources
│   │   │   ├── Cargo.toml
│   │   │   ├── build.rs
│   │   │   ├── icons/                  # High-DPI ICO & PNG assets
│   │   │   └── src/ (main.rs, lib.rs)
│   │   └── ui/                         # Fallback offline & loader view
│   │
│   └── desktop-gcalendar/              # Desktop Calendar (Tauri v2 application)
│       ├── tauri.conf.json             # "Desktop Calendar" product configuration
│       ├── src-tauri/
│       │   ├── Cargo.toml
│       │   ├── build.rs
│       │   ├── icons/                  # High-DPI ICO & PNG assets
│       │   └── src/ (main.rs, lib.rs)
│       └── ui/                         # Fallback offline & loader view
│
├── crates/
│   └── core/                           # Shared Rust library (desktop-google-core)
│       ├── Cargo.toml
│       └── src/
│           ├── config.rs               # Window dimensions, user-agent, app config
│           ├── navigation.rs           # URL routing & classification engine
│           ├── protocol.rs             # RFC 6068 mailto parser & compose converter
│           ├── tray.rs                 # System tray event models
│           └── scripts.rs              # Injected CSS & JS bundles
│
├── shared/
│   ├── scripts/
│   │   ├── navigation-interceptor.js   # Client-side link routing & reload shortcuts
│   │   ├── titlebar.js                 # Frameless titlebar, settings dialog & updater
│   │   └── unread-observer.js          # DOM observer for email badge counts
│   └── styles/
│       ├── win11-theme.css             # Windows 11 typography, dialogs & splash
│       └── declutter.css               # Clean web layout styling
│
├── scripts/
│   ├── build-installers.js             # NSIS setup installer compiler
│   ├── generate-icons.py               # Multi-resolution ICO & PNG generator
│   └── prepare-release.js              # Release manifest and SHA256 generator
│
├── dist/                               # Staged release executables and installers
├── Cargo.toml                          # Cargo workspace configuration
└── package.json                        # Monorepo build and test scripts
```

---

## 🛠️ Building from Source

### Prerequisites
* **Rust 1.80+** (`rustup default stable`, target `x86_64-pc-windows-msvc`)
* **Node.js 18+ & NPM** (run inside WSL per developer guidelines)
* **NSIS** (`makensis` installed for packaging installers)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/developer88/desktop_gmail_and_gcalendar.git
cd desktop_gmail_and_gcalendar
npm install
```

### 2. Run Test Suite
```bash
npm test
# Or directly via Cargo:
cargo test --package desktop-google-core
```

### 3. Build Executables & Installers
```bash
# Compile release binaries
npm run build:mail
npm run build:calendar

# Package NSIS installers & prepare release hashes
npm run build:installers
npm run release:prepare
```
The compiled files are placed into the `dist/` directory:
- `dist/desktop-mail.exe`
- `dist/desktop-mail-setup.exe`
- `dist/desktop-calendar.exe`
- `dist/desktop-calendar-setup.exe`
- `dist/SHA256SUMS.txt`
- `dist/release-manifest.json`

---

## ⚖️ Legal Notice & Disclaimer

Desktop Mail and Desktop Calendar are independent open-source projects created solely to provide focused desktop window experiences for Gmail and Google Calendar. 

They have **no affiliation, association, sponsorship, or endorsement with Google LLC or Alphabet Inc.** All Google trademarks, service marks, logos, interfaces, and intellectual property remain the exclusive property of Google LLC.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
