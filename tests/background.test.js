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
// isAnimatedGif / isAnimatedWebp
// background.js から再定義（純粋関数）
// =====================================================

function isAnimatedGif(data) {
  if (data.length < 6) return false;
  const sig = String.fromCharCode(data[0], data[1], data[2]);
  if (sig !== "GIF") return false;

  let frameCount = 0;
  let i = 6;

  if (i + 7 > data.length) return false;
  const packed = data[i + 4];
  const hasGct = (packed >> 7) & 1;
  const gctSize = packed & 0x07;
  i += 7;
  if (hasGct) {
    i += 3 * (1 << (gctSize + 1));
  }

  while (i < data.length) {
    const blockType = data[i];
    i++;

    if (blockType === 0x2c) {
      frameCount++;
      if (frameCount >= 2) return true;
      if (i + 9 > data.length) return false;
      const imgPacked = data[i + 8];
      const hasLct    = (imgPacked >> 7) & 1;
      const lctSize   = imgPacked & 0x07;
      i += 9;
      if (hasLct) {
        i += 3 * (1 << (lctSize + 1));
      }
      if (i >= data.length) return false;
      i++;
      while (i < data.length) {
        const subBlockSize = data[i];
        i++;
        if (subBlockSize === 0) break;
        i += subBlockSize;
      }
    } else if (blockType === 0x21) {
      if (i >= data.length) return false;
      i++;
      while (i < data.length) {
        const subBlockSize = data[i];
        i++;
        if (subBlockSize === 0) break;
        i += subBlockSize;
      }
    } else if (blockType === 0x3b) {
      break;
    } else {
      break;
    }
  }

  return false;
}

function isAnimatedWebp(data) {
  if (data.length < 12) return false;
  const riff = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const webp  = String.fromCharCode(data[8], data[9], data[10], data[11]);
  if (riff !== "RIFF" || webp !== "WEBP") return false;

  let i = 12;
  while (i + 8 <= data.length) {
    const chunkId =
      String.fromCharCode(data[i], data[i + 1], data[i + 2], data[i + 3]);
    const chunkSize =
      (data[i + 4] | (data[i + 5] << 8) | (data[i + 6] << 16) | (data[i + 7] << 24)) >>> 0;

    if (chunkId === "ANIM") {
      return true;
    }

    i += 8 + chunkSize;
    if (chunkSize % 2 !== 0) i++;
  }

  return false;
}

// ---- GIF バイナリ構築ヘルパー ----
// GIFヘッダー（GCTなし）: GIF89a + 論理スクリーン記述子（packed=0x00）
function makeGifHeader() {
  return [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x01, 0x00,                           // 幅 1
    0x01, 0x00,                           // 高さ 1
    0x00,                                 // packed: GCT無し
    0x00,                                 // 背景色インデックス
    0x00,                                 // ピクセルアスペクト比
  ];
}

// Image Descriptor ブロック（LCTなし、1x1）
// フレームデータ（最小: LZW最小符号サイズ + 終端サブブロック）
function makeGifFrame() {
  return [
    0x2c,             // Image Separator
    0x00, 0x00,       // Left
    0x00, 0x00,       // Top
    0x01, 0x00,       // 幅 1
    0x01, 0x00,       // 高さ 1
    0x00,             // packed: LCT無し
    0x02,             // LZW最小符号サイズ
    0x02,             // サブブロックサイズ
    0x4c, 0x01,       // 圧縮データ（最小）
    0x00,             // サブブロック終端
  ];
}

// GIF Trailer
function makeGifTrailer() {
  return [0x3b];
}

// ---- WebP バイナリ構築ヘルパー ----
// RIFFヘッダー（12バイト）: RIFF + ファイルサイズ(LE) + WEBP
function makeWebpHeader(fileSize) {
  const sz = fileSize - 8;
  return [
    0x52, 0x49, 0x46, 0x46,                                         // RIFF
    sz & 0xff, (sz >> 8) & 0xff, (sz >> 16) & 0xff, (sz >> 24) & 0xff, // サイズ
    0x57, 0x45, 0x42, 0x50,                                         // WEBP
  ];
}

// 任意のWebPチャンク（4文字ID + サイズ(LE) + ダミーデータ）
function makeWebpChunk(id, size) {
  const idBytes = id.split("").map((c) => c.charCodeAt(0));
  const data = new Array(size).fill(0x00);
  return [
    ...idBytes,
    size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff,
    ...data,
  ];
}

// =====================================================
// テストケース: isAnimatedGif
// =====================================================

group("isAnimatedGif", () => {
  // 空バッファ
  assertFalse("空バッファ は false",
    isAnimatedGif(new Uint8Array([])));

  // 短すぎる（6バイト未満）
  assertFalse("5バイトのバッファ は false",
    isAnimatedGif(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39])));

  // GIF署名なし
  assertFalse("GIF署名なし は false",
    isAnimatedGif(new Uint8Array([0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])));

  // GIF署名あるがヘッダー不足（< 13バイト）
  assertFalse("GIF署名あるがヘッダーが 12バイトで切れている は false",
    isAnimatedGif(new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      0x01, 0x00, 0x01, 0x00, 0x00, 0x00,  // 12バイトで終了
    ])));

  // 1フレームのみのGIF（静止画）
  const gif1frame = new Uint8Array([
    ...makeGifHeader(), ...makeGifFrame(), ...makeGifTrailer(),
  ]);
  assertFalse("1フレームの GIF は false", isAnimatedGif(gif1frame));

  // 2フレームのGIF → アニメーション
  const gif2frames = new Uint8Array([
    ...makeGifHeader(), ...makeGifFrame(), ...makeGifFrame(), ...makeGifTrailer(),
  ]);
  assertTrue("2フレームの GIF は true", isAnimatedGif(gif2frames));

  // 5フレームのGIF → アニメーション
  const gif5frames = new Uint8Array([
    ...makeGifHeader(),
    ...makeGifFrame(), ...makeGifFrame(), ...makeGifFrame(),
    ...makeGifFrame(), ...makeGifFrame(),
    ...makeGifTrailer(),
  ]);
  assertTrue("5フレームの GIF は true", isAnimatedGif(gif5frames));

  // GCT付き1フレーム（静止画）
  // packed = 0x80: GCT有り、gctSize=0 → GCT = 3*(1<<1) = 6バイト
  const gctHeader = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x01, 0x00, 0x01, 0x00,              // 幅・高さ
    0x80,                                // packed: GCT有り、size=0
    0x00, 0x00,                          // 背景色・アスペクト比
    0xff, 0xff, 0xff, 0x00, 0x00, 0x00,  // GCT (6バイト: 2色 × RGB)
  ];
  const gifGct1frame = new Uint8Array([...gctHeader, ...makeGifFrame(), ...makeGifTrailer()]);
  assertFalse("GCT付き 1フレームの GIF は false", isAnimatedGif(gifGct1frame));

  // LCT付き2フレーム → アニメーション
  // packed の bit7=1, size=0 → LCT = 6バイト
  const frameWithLct = [
    0x2c,
    0x00, 0x00, 0x00, 0x00,             // Left, Top
    0x01, 0x00, 0x01, 0x00,             // 幅・高さ
    0x80,                               // packed: LCT有り size=0
    0xff, 0xff, 0xff, 0x00, 0x00, 0x00, // LCT (6バイト)
    0x02,                               // LZW最小符号サイズ
    0x02, 0x4c, 0x01,                   // サブブロック
    0x00,                               // 終端
  ];
  const gifLct2frames = new Uint8Array([
    ...makeGifHeader(), ...frameWithLct, ...frameWithLct, ...makeGifTrailer(),
  ]);
  assertTrue("LCT付き 2フレームの GIF は true", isAnimatedGif(gifLct2frames));

  // 1フレーム途中で切れたバッファ（Image Descriptorの9バイトが不足）
  // 0x2c の後に 8バイトしかなく i+9 > length となるため false
  const gifTruncated = new Uint8Array([
    ...makeGifHeader(),
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, // 0x2c + 8バイト（9バイト不足）
  ]);
  assertFalse("フレームヘッダーが途中で切れたバッファ は false", isAnimatedGif(gifTruncated));
});

// =====================================================
// テストケース: isAnimatedWebp
// =====================================================

group("isAnimatedWebp", () => {
  // 空バッファ
  assertFalse("空バッファ は false",
    isAnimatedWebp(new Uint8Array([])));

  // 11バイト（12バイト未満）
  assertFalse("11バイトのバッファ は false",
    isAnimatedWebp(new Uint8Array(new Array(11).fill(0))));

  // RIFF署名なし
  const noRiff = new Uint8Array([
    0x50, 0x4e, 0x47, 0x00, // RIFF ではない
    0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
  assertFalse("RIFF署名なし は false", isAnimatedWebp(noRiff));

  // WEBP署名なし
  const noWebp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x00, 0x00, 0x00, 0x00,
    0x4a, 0x50, 0x45, 0x47, // "JPEG"
  ]);
  assertFalse("WEBP署名なし は false", isAnimatedWebp(noWebp));

  // RIFF/WEBP のみ（チャンクなし）= 12バイトちょうど
  const webpHeaderOnly = new Uint8Array(makeWebpHeader(12));
  assertFalse("RIFF/WEBP のみ（チャンクなし）は false", isAnimatedWebp(webpHeaderOnly));

  // ANIMチャンクなし（VP8のみ）
  const vp8Chunk = makeWebpChunk("VP8 ", 4);
  const webpVp8Only = new Uint8Array([...makeWebpHeader(12 + 8 + 4), ...vp8Chunk]);
  assertFalse("VP8チャンクのみの WebP は false", isAnimatedWebp(webpVp8Only));

  // ANIMチャンクあり（先頭チャンク）
  const animChunk = makeWebpChunk("ANIM", 6);
  const webpAnim = new Uint8Array([...makeWebpHeader(12 + 8 + 6), ...animChunk]);
  assertTrue("ANIMチャンクを含む WebP は true", isAnimatedWebp(webpAnim));

  // ANIMチャンクが後続（VP8X → ANIM）
  const vp8xChunk = makeWebpChunk("VP8X", 10);
  const animChunk2 = makeWebpChunk("ANIM", 6);
  const webpVp8xAnim = new Uint8Array([
    ...makeWebpHeader(12 + (8 + 10) + (8 + 6)),
    ...vp8xChunk, ...animChunk2,
  ]);
  assertTrue("VP8Xの後にANIMがある WebP は true", isAnimatedWebp(webpVp8xAnim));

  // チャンクデータ内に "ANIM" 文字列があっても誤検知しない
  // （チャンク境界外のデータは読まないことを確認）
  const fakeChunkData = [
    0x41, 0x4e, 0x49, 0x4d, // "ANIM" をデータとして含む
    0x00, 0x00,
  ];
  const fakeVp8 = [
    ...("VP8 ".split("").map((c) => c.charCodeAt(0))),
    fakeChunkData.length & 0xff, 0x00, 0x00, 0x00,
    ...fakeChunkData,
  ];
  const webpFakeAnim = new Uint8Array([
    ...makeWebpHeader(12 + 8 + fakeChunkData.length), ...fakeVp8,
  ]);
  assertFalse("チャンクデータ内の ANIM 文字列では true にならない", isAnimatedWebp(webpFakeAnim));

  // 奇数サイズチャンクのパディングを正しくスキップして次の ANIM を検出できる
  const oddVp8 = [
    ...("VP8 ".split("").map((c) => c.charCodeAt(0))),
    0x05, 0x00, 0x00, 0x00,       // サイズ 5（奇数）
    0x00, 0x00, 0x00, 0x00, 0x00, // データ 5バイト
    0x00,                          // パディング 1バイト
  ];
  const animChunk3 = makeWebpChunk("ANIM", 6);
  const webpOddPad = new Uint8Array([
    ...makeWebpHeader(12 + oddVp8.length + animChunk3.length),
    ...oddVp8, ...animChunk3,
  ]);
  assertTrue("奇数サイズチャンクの後にある ANIM を正しく検出できる", isAnimatedWebp(webpOddPad));
});

// =====================================================
// 結果
// =====================================================

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("─".repeat(40));

if (failed > 0) process.exit(1);
