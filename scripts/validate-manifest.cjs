#!/usr/bin/env node
// かんたん画像変換 - Chrome extension to convert and save web images
// Copyright (C) 2026 takumi0213
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
"use strict";

/**
 * manifest.json 検証スクリプト
 * CI から呼び出し、条件を満たさない場合は exit(1) で失敗する。
 */

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.resolve(__dirname, "../manifest.json");
const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function check(description, condition) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}`);
    failed++;
  }
}

// ---- manifest.json 読み込み ----
let manifest;
try {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  manifest = JSON.parse(raw);
} catch (err) {
  console.error(`Failed to read manifest.json: ${err.message}`);
  process.exit(1);
}

console.log("manifest.json validation\n");

// ---- 検証 ----

check("manifest_version === 3",
  manifest.manifest_version === 3);

check("background.service_worker が存在する",
  typeof manifest.background?.service_worker === "string" &&
  manifest.background.service_worker.length > 0);

const swPath = manifest.background?.service_worker;
if (typeof swPath === "string" && swPath.length > 0) {
  const swAbs = path.resolve(ROOT, swPath);
  const swIsFile = (() => { try { return fs.statSync(swAbs).isFile(); } catch { return false; } })();
  check(`background.service_worker ファイルが存在する (${swPath})`, swIsFile);
}

check("action.default_popup が存在する",
  typeof manifest.action?.default_popup === "string" &&
  manifest.action.default_popup.length > 0);

const popupPath = manifest.action?.default_popup;
if (typeof popupPath === "string" && popupPath.length > 0) {
  const popupAbs = path.resolve(ROOT, popupPath);
  const popupIsFile = (() => { try { return fs.statSync(popupAbs).isFile(); } catch { return false; } })();
  check(`action.default_popup ファイルが存在する (${popupPath})`, popupIsFile);
}

// icons
const iconSizes = ["16", "48", "128"];
for (const size of iconSizes) {
  const iconPath = manifest.icons?.[size];
  check(`icons["${size}"] が定義されている`, typeof iconPath === "string" && iconPath.length > 0);
  if (typeof iconPath === "string" && iconPath.length > 0) {
    const abs = path.resolve(ROOT, iconPath);
    const isFile = (() => { try { return fs.statSync(abs).isFile(); } catch { return false; } })();
    check(`icons["${size}"] ファイルが存在する (${iconPath})`, isFile);
  }
}

// 必須権限
const REQUIRED_PERMISSIONS = ["contextMenus", "downloads", "activeTab", "scripting"];
const permissions = manifest.permissions ?? [];
for (const perm of REQUIRED_PERMISSIONS) {
  check(`permissions に "${perm}" が含まれる`, permissions.includes(perm));
}

// host_permissions が使われていないこと（セキュリティ要件）
check("host_permissions が使用されていない",
  !manifest.host_permissions || manifest.host_permissions.length === 0);

// ---- 結果 ----
console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("─".repeat(40));

if (failed > 0) process.exit(1);
