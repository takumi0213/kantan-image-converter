// かんたん画像変換 - Browser extension to convert and save web images
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
  JPG:    "kantan-image-jpg",
  PNG:    "kantan-image-png",
  WEBP:   "kantan-image-webp",
};

/** MIME タイプマッピング */
const FORMAT_CONFIG = {
  jpg:  { mime: "image/jpeg", ext: ".jpg" },
  png:  { mime: "image/png",  ext: ".png" },
  webp: { mime: "image/webp", ext: ".webp" },
};

/** エラーバッジ表示時間 (ms) */
const ERROR_BADGE_DURATION = 4000;

// ========================================================
// テレメトリ定数
// ========================================================

/**
 * テレメトリ送信先 (Cloudflare Worker プロキシ)
 * api_secret は Worker の環境変数に保管するため、このファイルには含まれない。
 */
const TELEMETRY_ENDPOINT = "https://telemetry.takumi0213.com";

/** 送信を許可するイベント名 */
const ALLOWED_EVENTS  = new Set(["conversion_result", "conversion_error"]);
/** 送信を許可する format 値 */
const ALLOWED_FORMATS = new Set(["jpg", "png", "webp"]);
/** 送信を許可する result 値 */
const ALLOWED_RESULTS = new Set(["success", "fallback", "error"]);
/** 送信を許可する reason 値 */
const ALLOWED_REASONS = new Set([
  "unsupported_scheme",
  "execute_script_failed",
  "content_script_error", // 仕様定義済み。現時点では送信パスなし（将来の拡張用）
  "canvas_error",
  "cors",
  "download_failed",
  "fallback_download_failed",
  "unknown",
]);
/** テレメトリパラメータに含めてはいけないフィールド名 */
const FORBIDDEN_KEYS = [
  "url", "src", "srcUrl", "tab", "tabUrl", "filename",
  "message", "errorMessage", "sessionId", "userId", "clientId",
];

// ========================================================
// テレメトリ
// ========================================================

/**
 * GA4 Measurement Protocol でイベントを非同期送信する。
 * 送信失敗は完全無視する（機能優先）。
 * 禁止データ（URL・ファイル名・識別子・任意文字列）は一切送信しない。
 *
 * @param {"conversion_result"|"conversion_error"} eventName
 * @param {Object} params
 * @param {string}  params.format             - "jpg" | "png" | "webp"
 * @param {string} [params.result]            - "success" | "fallback" | "error"  (conversion_result のみ)
 * @param {string} [params.reason]            - ALLOWED_REASONS のいずれか          (conversion_error のみ)
 * @param {string}  params.extension_version  - manifest.json の version 文字列
 */
function sendTelemetry(eventName, params) {
  // --- バリデーション ---

  // イベント名
  if (!ALLOWED_EVENTS.has(eventName)) return;

  // params の型チェック（null/undefined/非オブジェクト/配列は弾く）
  // telemetry/worker.js の同一チェックと同期すること
  if (!params || typeof params !== "object" || Array.isArray(params)) return;

  // 必須フィールドの存在確認
  if (params.format === undefined || params.extension_version === undefined) return;

  // format
  if (!ALLOWED_FORMATS.has(params.format)) return;

  // extension_version: セマンティックバージョン形式のみ許可（任意文字列ブロック）
  if (!/^\d+\.\d+\.\d+$/.test(params.extension_version)) return;

  // conversion_result 固有
  if (eventName === "conversion_result") {
    if (!ALLOWED_RESULTS.has(params.result)) return;
  }

  // conversion_error 固有
  if (eventName === "conversion_error") {
    if (!ALLOWED_REASONS.has(params.reason)) return;
  }

  // 禁止フィールドが含まれていないことを確認
  for (const key of FORBIDDEN_KEYS) {
    if (key in params) return;
  }

  // --- ペイロード構築（許可フィールドのみ）---
  // Worker 側で client_id 等を付加するため、ここではイベント情報のみ組み立てる
  const eventParams = { extension_version: params.extension_version };

  if (eventName === "conversion_result") {
    eventParams.format = params.format;
    eventParams.result = params.result;
  } else if (eventName === "conversion_error") {
    eventParams.format = params.format;
    eventParams.reason = params.reason;
  }

  // --- 非同期送信（try-catch で本処理に影響させない）---
  try {
    fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, params: eventParams }),
      keepalive: true, // Service Worker 終了後も送信を完了させる
    }).catch(() => {
      // 送信失敗は完全無視
    });
  } catch {
    // fetch 自体の例外も完全無視
  }
}

/**
 * manifest.json から拡張機能バージョンを取得する。
 * @returns {string}
 */
function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}

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
    case MENU_IDS.JPG:  return "jpg";
    case MENU_IDS.PNG:  return "png";
    case MENU_IDS.WEBP: return "webp";
    default:            return null;
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
  const srcUrl  = info.srcUrl;
  const version = getExtensionVersion();

  // URLスキーム検証
  if (!isAllowedScheme(srcUrl)) {
    showError("このURLスキームはサポートされていません。");
    sendTelemetry("conversion_result", { format: formatKey, result: "error",    extension_version: version });
    sendTelemetry("conversion_error",  { format: formatKey, reason: "unsupported_scheme", extension_version: version });
    return;
  }

  const config   = FORMAT_CONFIG[formatKey];
  const filename = buildFilename(srcUrl, config.ext);

  // chrome-extension://, moz-extension://, chrome://, edge://, about: 等ではスクリプト注入不可
  // 変換せず元画像をそのままダウンロードする
  const tabUrl = tab.url || "";
  if (/^(chrome|edge|about|devtools|moz-extension)/i.test(tabUrl)) {
    try {
      const downloadId = await downloadOriginal(srcUrl, filename);
      // キャンセル時（downloadId === undefined）はテレメトリ送信をスキップ
      if (downloadId !== undefined) {
        sendTelemetry("conversion_result", { format: formatKey, result: "fallback", extension_version: version });
      }
    } catch (err) {
      if (err instanceof BlobDownloadError) {
        showError("この画像は直接ダウンロードできません。");
      } else {
        showError("画像の保存に失敗しました。");
      }
      sendTelemetry("conversion_result", { format: formatKey, result: "error",    extension_version: version });
      sendTelemetry("conversion_error",  { format: formatKey, reason: "fallback_download_failed", extension_version: version });
    }
    return;
  }

  try {
    // content script でキャンバス変換を試みる（デフォルトの ISOLATED world で実行）
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: contentScriptConvert,
        args: [srcUrl, config.mime],
      });
    } catch (execErr) {
      console.error("[かんたん画像変換] executeScript failed:", execErr);
      // フォールバック: 元画像をそのままダウンロード
      try {
        const downloadId = await downloadOriginal(srcUrl, filename);
        // キャンセル時（downloadId === undefined）はテレメトリ送信をスキップ
        if (downloadId !== undefined) {
          sendTelemetry("conversion_result", { format: formatKey, result: "fallback", extension_version: version });
          // スクリプト注入が根本原因
          sendTelemetry("conversion_error",  { format: formatKey, reason: "execute_script_failed", extension_version: version });
        }
      } catch (err) {
        if (err instanceof BlobDownloadError) {
          showError("この画像は直接ダウンロードできません。");
        } else {
          showError("画像の保存に失敗しました。");
        }
        sendTelemetry("conversion_result", { format: formatKey, result: "error",    extension_version: version });
        // 根本原因（スクリプト注入失敗）と直接原因（フォールバックDL失敗）を両方送信
        sendTelemetry("conversion_error",  { format: formatKey, reason: "execute_script_failed",    extension_version: version });
        sendTelemetry("conversion_error",  { format: formatKey, reason: "fallback_download_failed", extension_version: version });
      }
      return;
    }

    const result = results?.[0]?.result;

    if (result && result.dataUrl) {
      // 変換成功 → data URL でダウンロード
      try {
        const downloadId = await downloadFile(result.dataUrl, filename);
        // キャンセル時（downloadId === undefined）はテレメトリ送信をスキップ
        if (downloadId !== undefined) {
          sendTelemetry("conversion_result", { format: formatKey, result: "success", extension_version: version });
        }
      } catch {
        showError("画像の保存に失敗しました。");
        sendTelemetry("conversion_result", { format: formatKey, result: "error",  extension_version: version });
        sendTelemetry("conversion_error",  { format: formatKey, reason: "download_failed", extension_version: version });
      }
    } else if (result && result.skipConversion) {
      // アニメーション画像 or SVG → 元画像をそのままダウンロード
      try {
        const downloadId = await downloadOriginal(srcUrl, buildFilename(srcUrl, getOriginalExt(srcUrl)));
        // キャンセル時（downloadId === undefined）はテレメトリ送信をスキップ
        if (downloadId !== undefined) {
          sendTelemetry("conversion_result", { format: formatKey, result: "fallback", extension_version: version });
        }
      } catch (err) {
        // blob: URL の場合は専用メッセージを表示
        if (err instanceof BlobDownloadError) {
          showError("この画像は直接ダウンロードできません。");
        } else {
          showError("画像の保存に失敗しました。");
        }
        sendTelemetry("conversion_result", { format: formatKey, result: "error",    extension_version: version });
        sendTelemetry("conversion_error",  { format: formatKey, reason: "fallback_download_failed", extension_version: version });
      }
    } else {
      // 変換失敗（CORS、Canvas エラー等）→ フォールバック: 元画像をそのままダウンロード
      const csError = result?.error;

      // reason の判定（確実な場合のみ分類、曖昧な場合は unknown）
      // ※エラーメッセージ全文は送信しない
      let reason = "unknown";
      if (csError) {
        const msg = String(csError).toLowerCase();
        if (msg.includes("cors") || msg.includes("cross-origin") || msg.includes("opaque")) {
          reason = "cors";
        } else if (msg.includes("canvas") || msg.includes("context")) {
          reason = "canvas_error";
        }
        console.warn("[かんたん画像変換] Content script error (classified as:", reason, ")");
      }

      console.warn("[かんたん画像変換] Conversion failed, falling back to original download.");
      try {
        const downloadId = await downloadOriginal(srcUrl, filename);
        // キャンセル時（downloadId === undefined）はテレメトリ送信をスキップ
        if (downloadId !== undefined) {
          sendTelemetry("conversion_result", { format: formatKey, result: "fallback", extension_version: version });
          // csError がある場合は conversion_error を送信する。
          // 分類できた場合は具体的な reason、できなかった場合は "unknown" を送る（エラーがあった事実自体が有用）
          if (csError) {
            sendTelemetry("conversion_error", { format: formatKey, reason, extension_version: version });
          }
        }
      } catch (err) {
        if (err instanceof BlobDownloadError) {
          showError("この画像は直接ダウンロードできません。");
        } else {
          showError("画像の保存に失敗しました。");
        }
        sendTelemetry("conversion_result", { format: formatKey, result: "error",    extension_version: version });
        sendTelemetry("conversion_error",  { format: formatKey, reason: "fallback_download_failed", extension_version: version });
      }
    }
  } catch (err) {
    console.error("[かんたん画像変換] Unexpected error:", err);
    showError("画像の保存に失敗しました。");
    sendTelemetry("conversion_result", { format: formatKey, result: "error",  extension_version: version });
    // 予期しない例外のため原因が特定できない。conversion_error は送信しない。
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

  /**
   * WebPがアニメーションかどうかをANIMチャンクで判定。
   * @param {Uint8Array} data
   * @returns {boolean}
   */
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
      img.onload  = () => resolve(img);
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
      reader.onload  = () => resolve(reader.result);
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
 * blob: URL を直接ダウンロードできない場合にスローする専用エラー。
 * 呼び出し元でこのクラスを判定し、ユーザー向けメッセージを出し分ける。
 */
class BlobDownloadError extends Error {
  constructor() {
    super("blob URL cannot be downloaded directly");
    this.name = "BlobDownloadError";
  }
}

/**
 * data URL をダウンロードする（名前を付けて保存ダイアログを表示）。
 * @param {string} dataUrl
 * @param {string} filename
 */
async function downloadFile(dataUrl, filename) {
  // data: URL を blob: URL に変換（Firefox は data: URL の直接ダウンロード非対応）
  // fetch() でブラウザ実装に委ねることで atob ループより効率的に変換する
  const blob = await fetch(dataUrl).then((r) => r.blob());
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: blobUrl, filename: filename, saveAs: true },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (downloadId === undefined) {
          URL.revokeObjectURL(blobUrl);
          console.info("[かんたん画像変換] Download cancelled by user.");
          resolve(undefined);
          return;
        }
        // callback 直後に revoke するとブラウザが実データを読む前に URL が無効になり
        // download_failed が発生する場合がある（Windows + Vivaldi 等で顕在化）。
        // onChanged でダウンロードが完了または中断してから revoke する。
        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          chrome.downloads.onChanged.removeListener(onChanged);
          URL.revokeObjectURL(blobUrl);
        };
        const onChanged = (delta) => {
          if (delta.id !== downloadId || !delta.state) return;
          const state = delta.state.current;
          if (state === "complete" || state === "interrupted") {
            cleanup();
          }
        };
        chrome.downloads.onChanged.addListener(onChanged);
        // addListener より前にダウンロードが終了していた場合は onChanged が発火しない。
        // 登録直後に状態を確認し、既に終端状態であれば即座にクリーンアップする。
        chrome.downloads.search({ id: downloadId }, (items) => {
          if (chrome.runtime.lastError) return;
          const state = items?.[0]?.state;
          if (state === "complete" || state === "interrupted") {
            cleanup();
          }
        });
        resolve(downloadId);
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
  // blob: は chrome.downloads.download で直接使えない。
  // showError は呼び出し元の catch で行うため、ここでは例外のみスローする。
  // BlobDownloadError を使うことで呼び出し元がメッセージを出し分けられる。
  if (srcUrl.startsWith("blob:")) {
    throw new BlobDownloadError();
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
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  const h   = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s   = String(now.getSeconds()).padStart(2, "0");
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
