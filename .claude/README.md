# Claude Code カスタムコマンド

このディレクトリには Claude Code のカスタムスラッシュコマンドが格納されています。

## コマンド一覧

| コマンド | 用途 | 使うタイミング |
|---|---|---|
| `/prepare-release [patch\|minor\|major]` | リリース準備（バンプ・チェック・リリースノート） | リリース前 |
| `/design-check` | UI 変更の DESIGN.md 仕様照合 | `website/` または `docs/` を変更したとき |
| `/worker-deploy` | Cloudflare Worker のデプロイ前チェック | `telemetry/worker.js` を変更したとき |

## 使い方

Claude Code のチャットでコマンド名を入力するだけで実行できます。

```
/prepare-release patch
/design-check
/worker-deploy
```

---

## `/prepare-release [patch|minor|major]`

リリースに必要な一連の作業をまとめて行います。引数を省略すると `patch` が適用されます。

**実行内容（順番に処理）:**

1. `manifest.json` と `package.json` のバージョンを同時更新
2. `npm run lint && npm run test && npm run validate` を実行
3. `background.js` ↔ `tests/background.test.js` の純粋関数の同期チェック
4. テレメトリ実装が `CLAUDE.md` / `AGENTS.md` の制約を満たしているか検証
5. コードとドキュメント（README・CLAUDE.md・AGENTS.md）の整合性チェック
6. 前回タグからの変更をまとめた日本語リリースノートドラフトを生成

**バージョンが更新されるファイル:** `manifest.json` と `package.json` の2箇所（両方を必ず同時に更新）

---

## `/design-check`

`website/` または `docs/` の HTML・CSS を変更したとき、`DESIGN.md` のデザインシステム仕様に準拠しているか照合します。

**主な確認ポイント:**

| スコープ | 確認内容 |
|---|---|
| `website/` | Google Fonts の読み込み・CSS 変数の使用・コンテナ幅（max 820px）・NAV/FOOTER の動的挿入 |
| `docs/` | Web フォント不使用（CSP 制約）・CSS 変数なし・`demo.html` 幅（max 680px）・`popup.html` 幅（240px 固定） |

---

## `/worker-deploy`

`telemetry/worker.js` を変更してデプロイする前に、以下をチェックします。

**確認内容:**

- Cloudflare Workers Free プラン制約（有料機能を使用していないか）
- CORS ヘッダーの完全な付与（OPTIONS プリフライト・POST・エラーレスポンス）
- Origin 制限（`chrome-extension://` / `moz-extension://` のみ許可・拡張機能 ID 制限の設定）
- GA4 転送の `ctx.waitUntil()` バックグラウンド実行

問題がなければデプロイコマンドを提示します。
