// ============================================================================
// src/Utils.jsx
// Auto-Discovery Workflow Loader + Universal Manifest Compiler + IndexedDB Engine
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

// ============================================================================
// 1. AUTO-DISCOVERY LOADER FOR BUILT-IN `src/workflows/`
// Automatically pairs every `*.manifest.json` with its workflow `.json`
// ============================================================================
export function loadPairedWorkflowsFromDisk() {
  const rawModules = import.meta.glob('./workflows/*.json', { eager: true });
  const fileMap = {};

  Object.entries(rawModules).forEach(([filePath, moduleData]) => {
    const fileName = filePath.split('/').pop();
    fileMap[fileName] = moduleData?.default || moduleData;
  });

  const discoveredLibrary = [];

  Object.entries(fileMap).forEach(([fileName, content]) => {
    if (!fileName.endsWith('.manifest.json')) return;
    if (!content || !Array.isArray(content.controls)) return;

    const baseName = fileName.replace(/\.manifest\.json$/, '');
    const expectedWorkflowFile = content.workflow_file || `${baseName}.json`;
    const pairedWorkflowApi =
      fileMap[expectedWorkflowFile] ||
      fileMap[`${baseName}.json`] ||
      content._embedded_workflow_api;

    if (!pairedWorkflowApi) {
      console.warn(
        `[Workflows Loader] Skipping "${fileName}" because paired workflow "${expectedWorkflowFile}" was not found in src/workflows/.`
      );
      return;
    }

    const id = content.meta?.id || baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    discoveredLibrary.push({
      id,
      filename: expectedWorkflowFile,
      manifestFilename: fileName,
      manifest: {
        ...content,
        meta: {
          ...content.meta,
          id,
          title: content.meta?.title || baseName
        }
      },
      workflowApi: pairedWorkflowApi,
      isBuiltIn: true
    });
  });

  return discoveredLibrary.sort((a, b) =>
    (a.manifest.meta?.title || a.filename).localeCompare(b.manifest.meta?.title || b.filename)
  );
}

// ============================================================================
// 2. UNIVERSAL MANIFEST -> COMFYUI API COMPILER
// ============================================================================
export function compileWorkflowFromManifest(workflowApi, manifest, formValues) {
  if (!workflowApi || !manifest) return {};
  const clone = JSON.parse(JSON.stringify(workflowApi));

  const setNodeField = (nodeId, fieldPath, value) => {
    const node = clone[nodeId];
    if (!node || !node.inputs || !fieldPath) return;
    const cleanKey = fieldPath.replace(/^inputs\./, '');
    node.inputs[cleanKey] = value;
  };

  (manifest.controls || []).forEach((ctrl) => {
    const val = formValues[ctrl.id] !== undefined ? formValues[ctrl.id] : ctrl.default;

    if (ctrl.component === 'aspect_picker' && val) {
      setNodeField(ctrl.target_node, ctrl.width_field || 'inputs.width', Number(val.width));
      setNodeField(ctrl.target_node, ctrl.height_field || 'inputs.height', Number(val.height));
      return;
    }

    if (Array.isArray(ctrl.targets)) {
      ctrl.targets.forEach((t) => {
        setNodeField(t.node || t.target_node, t.field || t.target_field, val);
      });
    }

    if (ctrl.target_node && ctrl.target_field) {
      setNodeField(ctrl.target_node, ctrl.target_field, val);
    }
  });

  (manifest.ignore_nodes || []).forEach((nodeId) => {
    delete clone[nodeId];
  });

  return clone;
}

export function extractWorkflowRunMeta(manifest, formValues) {
  const controls = manifest?.controls || [];
  let steps = 8;
  let batchCount = 1;
  let seed = 'Auto';
  let resolution = 'Output';
  let promptPreview = manifest?.meta?.title || 'ComfyUI Generation';

  controls.forEach((ctrl) => {
    const val = formValues[ctrl.id] !== undefined ? formValues[ctrl.id] : ctrl.default;
    const field = String(ctrl.target_field || '').toLowerCase();

    if (field.endsWith('steps') || ctrl.id === 'steps') {
      steps = Math.max(1, Number(val || 8));
    }
    if (field.endsWith('batch_size') || ctrl.id === 'batch_size') {
      batchCount = Math.max(1, Number(val || 1));
    }
    if (ctrl.component === 'seed' || field.endsWith('seed')) {
      seed = val;
    }
    if (ctrl.component === 'aspect_picker' && val?.width && val?.height) {
      resolution = `${val.width}×${val.height}`;
    } else if (field.includes('megapixels') || ctrl.id === 'megapixels') {
      resolution = `${val} MP`;
    }
    if (ctrl.component === 'textarea' && val && typeof val === 'string') {
      promptPreview = val;
    }
  });

  return { steps, batchCount, seed, resolution, promptPreview };
}

export function createSimulatedBatchSvgBlob({
  promptText = '',
  seed = 12345,
  batchIndex = 0,
  batchTotal = 1,
  resolution = '1024×1024'
}) {
  const safePrompt = String(promptText || 'Workflow Prompt')
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
      SANDBOX BLOB • ITEM #${batchIndex + 1} OF ${batchTotal}
    </text>
    <text x="64" y="135" fill="#f4f4f5" font-family="sans-serif" font-size="24" font-weight="bold">
      Resolution: ${resolution}
    </text>
    <text x="64" y="182" fill="#a1a1aa" font-family="sans-serif" font-size="16">
      "${safePrompt}..."
    </text>
    <text x="64" y="420" fill="#71717a" font-family="monospace" font-size="15">
      Seed: ${seed} • Stored in IndexedDB (comfy_outputs)
    </text>
  </svg>`;

  return new Blob([svgString], { type: 'image/svg+xml' });
}

// ============================================================================
// 3. PRODUCTION INDEXEDDB ENGINE (`comfy_outputs` + `custom_workflows`)
// ============================================================================
const DB_NAME = 'ComfyPocketStorage';
const DB_VERSION = 2;
const OUTPUTS_STORE = 'comfy_outputs';
const WORKFLOWS_STORE = 'custom_workflows';

function openAppDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OUTPUTS_STORE)) {
        const store = db.createObjectStore(OUTPUTS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
        const wfStore = db.createObjectStore(WORKFLOWS_STORE, { keyPath: 'id' });
        wfStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const comfyOutputDB = {
  async getById(id) {
    const db = await openAppDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTPUTS_STORE, 'readonly');
      const store = tx.objectStore(OUTPUTS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async saveMediaBlob(record) {
    const db = await openAppDB();
    const itemToStore = {
      ...record,
      createdAt: record.createdAt || Date.now()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTPUTS_STORE, 'readwrite');
      const store = tx.objectStore(OUTPUTS_STORE);
      const req = store.put(itemToStore);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    return {
      ...itemToStore,
      url: itemToStore.blob ? URL.createObjectURL(itemToStore.blob) : itemToStore.url
    };
  },

  async loadAllMedia(limit = 50) {
    const db = await openAppDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(OUTPUTS_STORE, 'readonly');
      const store = tx.objectStore(OUTPUTS_STORE);
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

  async clearAll() {
    const db = await openAppDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTPUTS_STORE, 'readwrite');
      const store = tx.objectStore(OUTPUTS_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};

// Persistent store for user-imported custom workflows on mobile devices
export const comfyWorkflowDB = {
  async saveCustomWorkflow(entry) {
    const db = await openAppDB();
    const record = {
      ...entry,
      isBuiltIn: false,
      createdAt: entry.createdAt || Date.now()
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKFLOWS_STORE, 'readwrite');
      const store = tx.objectStore(WORKFLOWS_STORE);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  },

  async loadCustomWorkflows() {
    const db = await openAppDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKFLOWS_STORE, 'readonly');
      const store = tx.objectStore(WORKFLOWS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async deleteCustomWorkflow(id) {
    const db = await openAppDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKFLOWS_STORE, 'readwrite');
      const store = tx.objectStore(WORKFLOWS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};