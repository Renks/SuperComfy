import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  ChevronLeft,
  Check,
  Copy,
  X,
  Upload,
  FileJson
} from 'lucide-react';
import CompactAccordionHeader from './components/CompactAccordianHeader';
import ManifestControlField from './components/ManifestControlField';
import LeftWorkflowsDrawer from './components/LeftWorkflowsDrawer';
import RightOutputsDrawer from './components/RightOutputsDrawer';
import {
  generateClientId,
  detectMediaCategory,
  loadPairedWorkflowsFromDisk,
  compileWorkflowFromManifest,
  extractWorkflowRunMeta,
  createSimulatedBatchSvgBlob,
  comfyOutputDB,
  comfyWorkflowDB
} from './Utils';

export default function App() {
  // Step 0: Endpoint & Health State
  const [endpointInput, setEndpointInput] = useState('http://127.0.0.1:8188');
  const [cleanEndpoint, setCleanEndpoint] = useState('http://127.0.0.1:8188');
  const [connectionStatus, setConnectionStatus] = useState('offline');
  const [statusMessage, setStatusMessage] = useState('Offline • Waiting for ComfyUI');
  const [latencyMs, setLatencyMs] = useState(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [availableModels, setAvailableModels] = useState({});
  const clientIdRef = useRef(generateClientId());
  const wsRef = useRef(null);
  const lastRunMetaRef = useRef({ seed: null, resolution: 'Output' });

  // Step 1: Auto-Discovered Built-In Workflows + IndexedDB Custom Workflows
  const builtInWorkflows = useMemo(() => loadPairedWorkflowsFromDisk(), []);
  const [workflowLibrary, setWorkflowLibrary] = useState(builtInWorkflows);
  const [activeWorkflowId, setActiveWorkflowId] = useState(builtInWorkflows[0]?.id || '');

  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCodeInspector, setShowCodeInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('compiled');

  // Step 2: Dynamic Form & Persistent IndexedDB `comfy_outputs` Gallery State
  const [formValues, setFormValues] = useState({});
  const [seedRandomizeMap, setSeedRandomizeMap] = useState({});
  const [activeSection, setActiveSection] = useState('primary');

  const [isGenerating, setIsGenerating] = useState(false);
  const [activePromptId, setActivePromptId] = useState(null);
  const [executingNodeId, setExecutingNodeId] = useState(null);
  const [progressStep, setProgressStep] = useState({ value: 0, max: 8 });
  const [devLogs, setDevLogs] = useState([
    {
      time: new Date().toLocaleTimeString(),
      type: 'info',
      msg: `Loaded ${builtInWorkflows.length} built-in workflow(s) from src/workflows/`
    }
  ]);

  const [comfyOutputsGallery, setComfyOutputsGallery] = useState([]);
  const [activeMediaOutput, setActiveMediaOutput] = useState(null);
  const [galleryLimit, setGalleryLimit] = useState(12);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Uploaded Input Media Previews (keyed by `${workflowId}:${controlId}`)
  const [uploadedPreviews, setUploadedPreviews] = useState({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Import Modal State (Supports both File Picker & Raw Text)
  const [importManifestText, setImportManifestText] = useState('');
  const [importWorkflowText, setImportWorkflowText] = useState('');
  const [manifestFileName, setManifestFileName] = useState('');
  const [workflowFileName, setWorkflowFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [copiedFlag, setCopiedFlag] = useState(false);

  const activeEntry = useMemo(
    () => workflowLibrary.find((w) => w.id === activeWorkflowId) || workflowLibrary[0],
    [workflowLibrary, activeWorkflowId]
  );

  // Resolve human-readable node title from workflowApi._meta.title or class_type
  const executingNodeName = useMemo(() => {
    if (!executingNodeId) return 'Queued • Preparing Pipeline...';
    const nodeObj = activeEntry?.workflowApi?.[executingNodeId];
    if (nodeObj?._meta?.title) return nodeObj._meta.title;
    if (nodeObj?.class_type) return nodeObj.class_type;
    return `Node ${executingNodeId}`;
  }, [activeEntry, executingNodeId]);

  const addLog = useCallback((type, msg) => {
    setDevLogs((prev) => [{ time: new Date().toLocaleTimeString(), type, msg }, ...prev.slice(0, 49)]);
  }, []);

  // Load persisted user-imported workflows from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    comfyWorkflowDB
      .loadCustomWorkflows()
      .then((savedCustomList) => {
        if (!mounted || savedCustomList.length === 0) return;
        setWorkflowLibrary([...builtInWorkflows, ...savedCustomList]);
        addLog(
          'info',
          `Restored ${savedCustomList.length} custom workflow(s) from device IndexedDB`
        );
      })
      .catch((err) => addLog('error', `Custom workflows load error: ${err.message}`));

    return () => {
      mounted = false;
    };
  }, [builtInWorkflows, addLog]);

  // Upload any input media (image, video, audio) with unique filename + automatic prompt cache-busting
  const handleUploadInputMedia = useCallback(
    async (controlId, file) => {
      if (!activeEntry) return;
      const previewKey = `${activeEntry.id}:${controlId}`;
      const localPreview = URL.createObjectURL(file);
      setUploadedPreviews((prev) => ({ ...prev, [previewKey]: localPreview }));

      // Helper that updates the image filename AND toggles an invisible trailing space
      // on prompt textareas so ComfyUI's CLIPTextEncode / Flux2KleinEnhancer cache invalidates
      const applyNewMediaWithCacheBust = (filenameToSet) => {
        setFormValues((prev) => {
          const next = { ...prev, [controlId]: filenameToSet };
          (activeEntry.manifest.controls || []).forEach((ctrl) => {
            if (ctrl.component === 'textarea') {
              const currentText = String(next[ctrl.id] ?? ctrl.default ?? '');
              next[ctrl.id] = currentText.endsWith(' ')
                ? currentText.trimEnd()
                : `${currentText} `;
            }
          });
          return next;
        });
      };

      if (connectionStatus !== 'online' && connectionStatus !== 'http_only') {
        applyNewMediaWithCacheBust(file.name);
        addLog('info', `Staged local file (${file.name}) for Sandbox mode`);
        return;
      }

      setIsUploadingImage(true);
      try {
        // Prefix with Date.now() so LoadImage (Node 151) always sees a brand-new filename
        const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFilename = `${Date.now()}_${safeBaseName}`;

        const formData = new FormData();
        formData.append('image', file, uniqueFilename);
        formData.append('overwrite', 'true');

        const res = await fetch(`${cleanEndpoint}/upload/image`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const serverFilename = data.subfolder ? `${data.subfolder}/${data.name}` : data.name;

        applyNewMediaWithCacheBust(serverFilename);
        addLog('success', `Uploaded input file to ComfyUI: ${serverFilename}`);
      } catch (err) {
        addLog('error', `File upload failed: ${err.message}`);
      } finally {
        setIsUploadingImage(false);
      }
    },
    [activeEntry, connectionStatus, cleanEndpoint, addLog]
  );

  // Load default values from paired manifest whenever active workflow changes
  useEffect(() => {
    if (!activeEntry) return;
    const initialVals = {};
    const initialSeedRand = {};
    (activeEntry.manifest.controls || []).forEach((ctrl) => {
      initialVals[ctrl.id] = ctrl.default;
      if (ctrl.component === 'seed') {
        initialSeedRand[ctrl.id] = ctrl.randomize_by_default !== false;
      }
    });
    setFormValues(initialVals);
    setSeedRandomizeMap(initialSeedRand);
    setActiveSection('primary');
  }, [activeEntry]);

  // Dynamically fetch available models from ComfyUI `/object_info/{class}`
  useEffect(() => {
    if (!activeEntry || (connectionStatus !== 'online' && connectionStatus !== 'http_only')) return;

    const modelControls = (activeEntry.manifest.controls || []).filter(
      (c) => c.object_info_class && c.object_info_param
    );

    modelControls.forEach(async (ctrl) => {
      const cacheKey = `${ctrl.object_info_class}.${ctrl.object_info_param}`;
      try {
        const res = await fetch(`${cleanEndpoint}/object_info/${ctrl.object_info_class}`);
        if (!res.ok) return;
        const data = await res.json();
        const list =
          data?.[ctrl.object_info_class]?.input?.required?.[ctrl.object_info_param]?.[0] ||
          data?.[ctrl.object_info_class]?.input?.optional?.[ctrl.object_info_param]?.[0];
        if (Array.isArray(list) && list.length > 0) {
          setAvailableModels((prev) => ({
            ...prev,
            [ctrl.object_info_class]: list,
            [cacheKey]: list
          }));
        }
      } catch (_) {}
    });
  }, [activeEntry, connectionStatus, cleanEndpoint]);

  // Load persisted blobs from IndexedDB (`comfy_outputs`) immediately on startup
  useEffect(() => {
    let mounted = true;
    comfyOutputDB
      .loadAllMedia(50)
      .then((cachedItems) => {
        if (!mounted || cachedItems.length === 0) return;
        setComfyOutputsGallery(cachedItems);
        setActiveMediaOutput((prev) => prev || cachedItems[0]);
      })
      .catch((err) => addLog('error', `IndexedDB load error: ${err.message}`));

    return () => {
      mounted = false;
    };
  }, [addLog]);

  // Universal Live Compiled API JSON
  const compiledWorkflowJson = useMemo(() => {
    if (!activeEntry) return {};
    return compileWorkflowFromManifest(activeEntry.workflowApi, activeEntry.manifest, formValues);
  }, [activeEntry, formValues]);

  // Current workflow run metadata (steps, batchCount, resolution) extracted generically
  const currentRunMeta = useMemo(
    () => extractWorkflowRunMeta(activeEntry?.manifest, formValues),
    [activeEntry, formValues]
  );

  // Download media outputs from a ComfyUI `/history` job as binary Blobs and store in IndexedDB
  const downloadAndCacheJobOutputs = useCallback(
    async (baseUrl, promptId, job) => {
      if (!job || !job.outputs) return [];
      const savedItems = [];

      for (const [nodeId, nodeOut] of Object.entries(job.outputs)) {
        const buckets = [
          ...(nodeOut.images || []),
          ...(nodeOut.gifs || []),
          ...(nodeOut.videos || []),
          ...(nodeOut.audio || [])
        ];

        for (let idx = 0; idx < buckets.length; idx++) {
          const item = buckets[idx];
          if (!item || !item.filename) continue;

          const itemId = `${promptId}-${nodeId}-${idx}-${item.filename}`;

          const existing = await comfyOutputDB.getById(itemId);
          if (existing && existing.blob) {
            savedItems.push({
              ...existing,
              url: URL.createObjectURL(existing.blob)
            });
            continue;
          }

          const params = new URLSearchParams({
            filename: item.filename,
            subfolder: item.subfolder || '',
            type: item.type || 'output'
          });
          const viewUrl = `${baseUrl}/view?${params.toString()}`;

          const response = await fetch(viewUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch /view for ${item.filename} (HTTP ${response.status})`);
          }

          const mediaBlob = await response.blob();
          const record = {
            id: itemId,
            promptId,
            nodeId,
            filename: item.filename,
            folderPath: `comfy_outputs/${item.filename}`,
            subfolder: item.subfolder || '',
            kind: detectMediaCategory(item.filename),
            blob: mediaBlob,
            seed: lastRunMetaRef.current.seed,
            resolution: lastRunMetaRef.current.resolution,
            batchIndex: idx + 1,
            batchTotal: buckets.length,
            timestamp: new Date().toLocaleTimeString(),
            createdAt: Date.now() + idx
          };

          const storedWithUrl = await comfyOutputDB.saveMediaBlob(record);
          savedItems.push(storedWithUrl);
        }
      }

      return savedItems;
    },
    []
  );

  // Fetch specific promptId output from `/history/{promptId}` and store Blobs in IndexedDB
  const fetchHistoryOutput = useCallback(
    async (baseUrl, promptId) => {
      try {
        const res = await fetch(`${baseUrl}/history/${promptId}`);
        if (!res.ok) return false;
        const historyData = await res.json();
        const job = historyData[promptId];
        if (!job || !job.outputs) return false;

        const storedMedia = await downloadAndCacheJobOutputs(baseUrl, promptId, job);

        if (storedMedia.length > 0) {
          setActiveMediaOutput(storedMedia[0]);
          setComfyOutputsGallery((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = storedMedia.filter((m) => !existingIds.has(m.id));
            return [...fresh, ...prev];
          });
          setIsGenerating(false);
          setExecutingNodeId(null);
          setShowRightDrawer(true);
          addLog(
            'success',
            `Saved ${storedMedia.length} output Blob(s) into local comfy_outputs IndexedDB`
          );
          return true;
        }
        return false;
      } catch (err) {
        addLog('error', `Output blob fetch error: ${err.message}`);
        return false;
      }
    },
    [downloadAndCacheJobOutputs, addLog]
  );

  // Sync recent outputs from ComfyUI `/history` into local IndexedDB `comfy_outputs`
  const handleSyncComfyOutputsFolder = useCallback(async () => {
    if (connectionStatus !== 'online' && connectionStatus !== 'http_only') {
      const localItems = await comfyOutputDB.loadAllMedia(50);
      setComfyOutputsGallery(localItems);
      addLog('info', `Endpoint offline: Loaded ${localItems.length} cached file(s) from IndexedDB`);
      return;
    }

    try {
      const res = await fetch(`${cleanEndpoint}/history`);
      if (!res.ok) return;
      const allHistory = await res.json();
      const entries = Object.entries(allHistory).reverse().slice(0, galleryLimit);

      let newlySyncedCount = 0;
      for (const [pId, job] of entries) {
        const items = await downloadAndCacheJobOutputs(cleanEndpoint, pId, job);
        newlySyncedCount += items.length;
      }

      const allCached = await comfyOutputDB.loadAllMedia(50);
      setComfyOutputsGallery(allCached);
      if (!activeMediaOutput && allCached.length > 0) {
        setActiveMediaOutput(allCached[0]);
      }
      addLog('success', `Synced ${newlySyncedCount} media item(s) into comfy_outputs IndexedDB`);
    } catch (err) {
      addLog('error', `History sync failed: ${err.message}`);
    }
  }, [connectionStatus, cleanEndpoint, galleryLimit, downloadAndCacheJobOutputs, activeMediaOutput, addLog]);

  // Download all visible/cached generations in one go
  const handleDownloadAllGallery = useCallback(async () => {
    if (comfyOutputsGallery.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    addLog('info', `Starting batch download of ${comfyOutputsGallery.length} file(s)...`);

    try {
      for (let i = 0; i < comfyOutputsGallery.length; i++) {
        const item = comfyOutputsGallery[i];
        if (!item?.url) continue;

        const a = document.createElement('a');
        a.href = item.url;
        a.download = item.filename || `comfy_output_${i + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await new Promise((resolve) => setTimeout(resolve, 220));
      }
      addLog('success', `Downloaded all ${comfyOutputsGallery.length} file(s)`);
    } catch (err) {
      addLog('error', `Download All failed: ${err.message}`);
    } finally {
      setIsDownloadingAll(false);
    }
  }, [comfyOutputsGallery, isDownloadingAll, addLog]);

  // Step 0: Ping Endpoint + Connect WebSocket
  const checkEndpointAndConnect = useCallback(
    async (rawUrl) => {
      const normalized = (rawUrl || '').trim().replace(/\/+$/, '');
      if (!normalized) return;
      setCleanEndpoint(normalized);
      setConnectionStatus('pinging');
      setStatusMessage(`Pinging ${normalized}/system_stats ...`);

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_) {}
        wsRef.current = null;
      }

      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${normalized}/system_stats`, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const pingTime = Math.round(performance.now() - startTime);
        setLatencyMs(pingTime);
        addLog('success', `Connected to ${normalized} (${pingTime}ms)`);

        const wsProtocol = normalized.startsWith('https') ? 'wss' : 'ws';
        const hostPart = normalized.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}://${hostPart}/ws?clientId=${clientIdRef.current}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus('online');
          setStatusMessage(`ONLINE (${pingTime}ms) • WS Ready`);
        };

        ws.onmessage = (event) => {
          if (typeof event.data !== 'string') return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'progress' && msg.data) {
              setProgressStep({ value: msg.data.value, max: msg.data.max });
            } else if (msg.type === 'executing' && msg.data) {
              setExecutingNodeId(msg.data.node);
              if (msg.data.node === null && msg.data.prompt_id) {
                fetchHistoryOutput(normalized, msg.data.prompt_id);
              }
            } else if (msg.type === 'execution_error' && msg.data) {
              setIsGenerating(false);
              setExecutingNodeId(null);
              addLog('error', `Node Error: ${msg.data.exception_message}`);
            }
          } catch (_) {}
        };

        ws.onerror = () => {
          setConnectionStatus('http_only');
          setStatusMessage(`HTTP ONLINE (${pingTime}ms) • WS Closed`);
        };
      } catch (_) {
        setConnectionStatus('offline');
        setLatencyMs(null);
        setStatusMessage('OFFLINE • Check ComfyUI & --enable-cors-header *');
      }
    },
    [addLog, fetchHistoryOutput]
  );

  useEffect(() => {
    checkEndpointAndConnect(endpointInput);
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Polling fallback for mobile lock-screen recovery
  useEffect(() => {
    if (!isGenerating || !activePromptId || connectionStatus === 'offline') return;
    const timer = setInterval(async () => {
      const done = await fetchHistoryOutput(cleanEndpoint, activePromptId);
      if (done) clearInterval(timer);
    }, 1800);
    return () => clearInterval(timer);
  }, [isGenerating, activePromptId, connectionStatus, cleanEndpoint, fetchHistoryOutput]);

  // Universal Workflow Dispatcher
  const handleRunWorkflow = async () => {
    if (!activeEntry) return;

    const nextValues = { ...formValues };
    (activeEntry.manifest.controls || []).forEach((ctrl) => {
      if (ctrl.component === 'seed' && seedRandomizeMap[ctrl.id]) {
        nextValues[ctrl.id] = Math.floor(Math.random() * 900000000000000) + 100000000000000;
      }
    });
    setFormValues(nextValues);

    const payloadWorkflow = compileWorkflowFromManifest(
      activeEntry.workflowApi,
      activeEntry.manifest,
      nextValues
    );

    const runMeta = extractWorkflowRunMeta(activeEntry.manifest, nextValues);
    lastRunMetaRef.current = {
      seed: runMeta.seed,
      resolution: runMeta.resolution
    };

    const workflowNodeIds = Object.keys(payloadWorkflow);
    setIsGenerating(true);
    setProgressStep({ value: 0, max: runMeta.steps });
    setExecutingNodeId(connectionStatus === 'online' ? null : workflowNodeIds[0] || null);

    if (connectionStatus === 'online' || connectionStatus === 'http_only') {
      try {
        addLog(
          'info',
          `POST /prompt (${activeEntry.manifest.meta?.short_title || activeEntry.manifest.meta?.title}, Batch ×${runMeta.batchCount})`
        );
        const res = await fetch(`${cleanEndpoint}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: payloadWorkflow,
            client_id: clientIdRef.current
          })
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          const nodeErrDetails = data.node_errors
            ? Object.entries(data.node_errors)
                .map(([nId, errObj]) => `Node ${nId}: ${errObj.errors?.[0]?.message || 'Invalid input'}`)
                .join(' | ')
            : '';
          throw new Error(
            nodeErrDetails || data?.error?.message || 'Prompt execution rejected by ComfyUI'
          );
        }

        setActivePromptId(data.prompt_id);
        addLog('success', `Queued prompt_id: ${data.prompt_id}`);
      } catch (err) {
        setIsGenerating(false);
        setExecutingNodeId(null);
        setStatusMessage(`ERROR: ${err.message}`);
        addLog('error', `POST /prompt failed: ${err.message}`);
      }
    } else {
      // Universal Sandbox Simulation
      addLog('info', `Simulating batch of ${runMeta.batchCount} Blob(s) into IndexedDB...`);
      let step = 0;
      const interval = setInterval(async () => {
        step += 1;
        const simNodeIdx = Math.min(
          workflowNodeIds.length - 1,
          Math.floor((step / runMeta.steps) * workflowNodeIds.length)
        );
        setExecutingNodeId(workflowNodeIds[simNodeIdx]);
        setProgressStep({ value: step, max: runMeta.steps });

        if (step >= runMeta.steps) {
          clearInterval(interval);
          setIsGenerating(false);
          setExecutingNodeId(null);

          const basePrefix = String(nextValues.filename_prefix || activeEntry.id || 'comfy-output');
          const storedBatch = [];

          for (let idx = 0; idx < runMeta.batchCount; idx++) {
            const itemSeed = Number(runMeta.seed || 1000) + idx;
            const filename = `${basePrefix}_${String(Date.now()).slice(-4)}_0${idx + 1}.svg`;
            const svgBlob = createSimulatedBatchSvgBlob({
              promptText: runMeta.promptPreview,
              seed: itemSeed,
              batchIndex: idx,
              batchTotal: runMeta.batchCount,
              resolution: runMeta.resolution
            });

            const savedItem = await comfyOutputDB.saveMediaBlob({
              id: `sim-${Date.now()}-${idx}`,
              promptId: 'sandbox-batch',
              nodeId: activeEntry.manifest.outputs?.[0]?.target_node || 'output',
              filename,
              folderPath: `comfy_outputs/${filename}`,
              kind: 'image',
              isSimulated: true,
              blob: svgBlob,
              seed: itemSeed,
              resolution: runMeta.resolution,
              batchIndex: idx + 1,
              batchTotal: runMeta.batchCount,
              timestamp: new Date().toLocaleTimeString(),
              createdAt: Date.now() + idx
            });

            storedBatch.push(savedItem);
          }

          setActiveMediaOutput(storedBatch[0]);
          setComfyOutputsGallery((prev) => [...storedBatch, ...prev]);
          setShowRightDrawer(true);
          addLog('success', `Saved ${runMeta.batchCount} simulated Blob(s) into IndexedDB`);
        }
      }, 180);
    }
  };

  // Download Paired Manifest
  const handleDownloadManifest = () => {
    if (!activeEntry) return;
    const bundle = {
      ...activeEntry.manifest,
      _embedded_workflow_api: activeEntry.workflowApi
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeEntry.manifestFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mobile File Picker Handler: Automatically detects whether selected JSON file(s) are Manifest or Workflow API
  const handleSelectJsonFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setImportError('');

    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // If the JSON contains a `controls` array (or filename ends in .manifest.json), treat as Manifest
        if (Array.isArray(parsed.controls) || file.name.endsWith('.manifest.json')) {
          setImportManifestText(text);
          setManifestFileName(file.name);
          // If it also embeds `_embedded_workflow_api`, auto-populate workflow if empty
          if (parsed._embedded_workflow_api && !importWorkflowText) {
            setImportWorkflowText(JSON.stringify(parsed._embedded_workflow_api, null, 2));
            setWorkflowFileName('Embedded inside manifest');
          }
        } else {
          setImportWorkflowText(text);
          setWorkflowFileName(file.name);
        }
      } catch (err) {
        setImportError(`Failed to parse "${file.name}": ${err.message}`);
      }
    }
  };

  // Import Custom Workflow Manifest & Persist to IndexedDB (`comfyWorkflowDB`)
  const handleImportCustomWorkflow = async () => {
    setImportError('');
    try {
      const parsedManifest = JSON.parse(importManifestText);
      if (!parsedManifest.controls || !Array.isArray(parsedManifest.controls)) {
        throw new Error('Invalid manifest.json: Missing "controls" array.');
      }
      let parsedWorkflow = parsedManifest._embedded_workflow_api || null;
      if (importWorkflowText.trim()) {
        parsedWorkflow = JSON.parse(importWorkflowText);
      }
      if (!parsedWorkflow) {
        throw new Error('Please upload or paste the paired workflow_api.json file.');
      }

      const newId = (parsedManifest.meta?.id || 'custom') + '-' + Date.now();
      const fallbackTitle = manifestFileName
        ? manifestFileName.replace(/\.manifest\.json$|\.json$/i, '')
        : 'Custom Mobile Workflow';
      const title = parsedManifest.meta?.title || fallbackTitle;

      const newEntry = {
        id: newId,
        filename: workflowFileName || parsedManifest.workflow_file || `${title}.json`,
        manifestFilename: manifestFileName || `${title}.manifest.json`,
        manifest: {
          ...parsedManifest,
          meta: { ...parsedManifest.meta, id: newId, title }
        },
        workflowApi: parsedWorkflow,
        isBuiltIn: false,
        createdAt: Date.now()
      };

      await comfyWorkflowDB.saveCustomWorkflow(newEntry);

      setWorkflowLibrary((prev) => [...prev, newEntry]);
      setActiveWorkflowId(newId);
      setShowImportModal(false);
      setImportManifestText('');
      setImportWorkflowText('');
      setManifestFileName('');
      setWorkflowFileName('');
      addLog('success', `Saved custom workflow "${title}" to device IndexedDB`);
    } catch (err) {
      setImportError(err.message);
    }
  };

  // Delete a custom user-imported workflow from IndexedDB
  const handleDeleteCustomWorkflow = useCallback(
    async (idToRemove) => {
      try {
        await comfyWorkflowDB.deleteCustomWorkflow(idToRemove);
        setWorkflowLibrary((prev) => {
          const next = prev.filter((item) => item.id !== idToRemove);
          if (activeWorkflowId === idToRemove && next.length > 0) {
            setActiveWorkflowId(next[0].id);
          }
          return next;
        });
        addLog('info', `Removed custom workflow from device IndexedDB`);
      } catch (err) {
        addLog('error', `Failed to delete workflow: ${err.message}`);
      }
    },
    [activeWorkflowId, addLog]
  );

  const groupedControls = useMemo(() => {
    const controls = activeEntry?.manifest?.controls || [];
    return {
      primary: controls.filter((c) => !c.group || c.group === 'primary'),
      tuning: controls.filter((c) => c.group === 'tuning'),
      advanced: controls.filter((c) => c.group === 'advanced')
    };
  }, [activeEntry]);

  const activeBeforeControlId =
    activeEntry?.manifest?.extensions?.image_comparer?.before_control_id || 'source_image';

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col bg-zinc-950 text-zinc-100 font-sans select-none relative">
      {/* 1. MERGED COMPACT ACCORDION HEADER */}
      <CompactAccordionHeader
        workflowCount={workflowLibrary.length}
        onToggleLeftDrawer={() => setShowLeftDrawer((v) => !v)}
        connectionStatus={connectionStatus}
        latencyMs={latencyMs}
        statusMessage={statusMessage}
        endpointInput={endpointInput}
        setEndpointInput={setEndpointInput}
        onPing={() => checkEndpointAndConnect(endpointInput)}
        isExpanded={isHeaderExpanded}
        setIsExpanded={setIsHeaderExpanded}
        activeManifestFilename={activeEntry?.manifestFilename || 'None'}
        showCorsHelp={showCorsHelp}
        setShowCorsHelp={setShowCorsHelp}
        onOpenInspector={() => setShowCodeInspector(true)}
      />

      {/* 2. LEFT SLIDING WORKFLOWS SIDEBAR DRAWER */}
      <LeftWorkflowsDrawer
        isOpen={showLeftDrawer}
        onClose={() => setShowLeftDrawer(false)}
        workflowLibrary={workflowLibrary}
        activeWorkflowId={activeWorkflowId}
        onSelectWorkflow={setActiveWorkflowId}
        onDeleteCustomWorkflow={handleDeleteCustomWorkflow}
        onOpenImportModal={() => setShowImportModal(true)}
        onDownloadManifest={handleDownloadManifest}
      />

      {/* 3. RIGHT SLIDING OUTPUT VIEWPORT & `comfy_outputs` INDEXEDDB GALLERY DRAWER */}
      <RightOutputsDrawer
        isOpen={showRightDrawer}
        onToggle={() => setShowRightDrawer((v) => !v)}
        onClose={() => setShowRightDrawer(false)}
        isGenerating={isGenerating}
        executingNodeId={executingNodeId}
        executingNodeName={executingNodeName}
        progressStep={progressStep}
        connectionStatus={connectionStatus}
        activeMediaOutput={activeMediaOutput}
        setActiveMediaOutput={setActiveMediaOutput}
        comfyOutputsGallery={comfyOutputsGallery}
        galleryLimit={galleryLimit}
        setGalleryLimit={setGalleryLimit}
        onSyncComfyOutputsFolder={handleSyncComfyOutputsFolder}
        onDownloadAllGallery={handleDownloadAllGallery}
        isDownloadingAll={isDownloadingAll}
        onClearGallery={async () => {
          await comfyOutputDB.clearAll();
          setComfyOutputsGallery([]);
          setActiveMediaOutput(null);
          addLog('info', 'Cleared all cached media Blobs from IndexedDB');
        }}
        comparerExtension={activeEntry?.manifest?.extensions?.image_comparer}
        beforeImageUrl={uploadedPreviews[`${activeEntry?.id}:${activeBeforeControlId}`]}
      />

      {/* 4. MAIN FULL-BLEED MOBILE CONTENT */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="px-3.5 pt-3 pb-2.5 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {activeEntry?.manifest?.meta?.badge || 'MOBILE WORKFLOW'}
            </span>
            <button
              type="button"
              onClick={() => setShowRightDrawer(true)}
              className="text-[11px] font-mono text-emerald-400 flex items-center gap-1"
            >
              <span>comfy_outputs ({comfyOutputsGallery.length})</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <h1 className="text-sm font-bold text-zinc-100 mt-1 leading-snug">
            {activeEntry?.manifest?.meta?.title || 'No Paired Workflows Found'}
          </h1>
        </div>

        {/* Sticky Mobile Section Tabs */}
        <div className="sticky top-0 z-20 px-3.5 py-2 flex gap-1.5 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900">
          {[
            { id: 'primary', label: 'Primary', count: groupedControls.primary.length },
            { id: 'tuning', label: 'Tuning', count: groupedControls.tuning.length },
            { id: 'advanced', label: 'Models & IO', count: groupedControls.advanced.length }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${
                activeSection === tab.id
                  ? 'bg-zinc-900 border-emerald-500/60 text-emerald-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono px-1.5 rounded bg-zinc-800 text-zinc-400">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dynamic Manifest Controls */}
        <div className="p-3.5 pr-7 space-y-3 flex-1">
          {(groupedControls[activeSection] || []).map((ctrl) => (
            <ManifestControlField
              key={ctrl.id}
              ctrl={ctrl}
              val={formValues[ctrl.id] !== undefined ? formValues[ctrl.id] : ctrl.default}
              onChange={(newVal) => setFormValues((prev) => ({ ...prev, [ctrl.id]: newVal }))}
              isSeedRandom={!!seedRandomizeMap[ctrl.id]}
              onToggleSeedRandom={() =>
                setSeedRandomizeMap((prev) => ({ ...prev, [ctrl.id]: !prev[ctrl.id] }))
              }
              onRollRandomSeed={() =>
                setFormValues((prev) => ({
                  ...prev,
                  [ctrl.id]: Math.floor(Math.random() * 900000000000000) + 100000000000000
                }))
              }
              availableModels={availableModels}
              uploadedPreviewUrl={uploadedPreviews[`${activeEntry?.id}:${ctrl.id}`]}
              onUploadImage={handleUploadInputMedia}
              isUploadingImage={isUploadingImage}
            />
          ))}
        </div>
      </main>

      {/* 5. STICKY BOTTOM THUMB-ZONE GENERATE BAR */}
      <footer className="p-3 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 shrink-0">
        <button
          type="button"
          disabled={isGenerating || isUploadingImage || !activeEntry}
          onClick={handleRunWorkflow}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            isGenerating || isUploadingImage
              ? 'bg-zinc-800 text-zinc-300'
              : connectionStatus === 'online' || connectionStatus === 'http_only'
              ? 'bg-emerald-500 active:bg-emerald-400 text-zinc-950'
              : 'bg-amber-500 active:bg-amber-400 text-zinc-950'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          {isUploadingImage
            ? 'Uploading Input Image to ComfyUI...'
            : isGenerating
            ? `${executingNodeName} (${progressStep.value}/${progressStep.max})...`
            : connectionStatus === 'online' || connectionStatus === 'http_only'
            ? `Generate (Batch ×${currentRunMeta?.batchCount || formValues.batch_size || 1})`
            : `Run Sandbox (Batch ×${currentRunMeta?.batchCount || formValues.batch_size || 1} → comfy_outputs)`}
        </button>
      </footer>

      {/* 6. FULL-SCREEN MOBILE JSON / MANIFEST / LOGS OVERLAY */}
      {showCodeInspector && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
            <div className="flex gap-1">
              {[
                { id: 'compiled', label: 'API JSON' },
                { id: 'manifest', label: 'manifest.json' },
                { id: 'logs', label: `Logs (${devLogs.length})` }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectorTab(t.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                    inspectorTab === t.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-zinc-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCodeInspector(false)}
              className="p-1.5 rounded-xl bg-zinc-800 text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {inspectorTab === 'logs' ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]">
              {devLogs.map((log, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border ${
                    log.type === 'error'
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className="text-zinc-500 mr-2">[{log.time}]</span>
                  <span>{log.msg}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-emerald-300 select-text">
              <button
                type="button"
                onClick={() => {
                  const text =
                    inspectorTab === 'compiled'
                      ? JSON.stringify(compiledWorkflowJson, null, 2)
                      : JSON.stringify(activeEntry?.manifest || {}, null, 2);
                  navigator.clipboard.writeText(text);
                  setCopiedFlag(true);
                  setTimeout(() => setCopiedFlag(false), 1500);
                }}
                className="mb-2 bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 flex items-center gap-1.5 text-xs"
              >
                {copiedFlag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedFlag ? 'Copied' : 'Copy JSON'}
              </button>
              <pre className="whitespace-pre-wrap wrap-break-word">
                {inspectorTab === 'compiled'
                  ? JSON.stringify(compiledWorkflowJson, null, 2)
                  : JSON.stringify(activeEntry?.manifest || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 7. MOBILE IMPORT CUSTOM MANIFEST MODAL (With Device File Pickers & IndexedDB Persistence) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end justify-center">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full p-4 space-y-3 max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white">Import Paired Workflow</h3>
                <p className="text-[10px] font-mono text-zinc-400">
                  Saves permanently to device IndexedDB (<code>custom_workflows</code>)
                </p>
              </div>
              <button type="button" onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* 1-Tap Multi-File Picker for Mobile Downloads Folder */}
            <label className="w-full py-2.5 px-3 rounded-2xl bg-emerald-500/15 border border-dashed border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer active:bg-emerald-500/25">
              <Upload className="w-4 h-4 shrink-0" />
              <span>Pick .manifest.json & .json Files from Device</span>
              <input
                type="file"
                accept=".json,application/json"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleSelectJsonFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>

            <div className="flex-1 overflow-y-auto space-y-3">
              {/* Manifest JSON Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                    <span>1. Paired manifest.json</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-emerald-400 cursor-pointer">
                      Upload File
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const text = await file.text();
                            setImportManifestText(text);
                            setManifestFileName(file.name);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {activeEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportManifestText(JSON.stringify(activeEntry.manifest, null, 2));
                          setManifestFileName('template.manifest.json');
                        }}
                        className="text-[10px] font-mono text-zinc-400 underline"
                      >
                        Template
                      </button>
                    )}
                  </div>
                </div>
                {manifestFileName && (
                  <div className="text-[10px] font-mono text-emerald-400 truncate">
                    Loaded: {manifestFileName}
                  </div>
                )}
                <textarea
                  rows={4}
                  value={importManifestText}
                  onChange={(e) => setImportManifestText(e.target.value)}
                  placeholder='{"manifest_version": "1.0", "controls": [...]}'
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs font-mono text-zinc-200 select-text"
                />
              </div>

              {/* Workflow API JSON Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. ComfyUI workflow_api.json</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-emerald-400 cursor-pointer">
                      Upload File
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const text = await file.text();
                            setImportWorkflowText(text);
                            setWorkflowFileName(file.name);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {activeEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportWorkflowText(JSON.stringify(activeEntry.workflowApi, null, 2));
                          setWorkflowFileName('template_workflow.json');
                        }}
                        className="text-[10px] font-mono text-zinc-400 underline"
                      >
                        Template
                      </button>
                    )}
                  </div>
                </div>
                {workflowFileName && (
                  <div className="text-[10px] font-mono text-emerald-400 truncate">
                    Loaded: {workflowFileName}
                  </div>
                )}
                <textarea
                  rows={4}
                  value={importWorkflowText}
                  onChange={(e) => setImportWorkflowText(e.target.value)}
                  placeholder="Paste or upload exported ComfyUI API JSON..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs font-mono text-zinc-200 select-text"
                />
              </div>

              {importError && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
                  {importError}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleImportCustomWorkflow}
              className="w-full py-3 rounded-xl bg-emerald-500 active:bg-emerald-400 text-zinc-950 text-xs font-bold"
            >
              Save to Device Workflows Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}