import React from 'react';
import {
  Plus,
  Download,
  Layers,
  X,
  FileJson
} from 'lucide-react';

function LeftWorkflowsDrawer({
  isOpen,
  onClose,
  workflowLibrary,
  activeWorkflowId,
  onSelectWorkflow,
  onOpenImportModal,
  onDownloadManifest
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] bg-zinc-900 border-r border-zinc-800 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              Workflows Directory
            </h2>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Showing paired <code>.manifest.json</code> files
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 active:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {workflowLibrary.map((item) => {
            const isSelected = item.id === activeWorkflowId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectWorkflow(item.id);
                  onClose();
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/70'
                    : 'bg-zinc-950/70 border-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {item.manifest.meta?.badge || 'PAIRED'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {item.manifest.controls?.length || 0} controls
                  </span>
                </div>
                <div className="font-semibold text-xs text-zinc-100 leading-snug mt-1">
                  {item.manifest.meta?.title}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 truncate mt-1.5 flex items-center gap-1">
                  <FileJson className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{item.manifestFilename}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-zinc-800 space-y-2 bg-zinc-950/60">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenImportModal();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 active:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Import Custom Workflow (Manifest)
          </button>
          <button
            type="button"
            onClick={onDownloadManifest}
            className="w-full py-2 px-3 rounded-xl bg-zinc-900 active:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export Paired .manifest.json
          </button>
        </div>
      </aside>
    </>
  );
}

export default LeftWorkflowsDrawer;