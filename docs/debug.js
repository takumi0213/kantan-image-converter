"use strict";

// ── 1. アニメーションGIF（最小2フレーム）──
// GIF89a, 2x2px, 2 frames
const animGifB64 =
  "R0lGODlhAgACAKECAAAAAP8AAP///wAAACH5BAEKAAMALAAAAAACAAIAAAIDRBYFADs=";

appendCard("animSection", {
  src: `data:image/gif;base64,${animGifB64}`,
  title: "アニメーションGIF（2フレーム）",
  detail: "data URI / GIF89a",
  expected: "変換せず元のGIFとして保存される",
});

// ── 2. data URI 画像 ──
const dataCanvas = document.createElement("canvas");
dataCanvas.width = 200;
dataCanvas.height = 160;
const dctx = dataCanvas.getContext("2d");
dctx.fillStyle = "#2979c2";
dctx.fillRect(0, 0, 200, 160);
dctx.fillStyle = "#fff";
dctx.font = "bold 20px sans-serif";
dctx.textAlign = "center";
dctx.fillText("data:URI", 100, 88);

appendCard("dataUriSection", {
  src: dataCanvas.toDataURL("image/png"),
  title: "data URI (PNG)",
  detail: "data:image/png;base64,...",
  expected: "Canvas経由で変換、ファイル名は日時形式",
});

appendCard("dataUriSection", {
  src: dataCanvas.toDataURL("image/jpeg", 0.9),
  title: "data URI (JPEG)",
  detail: "data:image/jpeg;base64,...",
  expected: "Canvas経由で変換、ファイル名は日時形式",
});

// ── 3. SVG 画像 ──
const svgContent = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'>
  <rect width='200' height='160' fill='%23f0f4f8'/>
  <rect x='40' y='30' width='120' height='100' rx='8' fill='%232979c2' opacity='0.8'/>
  <text x='100' y='90' text-anchor='middle' font-family='sans-serif' font-size='14' fill='white'>SVG</text>
</svg>`;

appendCard("svgSection", {
  src: `data:image/svg+xml,${encodeURIComponent(svgContent)}`,
  title: "インラインSVG",
  detail: "data:image/svg+xml,...",
  expected: "変換せず元のSVGとして保存される",
});

// ── 4. 透過画像 ──
const transCanvas = document.createElement("canvas");
transCanvas.width = 200;
transCanvas.height = 160;
const tctx = transCanvas.getContext("2d");
tctx.fillStyle = "rgba(41, 121, 194, 0.6)";
tctx.beginPath();
tctx.arc(70, 80, 50, 0, Math.PI * 2);
tctx.fill();
tctx.fillStyle = "rgba(232, 89, 60, 0.6)";
tctx.beginPath();
tctx.arc(130, 80, 50, 0, Math.PI * 2);
tctx.fill();

appendCard("transparentSection", {
  src: transCanvas.toDataURL("image/png"),
  title: "透過PNG（半透明円2つ）",
  detail: "背景が透明な画像",
  expected: "JPG変換時: 透過部分が白背景に / PNG,WebP: 透過維持",
});

// ── 5. ファイル名テスト用 ──
const fnCanvas = document.createElement("canvas");
fnCanvas.width = 200;
fnCanvas.height = 160;
const fctx = fnCanvas.getContext("2d");
fctx.fillStyle = "#495057";
fctx.fillRect(0, 0, 200, 160);
fctx.fillStyle = "#fff";
fctx.font = "14px monospace";
fctx.textAlign = "center";
fctx.fillText("Filename Test", 100, 88);

appendCard("filenameSection", {
  src: fnCanvas.toDataURL("image/png"),
  title: "data URI（ファイル名なし）",
  detail: "URLからファイル名取得不可",
  expected: "日時形式 YYYYMMDD_HHMMSS.ext で保存",
});

// ── ヘルパー ──
function appendCard(sectionId, { src, title, detail, expected }) {
  const section = document.getElementById(sectionId);
  const card = document.createElement("div");
  card.className = "test-card";
  card.innerHTML = `
    <img src="${src}" alt="${title}">
    <div class="meta">
      <strong>${title}</strong>
      <code>${detail}</code>
      <div class="expected">${expected}</div>
    </div>
  `;
  section.appendChild(card);
}