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

export const saveRecording = (rec) => dbRun("readwrite", (s) => s.add(rec));
export const getAllRecordings = () => dbRun("readonly", (s) => s.getAll());
export const removeRecording = (id) => dbRun("readwrite", (s) => s.delete(id));