# DESIGN.md — かんたん画像変換

> このファイルは Claude Design / Claude Code がUIを生成・修正する際のデザイン仕様書です。
> `website/`（GitHub Pages 公開）と `docs/`（拡張機能内部ページ）は制約が異なるため、デザインシステムを完全に分けて定義しています。

## 1. Overview

### このファイルの用途

- **Claude Design**: プロジェクトのコンテキストとしてアップロードし、デザイン生成の基準として使用する
- **Claude Code**: `website/` および `docs/` の HTML / CSS を修正・生成する際の仕様書として参照する

## 2. Scope

### 対象ファイル

| ファイル | 用途 | デザインシステム |
|---|---|---|
| `website/common.css` | website/ 共通スタイル | website/ |
| `website/components.js` | NAV・FOOTER 動的生成 | website/ |
| `website/index.html` | ランディングページ | website/ |
| `website/privacy.html` | プライバシーポリシー | website/ |
| `docs/demo.html` | デモ・使い方ガイド（拡張機能内部） | docs/ |
| `docs/popup.html` | 拡張機能ポップアップ | docs/ |

### website/ と docs/ の制約の違い

| 項目 | website/ | docs/ |
|---|---|---|
| Google Fonts | ✅ 使用可 | ❌ 使用不可（CSP制約） |
| WebFont | Noto Sans JP + DM Mono | システムフォントのみ |
| CSS変数 | ✅ 使用 | ❌ 使用しない（シンプルな直書き） |
| コンテナ幅 | max-width: 820px | demo: 680px / popup: 240px固定 |
| ダークモード | ❌ 非対応（theme-colorのみ） | ❌ 非対応 |

## 3. website/ Design System

### 3.1 Color Tokens

```css
:root {
  /* Brand Blue */
  --blue:       #2563eb;
  --blue-dark:  #1d4ed8;
  --blue-light: #dbeafe;
  --blue-pale:  #eff6ff;

  /* Text（opacityベース・純黒回避） */
  --text:       rgba(0, 0, 0, 0.82);
  --text-mid:   rgba(0, 0, 0, 0.55);
  --text-light: rgba(0, 0, 0, 0.36);

  /* Surface */
  --bg:         #ffffff;
  --bg-subtle:  #f8fafc;

  /* Border */
  --border:     rgba(0, 0, 0, 0.1);

  /* Radius */
  --radius:     12px;
  --radius-lg:  20px;

  /* Shadow */
  --shadow-sm:  0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
  --shadow:     0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.06);
  --shadow-lg:  0 20px 40px rgba(0,0,0,.1), 0 8px 16px rgba(0,0,0,.06);
}
```

**カラー設計の原則**
- テキストカラーは opacity ベースで指定し、純粋な `#000000` や `#0f172a` は使用しない
- ブルー `#2563eb` はブランドカラーとして CTA・リンク・アクセントに限定使用
- ボーダーは `rgba(0,0,0,0.1)` で柔らかく表現する

### 3.2 Typography

```css
/* 本文 */
font-family: "Noto Sans JP", sans-serif;
font-size:   16px;
line-height: 1.8;
color:       var(--text);

/* 等幅（コード・ラベル） */
font-family: "DM Mono", monospace;
```

**見出しスタイル**

| Role | Size | Weight | Letter Spacing | Line Height |
|---|---|---|---|---|
| h1（Hero） | clamp(28px, 4vw, 38px) | 700 | -0.02em | 1.25 |
| h2（セクション） | 24px | 700 | 0em（normal） | 1.4 |
| h3（ステップ等） | 16px | 700 | normal | 1.5 |

**タイポグラフィ原則**
- 本文 `line-height: 1.8` を維持し、ゆったりした読書体験を確保する
- h1 の `letter-spacing` は `-0.02em`（詰めすぎない）
- h2 の `letter-spacing` は `0em`（neutral）
- `.spec-label` 等の DM Mono ラベルは `letter-spacing: 0.05em`（広め）を維持
- 見出しの `letter-spacing: 0.04em` は使用しない（`.spec-label` との差別化）

### 3.3 Spacing & Layout

**スペーシングスケール（4px 基底）**

| Token | Value |
|---|---|
| XS | 4px |
| S | 8px |
| M | 16px |
| L | 24px |
| XL | 32px |
| XXL | 48px |
| XXXL | 80px |

**コンテナ**
- Max Width: 820px
- Horizontal Padding: 24px
- Section Padding: 80px 0（モバイル: 56px 0）

### 3.4 Elevation（影）

| Level | Shadow | 用途 |
|---|---|---|
| 0 | none | フラットな要素（デフォルト） |
| 1 | `var(--shadow-sm)` | カード・デフォルト状態 |
| 2 | `var(--shadow)` | カードホバー・フローティング要素 |
| 3 | `var(--shadow-lg)` | モックアップ・モーダル相当 |

**影の原則**
- カードのデフォルト状態はフラット（影なし）またはレベル1にとどめる
- ホバー時にレベル2のデュアルシャドウに変化させ、浮き上がりを演出する
- `transform: translateY(-2px)` をホバー時に併用する

### 3.5 Components

#### Button

```css
/* ベース */
.btn {
  display:         inline-flex;
  align-items:     center;
  gap:             8px;
  padding:         12px 28px;
  border-radius:   999px;        /* ピル型 */
  font-size:       14px;
  font-weight:     700;
  text-decoration: none;
  transition:      all .15s;
  border:          none;
}

/* Primary */
.btn-primary {
  background: var(--blue);
  color:      #fff;
  box-shadow: 0 2px 8px rgba(37,99,235,.3);
}
.btn-primary:hover {
  background:  var(--blue-dark);
  box-shadow:  0 4px 12px rgba(37,99,235,.4);
  transform:   translateY(-1px);
}

/* Secondary */
.btn-secondary {
  background: var(--bg);
  color:      var(--text);
  border:     1.5px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.btn-secondary:hover {
  border-color: var(--blue);
  color:        var(--blue);
  transform:    translateY(-1px);
}

/* Small（contribute-box 等） */
.btn-sm {
  font-size: 13px;
  padding:   8px 18px;
}
```

**ボタン原則**
- メイン CTA は必ずピル型（`border-radius: 999px`）を使用する
- Secondary ボタンはアウトライン型。ホバーでブルーに変化
- サイズ違いはクラスで対応し、インラインスタイルの上書きは避ける

#### Card

```css
.card {
  background:    var(--bg-subtle);
  border:        1px solid var(--border);
  border-radius: var(--radius);
  padding:       22px 20px;
  transition:    box-shadow .15s, transform .15s;
}
.card:hover {
  box-shadow: var(--shadow);
  transform:  translateY(-2px);
}
```

#### NAV

- `position: sticky; top: 0`
- `background: rgba(255,255,255,.92); backdrop-filter: blur(12px)`
- 高さ: 56px
- モバイル（≤680px）: リンク非表示

#### FOOTER

- `background: var(--bg-subtle); border-top: 1px solid var(--border)`
- Padding: 40px 0
- 左：プロダクト名 + ライセンス表記
- 右：外部リンク群

### 3.6 page: index.html

**ページ固有トークン**

```css
:root {
  --accent:       #f97316;   /* オレンジ（バッジ等のアクセント） */
  --accent-light: #fff7ed;
}
```

**セクション構成**

| セクション | ID | 特記事項 |
|---|---|---|
| Hero | — | グリッド2カラム（左: テキスト / 右: ブラウザモックアップ） |
| Features | `#features` | 3カラムグリッド、feature-card |
| How to Use | `#howto` | ステップリスト + notice-box |
| Install | `#install` | install-card 3枚（Chrome / Firefox / 対応ブラウザ） |
| Tech Spec | `#spec` | 2カラムグリッド、spec-block |
| FAQ | `#faq` | details/summary アコーディオン + contribute-box |

**Hero セクション**
- 背景: `radial-gradient(ellipse 60% 50% at 70% 40%, rgba(37,99,235,.06) 0%, transparent 70%)`
- モバイル（≤680px）: ブラウザモックアップ（`.hero-visual`）は `display: none`

### 3.7 page: privacy.html

**ページ固有スタイル**

```css
h1 {
  font-size:      clamp(24px, 3.5vw, 32px);
  font-weight:    700;
  letter-spacing: -0.02em;
  line-height:    1.3;
}

h2 {
  font-size:      18px;
  font-weight:    700;
  letter-spacing: 0em;
  padding-bottom: 10px;
  border-bottom:  1px solid var(--border);
}

.policy-section p {
  font-size:   15px;
  color:       var(--text-mid);
  line-height: 1.85;
}
```

**セクション構成**
- NAV（`data-page="sub"` でロゴリンク先を `./index.html` に切り替え）
- パンくずリスト（トップ › プライバシーポリシー）
- ページヘッダー（h1 + 最終更新日）
- ハイライトボックス（要約）
- ポリシー本文（テーブル・リスト含む）
- FOOTER

## 4. docs/ Design System（website/ と完全独立）

### 4.1 Constraints（制約）

- **Google Fonts 使用不可**（拡張機能内部ページ・CSP制約）
- **CSS変数使用不可**（シンプルな直書きで統一）
- **外部リソース参照不可**
- `docs/popup.html` は幅 **240px 固定**（ブラウザ拡張機能の制約）
- リンクは `chrome.tabs.create` で新タブ開き（`popup.js` が担当）

### 4.2 Color Tokens（docs/ 共通・直書き）

```
/* Text */
本文テキスト:     rgba(0, 0, 0, 0.82)
サブテキスト:     rgba(0, 0, 0, 0.55)
薄テキスト:       rgba(0, 0, 0, 0.36)

/* Surface */
背景（ページ）:   #ffffff
背景（subtle）:   #f8fafc
ホバー背景:       rgba(0, 0, 0, 0.04)

/* Border */
ボーダー:         rgba(0, 0, 0, 0.1)

/* Brand Blue（website/ に統一） */
ブルー:           #2563eb

/* Warning（通知ボックス） */
背景:             #fffbeb
ボーダー:         #fde68a
テキスト:         #92400e
```

### 4.3 Typography（docs/ 共通）

```css
/* 本文 */
font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
font-size:   14px;
line-height: 1.7;
color:       rgba(0, 0, 0, 0.82);
```

**フォント原則**
- `"Segoe UI"` は使用しない（website/ との印象差が大きい）
- `"Hiragino Kaku Gothic ProN"` を先頭に置き、macOS での表示品質を優先する
- Google Fonts は一切参照しない

### 4.4 Components（docs/ 共通）

#### ステップ番号

```css
.step-num {
  width:            32px;
  height:           32px;
  background:       #2563eb;
  color:            #fff;
  border-radius:    50%;
  display:          flex;
  align-items:      center;
  justify-content:  center;
  font-size:        15px;
  font-weight:      700;
  flex-shrink:      0;
}
```

#### カード

```css
.card {
  background:    #fff;
  border:        1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding:       16px 20px;
}
```

#### 通知ボックス

```css
.notice {
  background:    #fffbeb;
  border:        1px solid #fde68a;
  border-radius: 8px;
  color:         #92400e;
}
```

### 4.5 file: demo.html

**制約**
- コンテナ幅: max-width 680px
- 拡張機能内部ページのため変換機能は動作しない旨を冒頭に通知ボックスで表示

**スタイル仕様**

```css
body {
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
  color:       rgba(0, 0, 0, 0.82);
  background:  #f8fafc;
  line-height: 1.7;
}

.header {
  background: #2563eb;   /* website/ のブルーに統一 */
  color:      #fff;
  text-align: center;
  padding:    36px 20px 28px;
}

section h2 {
  color:       #2563eb;
  border-left: 3px solid #2563eb;
  padding-left: 12px;
}
```

**セクション構成**
1. ヘッダー（タイトル + 説明文）
2. 通知ボックス（このページでは変換不可の旨）
3. 使い方（3ステップ）
4. サンプル画像（SVG で生成した画像グリッド）

**サンプル画像について**
- base64 PNG は使用しない（崩れが発生するため）
- SVG をインラインで記述し、シンプルなグラフィックを表示する
- サイズ: 幅 100% / 高さ 120px 程度のプレースホルダー

### 4.6 file: popup.html

**制約**
- 幅: **240px 固定**（変更不可）
- 高さ: コンテンツに応じて自動
- `popup.js` によりリンクは `chrome.tabs.create` で新タブ開き（`<a href>` の通常遷移は使用しない）
- バージョン番号は `chrome.runtime.getManifest()` から動的取得（`id="version"` 要素）

**スタイル仕様**

```css
body {
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
  width:       240px;
  color:       rgba(0, 0, 0, 0.82);
}

/* ヘッダー */
.header {
  display:       flex;
  align-items:   center;
  gap:           10px;
  padding:       14px 16px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

/* 説明文 */
.desc {
  padding:     10px 16px;
  font-size:   12px;
  color:       rgba(0, 0, 0, 0.55);
  line-height: 1.6;
}

/* メニューリンク */
.menu a {
  display:     flex;
  align-items: center;
  gap:         8px;
  padding:     10px 16px;
  font-size:   13px;
  color:       rgba(0, 0, 0, 0.82);
  border-top:  1px solid rgba(0, 0, 0, 0.1);
  transition:  background 0.1s;
}
.menu a:hover {
  background: rgba(0, 0, 0, 0.04);
}

/* アイコン */
.icon {
  color: rgba(0, 0, 0, 0.36);
}

/* バージョン */
.version {
  padding:    8px 16px;
  font-size:  11px;
  color:      rgba(0, 0, 0, 0.36);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
```

**UI構成**
1. ヘッダー（アイコン48px + プロダクト名）
2. 説明文（右クリックで変換できる旨）
3. メニューリンク × 3（デモ・使い方ガイド / 紹介ページ / GitHub）
4. バージョン表示（動的）

## 5. Do's and Don'ts

### Do（推奨）

**website/**
- テキストカラーは `rgba()` opacity ベースで指定し、純黒 `#000000` や固定 hex テキスト色を避ける
- CTA ボタンは必ずピル型（`border-radius: 999px`）を使用する
- カードホバー時は `translateY(-2px)` + デュアルシャドウで浮き上がりを演出する
- 本文 `line-height: 1.8` を維持する
- h2 の `letter-spacing` は `0em`（neutral）にとどめ、DM Mono ラベルとの差別化を保つ
- ボーダーは `rgba(0,0,0,0.1)` を使用し、固定 hex 値は使わない
- CSS 変数（`--blue`、`--text` 等）を必ず使用する

**docs/**
- フォントは `"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif` を使用する
- Google Fonts は一切参照しない
- カラーは直書きで記述し、CSS 変数を使用しない
- ブルーは `#2563eb`（website/ に統一）を使用する
- サンプル画像は SVG で記述し、base64 PNG は使用しない

### Don't（禁止）

**website/**
- `font-family` にシステムフォントのみを指定しない（Noto Sans JP が必須）
- ボタンの `border-radius` を `12px` 以下にしない（ピル型を維持）
- テキストカラーに `#0f172a` や `#475569` などの固定 hex 値を新規使用しない
- ダークモード対応コードを追加しない（現時点では非対応）
- `--shadow` を素のカード状態に適用しない（ホバー専用）

**docs/**
- `"Segoe UI"` をフォントスタック先頭に使用しない
- `#2979c2` など旧ブルー値を使用しない（`#2563eb` に統一）
- base64 埋め込み画像を使用しない（SVG を使用する）
- CSS 変数を使用しない（直書きで統一）
- popup.html の幅（240px）を変更しない

---

## 6. Agent Prompt Guide

### クイックリファレンス

**website/**
```
Primary Color:  #2563eb
Text Color:     rgba(0,0,0,0.82)
Background:     #ffffff
Subtle BG:      #f8fafc
Border:         rgba(0,0,0,0.1)
Font:           "Noto Sans JP", sans-serif
Mono Font:      "DM Mono", monospace
Body Size:      16px
Line Height:    1.8
Button Radius:  999px（ピル型）
Card Radius:    12px
Dark Mode:      非対応
```

**docs/**
```
Primary Color:  #2563eb
Text Color:     rgba(0,0,0,0.82)
Background:     #f8fafc
Border:         rgba(0,0,0,0.1)
Font:           "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif
Body Size:      14px
Line Height:    1.7（demo.html）/ 1.6（popup.html）
popup Width:    240px固定
CSS Variables:  使用しない
Google Fonts:   使用不可
Dark Mode:      非対応
```

### プロンプト例

**website/index.html を修正する場合**
```
DESIGN.md（website/ セクション）に従って index.html を修正してください。
- テキストカラー: rgba(0,0,0,0.82)（CSS変数 --text）
- フォント: "Noto Sans JP", sans-serif / 等幅: "DM Mono", monospace
- 本文 line-height: 1.8
- CTA ボタン: border-radius: 999px（ピル型）、padding: 12px 28px
- カードホバー: translateY(-2px) + --shadow（デュアルシャドウ）
- h2 letter-spacing: 0em
- ボーダー: rgba(0,0,0,0.1)
- CSS変数（--blue, --text, --border 等）を必ず使用する
- ダークモード対応は不要
```

**docs/demo.html を修正する場合**
```
DESIGN.md（docs/ セクション）に従って demo.html を修正してください。
- Google Fonts は使用不可（CSP制約）
- フォント: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif
- テキストカラー: rgba(0,0,0,0.82)（直書き・CSS変数不使用）
- ブルー: #2563eb（website/ に統一）
- サンプル画像: SVG をインライン記述（base64 PNG は使用しない）
- 通知ボックス: background #fffbeb, border #fde68a, color #92400e
- コンテナ幅: max-width 680px
```

**docs/popup.html を修正する場合**
```
DESIGN.md（docs/ セクション）に従って popup.html を修正してください。
- 幅: 240px 固定（変更不可）
- Google Fonts は使用不可
- フォント: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif
- テキストカラー: rgba(0,0,0,0.82)（直書き・CSS変数不使用）
- ボーダー: rgba(0,0,0,0.1)
- ホバー背景: rgba(0,0,0,0.04)
- リンクは chrome.tabs.create で新タブ開き（popup.js が担当）
- バージョン表示は id="version" 要素を維持する
```
