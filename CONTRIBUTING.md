# コントリビューションガイド

かんたん画像変換へのコントリビューションを歓迎します。

## はじめに

このプロジェクトは「画像を変換して保存する」というシンプルなコアコンセプトを大切にしています。バグ修正、エッジケース対応、コード品質向上に加え、コアコンセプトに沿った機能提案も受け付けています。

本プロジェクトへの参加にあたっては、[行動規範（CODE_OF_CONDUCT.md）](CODE_OF_CONDUCT.md) を遵守してください。

## Issue

### バグ報告

Issue テンプレート（バグ報告）に沿って報告してください。以下の情報があると対応がスムーズです。

- 再現手順
- ブラウザの種類とバージョン（Chrome, Edge, Firefox, Vivaldi 等）
- Service Worker DevTools のエラーメッセージ（あれば）

### 機能提案

提案は歓迎しますが、以下の観点で判断します。

- コアコンセプト（画像の変換・保存）に沿っているか
- 既存のシンプルさを損なわないか
- セキュリティ要件を満たしているか

コアコンセプトから外れる提案は採用されない場合があります。

### 使い方の質問・サポート

使い方に関する質問は Issue ではなく、まず [SUPPORT.md](SUPPORT.md) をご確認ください。

### セキュリティの問題

セキュリティ上の問題は **Issue には投稿しないでください**。[Private Vulnerability Reporting](https://github.com/takumi0213/kantan-image-converter/security/advisories/new) から非公開で報告してください。詳細は [SECURITY.md](SECURITY.md) を参照してください。

## Pull Request

### 手順

1. まず Issue で事前に相談することを推奨します（特に機能追加の場合）
2. リポジトリをフォークし、`main` ブランチから作業用ブランチを作成
3. 変更を実装
4. PR テンプレートに沿って説明を記載
5. レビューを待つ

### PRを出す前の確認事項

- 自動テストが通ること（`npm run test` / `npm run lint` / `npm run validate`）
- 通常のWebページで各フォーマット（PNG/JPG/WebP）の変換・保存が正常に動作する
- `chrome://`・`moz-extension://` 等の制限ページでエラーが発生しない（フォールバックダウンロードが動作する）
- アニメーションGIF / SVG がそのまま保存される
- 既存の動作に影響を与えない
- `website/` を変更した場合: GitHub Pages でレイアウト崩れがないことを確認（`website/index.html` をブラウザで直接開いて確認可）

## 開発方針

### 守るべきルール

- **外部依存なし**: 拡張機能本体（`background.js`）に npm / CDN 等の外部ライブラリは使用しません。バニラJavaScriptで実装してください
- **セキュリティ要件の維持**: URLスキーム検証、ファイル名サニタイズ、`host_permissions` 不使用等は変更できません
- **フォールバック動作の維持**: 変換失敗時は必ず元画像をダウンロードする動作を保持してください
- **`saveAs: true` の維持**: 保存ダイアログを常に表示する仕様は変更できません
- **テレメトリの制約遵守**: 品質メトリクスの送信イベント・パラメータ・reason定義は仕様通りに維持してください。URL・ファイル名・エラーメッセージ全文・ユーザー識別子は絶対に送信しないこと

### コーディング規約

- `"use strict"` を使用
- JSDoc コメントで関数の引数・戻り値を記載
- ログ出力は `[かんたん画像変換]` プレフィックスを付与
- エラーレベルの使い分け: `console.error`（致命的）、`console.warn`（フォールバック発動）、`console.info`（正常だが注記）

## 開発環境のセットアップ

```bash
# 1. リポジトリをフォーク・クローン
git clone https://github.com/<your-username>/kantan-image-converter.git
cd kantan-image-converter

# 2. 開発用依存をインストール（ESLint 等）
npm install
```

**Chrome**: `chrome://extensions` でデベロッパーモードをONにし、「パッケージ化されていない拡張機能を読み込む」でクローンしたフォルダを選択してください。コード変更後は拡張機能をリロードして動作確認し、Service Worker の「inspect」からDevToolsを開いてログを確認してください。

**Firefox**: `about:debugging#/runtime/this-firefox` を開き、「一時的な拡張機能を読み込む」から `manifest.json` を選択してください。

### 開発コマンド

```bash
# ユニットテスト
npm run test

# lint（background.js, docs/popup.js, scripts/, tests/）
npm run lint

# manifest.json 検証
npm run validate
```

> **注意**: `tests/background.test.js` は `background.js` の純粋関数を**再定義**してテストしています。`background.js` の対象関数を変更した場合は `tests/background.test.js` の対応する関数も必ず同期してください。

## ライセンス

コントリビューションは [GNU General Public License v3.0](LICENSE) に基づいて提供されます。PRを送信することで、このライセンスに同意したものとみなされます。
