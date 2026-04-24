リリース準備を一括で行います。引数: $ARGUMENTS（`patch` / `minor` / `major`、省略時は `patch`）。

以下のステップを順番に実行してください。

## 1. バージョンバンプ

`manifest.json` と `package.json` の `version` を読み取り、引数に従って更新してください。

| 引数 | 変換ルール |
|---|---|
| `patch`（省略時も同様） | x.y.z → x.y.(z+1) |
| `minor` | x.y.z → x.(y+1).0 |
| `major` | x.y.z → (x+1).0.0 |

**両ファイルを必ず同時に更新すること。**

## 2. コード品質チェック

```bash
npm run lint && npm run test && npm run validate
```

失敗した場合は修正してから次のステップへ進んでください。

## 3. テスト同期チェック

`background.js` と `tests/background.test.js` の以下の純粋関数の実装を比較し、差分があれば `tests/background.test.js` を修正してください。

対象: `menuIdToFormat` / `isAllowedScheme` / `extractBaseName` / `removeExtension` / `sanitizeFilename` / `generateDatetimeFilename` / `getOriginalExt` / `buildFilename`

## 4. テレメトリ制約チェック

`background.js` と `telemetry/worker.js` を読み、以下を確認してください。

- 禁止データ（URL・ファイル名・エラーメッセージ全文・ユーザー識別子）を送信していない
- `reason` の値が定義された8種類（`unsupported_scheme` / `execute_script_failed` / `content_script_error` / `canvas_error` / `cors` / `download_failed` / `fallback_download_failed` / `unknown`）のみ
- `FORBIDDEN_KEYS` がファイルスコープ定数として定義されている（関数内ローカル定義になっていない）
- `conversion_error` の `unknown` 送信条件: `csError` がある場合のみ送信
- Worker の全レスポンス（エラー含む）に CORS ヘッダーが付与されている
- GA4 転送が `ctx.waitUntil()` でバックグラウンド実行されている

## 5. ドキュメント整合性チェック

`background.js` と `manifest.json` の実装内容が `README.md`・`CLAUDE.md`・`AGENTS.md` と矛盾していないか確認し、更新が必要な箇所があれば修正してください。

## 6. リリースノートドラフト生成

`git log` で前回タグから現在までのコミット差分を確認し、**エンドユーザー向けの日本語リリースノート**をドラフトしてください。

出力形式（GitHub Releases に貼り付けられる Markdown）:

```markdown
## 変更内容

### 新機能
- （あれば）

### 改善・修正
- （あれば）

### 内部変更
- （Dependabot 更新・CI 改善など）
```

PR タイトルの羅列ではなく、ユーザーが理解しやすい表現で記述してください。

---

## 完了報告

以下をまとめてください。

- 新バージョン番号
- 各チェックの結果（パス / 要対応）
- リリースノートドラフト
