/**
 * かんたん画像変換 - オプションページ (options.js)
 */

"use strict";

const saveAsEl = document.getElementById("saveAs");
const notifyEl = document.getElementById("notifyOnComplete");
const statusEl = document.getElementById("status");

/** ステータスメッセージの表示タイマー */
let statusTimer = null;

// ========================================================
// 設定の読み込み
// ========================================================

chrome.storage.local.get({ saveAs: false, notifyOnComplete: false }, (items) => {
  saveAsEl.checked = items.saveAs;
  notifyEl.checked = items.notifyOnComplete;
});

// ========================================================
// 設定の保存
// ========================================================

saveAsEl.addEventListener("change", () => {
  saveSetting("saveAs", saveAsEl.checked);
});

notifyEl.addEventListener("change", async () => {
  if (notifyEl.checked) {
    // 通知権限をリクエスト
    const granted = await requestNotificationPermission();
    if (!granted) {
      notifyEl.checked = false;
      showStatus("通知の権限が許可されませんでした");
      return;
    }
  } else {
    // 通知OFFにしたら権限を解放
    try {
      await chrome.permissions.remove({ permissions: ["notifications"] });
    } catch {
      // 権限解放に失敗しても設定は保存する
    }
  }
  saveSetting("notifyOnComplete", notifyEl.checked);
});

/**
 * 設定値を保存する。
 * @param {string} key
 * @param {*} value
 */
function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    showStatus("設定を保存しました");
  });
}

/**
 * notifications の optional permission をリクエストする。
 * @returns {Promise<boolean>}
 */
async function requestNotificationPermission() {
  return new Promise((resolve) => {
    chrome.permissions.request(
      { permissions: ["notifications"] },
      (granted) => resolve(granted)
    );
  });
}

/**
 * ステータスメッセージを表示する。
 * @param {string} message
 */
function showStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.add("show");

  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.classList.remove("show");
  }, 2000);
}
