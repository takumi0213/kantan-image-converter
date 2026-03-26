# CLAUDE.md — かんたん画像変換

## プロジェクト概要

Webページの画像を右クリックでJPG・PNG・WebPに変換して保存できるChromium系拡張機能（Manifest V3）。

## Single Source of Truth

実装されているコード（`background.js`, `manifest.json`）を最も正確な情報源とする。ドキュメント（README, CLAUDE.md, AGENTS.md）はコードに追従し、矛盾がある場合はコードが正とする。

コードを変更した場合は README / CLAUDE.md / AGENTS.md 等ドキュメントの更新漏れがないか必ず確認すること。
レビュー時はコードとドキュメントの整合性チェックを実施すること。

## アーキテクチャ

```
コンテキストメニュー click
  → Service Worker (background.js) が activeTab + scripting.executeScript で content script を注入
  → content script がページ内の <img> 要素から Canvas に描画して変換（ISOLATED world）
  → 変換済み data URL を Service Worker に返却
  → chrome.downloads.download() で保存
```

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能マニフェスト (Manifest V3) |
| `background.js` | Service Worker（メニュー登録・ダウンロード管理） |
| `docs/popup.html`, `docs/popup.js` | ツールバーポップアップ（デモページへの導線） |
| `docs/demo.html` | デモ・使い方ガイド（静的HTML、スクリプトなし） |
| `icons/` | 拡張機能アイコン（16/48/128px） |
| `website/index.html` | 紹介ページ（GitHub Pages で公開） |
| `website/favicon.ico` | サイト用ファビコン |
| `website/ogp.png` | OGP用画像（SNS共有カード） |
| `tools/generate_icons.py` | アイコン生成スクリプト（開発用） |
| `tools/README.md` | 開発用ツールの説明 |
| `tests/background.test.js` | ユニットテスト（依存ゼロ、Node.js 単体で実行） |
| `scripts/validate-manifest.cjs` | manifest.json 検証スクリプト（CI で使用） |
| `eslint.config.js` | ESLint 設定（flat config、v9） |
| `package.json` | 開発用スクリプト・devDependencies 定義 |
| `package-lock.json` | npm 依存のロックファイル（必ずコミットすること） |

## 重要な実装上の制約

### フォーマット変換
- `OffscreenCanvas` + `canvas.convertToBlob()` を使用
- JPG/WebP の品質パラメータ: **92%**（変更する場合は理由を明確に）
- JPG変換時は透過部分を**白背景**で描画すること

### ファイル名決定ロジック
1. 画像URLのパスからファイル名を抽出
2. 取得不可（data URI、blob URL等）→ 日時形式 `YYYYMMDD_HHMMSS`
3. パストラバーサル防止・特殊文字除去のサニタイズを適用
4. 拡張子を変換先フォーマットに置換

### エラーハンドリング方針
すべての失敗ケースでフォールバックとして**元画像URLをそのままダウンロード**する（変換なしで保存）。変換失敗でもユーザーが画像を取得できるようにすること。

### 保存方式
常に「名前を付けて保存」ダイアログを表示する（`saveAs: true` 固定）。変更しないこと。

### 変換しないケース（そのまま保存）
- アニメーションGIF / アニメーションWebP
- SVG画像

### 制限ページの処理
`chrome://`, `chrome-extension://`, `edge://`, `about:`, `devtools:` で始まるページではスクリプト注入不可。`executeScript` を呼ばずにフォールバック（元画像ダウンロード）に直行する。

## 機能追加方針

本拡張機能は「画像を変換して保存する」というコアコンセプトを維持しつつ、改善や拡張の提案を歓迎する。機能追加を検討する際は以下を考慮すること。

- コアコンセプト（画像の変換・保存）から逸脱しないか
- 既存のシンプルさを損なわないか
- セキュリティ要件を満たしているか
- 外部依存を増やさないか（原則バニラJSで実装）

## セキュリティ要件（変更禁止）

- **URLスキーム検証**: `http:`, `https:`, `data:`, `blob:` のみ許可
- **ファイル名サニタイズ**: パストラバーサル防止、null バイト・特殊文字除去
- **権限最小化**: `host_permissions` は使用しない
- **外部通信なし**: すべての処理をローカルで完結させること
- **content script**: isolated world で実行

## 権限

拡張機能が使用する権限は `manifest.json` で定義済み。新しい権限を追加する場合は必ず理由を明示すること。

## 開発・デバッグ

```bash
# コード変更前に確認（すべてパスすること）
npm run lint && npm run test && npm run validate

# 依存インストール（初回のみ）
npm install

# lint（background.js, docs/popup.js, scripts/, tests/）
npm run lint

# ユニットテスト
npm run test

# manifest.json 検証
npm run validate

# アイコン生成
python tools/generate_icons.py
```

デバッグ手順:
1. `chrome://extensions` でデベロッパーモードをON
2. 拡張機能を読み込み
3. 通常のWebページで画像を右クリックして動作確認（chrome:// 等の特殊ページでは変換不可）
4. Service Worker の「inspect」からDevToolsを開く
5. content script のログはページのDevTools Consoleに表示

## テスト

`tests/background.test.js` にユニットテストを実装済み。外部テストフレームワーク不要で Node.js 単体で実行できる。

**テスト対象関数（Chrome API 非依存の純粋関数）:**

| 関数 | 内容 |
| --- | --- |
| `menuIdToFormat` | メニューIDからフォーマットキーへの変換 |
| `isAllowedScheme` | URLスキーム検証 |
| `extractBaseName` | URLからファイル名抽出 |
| `removeExtension` | 拡張子除去 |
| `sanitizeFilename` | ファイル名サニタイズ |
| `generateDatetimeFilename` | 日時ファイル名生成 |
| `getOriginalExt` | 元ファイルの拡張子推定 |
| `buildFilename` | ファイル名構築（統合） |

Chrome API に依存する関数（`handleImageSave` 等）は手動テスト対象。

> **注意**: `tests/background.test.js` は `background.js` の純粋関数を**再定義**してテストしている。`background.js` の対象関数を変更した場合は `tests/background.test.js` の対応する関数も必ず同期すること。

## CI/CD

| ワークフロー | トリガー | 内容 |
| --- | --- | --- |
| `ci.yml` | main push / 全PR | lint・ユニットテスト・manifest検証 |
| `codeql.yml` | main push / main PR / 毎週土曜 | CodeQL 静的解析（actions・JS・Python） |
| `release.yml` | タグ push | 配布ZIP生成・GitHub Attestation・Release作成 |
| `claude.yml` | Issue/PR コメント (`@claude`) | Claude Code による自動対応 |
| `claude-code-review.yml` | PR open/update | Claude による自動コードレビュー |
| `pr-labeler.yml` | PR open/update | 変更ファイルに応じたラベル自動付与 |
| `pr-guard.yml` | PR (manifest/background/popup変更時) | 手動確認チェックリストをコメント投稿 |
| `update-lockfile.yml` | package.json push / 手動 | package-lock.json 更新 PR を自動作成 |
| `stale.yml` | 毎日 / 手動 | 60日放置の Issue を stale 化、7日後にクローズ |
| `pages.yml` | website/ push | GitHub Pages デプロイ |

Dependabot（`.github/dependabot.yml`）は GitHub Actions（週次）と npm（毎日）の2エコシステムを監視し、依存バージョンの更新 PR を自動作成する。

## ライセンス

GNU General Public License v3.0

## AIエージェント向け作業ルール

### コミュニケーション
- 会話は日本語で行うこと
- ファイル出力後は新規追加と上書きを明確に区別し、配置先パスを含む一覧で示すこと
- 問題・指摘は重要度に関わらず必ず修正すること

### リポジトリ更新時の提案事項
リポジトリの更新が必要な場合は以下を提案すること。

- **ブランチ名**（例: `fix/menu-duplicate`, `feat/firefox-support`, `docs/update-readme`）
- **PRタイトル**（日本語で記載すること）
- **PR説明**（`.github/pull_request_template.md` のテンプレートに沿って日本語で記載すること）
- **コミットメッセージ**（英語・日本語どちらでも可。内容を簡潔に表すこと）
