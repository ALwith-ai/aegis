#!/bin/sh
set -eu
repo=ALwith-ai/aegis
download() {
  download_source=$1
  download_destination=$2
  for download_attempt in 1 2 3 4; do
    download_url=$download_source
    if [ "$download_attempt" -gt 1 ]; then
      download_url="$download_source?aegis_retry=$(date +%s)-$$-$download_attempt"
    fi
    if curl --proto '=https' --tlsv1.2 --fail --location --progress-bar --connect-timeout 15 --max-time 900 "$download_url" -o "$download_destination"; then return 0; fi
    [ "$download_attempt" -eq 4 ] || sleep "$download_attempt"
  done
  echo 'Download failed after retries' >&2
  return 1
}
umask 077
credentials_dir="$HOME/.config/aegis"
credentials_file="$credentials_dir/credentials.json"
if [ -n "${AEGIS_TOKEN:-}" ]; then
  case "$AEGIS_TOKEN" in *[!a-zA-Z0-9_-]*) echo 'Invalid AEGIS_TOKEN format' >&2; exit 1;; esac
elif [ ! -s "$credentials_file" ]; then
  echo 'Pass your credential as AEGIS_TOKEN in the installation command.' >&2; exit 1
fi
[ "$(uname -s)" = Darwin ] || { echo 'Requires macOS 15+' >&2; exit 1; }
major=$(sw_vers -productVersion | cut -d. -f1)
[ "$major" -ge 15 ] || { echo 'Requires macOS 15+' >&2; exit 1; }
case "$(uname -m)" in arm64) arch=arm64;; x86_64) arch=x64;; *) echo 'Unsupported architecture' >&2; exit 1;; esac
asset="aegis-darwin-$arch"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
download "https://github.com/$repo/releases/latest/download/VERSION" "$stage/VERSION"
tag=$(tr -d '\r\n' < "$stage/VERSION")
case "$tag" in v[0-9]*.[0-9]*.[0-9]*) ;; *) echo 'Invalid release' >&2; exit 1;; esac
base="https://github.com/$repo/releases/download/$tag"
download "$base/$asset" "$stage/$asset"
download "$base/SHA256SUMS" "$stage/SHA256SUMS"
expected=$(awk -v name="$asset" '$2 == name {print $1}' "$stage/SHA256SUMS")
actual=$(shasum -a 256 "$stage/$asset" | awk '{print $1}')
[ -n "$expected" ] && [ "$actual" = "$expected" ] || { echo 'Checksum mismatch' >&2; exit 1; }
# DeepSeek Harness runtime (the investigation engine), same checks: pinned release tag, SHA256SUMS, then extract.
runtime_version=0.2.1rc2
runtime_dir="$HOME/.aegis/dsh/$runtime_version"
if [ ! -f "$runtime_dir/.complete" ]; then
  runtime_asset="dsh-runtime-$runtime_version-darwin-$arch.tar.gz"
  runtime_base="https://github.com/$repo/releases/download/dsh-runtime-$runtime_version"
  download "$runtime_base/$runtime_asset" "$stage/$runtime_asset"
  download "$runtime_base/SHA256SUMS" "$stage/RUNTIME_SHA256SUMS"
  expected=$(awk -v name="$runtime_asset" '$2 == name {print $1}' "$stage/RUNTIME_SHA256SUMS")
  actual=$(shasum -a 256 "$stage/$runtime_asset" | awk '{print $1}')
  [ -n "$expected" ] && [ "$actual" = "$expected" ] || { echo 'Runtime checksum mismatch' >&2; exit 1; }
  mkdir -p "$runtime_dir" && chmod 700 "$HOME/.aegis" "$HOME/.aegis/dsh" "$runtime_dir"
  rm -rf "$runtime_dir"/deepseek-harness-sdk-runtime-*
  tar -xzf "$stage/$runtime_asset" -C "$runtime_dir"
  chmod 755 "$runtime_dir"/deepseek-harness-sdk-runtime-*
  printf '%s' "$runtime_version" > "$runtime_dir/.complete"
fi
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
if [ -n "${AEGIS_TOKEN:-}" ]; then
  mkdir -p "$credentials_dir"
  chmod 700 "$credentials_dir"
  credential_tmp=$(mktemp "$credentials_dir/.credentials.XXXXXX")
  printf '{"token":"%s"}\n' "$AEGIS_TOKEN" > "$credential_tmp"
  chmod 600 "$credential_tmp"
  mv -f "$credential_tmp" "$credentials_file"
fi
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
