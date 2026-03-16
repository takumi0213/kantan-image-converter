# tools

かんたん画像変換の開発用ツールです。

## generate_icons.py

拡張機能のアイコン（16px / 48px / 128px）をPythonで生成するスクリプトです。

### 必要な環境

- Python 3.8+
- Pillow

### 使い方

プロジェクトルートから実行してください。

```bash
pip install Pillow
python tools/generate_icons.py
```

`icons/` ディレクトリに以下のファイルが出力されます。

| ファイル | 用途 |
|---|---|
| `icon16.png` | ツールバー、コンテキストメニュー |
| `icon48.png` | 拡張機能管理画面 |
| `icon128.png` | Chrome Web Store、通知 |

### デザイン

青い角丸背景に画像アイコン（山と太陽）、右下に変換を示すオレンジ色の矢印バッジを配置しています。

デザインを変更する場合は `create_icon()` 関数内の描画処理を編集してください。スクリプトは `tools/` からの相対パスでプロジェクトルートの `icons/` に自動出力します。