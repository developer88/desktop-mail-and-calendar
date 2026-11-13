#!/usr/bin/env bash
set -euo pipefail

# Ensure WSL node, npm, and cargo toolchains are available
if [ -d "/home/andrey/.nvm/versions/node/v22.22.0/bin" ]; then
  export PATH="/home/andrey/.nvm/versions/node/v22.22.0/bin:$PATH"
fi
if [ -d "/home/andrey/.cargo/bin" ]; then
  export PATH="/home/andrey/.cargo/bin:$PATH"
fi

echo "============================================================"
echo " Starting Local CI for Desktop Google Apps"
echo "============================================================"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Step 1: Format Check
echo ""
echo "-> [1/6] Checking Rust code formatting..."
if cargo fmt --version >/dev/null 2>&1; then
  cargo fmt --all -- --check || {
    echo "Formatting issues detected. Run 'cargo fmt --all' to fix."
    exit 1
  }
  echo "Formatting is clean."
else
  echo "cargo-fmt not available in PATH, skipping format check."
fi

# Step 2: Run Unit Tests
echo ""
echo "-> [2/6] Running unit and integration tests across workspace..."
cargo test --package desktop-google-core -- --nocapture

# Step 3: Run UI & Asset Verification Tests
echo ""
echo "-> [3/6] Verifying UI, icons up to 1024x1024, and Trusted Types CSP compliance..."
node tests/about-dialog.test.js
node tests/icon-assets.test.js
node tests/observers.test.js

# Step 4: Check Windows WebView2 Targets
echo ""
echo "-> [4/6] Verifying Windows compilation for Mail and Calendar apps..."
cargo check --target x86_64-pc-windows-msvc --workspace

# Step 5: Build Installers and Prepare Release Artifacts
echo ""
echo "-> [5/6] Building High-DPI installers, staging artifacts, and calculating checksums..."
node scripts/build-installers.js
node scripts/prepare-release.js

# Step 6: Run End-to-End (E2E) Bundle & Binary Tests
echo ""
echo "-> [6/6] Running End-to-End (E2E) bundle simulation and PE binary verification tests..."
node tests/e2e-bundle.test.js
node tests/e2e-binaries.test.js

echo ""
echo "============================================================"
echo " Local CI Passed Successfully!"
echo "============================================================"
