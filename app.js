// ---------- Réglages ----------
const MAX_POINTS = 80;        // taille fixe du tampon affiché
const MIN_DB = -60;           // en dessous = silence
const SAMPLE_INTERVAL = 50;   // un point toutes les 50 ms (~20/s)

// ---------- Éléments de la page ----------
const $ = (id) => document.getElementById(id);
const canvas = $('visualizer');
const g = canvas.getContext('2d');
const timerEl = $('timer');
const messageEl = $('message');
const btnStart = $('btn-start');
const btnPause = $('btn-pause');
const btnStop = $('btn-stop');
const listEl = $('list');
const emptyEl = $('empty');

// ---------- État ----------
let audioCtx, analyser, stream, mediaRecorder, timeBuf;
let chunks = [];
let levels = new Array(MAX_POINTS).fill(0);
let state = 'idle'; // idle | recording | paused
let rafId = null;
let lastSample = 0;
let startedAt = 0;
let elapsedBefore = 0;
let lastDuration = 0;
let count = 0;
let cssW = 0;
let cssH = 0;

// ---------- Utilitaires ----------
function dbToLevel(db) {
  const clamped = Math.max(MIN_DB, Math.min(0, db));
  return (clamped - MIN_DB) / -MIN_DB; // 0 (silence) -> 1 (max)
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function getElapsed() {
  return elapsedBefore + (state === 'recording' ? performance.now() - startedAt : 0);
}

function chooseMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  if (!window.MediaRecorder) return '';
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = !text;
}

// ---------- Calcul du niveau (RMS puis dB) ----------
function currentLevel() {
  analyser.getByteTimeDomainData(timeBuf); // valeurs 0..255, silence = 128
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i++) {
    const v = (timeBuf[i] - 128) / 128;    // -1 .. +1
    sum += v * v;
  }
  const rms = Math.sqrt(sum / timeBuf.length);
  const db = rms > 0 ? 20 * Math.log10(rms) : MIN_DB;
  return dbToLevel(db);
}

// ---------- Dessin ----------
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  cssW = r.width;
  cssH = r.height;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  g.clearRect(0, 0, cssW, cssH);
  const slot = cssW / MAX_POINTS;
  const barW = Math.max(2, slot * 0.6);
  g.fillStyle = '#4f9cff';
  for (let i = 0; i < levels.length; i++) {
    const h = Math.max(2, levels[i] * cssH);
    const x = i * slot + (slot - barW) / 2;
    g.fillRect(x, (cssH - h) / 2, barW, h); // barre centrée verticalement
  }
}

function loop(ts) {
  if (state === 'recording' && ts - lastSample >= SAMPLE_INTERVAL) {
    lastSample = ts;
    levels.push(currentLevel());
    levels.shift();
  }
  timerEl.textContent = formatTime(getElapsed());
  draw();
  rafId = requestAnimationFrame(loop);
}

// ---------- Interface ----------
function updateButtons() {
  btnStart.hidden = state !== 'idle';
  btnPause.hidden = state === 'idle';
  btnStop.hidden = state === 'idle';
  btnPause.textContent = state === 'paused' ? 'Reprendre' : 'Pause';
}

// ---------- Actions ----------
async function start() {
  showMessage('');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('Micro indisponible : la page doit être ouverte en HTTPS (ou sur localhost).');
    return;
  }
  if (!window.MediaRecorder) {
    showMessage("Ce navigateur ne supporte pas l'enregistrement audio.");
    return;
  }

  try {
    // On coupe les traitements automatiques pour que l'amplitude reflète le vrai signal
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      showMessage("Accès au micro refusé. Autorise le micro dans les réglages du navigateur, puis recharge la page.");
    } else if (err.name === 'NotFoundError') {
      showMessage('Aucun micro détecté sur cet appareil.');
    } else {
      showMessage(`Erreur micro : ${err.message}`);
    }
    return;
  }

  // Web Audio : le flux du micro passe dans un AnalyserNode
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  timeBuf = new Uint8Array(analyser.fftSize);
  // Surtout ne pas connecter à audioCtx.destination (sinon larsen)
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  // MediaRecorder : l'enregistrement du fichier
  const mime = chooseMimeType();
  mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  chunks = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = saveRecording;
  mediaRecorder.start(250);

  levels = new Array(MAX_POINTS).fill(0);
  elapsedBefore = 0;
  startedAt = performance.now();
  state = 'recording';
  updateButtons();
  rafId = requestAnimationFrame(loop);
}

function togglePause() {
  if (state === 'recording') {
    mediaRecorder.pause();
    elapsedBefore += performance.now() - startedAt;
    state = 'paused';
  } else if (state === 'paused') {
    mediaRecorder.resume();
    startedAt = performance.now();
    state = 'recording';
  }
  updateButtons();
}

function stop() {
  lastDuration = getElapsed();
  state = 'idle';
  cancelAnimationFrame(rafId);
  mediaRecorder.stop();                      // déclenche saveRecording
  stream.getTracks().forEach((t) => t.stop()); // libère le micro
  audioCtx.close();
  levels = new Array(MAX_POINTS).fill(0);
  timerEl.textContent = '00:00';
  draw();
  updateButtons();
}

function saveRecording() {
  const type = mediaRecorder.mimeType || 'audio/webm';
  const blob = new Blob(chunks, { type });
  const url = URL.createObjectURL(blob);
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
  count += 1;
  addToList(`Enregistrement ${count}`, url, lastDuration, ext);
}

function addToList(name, url, duration, ext) {
  emptyEl.hidden = true;

  const li = document.createElement('li');

  const head = document.createElement('div');
  head.className = 'rec-head';
  const title = document.createElement('span');
  title.textContent = name;
  const dur = document.createElement('span');
  dur.textContent = formatTime(duration);
  head.append(title, dur);

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = url;

  const link = document.createElement('a');
  link.className = 'dl';
  link.href = url;
  link.download = `${name.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
  link.textContent = 'Télécharger';

  li.append(head, audio, link);
  listEl.prepend(li); // le plus récent en haut
}

// ---------- Démarrage ----------
btnStart.addEventListener('click', start);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stop);
window.addEventListener('resize', resizeCanvas);
resizeCanvas();