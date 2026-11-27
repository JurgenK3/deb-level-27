// Il Mondo di [Nome] — prototipo interno v0.3 (Mondo 1, edizione Compleanno). Nessun dato lascia il browser.
import { applyPageTexture } from "./paper.js";
import { fileToCanvas, findFaces, assessFace, ovalCoverage, cropHead, CROP_VARIANTS, getDetector, QUALITY } from "./face.js";
import { buildCharacter, placeholderHead, headToDataURL, dataURLToCanvas } from "./character.js";
import { createLevel1 } from "./level1.js";
import { createLevel2 } from "./level2.js";
import { runQuiz } from "./level3.js";

const $ = s => document.querySelector(s);
const KEY = "mondo-di-nome-proto-v02"; // chiave diversa dalla v0.1: le due versioni non si sovrascrivono

/* Archivio locale protetto (QA-PROTO-020, 030): ogni accesso a localStorage passa da qui.
 * Se il browser lo blocca, il gioco funziona lo stesso con una copia in memoria e avvisa che i progressi non verranno salvati. */
const store = (() => {
  let ok = true; const mem = {};
  try { const t = KEY + "-test"; localStorage.setItem(t, "1"); localStorage.removeItem(t); } catch { ok = false; }
  return {
    available: () => ok,
    get(k) { if (ok) { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch { ok = false; } } return k in mem ? mem[k] : null; },
    set(k, v) {
      mem[k] = v;
      if (!ok) return "blocked";
      try { localStorage.setItem(k, v); return "ok"; }
      catch (e) { if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) return "quota"; ok = false; return "blocked"; }
    },
    remove(k) { delete mem[k]; if (ok) { try { localStorage.removeItem(k); } catch { ok = false; } } },
  };
})();
let storageWarned = "";
function storageWarning(kind) {
  if (storageWarned === kind) return; storageWarned = kind;
  const el = document.querySelector("#storage-warning");
  el.textContent = kind === "quota"
    ? "Non riesco a salvare: lo spazio del browser per questo sito è pieno. Puoi giocare, ma i progressi andranno persi quando chiudi la pagina."
    : "Questo browser non permette di salvare i dati: puoi giocare, ma i progressi andranno persi quando chiudi la pagina.";
  const b = document.createElement("button"); b.className = "btn btn-small"; b.textContent = "OK"; b.onclick = () => el.classList.add("hidden");
  el.appendChild(b); el.classList.remove("hidden");
}
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
function load() { try { return { ...defaults(), ...JSON.parse(store.get(KEY) || "{}") }; } catch { return defaults(); } }
function save() {
  const r = store.set(KEY, JSON.stringify(state));
  if (r !== "ok") { console.info("salvataggio locale non riuscito:", r); storageWarning(r); }
}
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

const REJECT_MSG = {
  FORMATO: "Formato non supportato: usa JPG, PNG o WebP.",
  TROPPO_GRANDE: "La foto supera i 15 MB.",
  ILLEGGIBILE: "Non riesco ad aprire questo file.",
  NESSUNO: "Non ho trovato un volto. Prova con una foto di fronte, con il viso ben illuminato e abbastanza grande.",
  INCERTO: "Non trovo un volto abbastanza chiaro: forse è tagliato dal bordo, coperto o poco nitido. Prova con un'altra foto, di fronte e con il viso intero.",
  PICCOLO: `Il volto è troppo piccolo nella foto (servono almeno ${QUALITY.minFacePx} pixel di larghezza; meglio ${QUALITY.goodFacePx}). Scegli una foto più ravvicinata o a risoluzione più alta.`,
  SCURA: "La foto è troppo scura: il viso non si vede bene. Scegline una con più luce.",
  STORTA: "Il viso è capovolto o molto inclinato. Scegli una foto in cui il viso è dritto.",
  RETE: "Connessione assente o instabile: non riesco a scaricare il riconoscimento del volto. Controlla la connessione e premi «Riprova». I dati che hai inserito restano.",
  MOTORE: "Il riconoscimento del volto non è partito su questo browser. Premi «Riprova»; se non funziona, prova con un altro browser.",
  ALTRO: "Qualcosa non ha funzionato durante il ritaglio. Premi «Riprova».",
};
let lastFile = null, faceWarnings = [], busy = false, preloading = null;

function applyCrop() {
  const combos = cropCombos(), c = combos[cropIdx % combos.length];
  const face = faces[c.fi], variant = CROP_VARIANTS[c.vi];
  const r = cropHead(srcCanvas, face, variant);
  headCanvas = r.canvas;
  const warns = [...(face.quality?.warnings || [])];
  const cover = ovalCoverage(srcCanvas, face, variant);
  if (cover < QUALITY.edgeWarn) warns.push("il viso è vicino al bordo della foto: nell'ovale restano zone vuote (prova «Rifai ritaglio» o una foto con più spazio attorno al viso)");
  faceWarnings = warns;
  const st = $("#face-status");
  st.className = "status " + (warns.length ? "warn" : "ok");
  st.textContent = `Volto trovato${faces.length > 1 ? ` (${c.fi + 1} di ${faces.length})` : ""} · inquadratura ${variant.label}${r.angleDeg ? ` · raddrizzata di ${r.angleDeg}°` : ""}.`
    + (warns.length ? ` Attenzione: ${warns.join("; ")}.` : "");
  $("#btn-recrop").disabled = combos.length < 2;
  window.__lastFace = { faces: faces.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h), score: +f.score.toFixed(2) })), combo: c, angle: r.angleDeg, warnings: warns, coverage: +cover.toFixed(2), light: face.quality?.light };
  return refreshPreview();
}

function showProgress(frac) {
  const pg = $("#face-progress"); if (frac === null) { pg.classList.add("hidden"); return 0; }
  pg.classList.remove("hidden"); const pct = Math.round(frac * 100);
  pg.firstElementChild.style.width = pct + "%"; pg.setAttribute("aria-valuenow", pct);
  return pct;
}
/** Precarica il riconoscimento del volto (nessuna foto coinvolta) appena le dichiarazioni sono complete — QA-PROTO-014. */
function preloadDetector(force) {
  if (preloading && !force) return preloading;
  const st = $("#face-status"), t0 = performance.now();
  const onP = f => { if (!busy) { const pct = showProgress(f); st.className = "status"; st.textContent = `Preparo il riconoscimento del volto: ${pct}% (circa 15 MB, solo la prima volta)…`; } };
  preloading = getDetector(onP).then(d => {
    showProgress(null);
    if (!busy && !headCanvas) { st.className = "status"; st.textContent = "Riconoscimento del volto pronto. Scegli una foto."; }
    window.__detectorMs = Math.round(performance.now() - t0); return d;
  }, e => {
    preloading = null; showProgress(null);
    if (!busy) {
      st.className = "status error"; st.textContent = REJECT_MSG[e.message] || REJECT_MSG.ALTRO;
      $("#btn-face-retry").classList.remove("hidden"); window.__lastFace = { error: e.message, preload: true };
    }
    throw e;
  });
  preloading.catch(() => {});
  return preloading;
}

async function onPhoto(file) {
  const st = $("#face-status");
  if (!gate().ok) { // nessuna elaborazione senza le dichiarazioni (QA-PROTO-002, 003)
    st.className = "status error"; st.textContent = gate().msg; $("#f-photo").value = ""; window.__lastFace = { error: "CONSENSO" }; return;
  }
  lastFile = file; busy = true;
  $("#btn-face-retry").classList.add("hidden");
  st.className = "status"; st.textContent = "Cerco il volto… (tutto avviene in questo browser)";
  try {
    srcCanvas = await fileToCanvas(file);
    await getDetector(f => { const pct = showProgress(f); if (f < 1) st.textContent = `Scarico il riconoscimento del volto: ${pct}% (circa 15 MB, solo la prima volta)…`; });
    showProgress(null); st.textContent = "Cerco il volto… (tutto avviene in questo browser)";
    const { faces: found, discarded } = await findFaces(srcCanvas);
    const assessed = found.map(f => ({ ...f, quality: assessFace(srcCanvas, f) }));
    faces = assessed.filter(f => !f.quality.reject);
    if (!faces.length) {
      const code = assessed[0]?.quality.reject || (discarded.small ? "PICCOLO" : discarded.lowScore ? "INCERTO" : "NESSUNO");
      headCanvas = null; srcCanvas = null; await refreshPreview(); $("#btn-recrop").disabled = true;
      st.className = "status error"; st.textContent = REJECT_MSG[code];
      window.__lastFace = { faces: [], reject: code, discarded, light: assessed[0]?.quality.light };
      return;
    }
    cropIdx = 0; await applyCrop();
  } catch (e) {
    showProgress(null);
    const code = REJECT_MSG[e?.message] ? e.message : "ALTRO";
    console.info("foto non elaborata:", code, e?.message); // errore gestito, non un errore dell'applicazione (QA-PROTO-029)
    headCanvas = null; srcCanvas = null; await refreshPreview(); $("#btn-recrop").disabled = true;
    st.className = "status error"; st.textContent = REJECT_MSG[code];
    if (["RETE", "MOTORE", "ALTRO"].includes(code)) $("#btn-face-retry").classList.remove("hidden");
    window.__lastFace = { error: code };
  } finally { busy = false; }
}

/* ---------- Dichiarazioni prima della foto (QA-PROTO-002, 003) ---------- */
function ageInfo() {
  const v = $("#f-age").value.trim();
  const ok = /^\d{1,3}$/.test(v) && +v >= 6 && +v <= 110;
  return { ok, age: ok ? +v : null, minor: ok && +v < 18, empty: v === "" };
}
function gate() {
  const a = ageInfo();
  if (!a.ok) return { ok: false, msg: "Per caricare la foto indica prima l'età compiuta (un numero intero da 6 a 110): serve a sapere se occorre la dichiarazione per i minori." };
  if (!$("#f-consent").checked) return { ok: false, msg: "Per caricare la foto spunta prima la dichiarazione sul consenso della persona ritratta." };
  if (a.minor && !$("#f-parental").checked) return { ok: false, msg: "La persona festeggiata è minorenne: per caricare la foto serve anche la dichiarazione sulla responsabilità genitoriale." };
  return { ok: true, msg: "" };
}
function discardPhoto(reason) {
  if (!headCanvas && !srcCanvas) return;
  headCanvas = null; srcCanvas = null; faces = []; lastFile = null; $("#f-photo").value = ""; $("#btn-recrop").disabled = true;
  const st = $("#face-status"); st.className = "status"; st.textContent = reason;
  window.__lastFace = { discarded: true };
  refreshPreview();
}
function updateGate(fromChange, interactive = true) {
  const a = ageInfo();
  $("#parental-row").classList.toggle("hidden", !a.minor);
  if (a.ok && !a.minor) $("#f-parental").checked = false; // età adulta valida: la dichiarazione per i minori non serve
  const g = gate();
  $("#f-photo").disabled = !g.ok; $("#photo-btn").classList.toggle("is-disabled", !g.ok);
  $("#photo-btn").setAttribute("aria-disabled", String(!g.ok));
  const cs = $("#consent-status"); cs.className = "status" + (g.ok ? " ok" : ""); cs.textContent = g.ok ? "Dichiarazioni complete: puoi caricare la foto." : g.msg;
  if (!g.ok && fromChange && a.ok) discardPhoto("Le dichiarazioni non sono più complete: ho scartato la foto e il ritaglio. Completa le dichiarazioni e carica di nuovo la foto.");
  if (g.ok && interactive) preloadDetector(); // il precaricamento parte solo quando chi configura agisce, mai per chi riceve il gioco
}

/* ---------- Validazione dei dati (QA-PROTO-006, 015, 016, 024) ---------- */
function checkName(raw) {
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  const count = [...name.replace(/ /g, "")].length;
  if (!name) return { err: "Scrivi il nome da mostrare.", count };
  if (!/^[\p{L}][\p{L}\p{M} '’\-]*$/u.test(name)) return { err: "Il nome può contenere solo lettere, spazi, apostrofo e trattino, e deve iniziare con una lettera.", count };
  if (count < 2) return { err: "Il nome deve avere almeno 2 caratteri.", count };
  if (count > 16) return { err: `Il nome è troppo lungo: ${count} caratteri (spazi esclusi), il massimo è 16. Usa un soprannome o una forma più breve: non lo accorciamo noi.`, count };
  return { name, count };
}
function updateNameCounter() {
  const r = checkName($("#f-name").value), el = $("#name-count");
  el.textContent = `${r.count}/16 caratteri (spazi esclusi)`;
  el.classList.toggle("over", r.count > 16); $("#f-name").classList.toggle("invalid", r.count > 16);
}
const normAns = t => t.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");

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
  $("#f-name").value = state.name; $("#f-form").value = state.form; $("#f-age").value = state.age ?? ""; $("#f-mode").value = state.mode;
  document.querySelector(`input[name=body][value=${state.body}]`).checked = true;
  if (state.head) {
    headCanvas = await dataURLToCanvas(state.head);
    // dichiarazioni già rese da chi ha creato il gioco: si ripristinano con la data (non è una casella preimpostata)
    if (state.consent?.at) { $("#f-consent").checked = true; $("#f-parental").checked = !!state.consent.parental; }
    $("#face-status").textContent = "Testa già ritagliata in precedenza (la foto originale non è stata conservata)."
      + (state.consent?.at ? ` Dichiarazioni rese il ${new Date(state.consent.at).toLocaleDateString("it-IT")}.` : "");
  }
  renderQuizEditor(); refreshPreview(); updateNameCounter(); updateGate(false, false);
  $("#f-photo").addEventListener("change", e => { const f = e.target.files[0]; if (f) onPhoto(f); });
  $("#f-photo").addEventListener("click", e => { if (!gate().ok) { e.preventDefault(); updateGate(false); } });
  $("#f-consent").addEventListener("change", () => updateGate(true));
  $("#f-parental").addEventListener("change", () => updateGate(true));
  $("#f-age").addEventListener("input", () => updateGate(false));
  $("#f-name").addEventListener("input", updateNameCounter);
  $("#btn-face-retry").addEventListener("click", () => { $("#btn-face-retry").classList.add("hidden"); if (lastFile) onPhoto(lastFile); else preloadDetector(true); });
  document.querySelectorAll("input[name=body]").forEach(r => r.addEventListener("change", refreshPreview));
  $("#btn-recrop").addEventListener("click", () => { if (!srcCanvas) return; cropIdx++; applyCrop(); });
  $("#f-age").addEventListener("change", () => { // modalità preselezionata dalla fascia (GDD §3.1), solo con un'età valida
    updateGate(true);
    const a = ageInfo(); if (a.ok) $("#f-mode").value = a.age < 9 || a.age >= 65 ? "passeggiata" : "avventura";
  });
  $("#btn-reset").addEventListener("click", () => modal("Cancellare tutto?", "Nome, testa ritagliata, domande e progressi salvati in questo browser verranno eliminati.", [
    ["Cancella", () => { store.remove(KEY); store.remove(KEY + "-dpad"); history.replaceState(null, "", location.pathname); location.reload(); }, true], ["Annulla", () => {}],
  ]));
  $("#setup-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#setup-error"); err.textContent = "";
    const fail = (msg, el) => { err.textContent = msg; el?.focus(); };
    const nr = checkName($("#f-name").value);
    if (nr.err) return fail(nr.err, $("#f-name"));
    const name = nr.name; $("#f-name").value = name;
    const a = ageInfo();
    if (!a.ok) return fail("L'età compiuta deve essere un numero intero da 6 a 110.", $("#f-age"));
    const g = gate();
    if (!g.ok) return fail(g.msg, a.minor && !$("#f-parental").checked ? $("#f-parental") : $("#f-consent"));
    if (!headCanvas) return fail("Carica una foto con un volto riconoscibile.");
    const quiz = readQuizEditor();
    if (quiz.filter(q => q.q.trim() && q.right.trim() && q.wrong.some(w => w.trim())).length < 3) return fail("Servono almeno 3 domande complete (domanda, risposta giusta e almeno una sbagliata).");
    for (let i = 0; i < quiz.length; i++) { // risposte tutte diverse (QA-PROTO-015)
      const answers = [quiz[i].right, ...quiz[i].wrong].map(normAns).filter(Boolean);
      const dup = answers.find((t, k) => answers.indexOf(t) !== k);
      if (dup) return fail(`Domanda ${i + 1}: due risposte sono uguali («${dup}»). Ogni risposta deve essere diversa dalle altre.`, document.querySelector(`#quiz-editor input[data-i="${i}"][data-f="right"]`));
    }
    const commit = async resetProgress => {
      const keepDate = state.consent?.at && !srcCanvas; // stessa testa di prima: resta la data della dichiarazione
      Object.assign(state, { name, form: $("#f-form").value, age: a.age, mode: $("#f-mode").value, body: document.querySelector("input[name=body]:checked").value,
        head: headToDataURL(headCanvas), quiz, configured: true, consent: { at: keepDate ? state.consent.at : new Date().toISOString(), parental: a.minor } });
      if (resetProgress) state.progress = defaults().progress;
      save();
      srcCanvas = null; faces = []; lastFile = null; $("#f-photo").value = ""; // la foto originale non viene conservata: resta solo la testa ritagliata
      frames = await buildCharacter(state.body, headCanvas);
      openMap();
    };
    const pr = state.progress, hasProgress = pr.unlocked > 1 || Object.values(pr.stars).some(v => v > 0) || pr.cartolina;
    if (state.configured && state.name !== name && hasProgress) { // QA-PROTO-025: niente azzeramento silenzioso
      modal("Hai cambiato il nome", `Da «${state.name}» a «${name}». Vuoi tenere i progressi già fatti (stelle, tappe sbloccate, cartolina) o ripartire da zero?`, [
        ["Tieni i progressi", () => commit(false), true], ["Riparti da zero", () => commit(true)], ["Annulla", () => {}],
      ]);
      return;
    }
    commit(false);
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
/* La mappa parte sotto l'intestazione, che su schermi stretti va su due righe (QA-PROTO-001) */
function fitMapToHud() {
  const hudB = $("#screen-map .hud-top").getBoundingClientRect().bottom;
  $(".map-wrap").style.top = Math.round(hudB + 8) + "px";
}
function openMap() {
  leaveLevelHistory();
  setHash("#mappa");
  show("screen-map"); drawMapSVG(); fitMapToHud(); requestAnimationFrame(() => { fitMapToHud(); layoutMap(); });
}
let rotateDismissed = false, resizeT = 0, lastPortrait = window.innerHeight > window.innerWidth;
window.addEventListener("resize", () => {
  if ($("#screen-map").classList.contains("active")) { fitMapToHud(); layoutMap(); }
  if (level) level.resize();
  updateRotateHint();
  clearTimeout(resizeT); resizeT = setTimeout(checkOrientationChange, 350);
});
/* Rotazione a metà livello (QA-PROTO-013) */
function updateRotateHint() {
  const portrait = window.innerHeight > window.innerWidth;
  $("#rotate-hint").classList.toggle("hidden", !(levelId === 1 && portrait && isTouch() && !rotateDismissed));
}
function checkOrientationChange() {
  const portrait = window.innerHeight > window.innerWidth;
  if (portrait === lastPortrait) return; lastPortrait = portrait;
  if (levelId === 2 && level?.gridMismatch?.() && !paused && $("#modal").classList.contains("hidden")) {
    paused = true;
    modal("Hai ruotato lo schermo", "Il campo del Bruco era stato preparato per l'altro orientamento. Vuoi ricominciare il livello con un campo adatto allo schermo?", [
      ["Ricomincia il livello", () => { stopLevel(); startLevel(2); }, true], ["Continua così", () => { paused = false; }],
    ]);
  }
}
$("#btn-edit").addEventListener("click", () => { setHash("#configura"); show("screen-setup"); });

/* ---------- Cronologia del browser (QA-PROTO-011, 028) ---------- */
let ignorePop = 0, levelEntry = false; // levelEntry: c'è una voce «#livello-N» aggiunta da noi in cima alla cronologia
function setHash(h) { if (location.hash !== h) history.replaceState(null, "", h); }
function leaveLevelHistory() { if (levelEntry) { levelEntry = false; ignorePop++; history.back(); } }
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop--; return; }
  if (levelId) { // Indietro durante un livello: apre la pausa; un secondo Indietro con la pausa aperta torna alla mappa
    const pauseOpen = paused && !$("#modal").classList.contains("hidden") && $("#modal-title").textContent === "Pausa";
    if (pauseOpen) { levelEntry = false; stopLevel(); openMap(); return; }
    history.pushState(null, "", `#livello-${levelId}`);
    if ($("#modal").classList.contains("hidden")) pause();
    return;
  }
  if ($("#screen-win").classList.contains("active")) openMap();
});


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
function bindDpad(id, cb, onToggle = () => {}) {
  const pad = $("#" + id); pad.classList.toggle("hidden", !isTouch());
  const dp = pad.querySelector(".dpad"), tg = $("#btn-dpad-toggle");
  const setDp = on => { dp.classList.toggle("hidden", !on); tg.textContent = on ? "Croce: sì" : "Croce: no"; store.set(KEY + "-dpad", on ? "1" : "0"); onToggle(isTouch() && on); };
  setDp(store.get(KEY + "-dpad") === "1"); // predefinito: scorrimento del dito; croce a schermo come opzione (GDD §2.1)
  tg.onclick = () => setDp(dp.classList.contains("hidden"));
  pad.querySelectorAll("[data-d]").forEach(b => { b.onpointerdown = e => { e.preventDefault(); b.classList.add("on"); cb(b.dataset.d); }; b.onpointerup = b.onpointercancel = () => b.classList.remove("on"); });
}

function levelApi() {
  return {
    canvas: $("#game"), frames, head: headCanvas, mode: MODES[state.mode], words: words(), questions: state.quiz,
    hud, bindTouch, bindDpad, isTouch, isPaused: () => paused,
    resume: () => { paused = false; },
    win: stats => { const id = levelId, lv = level; setTimeout(() => { if (levelId === id && level === lv) finishLevel(stats); }, stats.stars !== undefined && levelId !== 3 ? 400 : 0); },
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
  if (levelEntry) history.replaceState(null, "", `#livello-${id}`); else { history.pushState(null, "", `#livello-${id}`); levelEntry = true; }
  if (id === 3) {
    show("screen-quiz");
    quiz = runQuiz({ ...levelApi(), win: stats => { if (levelId === 3 && quiz) finishLevel(stats); } }); // QA-PROTO-023
    window.__level = quiz; return;
  }
  show("screen-level");
  $("#touch-l1").classList.add("hidden"); $("#touch-l2").classList.add("hidden");
  const api = levelApi();
  level = id === 1 ? createLevel1(api) : createLevel2(api);
  window.__level = level;
  level.resize();
  lastPortrait = window.innerHeight > window.innerWidth;
  updateRotateHint();
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
$("#btn-rotate-ok").addEventListener("click", () => { rotateDismissed = true; $("#rotate-hint").classList.add("hidden"); });
window.addEventListener("keydown", e => {
  if ((e.key === "Escape" || e.key === "p" || e.key === "P") && ($("#screen-level").classList.contains("active") || $("#screen-quiz").classList.contains("active"))) {
    if (!$("#modal").classList.contains("hidden")) { if (paused && $("#modal-title").textContent === "Pausa") { closeModal(); paused = false; } return; }
    pause(); e.preventDefault();
  }
});

function finishLevel(stats) {
  const id = levelId;
  if (!id) return; // livello già chiuso (QA-PROTO-023)
  stopLevel();
  leaveLevelHistory();
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
if (!store.available()) storageWarning("blocked");
initSetup().then(async () => {
  // ricarica: se il gioco è già configurato si riapre la mappa, non la configurazione con le risposte del quiz (QA-PROTO-011)
  if (state.head && state.configured && location.hash !== "#configura") { frames = await buildCharacter(state.body, headCanvas); openMap(); }
  else setHash("#configura");
  window.__ready = true;
});
window.__app = { state: () => state, startLevel, openMap, MODES, checkName, storeAvailable: () => store.available() };
