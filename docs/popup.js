"use strict";

document.getElementById("demoLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("docs/demo.html") });
  window.close();
});

const manifest = chrome.runtime.getManifest();
document.getElementById("version").textContent = `v${manifest.version}`;