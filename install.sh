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
curl --proto '=https' --tlsv1.2 -fSL "$base/$asset" -o "$stage/$asset"
curl --proto '=https' --tlsv1.2 -fsSL "$base/SHA256SUMS" -o "$stage/SHA256SUMS"
expected=$(awk -v name="$asset" '$2 == name {print $1}' "$stage/SHA256SUMS")
actual=$(shasum -a 256 "$stage/$asset" | awk '{print $1}')
[ -n "$expected" ] && [ "$actual" = "$expected" ] || { echo 'Checksum mismatch' >&2; exit 1; }
install_dir="${AEGIS_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$install_dir"
install -m 755 "$stage/$asset" "$install_dir/aegis.new"
mv -f "$install_dir/aegis.new" "$install_dir/aegis"
printf '\nInstalled: %s/aegis\nRun: %s/aegis\n' "$install_dir" "$install_dir"
case ":$PATH:" in *":$install_dir:"*) ;; *) printf 'Optional PATH: export PATH="%s:$PATH"\n' "$install_dir";; esac
