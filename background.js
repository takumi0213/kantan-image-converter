/**
 * かんたん画像変換 - Service Worker (background.js)
 *
 * コンテキストメニュー管理、ダウンロード制御、エラーハンドリングを担当。
 * 画像の取得・変換は contentScriptConvert 関数を scripting.executeScript で
 * ページ内に注入して実行し、変換済み data URL を受け取ってダウンロードする。
 */

"use strict";

// ========================================================
// 定数
// ========================================================

/** 許可するURLスキーム */
const ALLOWED_SCHEMES = ["http:", "https:", "data:", "blob:"];

/** コンテキストメニューID */
const MENU_IDS = {
  PARENT: "kantan-image-parent",
  JPG: "kantan-image-jpg",
  PNG: "kantan-image-png",
  WEBP: "kantan-image-webp",
};

/** MIME タイプマッピング */
const FORMAT_CONFIG = {
  jpg: { mime: "image/jpeg", ext: ".jpg" },
  png: { mime: "image/png", ext: ".png" },
  webp: { mime: "image/webp", ext: ".webp" },
};

/** エラーバッジ表示時間 (ms) */
const ERROR_BADGE_DURATION = 4000;

// ========================================================
// 処理キュー（連続操作の競合回避）
// ========================================================

/** @type {Promise<void>} */
let processingQueue = Promise.resolve();

/**
 * キューに処理を追加して直列実行する。
 * @param {() => Promise<void>} task
 */
function enqueue(task) {
  processingQueue = processingQueue.then(task).catch((err) => {
    console.error("[かんたん画像変換] Queue error:", err);
  });
}

// ========================================================
// コンテキストメニュー登録
// ========================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_IDS.PARENT,
    title: "画像を変換して保存",
    contexts: ["image"],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.PNG,
    parentId: MENU_IDS.PARENT,
    title: "PNG として保存",
    contexts: ["image"],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.JPG,
    parentId: MENU_IDS.PARENT,
    title: "JPG として保存",
    contexts: ["image"],
  });

  chrome.contextMenus.create({
    id: MENU_IDS.WEBP,
    parentId: MENU_IDS.PARENT,
    title: "WebP として保存",
    contexts: ["image"],
  });
});

// ========================================================
// コンテキストメニュークリックハンドラ
// ========================================================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const formatKey = menuIdToFormat(info.menuItemId);
  if (!formatKey || !tab?.id) return;

  enqueue(() => handleImageSave(info, tab, formatKey));
});

/**
 * メニューIDからフォーマットキーを取得。
 * @param {string} menuItemId
 * @returns {string | null}
 */
function menuIdToFormat(menuItemId) {
  switch (menuItemId) {
    case MENU_IDS.JPG:
      return "jpg";
    case MENU_IDS.PNG:
      return "png";
    case MENU_IDS.WEBP:
      return "webp";
    default:
      return null;
  }
}

// ========================================================
// メイン処理
// ========================================================

/**
 * 画像の保存処理メインフロー。
 * @param {chrome.contextMenus.OnClickData} info
 * @param {chrome.tabs.Tab} tab
 * @param {string} formatKey - "jpg" | "png" | "webp"
 */
async function handleImageSave(info, tab, formatKey) {
  const srcUrl = info.srcUrl;

  // URLスキーム検証
  if (!isAllowedScheme(srcUrl)) {
    reportError("このURLスキームはサポートされていません。");
    return;
  }

  const config = FORMAT_CONFIG[formatKey];
  const filename = buildFilename(srcUrl, config.ext);

  try {
    // content script でキャンバス変換を試みる
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: contentScriptConvert,
      args: [srcUrl, config.mime],
    });

    const result = results?.[0]?.result;

    if (result && result.dataUrl) {
      // 変換成功 → data URL でダウンロード
      await downloadFile(result.dataUrl, filename);
    } else if (result && result.skipConversion) {
      // アニメーション画像 or SVG → 元画像をそのままダウンロード
      await downloadOriginal(srcUrl, buildFilename(srcUrl, getOriginalExt(srcUrl)));
    } else {
      // 変換失敗（CORS、Canvas エラー等）→ フォールバック: 元画像をそのままダウンロード
      if (result && result.error) {
        console.warn("[かんたん画像変換] Content script error:", result.error);
      }
      console.warn("[かんたん画像変換] Conversion failed, falling back to original download.");
      await downloadOriginal(srcUrl, filename);
    }
  } catch (err) {
    console.error("[かんたん画像変換] executeScript failed:", err);
    // content script 注入失敗 → フォールバック
    try {
      await downloadOriginal(srcUrl, filename);
    } catch (dlErr) {
      console.error("[かんたん画像変換] Fallback download also failed:", dlErr);
      reportError("画像の保存に失敗しました。");
    }
  }
}

// ========================================================
// Content Script (ページ内で実行される関数)
// ========================================================

/**
 * content script としてページ内で実行される。
 * 画像を取得し、Canvas で変換して data URL を返す。
 *
 * @param {string} srcUrl - 画像のURL
 * @param {string} targetMime - 変換先MIMEタイプ
 * @returns {Promise<{dataUrl?: string, skipConversion?: boolean, error?: string}>}
 */
async function contentScriptConvert(srcUrl, targetMime) {
  const QUALITY = 0.92;

  // --- アニメーション判定ヘルパー ---
  // function 宣言はホイスティングされるが、可読性のため先頭に配置する。

  /**
   * GIFがアニメーションかどうかをImage Descriptorブロック数で判定。
   * @param {Uint8Array} data
   * @returns {boolean}
   */
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
        const hasLct = (imgPacked >> 7) & 1;
        const lctSize = imgPacked & 0x07;
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

  /**
   * WebPがアニメーションかどうかをANIMチャンクで判定。
   * @param {Uint8Array} data
   * @returns {boolean}
   */
  function isAnimatedWebp(data) {
    if (data.length < 12) return false;
    const riff = String.fromCharCode(data[0], data[1], data[2], data[3]);
    const webp = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (riff !== "RIFF" || webp !== "WEBP") return false;

    let i = 12;
    while (i + 8 <= data.length) {
      const chunkId = String.fromCharCode(data[i], data[i + 1], data[i + 2], data[i + 3]);
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

  // --- メイン処理 ---

  try {
    let blob;

    if (srcUrl.startsWith("data:")) {
      const resp = await fetch(srcUrl);
      blob = await resp.blob();
    } else if (srcUrl.startsWith("blob:")) {
      const resp = await fetch(srcUrl);
      blob = await resp.blob();
    } else {
      const resp = await fetch(srcUrl, { mode: "cors" });
      if (!resp.ok) {
        return { error: `Fetch failed: ${resp.status}` };
      }
      blob = await resp.blob();
    }

    // --- SVG判定: 元のまま保存 ---
    if (blob.type === "image/svg+xml" || srcUrl.toLowerCase().endsWith(".svg")) {
      return { skipConversion: true };
    }

    // --- アニメーション判定 ---
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    if (isAnimatedGif(bytes) || isAnimatedWebp(bytes)) {
      return { skipConversion: true };
    }

    // --- Canvas変換 ---
    const imageBitmap = await createImageBitmap(new Blob([arrayBuf], { type: blob.type }));
    let convertedBlob;
    try {
      const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      // JPGは透過非対応のため白背景を描画
      if (targetMime === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(imageBitmap, 0, 0);

      convertedBlob = await canvas.convertToBlob({
        type: targetMime,
        quality: QUALITY,
      });
    } finally {
      imageBitmap.close();
    }

    // Blob → data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(convertedBlob);
    });

    return { dataUrl };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

// ========================================================
// ダウンロード
// ========================================================

/**
 * data URL をダウンロードする（名前を付けて保存ダイアログを表示）。
 * @param {string} dataUrl
 * @param {string} filename
 */
async function downloadFile(dataUrl, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: dataUrl, filename: filename, saveAs: true },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (downloadId === undefined) {
          console.info("[かんたん画像変換] Download cancelled by user.");
          resolve(undefined);
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

/**
 * 元画像URLをそのままダウンロードする（名前を付けて保存ダイアログを表示）。
 * @param {string} srcUrl
 * @param {string} filename
 */
async function downloadOriginal(srcUrl, filename) {
  // blob: は chrome.downloads.download で直接使えない
  if (srcUrl.startsWith("blob:")) {
    reportError("この画像は直接ダウンロードできません。");
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: srcUrl, filename: filename, saveAs: true },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (downloadId === undefined) {
          console.info("[かんたん画像変換] Download cancelled by user.");
          resolve(undefined);
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

// ========================================================
// ファイル名処理
// ========================================================

/**
 * URLからファイル名を構築する。
 * @param {string} srcUrl
 * @param {string} ext - 拡張子 (例: ".jpg")
 * @returns {string}
 */
function buildFilename(srcUrl, ext) {
  let baseName = extractBaseName(srcUrl);

  if (!baseName) {
    baseName = generateDatetimeFilename();
  }

  // 既存の拡張子を除去
  baseName = removeExtension(baseName);

  // サニタイズ
  baseName = sanitizeFilename(baseName);

  // サニタイズ後に空になった場合のフォールバック
  if (!baseName) {
    baseName = generateDatetimeFilename();
  }

  return baseName + ext;
}

/**
 * URLからベースファイル名を抽出する。
 * @param {string} srcUrl
 * @returns {string}
 */
function extractBaseName(srcUrl) {
  if (srcUrl.startsWith("data:") || srcUrl.startsWith("blob:")) {
    return "";
  }

  try {
    const url = new URL(srcUrl);
    const pathname = url.pathname;
    const lastSegment = pathname.split("/").pop();

    if (!lastSegment) return "";

    try {
      return decodeURIComponent(lastSegment);
    } catch {
      // 不正な%エンコーディング（例: %ZZ）の場合、デコードせずそのまま使用
      return lastSegment;
    }
  } catch {
    return "";
  }
}

/**
 * ファイル名から拡張子を除去する。
 * @param {string} filename
 * @returns {string}
 */
function removeExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0) {
    return filename.substring(0, lastDot);
  }
  return filename;
}

/**
 * ファイル名をサニタイズする。
 * パストラバーサル、null バイト、特殊文字を除去。
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  return (
    filename
      .replace(/\0/g, "")
      .replace(/[/\\]/g, "")
      .replace(/[<>:"|?*]/g, "")
      .replace(/^[\s.]+|[\s.]+$/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 200)
  );
}

/**
 * 日時ベースのファイル名を生成する (20260316_203823 形式)。
 * @returns {string}
 */
function generateDatetimeFilename() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${h}${min}${s}`;
}

/**
 * URLから元の拡張子を推定する。
 * 注意: クエリパラメータで形式を指定するURL（例: ?format=png）には対応しない。
 * その場合はフォールバック値 ".png" が使われる。
 * @param {string} srcUrl
 * @returns {string}
 */
function getOriginalExt(srcUrl) {
  try {
    if (srcUrl.startsWith("data:")) {
      const mimeMatch = srcUrl.match(/^data:image\/([\w+.-]+)/);
      if (mimeMatch) {
        const sub = mimeMatch[1].toLowerCase();
        if (sub === "jpeg") return ".jpg";
        if (sub === "svg+xml") return ".svg";
        return "." + sub;
      }
    }

    const url = new URL(srcUrl);
    const pathname = url.pathname.toLowerCase();
    const extMatch = pathname.match(/\.(jpe?g|png|gif|webp|svg|bmp|ico|avif)$/);
    if (extMatch) {
      return extMatch[0] === ".jpeg" ? ".jpg" : extMatch[0];
    }
  } catch {
    // ignore
  }
  return ".png";
}

// ========================================================
// URL検証
// ========================================================

/**
 * URLスキームが許可リストに含まれるか検証する。
 * @param {string} srcUrl
 * @returns {boolean}
 */
function isAllowedScheme(srcUrl) {
  if (!srcUrl) return false;

  for (const scheme of ALLOWED_SCHEMES) {
    if (srcUrl.startsWith(scheme)) return true;
  }
  return false;
}

// ========================================================
// エラー報告
// ========================================================

/**
 * エラーを報告する（バッジを一時的に赤化）。
 * @param {string} message
 */
function reportError(message) {
  console.error("[かんたん画像変換]", message);

  chrome.action.setBadgeBackgroundColor({ color: "#E24B4A" });
  chrome.action.setBadgeText({ text: "!" });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, ERROR_BADGE_DURATION);
}