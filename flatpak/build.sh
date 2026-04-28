#!/usr/bin/env bash
# Build and install htpc-launcher as a local Flatpak.
#
# Run this on the Bazzite VM (or any Linux host with flatpak-builder):
#
#   bash flatpak/build.sh
#
# Prerequisites (one-time):
#   flatpak install flathub \
#     org.gnome.Platform//50 \
#     org.gnome.Sdk//50 \
#     org.freedesktop.Sdk.Extension.rust-stable//25.08

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$REPO_DIR"

echo "==> Building frontend (pnpm)..."
pnpm install --frozen-lockfile
pnpm build

echo "==> Vendoring Cargo dependencies..."
rm -rf vendor
# cargo vendor reads the workspace from src-tauri/Cargo.toml and writes crates to vendor/
cargo vendor --manifest-path src-tauri/Cargo.toml vendor

echo "==> Building Flatpak (this will take a few minutes)..."
flatpak-builder \
  --force-clean \
  --install \
  --user \
  flatpak/build-dir \
  flatpak/org.htpclauncher.App.yml

echo ""
echo "Done. Launch with:"
echo "  flatpak run org.htpclauncher.App"
