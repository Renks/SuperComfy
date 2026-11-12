import React, { useMemo } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Images as ImageIcon,
  Film,
  Music,
  Zap,
  X,
  FolderSync,
  Trash2,
  Database
} from 'lucide-react';

function RightOutputsDrawer({
  isOpen,
  onToggle,
  onClose,
  isGenerating,
  executingNodeId,
  progressStep,
  connectionStatus,
  activeMediaOutput,
  setActiveMediaOutput,
  comfyOutputsGallery,
  galleryLimit,
  setGalleryLimit,
  onSyncComfyOutputsFolder,
  onClearGallery
}) {
  // Optimized capped loop over IndexedDB `comfy_outputs` items
  const visibleGalleryItems = useMemo(
    () => comfyOutputsGallery.slice(0, galleryLimit),
    [comfyOutputsGallery, galleryLimit]
  );

  return (
    <>
      {/* STICKY RIGHT-EDGE CENTERED ARROW HANDLE (Always Accessible) */}
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle Output Viewport and comfy_outputs gallery"
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-l-2xl border-l border-y shadow-2xl transition-all duration-300 ${
          isOpen
            ? 'translate-x-full opacity-0 pointer-events-none'
            : isGenerating
            ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
            : 'bg-zinc-900/95 text-zinc-100 border-zinc-700/90 backdrop-blur-md'
        }`}
      >
        <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        <span
          className="text-[9px] font-mono font-bold uppercase tracking-widest"
          style={{ writingMode: 'vertical-rl' }}
        >
          Outputs
        </span>
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
            isGenerating
              ? 'bg-zinc-950 text-emerald-400 animate-pulse'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          {comfyOutputsGallery.length}
        </span>
      </button>

      {/* Dimming Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Right Sliding Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[90vw] max-w-120 bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Attached Close Arrow Tab on Left Edge of Open Drawer */}
        {isOpen && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Output Drawer"
            className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-zinc-900 border-l border-y border-zinc-700 rounded-l-2xl flex items-center justify-center text-emerald-400 shadow-xl"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        {/* Drawer Header */}
        <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              Output Gallery
            </h2>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-400" />
              <span>IndexedDB: <code className="text-emerald-400">comfy_outputs</code> ({comfyOutputsGallery.length})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 active:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content: Top Active Viewport + Bottom `comfy_outputs` Gallery */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* 1. ACTIVE OUTPUT VIEWPORT */}
          <div className="rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 min-h-52.5 flex flex-col justify-center">
            {isGenerating ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto animate-pulse">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-100">
                    {connectionStatus === 'online' || connectionStatus === 'http_only'
                      ? `Executing Node ${executingNodeId || '...'} on ComfyUI`
                      : 'Rendering Batch Blobs into IndexedDB...'}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400">
                    Step {progressStep.value} of {progressStep.max}
                  </div>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((progressStep.value / Math.max(1, progressStep.max)) * 100)
                      )}%`
                    }}
                  />
                </div>
              </div>
            ) : activeMediaOutput ? (
              <div className="w-full flex flex-col">
                {activeMediaOutput.kind === 'video' ? (
                  <video
                    src={activeMediaOutput.url}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full max-h-70 object-contain bg-black"
                  />
                ) : activeMediaOutput.kind === 'audio' ? (
                  <div className="p-6 flex flex-col items-center gap-3">
                    <Music className="w-9 h-9 text-emerald-400" />
                    <audio src={activeMediaOutput.url} controls className="w-full" />
                  </div>
                ) : (
                  <img
                    src={activeMediaOutput.url}
                    alt={activeMediaOutput.filename}
                    className="w-full max-h-70 object-contain bg-zinc-950"
                  />
                )}

                <div className="p-2.5 bg-zinc-900/90 border-t border-zinc-800 space-y-1 text-[10px] font-mono">
                  <div className="flex items-center justify-between text-zinc-200">
                    <span className="truncate font-semibold">{activeMediaOutput.filename}</span>
                    {activeMediaOutput.batchTotal > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        Batch {activeMediaOutput.batchIndex}/{activeMediaOutput.batchTotal}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>
                      {activeMediaOutput.resolution || 'Output'} • Seed: {activeMediaOutput.seed || 'N/A'}
                    </span>
                    <a
                      href={activeMediaOutput.url}
                      download={activeMediaOutput.filename}
                      className="text-emerald-400 flex items-center gap-1 font-semibold"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save File</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-zinc-300">No Active Media Selected</div>
                <p className="text-[11px] text-zinc-500">
                  Tap Generate or sync your <code>comfy_outputs</code> store below.
                </p>
              </div>
            )}
          </div>

          {/* 2. `comfy_outputs` PERSISTENT INDEXEDDB GALLERY WITH CAPPED LOOP */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  comfy_outputs
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400">
                  Showing {visibleGalleryItems.length}/{comfyOutputsGallery.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <select
                  value={galleryLimit}
                  onChange={(e) => setGalleryLimit(Number(e.target.value))}
                  aria-label="Gallery loop cap"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-300"
                >
                  <option value={12}>Cap: 12</option>
                  <option value={24}>Cap: 24</option>
                  <option value={50}>Cap: 50</option>
                </select>

                <button
                  type="button"
                  onClick={onSyncComfyOutputsFolder}
                  title="Sync missing outputs from ComfyUI /history into IndexedDB"
                  className="p-1.5 rounded-lg bg-zinc-800 active:bg-zinc-700 border border-zinc-700 text-emerald-400"
                >
                  <FolderSync className="w-3.5 h-3.5" />
                </button>

                {comfyOutputsGallery.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearGallery}
                    title="Clear IndexedDB gallery cache"
                    className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-500 active:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {visibleGalleryItems.length === 0 ? (
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-center text-[11px] text-zinc-500">
                <code>comfy_outputs</code> IndexedDB store is empty. Set Batch Count (1–4) and tap Generate!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleGalleryItems.map((item) => {
                  const isCurrent = activeMediaOutput?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveMediaOutput(item)}
                      className={`group relative rounded-xl overflow-hidden border text-left transition-all bg-zinc-950 ${
                        isCurrent
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'border-zinc-800'
                      }`}
                    >
                      <div className="aspect-video w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
                        {item.kind === 'video' ? (
                          <Film className="w-6 h-6 text-emerald-400" />
                        ) : item.kind === 'audio' ? (
                          <Music className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <img
                            src={item.url}
                            alt={item.filename}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-1.5 bg-zinc-950/95">
                        <div className="text-[10px] font-mono text-zinc-200 truncate">
                          {item.filename}
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 mt-0.5">
                          <span>{item.timestamp}</span>
                          {item.batchTotal > 1 && (
                            <span className="text-emerald-400">
                              #{item.batchIndex}/{item.batchTotal}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default RightOutputsDrawer;