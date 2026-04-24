`website/` または `docs/` の HTML・CSS の変更が `DESIGN.md` の仕様に準拠しているか確認します。

`DESIGN.md` を読んだうえで、変更されたファイルを特定し、以下を照合してください。変更ファイルが不明な場合は確認するファイルを質問してください。

---

## website/ のチェック項目

- Google Fonts（Noto Sans JP・DM Mono）が正しく読み込まれているか
- CSS 変数（`--blue`・`--text`・`--bg` 等）が `common.css` の定義通りに使用されているか
- コンテナ幅が `max-width: 820px` 以内か
- NAV・FOOTER が `components.js` 経由で動的挿入されているか（直書きになっていないか）

## docs/ のチェック項目

- Google Fonts・Web フォントが**使用されていない**こと（CSP 制約により禁止）
- CSS 変数を使わず直書きになっているか
- `demo.html` のコンテナ幅が `max-width: 680px` 以内か
- `popup.html` の幅が `240px` 固定になっているか

---

## 報告形式

違反がある場合: ファイルパス・行番号・違反内容を列挙してください。
違反がない場合: 「DESIGN.md 仕様に準拠しています」と報告してください。
