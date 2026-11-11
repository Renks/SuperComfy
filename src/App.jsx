import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Play,
  FolderOpen,
  Plus,
  Download,
  Code2,
  RefreshCw,
  Lock,
  Dices,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Film,
  Music,
  Terminal,
  HelpCircle,
  Check,
  Copy,
  Layers,
  Zap,
  X,
  FileJson,
  FolderSync,
  Trash2,
  ExternalLink
} from 'lucide-react';
import CompactAccordionHeader from './components/CompactAccordianHeader';
import ManifestControlField from './components/ManifestControlField';
import LeftWorkflowsDrawer from './components/LeftWorkflowsDrawer';
import RightOutputsDrawer from './components/RightOutputsDrawer';
// import { STARTER_MANIFEST_JSON, STARTER_WORKFLOW_API_JSON } from './components/StarterWorkflows';
import STARTER_MANIFEST_JSON from './workflows/1.1 Starter - Text to Image (Z Image Turbo).manifest.json';
import STARTER_WORKFLOW_API_JSON from './workflows/1.1 Starter - Text to Image (Z Image Turbo).json';
import { generateClientId, detectMediaCategory, createSimulatedBatchSvgUrl } from './Utils';

// ============================================================================
// 8. MAIN MOBILE APPLICATION (Strictly Mobile-Only Layout)
// ============================================================================
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

  // Step 1: Workflows Directory & Sliding Drawers State
  const [workflowLibrary, setWorkflowLibrary] = useState([
    {
      id: STARTER_MANIFEST_JSON.meta.id,
      filename: '1.1 Starter - Text to Image (Z Image Turbo).json',
      manifestFilename: '1.1 Starter - Text to Image (Z Image Turbo).manifest.json',
      manifest: STARTER_MANIFEST_JSON,
      workflowApi: STARTER_WORKFLOW_API_JSON
    }
  ]);
  const [activeWorkflowId, setActiveWorkflowId] = useState(STARTER_MANIFEST_JSON.meta.id);
  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCodeInspector, setShowCodeInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('compiled');

  // Step 2: Dynamic Form & `comfy_outputs/` Gallery State
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
      msg: 'Initialized mobile SDUI with 1.1 Starter - Text to Image (Z Image Turbo).manifest.json'
    }
  ]);

  // `comfy_outputs/` gallery state + capped loop limit
  const [comfyOutputsGallery, setComfyOutputsGallery] = useState([]);
  const [activeMediaOutput, setActiveMediaOutput] = useState(null);
  const [galleryLimit, setGalleryLimit] = useState(12);

  // Import Modal State
  const [importManifestText, setImportManifestText] = useState('');
  const [importWorkflowText, setImportWorkflowText] = useState('');
  const [importError, setImportError] = useState('');
  const [copiedFlag, setCopiedFlag] = useState(false);

  const activeEntry = useMemo(
    () => workflowLibrary.find((w) => w.id === activeWorkflowId) || workflowLibrary[0],
    [workflowLibrary, activeWorkflowId]
  );

  const addLog = useCallback((type, msg) => {
    setDevLogs((prev) => [{ time: new Date().toLocaleTimeString(), type, msg }, ...prev.slice(0, 49)]);
  }, []);

  // Load default values from paired manifest
  useEffect(() => {
    if (!activeEntry) return;
    const initialVals = {};
    const initialSeedRand = {};
    activeEntry.manifest.controls.forEach((ctrl) => {
      initialVals[ctrl.id] = ctrl.default;
      if (ctrl.component === 'seed') {
        initialSeedRand[ctrl.id] = ctrl.randomize_by_default !== false;
      }
    });
    setFormValues(initialVals);
    setSeedRandomizeMap(initialSeedRand);
  }, [activeEntry]);

  // Live Compiled API JSON (Injects UI controls & prefixes SaveImage into `comfy_outputs/`)
  const compiledWorkflowJson = useMemo(() => {
    if (!activeEntry) return {};
    const clone = JSON.parse(JSON.stringify(activeEntry.workflowApi));

    activeEntry.manifest.controls.forEach((ctrl) => {
      const val = formValues[ctrl.id] !== undefined ? formValues[ctrl.id] : ctrl.default;
      const node = clone[ctrl.target_node];
      if (!node || !node.inputs) return;

      if (ctrl.component === 'aspect_picker' && val) {
        const wKey = (ctrl.width_field || 'inputs.width').replace('inputs.', '');
        const hKey = (ctrl.height_field || 'inputs.height').replace('inputs.', '');
        node.inputs[wKey] = Number(val.width);
        node.inputs[hKey] = Number(val.height);
      } else if (ctrl.target_field) {
        const fieldKey = ctrl.target_field.replace('inputs.', '');
        if (fieldKey === 'filename_prefix') {
          const cleanPrefix = String(val || 'comfyui-output').replace(/^comfy_outputs[\\/]/, '');
          node.inputs[fieldKey] = `comfy_outputs/${cleanPrefix}`;
        } else {
          node.inputs[fieldKey] = val;
        }
      }
    });

    return clone;
  }, [activeEntry, formValues]);

  // Extract single or multi-batch media outputs from ComfyUI `/history` response
  const extractMediaFromHistoryJob = useCallback((baseUrl, promptId, job) => {
    if (!job || !job.outputs) return [];
    const extracted = [];

    Object.entries(job.outputs).forEach(([nodeId, nodeOut]) => {
      const buckets = [
        ...(nodeOut.images || []),
        ...(nodeOut.gifs || []),
        ...(nodeOut.videos || []),
        ...(nodeOut.audio || [])
      ];

      buckets.forEach((item, idx) => {
        if (item && item.filename) {
          const subfolder = item.subfolder || 'comfy_outputs';
          const params = new URLSearchParams({
            filename: item.filename,
            subfolder: item.subfolder || '',
            type: item.type || 'output'
          });
          const mediaUrl = `${baseUrl}/view?${params.toString()}`;
          extracted.push({
            id: `${promptId}-${nodeId}-${idx}-${item.filename}`,
            promptId,
            nodeId,
            filename: item.filename,
            folderPath: `comfy_outputs/${item.filename}`,
            subfolder,
            url: mediaUrl,
            kind: detectMediaCategory(item.filename),
            batchIndex: idx + 1,
            batchTotal: buckets.length,
            timestamp: new Date().toLocaleTimeString()
          });
        }
      });
    });

    return extracted;
  }, []);

  // Fetch specific promptId output from `/history/{promptId}`
  const fetchHistoryOutput = useCallback(
    async (baseUrl, promptId) => {
      try {
        const res = await fetch(`${baseUrl}/history/${promptId}`);
        if (!res.ok) return false;
        const historyData = await res.json();
        const job = historyData[promptId];
        const extractedMedia = extractMediaFromHistoryJob(baseUrl, promptId, job);

        if (extractedMedia.length > 0) {
          setActiveMediaOutput(extractedMedia[0]);
          setComfyOutputsGallery((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = extractedMedia.filter((m) => !existingIds.has(m.id));
            return [...fresh, ...prev];
          });
          setIsGenerating(false);
          setExecutingNodeId(null);
          setShowRightDrawer(true);
          addLog(
            'success',
            `Fetched ${extractedMedia.length} media file(s) into comfy_outputs/`
          );
          return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    },
    [extractMediaFromHistoryJob, addLog]
  );

  // Sync recent outputs from ComfyUI `/history` into `comfy_outputs/` gallery
  const handleSyncComfyOutputsFolder = useCallback(async () => {
    if (connectionStatus !== 'online' && connectionStatus !== 'http_only') {
      addLog('info', 'Endpoint offline: Showing local comfy_outputs/ items in memory.');
      return;
    }
    try {
      const res = await fetch(`${cleanEndpoint}/history`);
      if (!res.ok) return;
      const allHistory = await res.json();
      const collected = [];
      Object.entries(allHistory)
        .reverse()
        .slice(0, galleryLimit)
        .forEach(([pId, job]) => {
          const items = extractMediaFromHistoryJob(cleanEndpoint, pId, job);
          collected.push(...items);
        });

      if (collected.length > 0) {
        setComfyOutputsGallery((prev) => {
          const seen = new Set();
          const merged = [...collected, ...prev].filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          return merged;
        });
        if (!activeMediaOutput) setActiveMediaOutput(collected[0]);
        addLog('success', `Synced ${collected.length} files from ComfyUI into comfy_outputs/`);
      }
    } catch (err) {
      addLog('error', `Folder sync failed: ${err.message}`);
    }
  }, [connectionStatus, cleanEndpoint, galleryLimit, extractMediaFromHistoryJob, activeMediaOutput, addLog]);

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

        try {
          const objRes = await fetch(`${normalized}/object_info/UNETLoader`);
          if (objRes.ok) {
            const objData = await objRes.json();
            const unetList = objData?.UNETLoader?.input?.required?.unet_name?.[0];
            if (Array.isArray(unetList) && unetList.length > 0) {
              setAvailableModels((prev) => ({ ...prev, UNETLoader: unetList }));
            }
          }
        } catch (_) {}

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
    }, 1600);
    return () => clearInterval(timer);
  }, [isGenerating, activePromptId, connectionStatus, cleanEndpoint, fetchHistoryOutput]);

  // Execute Workflow (Supports Multi-Batch Output into `comfy_outputs/`)
  const handleRunWorkflow = async () => {
    const nextValues = { ...formValues };
    activeEntry.manifest.controls.forEach((ctrl) => {
      if (ctrl.component === 'seed' && seedRandomizeMap[ctrl.id]) {
        nextValues[ctrl.id] = Math.floor(Math.random() * 900000000000000) + 100000000000000;
      }
    });
    setFormValues(nextValues);

    const payloadWorkflow = JSON.parse(JSON.stringify(activeEntry.workflowApi));
    activeEntry.manifest.controls.forEach((ctrl) => {
      const val = nextValues[ctrl.id] !== undefined ? nextValues[ctrl.id] : ctrl.default;
      const node = payloadWorkflow[ctrl.target_node];
      if (!node || !node.inputs) return;
      if (ctrl.component === 'aspect_picker' && val) {
        const wKey = (ctrl.width_field || 'inputs.width').replace('inputs.', '');
        const hKey = (ctrl.height_field || 'inputs.height').replace('inputs.', '');
        node.inputs[wKey] = Number(val.width);
        node.inputs[hKey] = Number(val.height);
      } else if (ctrl.target_field) {
        const fieldKey = ctrl.target_field.replace('inputs.', '');
        if (fieldKey === 'filename_prefix') {
          const cleanPrefix = String(val || 'comfyui-output').replace(/^comfy_outputs[\\/]/, '');
          node.inputs[fieldKey] = `comfy_outputs/${cleanPrefix}`;
        } else {
          node.inputs[fieldKey] = val;
        }
      }
    });

    const totalSteps = Number(nextValues.steps || 8);
    const batchCount = Math.max(1, Number(nextValues.batch_size || 1));
    setIsGenerating(true);
    setProgressStep({ value: 0, max: totalSteps });
    setExecutingNodeId('30:44');

    if (connectionStatus === 'online' || connectionStatus === 'http_only') {
      try {
        addLog('info', `POST /prompt (Batch size: ${batchCount} -> comfy_outputs/)`);
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
          throw new Error(data?.error?.message || 'Prompt execution rejected');
        }
        setActivePromptId(data.prompt_id);
      } catch (err) {
        setIsGenerating(false);
        setExecutingNodeId(null);
        addLog('error', `POST /prompt failed: ${err.message}`);
      }
    } else {
      // Sandbox Batch Simulation -> Generates `batchCount` items into `comfy_outputs/`
      addLog('info', `Simulating batch of ${batchCount} media item(s) into comfy_outputs/...`);
      let step = 0;
      const interval = setInterval(() => {
        step += 1;
        setProgressStep({ value: step, max: totalSteps });
        if (step >= totalSteps) {
          clearInterval(interval);
          setIsGenerating(false);
          setExecutingNodeId(null);

          const width = nextValues.aspect_ratio?.width || 1920;
          const height = nextValues.aspect_ratio?.height || 1088;
          const basePrefix = String(nextValues.filename_prefix || 'comfyui-editorial').replace(
            /^comfy_outputs[\\/]/,
            ''
          );

          const generatedBatch = Array.from({ length: batchCount }, (_, idx) => {
            const itemSeed = Number(nextValues.seed || 1000) + idx;
            const filename = `${basePrefix}_${String(Date.now()).slice(-4)}_0${idx + 1}.png`;
            return {
              id: `sim-${Date.now()}-${idx}`,
              promptId: 'sandbox-batch',
              nodeId: '76',
              filename,
              folderPath: `comfy_outputs/${filename}`,
              kind: 'image',
              isSimulated: true,
              url: createSimulatedBatchSvgUrl({
                promptText: nextValues.prompt_text,
                seed: itemSeed,
                batchIndex: idx,
                batchTotal: batchCount,
                width,
                height
              }),
              seed: itemSeed,
              resolution: `${width}×${height}`,
              batchIndex: idx + 1,
              batchTotal: batchCount,
              timestamp: new Date().toLocaleTimeString()
            };
          });

          setActiveMediaOutput(generatedBatch[0]);
          setComfyOutputsGallery((prev) => [...generatedBatch, ...prev]);
          setShowRightDrawer(true);
          addLog('success', `Saved ${batchCount} file(s) to comfy_outputs/ gallery`);
        }
      }, 180);
    }
  };

  // Download Paired Manifest
  const handleDownloadManifest = () => {
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

  // Import Custom Workflow Manifest
  const handleImportCustomWorkflow = () => {
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
      if (!parsedWorkflow) parsedWorkflow = STARTER_WORKFLOW_API_JSON;

      const newId = (parsedManifest.meta?.id || 'custom') + '-' + Date.now();
      const title = parsedManifest.meta?.title || 'Custom Mobile Workflow';
      const newEntry = {
        id: newId,
        filename: parsedManifest.workflow_file || `${title}.json`,
        manifestFilename: `${title}.manifest.json`,
        manifest: { ...parsedManifest, meta: { ...parsedManifest.meta, id: newId, title } },
        workflowApi: parsedWorkflow
      };

      setWorkflowLibrary((prev) => [...prev, newEntry]);
      setActiveWorkflowId(newId);
      setShowImportModal(false);
      setImportManifestText('');
      setImportWorkflowText('');
    } catch (err) {
      setImportError(err.message);
    }
  };

  const groupedControls = useMemo(() => {
    const controls = activeEntry?.manifest?.controls || [];
    return {
      primary: controls.filter((c) => !c.group || c.group === 'primary'),
      tuning: controls.filter((c) => c.group === 'tuning'),
      advanced: controls.filter((c) => c.group === 'advanced')
    };
  }, [activeEntry]);

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
        activeManifestFilename={activeEntry.manifestFilename}
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
        onOpenImportModal={() => setShowImportModal(true)}
        onDownloadManifest={handleDownloadManifest}
      />

      {/* 3. RIGHT SLIDING OUTPUT VIEWPORT & `comfy_outputs` GALLERY DRAWER */}
      <RightOutputsDrawer
        isOpen={showRightDrawer}
        onToggle={() => setShowRightDrawer((v) => !v)}
        onClose={() => setShowRightDrawer(false)}
        isGenerating={isGenerating}
        executingNodeId={executingNodeId}
        progressStep={progressStep}
        connectionStatus={connectionStatus}
        activeMediaOutput={activeMediaOutput}
        setActiveMediaOutput={setActiveMediaOutput}
        comfyOutputsGallery={comfyOutputsGallery}
        galleryLimit={galleryLimit}
        setGalleryLimit={setGalleryLimit}
        onSyncComfyOutputsFolder={handleSyncComfyOutputsFolder}
        onClearGallery={() => {
          setComfyOutputsGallery([]);
          setActiveMediaOutput(null);
        }}
      />

      {/* 4. MAIN FULL-BLEED MOBILE CONTENT (No Fake Phone Frame) */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Compact Workflow Title Strip */}
        <div className="px-3.5 pt-3 pb-2.5 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {activeEntry.manifest.meta?.badge || 'MOBILE WORKFLOW'}
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
            {activeEntry.manifest.meta?.title}
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
            />
          ))}
        </div>
      </main>

      {/* 5. STICKY BOTTOM THUMB-ZONE GENERATE BAR */}
      <footer className="p-3 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 shrink-0">
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleRunWorkflow}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            isGenerating
              ? 'bg-zinc-800 text-zinc-300'
              : connectionStatus === 'online' || connectionStatus === 'http_only'
              ? 'bg-emerald-500 active:bg-emerald-400 text-zinc-950'
              : 'bg-amber-500 active:bg-amber-400 text-zinc-950'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          {isGenerating
            ? `Generating (${progressStep.value}/${progressStep.max})...`
            : connectionStatus === 'online' || connectionStatus === 'http_only'
            ? `Generate (Batch ×${formValues.batch_size || 1})`
            : `Run Sandbox (Batch ×${formValues.batch_size || 1} → comfy_outputs)`}
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
                  className="p-2 rounded-lg border bg-zinc-900 border-zinc-800 text-zinc-300"
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
                      : JSON.stringify(activeEntry.manifest, null, 2);
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
                  : JSON.stringify(activeEntry.manifest, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 7. MOBILE IMPORT CUSTOM MANIFEST MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end justify-center">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full p-4 space-y-3 max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-sm font-bold text-white">Import Paired Manifest</h3>
              <button type="button" onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">1. Paired manifest.json</label>
                <button
                  type="button"
                  onClick={() => setImportManifestText(JSON.stringify(STARTER_MANIFEST_JSON, null, 2))}
                  className="text-[11px] font-mono text-emerald-400"
                >
                  Load Template
                </button>
              </div>
              <textarea
                rows={5}
                value={importManifestText}
                onChange={(e) => setImportManifestText(e.target.value)}
                placeholder='{"manifest_version": "1.0", "controls": [...]}'
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs font-mono text-zinc-200 select-text"
              />

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">2. workflow_api.json</label>
                <button
                  type="button"
                  onClick={() =>
                    setImportWorkflowText(JSON.stringify(STARTER_WORKFLOW_API_JSON, null, 2))
                  }
                  className="text-[11px] font-mono text-emerald-400"
                >
                  Load Starter API JSON
                </button>
              </div>
              <textarea
                rows={4}
                value={importWorkflowText}
                onChange={(e) => setImportWorkflowText(e.target.value)}
                placeholder="Paste ComfyUI API JSON..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs font-mono text-zinc-200 select-text"
              />

              {importError && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
                  {importError}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleImportCustomWorkflow}
              className="w-full py-3 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold"
            >
              Add to Workflows Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}