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
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

set -eu

VERSION="${1:?Usage: build-dist.sh <version>}"

# スクリプト自身の場所からリポジトリルートへ移動
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

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
