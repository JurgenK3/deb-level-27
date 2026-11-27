// Texture di carta generata nel browser (nessun file esterno) + utilità di disegno «carta ritagliata».
export const COL = { kraft: "#F3E9D7", ink: "#2B2320", terracotta: "#C8553D", salvia: "#6B9A7A", senape: "#E0A526", mare: "#3F7CAC", carta: "#FFFDF7", off: "#6B5E55" };

export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let texCanvas = null;
export function paperTexture() {
  if (texCanvas) return texCanvas;
  const n = 256, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d"), r = rng(7);
  const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const v = 238 + Math.floor(r() * 17); img.data.set([v, v, v - 2, 255], i * 4); }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.08; g.strokeStyle = "#7a6a5a"; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) { // fibre
    const x = r() * n, y = r() * n, a = r() * Math.PI, l = 6 + r() * 18;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l / 2 + r() * 4, y + Math.sin(a) * l / 2, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  texCanvas = c; return c;
}
export function applyPageTexture() {
  document.documentElement.style.setProperty("--paper-tex", `url(${paperTexture().toDataURL()})`);
}

/** Poligono «strappato a mano» deterministico per un rettangolo */
export function tornRect(x, y, w, h, seed, j = 3) {
  const r = rng(seed), pts = [];
  const step = 14;
  for (let i = 0; i <= w; i += step) pts.push([x + i, y + (r() - 0.5) * j]);
  for (let i = 0; i <= h; i += step) pts.push([x + w + (r() - 0.5) * j, y + i]);
  for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h + (r() - 0.5) * j]);
  for (let i = h; i >= 0; i -= step) pts.push([x + (r() - 0.5) * j, y + i]);
  return pts;
}
export function drawPoly(g, pts, fill, { outline = "#fff", lw = 3, shadow = true } = {}) {
  const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  if (shadow) { g.save(); g.translate(3, 4); g.fillStyle = "rgba(43,35,32,.22)"; path(); g.fill(); g.restore(); }
  path(); g.fillStyle = fill; g.fill();
  if (outline) { g.lineWidth = lw; g.strokeStyle = outline; g.lineJoin = "round"; g.stroke(); }
}
export function texturePattern(g) { return g.createPattern(paperTexture(), "repeat"); }

/** Coriandoli di carta: i nemici «scoppiano» così (mai violenti) */
export class Confetti {
  constructor() { this.p = []; }
  burst(x, y, n = 18, cols = [COL.senape, COL.terracotta, COL.salvia, COL.mare, "#fff"]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.9 + Math.random() * 0.5, c: cols[i % cols.length], r: Math.random() * 6, s: 4 + Math.random() * 5 });
    }
  }
  update(dt) { for (const q of this.p) { q.vy += 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; q.r += dt * 6; } this.p = this.p.filter(q => q.life > 0); }
  draw(g) { for (const q of this.p) { g.save(); g.globalAlpha = Math.min(1, q.life * 2); g.translate(q.x, q.y); g.rotate(q.r); g.fillStyle = q.c; g.fillRect(-q.s / 2, -q.s / 4, q.s, q.s / 2); g.restore(); } }
}

/** Candelina da raccogliere (forma: stelo + fiamma a goccia, riconoscibile anche senza colore) */
export function drawCandle(g, x, y, t) {
  g.save(); g.translate(x, y);
  g.fillStyle = "rgba(43,35,32,.2)"; g.fillRect(-5, -10, 12, 30);
  g.fillStyle = "#fff"; g.fillRect(-7, -12, 14, 32);
  g.fillStyle = COL.mare; g.fillRect(-5, -10, 10, 28);
  g.fillStyle = "#fff"; for (let i = 0; i < 3; i++) g.fillRect(-5, -6 + i * 9, 10, 3);
  const f = Math.sin(t * 8 + x) * 1.5;
  g.beginPath(); g.moveTo(0, -30 + f); g.quadraticCurveTo(9, -18, 0, -13); g.quadraticCurveTo(-9, -18, 0, -30 + f);
  g.fillStyle = COL.senape; g.fill(); g.lineWidth = 2; g.strokeStyle = COL.ink; g.stroke();
  g.restore();
}

/** Nuvoletta Brontolone: nuvola di carta grigio-blu con sopracciglia aggrottate */
export function drawGrumpy(g, x, y, w, h, t, dir) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(dir < 0 ? -1 : 1, 1 + Math.sin(t * 6) * 0.04);
  const blobs = [[-w * .25, h * .1, h * .38], [0, -h * .12, h * .45], [w * .25, h * .08, h * .36], [0, h * .18, h * .34]];
  const fillB = (c, o) => { g.fillStyle = c; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx + o, by + o, br, 0, 7); g.fill(); } };
  fillB("rgba(43,35,32,.22)", 4); fillB("#fff", 0);
  g.fillStyle = "#8fa3b8"; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br - 3, 0, 7); g.fill(); }
  g.fillStyle = COL.ink; g.beginPath(); g.arc(-w * .1, -h * .02, 3.5, 0, 7); g.arc(w * .14, -h * .02, 3.5, 0, 7); g.fill();
  g.strokeStyle = COL.ink; g.lineWidth = 3; g.lineCap = "round";
  g.beginPath(); g.moveTo(-w * .2, -h * .2); g.lineTo(-w * .04, -h * .12); g.moveTo(w * .24, -h * .2); g.lineTo(w * .08, -h * .12); g.stroke();
  g.beginPath(); g.arc(w * .02, h * .2, 7, Math.PI + 0.4, -0.4); g.stroke();
  g.restore();
}

export function drawStarShape(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = COL.ink; g.stroke();
}
