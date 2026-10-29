import { MIN_DB, PEAKS_COUNT } from "./config.js";
import { toPeaks, recordingName } from "./utils.js";
import { pushSpectrum } from "./spectrogram.js";

// Événements envoyés : "start", "state", "finish", "error"
export const recorderEvents = new EventTarget();

let stream, audioCtx, analyser, mediaRecorder, buf, freqData;
let session = null;
let allLevels = [];
let state = "idle"; // idle | recording | paused
let busy = false;
let startedAt = 0;
let accumulated = 0;

function emit(type, detail) {
  recorderEvents.dispatchEvent(new CustomEvent(type, { detail }));
}

function setState(next) {
  state = next;
  emit("state", next);
}

export function getState() {
  return state;
}

export function getElapsed() {
  return state === "recording"
    ? accumulated + (performance.now() - startedAt)
    : accumulated;
}

// Niveau sonore actuel (0 -> 1), conservé pour le graphique de lecture
export function sampleLevel() {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  const db = 20 * Math.log10(rms || 1e-8);
  const level = Math.min(1, Math.max(0, (db - MIN_DB) / -MIN_DB));
  allLevels.push(level);
  return level;
}

export function sampleSpectrum() {
  pushSpectrum(analyser, freqData, audioCtx.sampleRate);
}

export async function startRecording() {
  if (busy || state !== "idle") return;
  busy = true;
  try {
    await doStart();
  } finally {
    busy = false;
  }
}

async function doStart() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    emit("error", "Micro indisponible : ouvre la page en HTTPS.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err.name === "NotAllowedError") {
      emit("error", "Accès au micro refusé. Autorise-le dans les réglages du navigateur, puis réessaie.");
    } else {
      emit("error", "Impossible d'accéder au micro : " + err.message);
    }
    return;
  }

  // Analyse du signal (niveau + FFT)
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -25;
  buf = new Float32Array(analyser.fftSize);
  freqData = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);

  // Enregistrement du fichier
  const parts = [];
  const s = { levels: [], duration: 0 };
  session = s;
  allLevels = s.levels;

  const mr = new MediaRecorder(stream);
  mediaRecorder = mr;
  mr.ondataavailable = (e) => {
    if (e.data.size) parts.push(e.data);
  };
  mr.onstop = () => {
    emit("finish", {
      name: recordingName(new Date()),
      date: Date.now(),
      duration: s.duration,
      mimeType: mr.mimeType || "",
      blob: new Blob(parts, { type: mr.mimeType }),
      peaks: toPeaks(s.levels, PEAKS_COUNT),
    });
  };
  mr.start();

  accumulated = 0;
  startedAt = performance.now();
  emit("start");
  setState("recording");
}

export function togglePause() {
  if (state === "recording") {
    mediaRecorder.pause();
    accumulated = getElapsed();
    setState("paused");
  } else if (state === "paused") {
    mediaRecorder.resume();
    startedAt = performance.now();
    setState("recording");
  }
}

export function stopRecording() {
  if (state === "idle") return;
  accumulated = getElapsed();
  session.duration = accumulated;
  mediaRecorder.stop();
  stream.getTracks().forEach((t) => t.stop()); // coupe le micro
  audioCtx.close();
  setState("idle");
}