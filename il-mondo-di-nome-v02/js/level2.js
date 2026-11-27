// L2 «Il Bruco Goloso» — serpente (motore S, 1ª versione). GDD §2.1. Testa del bruco = testa del festeggiato.
import { COL, rng, tornRect, drawPoly, texturePattern, Confetti, drawStarShape } from "./paper.js";

const TARGET = { passeggiata: 12, avventura: 20, sfida: 28 };

export function createLevel2(api) {
  const { canvas, head, mode } = api;
  const g = canvas.getContext("2d");
  const pat = texturePattern(g);
  const conf = new Confetti();
  const target = TARGET[mode.id];
  const ROWS = 13;
  let cols = 17, cell = 30, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;
  let snake, dir, nextDirs, food, cake, eaten, cakesSpawned, cakesEaten, lives, defeats = 0, acc = 0, t = 0, done = false, hitFlash = 0, livesLost = 0;
  const STEP = 0.17; // secondi per passo a velocità 100%

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = Math.round(canvas.clientWidth * dpr); H = canvas.height = Math.round(canvas.clientHeight * dpr);
    // con la croce a schermo il campo si sposta e non finisce sotto i tasti (QA-PROTO-026)
    const portrait = H > W, PADR = 240 * dpr;
    const top = 76 * dpr, bottom = (dpadOn && portrait ? PADR : 20 * dpr), left = (dpadOn && !portrait ? PADR : 20 * dpr), side = 20 * dpr;
    if (startPortrait === null) startPortrait = portrait;
    const availW = W - left - side, availH = H - top - bottom;
    const newCols = Math.max(11, Math.min(23, Math.round(ROWS * availW / availH)));
    if (!snake) cols = newCols; // la griglia non cambia a partita iniziata
    cell = Math.floor(Math.min(availW / cols, availH / ROWS));
    ox = Math.round(left + (availW - cols * cell) / 2); oy = Math.round(top + (availH - ROWS * cell) / 2);
  }

  function freeCell() {
    const r = Math.random;
    for (let i = 0; i < 500; i++) {
      const c = { x: Math.floor(r() * cols), y: Math.floor(r() * ROWS) };
      if (!snake.some(s => s.x === c.x && s.y === c.y) && !(food && food.x === c.x && food.y === c.y)) return c;
    }
    return { x: 0, y: 0 };
  }

  function placeSnake(len) {
    const cy = Math.floor(ROWS / 2), cx = Math.floor(cols / 2);
    snake = []; for (let i = 0; i < len; i++) snake.push({ x: Math.max(0, cx - i), y: cy }); // la parte in eccesso resta «arrotolata» e si srotola avanzando
    dir = { x: 1, y: 0 }; nextDirs = [];
  }
  function reset(full) {
    if (full) { eaten = 0; cakesSpawned = 0; cakesEaten = 0; livesLost = 0; placeSnake(3); }
    lives = mode.lives; food = null; food = freeCell(); cake = null; acc = 0;
  }
  let dpadOn = false, startPortrait = null;
  api.bindDpad("touch-l2", d => turn(d), on => { dpadOn = on; if (snake) layout(); }); // prima del primo layout: il campo tiene conto della croce
  layout(); reset(true);

  function turn(d) {
    const v = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d];
    const last = nextDirs.length ? nextDirs[nextDirs.length - 1] : dir;
    if (v.x === -last.x && v.y === -last.y) return; // niente inversione su se stesso
    if (v.x === last.x && v.y === last.y) return;
    if (nextDirs.length < 3) nextDirs.push(v);
  }
  const kd = e => {
    const m = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" }[e.key];
    if (m) { turn(m); e.preventDefault(); }
  };
  window.addEventListener("keydown", kd);
  // scorrimento del dito
  let sx = null, sy = null;
  const ts = e => { const p = e.touches ? e.touches[0] : e; sx = p.clientX; sy = p.clientY; };
  const tm = e => {
    if (sx === null) return; const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) { turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")); sx = p.clientX; sy = p.clientY; }
    e.preventDefault();
  };
  const te = () => { sx = sy = null; };
  canvas.addEventListener("touchstart", ts, { passive: true }); canvas.addEventListener("touchmove", tm, { passive: false }); canvas.addEventListener("touchend", te);

  function hud() {
    api.hud(mode.lives === Infinity ? "♥ ∞" : "♥ " + lives, `Lunghezza ${snake.length}/${target}`);
  }

  function crash() {
    hitFlash = 0.6;
    conf.burst(ox + (snake[0].x + .5) * cell, oy + (snake[0].y + .5) * cell, 16, [COL.salvia, "#fff", COL.senape]);
    if (mode.lives === Infinity) { // Passeggiata: si riparte dal centro, stessa lunghezza
      placeSnake(snake.length); return;
    }
    lives--; livesLost++;
    if (lives <= 0) {
      defeats++;
      api.defeat(defeats, () => {
        if (mode.id === "sfida") reset(true);
        else { placeSnake(Math.max(3, Math.floor(snake.length / 2))); reset(false); } // Avventura: lunghezza dimezzata
        api.resume();
      });
      return;
    }
    placeSnake(snake.length);
  }

  function step() {
    if (nextDirs.length) dir = nextDirs.shift();
    const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (h.x < 0 || h.y < 0 || h.x >= cols || h.y >= ROWS) return crash(); // siepe
    if (snake.slice(0, -1).some(s => s.x === h.x && s.y === h.y)) return crash(); // coda
    snake.unshift(h);
    let grow = 0;
    if (h.x === food.x && h.y === food.y) {
      grow = 1; eaten++; conf.burst(ox + (h.x + .5) * cell, oy + (h.y + .5) * cell, 10);
      food = freeCell();
      if (eaten % 5 === 0) { cake = { ...freeCell(), ttl: 6 }; cakesSpawned++; } // fetta di torta bonus ogni 5 dolcetti
    }
    if (cake && h.x === cake.x && h.y === cake.y) { grow += 2; cakesEaten++; conf.burst(ox + (h.x + .5) * cell, oy + (h.y + .5) * cell, 26); cake = null; }
    if (!grow) snake.pop(); else for (let i = 1; i < grow; i++) snake.push({ ...snake[snake.length - 1] });
    if (snake.length >= target) {
      done = true;
      const pct = cakesSpawned ? cakesEaten / cakesSpawned : 1;
      const stars = pct >= 0.8 ? (livesLost === 0 ? 3 : 2) : 1;
      api.win({ stars, detail: `Torte bonus ${cakesEaten}/${cakesSpawned}${livesLost === 0 ? " · senza urti" : ""}` });
    }
  }

  function update(dt) {
    if (done) return;
    t += dt; hitFlash -= dt;
    if (cake) { cake.ttl -= dt * mode.speed; if (cake.ttl <= 0) cake = null; }
    acc += dt * mode.speed;
    while (acc >= STEP && !done) { acc -= STEP; step(); if (api.isPaused()) break; }
    conf.update(dt); hud();
  }

  function drawSweet(x, y, s) { // dolcetto: pirottino + crema + ciliegina (forma riconoscibile)
    g.save(); g.translate(x, y);
    drawPoly(g, [[-s * .32, -s * .02], [s * .32, -s * .02], [s * .24, s * .34], [-s * .24, s * .34]], COL.mare, { lw: 2 });
    g.beginPath(); g.ellipse(0, -s * .08, s * .36, s * .2, 0, 0, 7); g.fillStyle = "#fff"; g.fill();
    g.beginPath(); g.ellipse(0, -s * .1, s * .32, s * .17, 0, 0, 7); g.fillStyle = "#f2c4cf"; g.fill();
    g.beginPath(); g.arc(0, -s * .3, s * .1, 0, 7); g.fillStyle = COL.terracotta; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
    g.restore();
  }
  function drawCake(x, y, s, blink) { // fetta di torta: triangolo a strati
    g.save(); g.translate(x, y); g.scale(1 + Math.sin(t * 5) * .06, 1 + Math.sin(t * 5) * .06);
    if (blink) g.globalAlpha = 0.55;
    drawPoly(g, [[-s * .45, s * .3], [s * .45, s * .3], [s * .45, -s * .05], [-s * .45, -s * .3]], "#f6e3b4", { lw: 3 });
    g.fillStyle = COL.terracotta; g.fillRect(-s * .43, s * .06, s * .86, s * .07);
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(-s * .45, -s * .3); g.lineTo(s * .45, -s * .05); g.lineTo(s * .45, -s * .12); g.lineTo(-s * .45, -s * .38); g.fill();
    drawStarShape(g, s * .2, -s * .3, s * .14, COL.senape);
    g.restore();
  }

  function draw() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#e8efe0"; g.fillRect(0, 0, W, H);
    // siepe morbida attorno al campo
    const fw = cols * cell, fh = ROWS * cell, hedge = Math.max(10, cell * .45);
    drawPoly(g, tornRect(ox - hedge, oy - hedge, fw + hedge * 2, fh + hedge * 2, 5, 4), "#5c8a69");
    g.fillStyle = "#7aa886"; for (let i = 0; i < (fw + fh) * 2 / (hedge * 1.2); i++) {
      const p = i * hedge * 1.2; let x, y;
      if (p < fw) { x = ox + p; y = oy - hedge / 2; } else if (p < fw + fh) { x = ox + fw + hedge / 2; y = oy + p - fw; } else if (p < fw * 2 + fh) { x = ox + fw - (p - fw - fh); y = oy + fh + hedge / 2; } else { x = ox - hedge / 2; y = oy + fh - (p - fw * 2 - fh); }
      g.beginPath(); g.arc(x, y, hedge * .55, 0, 7); g.fill();
    }
    // prato a quadretti di carta
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < cols; x++) { g.fillStyle = (x + y) % 2 ? "#a9c9a4" : "#b6d3ae"; g.fillRect(ox + x * cell, oy + y * cell, cell, cell); }
    // cibo
    drawSweet(ox + (food.x + .5) * cell, oy + (food.y + .55) * cell, cell * .95);
    if (cake) drawCake(ox + (cake.x + .5) * cell, oy + (cake.y + .5) * cell, cell * 1.05, cake.ttl < 2 && Math.floor(t * 4) % 2);
    // bruco: segmenti di carta salvia/senape, testa = foto
    const flash = hitFlash > 0 && Math.floor(t * 6) % 2;
    for (let i = snake.length - 1; i >= 1; i--) {
      const s = snake[i], x = ox + (s.x + .5) * cell, y = oy + (s.y + .5) * cell, r = cell * (i === snake.length - 1 ? .36 : .46);
      g.beginPath(); g.arc(x + 2, y + 3, r, 0, 7); g.fillStyle = "rgba(43,35,32,.22)"; g.fill();
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = flash ? "#fff" : (i % 2 ? COL.salvia : COL.senape); g.fill();
      g.lineWidth = Math.max(2, cell * .07); g.strokeStyle = "#fff"; g.stroke();
      if (i % 2 === 0) { g.fillStyle = COL.ink; g.beginPath(); g.arc(x - r * .4, y + r * .7, r * .16, 0, 7); g.arc(x + r * .4, y + r * .7, r * .16, 0, 7); g.fill(); } // zampette
    }
    const hd = snake[0], hx = ox + (hd.x + .5) * cell, hy = oy + (hd.y + .5) * cell;
    const hh = Math.max(cell * 1.5, 28 * dpr), hw = hh * 0.8; // testa ≥ 28 px CSS
    g.save(); g.translate(hx, hy); g.rotate(dir.x * 0.12);
    // antennine
    g.strokeStyle = COL.ink; g.lineWidth = Math.max(2, cell * .06); g.beginPath(); g.moveTo(-hw * .2, -hh * .42); g.lineTo(-hw * .38, -hh * .7); g.moveTo(hw * .2, -hh * .42); g.lineTo(hw * .38, -hh * .7); g.stroke();
    g.fillStyle = COL.terracotta; g.beginPath(); g.arc(-hw * .38, -hh * .7, cell * .12, 0, 7); g.arc(hw * .38, -hh * .7, cell * .12, 0, 7); g.fill();
    g.drawImage(head, -hw / 2, -hh / 2, hw, hh);
    g.restore();
    conf.draw(g);
    g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.45; g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  }

  return {
    resize: layout, update, draw,
    gridMismatch: () => { const portrait = canvas.clientHeight > canvas.clientWidth; return startPortrait !== null && portrait !== startPortrait; },
    restart() { done = false; defeats = 0; snake = null; layout(); reset(true); },
    skipWin() { done = true; api.win({ stars: 1, detail: "Prosegui comunque", skipped: true }); },
    destroy() { window.removeEventListener("keydown", kd); canvas.removeEventListener("touchstart", ts); canvas.removeEventListener("touchmove", tm); canvas.removeEventListener("touchend", te); },
    debug: () => ({ ox, oy, dpr, dpadOn, len: snake.length, target, lives, cols, rows: ROWS, cell, head: snake[0], dir, food }),
    _grow(n) { for (let i = 0; i < n; i++) snake.push({ ...snake[snake.length - 1] }); },
  };
}
