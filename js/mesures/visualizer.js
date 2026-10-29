import { MAX_POINTS, SAMPLE_EVERY_MS, SPEC_EVERY_MS } from "./config.js";
import { fitCanvas, drawBars } from "./draw.js";
import { resetSpectrogram, drawSpectrogram } from "./spectrogram.js";
import { getState, getElapsed, sampleLevel, sampleSpectrum } from "./recorder.js";
import { formatTime } from "./utils.js";
import { setTimer } from "./ui.js";

const canvas = document.getElementById("wave");
const g = canvas.getContext("2d");
const tabAmp = document.getElementById("tabAmp");
const tabSpec = document.getElementById("tabSpec");

let levels = new Array(MAX_POINTS).fill(0);
let viewMode = "amplitude"; // amplitude | spectrogram
let size = { w: 0, h: 0 };
let rafId = null;
let lastSample = 0;
let lastSpec = 0;

function draw() {
  if (viewMode === "spectrogram") {
    drawSpectrogram(g, size.w, size.h);
  } else {
    drawBars(g, size.w, size.h, levels, 1);
  }
}

function loop(now) {
  if (getState() === "recording") {
    if (now - lastSample >= SAMPLE_EVERY_MS) {
      lastSample = now;
      levels.push(sampleLevel());
      levels.shift();
    }
    if (now - lastSpec >= SPEC_EVERY_MS) {
      lastSpec = now;
      sampleSpectrum();
    }
  }
  setTimer(formatTime(getElapsed()));
  draw();
  rafId = requestAnimationFrame(loop);
}

export function startVisualizer() {
  cancelAnimationFrame(rafId);
  levels = new Array(MAX_POINTS).fill(0);
  resetSpectrogram();
  rafId = requestAnimationFrame(loop);
}

export function stopVisualizer() {
  cancelAnimationFrame(rafId);
  setTimer(formatTime(getElapsed()));
}

export function setView(mode) {
  viewMode = mode;
  tabAmp.classList.toggle("active", mode === "amplitude");
  tabSpec.classList.toggle("active", mode === "spectrogram");
  draw();
}

export function resizeVisualizer() {
  size = fitCanvas(canvas, g);
  draw();
}

export function initVisualizer() {
  tabAmp.addEventListener("click", () => setView("amplitude"));
  tabSpec.addEventListener("click", () => setView("spectrogram"));
  resetSpectrogram();
  resizeVisualizer();
}