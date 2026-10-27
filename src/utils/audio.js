export const MIN_DB = -60;

export function dbToLevel(db) {
  if (db === undefined || db === null) return 0;
  const clamped = Math.max(MIN_DB, Math.min(0, db));
  return (clamped - MIN_DB) / -MIN_DB; // 0 (silence) -> 1 (max)
}

export function formatTime(ms) {
  const total = Math.floor((ms || 0) / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}