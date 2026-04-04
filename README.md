# かんたん画像変換

Webページの画像を右クリックでJPG・PNG・WebPに変換して保存できるChromium系ブラウザ向け拡張機能です。

**紹介ページ**: https://img-convert.takumi0213.com/

> [!NOTE]
> Created by Claude Code

## 機能

- 画像を右クリック → PNG / JPG / WebP を選択して変換・保存
- 元画像のフォーマットに関係なく指定フォーマットへ変換
- ファイル名を元画像URLから自動取得（取得不可の場合は日時形式 `YYYYMMDD_HHMMSS`）
- アニメーションGIF / アニメーションWebP は変換せず元のまま保存
- SVG画像は変換せず元のまま保存
- 変換失敗時は元画像をそのままダウンロード（フォールバック）

> [!NOTE]
> 変換処理の品質監視のため、変換結果・エラー分類・バージョン番号のみを Google Analytics 4 へ匿名で送信しています。URL・ファイル名・画像データは送信しません。詳細は[プライバシーポリシー](https://img-convert.takumi0213.com/privacy.html)を参照してください。

## インストール

[Chrome Web Store](https://chromewebstore.google.com/detail/かんたん画像変換/lecilkeobjibofjaoadlelgfiipicdlo) からインストールできます。

<details>
<summary>手動インストール（GitHub Releases から）</summary>

1. [Releases](https://github.com/takumi0213/kantan-image-converter/releases) ページから最新の `kantan-image-converter-vX.X.X.zip` をダウンロード
2. ZIPを展開
3. Chromeで `chrome://extensions` を開く
4. 右上の「デベロッパーモード」をONにする
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. 展開したフォルダを選択

💡 配布ZIPの署名は `gh attestation verify kantan-image-converter-vX.X.X.zip --owner takumi0213` で検証できます。

</details>

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
- **content script隔離**: isolated world で実行、悪意あるページからの干渉を防止
- **ビルド署名**: GitHub Attestation による配布物の出所証明

### 品質メトリクス

変換処理の品質監視を目的として、Cloudflare Worker プロキシ経由で Google Analytics 4（Measurement Protocol）へ匿名メトリクスを送信しています。`api_secret` は拡張機能のソースコードには含まれず、Worker の環境変数に保管しています。

**送信するイベント**

| イベント | 送信条件 | パラメータ |
| --- | --- | --- |
| `conversion_result` | 変換完了時（成功・フォールバック・失敗）※ダイアログキャンセル時は除く | `format`, `result`, `extension_version` |
| `conversion_error` | エラー発生時（原因が特定できる場合のみ） | `format`, `reason`, `extension_version` |

**送信しない情報**

- 画像URLやページURL
- ファイル名
- エラーメッセージ全文
- ユーザー識別子・セッションID
- その他の任意文字列

詳細は[プライバシーポリシー](https://img-convert.takumi0213.com/privacy.html)を参照してください。

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
├── website/
│   ├── index.html       # 紹介ページ（GitHub Pages で公開）
│   ├── privacy.html     # プライバシーポリシーページ（GitHub Pages で公開）
│   ├── components.js    # 共通ナビゲーション・フッターの動的挿入スクリプト
│   ├── common.css       # 共通スタイルシート（変数・リセット・NAV・FOOTER）
│   ├── favicon.ico      # サイト用ファビコン
│   └── ogp.png          # OGP用画像（SNS共有カード）
├── tools/
│   └── generate_icons.py  # アイコン生成スクリプト（開発用）
├── tests/
│   └── background.test.js  # ユニットテスト（Node.js 単体で実行）
├── scripts/
│   ├── validate-manifest.cjs  # manifest.json 検証スクリプト
│   └── build-dist.sh          # 配布用ZIP作成スクリプト
├── eslint.config.js     # ESLint 設定
├── package.json         # 開発用スクリプト・devDependencies 定義
├── package-lock.json    # npm 依存のロックファイル
├── CLAUDE.md            # Claude Code 用プロジェクトガイド
├── AGENTS.md            # AI エージェント向け仕様ドキュメント
├── CODE_OF_CONDUCT.md   # 行動規範
├── CONTRIBUTING.md      # コントリビューションガイド
├── SECURITY.md          # セキュリティポリシー
├── SUPPORT.md           # サポート窓口案内
├── README.md            # プロジェクト概要
└── LICENSE              # GNU General Public License v3.0
```

## コントリビューション

バグ報告・機能提案・PRを歓迎します。詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

本プロジェクトは [行動規範（CODE_OF_CONDUCT.md）](CODE_OF_CONDUCT.md) を定めています。コミュニティへの参加にあたってはご一読ください。

質問やサポートが必要な場合は [SUPPORT.md](SUPPORT.md) をご確認ください。

セキュリティ上の問題を発見した場合は、Issue ではなく [SECURITY.md](SECURITY.md) に記載の手順で非公開でご報告ください。

## 開発

### 開発用ツール

`tools/` ディレクトリにアイコン生成スクリプト等の開発用ツールがあります。詳細は [tools/README.md](tools/README.md) を参照してください。

### 自動テスト・静的解析

```bash
# 依存インストール（初回のみ）
npm install

# ユニットテスト
npm run test

# lint（background.js, docs/popup.js, scripts/, tests/）
npm run lint

# manifest.json 検証
npm run validate
```

### デバッグ

1. `chrome://extensions` でデベロッパーモードをON
2. 拡張機能を読み込み
3. Service Worker の「inspect」リンクからDevToolsを開く
4. content script のログはページのDevTools Consoleに表示

## ライセンス

[GNU General Public License v3.0](LICENSE)

このソフトウェアはフリーソフトウェアです。GNU GPLv3の条件のもとで、自由に使用・変更・再配布できます。派生物を配布する場合は、同じく GNU GPLv3 のもとでソースコードを公開する必要があります。
