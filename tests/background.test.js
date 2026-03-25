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
  assertFalse("空文字を拒否",     isAllowedScheme(""));
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
});
 
group("removeExtension", () => {
  assert("拡張子を除去",        removeExtension("photo.jpg"),     "photo");
  assert("複数ドット",          removeExtension("my.photo.jpg"),  "my.photo");
  assert("拡張子なし",          removeExtension("noext"),         "noext");
  assert("先頭ドットは除去しない", removeExtension(".htaccess"), ".htaccess");
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
  assert("不明は .png",  getOriginalExt("https://example.com/img"),      ".png");
  assert("拡張子なし",   getOriginalExt("https://example.com/"),         ".png");
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
});
 
// =====================================================
// 結果
// =====================================================
 
console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("─".repeat(40));
 
if (failed > 0) process.exit(1);
