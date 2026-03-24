# AGENTS.md — かんたん画像変換

## プロジェクト概要

**かんたん画像変換** は、Webページの画像を右クリックメニューからJPG・PNG・WebPに変換して保存できるChrome拡張機能です。

- **種別**: Chrome拡張機能（Manifest V3）
- **言語**: JavaScript（バニラ、フレームワーク不使用）
- **依存パッケージ**: なし（外部ライブラリ・npm 不使用）
- **ライセンス**: GNU General Public License v3.0
- **SSOT**: 実装コード（`background.js`, `manifest.json`）が正。ドキュメントはコードに追従する。

## リポジトリ構成

```
kantan-image-converter/
├── .github/
│   ├── dependabot.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── feature_request.yml
│   │   └── config.yml
│   ├── pull_request_template.md
│   └── workflows/
│       ├── claude.yml
│       ├── claude-code-review.yml
│       └── release.yml
├── manifest.json        # 拡張機能マニフェスト (Manifest V3)
├── background.js        # Service Worker（メニュー・ダウンロード管理）
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── docs/
│   ├── popup.html
│   ├── popup.js
│   └── demo.html
├── tools/
│   └── generate_icons.py
├── CLAUDE.md
├── AGENTS.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── README.md
```

## 処理フロー

```
コンテキストメニュー click
  → Service Worker (background.js)
      ├── 制限ページ判定 → 該当する場合はフォールバック（元画像ダウンロード）
      ├── activeTab + scripting.executeScript で content script を注入（ISOLATED world）
      └── content script
            ├── ページ内の <img> 要素から Canvas に描画
            ├── OffscreenCanvas で指定フォーマットに変換（convertToBlob, 品質92%）
            └── 変換済み data URL を Service Worker に返却
  → chrome.downloads.download() で保存（saveAs: true 固定）
```

## 機能仕様

### 対応フォーマット
- 出力: JPG / PNG / WebP
- 入力: 任意（ブラウザが読み込める画像形式）

### 変換しないケース
- アニメーションGIF / アニメーションWebP → そのまま保存
- SVG → そのまま保存

### ファイル名決定
1. 画像URLのパスからファイル名を抽出
2. 取得不可（data URI、blob URL等）→ `YYYYMMDD_HHMMSS` 形式
3. パストラバーサル防止・特殊文字サニタイズ
4. 拡張子を変換先フォーマットに置換

### 保存方式
常に「名前を付けて保存」ダイアログを表示する（`saveAs: true` 固定）。

### エラー時のフォールバック
CORS制限・Canvas変換失敗・制限ページ等、あらゆるエラーケースで元画像URLをそのままダウンロードする（変換なし）。

## セキュリティ仕様

| 項目 | 内容 |
| --- | --- |
| URLスキーム検証 | `http:`, `https:`, `data:`, `blob:` のみ許可 |
| ファイル名サニタイズ | パストラバーサル防止、null バイト・特殊文字除去 |
| 権限 | `host_permissions` 不使用 |
| 外部通信 | なし（すべてローカル完結） |
| content script | isolated world で実行 |
| 配布物署名 | GitHub Attestation |

## コード変更時のガイドライン

1. **セキュリティ要件を変更しないこと** — URLスキーム検証・ファイル名サニタイズは必須。
2. **外部依存を追加しないこと** — npm / CDN 等の外部ライブラリは使用しない。
3. **フォールバック動作を維持すること** — 変換失敗時は必ず元画像URLをダウンロードする。
4. **品質パラメータ(92%)を変更する場合** — ファイルサイズと品質のトレードオフを考慮し理由を明記。
5. **新しい権限を追加する場合** — manifest.json の変更理由を明確にすること。
6. **`saveAs: true` を変更しないこと** — 保存ダイアログ表示は仕様。
7. **機能追加はコアコンセプトに沿うこと** — 画像の変換・保存という目的から逸脱しない範囲で改善・拡張を行う。シンプルさを維持し、外部依存を増やさない。

## テスト方法

自動テストフレームワークは未導入。手動テスト手順:

1. `chrome://extensions` でデベロッパーモードをON
2. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
3. 通常のWebページで画像を右クリックし、各フォーマット（PNG/JPG/WebP）で変換・保存を確認
4. アニメーションGIF・SVGがそのまま保存されることを確認
5. `chrome://` 等の制限ページでは変換されず元画像がダウンロードされることを確認
