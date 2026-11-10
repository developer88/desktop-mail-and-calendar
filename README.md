# Desktop Google Apps (Windows 11)

Native-feeling, standalone Windows 11 desktop applications for **Gmail** and **Google Calendar** powered by **Tauri 2.0** and **Microsoft Edge WebView2**.

Designed to deliver the clean, responsive simplicity of Apple Mail and Calendar on Windows 11 while retaining the full web features of Google's email and calendar services.

---

## 🎯 Solved Usability Pain Points

* **Independent Lifecycle:** No longer tied to Google Chrome. If Chrome crashes or is closed, your email and calendar stay open and active.
* **Smart Link Routing:** External web links automatically open in your default Windows browser (Edge, Chrome, Firefox, etc.) without losing your email or calendar state.
* **Windows `mailto:` Association:** Clicking `mailto:` links across Windows opens directly in the Gmail app compose window instead of spawning a new browser tab.
* **Windows 11 Visual Polish:** Styled with Windows 11 fonts (`Segoe UI Variable`), dark/light mode synchronization, and stripped Google web clutter.
* **System Tray & Badges:** Minimize-to-tray background daemon with real-time unread email count badges on the Taskbar and Tray.

---

## 📁 Repository Structure

```
desktop-google-apps/
├── apps/
│   ├── desktop-gmail/                  # Standalone Gmail application
│   │   ├── tauri.conf.json             # Tauri v2 configuration (com.andrey.desktop-gmail)
│   │   ├── src-tauri/                  # Tauri Rust entrypoint, capabilities, tray
│   │   │   ├── Cargo.toml
│   │   │   ├── build.rs
│   │   │   ├── capabilities/default.json
│   │   │   ├── icons/
│   │   │   └── src/ (main.rs, lib.rs)
│   │   └── ui/                         # Offline fallback and loader UI
│   │
│   └── desktop-gcalendar/              # Standalone Google Calendar application
│       ├── tauri.conf.json             # Tauri v2 configuration (com.andrey.desktop-gcalendar)
│       ├── src-tauri/
│       │   ├── Cargo.toml
│       │   ├── build.rs
│       │   ├── capabilities/default.json
│       │   ├── icons/
│       │   └── src/ (main.rs, lib.rs)
│       └── ui/                         # Offline fallback and loader UI
│
├── crates/
│   └── core/                           # Shared Rust library (desktop-google-core)
│       ├── Cargo.toml
│       └── src/
│           ├── config.rs               # App dimensions, user-agent & settings
│           ├── navigation.rs           # URL routing & classification engine
│           ├── protocol.rs             # RFC 6068 mailto parser & compose converter
│           ├── tray.rs                 # Tray action models & event dispatch
│           └── scripts.rs              # Injected CSS & JS script assets
│
├── shared/
│   ├── scripts/
│   │   ├── navigation-interceptor.js   # Client-side anchor click interceptor
│   │   └── unread-observer.js          # DOM / title observer for unread count
│   └── styles/
│       ├── win11-theme.css             # Windows 11 Segoe UI & scrollbar overrides
│       └── declutter.css               # Google promotional banner removal
│
├── scripts/
│   ├── ci.sh                           # Cross-platform / WSL local CI script
│   ├── ci.ps1                          # Native Windows PowerShell CI runner
│   ├── generate-icons.py               # PNG & ICO icon generator
│   └── prepare-release.js              # Staging, checksums & manifest generator
│
├── Cargo.toml                          # Cargo workspace definition
└── package.json                        # NPM workspace & developer scripts
```

---

## 🛠️ Toolchain & Requirements

* **Node & NPM:** Run via WSL per user environment configuration.
* **Rust:** Rust 1.80+ (managed via Cargo / Rustup).
* **WebView2:** Microsoft Edge WebView2 Evergreen runtime (pre-installed on Windows 11).

---

## 🚀 Development & Workflow

### 1. Install Dependencies
```bash
# Run inside WSL
npm install
```

### 2. Run Local CI Pipeline
The local CI script verifies code formatting, runs unit and integration tests, checks workspace packages, and prepares release bundles:

* **From WSL / Bash:**
  ```bash
  bash scripts/ci.sh
  ```
* **From Windows PowerShell:**
  ```powershell
  .\scripts\ci.ps1
  ```
* **Via NPM:**
  ```bash
  npm run ci
  ```

### 3. Run Unit Tests Only
```bash
npm test
# Or directly via cargo:
cargo test --package desktop-google-core
```

### 4. Build Release Binaries
```bash
npm run build
# Or build an individual app:
npm run build:gmail
npm run build:calendar
```

Releases and SHA-256 checksums are staged into the `dist/` directory:
* `dist/SHA256SUMS.txt`
* `dist/release-manifest.json`
