// L3 «La Porta dei Ricordi» — quiz. GDD §2.1. Nessuna sconfitta: la porta si apre sempre.
const $ = s => document.querySelector(s);

export function runQuiz(api) {
  const { questions, mode, words } = api;
  const pool = questions.filter(q => q.q.trim() && q.right.trim() && q.wrong.filter(w => w.trim()).length >= 1);
  const picked = shuffle(pool).slice(0, 3);
  let i = 0, score = 0, answered = false, sel = -1, helpLeft = mode.id === "passeggiata" ? Infinity : mode.id === "avventura" ? 1 : 0;
  let timer = null, timeLeft = 0, buttons = [], current = null;
  const door = $("#quiz-door"); door.classList.remove("open");
  const help = $("#btn-quiz-help"), next = $("#btn-quiz-next"), fb = $("#quiz-feedback");

  function show() {
    answered = false; sel = -1; fb.textContent = ""; fb.className = "status"; next.hidden = true;
    const q = picked[i];
    const wrongs = q.wrong.map(w => w.trim()).filter(Boolean).slice(0, mode.id === "passeggiata" ? 2 : 3);
    current = { q, opts: shuffle([{ t: q.right.trim(), ok: true }, ...wrongs.map(t => ({ t, ok: false }))]) };
    $("#quiz-q").textContent = q.q;
    $("#quiz-progress").textContent = `Domanda ${i + 1}/${picked.length} · ★ ${score}`;
    const ol = $("#quiz-answers"); ol.innerHTML = "";
    buttons = current.opts.map((o, k) => {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.innerHTML = `<span class="k">${k + 1}</span><span></span>`; b.lastChild.textContent = o.t;
      b.addEventListener("click", () => answer(k));
      li.appendChild(b); ol.appendChild(li); return b;
    });
    help.hidden = helpLeft <= 0 || current.opts.length <= 2; help.disabled = false;
    help.textContent = helpLeft === Infinity ? "Elimina una risposta sbagliata" : `Elimina una risposta sbagliata (${helpLeft})`;
    clearInterval(timer);
    if (mode.id === "sfida") { // 15 s per domanda
      timeLeft = 15; fb.textContent = `Tempo: ${timeLeft} s`;
      timer = setInterval(() => { if (api.isPaused()) return; timeLeft--; if (!answered) fb.textContent = `Tempo: ${timeLeft} s`; if (timeLeft <= 0) { clearInterval(timer); answer(-1); } }, 1000);
    }
    buttons[0]?.focus({ preventScroll: true });
  }

  function answer(k) {
    if (answered) return; answered = true; clearInterval(timer);
    const ok = k >= 0 && current.opts[k].ok;
    buttons.forEach((b, j) => { b.disabled = true; if (current.opts[j].ok) b.classList.add("right"); else if (j === k) b.classList.add("wrong"); });
    buttons.forEach((b, j) => { if (current.opts[j].ok) b.firstChild.textContent = "✓"; else if (j === k) b.firstChild.textContent = "✕"; });
    if (ok) { score++; fb.textContent = `✓ ${words.giusto}`; fb.className = "status ok"; }
    else { fb.textContent = `✕ ${k < 0 ? "Tempo scaduto. " : ""}La risposta giusta era «${current.q.right.trim()}».`; fb.className = "status error"; }
    if (current.q.comment?.trim()) fb.textContent += ` — ${current.q.comment.trim()}`;
    $("#quiz-progress").textContent = `Domanda ${i + 1}/${picked.length} · ★ ${score}`;
    help.hidden = true; next.hidden = false; next.textContent = i < picked.length - 1 ? "Avanti" : "Apri la porta"; next.focus({ preventScroll: true });
  }

  help.onclick = () => {
    if (answered || helpLeft <= 0) return;
    const cand = current.opts.map((o, j) => j).filter(j => !current.opts[j].ok && !buttons[j].classList.contains("gone"));
    if (cand.length <= 1) return;
    buttons[cand[Math.floor(Math.random() * cand.length)]].classList.add("gone");
    helpLeft--; help.hidden = true;
  };
  next.onclick = () => {
    if (i < picked.length - 1) { i++; show(); return; }
    door.classList.add("open"); next.hidden = true;
    fb.textContent = "La porta si apre…"; fb.className = "status ok";
    setTimeout(() => api.win({ stars: score, detail: `${score} risposte giuste su ${picked.length}` }), 1300);
  };

  const kd = e => {
    if (api.isPaused()) return;
    if (/^[1-4]$/.test(e.key) && !answered) { const k = +e.key - 1; if (buttons[k] && !buttons[k].classList.contains("gone")) answer(k); e.preventDefault(); return; }
    if (!answered && ["ArrowDown", "ArrowUp"].includes(e.key)) {
      const n = buttons.length; let s = sel;
      do { s = (s + (e.key === "ArrowDown" ? 1 : -1) + n) % n; } while (buttons[s].classList.contains("gone"));
      sel = s; buttons.forEach((b, j) => b.classList.toggle("sel", j === sel)); buttons[sel].focus({ preventScroll: true }); e.preventDefault();
    }
    // Invio: lo gestisce il pulsante che ha il focus
  };
  window.addEventListener("keydown", kd);
  if (!picked.length) { $("#quiz-q").textContent = "Nessuna domanda configurata."; return { destroy() { window.removeEventListener("keydown", kd); } }; }
  show();
  return { destroy() { clearInterval(timer); window.removeEventListener("keydown", kd); }, debug: () => ({ i, score, n: picked.length }) };
}

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
