`telemetry/worker.js` のデプロイ前チェックを行い、問題がなければデプロイコマンドを提示します。

`telemetry/worker.js` と `telemetry/wrangler.toml` を読んで以下を確認してください。

---

## 1. Free プラン制約チェック

Cloudflare Workers **Free プラン**で使用できない機能（Rate Limiting バインディング等、Paid プラン専用機能）が `wrangler.toml` または `worker.js` で使用されていないか確認してください。

## 2. CORS 設定チェック

以下がすべて実装されているか確認してください。

- OPTIONS リクエストへの `Access-Control-Allow-*` レスポンス（プリフライト対応）
- POST レスポンスへの CORS ヘッダー付与
- Origin 確認後のエラーレスポンス（400 / 405 等）への CORS ヘッダー付与

## 3. Origin 制限チェック

以下を確認してください。

- `chrome-extension://` または `moz-extension://` スキーム以外のリクエストを拒否しているか
- `ALLOWED_EXTENSION_ORIGIN`（Chrome）と `ALLOWED_GECKO_EXTENSION_ORIGIN`（Firefox）の環境変数に対応しているか

## 4. GA4 転送チェック

GA4 への転送が `ctx.waitUntil()` でバックグラウンド実行されており、レスポンスを先に返してから転送していることを確認してください。

---

## 結果報告

問題がなければ以下のデプロイコマンドを提示してください。

```bash
cd telemetry && npx wrangler deploy
```

問題がある場合は修正点を列挙してください。
