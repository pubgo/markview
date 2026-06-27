#!/usr/bin/env sh

set -eu

STAMP_FILE="node_modules/.markview-node-arch"
CURRENT_ARCH="$(pnpm node -p "process.platform + '-' + process.arch")"

if [ -d "node_modules" ]; then
  if [ ! -f "$STAMP_FILE" ]; then
    echo "markview: node_modules 缺少架构标记，执行一次清理重装 ($CURRENT_ARCH)"
    rm -rf node_modules
  else
    PREV_ARCH="$(cat "$STAMP_FILE" 2>/dev/null || true)"
    if [ "$PREV_ARCH" != "$CURRENT_ARCH" ]; then
      echo "markview: 检测到架构切换: $PREV_ARCH -> $CURRENT_ARCH，清理 node_modules 后重装"
      rm -rf node_modules
    fi
  fi
fi

pnpm install

mkdir -p "$(dirname "$STAMP_FILE")"
printf "%s\n" "$CURRENT_ARCH" > "$STAMP_FILE"
