export function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
}

export function formatDate(ts) {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function recordingName(d) {
  return (
    "Enregistrement " +
    pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + " " +
    pad(d.getHours()) + "h" + pad(d.getMinutes())
  );
}

// Réduit un long tableau de niveaux à "count" barres (maximum de chaque tranche)
export function toPeaks(all, count) {
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