// Rilevamento del volto e ritaglio automatico, interamente nel browser.
// Libreria: MediaPipe Tasks Vision (Apache-2.0), file e modello serviti dalla cartella locale.
import { FilesetResolver, FaceDetector } from "../lib/mediapipe/vision_bundle.mjs";

let detectorPromise = null;
const WASM_DIR = new URL("../lib/mediapipe/wasm", import.meta.url).href;
const MODEL_URL = new URL("../models/blaze_face_short_range.tflite", import.meta.url).href;

/** Scarica un file mostrando l'avanzamento (byte ricevuti / totali). Errore di rete → Error("RETE"). */
async function fetchWithProgress(url, onBytes) {
  let res;
  try { res = await fetch(url, { cache: "force-cache" }); } catch { throw new Error("RETE"); }
  if (!res.ok) throw new Error("RETE");
  const total = +res.headers.get("content-length") || 0;
  if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); onBytes(b.length, total || b.length); return b; }
  const reader = res.body.getReader(), parts = []; let got = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onBytes(got, total); }
  } catch { throw new Error("RETE"); }
  const out = new Uint8Array(got); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Il messaggio informativo di TensorFlow Lite («Created TensorFlow Lite XNNPACK delegate») arriva come console.error:
 *  lo declassiamo a info per non sporcare il monitoraggio degli errori (QA-PROTO-029). */
function quietMediaPipeInfo() {
  if (console.__mpQuiet) return;
  const orig = console.error.bind(console);
  console.error = (...a) => { if (typeof a[0] === "string" && /XNNPACK delegate|^INFO:/.test(a[0])) console.info(...a); else orig(...a); };
  console.__mpQuiet = true;
}

/** Prepara il rilevatore (motore ~14,7 MB + modello ~0,2 MB, scaricati solo la prima volta).
 *  onProgress(frazione 0–1). Se fallisce, la promessa viene azzerata così un nuovo tentativo riparte da capo (QA-PROTO-007). */
export function getDetector(onProgress = () => {}) {
  if (!detectorPromise) {
    listeners.clear();
    detectorPromise = (async () => {
      quietMediaPipeInfo();
      const sizes = { w: 14665716, m: 229746 }, got = { w: 0, m: 0 };
      const report = () => { const tot = sizes.w + sizes.m; listeners.forEach(fn => fn(Math.min(1, (got.w + got.m) / tot))); };
      const [wasm, model] = await Promise.all([
        fetchWithProgress(WASM_DIR + "/vision_wasm_internal.wasm", (g, t) => { got.w = g; if (t) sizes.w = t; report(); }),
        fetchWithProgress(MODEL_URL, (g, t) => { got.m = g; if (t) sizes.m = t; report(); }),
      ]);
      const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
      try {
        const fileset = { wasmLoaderPath: WASM_DIR + "/vision_wasm_internal.js", wasmBinaryPath: wasmUrl };
        return await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: model, delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        });
      } catch (e) { console.warn("avvio del rilevatore non riuscito", e); throw new Error("MOTORE"); }
    })();
    detectorPromise.catch(() => { detectorPromise = null; });
  }
  listeners.add(onProgress);
  return detectorPromise;
}
const listeners = new Set();
export function detectorReady() { return !!detectorPromise; }
void FilesetResolver; // non più usato: il fileset è costruito a mano per poter mostrare l'avanzamento

/** Carica il file in un canvas ridimensionato (max 1280 px). Il file originale non viene conservato. */
export async function fileToCanvas(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("FORMATO");
  if (file.size > 15 * 1024 * 1024) throw new Error("TROPPO_GRANDE");
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("ILLEGGIBILE"); }
  const max = 1280, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d", { willReadFrequently: true }).drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  c.__origScale = s; // per misurare il volto in pixel della foto originale
  return c;
}

/** Restituisce i volti trovati, ordinati dal più grande. Prova sull'immagine intera e poi su riquadri sovrapposti
 *  (il modello «short range» funziona meglio quando il volto occupa una buona parte dell'immagine). */
export async function detectFaces(canvas) {
  const det = await getDetector();
  const found = [];
  const run = (src, ox, oy, sc) => {
    const r = det.detect(src);
    for (const d of r.detections) {
      const b = d.boundingBox;
      const kp = (d.keypoints || []).map(k => ({ x: ox + k.x * src.width * sc, y: oy + k.y * src.height * sc }));
      found.push({ x: ox + b.originX * sc, y: oy + b.originY * sc, w: b.width * sc, h: b.height * sc, score: d.categories?.[0]?.score ?? 0, kp });
    }
  };
  run(canvas, 0, 0, 1);
  if (!found.length) {
    const W = canvas.width, H = canvas.height, tw = Math.round(W * 0.6), th = Math.round(H * 0.6);
    for (const [fx, fy] of [[0, 0], [0.4, 0], [0, 0.4], [0.4, 0.4], [0.2, 0.2]]) {
      const t = document.createElement("canvas"); t.width = tw; t.height = th;
      t.getContext("2d").drawImage(canvas, fx * W, fy * H, tw, th, 0, 0, tw, th);
      run(t, fx * W, fy * H, 1);
    }
  }
  // elimina doppioni (stesso volto trovato in più riquadri)
  const out = [];
  for (const f of found.sort((a, b) => b.w * b.h - a.w * a.h)) {
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    if (!out.some(o => Math.abs(o.x + o.w / 2 - cx) < o.w / 2 && Math.abs(o.y + o.h / 2 - cy) < o.h / 2)) out.push(f);
  }
  return out;
}

/* ---------- Controllo qualità del volto (QA-PROTO-004, 005, 017, 018) ----------
 * Soglie provvisorie del prototipo, da confermare (GDD §5 n. 2: volto ≥ 200×200 px [DA APPROVARE]). */
export const QUALITY = {
  minScore: 0.7,          // confidenza minima del rilevamento
  minFacePx: 100,         // sotto: rifiuto (pixel della foto originale)
  goodFacePx: 200,        // sotto: avviso «volto piccolo» (soglia del GDD)
  darkReject: 0.16,       // luminosità media del volto (0–1) sotto cui la foto è rifiutata
  darkWarn: 0.30,         // sotto: avviso «poco illuminata»
  brightWarn: 0.92,       // sopra: avviso «sovraesposta»
  lowContrast: 0.045,     // deviazione standard della luminosità sotto cui: avviso
  tiltWarnDeg: 15,        // oltre: avviso (il raddrizzamento automatico resta limitato a ±15°)
  tiltRejectDeg: 50,      // oltre (o volto capovolto): rifiuto
  edgeWarn: 0.9,          // quota minima dell'ovale che deve cadere dentro la foto
};

/** Restituisce { faces (idonei), discarded: { small, lowScore } } */
export async function findFaces(canvas) {
  const all = await detectFaces(canvas);
  const sc = canvas.__origScale || 1;
  const discarded = { small: 0, lowScore: 0 };
  const faces = all.filter(f => {
    if (f.score < QUALITY.minScore) { discarded.lowScore++; return false; }
    if (Math.min(f.w, f.h) / sc < QUALITY.minFacePx) { discarded.small++; return false; }
    return true;
  });
  // foto capovolta: il modello a volte trova il volto anche al contrario, con punti di riferimento sbagliati.
  // Si riprova sulla stessa zona ruotata di 180°: se lì il volto è molto più sicuro, la foto è capovolta (QA-PROTO-017).
  const det = await getDetector();
  for (const f of faces) {
    const pad = f.w * 0.4, x = Math.max(0, f.x - pad), y = Math.max(0, f.y - pad);
    const w = Math.min(canvas.width - x, f.w + 2 * pad), h = Math.min(canvas.height - y, f.h + 2 * pad);
    const t = document.createElement("canvas"); t.width = Math.round(w); t.height = Math.round(h);
    const g = t.getContext("2d"); g.translate(t.width, t.height); g.rotate(Math.PI); g.drawImage(canvas, x, y, w, h, 0, 0, t.width, t.height);
    f.flipScore = Math.max(0, ...det.detect(t).detections.map(d => d.categories?.[0]?.score ?? 0));
  }
  return { faces, discarded };
}

function rawAngleDeg(face) {
  if (face.kp.length < 2) return 0;
  const [re, le] = face.kp;
  return Math.atan2(le.y - re.y, le.x - re.x) * 180 / Math.PI;
}
function upsideDown(face) { // occhi sotto la bocca, o volto molto più riconoscibile ruotato di 180° → foto capovolta
  if ((face.flipScore || 0) > face.score + 0.08) return true;
  if (face.kp.length < 4) return false;
  const [re, le, , mouth] = face.kp;
  return mouth.y < (re.y + le.y) / 2 - face.h * 0.1;
}

/** Luminosità media e contrasto nel riquadro del volto. */
export function faceLight(canvas, face) {
  const x = Math.max(0, Math.round(face.x)), y = Math.max(0, Math.round(face.y));
  const w = Math.max(1, Math.min(canvas.width - x, Math.round(face.w))), h = Math.max(1, Math.min(canvas.height - y, Math.round(face.h)));
  const d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(x, y, w, h).data;
  let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; sum += l; sum2 += l * l; n++; }
  const mean = sum / n; return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
}

/** Quota dell'ovale di ritaglio che cade dentro la foto (1 = tutto dentro). */
export function ovalCoverage(canvas, face, variant) {
  const ovalW = face.w * 1.55 * variant.scale, ovalH = ovalW * 1.25;
  const cx = face.x + face.w / 2, cy = face.y + face.h / 2 - face.h * 0.12;
  let inside = 0, tot = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
    const u = (i + .5) / 24 * 2 - 1, v = (j + .5) / 24 * 2 - 1; if (u * u + v * v > 1) continue;
    const px = cx + u * ovalW / 2, py = cy + v * ovalH / 2; tot++;
    if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) inside++;
  }
  return tot ? inside / tot : 1;
}

/** Valuta un volto: { reject: codice | null, warnings: [testi] } */
export function assessFace(canvas, face) {
  const sc = canvas.__origScale || 1, warnings = [];
  const ang = rawAngleDeg(face);
  if (upsideDown(face) || Math.abs(ang) > QUALITY.tiltRejectDeg) return { reject: "STORTA", warnings };
  const L = faceLight(canvas, face);
  if (L.mean < QUALITY.darkReject) return { reject: "SCURA", warnings, light: L };
  if (L.mean < QUALITY.darkWarn) warnings.push("la foto è poco illuminata: la testa potrebbe risultare scura");
  else if (L.mean > QUALITY.brightWarn) warnings.push("la foto è molto chiara: il viso potrebbe risultare sbiadito");
  if (L.std < QUALITY.lowContrast) warnings.push("il viso ha poco contrasto");
  if (Math.min(face.w, face.h) / sc < QUALITY.goodFacePx) warnings.push("il viso è piccolo nella foto: la testa potrebbe risultare sgranata");
  if (Math.abs(ang) > QUALITY.tiltWarnDeg) warnings.push(`il viso è inclinato di circa ${Math.round(Math.abs(ang))}°: lo raddrizzo solo fino a 15°`);
  return { reject: null, warnings, light: L, angle: ang };
}

export const CROP_VARIANTS = [
  { label: "standard", scale: 1.0 },
  { label: "più larga", scale: 1.18 },
  { label: "più stretta", scale: 0.88 },
];

/** Ritaglio automatico: ovale verticale centrato sul volto, raddrizzato con gli occhi (max ±15°),
 *  bordo «sticker» bianco + contorno inchiostro + ombra leggera (direzione B §3.8). */
export function cropHead(srcCanvas, face, variant = CROP_VARIANTS[0], outW = 320, outH = 400) {
  let angle = 0;
  if (face.kp.length >= 2) {
    const [re, le] = face.kp; // occhio destro (a sinistra nell'immagine), occhio sinistro
    angle = Math.atan2(le.y - re.y, le.x - re.x);
    const lim = 15 * Math.PI / 180;
    angle = Math.max(-lim, Math.min(lim, angle));
  }
  const cx = face.x + face.w / 2, cy = face.y + face.h / 2 - face.h * 0.12;
  // l'ovale della testa comprende capelli e mento: ~1,55 × larghezza del volto, rapporto 4:5
  const ovalW = face.w * 1.55 * variant.scale, ovalH = ovalW * (outH / outW);
  const c = document.createElement("canvas"); c.width = outW; c.height = outH;
  const g = c.getContext("2d");
  const border = Math.round(outW * 0.055), ink = Math.max(2, Math.round(outW * 0.012)), pad = Math.round(outW * 0.03);
  const rx = outW / 2 - pad, ry = outH / 2 - pad;
  // ombra
  g.save(); g.fillStyle = "rgba(43,35,32,.28)";
  g.beginPath(); g.ellipse(outW / 2 + pad * 0.5, outH / 2 + pad * 0.7, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
  // contorno inchiostro + bordo bianco
  g.fillStyle = "#2B2320"; g.beginPath(); g.ellipse(outW / 2, outH / 2, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#FFFFFF"; g.beginPath(); g.ellipse(outW / 2, outH / 2, rx - ink, ry - ink, 0, 0, Math.PI * 2); g.fill();
  // foto dentro l'ovale
  g.save();
  g.beginPath(); g.ellipse(outW / 2, outH / 2, rx - ink - border, ry - ink - border, 0, 0, Math.PI * 2); g.clip();
  const innerW = 2 * (rx - ink - border), k = innerW / ovalW; // scala uniforme, nessuna deformazione
  g.translate(outW / 2, outH / 2); g.rotate(-angle); g.scale(k, k); g.translate(-cx, -cy);
  g.drawImage(srcCanvas, 0, 0);
  g.restore();
  return { canvas: c, angleDeg: Math.round(angle * 180 / Math.PI) };
}
