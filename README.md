# Desktop Mail & Desktop Calendar (Windows 11)

[![Release](https://img.shields.io/badge/Release-v0.2.0-blue.svg)](https://github.com/developer88/desktop-mail-and-calendar/releases)
[![Rust](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8DB.svg)](https://tauri.app/)
[![Windows 11](https://img.shields.io/badge/Platform-Windows%2011-0078D4.svg)](https://www.microsoft.com/windows)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero%20Telemetry-success.svg)](#-privacy--security-guarantees)
[![Changelog](https://img.shields.io/badge/Changelog-SemVer-purple.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Native-feeling, standalone Windows 11 desktop applications for **Gmail** and **Google Calendar** powered by **Tauri 2.0** and **Microsoft Edge WebView2**.

Engineered to provide a focused, lightweight desktop window for email and calendar management on Windows 11 without running a full Chromium browser or cluttering your daily tabs.

---

## 🔒 Privacy & Security Guarantees

* **Zero Telemetry & Tracking:** No analytics libraries, no tracking pixels, and no diagnostic beacon calls.
* **Zero Logging:** No user activity, keystrokes, or message contents are ever logged or sent to any third party.
* **No Underlying Data Access:** The wrapper does not read, modify, or store your emails, calendar events, contacts, or passwords. Your session and credentials reside exclusively between your local Edge WebView2 sandbox and Google's official servers.
* **100% Free & Open Source:** The entire source code is transparent, auditable, and freely available on GitHub.

---

## ✨ Features & Windows 11 Integration

* **Independent Lifecycles:** Separate standalone executables (`desktop-mail.exe` and `desktop-calendar.exe`). Closing your browser or encountering a tab crash does not interrupt your email or calendar. Closing the application window exits the process cleanly.
* **Windows 11 Fluent Design:** Custom frameless titlebar with native Windows 11 minimize, maximize/restore, and close controls, hamburger menu (`File`, `Edit`, `View`, `Window`), full-window snapping, and adaptive theme synchronization (Dark/Light and Gmail background luminance sampling).
* **Dynamic Taskbar Icons & Badges:**
  * **Desktop Mail:** Renders a Telegram-style red unread counter pill badge directly onto the taskbar icon and taskbar overlay badge (`1`–`999`, `K`, and `M` formatting), driven by both DOM mutation observers and native Win32 GDI+ `HICON` rendering.
  * **Desktop Calendar:** Dynamically renders the current day of the month (`1`–`31`) in emerald green (`#15803d`) on the calendar taskbar icon and automatically updates across midnight.
* **High-DPI Distinct Icon Identity:** Custom-crafted 1024×1024 and 512×512 tactile orange envelope (Mail) and emerald green desk calendar (Calendar) icons, bundled with multi-resolution Windows `.ico` resources and Win32 `IPropertyStore` taskbar Jump List relaunch metadata (`Desktop Mail` and `Desktop Calendar`).
* **Smart External Link Routing:** First-party Google ecosystem domains (`*.google.com`, `*.googleapis.com`, `*.gstatic.com`, regional Google ccTLDs) remain in-app, while external links and Google redirector links (`google.com/url?q=...`) are automatically unwrapped and opened in your default Windows browser.
* **Protocol & File Associations:**
  * **Desktop Mail:** Supports `mailto:` URI command-line arguments and in-app `mailto:` links (RFC 6068 parser routing directly into the compose view).
  * **Desktop Calendar:** Supports `webcal://`, `webcals://`, and `.ics` command-line arguments and in-app `webcal:` links, routing directly to the calendar subscription view.
  * **Windows Default Apps Integration:** One-click deep-link to `ms-settings:defaultapps` in **Settings &rarr; General**, plus optional **Open at login** (`HKCU\...\Run` registry toggle).
* **First-Run Welcome Notice & Settings Modal:** Transparent first-launch splash screen explaining the wrapper architecture and privacy guarantees, alongside a 3-tab Settings dialog (**General**, **Privacy & permissions**, **About**) built with strict DOM APIs (`createElementNS`) for 100% compliance with Google's Trusted Types CSP.
* **In-App Update Checker:** Direct integration with the GitHub Releases API in **Settings &rarr; About** to check for and download new application versions.

---

## 📁 Repository Structure

```text
desktop-google-apps/
├── apps/
│   ├── desktop-mail/                   # Desktop Mail (Tauri v2 application)
│   │   ├── tauri.conf.json             # "Desktop Mail" product & bundle configuration
│   │   ├── src-tauri/                  # Rust entrypoint, commands, Win32 hooks, resources
│   │   │   ├── Cargo.toml
│   │   │   ├── build.rs                # Windows PE VERSIONINFO & icon resource compiler
│   │   │   ├── icons/                  # 1024x1024, 512x512, 256x256, 128x128, 32x32 & ICO
│   │   │   └── src/ (main.rs, lib.rs)
│   │   └── ui/                         # Fallback offline & loader view
│   │
│   └── desktop-calendar/               # Desktop Calendar (Tauri v2 application)
│       ├── tauri.conf.json             # "Desktop Calendar" product & bundle configuration
│       ├── src-tauri/
│       │   ├── Cargo.toml
│       │   ├── build.rs                # Windows PE VERSIONINFO & icon resource compiler
│       │   ├── icons/                  # 1024x1024, 512x512, blank_1024, blank_512 & ICO
│       │   └── src/ (main.rs, lib.rs)
│       └── ui/                         # Fallback offline & loader view
│
├── crates/
│   └── core/                           # Shared Rust library (desktop-google-core)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                  # Public exports
│           ├── config.rs               # Window dimensions, initial URLs, app config
│           ├── icon.rs                 # Win32 GDI+ HICON badge/date renderer & IPropertyStore
│           ├── navigation.rs           # Google ecosystem URL classifier & redirect unwrapper
│           ├── protocol.rs             # RFC 6068 mailto parser & compose URL converter
│           └── scripts.rs              # Consolidated CSS & JS initialization bundle builder
│
├── shared/
│   ├── scripts/
│   │   ├── calendar-date-observer.js   # 512x512 live calendar date renderer & toast cleaner
│   │   ├── navigation-interceptor.js   # Client-side link routing & keyboard reload shortcuts
│   │   ├── titlebar.js                 # Frameless titlebar, menu, settings modal & updater
│   │   └── unread-observer.js          # 512x512 unread badge renderer & DOM/title observer
│   └── styles/
│       ├── win11-theme.css             # Windows 11 Fluent titlebar, menu, dialogs & splash
│       └── declutter.css               # Clean web layout & scroll-lock styling
│
├── scripts/
│   ├── build-installers.js             # NSIS setup installer compiler
│   ├── ci.ps1                          # Windows PowerShell CI pipeline
│   ├── ci.sh                           # WSL / Linux Bash CI pipeline
│   ├── generate-icons.py               # 8x supersampled 1024x1024 PNG & ICO generator
│   ├── prepare-release.js              # Release manifest and SHA256SUMS generator
│   └── rc-shim.py                      # Cross-compilation Windows RC resource shim
│
├── tests/
│   ├── about-dialog.test.js            # Trusted Types CSP & SVG logo verification
│   ├── e2e-binaries.test.js            # E2E PE executable, installer & manifest verification
│   ├── e2e-bundle.test.js              # E2E JSDOM full bundle simulation (Mail/Calendar/Auth)
│   ├── icon-assets.test.js             # 1024x1024 & 512x512 PNG/ICO asset verification
│   ├── mock-dom.js                     # Strict Trusted Types DOM mock
│   └── observers.test.js               # Unread & calendar date observer verification
│
├── dist/                               # Staged release executables, installers & checksums
├── Cargo.toml                          # Cargo workspace configuration
└── package.json                        # Monorepo build, test, E2E and CI scripts
```

---

## 🛠️ Building & Testing from Source

### Prerequisites
* **Rust 1.80+** (`rustup default stable`, target `x86_64-pc-windows-msvc`)
* **Node.js 18+ & NPM** (run inside WSL per developer guidelines)
* **NSIS** (`makensis` installed for packaging setup installers)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/developer88/desktop-mail-and-calendar.git
cd desktop-mail-and-calendar
npm install
```

### 2. Run the Test Suite (Unit, UI & E2E)
The repository includes Rust unit tests, UI/CSP asset tests, full JSDOM E2E bundle execution tests, and compiled PE binary/installer E2E verification tests:
```bash
# Run all Rust unit tests + UI asset tests + E2E tests
npm test

# Run only UI & Trusted Types CSP tests
npm run test:ui

# Run only End-to-End (E2E) bundle & binary verification tests
npm run test:e2e

# Run the full local CI pipeline (format check, Rust tests, UI/E2E tests, MSVC check, release staging)
npm run ci
```

### 3. Build Executables & NSIS Installers
```bash
# Compile release binaries
npm run build:mail
npm run build:calendar

# Package NSIS setup installers and stage release artifacts
npm run build:installers
npm run release:prepare
```
The compiled portable executables and setup installers are staged in `dist/`:
* `dist/desktop-mail.exe` & `dist/desktop-mail-setup.exe`
* `dist/desktop-calendar.exe` & `dist/desktop-calendar-setup.exe`
* `dist/SHA256SUMS.txt` & `dist/release-manifest.json`

---

## ⚖️ Legal Notice, User-Agent & Authentication Architecture

Desktop Mail and Desktop Calendar are independent open-source projects created solely to provide focused desktop window experiences for Gmail and Google Calendar.

* **No Affiliation:** They have **no affiliation, association, sponsorship, or endorsement with Google LLC or Alphabet Inc.** All Google trademarks, service marks, logos, interfaces, and intellectual property remain the exclusive property of Google LLC.
* **Standard Windows 11 Edge User-Agent:** Both applications configure the WebView2 runtime with a standard Microsoft Edge on Windows 11 `User-Agent` string (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0`) so Google Workspace services deliver full desktop functionality without flagging the embedded WebView2 suffix.
* **Protected Authentication Flow:** When navigating Google Accounts (`accounts.google.com`, `myaccount.google.com`, or OAuth sign-in endpoints), the injection bundle's `isAuthFlow()` guard disables custom CSS decluttering, link interception, and DOM observers so sign-in pages operate undisturbed. Only the minimal frameless window titlebar remains active so you can drag, minimize, maximize, or close the window during sign-in.

---

## 📄 License & Limitation of Liability

This project is licensed under the [MIT License](LICENSE).

```text
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
