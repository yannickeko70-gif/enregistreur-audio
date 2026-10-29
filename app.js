const MAX_POINTS = 60;        // barres du graphique en direct
const PEAKS_COUNT = 80;       // barres du graphique de lecture
const MIN_DB = -60;           // en dessous : silence
const SAMPLE_EVERY_MS = 50;   // ~20 mesures par seconde

const $ = (id) => document.getElementById(id);
const timerEl = $("timer");
const canvas = $("wave");
const msgEl = $("message");
const btnStart = $("btnStart");
const btnPause = $("btnPause");
const btnStop = $("btnStop");
const player = $("player");
const playSection = $("playback");
const playTitle = $("playTitle");
const playCanvas = $("playWave");
const listEl = $("list");
const emptyEl = $("empty");
const g = canvas.getContext("2d");
const pg = playCanvas.getContext("2d");

let stream, audioCtx, analyser, recorder, buf;
let chunks = [];
let levels = new Array(MAX_POINTS).fill(0);
let allLevels = [];            // tout le niveau sonore de la session
let state = "idle";            // idle | recording | paused
let rafId = null;
let playRaf = null;
let lastSample = 0;
let startedAt = 0;
let accumulated = 0;
let lastDuration = 0;
let liveSize = { w: 0, h: 0 };
let playSize = { w: 0, h: 0 };
let current = null;            // enregistrement affiché dans le lecteur
let currentUrl = null;

/* ---------- Utilitaires ---------- */

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsed() {
  return state === "recording"
    ? accumulated + (performance.now() - startedAt)
    : accumulated;
}

function showMessage(text) {
  msgEl.textContent = text;
  msgEl.hidden = false;
}

function hideMessage() {
  msgEl.hidden = true;
}

function updateUI() {
  btnStart.hidden = state !== "idle";
  btnPause.hidden = state === "idle";
  btnStop.hidden = state === "idle";
  btnPause.textContent = state === "paused" ? "Reprendre" : "Pause";
}

// Réduit un long tableau de niveaux à "count" barres (le maximum de chaque tranche)
function toPeaks(all, count) {
  if (!all.length) return new Array(count).fill(0);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.floor((i * all.length) / count);
    const b = Math.max(a + 1, Math.floor(((i + 1) * all.length) / count));
    let m = 0;
    for (let j = a; j < b && j < all.length; j++) m = Math.max(m, all[j]);
    out.push(m);
  }
  return out;
}

/* ---------- Stockage (IndexedDB) ---------- */

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("enregistreur-audio", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("recordings", {
          keyPath: "id",
          autoIncrement: true,
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function dbRun(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", mode);
    const req = fn(tx.objectStore("recordings"));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

const saveRecording = (rec) => dbRun("readwrite", (s) => s.add(rec));
const getAllRecordings = () => dbRun("readonly", (s) => s.getAll());
const removeRecording = (id) => dbRun("readwrite", (s) => s.delete(id));

/* ---------- Dessin ---------- */

function fitCanvas(c, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const r = c.getBoundingClientRect();
  c.width = r.width * dpr;
  c.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}

// progress : 0 -> 1, part des barres colorée en bleu (1 = tout en bleu)
function drawBars(ctx, w, h, values, progress) {
  ctx.clearRect(0, 0, w, h);
  const slot = w / values.length;
  const barW = Math.max(2, slot * 0.6);
  const played = progress * values.length;
  values.forEach((v, i) => {
    const bh = Math.max(3, v * h);
    const x = i * slot + (slot - barW) / 2;
    const y = (h - bh) / 2;
    ctx.fillStyle = i < played ? "#4f9cff" : "#3a4358";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, bh, barW / 2);
    else ctx.rect(x, y, barW, bh);
    ctx.fill();
  });
}

function drawLive() {
  drawBars(g, liveSize.w, liveSize.h, levels, 1);
}

function drawPlayback() {
  if (!current) return;
  const total = current.duration / 1000;
  let ratio = total > 0 ? Math.min(1, player.currentTime / total) : 0;
  if (player.ended) ratio = 1;
  drawBars(pg, playSize.w, playSize.h, current.peaks, ratio);
}

/* ---------- Mesure du niveau sonore ---------- */

function measureLevel() {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  const db = 20 * Math.log10(rms || 1e-8);
  return Math.min(1, Math.max(0, (db - MIN_DB) / -MIN_DB));
}

function loop(now) {
  if (state === "recording" && now - lastSample >= SAMPLE_EVERY_MS) {
    lastSample = now;
    const lvl = measureLevel();
    levels.push(lvl);
    levels.shift();
    allLevels.push(lvl);
  }
  timerEl.textContent = formatTime(elapsed());
  drawLive();
  rafId = requestAnimationFrame(loop);
}

/* ---------- Enregistrement ---------- */

async function start() {
  hideMessage();
  player.pause(); // évite d'enregistrer la lecture en cours

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("Micro indisponible : ouvre la page en HTTPS.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showMessage("Accès au micro refusé. Autorise-le dans les réglages du navigateur, puis réessaie.");
    } else {
      showMessage("Impossible d'accéder au micro : " + err.message);
    }
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  buf = new Float32Array(analyser.fftSize);
  source.connect(analyser);

  chunks = [];
  allLevels = [];
  const rec = new MediaRecorder(stream);
  recorder = rec;
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => finishRecording(rec.mimeType);
  rec.start();

  levels = new Array(MAX_POINTS).fill(0);
  accumulated = 0;
  startedAt = performance.now();
  state = "recording";
  updateUI();
  rafId = requestAnimationFrame(loop);
}

function togglePause() {
  if (state === "recording") {
    recorder.pause();
    accumulated = elapsed();
    state = "paused";
  } else if (state === "paused") {
    recorder.resume();
    startedAt = performance.now();
    state = "recording";
  }
  updateUI();
}

function stop() {
  accumulated = elapsed();
  lastDuration = accumulated;
  state = "idle";
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  audioCtx.close();
  cancelAnimationFrame(rafId);
  timerEl.textContent = formatTime(lastDuration);
  updateUI();
}

async function finishRecording(mimeType) {
  const d = new Date();
  const rec = {
    name:
      "Enregistrement " +
      pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + " " +
      pad(d.getHours()) + "h" + pad(d.getMinutes()),
    date: Date.now(),
    duration: lastDuration,
    mimeType: mimeType,
    blob: new Blob(chunks, { type: mimeType }),
    peaks: toPeaks(allLevels, PEAKS_COUNT),
  };

  try {
    rec.id = await saveRecording(rec);
  } catch (err) {
    showMessage("Enregistrement non sauvegardé (stockage indisponible).");
  }

  openRecording(rec, false);
  await renderList();
}

/* ---------- Lecture ---------- */

function openRecording(rec, autoplay) {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  current = rec;
  currentUrl = URL.createObjectURL(rec.blob);
  player.src = currentUrl;
  playTitle.textContent = rec.name;
  playSection.hidden = false;
  playSize = fitCanvas(playCanvas, pg);
  drawPlayback();
  if (autoplay) player.play().catch(() => {});
}

function playLoop() {
  drawPlayback();
  if (!player.paused && !player.ended) {
    playRaf = requestAnimationFrame(playLoop);
  }
}

player.addEventListener("play", () => {
  cancelAnimationFrame(playRaf);
  playLoop();
});
["pause", "ended", "seeked", "timeupdate"].forEach((ev) =>
  player.addEventListener(ev, drawPlayback)
);

function download(rec) {
  const ext = rec.mimeType.includes("mp4")
    ? "m4a"
    : rec.mimeType.includes("ogg")
    ? "ogg"
    : "webm";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(rec.blob);
  a.download = rec.name + "." + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function deleteRecording(rec) {
  if (!window.confirm("Supprimer cet enregistrement ?")) return;
  try {
    await removeRecording(rec.id);
  } catch (err) {
    showMessage("Suppression impossible.");
    return;
  }
  if (current && current.id === rec.id) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    playSection.hidden = true;
    current = null;
  }
  await renderList();
}

/* ---------- Liste ---------- */

function makeButton(label, onClick, ghost) {
  const b = document.createElement("button");
  b.textContent = label;
  if (ghost) b.className = "ghost";
  b.addEventListener("click", onClick);
  return b;
}

async function renderList() {
  let items = [];
  try {
    items = await getAllRecordings();
  } catch (err) {
    showMessage("Stockage indisponible : la liste ne peut pas s'afficher.");
  }
  items.sort((a, b) => b.id - a.id);

  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;

  items.forEach((rec) => {
    const li = document.createElement("li");
    if (current && current.id === rec.id) li.classList.add("active");

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("strong");
    name.textContent = rec.name;
    const meta = document.createElement("span");
    meta.textContent = formatDate(rec.date) + " · " + formatTime(rec.duration);
    info.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      makeButton("Lire", () => {
        openRecording(rec, true);
        renderList();
      }),
      makeButton("↓", () => download(rec), true),
      makeButton("✕", () => deleteRecording(rec), true)
    );

    li.append(info, actions);
    listEl.append(li);
  });
}

/* ---------- Démarrage ---------- */

btnStart.addEventListener("click", start);
btnPause.addEventListener("click", togglePause);
btnStop.addEventListener("click", stop);

window.addEventListener("resize", () => {
  liveSize = fitCanvas(canvas, g);
  drawLive();
  if (!playSection.hidden) {
    playSize = fitCanvas(playCanvas, pg);
    drawPlayback();
  }
});

liveSize = fitCanvas(canvas, g);
drawLive();
updateUI();
renderList();