#!/bin/bash
# build-dist.sh — 配布用ZIPを作成する共通スクリプト
#
# 使い方: scripts/build-dist.sh <version>
#   例: scripts/build-dist.sh v1.2.0
#
# かんたん画像変換 - Chrome extension to convert and save web images
# Copyright (C) 2026 takumi0213
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

set -eu

VERSION="${1:?Usage: build-dist.sh <version>}"

DIST_DIR="kantan-image-converter"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/icons" "$DIST_DIR/docs"

cp manifest.json "$DIST_DIR/"
cp background.js  "$DIST_DIR/"
cp icons/icon16.png  "$DIST_DIR/icons/"
cp icons/icon48.png  "$DIST_DIR/icons/"
cp icons/icon128.png "$DIST_DIR/icons/"
cp docs/popup.html "$DIST_DIR/docs/"
cp docs/popup.js   "$DIST_DIR/docs/"
cp docs/demo.html  "$DIST_DIR/docs/"
cp LICENSE         "$DIST_DIR/"

zip -r "kantan-image-converter-${VERSION}.zip" "$DIST_DIR"
echo "Created: kantan-image-converter-${VERSION}.zip"
