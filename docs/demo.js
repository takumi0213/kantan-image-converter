const grid = document.getElementById("sampleGrid");

const samples = [
  { name: "風景", format: "jpg", draw: drawLandscape },
  { name: "図形パターン", format: "png", draw: drawPattern },
  { name: "グラデーション", format: "webp", draw: drawGradient },
];

samples.forEach(({ name, format, draw }) => {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  draw(ctx, 400, 320);

  const mime = format === "jpg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
  const dataUrl = canvas.toDataURL(mime, 0.92);

  const card = document.createElement("div");
  card.className = "sample-card";
  card.innerHTML = `
    <img src="${dataUrl}" alt="${name}のサンプル画像">
    <div class="label">
      <span>${name}</span>
      <span class="format-badge ${format}">${format}</span>
    </div>
  `;
  grid.appendChild(card);
});

// SVG サンプル（インラインSVG）
const svgCard = document.createElement("div");
svgCard.className = "sample-card";
svgCard.innerHTML = `
  <img src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='320' viewBox='0 0 400 320'>
    <rect width='400' height='320' fill='%23f0f4f8'/>
    <circle cx='120' cy='130' r='60' fill='%232979c2' opacity='0.8'/>
    <circle cx='200' cy='170' r='50' fill='%23e8593c' opacity='0.7'/>
    <circle cx='280' cy='130' r='55' fill='%232b8a3e' opacity='0.7'/>
    <text x='200' y='270' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%236c757d'>SVG Sample</text>
  </svg>`)}" alt="SVGサンプル画像">
  <div class="label">
    <span>SVG図形</span>
    <span class="format-badge svg">svg</span>
  </div>
`;
grid.appendChild(svgCard);

// ── Canvas描画関数 ──

function drawLandscape(ctx, w, h) {
  // 空
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, "#87CEEB");
  sky.addColorStop(1, "#E0F0FF");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 太陽
  ctx.fillStyle = "#FFD93D";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.2, 30, 0, Math.PI * 2);
  ctx.fill();

  // 山（奥）
  ctx.fillStyle = "#7BA68A";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  ctx.lineTo(w * 0.3, h * 0.25);
  ctx.lineTo(w * 0.6, h * 0.55);
  ctx.closePath();
  ctx.fill();

  // 山（手前）
  ctx.fillStyle = "#5B8C6B";
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.6);
  ctx.lineTo(w * 0.55, h * 0.28);
  ctx.lineTo(w * 0.85, h * 0.6);
  ctx.closePath();
  ctx.fill();

  // 地面
  ctx.fillStyle = "#6DBF7B";
  ctx.fillRect(0, h * 0.58, w, h * 0.42);

  // 雲
  drawCloud(ctx, w * 0.2, h * 0.15, 1.0);
  drawCloud(ctx, w * 0.55, h * 0.1, 0.7);
}

function drawCloud(ctx, x, y, scale) {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
  ctx.arc(x + 25 * scale, y - 8 * scale, 24 * scale, 0, Math.PI * 2);
  ctx.arc(x + 50 * scale, y, 18 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawPattern(ctx, w, h) {
  ctx.fillStyle = "#F8F9FA";
  ctx.fillRect(0, 0, w, h);

  const colors = ["#2979c2", "#e8593c", "#2b8a3e", "#FFD93D", "#9775C7"];
  const size = 40;

  for (let row = 0; row < h / size + 1; row++) {
    for (let col = 0; col < w / size + 1; col++) {
      const x = col * size;
      const y = row * size;
      const ci = (row + col) % colors.length;

      ctx.globalAlpha = 0.7;

      if ((row + col) % 3 === 0) {
        ctx.fillStyle = colors[ci];
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if ((row + col) % 3 === 1) {
        ctx.fillStyle = colors[ci];
        ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
      } else {
        ctx.fillStyle = colors[ci];
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + 6);
        ctx.lineTo(x + size - 6, y + size - 6);
        ctx.lineTo(x + 6, y + size - 6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawGradient(ctx, w, h) {
  const g1 = ctx.createLinearGradient(0, 0, w, h);
  g1.addColorStop(0, "#667EEA");
  g1.addColorStop(0.5, "#764BA2");
  g1.addColorStop(1, "#F093FB");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // 装飾の円
  for (let i = 0; i < 8; i++) {
    const cx = Math.sin(i * 0.9) * w * 0.3 + w * 0.5;
    const cy = Math.cos(i * 1.1) * h * 0.3 + h * 0.5;
    const r = 20 + i * 8;
    ctx.fillStyle = `rgba(255,255,255,${0.06 + i * 0.02})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}