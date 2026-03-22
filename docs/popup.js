"use strict";

document.getElementById("guideLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("docs/demo.html") });
  window.close();
});

document.getElementById("debugLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("docs/debug.html") });
  window.close();
});

// バージョン表示
const manifest = chrome.runtime.getManifest();
document.getElementById("version").textContent = `v${manifest.version}`;