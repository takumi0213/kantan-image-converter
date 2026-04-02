# AGENTS.md — かんたん画像変換

## プロジェクト概要

**かんたん画像変換** は、Webページの画像を右クリックメニューからJPG・PNG・WebPに変換して保存できるChromium系拡張機能です。

- **種別**: Chromium系拡張機能（Manifest V3）
- **言語**: JavaScript（バニラ、フレームワーク不使用）
- **依存パッケージ**: なし（拡張機能本体に外部ライブラリ不使用）
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
│   ├── labeler.yml
│   ├── pull_request_template.md
│   └── workflows/
│       ├── assign-issue.yml
│       ├── assign-pr.yml
│       ├── ci.yml
│       ├── claude.yml
│       ├── claude-code-review.yml
│       ├── codeql.yml
│       ├── pages.yml
│       ├── pr-guard.yml
│       ├── pr-labeler.yml
│       ├── release.yml
│       ├── stale.yml
│       └── update-lockfile.yml
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
├── website/
│   ├── index.html       # 紹介ページ（GitHub Pages で公開）
│   ├── privacy.html     # プライバシーポリシーページ（GitHub Pages で公開）
│   ├── components.js    # 共通ナビゲーション・フッターの動的挿入スクリプト
│   ├── common.css       # 共通スタイルシート（変数・リセット・NAV・FOOTER）
│   ├── favicon.ico      # サイト用ファビコン
│   └── ogp.png          # OGP用画像（SNS共有カード）
├── tools/
│   ├── generate_icons.py
│   └── README.md
├── tests/
│   └── background.test.js  # ユニットテスト（Node.js 単体で実行）
├── scripts/
│   ├── validate-manifest.cjs  # manifest.json 検証スクリプト
│   └── build-dist.sh          # 配布用ZIP作成スクリプト
├── eslint.config.js     # ESLint 設定（flat config、v9）
├── package.json         # 開発用スクリプト・devDependencies 定義
├── package-lock.json    # npm 依存のロックファイル
├── CLAUDE.md
├── AGENTS.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── SUPPORT.md
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
| 権限 | `contextMenus`, `downloads`, `activeTab`, `scripting` の4つのみ。`host_permissions` 不使用 |
| 外部通信 | Cloudflare Worker プロキシ経由で GA4 Measurement Protocol（品質メトリクスのみ、URL/ファイル名等は送信しない。`api_secret` は Worker 環境変数に保管） |
| content script | isolated world で実行 |
| 配布物署名 | GitHub Attestation |

## 品質メトリクス仕様

`sendTelemetry(eventName, params)` 単一関数で実装。以下は変更禁止。

- **送信先**: Cloudflare Worker プロキシ（`telemetry/worker.js`）経由で GA4 へ転送。`api_secret` は Worker 環境変数に保管し拡張機能コードには含まれない
- **プラン**: Cloudflare Workers **Free プラン**で運用する。Paid プラン専用機能（Rate Limiting バインディング等）は使用しない
- **送信イベント**: `conversion_result` / `conversion_error` の2種類のみ
- **送信パラメータ**: `format` / `result` / `reason` / `extension_version` のみ
- **禁止データ**: URL・ファイル名・エラーメッセージ全文・ユーザー識別子は送信しない
- **reason定義**: 8種類固定（追加禁止）— `unsupported_scheme` / `execute_script_failed` / `content_script_error` / `canvas_error` / `cors` / `download_failed` / `fallback_download_failed` / `unknown`
- **telemetry失敗は無視**: try-catch で本処理に影響させない
- **キャンセル時は送信しない**: ダウンロードダイアログをキャンセルした場合（`downloadId === undefined`）は `conversion_result` を送信しない
- **予期しない例外では `conversion_error` を送らない**: 外側 catch は原因が特定できないため `conversion_result=error` のみ送信する
- **`blob:` URL は `BlobDownloadError` をスロー**: 呼び出し元で `instanceof` 判定し「直接ダウンロードできません」を表示。他エラーは「保存に失敗しました」
- **Worker は `ctx.waitUntil()` でバックグラウンド転送**: GA4 転送完了を待たず即 204 を返す
- **Worker のエラーレスポンスにも CORS ヘッダーを付与**: Origin 確認後の全レスポンス（400/405/204 等）に `corsHeaders(origin)` を付与する

## コード変更時のガイドライン

1. **セキュリティ要件を変更しないこと** — URLスキーム検証・ファイル名サニタイズは必須。
2. **外部依存を追加しないこと** — 拡張機能本体（`background.js`）に npm / CDN 等の外部ライブラリは使用しない。
3. **フォールバック動作を維持すること** — 変換失敗時は必ず元画像URLをダウンロードする。
4. **品質パラメータ(92%)を変更する場合** — ファイルサイズと品質のトレードオフを考慮し理由を明記。
5. **新しい権限を追加する場合** — manifest.json の変更理由を明確にすること。
6. **`saveAs: true` を変更しないこと** — 保存ダイアログ表示は仕様。
7. **機能追加はコアコンセプトに沿うこと** — 画像の変換・保存という目的から逸脱しない範囲で改善・拡張を行う。
8. **テレメトリのイベント・パラメータ・reasonを追加・変更しないこと** — 仕様外の拡張は禁止。

## テスト

### 自動テスト

```bash
npm install        # 初回のみ
npm run test       # ユニットテスト
npm run lint       # ESLint
npm run validate   # manifest.json 検証
```

`tests/background.test.js` はフレームワーク不要で Node.js 単体で実行できる。

**テスト対象（Chrome API 非依存の純粋関数）:** `menuIdToFormat` / `isAllowedScheme` / `extractBaseName` / `removeExtension` / `sanitizeFilename` / `generateDatetimeFilename` / `getOriginalExt` / `buildFilename`

> **注意**: `tests/background.test.js` は `background.js` の純粋関数を**再定義**してテストしている。`background.js` の対象関数を変更した場合は `tests/background.test.js` の対応する関数も必ず同期すること。

### 手動テスト

1. `chrome://extensions` でデベロッパーモードをON
2. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
3. 通常のWebページで画像を右クリックし、各フォーマット（PNG/JPG/WebP）で変換・保存を確認
4. アニメーションGIF・SVGがそのまま保存されることを確認
5. `chrome://` 等の制限ページでは変換されず元画像がダウンロードされることを確認
