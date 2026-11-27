// L1 «Primi passi» — platform laterale (motore P, 1ª versione). GDD §2.1.
import { COL, rng, tornRect, drawPoly, texturePattern, Confetti, drawCandle, drawGrumpy, drawStarShape } from "./paper.js";

const VIEW_H = 440, GY = 340, PW = 30, PH = 84, SPR_H = 92, SPR_W = SPR_H * 0.4;
const TOL = { alta: { coyote: 0.15, buffer: 0.18, hit: 0.7 }, media: { coyote: 0.1, buffer: 0.12, hit: 0.85 }, bassa: { coyote: 0.05, buffer: 0.06, hit: 1 } };

function buildLevel(mode) {
  const ground = [], plats = [], candles = [], enemies = [];
  let cart = null, x = 0;
  const G = (a, b) => ground.push({ x1: a, x2: b });
  const P = (px, py, w) => plats.push({ x: px, y: py, w });
  const C = (cx, cy) => candles.push({ x: cx, y: cy, got: false });
  const E = (a, b) => enemies.push({ minX: a, maxX: b, x: a + (b - a) / 2, y: GY - 42, w: 54, h: 42, dir: -1, alive: true });
  // inizio: tutorial senza nemici, cartello del salto
  G(0, 760); C(320, GY - 30); C(380, GY - 30); C(440, GY - 30); P(560, GY - 85, 120); C(620, GY - 120);
  x = 760;
  const T = {
    gap() { G(x, x + 260); G(x + 370, x + 600); C(x + 300, GY - 110); C(x + 340, GY - 125); C(x + 380, GY - 100); },
    steps() { G(x, x + 600); P(x + 110, GY - 80, 110); P(x + 270, GY - 150, 110); P(x + 430, GY - 80, 110); C(x + 165, GY - 115); C(x + 325, GY - 185); C(x + 485, GY - 115); },
    enemy() { G(x, x + 600); C(x + 90, GY - 30); C(x + 530, GY - 30); E(x + 180, x + 460); },
    high(withCard) { G(x, x + 600); P(x + 140, GY - 90, 100); P(x + 290, GY - 175, 100); C(x + 340, GY - 210); C(x + 190, GY - 125);
      if (withCard) { P(x + 430, GY - 255, 90); cart = { x: x + 475, y: GY - 300, got: false }; } else C(x + 470, GY - 30); },
    bridge() { G(x, x + 200); P(x + 255, GY - 60, 110); G(x + 420, x + 600); C(x + 310, GY - 95); C(x + 460, GY - 30); },
    pitEnemy() { G(x, x + 300); G(x + 400, x + 600); E(x + 60, x + 260); C(x + 350, GY - 120); },
  };
  const seq = ["gap", "steps", "bridge", "high", "enemy", "gap", "highCard", "pitEnemy", "steps", "enemy", "bridge", "gap", "enemy"];
  for (const s of seq) { if (s === "highCard") T.high(true); else T[s](); x += 600; }
  G(x, x + 700); const archX = x + 380;
  // densità nemici per modalità: Passeggiata 50%, Sfida 120% (+ un nemico extra)
  let en = enemies;
  if (mode.id === "passeggiata") en = enemies.filter((_, i) => i % 2 === 0);
  if (mode.id === "sfida") { const extra = { ...enemies[1], minX: enemies[1].minX + 20, maxX: enemies[1].maxX - 20, x: enemies[1].minX + 40, dir: 1 }; en = [...enemies, extra]; }
  // niente nemici nei primi 2000 u (≈ primi 20 s di gioco del tutorial)
  en = en.filter(e => e.minX >= 2000);
  const end = x + 700;
  // checkpoint (girandole): Passeggiata ~ogni 1000 u, Avventura ~ogni 2000 u, Sfida solo a metà
  const cps = [];
  const every = mode.id === "passeggiata" ? 1000 : mode.id === "avventura" ? 2000 : null;
  const onGround = cx => ground.some(g => cx > g.x1 + 30 && cx < g.x2 - 30);
  const placeCp = target => { for (let d = 0; d < 400; d += 10) for (const c of [target + d, target - d]) if (onGround(c)) { cps.push({ x: c, on: false }); return; } };
  if (every) for (let t = every; t < end - 800; t += every) placeCp(t); else placeCp(Math.round(end / 2));
  return { ground, plats, candles, enemies: en, cart, archX, end, cps };
}

export function createLevel1(api) {
  const { canvas, frames, mode } = api;
  const g = canvas.getContext("2d");
  const tol = TOL[mode.tolerance];
  const conf = new Confetti();
  let L, pl, cam = 0, t = 0, keys = { left: false, right: false, jump: false }, jumpHeld = false, lastJumpPress = -9;
  let scale = 1, viewW = 800, offY = 0, lives, defeats = 0, checkpoint, invuln = 0, done = false, prevJump = false;
  const pat = texturePattern(g);
  const bgR = rng(3), clouds = Array.from({ length: 14 }, (_, i) => ({ x: i * 420 + bgR() * 200, y: 40 + bgR() * 90, s: 0.7 + bgR() * 0.6 }));

  function reset(full) {
    if (full) { L = buildLevel(mode); checkpoint = { x: 80 }; defeats = defeats || 0; t = 0; }
    pl = { x: checkpoint.x, y: GY - PH, vx: 0, vy: 0, onGround: true, coyote: 0, face: 1, holdT: 0, anim: 0, safeX: checkpoint.x };
    lives = mode.lives; invuln = full ? 0 : 1;
  }
  reset(true);

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
    scale = Math.min(canvas.height / VIEW_H, canvas.width / 460); // su 360 px CSS la testa resta ≥ 28 px
    viewW = canvas.width / scale; offY = (canvas.height - VIEW_H * scale) / 2;
  }

  const onKey = (e, down) => {
    const k = e.key;
    if (["ArrowLeft", "a", "A"].includes(k)) keys.left = down;
    else if (["ArrowRight", "d", "D"].includes(k)) keys.right = down;
    else if ([" ", "ArrowUp", "w", "W"].includes(k)) keys.jump = down;
    else return;
    e.preventDefault();
  };
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  api.bindTouch("touch-l1", (k, down) => { keys[k] = down; });

  function hud() {
    const lv = mode.lives === Infinity ? "♥ ∞" : "♥ " + lives;
    const got = L.candles.filter(c => c.got).length;
    api.hud(lv, `Candeline ${got}/${L.candles.length}${L.cart.got ? " · Cartolina ✓" : ""}`);
  }

  function solidAt(px1, px2) { return L.ground.some(s => px2 > s.x1 && px1 < s.x2); }

  function loseLife(reason) {
    if (invuln > 0 && reason === "hit") return;
    if (mode.lives === Infinity) { // Passeggiata: si arretra di poco, nessuna vita persa
      if (reason === "fall") { pl.x = pl.safeX; pl.y = GY - PH; pl.vy = 0; } else { pl.x -= 60 * pl.face; pl.vy = -300; }
      invuln = 1.2; return;
    }
    lives--; invuln = 1.5;
    if (lives <= 0) return defeat();
    if (reason === "fall") { pl.x = checkpoint.x; pl.y = GY - PH; pl.vy = 0; pl.vx = 0; }
    else { pl.vy = -360; pl.x -= 30 * pl.face; }
  }

  function defeat() {
    defeats++;
    if (mode.id === "sfida") checkpoint = { x: 80 };
    const restart = () => { if (mode.id === "sfida") reset(true); else reset(false); api.resume(); };
    api.defeat(defeats, restart);
  }

  function update(dtReal) {
    if (done) return;
    const dt = Math.min(dtReal, 1 / 30) * mode.speed; // velocità di gioco per modalità
    t += dt; invuln -= dt; pl.anim += dt;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) pl.face = dir;
    pl.vx = dir * 260;
    // salto con tolleranza (coyote time + memorizzazione del comando)
    if (keys.jump && !prevJump) lastJumpPress = t;
    prevJump = keys.jump;
    pl.coyote = pl.onGround ? tol.coyote : pl.coyote - dt;
    if (t - lastJumpPress <= tol.buffer && pl.coyote > 0) { pl.vy = -760; pl.onGround = false; pl.coyote = 0; lastJumpPress = -9; pl.holdT = 0.26; }
    // tenere premuto = salto più alto
    const grav = keys.jump && pl.holdT > 0 && pl.vy < 0 ? 1150 : 2300;
    pl.holdT -= dt;
    // movimento orizzontale + muri del terreno (bordi delle buche)
    pl.x += pl.vx * dt;
    if (pl.y + PH > GY + 2) for (const s of L.ground) {
      if (pl.x + PW > s.x1 && pl.x < s.x2) { if (pl.vx > 0) pl.x = s.x1 - PW; else if (pl.vx < 0) pl.x = s.x2; }
    }
    pl.x = Math.max(0, Math.min(L.end - PW, pl.x));
    // verticale
    const prevBottom = pl.y + PH;
    pl.vy = Math.min(pl.vy + grav * dt, 1100);
    pl.y += pl.vy * dt;
    pl.onGround = false;
    if (pl.vy >= 0) {
      const bottom = pl.y + PH;
      if (prevBottom <= GY + 1 && bottom >= GY && solidAt(pl.x + 4, pl.x + PW - 4)) { pl.y = GY - PH; pl.vy = 0; pl.onGround = true; pl.safeX = pl.x; }
      for (const p of L.plats) if (prevBottom <= p.y + 1 && bottom >= p.y && pl.x + PW - 4 > p.x && pl.x + 4 < p.x + p.w) { pl.y = p.y - PH; pl.vy = 0; pl.onGround = true; }
    }
    if (pl.y > VIEW_H + 40) loseLife("fall");
    // nemici (attivi solo dopo i primi 20 s)
    for (const e of L.enemies) {
      if (!e.alive || t < 20) continue;
      e.x += e.dir * 60 * dt; if (e.x < e.minX) { e.x = e.minX; e.dir = 1; } if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
      const m = (1 - tol.hit) * 0.5; // area di collisione ridotta per tolleranza
      const ex1 = e.x + e.w * m, ex2 = e.x + e.w * (1 - m), ey1 = e.y + e.h * m;
      if (pl.x + PW > ex1 && pl.x < ex2 && pl.y + PH > ey1 && pl.y < e.y + e.h) {
        if (pl.vy > 0 && prevBottom <= e.y + 18) { e.alive = false; conf.burst(e.x + e.w / 2, e.y + e.h / 2, 24, ["#fff", "#8fa3b8", COL.senape]); pl.vy = -520; pl.holdT = 0.2; }
        else loseLife("hit");
      }
    }
    // raccolta
    const cx = pl.x + PW / 2, cy = pl.y + PH / 2;
    for (const c of L.candles) if (!c.got && Math.abs(c.x - cx) < 34 && Math.abs(c.y - 10 - cy) < 56) { c.got = true; conf.burst(c.x, c.y - 20, 8); }
    if (!L.cart.got && Math.abs(L.cart.x - cx) < 46 && Math.abs(L.cart.y - cy) < 70) { L.cart.got = true; conf.burst(L.cart.x, L.cart.y, 30); }
    for (const cp of L.cps) if (!cp.on && cx > cp.x) { cp.on = true; checkpoint = { x: cp.x - 10 }; conf.burst(cp.x, GY - 80, 12); }
    conf.update(dt);
    if (cx > L.archX) {
      done = true;
      const got = L.candles.filter(c => c.got).length, pct = got / L.candles.length;
      const stars = pct >= 0.8 ? (L.cart.got ? 3 : 2) : 1;
      api.win({ stars, detail: `Candeline ${got}/${L.candles.length}${L.cart.got ? " · cartolina trovata" : ""}` });
    }
    cam = Math.max(0, Math.min(L.end - viewW, pl.x - viewW * 0.35));
    hud();
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#bcd8e6"); sky.addColorStop(1, "#e8efe0");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.setTransform(scale, 0, 0, scale, 0, offY);
    // nuvole di carta (parallasse 0,2)
    for (const c of clouds) {
      const x = c.x - cam * 0.2; if (x < -200 || x > viewW + 200) continue;
      g.save(); g.translate(x, c.y); g.scale(c.s, c.s);
      g.fillStyle = "rgba(43,35,32,.12)"; [[0, 0, 30], [32, -12, 36], [64, 0, 28]].forEach(([a, b, r]) => { g.beginPath(); g.arc(a + 3, b + 4, r, 0, 7); g.fill(); });
      g.fillStyle = "#fff"; [[0, 0, 30], [32, -12, 36], [64, 0, 28]].forEach(([a, b, r]) => { g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); });
      g.restore();
    }
    // colline (parallasse 0,4)
    g.save(); g.translate(-cam * 0.4, 0);
    for (let i = -1; i < (L.end * 0.4 + viewW) / 300 + 1; i++) {
      g.fillStyle = i % 2 ? "#9cc0a4" : "#8bb394";
      g.beginPath(); g.ellipse(i * 300 + 150, GY + 10, 220, 120 + (i % 3) * 20, 0, Math.PI, 0); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 3; g.stroke();
    }
    g.restore();
    // casetta con altalena (sfondo, parallasse 0,6) — Mondo 1 «Le radici»
    g.save(); g.translate(-cam * 0.6 + 40, 0);
    drawPoly(g, tornRect(0, GY - 150, 130, 110, 11), "#e7c9a9");
    drawPoly(g, [[-14, GY - 148], [65, GY - 215], [144, GY - 148]], COL.terracotta);
    drawPoly(g, tornRect(48, GY - 95, 34, 55, 12), COL.mare, { lw: 2 });
    drawPoly(g, tornRect(14, GY - 130, 26, 24, 13), "#fff8d8", { lw: 2 });
    g.strokeStyle = "#7a5a40"; g.lineWidth = 6; g.beginPath(); g.moveTo(170, GY - 40); g.lineTo(200, GY - 140); g.lineTo(230, GY - 40); g.moveTo(200, GY - 140); g.lineTo(270, GY - 140); g.moveTo(240, GY - 40); g.lineTo(270, GY - 140); g.lineTo(300, GY - 40); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(222, GY - 140); g.lineTo(222, GY - 75); g.moveTo(248, GY - 140); g.lineTo(248, GY - 75); g.stroke();
    drawPoly(g, tornRect(214, GY - 78, 42, 8, 14), COL.senape, { lw: 2 });
    g.restore();

    g.save(); g.translate(-cam, 0);
    // terreno: prato di carta crespa + terra
    for (const s of L.ground) {
      if (s.x2 < cam - 50 || s.x1 > cam + viewW + 50) continue;
      drawPoly(g, tornRect(s.x1, GY + 14, s.x2 - s.x1, VIEW_H - GY, s.x1 + 1, 4), "#b4865c");
      drawPoly(g, tornRect(s.x1, GY, s.x2 - s.x1, 22, s.x1 + 2, 5), COL.salvia);
      g.strokeStyle = "rgba(255,253,247,.7)"; g.lineWidth = 2; g.setLineDash([6, 8]);
      g.beginPath(); g.moveTo(s.x1 + 8, GY + 34); g.lineTo(s.x2 - 8, GY + 34); g.stroke(); g.setLineDash([]);
    }
    // piattaforme: cartoncino con cucitura (pieno = forma rettangolare con bordo cucito)
    for (const p of L.plats) {
      if (p.x + p.w < cam - 50 || p.x > cam + viewW + 50) continue;
      drawPoly(g, tornRect(p.x, p.y, p.w, 20, p.x * 7 + p.y, 3), "#d79a54");
      g.strokeStyle = COL.ink; g.globalAlpha = .45; g.lineWidth = 2; g.setLineDash([5, 6]);
      g.beginPath(); g.moveTo(p.x + 6, p.y + 10); g.lineTo(p.x + p.w - 6, p.y + 10); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    // cartello del salto (tutorial)
    drawPoly(g, tornRect(140, GY - 120, 190, 70, 21), COL.carta);
    g.fillStyle = "#7a5a40"; g.fillRect(228, GY - 50, 10, 50);
    g.fillStyle = COL.ink; g.font = '700 20px "Atkinson Hyperlegible", sans-serif'; g.textAlign = "center";
    g.fillText("Salta!", 235, GY - 94);
    g.font = '700 17px "Atkinson Hyperlegible", sans-serif';
    g.fillText(api.isTouch() ? "tasto Salto ↘" : "Spazio · ↑ · W", 235, GY - 68);
    // checkpoint: girandola di carta
    for (const cp of L.cps) {
      g.fillStyle = "#7a5a40"; g.fillRect(cp.x - 3, GY - 90, 6, 90);
      g.save(); g.translate(cp.x, GY - 92); g.rotate(cp.on ? t * 5 : 0);
      [COL.terracotta, COL.senape, COL.mare, COL.salvia].forEach((c, i) => { g.rotate(Math.PI / 2); drawPoly(g, [[0, 0], [24, -6], [20, 14]], c, { lw: 2, shadow: false }); });
      g.restore();
    }
    // candeline
    for (const c of L.candles) if (!c.got && c.x > cam - 40 && c.x < cam + viewW + 40) drawCandle(g, c.x, c.y, t);
    // cartolina (polaroid) sulla piattaforma alta
    if (!L.cart.got) {
      const c = L.cart; g.save(); g.translate(c.x, c.y + Math.sin(t * 3) * 3); g.rotate(-0.12);
      drawPoly(g, tornRect(-26, -32, 52, 62, 31, 1), "#fff");
      g.fillStyle = COL.mare; g.fillRect(-20, -26, 40, 38); g.fillStyle = COL.senape; g.beginPath(); g.arc(8, -14, 6, 0, 7); g.fill();
      g.fillStyle = COL.salvia; g.beginPath(); g.moveTo(-20, 12); g.lineTo(-4, -6); g.lineTo(10, 12); g.fill();
      g.fillStyle = "rgba(224,165,38,.7)"; g.fillRect(-10, -38, 20, 10);
      g.restore();
    }
    // nemici
    for (const e of L.enemies) if (e.alive && t >= 20 && e.x > cam - 80 && e.x < cam + viewW + 80) drawGrumpy(g, e.x, e.y, e.w, e.h, t, e.dir);
    // arco di palloncini (traguardo)
    const ax = L.archX;
    g.strokeStyle = COL.ink; g.lineWidth = 2;
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI - i * Math.PI / 12, bx = ax + Math.cos(a) * 80, by = GY - 20 - Math.sin(a) * 150;
      g.fillStyle = [COL.terracotta, COL.senape, COL.mare, COL.salvia][i % 4];
      g.beginPath(); g.ellipse(bx + 2, by + 3, 15, 18, 0, 0, 7); g.fillStyle = "rgba(43,35,32,.2)"; g.fill();
      g.beginPath(); g.ellipse(bx, by, 15, 18, 0, 0, 7); g.fillStyle = [COL.terracotta, COL.senape, COL.mare, COL.salvia][i % 4]; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 3; g.stroke();
    }
    // personaggio
    const pose = !pl.onGround ? "jump" : Math.abs(pl.vx) > 1 ? (Math.floor(pl.anim * 8) % 2 ? "walk1" : "walk2") : "idle";
    if (!(invuln > 0 && Math.floor(t * 6) % 2)) { // lampeggio ≤3 volte al secondo
      g.save(); g.translate(pl.x + PW / 2, pl.y + PH); g.scale(pl.face, 1);
      g.drawImage(frames[pose], -SPR_W / 2, -SPR_H, SPR_W, SPR_H);
      g.restore();
    }
    conf.draw(g);
    g.restore();
    // grana di carta sopra tutto
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.5; g.fillStyle = pat; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    if (t < 20 && t > 17) { // avviso arrivo nemici
      g.fillStyle = COL.carta; g.fillRect(W / 2 - 150 * scale, H * 0.3, 300 * scale, 40 * scale);
      g.fillStyle = COL.ink; g.font = `700 ${18 * scale}px "Atkinson Hyperlegible"`; g.textAlign = "center"; g.fillText("Arrivano le Nuvolette Brontolone!", W / 2, H * 0.3 + 26 * scale);
    }
  }

  return {
    resize, update, draw,
    restart() { done = false; defeats = 0; reset(true); },
    skipWin() { const got = L.candles.filter(c => c.got).length; done = true; api.win({ stars: 1, detail: `Prosegui comunque · candeline ${got}/${L.candles.length}`, skipped: true }); },
    destroy() { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); },
    debug: () => ({ x: pl.x, y: pl.y, lives, t, archX: L.archX, candles: L.candles.length, enemies: L.enemies.length, firstEnemy: Math.min(...L.enemies.map(e => e.minX)), cps: L.cps.map(c => c.x) }),
    _teleport(x) { pl.x = x; pl.y = GY - PH; pl.vy = 0; },
  };
}
