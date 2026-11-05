#!/bin/sh
set -eu
repo=alwith-ai/aegis
[ "$(uname -s)" = Darwin ] || { echo 'Requires macOS 15+' >&2; exit 1; }
major=$(sw_vers -productVersion | cut -d. -f1)
[ "$major" -ge 15 ] || { echo 'Requires macOS 15+' >&2; exit 1; }
case "$(uname -m)" in arm64) arch=arm64;; x86_64) arch=x64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
asset="aegis-darwin-$arch"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
curl --proto '=https' --tlsv1.2 -fsSL "https://api.github.com/repos/$repo/releases/latest" -o "$stage/release.json"
tag=$(/usr/bin/plutil -extract tag_name raw -o - "$stage/release.json")
case "$tag" in v[0-9]*.[0-9]*.[0-9]*) ;; *) echo 'Invalid release' >&2; exit 1;; esac
base="https://github.com/$repo/releases/download/$tag"
curl --proto '=https' --tlsv1.2 -fSL --progress-bar "$base/$asset" -o "$stage/$asset"
curl --proto '=https' --tlsv1.2 -fsSL "$base/SHA256SUMS" -o "$stage/SHA256SUMS"
expected=$(awk -v name="$asset" '$2 == name {print $1}' "$stage/SHA256SUMS")
actual=$(shasum -a 256 "$stage/$asset" | awk '{print $1}')
[ -n "$expected" ] && [ "$actual" = "$expected" ] || { echo 'Checksum mismatch' >&2; exit 1; }
install_dir="${AEGIS_INSTALL_DIR:-}"
if [ -z "$install_dir" ]; then
  for candidate in "$HOME/.local/bin" "$HOME/.bun/bin" /opt/homebrew/bin /usr/local/bin; do
    case ":$PATH:" in
      *":$candidate:"*) if [ -d "$candidate" ] && [ -w "$candidate" ]; then install_dir=$candidate; break; fi ;;
    esac
  done
fi
install_dir="${install_dir:-$HOME/.local/bin}"
mkdir -p "$install_dir"
install -m 755 "$stage/$asset" "$install_dir/aegis.new"
mv -f "$install_dir/aegis.new" "$install_dir/aegis"
reopen=
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    # Quote arbitrary installation paths as literal shell strings.
    quoted_dir=$(printf '%s' "$install_dir" | sed "s/'/'\\\\''/g")
    case "${SHELL:-/bin/zsh}" in
      */bash) profile="$HOME/.bash_profile" ;;
      *) profile="${ZDOTDIR:-$HOME}/.zshrc" ;;
    esac
    entry="export PATH='$quoted_dir':\$PATH"
    if ! grep -Fqx "$entry" "$profile" 2>/dev/null; then
      printf '\n# Aegis\n%s\n' "$entry" >> "$profile"
    fi
    reopen=1
    ;;
esac
case "${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}" in
  zh*) printf '\nAegis 已安装。\n'; [ -z "$reopen" ] || printf '重新打开终端即可使用。\n'; printf '输入 aegis 开始。\n' ;;
  id*) printf '\nAegis terpasang.\n'; [ -z "$reopen" ] || printf 'Buka kembali terminal.\n'; printf 'Jalankan aegis untuk memulai.\n' ;;
  *) printf '\nAegis installed.\n'; [ -z "$reopen" ] || printf 'Reopen your terminal to use the command.\n'; printf 'Run aegis to start.\n' ;;
esac
