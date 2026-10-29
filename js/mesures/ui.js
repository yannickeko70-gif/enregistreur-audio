import { ICONS } from "./icons.js";

const $ = (id) => document.getElementById(id);
const timerEl = $("timer");
const msgEl = $("message");
const btnMain = $("btnMain");
const btnPause = $("btnPause");
const statusEl = $("status");
const statusText = $("statusText");

export function setTimer(text) {
  timerEl.textContent = text;
}

export function showMessage(text) {
  msgEl.textContent = text;
  msgEl.hidden = false;
}

export function hideMessage() {
  msgEl.hidden = true;
}

export function bindControls({ onMain, onPause }) {
  btnMain.addEventListener("click", onMain);
  btnPause.addEventListener("click", onPause);
}

// Met à jour boutons, pastille d'état et couleur du chrono
export function updateControls(state) {
  const idle = state === "idle";
  btnMain.innerHTML = idle ? ICONS.mic : ICONS.stop;
  btnMain.setAttribute("aria-label", idle ? "Enregistrer" : "Arrêter");
  btnPause.hidden = idle;
  btnPause.innerHTML = state === "paused" ? ICONS.play : ICONS.pause;
  btnPause.setAttribute("aria-label", state === "paused" ? "Reprendre" : "Pause");
  statusEl.hidden = idle;
  statusEl.className = "status " + state;
  statusText.textContent = state === "paused" ? "En pause" : "Enregistrement";
  timerEl.className = "timer " + state;
}