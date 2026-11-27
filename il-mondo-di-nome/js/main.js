// Il Mondo di [Nome] — prototipo interno v0.1 (Mondo 1, edizione Compleanno). Nessun dato lascia il browser.
import { applyPageTexture } from "./paper.js";
import { fileToCanvas, detectFaces, cropHead, CROP_VARIANTS } from "./face.js";
import { buildCharacter, placeholderHead, headToDataURL, dataURLToCanvas } from "./character.js";
import { createLevel1 } from "./level1.js";
import { createLevel2 } from "./level2.js";
import { runQuiz } from "./level3.js";

const $ = s => document.querySelector(s);
const KEY = "mondo-di-nome-proto-v01";
export const MODES = {
  passeggiata: { id: "passeggiata", lives: Infinity, speed: 0.65, tolerance: "alta", label: "Passeggiata" },
  avventura: { id: "avventura", lives: 5, speed: 1, tolerance: "media", label: "Avventura" },
  sfida: { id: "sfida", lives: 3, speed: 1.2, tolerance: "bassa", label: "Sfida" },
};
const LEVELS = [
  { id: 1, name: "Primi passi", kind: "Platform" },
  { id: 2, name: "Il Bruco Goloso", kind: "Serpente" },
  { id: 3, name: "La Porta dei Ricordi", kind: "Quiz" },
];
const EXAMPLE_QUIZ = [ // dati fittizi dell'esempio GDD §8
  { q: "Come ti chiamavano da piccola?", right: "Giugiù", wrong: ["Lulù", "Pupa", "Titti"], comment: "Lo dice ancora la nonna!" },
  { q: "Qual è il tuo piatto preferito?", right: "Lasagne della nonna", wrong: ["Pizza margherita", "Risotto ai funghi", "Spaghetti alle vongole"], comment: "Ne mangiasti tre porzioni a Natale 2015!" },
  { q: "Vero o falso: da piccola volevi fare la pilota di mongolfiere.", right: "Vero", wrong: ["Falso", "", ""], comment: "Lo scrivesti nel tema di terza elementare." },
  { q: "Qual era il tuo gioco preferito in giardino?", right: "L'altalena", wrong: ["Nascondino", "Campana", "Le costruzioni"], comment: "" },
];

let state = load();
let frames = null, headCanvas = null;
const isTouch = () => window.matchMedia("(pointer: coarse)").matches || touchSeen;
let touchSeen = false;
window.addEventListener("touchstart", () => { touchSeen = true; }, { once: true, passive: true });

function defaults() {
  return { name: "Giulia", form: "f", age: 40, mode: "avventura", body: "donna", head: null, quiz: EXAMPLE_QUIZ, progress: { stars: { 1: 0, 2: 0, 3: 0 }, unlocked: 1, cartolina: false } };
}
function load() { try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return defaults(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("salvataggio locale non riuscito", e); } }
const words = () => ({
  bravo: { f: "Brava", m: "Bravo", n: "Ottimo lavoro" }[state.form],
  giusto: { f: "Giusto! Te lo ricordavi.", m: "Giusto! Te lo ricordavi.", n: "Giusto!" }[state.form],
});

function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  document.querySelectorAll(".name-slot").forEach(n => { n.textContent = state.name || "[Nome]"; });
}

/* ------------------------------ MODALE ------------------------------ */
function modal(title, text, actions) {
  $("#modal-title").textContent = title; $("#modal-text").textContent = text;
  const box = $("#modal-actions"); box.innerHTML = "";
  actions.forEach(([label, fn, primary]) => {
    const b = document.createElement("button"); b.className = "btn" + (primary ? " btn-primary" : ""); b.textContent = label;
    b.onclick = () => { closeModal(); fn(); }; box.appendChild(b);
  });
  $("#modal").classList.remove("hidden"); box.firstChild?.focus();
}
function closeModal() { $("#modal").classList.add("hidden"); }

/* ------------------------------ CONFIGURAZIONE ------------------------------ */
let srcCanvas = null, faces = [], cropIdx = 0;
function cropCombos() { const c = []; faces.forEach((f, fi) => CROP_VARIANTS.forEach((v, vi) => c.push({ fi, vi }))); return c; }

async function refreshPreview() {
  const body = document.querySelector("input[name=body]:checked").value;
  const hp = $("#head-preview").getContext("2d"); hp.clearRect(0, 0, 160, 200);
  hp.drawImage(headCanvas || placeholderHead(), 0, 0, 160, 200);
  const fr = await buildCharacter(body, headCanvas);
  const cp = $("#char-preview").getContext("2d"); cp.clearRect(0, 0, 200, 500); cp.drawImage(fr.idle, 0, 0);
}

function applyCrop() {
  const combos = cropCombos(), c = combos[cropIdx % combos.length];
  const r = cropHead(srcCanvas, faces[c.fi], CROP_VARIANTS[c.vi]);
  headCanvas = r.canvas;
  const st = $("#face-status");
  st.className = "status ok";
  st.textContent = `Volto trovato${faces.length > 1 ? ` (${c.fi + 1} di ${faces.length})` : ""} · inquadratura ${CROP_VARIANTS[c.vi].label}${r.angleDeg ? ` · raddrizzata di ${r.angleDeg}°` : ""}.`;
  $("#btn-recrop").disabled = combos.length < 2;
  window.__lastFace = { faces: faces.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h), score: +f.score.toFixed(2) })), combo: c, angle: r.angleDeg };
  return refreshPreview();
}

async function onPhoto(file) {
  const st = $("#face-status");
  st.className = "status"; st.textContent = "Cerco il volto… (tutto avviene in questo browser)";
  try {
    srcCanvas = await fileToCanvas(file);
    faces = await detectFaces(srcCanvas);
    if (!faces.length) {
      headCanvas = null; srcCanvas = null; await refreshPreview(); $("#btn-recrop").disabled = true;
      st.className = "status error"; st.textContent = "Non ho trovato un volto. Prova con una foto di fronte, con il viso ben illuminato e abbastanza grande.";
      window.__lastFace = { faces: [] };
      return;
    }
    cropIdx = 0; await applyCrop();
  } catch (e) {
    console.error(e);
    headCanvas = null; srcCanvas = null; await refreshPreview();
    st.className = "status error";
    st.textContent = { FORMATO: "Formato non supportato: usa JPG, PNG o WebP.", TROPPO_GRANDE: "La foto supera i 15 MB.", ILLEGGIBILE: "Non riesco ad aprire questo file." }[e.message] || "Errore nel rilevamento del volto: " + e.message;
    window.__lastFace = { error: e.message };
  }
}

function renderQuizEditor() {
  const box = $("#quiz-editor"); box.innerHTML = "";
  state.quiz.forEach((q, i) => {
    const d = document.createElement("div"); d.className = "quiz-item";
    d.innerHTML = `<h3>Domanda ${i + 1}</h3>
      <div class="row">
        <label class="field wide">Domanda <input type="text" maxlength="120" data-i="${i}" data-f="q"></label>
        <label class="field">Risposta giusta <input type="text" maxlength="40" data-i="${i}" data-f="right"></label>
        <label class="field">Sbagliata 1 <input type="text" maxlength="40" data-i="${i}" data-f="w0"></label>
        <label class="field">Sbagliata 2 <input type="text" maxlength="40" data-i="${i}" data-f="w1"></label>
        <label class="field">Sbagliata 3 <input type="text" maxlength="40" data-i="${i}" data-f="w2"></label>
        <label class="field wide">Commento di chi regala (facoltativo) <input type="text" maxlength="120" data-i="${i}" data-f="comment"></label>
      </div>`;
    box.appendChild(d);
    d.querySelectorAll("input").forEach(inp => {
      const f = inp.dataset.f; inp.value = f[0] === "w" && f.length === 2 ? (q.wrong[+f[1]] || "") : (q[f] || "");
    });
  });
}
function readQuizEditor() {
  return state.quiz.map((_, i) => {
    const v = f => document.querySelector(`#quiz-editor input[data-i="${i}"][data-f="${f}"]`).value;
    return { q: v("q"), right: v("right"), wrong: [v("w0"), v("w1"), v("w2")], comment: v("comment") };
  });
}

async function initSetup() {
  $("#f-name").value = state.name; $("#f-form").value = state.form; $("#f-age").value = state.age; $("#f-mode").value = state.mode;
  document.querySelector(`input[name=body][value=${state.body}]`).checked = true;
  if (state.head) { headCanvas = await dataURLToCanvas(state.head); $("#face-status").textContent = "Testa già ritagliata in precedenza (la foto originale non è stata conservata)."; }
  renderQuizEditor(); refreshPreview();
  $("#f-photo").addEventListener("change", e => { const f = e.target.files[0]; if (f) onPhoto(f); });
  document.querySelectorAll("input[name=body]").forEach(r => r.addEventListener("change", refreshPreview));
  $("#btn-recrop").addEventListener("click", () => { if (!srcCanvas) return; cropIdx++; applyCrop(); });
  $("#f-age").addEventListener("change", () => { // modalità preselezionata dalla fascia (GDD §3.1)
    const a = +$("#f-age").value; $("#f-mode").value = a < 9 || a >= 65 ? "passeggiata" : "avventura";
  });
  $("#btn-reset").addEventListener("click", () => modal("Cancellare tutto?", "Nome, testa ritagliata, domande e progressi salvati in questo browser verranno eliminati.", [
    ["Cancella", () => { localStorage.removeItem(KEY); location.reload(); }, true], ["Annulla", () => {}],
  ]));
  $("#setup-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#setup-error"); err.textContent = "";
    const name = $("#f-name").value.trim();
    if (!/^[\p{L}][\p{L} '’\-]{1,15}$/u.test(name)) { err.textContent = "Il nome deve avere 2–16 caratteri: lettere, spazio, apostrofo o trattino."; $("#f-name").focus(); return; }
    if (!headCanvas) { err.textContent = "Carica una foto con un volto riconoscibile."; return; }
    if (!$("#f-consent").checked) { err.textContent = "Serve la conferma del consenso per la foto."; return; }
    const quiz = readQuizEditor();
    if (quiz.filter(q => q.q.trim() && q.right.trim() && q.wrong.some(w => w.trim())).length < 3) { err.textContent = "Servono almeno 3 domande complete (domanda, risposta giusta e almeno una sbagliata)."; return; }
    const changed = state.name !== name;
    Object.assign(state, { name, form: $("#f-form").value, age: +$("#f-age").value || 40, mode: $("#f-mode").value, body: document.querySelector("input[name=body]:checked").value, head: headToDataURL(headCanvas), quiz });
    if (changed) state.progress = defaults().progress;
    save();
    srcCanvas = null; faces = []; // la foto originale non viene conservata: resta solo la testa ritagliata
    frames = await buildCharacter(state.body, headCanvas);
    openMap();
  });
}

/* ------------------------------ MAPPA ------------------------------ */
const NODE_POS = { 1: [190, 430], 2: [440, 250], 3: [690, 400], 4: [890, 200] };
function drawMapSVG() {
  const p = (a, b) => `${NODE_POS[a][0]},${NODE_POS[a][1]}`;
  $("#map-svg").innerHTML = `
    <defs><filter id="sh"><feDropShadow dx="3" dy="4" stdDeviation="0" flood-color="#2B2320" flood-opacity=".18"/></filter></defs>
    <rect x="20" y="20" width="960" height="560" rx="10" fill="#FFFDF7" filter="url(#sh)"/>
    <rect x="20" y="20" width="960" height="560" rx="10" fill="none" stroke="#C8553D" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>
    <path d="M20 520 Q200 440 380 500 T760 470 T980 450 V580 H20Z" fill="#6B9A7A" stroke="#fff" stroke-width="4" filter="url(#sh)"/>
    <path d="M20 560 Q260 500 520 545 T980 520 V580 H20Z" fill="#5c8a69" stroke="#fff" stroke-width="4"/>
    <g filter="url(#sh)" transform="translate(70 300)">
      <rect x="0" y="40" width="90" height="70" fill="#e7c9a9" stroke="#fff" stroke-width="4"/>
      <path d="M-10 44 L45 0 L100 44Z" fill="#C8553D" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      <rect x="34" y="70" width="22" height="40" fill="#3F7CAC" stroke="#fff" stroke-width="3"/>
    </g>
    <g filter="url(#sh)" transform="translate(560 90) rotate(-6)">
      <rect width="120" height="140" fill="#fff"/><rect x="10" y="10" width="100" height="95" fill="${state.progress.cartolina ? "#3F7CAC" : "#e9e1d2"}"/>
      ${state.progress.cartolina ? '<circle cx="80" cy="35" r="12" fill="#E0A526"/><path d="M10 105 L45 60 L80 105Z" fill="#6B9A7A"/>' : '<text x="60" y="64" text-anchor="middle" font-size="40" fill="#6B5E55">?</text>'}
      <text x="60" y="128" text-anchor="middle" font-family="Atkinson Hyperlegible" font-weight="700" font-size="16" fill="#2B2320">Cartolina 1</text>
      <rect x="40" y="-8" width="40" height="16" fill="#E0A526" opacity=".7"/>
    </g>
    <g filter="url(#sh)" transform="translate(830 330)">
      <rect width="120" height="64" rx="4" fill="#2B2320"/><text x="60" y="27" text-anchor="middle" font-family="Atkinson Hyperlegible" font-weight="700" font-size="16" fill="#FFFDF7">Mondo 2</text>
      <text x="60" y="49" text-anchor="middle" font-family="Atkinson Hyperlegible" font-size="16" fill="#FFFDF7">non incluso</text>
    </g>
    <text x="60" y="80" font-family="Fraunces" font-weight="700" font-size="34" fill="#2B2320">Mondo 1 · Le radici</text>
    <path d="M${p(1)} C 300 420, 330 260, ${p(2)} S 600 420, ${p(3)} S 820 220, ${p(4)}" fill="none" stroke="#2B2320" stroke-width="5" stroke-dasharray="14 12" stroke-linecap="round"/>`;
}
function layoutMap() {
  const wrap = $(".map-wrap"), w = wrap.clientWidth, h = wrap.clientHeight, s = Math.min(w / 1000, h / 600);
  const ox = (w - 1000 * s) / 2, oy = (h - 600 * s) / 2;
  const nodes = $("#map-nodes"); nodes.innerHTML = "";
  const pr = state.progress;
  LEVELS.forEach(L => {
    const [x, y] = NODE_POS[L.id];
    const b = document.createElement("button");
    const locked = L.id > pr.unlocked, stars = pr.stars[L.id] || 0;
    b.className = "node" + (locked ? " locked" : stars ? " done" : "");
    b.style.left = ox + x * s + "px"; b.style.top = oy + y * s + "px";
    b.innerHTML = `${locked ? "🔒" : L.id}<span class="lbl"></span>${locked ? "" : `<span class="st" aria-label="${stars} stelle su 3">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>`}`;
    b.querySelector(".lbl").textContent = `${L.name}`;
    b.setAttribute("aria-label", `Livello ${L.id}: ${L.name} (${L.kind})${locked ? ", bloccato" : `, ${stars} stelle`}`);
    b.dataset.level = L.id;
    if (!locked) b.addEventListener("click", () => startLevel(L.id)); else b.disabled = true;
    nodes.appendChild(b);
  });
  const lock = document.createElement("div"); const [x4, y4] = NODE_POS[4];
  lock.className = "node locked"; lock.style.left = ox + x4 * s + "px"; lock.style.top = oy + y4 * s + "px"; lock.textContent = "🔒"; lock.setAttribute("aria-hidden", "true");
  nodes.appendChild(lock);
  // segnaposto con la testa del festeggiato sulla tappa attuale (≥ 40 px)
  const cur = Math.min(pr.unlocked, 3), [px, py] = NODE_POS[cur];
  const pin = document.createElement("img"); pin.className = "pin"; pin.alt = ""; pin.src = state.head;
  pin.style.left = ox + px * s + "px"; pin.style.top = oy + py * s - 30 + "px";
  nodes.appendChild(pin);
  $("#stars-total").textContent = Object.values(pr.stars).reduce((a, b) => a + b, 0);
}
function openMap() { show("screen-map"); drawMapSVG(); requestAnimationFrame(layoutMap); }
window.addEventListener("resize", () => { if ($("#screen-map").classList.contains("active")) layoutMap(); if (level) level.resize(); });
$("#btn-edit").addEventListener("click", () => show("screen-setup"));

/* ------------------------------ LIVELLI ------------------------------ */
let level = null, levelId = 0, paused = false, raf = 0, last = 0, quiz = null;
function hud(l, m) { $("#hud-left").textContent = l; $("#hud-mid").textContent = m; }
function bindTouch(id, cb) {
  const pad = $("#" + id); pad.classList.toggle("hidden", !isTouch());
  pad.querySelectorAll("[data-k]").forEach(b => {
    b.onpointerdown = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} b.classList.add("on"); cb(b.dataset.k, true); };
    b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => { b.classList.remove("on"); cb(b.dataset.k, false); };
    b.oncontextmenu = e => e.preventDefault();
  });
}
function bindDpad(id, cb) {
  const pad = $("#" + id); pad.classList.toggle("hidden", !isTouch());
  const dp = pad.querySelector(".dpad"), tg = $("#btn-dpad-toggle");
  const setDp = on => { dp.classList.toggle("hidden", !on); tg.textContent = on ? "Croce: sì" : "Croce: no"; localStorage.setItem(KEY + "-dpad", on ? "1" : "0"); };
  setDp(localStorage.getItem(KEY + "-dpad") === "1"); // predefinito: scorrimento del dito; croce a schermo come opzione (GDD §2.1)
  tg.onclick = () => setDp(dp.classList.contains("hidden"));
  pad.querySelectorAll("[data-d]").forEach(b => { b.onpointerdown = e => { e.preventDefault(); b.classList.add("on"); cb(b.dataset.d); }; b.onpointerup = b.onpointercancel = () => b.classList.remove("on"); });
}

function levelApi() {
  return {
    canvas: $("#game"), frames, head: headCanvas, mode: MODES[state.mode], words: words(), questions: state.quiz,
    hud, bindTouch, bindDpad, isTouch, isPaused: () => paused,
    resume: () => { paused = false; },
    win: stats => setTimeout(() => finishLevel(stats), stats.stars !== undefined && levelId !== 3 ? 400 : 0),
    defeat: (n, restart) => {
      paused = true;
      const acts = [["Riprova", restart, true]];
      if (n >= 3 && state.mode !== "passeggiata") acts.push(["Prosegui comunque", () => { paused = false; level.skipWin(); }]);
      acts.push(["Torna alla mappa", exitLevel]);
      modal("Ops, vite finite!", n >= 3 ? "Questo livello è un osso duro. Vuoi andare avanti lo stesso? Potrai tornare a giocarlo quando vuoi." :
        (state.mode === "sfida" ? "Si riparte dall'inizio del livello." : "Si riparte dall'ultima girandola raggiunta."), acts);
    },
  };
}

async function startLevel(id) {
  if (!frames) frames = await buildCharacter(state.body, headCanvas);
  levelId = id; paused = false;
  if (id === 3) {
    show("screen-quiz");
    quiz = runQuiz({ ...levelApi(), win: stats => finishLevel(stats) });
    window.__level = quiz; return;
  }
  show("screen-level");
  $("#touch-l1").classList.add("hidden"); $("#touch-l2").classList.add("hidden");
  const api = levelApi();
  level = id === 1 ? createLevel1(api) : createLevel2(api);
  window.__level = level;
  level.resize();
  const portrait = window.innerHeight > window.innerWidth;
  $("#rotate-hint").classList.toggle("hidden", !(id === 1 && portrait && isTouch()));
  last = performance.now();
  cancelAnimationFrame(raf);
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused && level) level.update(dt);
    if (level) level.draw();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
function stopLevel() { cancelAnimationFrame(raf); level?.destroy(); level = null; quiz?.destroy(); quiz = null; paused = false; closeModal(); }
function exitLevel() { stopLevel(); openMap(); }

function pause() {
  if (!levelId || paused || !$("#modal").classList.contains("hidden")) return;
  paused = true;
  const actions = [["Riprendi", () => { paused = false; }, true], ["Ricomincia", () => { const id = levelId; stopLevel(); startLevel(id); }]];
  ["passeggiata", "avventura", "sfida"].filter(m => m !== state.mode).forEach(m => actions.push([`Modalità: ${MODES[m].label}`, () => { state.mode = m; save(); const id = levelId; stopLevel(); startLevel(id); }]));
  actions.push(["Mappa", exitLevel]);
  modal("Pausa", `Modalità attuale: ${MODES[state.mode].label}.`, actions);
}
$("#btn-pause").addEventListener("click", pause);
$("#btn-quiz-pause").addEventListener("click", pause);
$("#btn-rotate-ok").addEventListener("click", () => $("#rotate-hint").classList.add("hidden"));
window.addEventListener("keydown", e => {
  if ((e.key === "Escape" || e.key === "p" || e.key === "P") && ($("#screen-level").classList.contains("active") || $("#screen-quiz").classList.contains("active"))) {
    if (!$("#modal").classList.contains("hidden")) { if (paused && $("#modal-title").textContent === "Pausa") { closeModal(); paused = false; } return; }
    pause(); e.preventDefault();
  }
});

function finishLevel(stats) {
  const id = levelId;
  stopLevel();
  const pr = state.progress;
  pr.stars[id] = Math.max(pr.stars[id] || 0, stats.stars);
  if (id === 1 && stats.detail.includes("cartolina")) pr.cartolina = true;
  pr.unlocked = Math.max(pr.unlocked, Math.min(4, id + 1));
  save();
  show("screen-win");
  const w = words();
  $("#win-title").textContent = id === 3 ? "La porta è aperta!" : `${w.bravo}, ${state.name}!`;
  $("#win-stars").innerHTML = [0, 1, 2].map(i => `<span class="${i < stats.stars ? "on" : "off"}">★</span>`).join("");
  $("#win-stars").setAttribute("aria-label", `${stats.stars} stelle su 3`);
  $("#win-text").textContent = `«${LEVELS[id - 1].name}» completato. ${stats.detail}.` + (id === 3 ? " Il Mondo 2 «L'avventura» non è incluso in questo prototipo." : "");
  const g = $("#win-char").getContext("2d"); g.clearRect(0, 0, 200, 500); g.drawImage(frames.idle, 0, 0);
  $("#btn-win-retry").onclick = () => startLevel(id);
  levelId = 0;
}
$("#btn-win-map").addEventListener("click", openMap);

/* ------------------------------ AVVIO ------------------------------ */
applyPageTexture();
initSetup().then(async () => {
  if (state.head && location.hash === "#mappa") { frames = await buildCharacter(state.body, headCanvas); openMap(); }
});
window.__app = { state: () => state, startLevel, openMap, MODES };
