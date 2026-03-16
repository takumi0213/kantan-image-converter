# かんたん画像変換

Webページの画像を右クリックでJPG・PNG・WebPに変換して保存できるChrome拡張機能です。

## 機能

- 画像を右クリック → JPG / PNG / WebP を選択して保存
- 元画像のフォーマットに関係なく指定フォーマットへ変換
- ファイル名を元画像URLから自動取得（取得不可の場合は日時形式 `20260316_203823`）
- アニメーションGIF/WebPは変換せずそのまま保存
- SVG画像は変換せずそのまま保存

## スクリーンショット

<!--
TODO: スクリーンショットを追加
![コンテキストメニュー](docs/screenshot_menu.png)
-->

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
4. 指定フォーマットに変換された画像がダウンロードフォルダに保存されます

## 設定

拡張機能アイコンを右クリック →「オプション」から設定画面を開けます。

| 設定項目 | 説明 | デフォルト |
|---|---|---|
| 名前を付けて保存 | ONにすると毎回保存先を選択するダイアログが表示されます | OFF |
| 完了・エラー通知 | 保存完了やエラー時にデスクトップ通知を表示します | OFF |

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
|---|---|
| CORS制限で画像取得失敗 | 元画像URLをそのままダウンロード（変換なし） |
| content script 注入失敗 | 元画像URLをそのままダウンロード（変換なし） |
| Canvas変換失敗（巨大画像等） | 元画像URLをそのままダウンロード（変換なし） |
| data URL転送失敗 | 元画像URLをそのままダウンロード（変換なし） |
| アニメーションGIF/WebP | 変換せず元のまま保存 |
| SVG画像 | 変換せず元のまま保存 |
| すべて失敗 | バッジアイコン赤化 + 通知（有効時） |

### セキュリティ

- **URLスキーム検証**: `http:`, `https:`, `data:`, `blob:` のみ許可
- **ファイル名サニタイズ**: パストラバーサル防止、null バイト・特殊文字除去
- **CSP明示定義**: `script-src 'self'; object-src 'self'`
- **権限最小化**: `host_permissions` 不使用、`notifications` は `optional_permissions`
- **外部通信なし**: すべての処理がローカルで完結
- **content script隔離**: isolated world で実行、悪意あるページからの干渉を防止

### 必要な権限

| 権限 | 用途 |
|---|---|
| `contextMenus` | 右クリックメニューの登録 |
| `downloads` | 変換後の画像をダウンロード |
| `activeTab` | アクティブタブの画像にアクセス |
| `storage` | ユーザー設定の保存 |
| `scripting` | content script の動的注入 |
| `notifications` (任意) | 完了・エラー通知の表示 |

## ファイル構成

```
kantan-image-converter/
├── manifest.json        # 拡張機能マニフェスト (Manifest V3)
├── background.js        # Service Worker（メニュー・ダウンロード管理）
├── options.html         # オプションページ UI
├── options.js           # オプションページ ロジック
├── icons/
│   ├── icon16.png       # ツールバー用アイコン
│   ├── icon48.png       # 拡張機能管理画面用
│   └── icon128.png      # Chrome Web Store用
├── tools/
│   └── generate_icons.py  # アイコン生成スクリプト（開発用）
├── LICENSE              # MIT License
└── README.md
```

## 開発

### アイコンの再生成

```bash
pip install Pillow
python tools/generate_icons.py
```

### デバッグ

1. `chrome://extensions` でデベロッパーモードをON
2. 拡張機能を読み込み
3. Service Worker の「inspect」リンクからDevToolsを開く
4. content script のログはページのDevTools Consoleに表示

## ライセンス

[MIT License](LICENSE)
