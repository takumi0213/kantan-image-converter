# かんたん画像変換

Webページの画像を右クリックでJPG・PNG・WebPに変換して保存できるChrome拡張機能です。

> [!NOTE]
> Created by Claude Code

## 機能

- 画像を右クリック → JPG / PNG / WebP を選択して保存
- 元画像のフォーマットに関係なく指定フォーマットへ変換
- ファイル名を元画像URLから自動取得（取得不可の場合は日時形式 `20260316_203823`）
- アニメーションGIF/WebPは変換せずそのまま保存
- SVG画像は変換せずそのまま保存

## デモ・使い方ガイド

ツールバーの拡張機能アイコンをクリック →「使い方ガイド」から、拡張機能の使い方とサンプル画像を確認できます。

## インストール

### 開発者モードで読み込む場合

1. このリポジトリをクローンまたはダウンロード

   ```bash
   git clone https://github.com/takumi0213/kantan-image-converter.git
   ```

2. Chromeで `chrome://extensions` を開く
3. 右上の「デベロッパーモード」をONにする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. クローンしたフォルダを選択

## 使い方

1. Webページ上の画像を右クリック
2. 「画像を変換して保存」メニューを開く
3. 保存したいフォーマット（JPG / PNG / WebP）を選択
4. 「名前を付けて保存」ダイアログが表示されるので、保存先を確認して保存します

## 技術仕様

### アーキテクチャ

```
コンテキストメニュー click
  → Service Worker が activeTab + scripting.executeScript で content script を注入
  → content script が画像を fetch + Canvas で変換
  → 変換済み data URL を Service Worker に返却
  → chrome.downloads.download() で保存
```

### フォーマット変換

- `OffscreenCanvas` + `canvas.convertToBlob()` で変換
- JPG/WebP の品質パラメータ: 92%（人間の目でほぼ劣化が分からず、ファイルサイズを効率的に抑えるバランスポイント）
- JPG変換時は透過部分を白背景で描画

### ファイル名の決定ロジック

1. 画像URLのパスからファイル名を抽出
2. 抽出できない場合（data URI、blob URL等）→ 日時形式 `YYYYMMDD_HHMMSS`
3. パストラバーサル防止・特殊文字除去のサニタイズを適用
4. 拡張子を変換先フォーマットに置換

### エラーハンドリング

| ケース | 動作 |
| --- | --- |
| CORS制限で画像取得失敗 | 元画像URLをそのままダウンロード（変換なし） |
| content script 注入失敗 | 元画像URLをそのままダウンロード（変換なし） |
| Canvas変換失敗（巨大画像等） | 元画像URLをそのままダウンロード（変換なし） |
| data URL転送失敗 | 元画像URLをそのままダウンロード（変換なし） |
| アニメーションGIF/WebP | 変換せず元のまま保存 |
| SVG画像 | 変換せず元のまま保存 |
| すべて失敗 | バッジアイコン赤化 |

### セキュリティ

- **URLスキーム検証**: `http:`, `https:`, `data:`, `blob:` のみ許可
- **ファイル名サニタイズ**: パストラバーサル防止、null バイト・特殊文字除去
- **CSP明示定義**: `script-src 'self'; object-src 'self'`
- **権限最小化**: `host_permissions` 不使用
- **外部通信なし**: すべての処理がローカルで完結
- **content script隔離**: isolated world で実行、悪意あるページからの干渉を防止

### 必要な権限

| 権限 | 用途 |
| --- | --- |
| `contextMenus` | 右クリックメニューの登録 |
| `downloads` | 変換後の画像をダウンロード |
| `activeTab` | アクティブタブの画像にアクセス |
| `scripting` | content script の動的注入 |

## ファイル構成

```
kantan-image-converter/
├── manifest.json        # 拡張機能マニフェスト (Manifest V3)
├── background.js        # Service Worker（メニュー・ダウンロード管理）
├── icons/
│   ├── icon16.png       # ツールバー用アイコン
│   ├── icon48.png       # 拡張機能管理画面用
│   └── icon128.png      # Chrome Web Store用
├── docs/
│   ├── popup.html       # ツールバーポップアップ UI
│   ├── popup.js         # ツールバーポップアップ ロジック
│   ├── demo.html        # 使い方ガイド・デモページ
│   ├── demo.js          # デモページ サンプル画像生成
│   ├── debug.html       # 開発者向けテスト・デバッグ用
│   └── debug.js         # デバッグページ テスト画像生成
├── tools/
│   └── generate_icons.py  # アイコン生成スクリプト（開発用）
├── CLAUDE.md            # Claude Code 用プロジェクトガイド
├── AGENTS.md            # AI エージェント向け仕様ドキュメント
├── LICENSE              # MIT License
└── README.md
```

## 開発

### 開発用ツール

`tools/` ディレクトリにアイコン生成スクリプト等の開発用ツールがあります。詳細は [tools/README.md](tools/README.md) を参照してください。

### テスト・デバッグ

[debug.html](docs/debug.html) にエッジケース（アニメーション画像、data URI、SVG、透過画像等）のテスト用画像とテストマトリクスがあります。

1. `chrome://extensions` でデベロッパーモードをON
2. 拡張機能を読み込み
3. Service Worker の「inspect」リンクからDevToolsを開く
4. content script のログはページのDevTools Consoleに表示

## ライセンス

[MIT License](LICENSE)