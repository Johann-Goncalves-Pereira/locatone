#!/usr/bin/env bash
# Install or update Locatone in Zen Browser (unsigned unpacked sideload).
#
# Usage:
#   ./extension/sync-zen.sh              # build, install, restart Zen if running
#   ./extension/sync-zen.sh --no-restart # write files only
#   ./extension/sync-zen.sh --restart    # force quit/relaunch even if already quit
#   ./extension/sync-zen.sh --profile /path/to/profile
#
# Typical workflow: edit extension code → run this script (restarts Zen when open).
# Uses an unpacked proxy install so updates do not clobber an open jar: XPI mapping.

set -euo pipefail

EXT_ID="locatone@local"
ZEN_APP="/Applications/Zen.app"
ZEN_BIN="$ZEN_APP/Contents/MacOS/zen"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$SCRIPT_DIR"
BUILD_DIR="$EXT_DIR/.build"
DO_RESTART=0
NO_RESTART=0
PROFILE_OVERRIDE=""
ZEN_SUPPORT="$HOME/Library/Application Support/zen"
PROFILE_DMG="$ZEN_SUPPORT/Profiles/Profile.dmg"
ENCRYPTED_MOUNT="/Volumes/.com.apple.zen.framework"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restart)
      DO_RESTART=1
      shift
      ;;
    --no-restart)
      NO_RESTART=1
      shift
      ;;
    --profile)
      PROFILE_OVERRIDE="${2:-}"
      if [[ -z "$PROFILE_OVERRIDE" ]]; then
        echo "error: --profile requires a path" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -x "$ZEN_BIN" ]]; then
  echo "error: Zen Browser not found at $ZEN_APP" >&2
  exit 1
fi

if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "error: missing manifest at $EXT_DIR/manifest.json" >&2
  exit 1
fi

zen_pids() {
  /bin/ps aux 2>/dev/null | /usr/bin/awk '
    /\/Applications\/Zen\.app\/Contents\/MacOS\/zen( |$)/ && $0 !~ /awk/ { print $2 }
  '
}

zen_is_running() {
  [[ -n "$(zen_pids)" ]]
}

resolve_running_profile() {
  /bin/ps aux 2>/dev/null | /usr/bin/awk '
    /\/Applications\/Zen\.app\/Contents\/MacOS\/zen / && /--profile/ {
      for (i = 1; i <= NF; i++) {
        if ($i == "--profile") {
          print $(i + 1)
          exit
        }
      }
    }
  '
}

resolve_profile_via_lsof() {
  local pid
  pid="$(zen_pids | /usr/bin/head -n1 || true)"
  [[ -n "$pid" ]] || return 1
  /usr/sbin/lsof -p "$pid" 2>/dev/null | /usr/bin/awk '
    /\/prefs\.js$/ {
      path=$NF
      sub(/\/prefs\.js$/, "", path)
      print path
      exit
    }
  '
}

wait_for_profile_ready() {
  local profile="$1"
  local attempts="${2:-40}"
  local i
  for i in $(seq 1 "$attempts"); do
    if [[ -f "$profile/prefs.js" && -d "$profile/extensions" ]]; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

is_encrypted_volume_mounted() {
  /sbin/mount 2>/dev/null | /usr/bin/grep -Fq " on $ENCRYPTED_MOUNT "
}

dmg_is_attached() {
  /usr/bin/hdiutil info 2>/dev/null | /usr/bin/grep -Fq "$PROFILE_DMG"
}

ensure_encrypted_profile_mounted() {
  if wait_for_profile_ready "$ENCRYPTED_MOUNT" 8; then
    return 0
  fi
  if [[ ! -f "$PROFILE_DMG" ]]; then
    return 1
  fi

  if is_encrypted_volume_mounted || dmg_is_attached; then
    if wait_for_profile_ready "$ENCRYPTED_MOUNT" 40; then
      return 0
    fi
  fi

  echo "Mounting Zen encrypted profile…"

  if [[ -d "$ENCRYPTED_MOUNT" ]] && ! is_encrypted_volume_mounted; then
    if [[ -z "$(/bin/ls -A "$ENCRYPTED_MOUNT" 2>/dev/null || true)" ]]; then
      /bin/rmdir "$ENCRYPTED_MOUNT" 2>/dev/null || true
    fi
  fi

  local i
  for i in 1 2 3 4 5 6 7 8; do
    if wait_for_profile_ready "$ENCRYPTED_MOUNT" 4; then
      return 0
    fi
    if is_encrypted_volume_mounted; then
      sleep 0.5
      continue
    fi
    if /usr/bin/hdiutil attach "$PROFILE_DMG" -mountpoint "$ENCRYPTED_MOUNT" -nobrowse >/dev/null 2>&1; then
      if wait_for_profile_ready "$ENCRYPTED_MOUNT" 20; then
        return 0
      fi
    fi
    sleep 0.75
  done

  [[ -f "$ENCRYPTED_MOUNT/prefs.js" ]]
}

resolve_profile() {
  if [[ -n "$PROFILE_OVERRIDE" ]]; then
    printf '%s\n' "$PROFILE_OVERRIDE"
    return
  fi
  if [[ -n "${ZEN_PROFILE:-}" ]]; then
    printf '%s\n' "$ZEN_PROFILE"
    return
  fi

  local running
  running="$(resolve_running_profile || true)"
  if [[ -n "$running" && -d "$running" ]]; then
    printf '%s\n' "$running"
    return
  fi

  running="$(resolve_profile_via_lsof || true)"
  if [[ -n "$running" && -d "$running" ]]; then
    printf '%s\n' "$running"
    return
  fi

  if ensure_encrypted_profile_mounted; then
    printf '%s\n' "$ENCRYPTED_MOUNT"
    return
  fi

  local ini="$ZEN_SUPPORT/profiles.ini"
  [[ -f "$ini" ]] || return 1
  local path="" relative=1
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      Path=*) path="${line#Path=}" ;;
      IsRelative=*) relative="${line#IsRelative=}" ;;
      \[Profile*\]|[General]|\[Install*)
        if [[ -n "$path" ]]; then
          break
        fi
        ;;
    esac
  done < "$ini"
  [[ -n "$path" ]] || return 1
  if [[ "$relative" == "1" ]]; then
    printf '%s\n' "$ZEN_SUPPORT/$path"
  else
    printf '%s\n' "$path"
  fi
}

ensure_unsigned_prefs() {
  local profile="$1"
  local user_js="$profile/user.js"
  local marker_begin="// locatone-zen-begin"
  local marker_end="// locatone-zen-end"
  local block

  block=$(cat <<EOF
$marker_begin
user_pref("xpinstall.signatures.required", false);
user_pref("extensions.autoDisableScopes", 14);
user_pref("extensions.enabledScopes", 15);
$marker_end
EOF
)

  mkdir -p "$profile"
  if [[ -f "$user_js" ]] && grep -q "$marker_begin" "$user_js"; then
    local tmp
    tmp="$(mktemp)"
    /usr/bin/awk -v begin="$marker_begin" -v end="$marker_end" '
      $0 == begin { skip=1; next }
      $0 == end { skip=0; next }
      !skip { print }
    ' "$user_js" > "$tmp"
    printf '%s\n' "$block" >> "$tmp"
    mv "$tmp" "$user_js"
  elif [[ -f "$user_js" ]]; then
    printf '\n%s\n' "$block" >> "$user_js"
  else
    printf '%s\n' "$block" > "$user_js"
  fi

  /bin/sync || true
}

build_unpacked() {
  local dest="$1"
  local base_version build_version

  base_version="$(
    /usr/bin/python3 -c 'import json,sys; print(".".join(json.load(open(sys.argv[1]))["version"].split(".")[:3]))' "$EXT_DIR/manifest.json"
  )"
  build_version="${base_version}.$(date +%Y%m%d%H%M%S)"

  rm -rf "$dest"
  mkdir -p "$dest"

  /usr/bin/rsync -a \
    --exclude '.build' \
    --exclude 'sync-zen.sh' \
    --exclude '.gitignore' \
    --exclude 'README.md' \
    --exclude '.DS_Store' \
    --exclude '*.xpi' \
    "$EXT_DIR/" "$dest/"

  /usr/bin/python3 - "$dest/manifest.json" "$build_version" <<'PY'
import json, sys
path, version = sys.argv[1], sys.argv[2]
data = json.load(open(path))
data["version"] = version
with open(path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
PY

  printf '%s\n' "$build_version"
}

quit_zen() {
  if ! zen_is_running; then
    return
  fi
  echo "Quitting Zen…"
  osascript -e 'tell application "Zen" to quit' >/dev/null 2>&1 || true

  local i
  for i in $(seq 1 80); do
    if ! zen_is_running; then
      sleep 1
      return
    fi
    sleep 0.25
  done

  echo "error: Zen did not quit in time; close it and re-run with --restart" >&2
  exit 1
}

start_zen() {
  local profile="$1"

  if [[ "$profile" == "$ENCRYPTED_MOUNT" ]]; then
    if ! ensure_encrypted_profile_mounted; then
      echo "error: could not mount $PROFILE_DMG" >&2
      echo "hint: open Zen yourself (so the encrypted profile unlocks), then re-run" >&2
      exit 1
    fi
  fi

  echo "Starting Zen with profile: $profile"
  # Launch the binary directly so --profile is honored for encrypted volumes.
  nohup "$ZEN_BIN" --profile "$profile" >/dev/null 2>&1 &
}

PROFILE="$(resolve_profile || true)"
if [[ -z "${PROFILE:-}" || ! -d "$PROFILE" ]]; then
  if [[ -f "$PROFILE_DMG" ]] && ensure_encrypted_profile_mounted; then
    PROFILE="$ENCRYPTED_MOUNT"
  fi
fi
if [[ -z "${PROFILE:-}" || ! -d "$PROFILE" ]]; then
  echo "error: could not resolve Zen profile directory" >&2
  echo "hint: open Zen first, or pass --profile /path/to/profile" >&2
  exit 1
fi

EXT_DIR_TARGET="$PROFILE/extensions"
PROXY_PATH="$EXT_DIR_TARGET/${EXT_ID}"
XPI_PATH="$EXT_DIR_TARGET/${EXT_ID}.xpi"
UNPACKED_DIR="$BUILD_DIR/unpacked"

echo "Profile:  $PROFILE"
echo "Source:   $EXT_DIR"

ensure_unsigned_prefs "$PROFILE"
mkdir -p "$BUILD_DIR" "$EXT_DIR_TARGET"

VERSION="$(build_unpacked "$UNPACKED_DIR")"

# Prefer unpacked proxy install so sync does not clobber an open jar: XPI mapping.
rm -f "$XPI_PATH"
printf '%s\n' "$UNPACKED_DIR" > "$PROXY_PATH"
/bin/sync || true

echo "Installed: $PROXY_PATH -> $UNPACKED_DIR"
echo "Version:   $VERSION"

# Overwriting a live jar-backed XPI breaks popup loads; restart whenever Zen is open.
SHOULD_RESTART=0
if [[ "$NO_RESTART" -eq 0 ]]; then
  if [[ "$DO_RESTART" -eq 1 ]] || zen_is_running; then
    SHOULD_RESTART=1
  fi
fi

if [[ "$SHOULD_RESTART" -eq 1 ]]; then
  quit_zen
  start_zen "$PROFILE"
  echo "Done. Zen restarted with Locatone $VERSION (unpacked)."
else
  echo "Done. Restart Zen to load Locatone $VERSION."
fi
