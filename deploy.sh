#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT="ios/App/App.xcodeproj"
SCHEME="App"
ARCHIVE_PATH="/tmp/RunCart.xcarchive"
EXPORT_PATH="/tmp/RunCart-export"
EXPORT_OPTIONS="$(pwd)/ExportOptions.plist"

# App Store Connect API key (set these or export them in your shell profile)
ASC_KEY_ID="${ASC_KEY_ID:-}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-}"
ASC_KEY_PATH="${ASC_KEY_PATH:-}"   # path to the .p8 file

# ── Preflight checks ──────────────────────────────────────────────────────────
if [[ -z "$ASC_KEY_ID" || -z "$ASC_ISSUER_ID" || -z "$ASC_KEY_PATH" ]]; then
  echo "❌  Set ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY_PATH before running."
  echo "    export ASC_KEY_ID=XXXXXXXXXX"
  echo "    export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  echo "    export ASC_KEY_PATH=~/AuthKey_XXXXXXXXXX.p8"
  exit 1
fi

# ── Build web + sync ──────────────────────────────────────────────────────────
echo "▶ Building web assets..."
npm run build

echo "▶ Syncing to iOS..."
npx cap sync ios

# ── Bump build number ─────────────────────────────────────────────────────────
NEW_BUILD=$(date +%Y%m%d%H%M)
echo "▶ Setting build number → $NEW_BUILD"
cd ios/App
agvtool new-version -all "$NEW_BUILD"
cd ../..

# ── Unlock keychain ───────────────────────────────────────────────────────────
echo "▶ Unlocking keychain..."
security unlock-keychain ~/Library/Keychains/login.keychain-db
security set-key-partition-list -S apple-tool:,apple: -s ~/Library/Keychains/login.keychain-db 2>/dev/null || true

# ── Archive ───────────────────────────────────────────────────────────────────
echo "▶ Archiving..."
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

xcodebuild archive \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  | xcpretty || cat /tmp/RunCart-xcodebuild.log 2>/dev/null

# ── Export + upload ───────────────────────────────────────────────────────────
echo "▶ Exporting and uploading to TestFlight..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo ""
echo "✅  Done! Build $NEW_BUILD uploaded to TestFlight."
echo "    It will appear in App Store Connect in a few minutes."
