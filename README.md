# かんたん画像変換

Webページの画像を右クリックでJPG・PNG・WebPに変換して保存できるChrome拡張機能です。

> [!NOTE]
> Created by Claude Code

## 機能

- 画像を右クリック → PNG / JPG / WebP を選択して変換・保存
- 元画像のフォーマットに関係なく指定フォーマットへ変換
- ファイル名を元画像URLから自動取得（取得不可の場合は日時形式 `YYYYMMDD_HHMMSS`）
- アニメーションGIF / アニメーションWebP は変換せず元のまま保存
- SVG画像は変換せず元のまま保存
- 変換失敗時は元画像をそのままダウンロード（フォールバック）
- すべての処理がローカルで完結（外部サーバーへの通信なし）

## インストール

1. [Releases](https://github.com/takumi0213/kantan-image-converter/releases) ページから最新の `kantan-image-converter-vX.X.X.zip` をダウンロード
2. ZIPを展開
3. Chromeで `chrome://extensions` を開く
4. 右上の「デベロッパーモード」をONにする
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. 展開したフォルダを選択

> [!TIP]
> 配布ZIPの署名は `gh attestation verify kantan-image-converter-vX.X.X.zip --owner takumi0213` で検証できます。

## 使い方

1. Webページ上の画像を右クリック
2. 「画像を変換して保存」メニューを開く
3. 保存したいフォーマット（PNG / JPG / WebP）を選択
4. 「名前を付けて保存」ダイアログが表示されるので、保存先を確認して保存します

ツールバーの拡張機能アイコンをクリックすると、デモ・使い方ガイドを確認できます。

> [!NOTE]
> `chrome://` や拡張機能ページ等の特殊なページでは変換できないため、元の形式のまま保存されます。

## 対応ブラウザ

Manifest V3 に対応したChromiumベースのブラウザで動作します。

- Google Chrome
- Microsoft Edge
- Vivaldi
- Brave
- その他Chromiumベースブラウザ

※ Firefoxには対応していません。

## 技術仕様

### アーキテクチャ

```
コンテキストメニュー click
  → Service Worker が activeTab + scripting.executeScript で content script を注入
  → content script がページ内の <img> 要素から Canvas に描画して変換
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
| 制限ページ（chrome://, 拡張機能ページ等） | 元画像URLをそのままダウンロード（変換なし） |
| アニメーションGIF/WebP | 変換せず元のまま保存 |
| SVG画像 | 変換せず元のまま保存 |
| すべて失敗 | バッジアイコン赤化 |

### セキュリティ

- **URLスキーム検証**: `http:`, `https:`, `data:`, `blob:` のみ許可
- **ファイル名サニタイズ**: パストラバーサル防止、null バイト・特殊文字除去
- **権限最小化**: `host_permissions` 不使用
- **外部通信なし**: すべての処理がローカルで完結
- **content script隔離**: isolated world で実行、悪意あるページからの干渉を防止
- **ビルド署名**: GitHub Attestation による配布物の出所証明

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
│   ├── popup.html       # ツールバーポップアップ
│   ├── popup.js         # ポップアップロジック
│   └── demo.html        # デモ・使い方ガイド
├── tools/
│   └── generate_icons.py  # アイコン生成スクリプト（開発用）
├── CLAUDE.md            # Claude Code 用プロジェクトガイド
├── AGENTS.md            # AI エージェント向け仕様ドキュメント
├── CONTRIBUTING.md      # コントリビューションガイド
├── SECURITY.md          # セキュリティポリシー
└── LICENSE              # GNU General Public License v3.0
```

## コントリビューション

バグ報告・機能提案・PRを歓迎します。詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

セキュリティ上の問題を発見した場合は、Issue ではなく [SECURITY.md](SECURITY.md) に記載の手順で非公開でご報告ください。

## 開発

### 開発用ツール

`tools/` ディレクトリにアイコン生成スクリプト等の開発用ツールがあります。詳細は [tools/README.md](tools/README.md) を参照してください。

### デバッグ

1. `chrome://extensions` でデベロッパーモードをON
2. 拡張機能を読み込み
3. Service Worker の「inspect」リンクからDevToolsを開く
4. content script のログはページのDevTools Consoleに表示

## ライセンス

[GNU General Public License v3.0](LICENSE)

このソフトウェアはフリーソフトウェアです。GNU GPLv3の条件のもとで、自由に使用・変更・再配布できます。派生物を配布する場合は、同じく GNU GPLv3 のもとでソースコードを公開する必要があります。
