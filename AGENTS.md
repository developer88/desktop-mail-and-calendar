# Agent Operating Guidelines & Project Rules

This document specifies mandatory rules, design constraints, and operational guidelines for all AI agents working on the `desktop-mail-and-calendar` (Desktop Google Apps) repository.

---

## 1. Release & Tag Management Rules

* **Release Titles Strictly Version-Only:** GitHub release names and titles must be solely the version string (e.g. `0.3.1`, `0.3.2`), **NOT** prefixed with application names or 'v' (never `Desktop Mail & Desktop Calendar v0.3.1`).
* **Never Touch Past Releases:** Once a GitHub release is published, **do not** delete, re-upload, retag, or overwrite it unless the user explicitly and unambiguously requests a new release publish. Do not touch or rename past releases; this requirement applies to all subsequent releases.
* **Push to Master / Main:** All subsequent bug fixes, UI improvements, installer updates, and test expansions must be committed to the repository and pushed directly to `origin/main` (or `master`) without altering existing release assets.
* **Keep Dual Packaging (Portable + Installers):** Always maintain both standalone portable executables (`desktop-mail.exe`, `desktop-calendar.exe`) and setup installers (`desktop-mail-setup.exe`, `desktop-calendar-setup.exe`) alongside `SHA256SUMS.txt` and `release-manifest.json` in `dist/`.

---

## 2. Brand Identity & Visual Independence (Strictly No Google Affiliation)

* **Independent Third-Party Wrapper:** Desktop Mail and Desktop Calendar have **no affiliation, endorsement, or connection with Google LLC or Alphabet Inc.**
* **Never Use Google Trademarks or Visuals:**
  * **No Google Logos:** Do not use Google's 4-color "G", the Gmail 4-color envelope, or Google's multi-color calendar branding.
  * **No Google Blue:** Never use Google blue (`#1a73e8`) for custom branding or date labels.
* **Approved Visual Identity:**
  * **Desktop Mail:** Tactile orange envelope with soft shadow and white folded letter (`#ea580c` / `#f97316`).
  * **Desktop Calendar:** Crisp emerald green desk calendar with silver binding rings (`#15803d` / `#16a34a`). The default executable icon (`desktop-calendar.exe`), setup installer (`desktop-calendar-setup.exe`), and installer wizard sidebar must always display the official emerald green calendar with the "31" number.
* **Taskbar & Window Icon Behavior:**
  * **Desktop Mail:** Telegram-style vivid red pill unread counter badge (`#eb4034`) rendered on the top-right corner of the taskbar icon and taskbar overlay badge (formatting `1`–`999`, `K`, and `M`).
  * **Desktop Calendar:** When the application runs, it dynamically renders today's live day of the month (`1`–`31`) directly onto the white calendar card for the window/Alt-Tab icon. **Strictly no dot or corner overlay badges on Desktop Calendar** (never display the day as an overlay dot). If dynamic main taskbar icon modification is not natively supported by the Windows shell, the static "31" icon is displayed cleanly without any dots.

---

## 3. Toolchain & Environment Isolation (Critical Rule)

* **WSL Execution Only:** Per user rule, **ALWAYS** execute `node`, `npm`, and `cargo` inside WSL (e.g. `wsl bash -c '...'`). Never execute `node` or `npm` directly in Windows PowerShell or Command Prompt.
* **Export Toolchain PATH:** Always export PATH in WSL execution commands:
  ```bash
  export PATH="/home/andrey/.cargo/bin:/home/andrey/.local/bin:$PATH"
  ```

---

## 4. Google Trusted Types CSP & DOM Hygiene

* **Zero `innerHTML` Assignment:** Google Workspace pages enforce strict Trusted Types CSP policies (`This document requires 'TrustedHTML' assignment`).
  * **Never** assign to `.innerHTML` or `.outerHTML`.
  * **Never** call `insertAdjacentHTML`.
  * Any assignment to `.innerHTML` will throw a fatal `TypeError` and cause blank screens (such as the About dialog).
* **Pure DOM APIs:** Always construct elements and vector graphics using `document.createElement(...)` and `document.createElementNS('http://www.w3.org/2000/svg', ...)`.

---

## 5. Windows 11 Shell, Default Apps, & Installer Standards

* **Complete PE & Installer Metadata:**
  * Every executable and installer must have complete, valid `VERSIONINFO` metadata (`ProductName`, `FileDescription`, `CompanyName`, `LegalCopyright`, `FileVersion`, `ProductVersion`).
  * Never leave Windows File Properties &rarr; Details blank.
* **Installer High-DPI Awareness:**
  * NSIS installers must specify `ManifestDPIAware true` and use crisp 24-bit branding graphics (`shared/installer/wizard_mail.bmp` and `shared/installer/wizard_cal.bmp`). Never use pixelated low-res default 16-color NSIS bitmaps.
* **Windows Default Apps & Protocol Associations:**
  * The installer must register `RegisteredApplications`, `Capabilities`, and URL protocol associations:
    * **Desktop Mail:** `mailto:` URL protocol and `Clients\Mail\Desktop Mail`.
    * **Desktop Calendar:** `webcal:`, `webcals:`, and `.ics` file associations.
  * This ensures Windows Settings &rarr; Default Apps suggests Desktop Mail and Desktop Calendar when configuring email and calendar handlers.
* **Dynamic Taskbar Icon Rule:**
  * Never set `PKEY_APP_USER_MODEL_RELAUNCH_ICON_RESOURCE` on windows that use dynamic `WM_SETICON` updates. Setting that property forces Windows 11 Taskbar to lock to the executable's static icon resource, suppressing dynamic unread badges or calendar date updates.

---

## 6. Verification & Test Discipline

* **Run CI Before Reporting Completion:** Always run `npm test` and `scripts/ci.sh` inside WSL and verify 100% passing tests across:
  1. Rust unit tests (`cargo test --package desktop-google-core`).
  2. UI & Trusted Types CSP tests (`node tests/about-dialog.test.js`).
  3. Icon resolution tests (`node tests/icon-assets.test.js`).
  4. Observer tests (`node tests/observers.test.js`).
  5. Update notification & background release checker tests (`node tests/update-notification.test.js`).
  6. Offline UI Screenshot tests (`node tests/screenshot-ui.test.js`).
  7. E2E bundle simulation tests (`node tests/e2e-bundle.test.js`).
  8. E2E binary, installer & metadata verification tests (`node tests/e2e-binaries.test.js`).
  9. Calendar date dynamic icon & clean taskbar E2E tests (`node tests/calendar-date-e2e.test.js`).
* **Never Report Completion Without Verification:** Always verify changes with command execution and test output.
