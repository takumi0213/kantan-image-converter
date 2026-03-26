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
  // リロード時に古いメニューが残らないよう全削除してから再作成
  chrome.contextMenus.removeAll(() => {
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
    showError("このURLスキームはサポートされていません。");
    return;
  }

  const config = FORMAT_CONFIG[formatKey];
  const filename = buildFilename(srcUrl, config.ext);

  // chrome-extension://, chrome://, edge://, about: 等ではスクリプト注入不可
  // 変換せず元画像をそのままダウンロードする
  const tabUrl = tab.url || "";
  if (/^(chrome|edge|about|devtools)/i.test(tabUrl)) {
    try {
      await downloadOriginal(srcUrl, filename);
    } catch {
      showError("画像の保存に失敗しました。");
    }
    return;
  }

  try {
    // content script でキャンバス変換を試みる（デフォルトの ISOLATED world で実行）
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
    // フォールバック: 元画像をそのままダウンロード
    try {
      await downloadOriginal(srcUrl, filename);
    } catch (dlErr) {
      console.error("[かんたん画像変換] Fallback download also failed:", dlErr);
      showError("画像の保存に失敗しました。");
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

  /**
   * 画像を読み込んで HTMLImageElement を返す。
   * ページ内の <img> 要素を探し、見つからなければ新規作成して読み込む。
   * @param {string} url
   * @returns {Promise<HTMLImageElement>}
   */
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      // ページ内の <img> 要素からsrcが一致するものを探す
      const existingImg = document.querySelector(`img[src="${CSS.escape(url)}"]`);
      if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
        resolve(existingImg);
        return;
      }

      // 見つからない場合は新規作成（data URI, blob URL, または検索ヒットなし）
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
  }

  // --- メイン処理 ---

  try {
    // --- SVG判定: 元のまま保存 ---
    if (srcUrl.toLowerCase().endsWith(".svg") ||
        srcUrl.startsWith("data:image/svg+xml")) {
      return { skipConversion: true };
    }

    // --- アニメーション判定（バイナリチェックが必要なので fetch を試みる）---
    let isAnimated = false;
    try {
      const resp = await fetch(srcUrl);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);

        // SVG追加チェック（Content-Typeベース）
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("svg")) {
          return { skipConversion: true };
        }

        if (isAnimatedGif(bytes) || isAnimatedWebp(bytes)) {
          isAnimated = true;
        }
      }
    } catch {
      // fetch失敗（CORS等）→ アニメーション判定をスキップして変換を試みる
    }

    if (isAnimated) {
      return { skipConversion: true };
    }

    // --- Canvas変換 ---
    // ページ内の <img> 要素を利用して描画（CORS制限を回避）
    const img = await loadImage(srcUrl);

    const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // JPGは透過非対応のため白背景を描画
    if (targetMime === "image/jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    const convertedBlob = await canvas.convertToBlob({
      type: targetMime,
      quality: QUALITY,
    });

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
    showError("この画像は直接ダウンロードできません。");
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
function showError(message) {
  console.error("[かんたん画像変換]", message);

  chrome.action.setBadgeBackgroundColor({ color: "#E24B4A" });
  chrome.action.setBadgeText({ text: "!" });

  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, ERROR_BADGE_DURATION);
}
