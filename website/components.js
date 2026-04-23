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

'use strict';

(function () {
  /**
   * ナビゲーションリンクのリスト。
   * prefix: ページ固有のパスプレフィックス（トップページは空文字、サブページは "./index.html"）
   */
  function buildNavLinks(prefix) {
    const base = prefix ? prefix : '';
    return `
      <li><a href="${base}#features">機能</a></li>
      <li><a href="${base}#howto">使い方</a></li>
      <li><a href="${base}#install">インストール</a></li>
      <li><a href="${base}#spec">技術仕様</a></li>
      <li><a href="${base}#faq">FAQ</a></li>
      <li><a href="https://github.com/takumi0213/kantan-image-converter">GitHub</a></li>
    `.trim();
  }

  /** ロゴのhref（サブページは prefix='./index.html'、トップページは prefix=''） */
  function buildLogoHref(prefix) {
    return prefix || '#';
  }

  /** nav要素の中身を生成して挿入する */
  function renderNav() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const prefix = nav.dataset.page === 'sub' ? './index.html' : '';
    nav.innerHTML = `
  <div class="nav-inner">
    <a href="${buildLogoHref(prefix)}" class="nav-logo">かんたん画像変換</a>
    <ul class="nav-links">
      ${buildNavLinks(prefix)}
    </ul>
  </div>`;
  }

  /** footer要素の中身を生成して挿入する */
  function renderFooter() {
    const footer = document.querySelector('footer');
    if (!footer) return;
    footer.innerHTML = `
  <div class="footer-inner">
    <div class="footer-left">
      <strong>かんたん画像変換</strong>
      GNU General Public License v3.0 &nbsp;&middot;&nbsp; Copyright &copy; 2026 takumi0213
    </div>
    <ul class="footer-links">
      <li><a href="https://github.com/takumi0213/kantan-image-converter">GitHub</a></li>
      <li><a href="https://chromewebstore.google.com/detail/lecilkeobjibofjaoadlelgfiipicdlo">Chrome Web Store</a></li>
      <li><a href="https://addons.mozilla.org/ja/firefox/addon/img-convert/">Firefox Add-ons</a></li>
      <li><a href="https://github.com/takumi0213/kantan-image-converter/blob/main/CONTRIBUTING.md">Contributing</a></li>
      <li><a href="https://github.com/takumi0213/kantan-image-converter/blob/main/CODE_OF_CONDUCT.md">Code of Conduct</a></li>
      <li><a href="https://github.com/takumi0213/kantan-image-converter/security/advisories/new">Security</a></li>
      <li><a href="./privacy.html">プライバシーポリシー</a></li>
    </ul>
  </div>`;
  }

  renderNav();
  renderFooter();
})();
