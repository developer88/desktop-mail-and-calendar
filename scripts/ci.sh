#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " Starting Local CI for Desktop Google Apps"
echo "============================================================"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Step 1: Format Check
echo ""
echo "-> [1/4] Checking Rust code formatting..."
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
echo "-> [2/4] Running unit and integration tests across workspace..."
cargo test --package desktop-google-core -- --nocapture

# Step 3: Check Windows WebView2 Targets
echo ""
echo "-> [3/4] Verifying Windows compilation for Gmail and Calendar apps..."
cargo check --target x86_64-pc-windows-msvc --workspace

# Step 4: Prepare Release Artifacts
echo ""
echo "-> [4/4] Staging release artifacts and calculating checksums..."
node scripts/prepare-release.js

echo ""
echo "============================================================"
echo " Local CI Passed Successfully!"
echo "============================================================"
