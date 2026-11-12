import React from 'react';
import {
  FolderOpen,
  Code2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  HelpCircle,
  X
} from 'lucide-react';

function CompactAccordionHeader({
  workflowCount,
  onToggleLeftDrawer,
  connectionStatus,
  latencyMs,
  statusMessage,
  endpointInput,
  setEndpointInput,
  onPing,
  isExpanded,
  setIsExpanded,
  activeManifestFilename,
  showCorsHelp,
  setShowCorsHelp,
  onOpenInspector
}) {
  return (
    <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 shrink-0">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleLeftDrawer}
          className="flex items-center gap-1.5 bg-zinc-800 active:bg-zinc-700 border border-zinc-700/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-100 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Workflows</span>
          <span className="px-1.5 py-0.2 rounded-md bg-zinc-950 text-emerald-400 font-mono text-[10px]">
            {workflowCount}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <div
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-xl cursor-pointer"
          >
            <span className="relative flex h-2.5 w-2.5">
              {connectionStatus === 'online' && (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                </>
              )}
              {connectionStatus === 'http_only' && (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
              )}
              {connectionStatus === 'pinging' && (
                <span className="animate-pulse relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              )}
              {connectionStatus === 'offline' && (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-[0_0_10px_#f43f5e]" />
              )}
            </span>
            <span
              className={`text-[10px] font-mono font-bold ${
                connectionStatus === 'online'
                  ? 'text-emerald-400'
                  : connectionStatus === 'offline'
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }`}
            >
              {connectionStatus === 'online'
                ? `${latencyMs}ms`
                : connectionStatus === 'http_only'
                ? 'HTTP'
                : connectionStatus === 'pinging'
                ? 'PING'
                : 'DOWN'}
            </span>
          </div>

          <button
            type="button"
            onClick={onPing}
            className="bg-zinc-800 active:bg-zinc-700 border border-zinc-700 text-zinc-100 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                connectionStatus === 'pinging' ? 'animate-spin text-amber-400' : 'text-emerald-400'
              }`}
            />
            <span>Ping</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label="Toggle developer endpoint settings"
            className={`p-1.5 rounded-xl border transition-colors ${
              isExpanded
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400'
            }`}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div
        className={`grid transition-all duration-300 ease-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-1 border-t border-zinc-800/80 space-y-2 bg-zinc-950/60">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onPing();
                }}
                placeholder="http://127.0.0.1:8188"
                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCorsHelp((v) => !v)}
                className={`p-2 rounded-xl border text-xs ${
                  showCorsHelp
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenInspector}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-mono"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
            </div>

            <div className="flex flex-col gap-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800/80">
              <div className="truncate">
                <span className="text-zinc-500">STATUS: </span>
                <span
                  className={
                    connectionStatus === 'online'
                      ? 'text-emerald-400'
                      : connectionStatus === 'offline'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }
                >
                  {statusMessage}
                </span>
              </div>
              <div className="truncate text-zinc-500">
                MANIFEST: <span className="text-zinc-300">{activeManifestFilename}</span>
              </div>
            </div>

            {showCorsHelp && (
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/40 text-[11px] space-y-1 text-zinc-300">
                <div className="font-semibold text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" /> Local / LAN ComfyUI Flags
                  </span>
                  <button type="button" onClick={() => setShowCorsHelp(false)}>
                    <X className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                </div>
                <p className="leading-relaxed">
                  Run ComfyUI with:{' '}
                  <code className="text-emerald-400 bg-zinc-900 px-1.5 py-0.5 rounded">
                    python main.py --listen 0.0.0.0 --enable-cors-header *
                  </code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default CompactAccordionHeader;