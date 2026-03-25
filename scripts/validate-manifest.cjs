#!/usr/bin/env node
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

check("action.default_popup が存在する",
  typeof manifest.action?.default_popup === "string" &&
  manifest.action.default_popup.length > 0);

// icons
const iconSizes = ["16", "48", "128"];
for (const size of iconSizes) {
  const iconPath = manifest.icons?.[size];
  check(`icons["${size}"] が定義されている`, typeof iconPath === "string");
  if (typeof iconPath === "string") {
    const abs = path.resolve(ROOT, iconPath);
    check(`icons["${size}"] ファイルが存在する (${iconPath})`, fs.existsSync(abs));
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
