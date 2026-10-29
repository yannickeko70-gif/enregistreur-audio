import { ICONS } from "./icons.js";
import { formatTime, formatDate } from "./utils.js";
import { fitCanvas, drawBars } from "./draw.js";
import { saveRecording, getAllRecordings, removeRecording } from "./storage.js";
import { showMessage } from "./ui.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");

let items = [];          // enregistrements sauvegardés
let activeId = null;     // enregistrement déplié
let currentUrl = null;
let pui = null;          // éléments du lecteur de l'enregistrement actif
let playRaf = null;

const audio = new Audio(); // un seul lecteur pour toute l'application

/* ---------- Lecture ---------- */

function selectRecording(rec, autoplay) {
  if (activeId !== rec.id) {
    audio.pause();
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(rec.blob);
    audio.src = currentUrl;
    activeId = rec.id;
    renderList();
  }
  if (autoplay) audio.play().catch(() => {});
}

function togglePlay(rec) {
  if (activeId !== rec.id) {
    selectRecording(rec, true);
    return;
  }
  if (audio.paused || audio.ended) audio.play().catch(() => {});
  else audio.pause();
}

function drawPlayback() {
  if (!pui) return;
  const total = pui.rec.duration / 1000;
  let ratio = total > 0 ? Math.min(1, audio.currentTime / total) : 0;
  if (audio.ended) ratio = 1;
  drawBars(pui.ctx, pui.size.w, pui.size.h, pui.rec.peaks, ratio);
  const cur = audio.ended ? pui.rec.duration : audio.currentTime * 1000;
  pui.curEl.textContent = formatTime(Math.min(cur, pui.rec.duration));
}

function syncPlayBtn() {
  if (!pui) return;
  const playing = !audio.paused && !audio.ended;
  pui.playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
}

function playLoop() {
  drawPlayback();
  if (!audio.paused && !audio.ended) {
    playRaf = requestAnimationFrame(playLoop);
  }
}

audio.addEventListener("play", () => {
  syncPlayBtn();
  cancelAnimationFrame(playRaf);
  playLoop();
});
["pause", "ended"].forEach((ev) =>
  audio.addEventListener(ev, () => {
    syncPlayBtn();
    drawPlayback();
  })
);
["seeked", "timeupdate"].forEach((ev) =>
  audio.addEventListener(ev, drawPlayback)
);

export function pausePlayback() {
  audio.pause();
}

/* ---------- Actions ---------- */

function download(rec) {
  const type = rec.mimeType || "";
  const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
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
  if (activeId === rec.id) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
    activeId = null;
  }
  items = items.filter((i) => i.id !== rec.id);
  renderList();
}

// Appelé quand un enregistrement vient de se terminer
export async function addRecording(rec) {
  try {
    rec.id = await saveRecording(rec);
  } catch (err) {
    rec.id = "tmp-" + Date.now();
    showMessage("Stockage indisponible : cet enregistrement disparaîtra à la fermeture de la page. Utilise le bouton de téléchargement.");
  }
  items.unshift(rec);
  selectRecording(rec, false); // une seule apparition : en haut de la liste, déplié
}

/* ---------- Affichage de la liste ---------- */

function iconButton(icon, label, className, onClick) {
  const b = document.createElement("button");
  b.className = "icon-btn " + className;
  b.innerHTML = icon;
  b.setAttribute("aria-label", label);
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function buildItem(rec) {
  const active = rec.id === activeId;
  const li = document.createElement("li");
  li.className = "item" + (active ? " active" : "");

  const head = document.createElement("div");
  head.className = "item-head";
  const playBtn = iconButton(ICONS.play, "Lire", "accent");
  const info = document.createElement("div");
  info.className = "info";
  const name = document.createElement("strong");
  name.textContent = rec.name;
  const meta = document.createElement("span");
  meta.textContent = formatDate(rec.date) + " · " + formatTime(rec.duration);
  info.append(name, meta);
  head.append(playBtn, info);
  head.addEventListener("click", () => togglePlay(rec));
  li.append(head);

  if (active) {
    const box = document.createElement("div");
    box.className = "player";

    const pc = document.createElement("canvas");
    pc.className = "pwave";
    pc.addEventListener("click", (e) => {
      const r = pc.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      try {
        audio.currentTime = ratio * (rec.duration / 1000);
      } catch (err) {}
    });

    const times = document.createElement("div");
    times.className = "times";
    const curEl = document.createElement("span");
    curEl.textContent = "00:00";
    const totalEl = document.createElement("span");
    totalEl.textContent = formatTime(rec.duration);
    times.append(curEl, totalEl);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      iconButton(ICONS.download, "Télécharger", "", () => download(rec)),
      iconButton(ICONS.trash, "Supprimer", "danger", () => deleteRecording(rec))
    );

    box.append(pc, times, actions);
    li.append(box);

    pui = { rec, canvas: pc, ctx: pc.getContext("2d"), size: { w: 0, h: 0 }, curEl, playBtn };
  }

  return li;
}

function renderList() {
  listEl.innerHTML = "";
  pui = null;
  emptyEl.hidden = items.length > 0;
  countEl.textContent = items.length
    ? items.length + (items.length > 1 ? " fichiers" : " fichier")
    : "";

  items.forEach((rec) => listEl.append(buildItem(rec)));

  if (pui) {
    pui.size = fitCanvas(pui.canvas, pui.ctx);
    drawPlayback();
    syncPlayBtn();
  }
}

export function resizeLibrary() {
  if (!pui) return;
  pui.size = fitCanvas(pui.canvas, pui.ctx);
  drawPlayback();
}

export async function initLibrary() {
  document.getElementById("emptyIcon").innerHTML = ICONS.mic;
  try {
    items = await getAllRecordings();
    items.sort((a, b) => b.date - a.date);
  } catch (err) {
    showMessage("Stockage indisponible : les enregistrements ne peuvent pas être chargés.");
  }
  renderList();
}