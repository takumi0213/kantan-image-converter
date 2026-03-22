# CLAUDE.md — かんたん画像変換

## プロジェクト概要

Webページの画像を右クリックでJPG・PNG・WebPに変換して保存できるChrome拡張機能（Manifest V3）。

## アーキテクチャ

```
コンテキストメニュー click
  → Service Worker (background.js) が activeTab + scripting.executeScript で content script を注入
  → content script がページ内の <img> 要素から Canvas に描画して変換
  → 変換済み data URL を Service Worker に返却
  → chrome.downloads.download() で保存
```

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能マニフェスト (Manifest V3) |
| `background.js` | Service Worker（メニュー登録・ダウンロード管理） |
| `icons/` | 拡張機能アイコン（16/48/128px） |
| `tools/` | 開発用スクリプト（アイコン生成等） |

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
常に「名前を付けて保存」ダイアログを表示する（`saveAs: true` 固定）。ユーザーが保存先とファイル名を確認できるようにするための仕様。変更しないこと。

### 変換しないケース（そのまま保存）
- アニメーションGIF / アニメーションWebP
- SVG画像

## 機能追加方針

本拡張機能は「画像を変換して保存する」という単一の目的に特化する。新機能の追加は行わず、既存機能のブラッシュアップ（バグ修正・エッジケース対応・コード品質向上）のみを対象とする。

## セキュリティ要件（変更禁止）

- **URLスキーム検証**: `http:`, `https:`, `data:`, `blob:` のみ許可
- **ファイル名サニタイズ**: パストラバーサル防止、null バイト・特殊文字除去
- **CSP**: `script-src 'self'; object-src 'self'`
- **権限最小化**: `host_permissions` は使用しない
- **外部通信なし**: すべての処理をローカルで完結させること
- **content script**: isolated world で実行

## 権限

拡張機能が使用する権限は `manifest.json` で定義済み。新しい権限を追加する場合は必ず理由を明示すること。

## 開発・デバッグ

```bash
# アイコン生成
python tools/generate_icons.py
```

デバッグ手順:
1. `chrome://extensions` でデベロッパーモードをON
2. 拡張機能を読み込み
3. 通常のWebページで画像を右クリックして動作確認（chrome:// 等の特殊ページでは変換不可）
4. Service Worker の「inspect」からDevToolsを開く
5. content script のログはページのDevTools Consoleに表示