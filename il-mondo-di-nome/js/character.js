// Corpi SVG originali (segnaposto stile carta) + testa fotografica. Proporzione testa:corpo = 1:1,5
// (testa 40% dell'altezza). Stesso punto di aggancio per tutti i corpi.
export const CHAR_W = 200, CHAR_H = 500, HEAD_H = 200; // testa 200/500 = 40%
const INK = "#2B2320";

const BODIES = {
  uomo:  { jacket: "#C8553D", scarf: "#E0A526", legs: "#4a3b33", shoe: "#2B2320", hat: "#6B9A7A", dot: "#FFFDF7" },
  donna: { jacket: "#6B9A7A", scarf: "#C8553D", legs: "#7d5a4a", shoe: "#2B2320", hat: "#E0A526", dot: "#C8553D" },
};

// pose: idle | walk1 | walk2 | jump
function bodySVG(kind, pose) {
  const c = BODIES[kind] || BODIES.uomo;
  const legA = { idle: 0, walk1: 16, walk2: -16, jump: 22 }[pose];
  const legB = { idle: 0, walk1: -16, walk2: 16, jump: -10 }[pose];
  const armA = { idle: 8, walk1: -18, walk2: 18, jump: -60 }[pose];
  const armB = { idle: -8, walk1: 18, walk2: -18, jump: 60 }[pose];
  const leg = (x, a) => `<g transform="rotate(${a} ${x} 380)"><rect x="${x - 15}" y="370" width="30" height="95" rx="12" fill="${c.legs}"/><path d="M${x - 18} 452 h40 a12 12 0 0 1 0 24 h-40 z" fill="${c.shoe}"/></g>`;
  const arm = (x, a) => `<g transform="rotate(${a} ${x} 240)"><rect x="${x - 14}" y="232" width="28" height="100" rx="13" fill="${c.jacket}"/><rect x="${x - 14}" y="300" width="28" height="12" fill="${c.dot}" opacity=".85"/><circle cx="${x}" cy="338" r="13" fill="#e8b48f"/></g>`;
  const torso = kind === "donna"
    ? `<path d="M58 225 Q100 210 142 225 L162 395 Q100 410 38 395 Z" fill="${c.jacket}"/>
       <path d="M60 330 L140 330" stroke="${c.dot}" stroke-width="10" stroke-dasharray="2 14" stroke-linecap="round"/>`
    : `<path d="M55 225 Q100 210 145 225 L150 385 L50 385 Z" fill="${c.jacket}"/>
       <rect x="96" y="232" width="8" height="150" fill="${INK}" opacity=".35"/>
       <rect x="62" y="300" width="28" height="22" rx="4" fill="${c.dot}" opacity=".7"/>`;
  const fig = `${leg(80, legA)}${leg(120, legB)}${arm(48, armA)}${torso}${arm(152, armB)}`;
  // contorno «sticker» bianco attorno a tutta la figura, poi ombra
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CHAR_W}" height="${CHAR_H}" viewBox="0 0 ${CHAR_W} ${CHAR_H}">
    <defs><g id="f">${fig}</g></defs>
    <g transform="translate(4 5)" opacity=".22"><use xlink:href="#f" stroke="${INK}" stroke-width="10" stroke-linejoin="round" fill="${INK}"/></g>
    <use xlink:href="#f" stroke="#FFFFFF" stroke-width="10" stroke-linejoin="round"/>
    <use xlink:href="#f"/>
  </svg>`;
}

// sciarpa e cappellino di carta disegnati sopra la testa: coprono la giunzione testa-corpo
function overlaySVG(kind) {
  const c = BODIES[kind] || BODIES.uomo;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHAR_W}" height="${CHAR_H}" viewBox="0 0 ${CHAR_W} ${CHAR_H}">
    <path d="M44 196 Q100 176 156 196 L160 226 Q100 246 40 226 Z" fill="${c.scarf}" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
    <path d="M52 205 Q100 190 148 205" stroke="${INK}" stroke-opacity=".25" stroke-width="3" fill="none" stroke-dasharray="6 6"/>
    <path d="M128 214 l18 60 l-26 -4 z" fill="${c.scarf}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
    <g transform="rotate(16 140 40)">
      <path d="M118 50 L140 12 L162 50 Z" fill="${c.hat}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
      <path d="M126 38 L154 38 M132 26 L148 26" stroke="${c.dot}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="140" cy="12" r="8" fill="#E0A526" stroke="#fff" stroke-width="4"/>
    </g>
  </svg>`;
}

function svgToImage(svg) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = rej;
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

/** Testa segnaposto (nessuna foto): ovale di carta con viso stilizzato */
export function placeholderHead(w = 320, h = 400) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), pad = w * 0.03;
  g.fillStyle = "rgba(43,35,32,.28)"; g.beginPath(); g.ellipse(w / 2 + 5, h / 2 + 7, w / 2 - pad, h / 2 - pad, 0, 0, 7); g.fill();
  g.fillStyle = INK; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - pad, h / 2 - pad, 0, 0, 7); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - pad - 4, h / 2 - pad - 4, 0, 0, 7); g.fill();
  g.fillStyle = "#f0d2b6"; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - pad - 22, h / 2 - pad - 22, 0, 0, 7); g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(w * 0.38, h * 0.47, w * 0.03, 0, 7); g.arc(w * 0.62, h * 0.47, w * 0.03, 0, 7); g.fill();
  g.strokeStyle = INK; g.lineWidth = w * 0.025; g.lineCap = "round"; g.beginPath(); g.arc(w / 2, h * 0.56, w * 0.12, 0.2, Math.PI - 0.2); g.stroke();
  g.font = `700 ${w * 0.09}px "Atkinson Hyperlegible", sans-serif`; g.textAlign = "center"; g.fillStyle = "#6B5E55";
  g.fillText("foto", w / 2, h * 0.8);
  return c;
}

/** Compone i fotogrammi del personaggio: { idle, walk1, walk2, jump } come canvas 200×500 */
export async function buildCharacter(kind, headCanvas) {
  const head = headCanvas || placeholderHead();
  const over = await svgToImage(overlaySVG(kind));
  const frames = {};
  for (const pose of ["idle", "walk1", "walk2", "jump"]) {
    const body = await svgToImage(bodySVG(kind, pose));
    const c = document.createElement("canvas"); c.width = CHAR_W; c.height = CHAR_H;
    const g = c.getContext("2d");
    g.drawImage(body, 0, 0);
    // sede della testa: ovale 160×200 in alto, centrato; stesso aggancio per ogni corpo
    g.drawImage(head, 20, 2, 160, HEAD_H);
    g.drawImage(over, 0, 0);
    frames[pose] = c;
  }
  return frames;
}

export function headToDataURL(c) { return c.toDataURL("image/png"); }
export function dataURLToCanvas(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); res(c); };
    im.onerror = rej; im.src = url;
  });
}
