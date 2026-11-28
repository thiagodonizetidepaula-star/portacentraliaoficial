#!/usr/bin/env bash
set -euo pipefail

project=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
vendor="$project/.agents/vendor"
target="$vendor/img2threejs"
origin=https://github.com/img2threejs/img2threejs.git
revision=0c0c49bc168e648dbaf9c8c080474de0b3a941b6

if [[ ! -e "$target" ]]; then
  mkdir -p "$vendor"
  staging=$(mktemp -d "$vendor/.img2threejs.XXXXXX")
  trap 'rm -rf -- "$staging"' EXIT
  git -C "$staging" init -q
  git -C "$staging" remote add origin "$origin"
  git -C "$staging" fetch -q --depth=1 origin "$revision"
  git -C "$staging" checkout -q --detach FETCH_HEAD
  mv -T -- "$staging" "$target"
fi

[[ -f "$target/SKILL.md" && $(git -C "$target" remote get-url origin) == "$origin" &&
   $(git -C "$target" rev-parse HEAD) == "$revision" && -z $(git -C "$target" status --porcelain) ]]
printf 'img2threejs v2.0.1 · %s\n' "$project/../.agents/skills/img2threejs"
