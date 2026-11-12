// ============================================================================
// src/Utils.jsx
// Helper Utilities + Production IndexedDB Binary Blob Engine ("comfy_outputs")
// ============================================================================

export function generateClientId() {
  return 'cp-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

export function detectMediaCategory(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return 'video';
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.flac')) return 'audio';
  if (lower.endsWith('.gif')) return 'gif';
  return 'image';
}

// Creates a real binary SVG Blob for offline Sandbox testing so it uses the exact same IndexedDB pipeline
export function createSimulatedBatchSvgBlob({
  promptText = '',
  seed = 12345,
  batchIndex = 0,
  batchTotal = 1,
  width = 1920,
  height = 1088
}) {
  const safePrompt = String(promptText || 'Editorial Prompt')
    .replace(/[<>&"']/g, '')
    .slice(0, 75);

  const hues = [160, 195, 265, 330];
  const hue = hues[batchIndex % hues.length];

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue}, 65%, 14%)" />
        <stop offset="50%" stop-color="#09090b" />
        <stop offset="100%" stop-color="hsl(${(hue + 45) % 360}, 70%, 16%)" />
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)" />
    <circle cx="650" cy="120" r="180" fill="hsl(${hue}, 80%, 45%)" opacity="0.12" />
    <circle cx="160" cy="390" r="210" fill="hsl(${(hue + 45) % 360}, 80%, 50%)" opacity="0.1" />
    <rect x="36" y="36" width="728" height="428" rx="24" fill="none" stroke="#10b981" stroke-opacity="0.35" stroke-width="2" />
    <text x="64" y="92" fill="#10b981" font-family="monospace" font-size="18" font-weight="bold">
      INDEXEDDB BLOB • BATCH #${batchIndex + 1} OF ${batchTotal}
    </text>
    <text x="64" y="135" fill="#f4f4f5" font-family="sans-serif" font-size="24" font-weight="bold">
      Z-Image Turbo (${width}×${height})
    </text>
    <text x="64" y="182" fill="#a1a1aa" font-family="sans-serif" font-size="16">
      "${safePrompt}..."
    </text>
    <text x="64" y="420" fill="#71717a" font-family="monospace" font-size="15">
      Seed: ${seed} • Stored as Binary Blob in IndexedDB (comfy_outputs)
    </text>
  </svg>`;

  return new Blob([svgString], { type: 'image/svg+xml' });
}

// ============================================================================
// PRODUCTION INDEXEDDB ENGINE FOR `comfy_outputs`
// Stores raw binary Blobs on the client device (Web, PWA, iOS & Android)
// ============================================================================
const DB_NAME = 'ComfyPocketStorage';
const DB_VERSION = 1;
const STORE_NAME = 'comfy_outputs';

function openOutputsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const comfyOutputDB = {
  // Check if an output ID is already saved in IndexedDB (prevents duplicate downloads)
  async getById(id) {
    const db = await openOutputsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  // Save a media record + binary Blob into IndexedDB and return a live Object URL
  async saveMediaBlob(record) {
    const db = await openOutputsDB();
    const itemToStore = {
      ...record,
      createdAt: record.createdAt || Date.now()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(itemToStore);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    return {
      ...itemToStore,
      url: itemToStore.blob ? URL.createObjectURL(itemToStore.blob) : itemToStore.url
    };
  },

  // Load all cached media Blobs from IndexedDB, sorted newest-first
  async loadAllMedia(limit = 50) {
    const db = await openOutputsDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    return records
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        url: item.blob ? URL.createObjectURL(item.blob) : item.url
      }));
  },

  // Wipe all cached outputs from IndexedDB
  async clearAll() {
    const db = await openOutputsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};