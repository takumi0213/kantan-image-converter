// かんたん画像変換 - Browser extension to convert and save web images
// Copyright (C) 2026 takumi0213
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/**
 * かんたん画像変換 テレメトリプロキシ (Cloudflare Worker)
 *
 * 拡張機能から受け取ったイベントを検証し、GA4 Measurement Protocol へ転送する。
 * api_secret は Worker の環境変数 (シークレット) に保管し、
 * 拡張機能のソースコードには一切含まれない。
 *
 * 環境変数:
 *   GA4_MEASUREMENT_ID  - GA4 プロパティの Measurement ID
 *   GA4_API_SECRET      - GA4 Measurement Protocol の API Secret
 */

"use strict";

// ── バリデーション定数 ──────────────────────────────────────────────────────
const ALLOWED_EVENTS  = new Set(["conversion_result", "conversion_error"]);
const ALLOWED_FORMATS = new Set(["jpg", "png", "webp"]);
const ALLOWED_RESULTS = new Set(["success", "fallback", "error"]);
const ALLOWED_REASONS = new Set([
  "unsupported_scheme",
  "execute_script_failed",
  "content_script_error",
  "canvas_error",
  "cors",
  "download_failed",
  "fallback_download_failed",
  "unknown",
]);
const FORBIDDEN_KEYS = [
  "url", "src", "srcUrl", "tab", "tabUrl", "filename",
  "message", "errorMessage", "sessionId", "userId", "clientId",
];

const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";

// ── CORS ヘッダーを付与するヘルパー ──────────────────────────────────────
// chrome-extension:// / moz-extension:// Origin に対してのみ許可する
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

// ── メインハンドラ ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // 環境変数の設定確認（Origin不明のため CORSヘッダーなし）
    if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
      console.error("[telemetry] GA4_MEASUREMENT_ID or GA4_API_SECRET is not set");
      return new Response("Internal Server Error", { status: 500 });
    }

    // Origin を chrome-extension:// / moz-extension:// に限定し、拡張機能 ID を allowlist で照合
    // ALLOWED_EXTENSION_ORIGIN / ALLOWED_GECKO_EXTENSION_ORIGIN 未設定時はスキーム一致のみで許可
    const origin = request.headers.get("Origin") ?? "";
    if (origin.startsWith("chrome-extension://")) {
      if (env.ALLOWED_EXTENSION_ORIGIN && origin !== env.ALLOWED_EXTENSION_ORIGIN) {
        return new Response("Forbidden", { status: 403 });
      }
    } else if (origin.startsWith("moz-extension://")) {
      if (env.ALLOWED_GECKO_EXTENSION_ORIGIN && origin !== env.ALLOWED_GECKO_EXTENSION_ORIGIN) {
        return new Response("Forbidden", { status: 403 });
      }
    } else {
      return new Response("Forbidden", { status: 403 });
    }

    // CORS プリフライト（OPTIONS）への応答
    // Content-Type: application/json を含む POST には事前確認リクエストが発生するため必須
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // POST のみ受け付ける
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(origin) });
    }

    // リクエストボディを JSON としてパース
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }

    // body が null または非オブジェクトの場合は弾く
    if (!body || typeof body !== "object") {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }

    const { eventName, params } = body;

    // ── バリデーション（background.js の sendTelemetry と同一ロジック）──
    if (!ALLOWED_EVENTS.has(eventName)) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }
    // params の型チェック（非オブジェクトでは in 演算子が TypeError になるため必須）
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }
    if (params?.format === undefined || params?.extension_version === undefined) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }
    if (!ALLOWED_FORMATS.has(params.format)) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }
    if (!/^\d+\.\d+\.\d+$/.test(params.extension_version)) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
    }
    if (eventName === "conversion_result") {
      if (!ALLOWED_RESULTS.has(params.result)) {
        return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
      }
    }
    if (eventName === "conversion_error") {
      if (!ALLOWED_REASONS.has(params.reason)) {
        return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
      }
    }
    for (const key of FORBIDDEN_KEYS) {
      if (key in params) {
        return new Response("Bad Request", { status: 400, headers: corsHeaders(origin) });
      }
    }

    // ── ペイロード構築（許可フィールドのみ）──────────────────────────────
    const eventParams = { extension_version: params.extension_version };
    if (eventName === "conversion_result") {
      eventParams.format = params.format;
      eventParams.result = params.result;
    } else if (eventName === "conversion_error") {
      eventParams.format = params.format;
      eventParams.reason = params.reason;
    }

    const payload = {
      // client_id は GA4 Measurement Protocol で一般的な「数値.タイムスタンプ」形式にする
      // 毎回新しい値を生成し、ユーザーの継続追跡を防ぐ
      client_id: `${crypto.getRandomValues(new Uint32Array(1))[0]}.${Date.now()}`,
      non_personalized_ads: true,
      events: [{ name: eventName, params: eventParams }],
    };

    // ── GA4 へ転送（バックグラウンド実行）───────────────────────────────
    // ctx.waitUntil() でレスポンス返却後もリクエストを継続し、
    // 拡張機能を GA4 応答待ちにさせない
    const ga4Url = `${GA4_ENDPOINT}?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
    ctx.waitUntil(
      fetch(ga4Url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        // GA4 への送信失敗は無視
      })
    );

    // 拡張機能には即座に成功を返す（GA4 の応答は待たない）
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  },
};
