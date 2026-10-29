import { SPEC_COLS, SPEC_ROWS, MAX_FREQ } from "./config.js";

const STOPS = [
  [0,    [10, 12, 20]],
  [0.25, [60, 20, 120]],
  [0.5,  [200, 40, 100]],
  [0.75, [250, 150, 40]],
  [1,    [255, 250, 200]],
];

// Tableau de 256 couleurs : 0 (silence) -> 255 (très fort)
function buildPalette() {
  const lut = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 1;
    while (k < STOPS.length - 1 && t > STOPS[k][0]) k++;
    const [t0, c0] = STOPS[k - 1];
    const [t1, c1] = STOPS[k];
    const f = (t - t0) / (t1 - t0);
    lut.push(c0.map((v, j) => Math.round(v + (c1[j] - v) * f)));
  }
  return lut;
}
const PALETTE = buildPalette();

// Image du spectrogramme, hors écran
const specCanvas = document.createElement("canvas");
specCanvas.width = SPEC_COLS;
specCanvas.height = SPEC_ROWS;
const specCtx = specCanvas.getContext("2d");

export function resetSpectrogram() {
  const [R, G, B] = PALETTE[0];
  specCtx.fillStyle = "rgb(" + R + "," + G + "," + B + ")";
  specCtx.fillRect(0, 0, SPEC_COLS, SPEC_ROWS);
}

// Ajoute une colonne de couleurs à droite, l'image défile vers la gauche
export function pushSpectrum(analyser, freqData, sampleRate) {
  analyser.getByteFrequencyData(freqData);
  const hzPerBin = sampleRate / analyser.fftSize;
  const maxBin = Math.min(freqData.length - 1, Math.floor(MAX_FREQ / hzPerBin));
  const step = maxBin / SPEC_ROWS;
  const col = specCtx.createImageData(1, SPEC_ROWS);

  for (let r = 0; r < SPEC_ROWS; r++) {
    const a = Math.floor(r * step);
    const b = Math.max(a + 1, Math.floor((r + 1) * step));
    let v = 0;
    for (let k = a; k < b; k++) v = Math.max(v, freqData[k]);
    const [R, G, B] = PALETTE[v];
    const o = (SPEC_ROWS - 1 - r) * 4;   // basses fréquences en bas
    col.data[o] = R;
    col.data[o + 1] = G;
    col.data[o + 2] = B;
    col.data[o + 3] = 255;
  }

  specCtx.drawImage(specCanvas, -1, 0);
  specCtx.putImageData(col, SPEC_COLS - 1, 0);
}

export function drawSpectrogram(ctx, w, h) {
  ctx.drawImage(specCanvas, 0, 0, SPEC_COLS, SPEC_ROWS, 0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("8 kHz", 8, 15);
  ctx.fillText("4 kHz", 8, h / 2);
  ctx.fillText("0 Hz", 8, h - 8);
}