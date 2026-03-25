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
 
document.getElementById("demoLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("docs/demo.html") });
  window.close();
});
 
document.getElementById("websiteLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://takumi0213.github.io/kantan-image-converter/" });
  window.close();
});
 
document.getElementById("githubLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "https://github.com/takumi0213/kantan-image-converter" });
  window.close();
});
 
const manifest = chrome.runtime.getManifest();
document.getElementById("version").textContent = `v${manifest.version}`;
