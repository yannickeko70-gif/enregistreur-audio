import {
  recorderEvents,
  getState,
  startRecording,
  togglePause,
  stopRecording,
} from "./recorder.js";
import {
  initVisualizer,
  startVisualizer,
  stopVisualizer,
  resizeVisualizer,
} from "./visualizer.js";
import {
  initLibrary,
  addRecording,
  pausePlayback,
  resizeLibrary,
} from "./library.js";
import { bindControls, updateControls, showMessage, hideMessage } from "./ui.js";

// Le micro prévient, l'application réagit
recorderEvents.addEventListener("start", () => startVisualizer());

recorderEvents.addEventListener("state", (e) => {
  updateControls(e.detail);
  if (e.detail === "idle") stopVisualizer();
});

recorderEvents.addEventListener("finish", (e) => addRecording(e.detail));
recorderEvents.addEventListener("error", (e) => showMessage(e.detail));

// Boutons
bindControls({
  onMain: () => {
    if (getState() === "idle") {
      hideMessage();
      pausePlayback(); // évite d'enregistrer la lecture en cours
      startRecording();
    } else {
      stopRecording();
    }
  },
  onPause: togglePause,
});

window.addEventListener("resize", () => {
  resizeVisualizer();
  resizeLibrary();
});

// Démarrage
initVisualizer();
updateControls("idle");
initLibrary();