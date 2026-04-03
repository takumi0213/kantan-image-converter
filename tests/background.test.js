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

// =====================================================
// background.js から純粋関数を再定義してテスト
// Chrome APIに依存しない関数のみ対象
//
// 【注意】このファイルは background.js の純粋関数を「再定義」している。
// background.js 側の実装を変更した場合は、このファイルの対応する関数も
// 必ず同期すること。
//
// 別ファイルへの切り出しによる共有参照は行っていない。
// Manifest V3 の Service Worker は単一ファイル構成が基本であり、
// import / importScripts() の導入はアーキテクチャの複雑化を招くため、
// プロジェクトの設計方針（シンプルさの維持・外部依存の排除）と相容れない。
// =====================================================

// ---- 定数 ----
const ALLOWED_SCHEMES = ["http:", "https:", "data:", "blob:"];

// ---- テスト対象関数 ----

function menuIdToFormat(menuItemId) {
  switch (menuItemId) {
    case "kantan-image-jpg":  return "jpg";
    case "kantan-image-png":  return "png";
    case "kantan-image-webp": return "webp";
    default:                  return null;
  }
}

function isAllowedScheme(srcUrl) {
  if (!srcUrl) return false;
  for (const scheme of ALLOWED_SCHEMES) {
    if (srcUrl.startsWith(scheme)) return true;
  }
  return false;
}

function extractBaseName(srcUrl) {
  if (srcUrl.startsWith("data:") || srcUrl.startsWith("blob:")) return "";
  try {
    const url = new URL(srcUrl);
    const lastSegment = url.pathname.split("/").pop();
    if (!lastSegment) return "";
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  } catch {
    return "";
  }
}

function removeExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0) return filename.substring(0, lastDot);
  return filename;
}

function sanitizeFilename(filename) {
  return filename
    .replace(/\0/g, "")
    .replace(/[/\\]/g, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 200);
}

function generateDatetimeFilename() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  const h   = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s   = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${min}${s}`;
}

function getOriginalExt(srcUrl) {
  try {
    if (srcUrl.startsWith("data:")) {
      const mimeMatch = srcUrl.match(/^data:image\/([\w+.-]+)/);
      if (mimeMatch) {
        const sub = mimeMatch[1].toLowerCase();
        if (sub === "jpeg")    return ".jpg";
        if (sub === "svg+xml") return ".svg";
        return "." + sub;
      }
    }
    const url = new URL(srcUrl);
    const pathname = url.pathname.toLowerCase();
    const extMatch = pathname.match(/\.(jpe?g|png|gif|webp|svg|bmp|ico|avif)$/);
    if (extMatch) return extMatch[0] === ".jpeg" ? ".jpg" : extMatch[0];
  } catch {
    // ignore
  }
  return ".png";
}

function buildFilename(srcUrl, ext) {
  let baseName = extractBaseName(srcUrl);
  if (!baseName) baseName = generateDatetimeFilename();
  baseName = removeExtension(baseName);
  baseName = sanitizeFilename(baseName);
  if (!baseName) baseName = generateDatetimeFilename();
  return baseName + ext;
}

// =====================================================
// テストランナー（依存ゼロ）
// =====================================================

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual  : ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertMatch(description, actual, pattern) {
  if (pattern.test(actual)) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}`);
    console.error(`    expected to match: ${pattern}`);
    console.error(`    actual           : ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertTrue(description, value) {
  assert(description, value, true);
}

function assertFalse(description, value) {
  assert(description, value, false);
}

function group(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// =====================================================
// テストケース
// =====================================================

group("menuIdToFormat", () => {
  assert("jpg メニューID",  menuIdToFormat("kantan-image-jpg"),  "jpg");
  assert("png メニューID",  menuIdToFormat("kantan-image-png"),  "png");
  assert("webp メニューID", menuIdToFormat("kantan-image-webp"), "webp");
  assert("親メニューID は null", menuIdToFormat("kantan-image-parent"), null);
  assert("不明ID は null",       menuIdToFormat("unknown"),              null);
  assert("空文字は null",         menuIdToFormat(""),                    null);
});

group("isAllowedScheme", () => {
  assertTrue("http:// を許可",    isAllowedScheme("http://example.com/img.png"));
  assertTrue("https:// を許可",   isAllowedScheme("https://example.com/img.png"));
  assertTrue("data: を許可",      isAllowedScheme("data:image/png;base64,abc"));
  assertTrue("blob: を許可",      isAllowedScheme("blob:https://example.com/id"));
  assertFalse("chrome:// を拒否", isAllowedScheme("chrome://extensions/"));
  assertFalse("ftp:// を拒否",    isAllowedScheme("ftp://example.com/img.png"));
  assertFalse("null を拒否",      isAllowedScheme(null));
  assertFalse("undefined を拒否", isAllowedScheme(undefined));
  assertFalse("空文字を拒否",     isAllowedScheme(""));
  assertFalse("'http' コロンなしを拒否",  isAllowedScheme("http"));
  assertFalse("'data' コロンなしを拒否",  isAllowedScheme("data"));
  assertFalse("'https' コロンなしを拒否", isAllowedScheme("https"));
  assertFalse("javascript: を拒否",        isAllowedScheme("javascript:alert(1)"));
});

group("extractBaseName", () => {
  assert("通常URL",
    extractBaseName("https://example.com/path/photo.jpg"),
    "photo.jpg");
  assert("クエリ付きURL",
    extractBaseName("https://example.com/img.png?v=1"),
    "img.png");
  assert("data: は空文字",
    extractBaseName("data:image/png;base64,abc"),
    "");
  assert("blob: は空文字",
    extractBaseName("blob:https://example.com/id"),
    "");
  assert("パスなしURL",
    extractBaseName("https://example.com/"),
    "");
  assert("日本語ファイル名をデコード",
    extractBaseName("https://example.com/%E7%94%BB%E5%83%8F.png"),
    "画像.png");
  assert("不正%エンコードはそのまま返す",
    extractBaseName("https://example.com/%ZZ.png"),
    "%ZZ.png");
  assert("fragment は除去される",
    extractBaseName("https://example.com/img.png#section"),
    "img.png");
  assert("拡張子なしファイル名",
    extractBaseName("https://example.com/noext"),
    "noext");
  assert("ポート付きURL",
    extractBaseName("https://example.com:8080/img.png"),
    "img.png");
  assert("不正URL（new URL 例外）は空文字を返す",
    extractBaseName("not_a_url"),
    "");
});

group("removeExtension", () => {
  assert("拡張子を除去",        removeExtension("photo.jpg"),     "photo");
  assert("複数ドット",          removeExtension("my.photo.jpg"),  "my.photo");
  assert("拡張子なし",          removeExtension("noext"),         "noext");
  assert("先頭ドットは除去しない", removeExtension(".htaccess"), ".htaccess");
  assert("空文字はそのまま",    removeExtension(""),              "");
  assert("数字のみ",            removeExtension("12345"),         "12345");
  assert("末尾ドット",          removeExtension("file."),         "file");
  assert("先頭ドット+複数ドット", removeExtension(".config.json"), ".config");
});

group("sanitizeFilename", () => {
  assert("スラッシュを除去",            sanitizeFilename("path/to/file"),    "pathtofile");
  assert("バックスラッシュを除去",      sanitizeFilename("path\\file"),      "pathfile");
  assert("Windows禁止文字を除去",       sanitizeFilename('file<>:"|?*name'), "filename");
  assert("nullバイトを除去",            sanitizeFilename("fi\0le"),           "file");
  assert("先頭末尾の空白を除去",        sanitizeFilename("  file  "),         "file");
  assert("先頭末尾のドットを除去",      sanitizeFilename("..file.."),         "file");
  assert("スペースをアンダースコアに",  sanitizeFilename("my file"),          "my_file");
  assert("200文字制限",
    sanitizeFilename("a".repeat(250)).length,
    200);
  assert("正常な文字列はそのまま",      sanitizeFilename("normal_file-1"),    "normal_file-1");
  assert("空文字はそのまま空文字",       sanitizeFilename(""),                 "");
  assert("全禁止文字は空文字になる",     sanitizeFilename("/\\<>:|?*"),        "");
  assert("先頭末尾のアンダースコアは除去しない", sanitizeFilename("_file_"),  "_file_");
  assert("タブはアンダースコアに",       sanitizeFilename("a\tb"),             "a_b");
  assert("複合ケース（null+スラッシュ+スペース）", sanitizeFilename("\0fi/le  name"), "file_name");
  assert("連続スペースは単一_に",         sanitizeFilename("a  b"),             "a_b");
  assert("先頭ドット空白の混在トリム",    sanitizeFilename(". file."),          "file");
});

group("generateDatetimeFilename", () => {
  const name = generateDatetimeFilename();
  assertMatch("YYYYMMDD_HHMMSS 形式", name, /^\d{8}_\d{6}$/);
  assert("15文字の固定長", name.length, 15);
});

group("getOriginalExt", () => {
  assert(".jpg URL",     getOriginalExt("https://example.com/img.jpg"),  ".jpg");
  assert(".jpeg URL",    getOriginalExt("https://example.com/img.jpeg"), ".jpg");
  assert(".png URL",     getOriginalExt("https://example.com/img.png"),  ".png");
  assert(".gif URL",     getOriginalExt("https://example.com/img.gif"),  ".gif");
  assert(".webp URL",    getOriginalExt("https://example.com/img.webp"), ".webp");
  assert(".svg URL",     getOriginalExt("https://example.com/img.svg"),  ".svg");
  assert(".avif URL",    getOriginalExt("https://example.com/img.avif"), ".avif");
  assert("data:jpeg",    getOriginalExt("data:image/jpeg;base64,abc"),   ".jpg");
  assert("data:png",     getOriginalExt("data:image/png;base64,abc"),    ".png");
  assert("data:svg+xml", getOriginalExt("data:image/svg+xml;base64,a"),  ".svg");
  assert("data:gif",     getOriginalExt("data:image/gif;base64,abc"),    ".gif");
  assert("data:webp",    getOriginalExt("data:image/webp;base64,abc"),   ".webp");
  assert("不明は .png",  getOriginalExt("https://example.com/img"),      ".png");
  assert("拡張子なし",   getOriginalExt("https://example.com/"),         ".png");
  assert(".bmp URL",     getOriginalExt("https://example.com/img.bmp"),  ".bmp");
  assert(".ico URL",     getOriginalExt("https://example.com/img.ico"),  ".ico");
  assert("blob: は .png", getOriginalExt("blob:https://example.com/id"), ".png");
  assert("クエリ付きURLでも拡張子を正しく取得", getOriginalExt("https://example.com/img.png?v=1"), ".png");
  assert("data:text/plain は .png フォールバック", getOriginalExt("data:text/plain;base64,abc"), ".png");
  assert("fragment付きURLでも拡張子を正しく取得", getOriginalExt("https://example.com/img.png#sec"), ".png");
  assert("大文字拡張子 .PNG も認識",             getOriginalExt("https://example.com/img.PNG"),   ".png");
  assert("data:JPEG 大文字MIMEも .jpg に正規化",  getOriginalExt("data:image/JPEG;base64,abc"),   ".jpg");
  assert("data:avif",                             getOriginalExt("data:image/avif;base64,abc"),   ".avif");
  assert("非対応拡張子(.tiff)は .png フォールバック", getOriginalExt("https://example.com/img.tiff"), ".png");
  assert("data:image/未知MIMEは .mime をそのまま返す", getOriginalExt("data:image/unknown;base64,abc"), ".unknown");
  assert("不正URL（new URL 例外）は .png フォールバック", getOriginalExt("not_a_url"),                  ".png");
});

group("buildFilename", () => {
  assert("通常URL",
    buildFilename("https://example.com/photo.jpg", ".png"),
    "photo.png");
  assert("クエリ付きURL",
    buildFilename("https://example.com/image.png?w=100", ".jpg"),
    "image.jpg");
  assert("スペースをアンダースコアに変換",
    buildFilename("https://example.com/my%20photo.jpg", ".webp"),
    "my_photo.webp");
  // data: URL はタイムスタンプ形式になることを確認
  assertMatch("data: URL → タイムスタンプ形式",
    buildFilename("data:image/png;base64,abc", ".png"),
    /^\d{8}_\d{6}\.png$/);
  assertMatch("blob: URL → タイムスタンプ形式",
    buildFilename("blob:https://example.com/id", ".jpg"),
    /^\d{8}_\d{6}\.jpg$/);
  // サニタイズ後に空になる場合はタイムスタンプ形式になる
  assertMatch("サニタイズ後に空になる URL → タイムスタンプ形式",
    buildFilename("https://example.com/...", ".png"),
    /^\d{8}_\d{6}\.png$/);
  assertMatch("fragment付きURL → fragmentは除去されてファイル名を取得",
    buildFilename("https://example.com/img.jpg#section", ".png"),
    /^img\.png$/);
  assertMatch("ポート付きURL → 正しくファイル名を取得",
    buildFilename("https://example.com:8080/photo.jpg", ".png"),
    /^photo\.png$/);
  assert("日本語ファイル名",
    buildFilename("https://example.com/%E7%94%BB%E5%83%8F.png", ".jpg"),
    "画像.jpg");
  assertMatch("200文字超ベース名は切り捨てられ拡張子が付く",
    buildFilename("https://example.com/" + "a".repeat(250) + ".png", ".jpg"),
    /^a{200}\.jpg$/);
});

// =====================================================
// テレメトリ (sendTelemetry) バリデーションのテスト
// background.js から定数・バリデーションロジックを再定義してテスト
// =====================================================

// ---- テレメトリ定数（background.js と同期すること）----
const ALLOWED_EVENTS_T  = new Set(["conversion_result", "conversion_error"]);
const ALLOWED_FORMATS_T = new Set(["jpg", "png", "webp"]);
const ALLOWED_RESULTS_T = new Set(["success", "fallback", "error"]);
const ALLOWED_REASONS_T = new Set([
  "unsupported_scheme",
  "execute_script_failed",
  "content_script_error",
  "canvas_error",
  "cors",
  "download_failed",
  "fallback_download_failed",
  "unknown",
]);
const FORBIDDEN_KEYS_T = [
  "url", "src", "srcUrl", "tab", "tabUrl", "filename",
  "message", "errorMessage", "sessionId", "userId", "clientId",
];

/**
 * sendTelemetry のバリデーションロジックを再現して「送信可否」を返す純粋関数。
 * 実際の fetch は行わず、バリデーション結果のみを検証する。
 * @returns {boolean} true = 送信される / false = バリデーションで弾かれる
 */
function validateTelemetry(eventName, params) {
  if (!ALLOWED_EVENTS_T.has(eventName)) return false;
  // params の型チェック（background.js の sendTelemetry / telemetry/worker.js と同期すること）
  if (!params || typeof params !== "object" || Array.isArray(params)) return false;
  if (params.format === undefined || params.extension_version === undefined) return false;
  if (!ALLOWED_FORMATS_T.has(params.format)) return false;
  if (!/^\d+\.\d+\.\d+$/.test(params.extension_version)) return false;
  if (eventName === "conversion_result") {
    if (!ALLOWED_RESULTS_T.has(params.result)) return false;
  }
  if (eventName === "conversion_error") {
    if (!ALLOWED_REASONS_T.has(params.reason)) return false;
  }
  for (const key of FORBIDDEN_KEYS_T) {
    if (key in params) return false;
  }
  return true;
}

// ---- テレメトリテスト ----

group("telemetry: conversion_result バリデーション", () => {
  assertTrue("success / jpg",
    validateTelemetry("conversion_result", { format: "jpg",  result: "success",  extension_version: "1.1.0" }));
  assertTrue("fallback / png",
    validateTelemetry("conversion_result", { format: "png",  result: "fallback", extension_version: "1.1.0" }));
  assertTrue("error / webp",
    validateTelemetry("conversion_result", { format: "webp", result: "error",    extension_version: "1.1.0" }));
  assertFalse("不正イベント名は弾く",
    validateTelemetry("page_view", { format: "jpg", result: "success", extension_version: "1.1.0" }));
  assertFalse("不正 format は弾く",
    validateTelemetry("conversion_result", { format: "bmp", result: "success", extension_version: "1.1.0" }));
  assertFalse("不正 result は弾く",
    validateTelemetry("conversion_result", { format: "jpg", result: "unknown", extension_version: "1.1.0" }));
  assertFalse("不正 extension_version は弾く",
    validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "abc" }));
  assertFalse("format 未定義は弾く",
    validateTelemetry("conversion_result", { result: "success", extension_version: "1.1.0" }));
  assertFalse("result 未定義は弾く",
    validateTelemetry("conversion_result", { format: "jpg", extension_version: "1.1.0" }));
  assertFalse("extension_version 未定義は弾く",
    validateTelemetry("conversion_result", { format: "jpg", result: "success" }));
  assertFalse("params が null は弾く",
    validateTelemetry("conversion_result", null));
  assertFalse("params が undefined は弾く",
    validateTelemetry("conversion_result", undefined));
  assertFalse("params が配列は弾く",
    validateTelemetry("conversion_result", ["jpg", "success"]));
});

group("telemetry: conversion_error バリデーション", () => {
  assertTrue("cors",
    validateTelemetry("conversion_error", { format: "jpg", reason: "cors", extension_version: "1.1.0" }));
  assertTrue("canvas_error",
    validateTelemetry("conversion_error", { format: "png", reason: "canvas_error", extension_version: "1.1.0" }));
  assertTrue("unknown",
    validateTelemetry("conversion_error", { format: "webp", reason: "unknown", extension_version: "1.1.0" }));
  assertFalse("定義外 reason は弾く",
    validateTelemetry("conversion_error", { format: "jpg", reason: "network_error", extension_version: "1.1.0" }));
  assertFalse("reason 未定義は弾く",
    validateTelemetry("conversion_error", { format: "jpg", extension_version: "1.1.0" }));
});

group("telemetry: プライバシー - 禁止フィールド未送信", () => {
  assertFalse("url フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      url: "https://example.com/img.png",
    }));
  assertFalse("srcUrl フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      srcUrl: "https://example.com/img.png",
    }));
  assertFalse("filename フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      filename: "photo.jpg",
    }));
  assertFalse("errorMessage フィールドは弾く",
    validateTelemetry("conversion_error", {
      format: "jpg", reason: "unknown", extension_version: "1.1.0",
      errorMessage: "some error text",
    }));
  assertFalse("userId フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      userId: "user123",
    }));
  assertFalse("sessionId フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      sessionId: "sess_abc",
    }));
  assertFalse("tabUrl フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      tabUrl: "https://example.com/page",
    }));
  assertFalse("src フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      src: "https://example.com/img.png",
    }));
  assertFalse("tab フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      tab: { id: 1 },
    }));
  assertFalse("message フィールドは弾く",
    validateTelemetry("conversion_error", {
      format: "jpg", reason: "unknown", extension_version: "1.1.0",
      message: "some error",
    }));
  assertFalse("clientId フィールドは弾く",
    validateTelemetry("conversion_result", {
      format: "jpg", result: "success", extension_version: "1.1.0",
      clientId: "abc123",
    }));
});

group("telemetry: extension_version 形式検証", () => {
  assertTrue("1.0.0",   validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "1.0.0" }));
  assertTrue("1.10.0",  validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "1.10.0" }));
  assertFalse("1.0",    validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "1.0" }));
  assertFalse("v1.0.0", validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "v1.0.0" }));
  assertFalse("任意文字列", validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "any_string_here" }));
  assertFalse("空文字", validateTelemetry("conversion_result", { format: "jpg", result: "success", extension_version: "" }));
});

group("telemetry: 全 reason 値が定義済み", () => {
  const reasons = [
    "unsupported_scheme", "execute_script_failed", "content_script_error",
    "canvas_error", "cors", "download_failed", "fallback_download_failed", "unknown",
  ];
  for (const reason of reasons) {
    assertTrue(`reason=${reason} は有効`,
      validateTelemetry("conversion_error", { format: "jpg", reason, extension_version: "1.1.0" }));
  }
  assertFalse("定義外 reason は無効",
    validateTelemetry("conversion_error", { format: "jpg", reason: "new_reason", extension_version: "1.1.0" }));
});

// =====================================================
// 結果
// =====================================================

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("─".repeat(40));

if (failed > 0) process.exit(1);
