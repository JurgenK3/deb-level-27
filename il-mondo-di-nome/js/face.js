// Rilevamento del volto e ritaglio automatico, interamente nel browser.
// Libreria: MediaPipe Tasks Vision (Apache-2.0), file e modello serviti dalla cartella locale.
import { FilesetResolver, FaceDetector } from "../lib/mediapipe/vision_bundle.mjs";

let detectorPromise = null;
function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(new URL("../lib/mediapipe/wasm", import.meta.url).href);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: new URL("../models/blaze_face_short_range.tflite", import.meta.url).href, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
  }
  return detectorPromise;
}

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
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
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
