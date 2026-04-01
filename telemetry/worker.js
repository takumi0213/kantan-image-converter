// かんたん画像変換 - Chrome extension to convert and save web images
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
 * 環境変数（wrangler secret put で登録）:
 *   GA4_MEASUREMENT_ID  - GA4 プロパティのMeasurement ID (例: G-XXXXXXXXXX)
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

// ── メインハンドラ ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    // POST のみ受け付ける
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // リクエストボディを JSON としてパース
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const { eventName, params } = body;

    // ── バリデーション（background.js の sendTelemetry と同一ロジック）──
    if (!ALLOWED_EVENTS.has(eventName)) {
      return new Response("Bad Request", { status: 400 });
    }
    if (params?.format === undefined || params?.extension_version === undefined) {
      return new Response("Bad Request", { status: 400 });
    }
    if (!ALLOWED_FORMATS.has(params.format)) {
      return new Response("Bad Request", { status: 400 });
    }
    if (!/^\d+\.\d+\.\d+$/.test(params.extension_version)) {
      return new Response("Bad Request", { status: 400 });
    }
    if (eventName === "conversion_result") {
      if (!ALLOWED_RESULTS.has(params.result)) {
        return new Response("Bad Request", { status: 400 });
      }
    }
    if (eventName === "conversion_error") {
      if (!ALLOWED_REASONS.has(params.reason)) {
        return new Response("Bad Request", { status: 400 });
      }
    }
    for (const key of FORBIDDEN_KEYS) {
      if (key in params) {
        return new Response("Bad Request", { status: 400 });
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
      // client_id は毎回の乱数とし、ユーザーの継続追跡を防ぐ
      client_id: `ext_${Math.random().toString(36).slice(2, 10)}`,
      non_personalized_ads: true,
      events: [{ name: eventName, params: eventParams }],
    };

    // ── GA4 へ転送 ────────────────────────────────────────────────────────
    const ga4Url = `${GA4_ENDPOINT}?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
    try {
      await fetch(ga4Url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // GA4 への送信失敗は無視（拡張機能側と同様の方針）
    }

    // 拡張機能には成功を返す（GA4 の応答を待たせない）
    return new Response(null, { status: 204 });
  },
};
