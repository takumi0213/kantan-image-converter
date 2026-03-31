# セキュリティポリシー

## サポート対象バージョン

| バージョン | サポート状況 |
| --- | --- |
| 最新リリース | サポート対象 |
| それ以前 | サポート対象外 |

常に最新バージョンへのアップデートを推奨します。

## 脆弱性の報告

セキュリティ上の問題を発見した場合は、**Issue に公開投稿しないでください**。

GitHub の [Private Vulnerability Reporting](https://github.com/takumi0213/kantan-image-converter/security/advisories/new) から非公開で報告してください。

### 報告に含めていただきたい情報

- 問題の概要
- 再現手順（可能な限り具体的に）
- 影響範囲の見積もり
- 影響を受けるバージョン
- 可能であれば修正案

報告を受け取り次第確認し、対応します。

## セキュリティ設計

本拡張機能は以下のセキュリティ方針に基づいて設計されています。

### 権限の最小化

- 使用する権限は `contextMenus`, `downloads`, `activeTab`, `scripting` の4つのみ
- `host_permissions` は使用せず、`activeTab` でユーザーの操作時のみアクセス権を取得
- 拡張機能ページに対するスクリプト注入は事前にブロックし、`executeScript` を呼ばない

### データの安全性

- すべての画像変換処理はブラウザ内で完結し、画像データが外部サーバーへ送信されることはありません
- 変換処理の品質監視を目的として、匿名の品質メトリクス（変換結果・エラー分類・バージョン番号）を Google Analytics 4 へ送信します。URL・ファイル名・画像データ・ユーザー識別子は送信しません（詳細は [プライバシーポリシー](https://takumi0213.github.io/kantan-image-converter/privacy.html) を参照）
- content script は isolated world で実行され、悪意あるページのJavaScriptからの干渉を防止します

### 入力の検証

- URLスキーム検証: `http:`, `https:`, `data:`, `blob:` のみ許可
- ファイル名サニタイズ: パストラバーサル防止、null バイト除去、Windows禁止文字除去、200文字制限

### 配布物の信頼性

- GitHub Actions でビルドした配布ZIPに [Attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations) を付与しています
- `gh attestation verify` コマンドで、配布物がこのリポジトリの公式CIから生成されたことを検証できます
